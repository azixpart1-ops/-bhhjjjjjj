// Builds Shopify-shaped Liquid objects from fixtures/catalog.mjs.
// createStore({ empty }) — empty:true models the real brand-new store:
// zero products, only the automatic `all` + `frontpage` collections, the
// default Shopify menus. Pages, blog and policies stay (content, not catalog).
import { SHOP, PRODUCTS, COLLECTIONS, PAGES, BLOGS, MENUS, EMPTY_MENUS, POLICIES, CUSTOMER } from './catalog.mjs';
import { ImageRegistry, MetafieldDrop, OptionValueDrop, productJson } from '../lib/drops.mjs';
import { FIXTURE_IMG_DIR, stripHtml, handleize } from '../lib/util.mjs';

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

/** Iterable + keyed object (like Shopify's `collections`, `pages`, `linklists`). */
export function keyed(list, keyFn = (x) => x.handle) {
  const obj = {};
  for (const item of list) obj[keyFn(item)] = item;
  Object.defineProperty(obj, 'size', { value: list.length, enumerable: false });
  Object.defineProperty(obj, Symbol.iterator, { value: function* () { yield* list; }, enumerable: false });
  return obj;
}

function cartesian(options) {
  if (!options.length) return [['Default Title']];
  return options.reduce((acc, [, values]) => acc.flatMap((a) => values.map((v) => [...a, v])), [[]]);
}

export function createStore({ empty = false, imgDir = FIXTURE_IMG_DIR } = {}) {
  const images = new ImageRegistry(imgDir);
  const rawProducts = empty ? [] : PRODUCTS;

  // ---------------------------------------------------------------- products
  const records = rawProducts.map((raw, pIdx) => {
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
    if (Object.keys(custom).length) mf.custom = custom;
    return mf;
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
        featured_image: null,
        featured_media: null,
        image: null,
        selected: selectedVariantId != null && v.id === Number(selectedVariantId),
        matched: true,
        metafields: v.mostChosen ? { custom: { most_chosen: new MetafieldDrop(true, 'boolean') } } : {},
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
    const media = rec.images;
    const description = `<p>${raw.why}</p>${raw.descriptionExtra || ''}<p>Every PawLunova bed comes with our 100-night trial: sleep on it, and if it is not right we collect it free.</p>`;

    Object.assign(product, {
      id: rec.id,
      object_type: 'product',
      title: raw.title,
      handle: raw.handle,
      url,
      description,
      content: description,
      type: raw.type,
      vendor: 'PawLunova',
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
      featured_image: media[0] || null,
      featured_media: media[0] || null,
      images: media,
      media,
      metafields: productMetafields(raw),
      collections: [],
      template_suffix: null,
      created_at: raw.created_at,
      published_at: raw.created_at,
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
  collectionRecords.push({
    id: 4400000000, handle: 'all', title: 'Products', description: '', image: null,
    keys: records.map((r) => r.raw.key), defaultSort: 'best-selling',
  });
  collectionRecords.push({ id: 4400000001, handle: 'frontpage', title: 'Home page', description: '', image: null, keys: [], defaultSort: 'manual' });
  if (!empty) {
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
      products: sorted,
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
    const menus = empty ? EMPTY_MENUS : MENUS;
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
  function search(q, { types = ['product', 'page', 'article'], query = new URLSearchParams() } = {}) {
    const terms = searchTerms(q);
    const performed = terms.length > 0;
    let productsHit = performed && types.includes('product') ? products().filter((p) => matchProduct(p, terms)) : [];
    const { filters, filtered } = applyFilters(productsHit, query, '/search');
    productsHit = sortProducts(filtered, query.get('sort_by') || 'relevance');
    const pagesHit = performed && types.includes('page') ? pageList.filter((p) => terms.every((t) => `${p.title} ${stripHtml(p.content)}`.toLowerCase().includes(t))) : [];
    const articlesHit = performed && types.includes('article') ? blogList.flatMap((b) => b.articles).filter((a) => terms.every((t) => `${a.title} ${stripHtml(a.content)}`.toLowerCase().includes(t))) : [];
    const results = [...productsHit, ...pagesHit, ...articlesHit];
    return {
      performed,
      terms: q || '',
      results,
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
    const productsHit = types.includes('product') ? pick(products().filter((p) => matchProduct(p, terms))) : [];
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
      const finderTags = p.tags.filter((t) => t.startsWith('finder:'));
      list = products().filter((x) => x.id !== p.id && x.available).sort((a, b) => b.tags.filter((t) => finderTags.includes(t)).length - a.tags.filter((t) => finderTags.includes(t)).length);
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
