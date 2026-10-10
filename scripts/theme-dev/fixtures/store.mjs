// Builds Shopify-shaped Liquid objects from fixtures/catalog.mjs.
// createStore({ empty }) — empty:true models the brand-new store the theme was
// built against: zero products, only the automatic `all` + `frontpage`
// collections, the default Shopify menus. Pages, blog and policies stay
// (content, not catalog).
// createStore({ real }) — real:true loads the live catalogue
// (.out/real-products.json, see fixtures/fetch-real.mjs): its products, options,
// variants, CDN images, tags and types, with Shopify's default menus, the `all`
// and `frontpage` collections (plus any other published collection), the
// custom.* metafields from fixtures/real-metafields.json (Admin API export, typed
// like Shopify's Liquid: see metafieldDrop), and every variant tracked with 5 in
// stock on a deny policy.
import { SHOP, PRODUCTS, COLLECTIONS, PAGES, BLOGS, MENUS, EMPTY_MENUS, POLICIES, CUSTOMER } from './catalog.mjs';
import { loadRealCatalog } from './fetch-real.mjs';
import { ImageRegistry, MetafieldDrop, OptionValueDrop, productJson } from '../lib/drops.mjs';
import { FIXTURE_IMG_DIR, stripHtml, handleize } from '../lib/util.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The custom.* metafield overlay for the real catalogue: { products: {handle: {key: {type, value}}},
 *  variants: {variantId: {key: {type, value}}} }, values as the Admin API returns them (strings). */
export const REAL_METAFIELDS_FILE = process.env.REAL_METAFIELDS || path.join(path.dirname(fileURLToPath(import.meta.url)), 'real-metafields.json');

let metafieldOverlayCache = null;
/** The overlay, read once per file change; empty when the file is missing or broken. */
export function loadMetafieldOverlay(file = REAL_METAFIELDS_FILE) {
  let mtime = 0;
  try { mtime = fs.statSync(file).mtimeMs; } catch { return { products: {}, variants: {} }; }
  if (metafieldOverlayCache && metafieldOverlayCache.file === file && metafieldOverlayCache.mtime === mtime) return metafieldOverlayCache.data;
  let data = { products: {}, variants: {} };
  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    data = { products: j.products || {}, variants: j.variants || {} };
  } catch (e) {
    process.stderr.write(`real-metafields: ${file} could not be read (${e.message}); no metafields merged\n`);
  }
  metafieldOverlayCache = { file, mtime, data };
  return data;
}

function parseJsonValue(v) {
  if (v == null || typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return v; }
}

/** One scalar of a metafield type, typed the way Shopify's Liquid hands it to a theme. */
function typedScalar(type, v) {
  if (v == null) return null;
  switch (type) {
    case 'boolean': return v === true || String(v).trim().toLowerCase() === 'true';
    case 'number_integer': { const n = parseInt(String(v), 10); return Number.isNaN(n) ? null : n; }
    case 'number_decimal': { const n = parseFloat(String(v)); return Number.isNaN(n) ? null : n; }
    case 'rating': {
      const r = typeof v === 'object' ? v : parseJsonValue(String(v));
      return r && typeof r === 'object' ? { rating: Number(r.value ?? r.rating), scale_min: Number(r.scale_min ?? 1), scale_max: Number(r.scale_max ?? 5) } : null;
    }
    case 'json':
    case 'dimension':
    case 'weight':
    case 'volume':
    case 'money':
      return typeof v === 'string' ? parseJsonValue(v) : v;
    default: return typeof v === 'string' ? v : String(v);
  }
}

/**
 * A Shopify-typed metafield drop from an Admin API style {type, value} pair (value
 * as a string, or already typed). Like Shopify's Liquid:
 *   boolean → true/false · number_integer / number_decimal → number ·
 *   list.* → array of typed items (.value) · json → object/array (.value) ·
 *   single_line_text_field / multi_line_text_field and others → string.
 * The drop exposes .value and .type, and prints its value. null for an empty value.
 */
export function metafieldDrop(entry) {
  if (entry == null) return null;
  if (entry instanceof MetafieldDrop) return entry;
  const type = String(entry.type || 'single_line_text_field');
  let value = entry.value;
  if (type.startsWith('list.')) {
    const itemType = type.slice(5);
    const arr = Array.isArray(value) ? value : parseJsonValue(value);
    value = Array.isArray(arr) ? arr.map((x) => typedScalar(itemType, x)).filter((x) => x != null) : [];
  } else {
    value = typedScalar(type, value);
  }
  if (value == null || (typeof value === 'string' && value === '')) return null;
  return new MetafieldDrop(value, type);
}

/** {key: {type, value}} → {key: MetafieldDrop}, dropping empty values. */
export function metafieldNamespace(entries) {
  const out = {};
  for (const [k, e] of Object.entries(entries || {})) {
    const d = metafieldDrop(e);
    if (d) out[k] = d;
  }
  return out;
}

/** Shopify returns at most 50 products from collection.products / search.results outside {% paginate %}. */
export const SHOPIFY_PAGE_LIMIT = 50;
/** Real-catalogue stock: the live store holds 5 of every variant (placeholder stock). */
export const REAL_INVENTORY = 5;

/**
 * A list as Liquid sees it outside paginate: the first 50 items. The full list
 * rides along as a hidden `_all` property for the paginate tag.
 */
export function shopifyLimited(list, limit = SHOPIFY_PAGE_LIMIT) {
  const arr = list.slice(0, limit);
  Object.defineProperty(arr, '_all', { value: list, enumerable: false });
  return arr;
}

/**
 * Media drop for an image: like Shopify, media.id is the media id (not the image id),
 * and media.preview_image is the image. Cached so a product's media keep their identity.
 */
