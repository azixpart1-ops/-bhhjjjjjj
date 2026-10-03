// Shopify-shaped Liquid objects for the harness.
//
// Rules learned from liquidjs internals:
//  - liquidjs compares `x == blank/empty` using Object.keys(), so every object
//    the theme can test for blankness must carry OWN enumerable properties
//    (plain object literals, not class instances with prototype getters).
//  - Drop subclasses unwrap through valueOf() for comparisons/stringify, which
//    is how string-like Shopify drops (option values, metafields, colours)
//    are modelled.
import { createRequire } from 'node:module';
import path from 'node:path';
import { imageSize, listFiles, handleize } from './util.mjs';

const require = createRequire(import.meta.url);
export const liquidjs = require('liquidjs');
const { Drop } = liquidjs;

/** A Ruby Float: lets divided_by/times/round follow Ruby integer-vs-float rules. */
export class RFloat extends Drop {
  constructor(n) { super(); this.n = Number(n); }
  valueOf() { return this.n; }
  toString() { return Number.isInteger(this.n) ? this.n.toFixed(1) : String(this.n); }
  toJSON() { return this.n; }
}

/** colour setting value (Shopify colour drop). Outputs as the stored hex. */
export class ColorDrop extends Drop {
  constructor(str) {
    super();
    this.hex = String(str);
    const rgba = parseColor(this.hex) || { r: 0, g: 0, b: 0, a: 1 };
    this.red = rgba.r; this.green = rgba.g; this.blue = rgba.b; this.alpha = rgba.a;
    const hsl = rgbToHsl(rgba.r, rgba.g, rgba.b);
    this.hue = Math.round(hsl.h); this.saturation = Math.round(hsl.s); this.lightness = Math.round(hsl.l);
    this.rgb = `${rgba.r} ${rgba.g} ${rgba.b}`;
    this.rgba = `${rgba.r} ${rgba.g} ${rgba.b} / ${rgba.a}`;
  }
  valueOf() { return this.hex; }
  toString() { return this.hex; }
  toJSON() { return this.hex; }
}

/** metafield drop: {{ mf }} prints its value; mf.value / mf.type work. */
export class MetafieldDrop extends Drop {
  constructor(value, type) {
    super();
    this.value = value;
    this.type = type;
    this.list = String(type).startsWith('list.');
    this['list?'] = this.list;
  }
  valueOf() {
    if (this.value && typeof this.value === 'object' && !Array.isArray(this.value) && 'rating' in this.value) return String(this.value.rating);
    return this.value;
  }
  toString() { return String(this.valueOf()); }
  toJSON() { return this.value; }
}

/** product_option_value drop (Shopify 2024+): prints its name. */
export class OptionValueDrop extends Drop {
  constructor(props) { super(); Object.assign(this, props); }
  valueOf() { return this.name; }
  toString() { return this.name; }
  toJSON() { return this.name; }
}

// ---------------------------------------------------------------------------
// Colour maths (shared with colour filters)
// ---------------------------------------------------------------------------
export function parseColor(input) {
  if (input == null) return null;
  let s = String(input.valueOf ? input.valueOf() : input).trim().toLowerCase();
  if (!s) return null;
  let m;
  if ((m = s.match(/^#?([0-9a-f]{3,8})$/))) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    return {
      r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16),
      a: h.length === 8 ? Math.round((parseInt(h.slice(6, 8), 16) / 255) * 100) / 100 : 1,
    };
  }
  if ((m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/))) {
    let a = m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: Math.round(+m[1]), g: Math.round(+m[2]), b: Math.round(+m[3]), a };
  }
  if ((m = s.match(/^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:[\s,/]+([\d.]+%?))?\s*\)$/))) {
    const { r, g, b } = hslToRgb(+m[1], +m[2], +m[3]);
    let a = m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r, g, b, a };
  }
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  if (s === 'white') return { r: 255, g: 255, b: 255, a: 1 };
  if (s === 'black') return { r: 0, g: 0, b: 0, a: 1 };
  return null;
}

export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b); const min = Math.min(r, g, b);
  let h = 0; let s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

export function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(100, s)) / 100; l = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0; let g = 0; let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