const mediaCache = new WeakMap();
export function mediaOf(img) {
  if (!img) return null;
  if (!mediaCache.has(img)) mediaCache.set(img, { ...img, id: img.media_id, preview_image: img, media_type: 'image' });
  return mediaCache.get(img);
}

const toPence = (v) => (v == null || v === '' ? null : Math.round(parseFloat(String(v)) * 100));

/** products.json product → the record shape productView() reads. */
function realRecord(p, pIdx, images, overlay = null) {
  const opts = Array.isArray(p.options) ? p.options : [];
  const isDefault = !opts.length || (opts.length === 1 && opts[0].name === 'Title' && p.variants.length === 1 && p.variants[0].title === 'Default Title');
  const optionNames = isDefault ? ['Title'] : opts.map((o) => o.name);
  const altById = new Map();
  for (const v of p.variants) if (v.featured_image && v.featured_image.alt) altById.set(v.featured_image.id, v.featured_image.alt);
  const imgs = (p.images || []).map((im, i) => images.remote({
    id: im.id, mediaId: im.media_id, src: im.src, width: im.width, height: im.height,
    alt: im.alt || altById.get(im.id) || p.title, position: im.position || i + 1, productId: p.id, variantIds: im.variant_ids || [],
  })).filter(Boolean);
  const variants = p.variants.map((v) => {
    const values = isDefault ? ['Default Title'] : [v.option1, v.option2, v.option3].filter((x) => x != null);
    const compare = toPence(v.compare_at_price);
    const qty = REAL_INVENTORY;
    return {
      id: v.id,
      title: v.title,
      values,
      price: toPence(v.price) || 0,
      compare_at_price: compare && compare > 0 ? compare : null,
      sku: v.sku || '',
      tracked: true, qty, policy: 'deny',
      available: v.available !== false && qty > 0,
      mostChosen: false,
      weight: Number(v.grams) || 0,
      imageId: v.featured_image ? v.featured_image.id : null,
    };
  });
  const tags = Array.isArray(p.tags) ? p.tags : String(p.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
  const raw = {
    key: p.handle, real: true, title: p.title, handle: p.handle, type: p.product_type || '', vendor: p.vendor || '',
    tags, body_html: p.body_html || '', options: isDefault ? [] : optionNames, created_at: p.created_at, published_at: p.published_at || p.created_at,
    custom: (overlay && overlay.products && overlay.products[p.handle]) || null,
  };
  for (const v of variants) v.custom = (overlay && overlay.variants && overlay.variants[String(v.id)]) || null;
  return { raw, id: p.id, pIdx, optionNames, variants, images: imgs };
}

export const SORT_OPTIONS = [
  { value: 'manual', name: 'Featured' },
  { value: 'best-selling', name: 'Best selling' },
  { value: 'title-ascending', name: 'Alphabetically, A-Z' },
  { value: 'title-descending', name: 'Alphabetically, Z-A' },
  { value: 'price-ascending', name: 'Price, low to high' },
  { value: 'price-descending', name: 'Price, high to low' },
  { value: 'created-ascending', name: 'Date, old to new' },
  { value: 'created-descending', name: 'Date, new to old' },
];

/**
 * Array with non-enumerable handle keys (like Shopify's `collections`, `pages`,
 * `linklists`): `x.handle` / `x['handle']` resolve, `size`/`first`/`last` and
 * array filters (`sort`, `sort_natural`, `map`, `where`) behave as on Shopify.
 * A plain keyed object would make liquidjs `sort` wrap it into one blank item.
 */
export function keyed(list, keyFn = (x) => x.handle) {
  const arr = [...list];
  for (const item of list) {
    const k = keyFn(item);
    if (!(k in arr)) Object.defineProperty(arr, k, { value: item, enumerable: false });
  }
  return arr;
}

function cartesian(options) {
  if (!options.length) return [['Default Title']];
  return options.reduce((acc, [, values]) => acc.flatMap((a) => values.map((v) => [...a, v])), [[]]);
}

export function createStore({ empty = false, real = false, imgDir = FIXTURE_IMG_DIR, realCatalog = null, metafieldOverlay = null } = {}) {
  if (empty) real = false;
  const images = new ImageRegistry(imgDir);
  const realCat = real ? (realCatalog || loadRealCatalog()) : null;
  const rawProducts = empty || real ? [] : PRODUCTS;

  // ---------------------------------------------------------------- products
  const overlay = real ? (metafieldOverlay || loadMetafieldOverlay()) : null;
  const records = real ? realCat.products.map((p, pIdx) => realRecord(p, pIdx, images, overlay)) : rawProducts.map((raw, pIdx) => {
    const id = 8800000000 + pIdx;
    const combos = cartesian(raw.options);
    const optionNames = raw.options.length ? raw.options.map(([n]) => n) : ['Title'];
    const variants = combos.map((values, vIdx) => {
      const title = values.join(' / ');
      const size = values[0];
      const price = raw.prices[size] ?? raw.prices[title] ?? Object.values(raw.prices)[0];
      const compare = raw.compare ? raw.compare[size] ?? null : null;
      const inv = (raw.inventory && (raw.inventory[title] || raw.inventory[size])) || null;
      const tracked = !!inv;
      const qty = inv ? inv.qty : 0;
      const policy = inv ? inv.policy : 'deny';
      const available = !tracked || policy === 'continue' || qty > 0;
      const mostChosen = raw.mostChosen && size === raw.mostChosen && (values.length < 2 || values[1] === raw.options[1][1][0]);
      return {
        id: 45000000000 + pIdx * 100 + vIdx,
        title,
        values,
        price,
        compare_at_price: compare,
        sku: `PL-${raw.key.toUpperCase()}-${handleize(title).toUpperCase() || 'DEFAULT'}`,
        tracked, qty, policy, available, mostChosen,
        weight: 3000 + vIdx * 800,
        custom: (raw.variantCustom && (raw.variantCustom[title] || raw.variantCustom[size])) || null,
      };
    });
    const imgs = raw.images.map(([file, alt], i) => images.image(file, { alt, position: i + 1, productId: id })).filter(Boolean);
    return { raw, id, pIdx, optionNames, variants, images: imgs };
  });

  const byHandle = new Map(records.map((r) => [r.raw.handle, r]));
  const byKey = new Map(records.map((r) => [r.raw.key, r]));
  const variantIndex = new Map();
  records.forEach((r) => r.variants.forEach((v) => variantIndex.set(v.id, { rec: r, v })));
  const defaultViews = new Map();

  function productMetafields(raw) {
    const mf = {};
    if (raw.rating) {
      mf.reviews = {
        rating: new MetafieldDrop({ rating: raw.rating[0], scale_min: 1, scale_max: 5 }, 'rating'),
        rating_count: new MetafieldDrop(raw.rating[1], 'number_integer'),
      };
    }
    const custom = {};
    if (raw.best_for) custom.best_for = new MetafieldDrop(raw.best_for, 'single_line_text_field');
    if (raw.tagline) custom.tagline = new MetafieldDrop(raw.tagline, 'single_line_text_field');
    if (raw.benefits) custom.benefits = new MetafieldDrop(raw.benefits, 'list.single_line_text_field');
    if (raw.specs) custom.specs = new MetafieldDrop(raw.specs, 'multi_line_text_field');
    if (raw.care) custom.care = new MetafieldDrop(raw.care, 'multi_line_text_field');
    // custom.* in Admin API shape ({key: {type, value}}): the real-metafields overlay, or a fixture's own.
    Object.assign(custom, metafieldNamespace(raw.custom));
    if (Object.keys(custom).length) mf.custom = custom;
    return mf;
  }

  function variantMetafields(v) {
    const custom = metafieldNamespace(v.custom);
    if (v.mostChosen) custom.most_chosen = new MetafieldDrop(true, 'boolean');
    return Object.keys(custom).length ? { custom } : {};
  }

  /** Build a product drop; selectedVariantId sets selected_variant (from ?variant=). */
  function productView(rec, selectedVariantId = null) {
    if (!rec) return null;
    if (selectedVariantId == null && defaultViews.has(rec.id)) return defaultViews.get(rec.id);
    const raw = rec.raw;
    const url = `/products/${raw.handle}`;
    const product = {};
    const variants = rec.variants.map((v) => {
      const options = v.values;
      return {
        id: v.id,
        title: v.title,
        name: v.title === 'Default Title' ? raw.title : `${raw.title} - ${v.title}`,
        option1: options[0] ?? null,
        option2: options[1] ?? null,
        option3: options[2] ?? null,
        options,
        sku: v.sku,
        barcode: null,
        price: v.price,
        compare_at_price: v.compare_at_price,
        available: v.available,
        inventory_quantity: v.qty,
        inventory_management: v.tracked ? 'shopify' : null,
        inventory_policy: v.policy,
        incoming: false,
        next_incoming_date: null,
        requires_shipping: true,
        'requires_shipping?': true,
        taxable: true,
        weight: v.weight,
        weight_unit: 'kg',
        weight_in_unit: v.weight / 1000,
        url: `${url}?variant=${v.id}`,
        featured_image: v.imageId ? rec.images.find((m) => m.id === v.imageId) || null : null,
        featured_media: v.imageId ? mediaOf(rec.images.find((m) => m.id === v.imageId)) : null,
        image: v.imageId ? rec.images.find((m) => m.id === v.imageId) || null : null,
        selected: selectedVariantId != null && v.id === Number(selectedVariantId),
        matched: true,
        metafields: variantMetafields(v),
        unit_price: null,
        unit_price_measurement: null,
        store_availabilities: [],
        quantity_rule: { min: 1, max: null, increment: 1 },
        quantity_price_breaks: [],
        'quantity_price_breaks_configured?': false,
        selling_plan_allocations: [],
        requires_selling_plan: false,
        product,
      };
    });
    const firstAvailable = variants.find((v) => v.available) || null;
    const selected = selectedVariantId != null ? variants.find((v) => v.id === Number(selectedVariantId)) || null : null;
    const current = selected || firstAvailable || variants[0];
    const prices = variants.map((v) => v.price);
    const compares = variants.map((v) => v.compare_at_price || 0);
    const hasOnlyDefault = !raw.options.length;
    const optionsWithValues = rec.optionNames.map((name, i) => {
      const values = [...new Set(variants.map((v) => v.options[i]))].map((val) => {
        const match = variants.find((v) => v.options[i] === val && v.options.every((o, j) => j === i || o === current.options[j])) || variants.find((v) => v.options[i] === val);
        return new OptionValueDrop({
          id: 6600000000 + rec.pIdx * 100 + i * 10 + values_index(variants, i, val),
          name: val,
          selected: current.options[i] === val,
          available: variants.some((v) => v.options[i] === val && v.available),
          swatch: null,
          variant: match || null,
          product_url: url,
        });
      });
      const opt = { name, position: i + 1, values, selected_value: current.options[i] };
      opt.toString = function () { return name; };
      return opt;
    });
    const optionsByName = {};
    for (const o of optionsWithValues) { optionsByName[o.name] = o; optionsByName[o.name.toLowerCase()] = o; }
    const media = rec.images.map(mediaOf);
    const description = raw.real ? raw.body_html : `<p>${raw.why}</p>${raw.descriptionExtra || ''}<p>Every PawLunova bed comes with our 100-night trial: sleep on it, and if it is not right we collect it free.</p>`;

    Object.assign(product, {
      id: rec.id,
      object_type: 'product',
      title: raw.title,
      handle: raw.handle,
      url,
      description,
      content: description,
      type: raw.type,
      vendor: raw.vendor || 'PawLunova',
      tags: raw.tags,
      available: variants.some((v) => v.available),
      price: Math.min(...prices),
      price_min: Math.min(...prices),
      price_max: Math.max(...prices),
      price_varies: Math.min(...prices) !== Math.max(...prices),
      compare_at_price: Math.max(...compares) ? Math.min(...compares.filter(Boolean)) : null,
      compare_at_price_min: Math.max(...compares) ? Math.min(...compares.filter(Boolean)) : 0,
      compare_at_price_max: Math.max(...compares),
      compare_at_price_varies: new Set(compares).size > 1,
      variants,
      variants_count: variants.length,
      has_only_default_variant: hasOnlyDefault,
      first_available_variant: firstAvailable,
      selected_variant: selected,
      selected_or_first_available_variant: current,
      options: rec.optionNames,
      options_with_values: optionsWithValues,
      options_by_name: optionsByName,
      featured_image: rec.images[0] || null,
      featured_media: media[0] || null,
      images: rec.images,
      media,
      metafields: productMetafields(raw),
      collections: [],
      template_suffix: null,
      created_at: raw.created_at,
      published_at: raw.published_at || raw.created_at,
      requires_selling_plan: false,
      selling_plan_groups: [],
      selected_selling_plan: null,
      selected_selling_plan_allocation: null,
      selected_or_first_available_selling_plan_allocation: null,
      'gift_card?': false,
      'quantity_price_breaks_configured?': false,
      category: null,
      toJSON() { return productJson(product); },
    });
    product.collections = collectionsFor(raw.key).map((c) => ({ id: c.id, handle: c.handle, title: c.title, url: `/collections/${c.handle}` }));
    if (selectedVariantId == null) defaultViews.set(rec.id, product);
    return product;
  }

  function values_index(variants, i, val) {
    return [...new Set(variants.map((v) => v.options[i]))].indexOf(val);
  }

  function collectionsFor(key) {
    return collectionRecords.filter((c) => c.keys.includes(key));
  }

  const products = () => records.map((r) => productView(r));
  const productByHandle = (handle, variantId = null) => productView(byHandle.get(handle), variantId);
  const productById = (id) => productView(records.find((r) => r.id === Number(id)));
  const variantById = (id) => {
    const hit = variantIndex.get(Number(id));
    if (!hit) return null;
    const p = productView(hit.rec);
    return p.variants.find((v) => v.id === Number(id)) || null;
  };

  // ------------------------------------------------------------- collections
  const collectionRecords = [];
  if (real) {
    // Shopify's order for /collections/all (title A–Z on the live store), then any stragglers.
    const order = (realCat.all || []).filter((h) => byKey.has(h));
    for (const r of records) if (!order.includes(r.raw.key)) order.push(r.raw.key);
    collectionRecords.push({ id: 4400000000, handle: 'all', title: 'Products', description: '', image: null, keys: order, defaultSort: 'manual' });
    const listed = realCat.collections || [];
    if (!listed.some((c) => c.handle === 'frontpage')) collectionRecords.push({ id: 4400000001, handle: 'frontpage', title: 'Home page', description: '', image: null, keys: [], defaultSort: 'manual' });
    listed.forEach((c, i) => collectionRecords.push({
      id: c.handle === 'frontpage' ? 4400000001 : 4400000010 + i, handle: c.handle, title: c.title || c.handle, description: c.description || '', image: null,
      keys: (c.products || []).filter((h) => byKey.has(h)), defaultSort: 'manual',
    }));
  } else {
    collectionRecords.push({
      id: 4400000000, handle: 'all', title: 'Products', description: '', image: null,
      keys: records.map((r) => r.raw.key), defaultSort: 'best-selling',
    });
    collectionRecords.push({ id: 4400000001, handle: 'frontpage', title: 'Home page', description: '', image: null, keys: [], defaultSort: 'manual' });
  }
  if (!empty && !real) {
    COLLECTIONS.forEach((c, i) => collectionRecords.push({
      id: 4400000010 + i, handle: c.handle, title: c.title, description: c.description,
      image: c.image, keys: c.products.filter((k) => byKey.has(k)), defaultSort: 'manual',
    }));
  }

  function optionFilterValues(list, optName) {
    const set = new Map();
    for (const p of list) {
      const o = p.options_with_values.find((x) => x.name.toLowerCase() === optName);
      if (o) for (const v of o.values) set.set(v.name, (set.get(v.name) || 0));
    }
    return [...set.keys()];
  }

  /**
   * Collection drop for a request: filters (filter.*), sort_by. Pagination is
   * applied by the paginate tag.
   */
  function collectionView(handle, { query = new URLSearchParams(), path = null } = {}) {
    const rec = collectionRecords.find((c) => c.handle === handle);
    if (!rec) return null;
    const base = rec.keys.map((k) => productView(byKey.get(k)));
    const basePath = path || `/collections/${handle}`;
    const { filters, filtered } = applyFilters(base, query, basePath);
    const sortBy = query.get('sort_by') || null;
    const sorted = sortProducts(filtered, sortBy || rec.defaultSort);
    const image = rec.image ? images.image(rec.image, { alt: stripHtml(rec.title) }) : null;
    return {
      id: rec.id,
      handle: rec.handle,
      title: rec.title,
      url: `/collections/${rec.handle}`,
      description: rec.description,
      image,
      featured_image: image || (base[0] && base[0].featured_image) || null,
      products: shopifyLimited(sorted),
      products_count: sorted.length,
      all_products_count: base.length,
      sort_by: sortBy,
      default_sort_by: rec.defaultSort,
      sort_options: SORT_OPTIONS,
      filters,
      current_type: null,
      current_vendor: null,
      all_tags: [...new Set(base.flatMap((p) => p.tags))].sort(),
      tags: [...new Set(sorted.flatMap((p) => p.tags))].sort(),
      all_types: [...new Set(base.map((p) => p.type))].sort(),
      all_vendors: [...new Set(base.map((p) => p.vendor))],
      template_suffix: null,
      metafields: {},
      published_at: '2024-06-01T10:00:00Z',
      next_product: null,
      previous_product: null,
      toJSON() { return { id: rec.id, handle: rec.handle, title: rec.title, description: rec.description, products_count: sorted.length }; },
    };
  }

  function sortProducts(list, sortBy) {
    const l = [...list];
    switch (sortBy) {
      case 'title-ascending': return l.sort((a, b) => a.title.localeCompare(b.title));
      case 'title-descending': return l.sort((a, b) => b.title.localeCompare(a.title));
      case 'price-ascending': return l.sort((a, b) => a.price - b.price);
      case 'price-descending': return l.sort((a, b) => b.price - a.price);
      case 'created-ascending': return l.sort((a, b) => a.created_at.localeCompare(b.created_at));
      case 'created-descending': return l.sort((a, b) => b.created_at.localeCompare(a.created_at));
      case 'best-selling': return l.sort((a, b) => ((b.metafields.reviews && b.metafields.reviews.rating_count.value) || 0) - ((a.metafields.reviews && a.metafields.reviews.rating_count.value) || 0));
      default: return l;
    }
  }

  /** Storefront filtering (filter.v.availability / price / option.* , filter.p.product_type). */
  function applyFilters(base, query, basePath) {
    const active = {};
    for (const [k, v] of query.entries()) if (k.startsWith('filter.')) (active[k] = active[k] || []).push(v);
    const priceGte = query.get('filter.v.price.gte');
    const priceLte = query.get('filter.v.price.lte');
    const toCents = (s) => (s === null || s === '' ? null : Math.round(parseFloat(String(s).replace(/,/g, '')) * 100));
    const gte = toCents(priceGte); const lte = toCents(priceLte);

    const defs = [
      { param: 'filter.v.availability', label: 'Availability', type: 'list', values: () => ['1', '0'], labelOf: (v) => (v === '1' ? 'In stock' : 'Out of stock'), test: (p, v) => (v === '1' ? p.available : !p.available) },
      { param: 'filter.v.price', label: 'Price', type: 'price_range' },
      { param: 'filter.v.option.size', label: 'Size', type: 'list', values: (l) => optionFilterValues(l, 'size'), test: (p, v) => p.variants.some((x) => x.available && x.options[p.options.findIndex((n) => n.toLowerCase() === 'size')] === v) },
      { param: 'filter.v.option.colour', label: 'Colour', type: 'list', values: (l) => optionFilterValues(l, 'colour'), test: (p, v) => p.variants.some((x) => x.options[p.options.findIndex((n) => n.toLowerCase() === 'colour')] === v) },
      { param: 'filter.v.option.color', label: 'Color', type: 'list', values: (l) => optionFilterValues(l, 'color'), test: (p, v) => p.variants.some((x) => x.options[p.options.findIndex((n) => n.toLowerCase() === 'color')] === v) },
      { param: 'filter.p.product_type', label: 'Product type', type: 'list', values: (l) => [...new Set(l.map((p) => p.type))].sort(), test: (p, v) => p.type === v },
    ];

    const passes = (p, exceptParam) => {
      for (const d of defs) {
        if (d.param === exceptParam) continue;
        if (d.type === 'price_range') {
          if (gte != null && p.price < gte) return false;
          if (lte != null && p.price > lte) return false;
          continue;
        }
        const vals = active[d.param];
        if (vals && vals.length && !vals.some((v) => d.test(p, v))) return false;
      }
      return true;
    };

    const urlWith = (mutate) => {
      const q = new URLSearchParams(query);
      q.delete('page');
      q.delete('section_id');
      mutate(q);
      const s = q.toString();
      return s ? `${basePath}?${s}` : basePath;
    };

    const filters = [];
    for (const d of defs) {
      if (d.type === 'price_range') {
        const rangeMax = base.length ? Math.max(...base.map((p) => p.price_max)) : 0;
        if (!base.length) continue;
        filters.push({
          label: d.label, param_name: d.param, type: 'price_range', presentation: null, operator: 'AND',
          min_value: { param_name: 'filter.v.price.gte', value: gte },
          max_value: { param_name: 'filter.v.price.lte', value: lte },
          range_max: rangeMax,
          active_values: [], inactive_values: [], values: [],
          url_to_remove: urlWith((q) => { q.delete('filter.v.price.gte'); q.delete('filter.v.price.lte'); }),
        });
        continue;
      }
      const vals = d.values(base);
      if (!vals.length) continue;
      const activeVals = active[d.param] || [];
      const values = vals.map((v) => ({
        label: d.labelOf ? d.labelOf(v) : v,
        value: v,
        count: base.filter((p) => passes(p, d.param) && d.test(p, v)).length,
        active: activeVals.includes(v),
        param_name: d.param,
        image: null,
        swatch: null,
        url_to_add: urlWith((q) => q.append(d.param, v)),
        url_to_remove: urlWith((q) => { const keep = q.getAll(d.param).filter((x) => x !== v); q.delete(d.param); keep.forEach((x) => q.append(d.param, x)); }),
      }));
      filters.push({
        label: d.label, param_name: d.param, type: d.type, presentation: 'text', operator: 'OR',
        values, active_values: values.filter((v) => v.active), inactive_values: values.filter((v) => !v.active),
        url_to_remove: urlWith((q) => q.delete(d.param)),
      });
    }
    return { filters, filtered: base.filter((p) => passes(p, null)) };
  }

  // -------------------------------------------------------------- content
  const pageList = PAGES.map((p, i) => ({
    id: 1200000000 + i,
    object_type: 'page',
    handle: p.handle,
    title: p.title,
    content: p.content,
    url: `/pages/${p.handle}`,
    template_suffix: p.template_suffix,
    author: 'PawLunova',
    published_at: '2025-01-01T09:00:00Z',
    metafields: {},
  }));

  const blogList = BLOGS.map((b, bi) => {
    const blog = { id: 1300000000 + bi, handle: b.handle, title: b.title, url: `/blogs/${b.handle}`, metafields: {} };
    const articles = b.articles.map((a, ai) => {
      const comments = (a.comments || []).map((c, ci) => ({ id: 1500000000 + ci, author: c.author, email: c.email, content: c.content, created_at: c.created_at, status: 'published', url: `/blogs/${b.handle}/${a.handle}#comment-${ci}` }));
      const image = a.image ? images.image(a.image, { alt: a.title }) : null;
      return {
        id: 1400000000 + bi * 100 + ai,
        object_type: 'article',
        handle: a.handle,
        title: a.title,
        url: `/blogs/${b.handle}/${a.handle}`,
        author: a.author,
        content: a.content,
        excerpt: a.excerpt,
        excerpt_or_content: a.excerpt || a.content,
        image,
        published_at: a.published_at,
        created_at: a.published_at,
        updated_at: a.published_at,
        tags: a.tags,
        comments,
        comments_count: comments.length,
        comments_enabled: !!a.comments,
        'comments_enabled?': !!a.comments,
        comment_post_url: `/blogs/${b.handle}/${a.handle}/comments`,
        moderated: true,
        'moderated?': true,
        user: { first_name: 'PawLunova', last_name: 'Team', name: 'PawLunova Team', bio: '', email: SHOP.email, image: null, account_owner: false, homepage: null },
        template_suffix: null,
        metafields: {},
        blog_handle: b.handle,
      };
    });
    articles.forEach((a, i) => { a.previous_article = articles[i + 1] ? { title: articles[i + 1].title, url: articles[i + 1].url } : null; a.next_article = articles[i - 1] ? { title: articles[i - 1].title, url: articles[i - 1].url } : null; });
    Object.assign(blog, {
      articles,
      articles_count: articles.length,
      all_tags: [...new Set(articles.flatMap((a) => a.tags))].sort(),
      tags: [...new Set(articles.flatMap((a) => a.tags))].sort(),
      comments_enabled: articles.some((a) => a.comments_enabled),
      'comments_enabled?': articles.some((a) => a.comments_enabled),
      moderated: true,
      'moderated?': true,
      template_suffix: null,
    });
    return blog;
  });

  function linkDrop(l, currentPath) {
    const links = (l.links || []).map((c) => linkDrop(c, currentPath));
    const current = !!currentPath && l.url === currentPath;
    const childActive = links.some((c) => c.active || c.child_active);
    const type = l.url.startsWith('/collections') ? 'collection_link' : l.url.startsWith('/pages') ? 'page_link' : l.url.startsWith('/blogs') ? 'blog_link' : l.url === '/' ? 'frontpage_link' : l.url.startsWith('/search') ? 'search_link' : 'http_link';
    return {
      title: l.title, url: l.url, type, handle: handleize(l.title),
      active: current, current, child_active: childActive, child_current: links.some((c) => c.current || c.child_current),
      links, levels: links.length ? 1 + Math.max(0, ...links.map((c) => c.levels)) : 0, object: null,
    };
  }

  function linklists(currentPath = null) {
    const menus = empty || real ? EMPTY_MENUS : MENUS;
    const list = Object.entries(menus).map(([handle, m]) => {
      const links = m.links.map((l) => linkDrop(l, currentPath));
      return { handle, title: m.title, links, levels: links.length ? 1 + Math.max(0, ...links.map((c) => c.levels)) : 0 };
    });
    return keyed(list);
  }

  const policies = POLICIES.map((p, i) => ({ id: 1600000000 + i, handle: p.handle, title: p.title, body: p.body, url: `/policies/${p.handle}` }));

  // ------------------------------------------------------------- search
  function searchTerms(q) { return String(q || '').toLowerCase().split(/\s+/).filter(Boolean); }
  function matchProduct(p, terms) {
    const hay = `${p.title} ${p.type} ${p.tags.join(' ')} ${stripHtml(p.description)} ${p.variants.map((v) => v.title).join(' ')}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  }
  /**
   * Shopify's search syntax, as far as the theme's links use it: field terms
   * (tag:"flat dog bed", product_type:"Dog Beds > …", title:, body:, vendor:,
   * variants.title:, variants.sku:), quoted phrases, OR between terms (AND is
   * the default), NOT / a leading "-" to exclude, and brackets (read as plain
   * grouping). Returns OR-groups of AND-ed clauses.
   */
  function parseQuery(q) {
    const groups = [[]];
    let negateNext = false;
    const re = /(-?)(?:([a-z_.]+):)?(?:"([^"]*)"|([^\s()"]+))/gi;
    const src = String(q || '').replace(/[()]/g, ' ');
    let m;
    while ((m = re.exec(src))) {
      const [, neg, field, quoted, bare] = m;
      const word = quoted != null ? quoted : bare;
      if (!field && !neg && quoted == null && word === 'OR') { if (groups[groups.length - 1].length) groups.push([]); continue; }
      if (!field && !neg && quoted == null && word === 'AND') continue;
      if (!field && !neg && quoted == null && word === 'NOT') { negateNext = true; continue; }
      const value = String(word || '').toLowerCase().trim();
      if (!value) continue;
      groups[groups.length - 1].push({ field: field ? field.toLowerCase() : '', value, phrase: quoted != null, not: !!neg || negateNext });
      negateNext = false;
    }
    return groups.filter((g) => g.length);
  }
  const wordsIn = (text) => String(text || '').toLowerCase().split(/[^a-z0-9£]+/).filter(Boolean);
  const PRODUCT_ONLY_FIELDS = new Set(['tag', 'product_type', 'vendor', 'variants.title', 'variants.sku', 'variants.price']);
  function clauseHit(c, r, kind) {
    let hit;
    if (c.field && kind !== 'product' && PRODUCT_ONLY_FIELDS.has(c.field)) hit = false;
    // tag: and product_type: match by words, not whole values: every word of the value
    // appears somewhere in the product's tags (or type). Checked against the live store:
    // tag:"large dog" finds 45 (any tag with "large", any with "dog"), tag:"flat dog bed"
    // finds 9 (one product only has "Flat mattress" + another "… dog bed" tag).
    else if (c.field === 'tag') hit = wordsIn(c.value).every((w) => wordsIn(r.tags.join(' ')).includes(w));
    else if (c.field === 'product_type') hit = wordsIn(c.value).every((w) => wordsIn(r.type).includes(w));
    else if (c.field === 'vendor') hit = String(r.vendor || '').toLowerCase() === c.value;
    else if (c.field === 'variants.title') hit = r.variants.some((v) => String(v.title).toLowerCase().includes(c.value));
    else if (c.field === 'variants.sku') hit = r.variants.some((v) => String(v.sku || '').toLowerCase().includes(c.value));
    else if (c.field === 'variants.price') hit = true;
    else if (c.field === 'title') hit = String(r.title || '').toLowerCase().includes(c.value);
    else if (c.field === 'body') hit = stripHtml(kind === 'product' ? r.description : r.content).toLowerCase().includes(c.value);
    else {
      const hay = kind === 'product'
        ? `${r.title} ${r.type} ${r.tags.join(' ')} ${stripHtml(r.description)} ${r.variants.map((v) => v.title).join(' ')}`.toLowerCase()
        : `${r.title} ${stripHtml(r.content)}`.toLowerCase();
      hit = c.phrase ? hay.includes(c.value) : c.value.split(/\s+/).every((w) => hay.includes(w));
    }
    return c.not ? !hit : hit;
  }
  const queryHit = (groups, r, kind) => groups.some((g) => g.every((c) => clauseHit(c, r, kind)));

  function search(q, { types = ['product', 'page', 'article'], query = new URLSearchParams() } = {}) {
    const groups = parseQuery(q);
    const performed = groups.length > 0;
    let productsHit = performed && types.includes('product') ? products().filter((p) => queryHit(groups, p, 'product')) : [];
    const { filters, filtered } = applyFilters(productsHit, query, '/search');
    productsHit = sortProducts(filtered, query.get('sort_by') || 'relevance');
    const pagesHit = performed && types.includes('page') ? pageList.filter((p) => queryHit(groups, p, 'page')) : [];
    const articlesHit = performed && types.includes('article') ? blogList.flatMap((b) => b.articles).filter((a) => queryHit(groups, a, 'article')) : [];
    const results = [...productsHit, ...pagesHit, ...articlesHit];
    return {
      performed,
      terms: q || '',
      results: shopifyLimited(results),
      results_count: results.length,
      types,
      filters: performed ? filters : [],
      sort_by: query.get('sort_by') || 'relevance',
      default_sort_by: 'relevance',
      sort_options: [{ value: 'relevance', name: 'Relevance' }, ...SORT_OPTIONS.filter((s) => s.value.startsWith('price'))],
    };
  }

  function predictive(q, { limit = 4, types = ['product', 'collection', 'page', 'article', 'query'] } = {}) {
    const terms = searchTerms(q);
    const lim = Math.max(1, Math.min(10, Number(limit) || 4));
    const pick = (arr) => arr.slice(0, lim);
    // Like Shopify, title matches rank above matches in the description/tags/type.
    const inTitle = (p) => terms.every((t) => p.title.toLowerCase().includes(t));
    const productsHit = types.includes('product') ? pick(products().filter((p) => matchProduct(p, terms)).sort((a, b) => inTitle(b) - inTitle(a))) : [];
    const collectionsHit = types.includes('collection') ? pick(collectionRecords.filter((c) => !['frontpage'].includes(c.handle) && terms.every((t) => c.title.toLowerCase().includes(t))).map((c) => collectionView(c.handle))) : [];
    const pagesHit = types.includes('page') ? pick(pageList.filter((p) => terms.every((t) => p.title.toLowerCase().includes(t)))) : [];
    const articlesHit = types.includes('article') ? pick(blogList.flatMap((b) => b.articles).filter((a) => terms.every((t) => a.title.toLowerCase().includes(t)))) : [];
    const queries = types.includes('query') && terms.length
      ? pick([...new Set(productsHit.map((p) => p.type.toLowerCase()))].map((t) => ({ text: t, styled_text: t.replace(new RegExp(`(${terms[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i'), '<mark class="predictive-search__highlight">$1</mark>'), url: `/search?q=${encodeURIComponent(t)}` })))
      : [];
    return {
      performed: terms.length > 0,
      terms: q || '',
      types,
      resources: { products: productsHit, collections: collectionsHit, pages: pagesHit, articles: articlesHit, queries },
    };
  }

  function recommend(productId, { intent = 'related', limit = 4 } = {}) {
    const p = productById(productId);
    if (!p) return { performed: false, 'performed?': false, products: [], products_count: 0, intent };
    let list;
    if (intent === 'complementary') list = [];
    else {
      // Shared finder: tags first, then the same product type (the real catalogue has no finder: tags).
      const finderTags = p.tags.filter((t) => t.startsWith('finder:'));
      const score = (x) => x.tags.filter((t) => finderTags.includes(t)).length * 10 + (real && x.type && x.type === p.type ? 1 : 0);
      list = products().filter((x) => x.id !== p.id && x.available).sort((a, b) => score(b) - score(a));
    }
    list = list.slice(0, Math.max(1, Math.min(10, Number(limit) || 4)));
    return { performed: true, 'performed?': true, products: list, products_count: list.length, intent };
  }

  // ------------------------------------------------------------- customer
  function customerDrop() {
    const c = CUSTOMER;
    const addresses = c.addresses.map((a) => ({ ...a, name: `${a.first_name} ${a.last_name}`, street: a.address1, country_code: a.country_code, url: `/account/addresses/${a.id}` }));
    const orders = c.orders.map((o) => {
      const line_items = o.lines.map(([key, size, qty], i) => {
        const rec = byKey.get(key);
        const product = rec ? productView(rec) : null;
        const variant = product ? product.variants.find((v) => v.options[0] === size) || product.variants[0] : null;
        const price = variant ? variant.price : 11900;
        return {
          id: 5600000000 + i, key: `${variant ? variant.id : 0}:order`, title: product ? `${product.title} - ${size}` : `Coniston Orthopaedic Dog Bed - ${size}`,
          product, variant, quantity: qty, price, original_price: price, final_price: price, line_price: price * qty, final_line_price: price * qty, original_line_price: price * qty,
          sku: variant ? variant.sku : 'PL-ARCHIVED', vendor: 'PawLunova', image: product ? product.featured_image : null,
          url: product ? variant.url : null, fulfillment: o.fulfillment_status === 'fulfilled' ? { created_at: o.created_at, tracking_company: 'Royal Mail', tracking_number: 'RM123456785GB', tracking_url: 'https://www.royalmail.com/track-your-item', item_count: qty } : null,
          discount_allocations: [], line_level_discount_allocations: [], properties: {}, options_with_values: [{ name: 'Size', value: size }], unit_price_measurement: null, selling_plan_allocation: null, gift_card: false, requires_shipping: true, successfully_fulfilled_quantity: qty,
        };
      });
      const subtotal = line_items.reduce((s, l) => s + l.line_price, 0);
      return {
        id: o.id, name: o.name, order_number: o.order_number, created_at: o.created_at,
        financial_status: o.financial_status, financial_status_label: 'Paid', fulfillment_status: o.fulfillment_status, fulfillment_status_label: 'Fulfilled',
        line_items, subtotal_price: subtotal, line_items_subtotal_price: subtotal, total_price: subtotal, tax_price: Math.round(subtotal / 6), total_tax: Math.round(subtotal / 6),
        shipping_price: 0, total_discounts: 0, total_net_amount: subtotal, total_refunded_amount: 0, shipping_methods: [{ title: 'Standard', price: 0 }],
        shipping_address: addresses[0], billing_address: addresses[0], customer_url: `/account/orders/${o.id}`, order_status_url: `/account/orders/${o.id}`,
        cancelled: false, cancel_reason: null, cancelled_at: null, discount_applications: [], tax_lines: [], transactions: [], note: null, email: c.email, phone: null,
        customer: { name: `${c.first_name} ${c.last_name}` }, attributes: {}, item_count: line_items.reduce((s, l) => s + l.quantity, 0),
      };
    });
    return {
      id: c.id, first_name: c.first_name, last_name: c.last_name, name: `${c.first_name} ${c.last_name}`, email: c.email, phone: c.phone,
      accepts_marketing: c.accepts_marketing, tags: c.tags, has_account: true, 'has_account?': true, tax_exempt: false,
      addresses, addresses_count: addresses.length, default_address: addresses[0] || null,
      orders, orders_count: orders.length, last_order: orders[0] || null, total_spent: orders.reduce((s, o) => s + o.total_price, 0),
      metafields: {}, b2b: false, 'b2b?': false, current_company: null, store_credit_account: null,
    };
  }

  function giftCardDrop() {
    return {
      id: 1700000001, balance: 2500, initial_value: 5000, currency: 'GBP', code: 'X7KP R2MQ 9TLA B4WD', last_four_characters: 'B4WD',
      enabled: true, 'enabled?': true, expired: false, 'expired?': false, expires_on: null, customer: { first_name: 'Sam', last_name: 'Whitfield', name: 'Sam Whitfield', email: 'sam@example.com' },
      recipient: null, message: null, send_on: null, 'send_to_recipient?': false, url: '/gift_cards/demo', pass_url: '/gift_cards/demo/pass', qr_identifier: 'X7KPR2MQ9TLAB4WD',
      product: { title: 'PawLunova gift card' }, properties: {}, template_suffix: null,
    };
  }

  return {
    empty,
    real,
    mode: empty ? 'empty' : real ? 'real' : 'full',
    realMeta: realCat ? realCat.meta : null,
    /** The live catalogue as fetched (storefront products.json shape), for checks that restate a rule from the raw data. */
    realProducts: realCat ? realCat.products : null,
    shop: SHOP,
    images,
    products,
    productByHandle,
    productById,
    variantById,
    productJson: (p) => productJson(p),
    collectionHandles: () => collectionRecords.map((c) => c.handle),
    collectionView,
    collectionsKeyed: () => keyed(collectionRecords.map((c) => collectionView(c.handle))),
    allProductsKeyed: () => keyed(products()),
    pages: pageList,
    pageByHandle: (h) => pageList.find((p) => p.handle === h) || null,
    blogs: blogList,
    blogByHandle: (h) => blogList.find((b) => b.handle === h) || null,
    linklists,
    policies,
    search,
    predictive,
    recommend,
    customerDrop,
    giftCardDrop,
  };
}