export function toHex({ r, g, b, a = 1 }) {
  const h = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}${a < 1 ? h(a * 255) : ''}`;
}

export function colorOut(rgba) {
  // Shopify returns hex for opaque colours and rgba() when alpha < 1.
  if (rgba.a < 1) return `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${Math.round(rgba.a * 100) / 100})`;
  return toHex(rgba);
}

// ---------------------------------------------------------------------------
// Images (fixture images served from /fixture-img/)
// ---------------------------------------------------------------------------
export class ImageRegistry {
  constructor(dir) {
    this.dir = dir;
    this.files = new Map();
    for (const f of listFiles(dir, { ext: ['.jpg', '.jpeg', '.png', '.webp', '.gif'] })) {
      const name = path.basename(f);
      const size = imageSize(f) || { width: 1200, height: 1200 };
      this.files.set(name, { file: f, name, ...size });
    }
    this.nextId = 3300000000;
  }
  has(name) { return this.files.has(name); }
  info(name) { return this.files.get(name) || null; }
  /** Create a Shopify image drop for a fixture file. */
  image(name, { alt = '', position = 1, productId = null, mediaId = null } = {}) {
    const info = this.info(name);
    if (!info) return null;
    const id = this.nextId++;
    const src = `/fixture-img/${name}`;
    const img = {
      id,
      alt,
      src,
      url: src,
      width: info.width,
      height: info.height,
      aspect_ratio: Math.round((info.width / info.height) * 10000) / 10000,
      media_type: 'image',
      position,
      product_id: productId,
      variants: [],
      attached_to_variant: false,
      'attached_to_variant?': false,
      presentation: { focal_point: '50.0% 50.0%' },
      media_id: mediaId || id + 1,
      toString() { return src; },
      toJSON() { return src; },
    };
    img.preview_image = img;
    return img;
  }
  /**
   * Image drop for a CDN image (real-catalogue mode): src stays the Shopify CDN URL,
   * width/height come from products.json, and image_url adds &width= like Shopify.
   */
  remote({ id, mediaId = null, src, width, height, alt = '', position = 1, productId = null, variantIds = [] }) {
    if (!src) return null;
    const url = String(src).startsWith('//') ? `https:${src}` : String(src);
    const base = url.split('?')[0];
    const v = new URLSearchParams(url.split('?')[1] || '').get('v');
    const name = decodeURIComponent(base.split('/').pop());
    const info = { name, width: Number(width) || 1024, height: Number(height) || 1024, remote: true, base, v };
    this.remoteByBase = this.remoteByBase || new Map();
    this.remoteByBase.set(base, info);
    const img = {
      id: id || this.nextId++,
      alt,
      src: url,
      url,
      width: info.width,
      height: info.height,
      aspect_ratio: info.width / info.height, // full precision, as Shopify prints it
      media_type: 'image',
      position,
      product_id: productId,
      variants: [],
      variant_ids: variantIds,
      attached_to_variant: variantIds.length > 0,
      'attached_to_variant?': variantIds.length > 0,
      presentation: { focal_point: '50.0% 50.0%' },
      media_id: mediaId || (id || 0) + 1,
      toString() { return url; },
      toJSON() { return url; },
    };
    img.preview_image = img;
    return img;
  }
  /** Info for a CDN URL registered by remote() (any query string). */
  remoteInfo(url) {
    if (!this.remoteByBase) return null;
    const u = String(url).startsWith('//') ? `https:${url}` : String(url);
    return this.remoteByBase.get(u.split('?')[0].split('#')[0]) || null;
  }
  /** Resolve an image_picker value like "shopify://shop_images/x.jpg". */
  fromSetting(value) {
    if (!value || typeof value !== 'string') return null;
    const m = value.match(/^shopify:\/\/shop_images\/(.+)$/);
    const name = m ? m[1] : path.basename(value);
    return this.image(name, { alt: '' });
  }
}

/** Fixture image info from a URL produced by image_url (or image.src). */
export function imageInfoFromUrl(registry, url) {
  const m = String(url).match(/\/fixture-img\/([^?#]+)/);
  if (!m) return registry.remoteInfo ? registry.remoteInfo(url) : null;
  return registry.info(decodeURIComponent(m[1]));
}

/** URL for an image (fixture file or CDN image) with Shopify's image_url params. */
export function imageUrlWith(info, params) {
  const q = new URLSearchParams();
  if (info.remote) { if (info.v) q.set('v', info.v); } else q.set('v', '1');
  for (const [k, val] of Object.entries(params || {})) if (val != null && val !== '' && val !== false) q.set(k, String(val));
  if (info.remote) return `${info.base}?${q.toString()}`;
  return `/fixture-img/${encodeURIComponent(info.name)}?${q.toString()}`;
}

// ---------------------------------------------------------------------------
// Fonts (font_picker settings)
// ---------------------------------------------------------------------------
const FONT_LIBRARY = {
  playfair_display: { family: 'Playfair Display', fallback: 'serif', weights: [400, 500, 600, 700, 800, 900], italic: true, baseline: 0.276 },
  dm_sans: { family: 'DM Sans', fallback: 'sans-serif', weights: [400, 500, 700], italic: true, baseline: 0.258 },
  assistant: { family: 'Assistant', fallback: 'sans-serif', weights: [200, 300, 400, 600, 700, 800], italic: false, baseline: 0.25 },
  helvetica: { family: 'Helvetica', fallback: 'Arial, sans-serif', weights: [400, 700], italic: true, baseline: 0.25, system: true },
  sans_serif: { family: 'sans-serif', fallback: '', weights: [400, 700], italic: true, baseline: 0.25, system: true },
  serif: { family: 'serif', fallback: '', weights: [400, 700], italic: true, baseline: 0.25, system: true },
};

export function parseFontHandle(handle) {
  const m = String(handle || '').match(/^([a-z0-9_]+?)_([ni])([1-9])$/);
  if (!m) return null;
  return { key: m[1], style: m[2] === 'i' ? 'italic' : 'normal', weight: Number(m[3]) * 100 };
}

export function makeFont(handle) {
  const p = parseFontHandle(handle);
  if (!p) return null;
  const lib = FONT_LIBRARY[p.key] || { family: p.key.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '), fallback: 'sans-serif', weights: [400, 700], italic: true, baseline: 0.25 };
  if (!lib.weights.includes(p.weight) || (p.style === 'italic' && !lib.italic)) return null;
  const font = {
    handle,
    family: lib.system ? lib.family : `"${lib.family}"`,
    fallback_families: lib.fallback,
    weight: p.weight,
    style: p.style,
    baseline_ratio: lib.baseline,
    system: !!lib.system,
    'system?': !!lib.system,
    variants: lib.weights.flatMap((w) => [{ weight: w, style: 'normal' }, ...(lib.italic ? [{ weight: w, style: 'italic' }] : [])]),
    _key: p.key,
    _family: lib.family,
    toString() { return this.family; },
  };
  return font;
}

export function modifyFont(font, prop, value) {
  if (!font || !font._key) return null;
  const lib = FONT_LIBRARY[font._key] || { weights: [400, 700], italic: true };
  let weight = font.weight; let style = font.style;
  if (prop === 'style') {
    if (value === 'italic' || value === 'oblique') style = 'italic';
    else if (value === 'normal') style = 'normal';
    else return null;
  } else if (prop === 'weight') {
    const v = String(value);
    const sorted = [...lib.weights].sort((a, b) => a - b);
    if (v === 'bold') weight = 700;
    else if (v === 'normal') weight = 400;
    else if (v === 'bolder') weight = sorted.find((w) => w > font.weight) ?? null;
    else if (v === 'lighter') weight = [...sorted].reverse().find((w) => w < font.weight) ?? null;
    else if (/^[+-]\d+$/.test(v)) weight = font.weight + Number(v);
    else if (/^\d+$/.test(v)) weight = Number(v);
    else return null;
    if (weight == null) return null;
  } else return null;
  return makeFont(`${font._key}_${style === 'italic' ? 'i' : 'n'}${Math.round(weight / 100)}`);
}

// ---------------------------------------------------------------------------
// JSON shapes (AJAX API)
// ---------------------------------------------------------------------------
export function imageJson(img) {
  if (!img) return null;
  return { alt: img.alt || null, aspect_ratio: img.aspect_ratio, height: img.height, width: img.width, url: img.src, src: img.src, id: img.id };
}

export function variantJson(v) {
  if (!v) return null;
  return {
    id: v.id,
    title: v.title,
    option1: v.option1, option2: v.option2, option3: v.option3,
    sku: v.sku,
    requires_shipping: true,
    taxable: true,
    featured_image: v.featured_image ? imageJson(v.featured_image) : null,
    available: v.available,
    name: v.name,
    public_title: v.title === 'Default Title' ? null : v.title,
    options: v.options,
    price: v.price,
    weight: v.weight,
    compare_at_price: v.compare_at_price,
    inventory_management: v.inventory_management,
    inventory_policy: v.inventory_policy,
    inventory_quantity: v.inventory_quantity,
    barcode: v.barcode,
    quantity_rule: { min: 1, max: null, increment: 1 },
    quantity_price_breaks: [],
    requires_selling_plan: false,
    selling_plan_allocations: [],
  };
}

export function productJson(p) {
  if (!p) return null;
  return {
    id: p.id,
    title: p.title,
    handle: p.handle,
    description: p.description,
    published_at: p.published_at,
    created_at: p.created_at,
    vendor: p.vendor,
    type: p.type,
    tags: p.tags,
    price: p.price,
    price_min: p.price_min,
    price_max: p.price_max,
    available: p.available,
    price_varies: p.price_varies,
    compare_at_price: p.compare_at_price,
    compare_at_price_min: p.compare_at_price_min,
    compare_at_price_max: p.compare_at_price_max,
    compare_at_price_varies: p.compare_at_price_varies,
    variants: p.variants.map(variantJson),
    images: p.images.map((i) => i.src),
    featured_image: p.featured_image ? p.featured_image.src : null,
    options: p.options_with_values.map((o) => ({ name: o.name, position: o.position, values: o.values.map((v) => v.name) })),
    url: p.url,
    media: p.media.map((m) => ({ alt: m.alt, id: m.media_id, position: m.position, preview_image: imageJson(m), aspect_ratio: m.aspect_ratio, height: m.height, width: m.width, media_type: 'image', src: m.src })),
    requires_selling_plan: false,
    selling_plan_groups: [],
  };
}

export { handleize };
