// Shopify Liquid filters for the harness, on top of liquidjs builtins.
// Each filter runs with `this = { context, token, liquid }`; named args arrive
// as [key, value] pairs. `env` is supplied by the renderer:
//   env.images (ImageRegistry), env.issue(level, kind, msg), env.translate(key, named),
//   env.asset(name) -> {exists, version}, env.dateFormat(name) -> strftime|null
import crypto from 'node:crypto';
import {
  liquidjs, RFloat, ColorDrop, MetafieldDrop, parseColor, rgbToHsl, hslToRgb, colorOut, toHex,
  imageInfoFromUrl, modifyFont, makeFont,
} from './drops.mjs';
import { escapeHtml, handleize, stripHtml } from './util.mjs';

const { Drop } = liquidjs;

/** Every filter name Shopify accepts (theme-liquid-docs filters.json, plus aliases). */
export const SHOPIFY_FILTERS = new Set(['abs', 'append', 'article_img_url', 'asset_img_url', 'asset_url', 'at_least', 'at_most', 'avatar', 'base64_decode', 'base64_encode', 'base64_url_safe_decode', 'base64_url_safe_encode', 'blake3', 'brightness_difference', 'camelize', 'capitalize', 'ceil', 'collection_img_url', 'color_brightness', 'color_contrast', 'color_darken', 'color_desaturate', 'color_difference', 'color_extract', 'color_lighten', 'color_mix', 'color_modify', 'color_saturate', 'color_to_hex', 'color_to_hsl', 'color_to_oklch', 'color_to_rgb', 'compact', 'concat', 'currency_selector', 'customer_login_link', 'customer_logout_link', 'customer_register_link', 'date', 'default', 'default_errors', 'default_pagination', 'divided_by', 'downcase', 'escape', 'escape_once', 'external_video_tag', 'external_video_url', 'file_img_url', 'file_url', 'find', 'find_index', 'first', 'floor', 'format_code', 'font_face', 'font_modify', 'font_url', 'format_address', 'global_asset_url', 'handleize', 'handle', 'has', 'hex_to_rgba', 'highlight', 'highlight_active_tag', 'hmac_sha1', 'hmac_sha256', 'image_tag', 'image_url', 'img_tag', 'img_url', 'inline_asset_content', 'item_count_for_variant', 'join', 'json', 'last', 'line_items_for', 'link_to', 'link_to_add_tag', 'link_to_remove_tag', 'link_to_tag', 'link_to_type', 'link_to_vendor', 'login_button', 'lstrip', 'map', 'md5', 'media_tag', 'metafield_tag', 'metafield_text', 'minus', 'model_viewer_tag', 'modulo', 'money', 'money_amount', 'money_with_currency', 'money_without_currency', 'money_without_trailing_zeros', 'newline_to_br', 'payment_button', 'payment_terms', 'payment_type_img_url', 'payment_type_svg_tag', 'placeholder_svg_tag', 'pluralize', 'plus', 'preload_tag', 'prepend', 'product_img_url', 'reject', 'remove', 'remove_first', 'remove_last', 'replace', 'replace_first', 'replace_last', 'reverse', 'round', 'rstrip', 'script_tag', 'sha1', 'sha256', 'shopify_asset_url', 'size', 'slice', 'sort', 'sort_by', 'sort_natural', 'split', 'standard_event_data', 'strip', 'strip_html', 'strip_newlines', 'structured_data', 'stylesheet_tag', 'sum', 'time_tag', 'times', 'translate', 't', 'truncate', 'truncatewords', 'uniq', 'unit_price_with_measurement', 'upcase', 'url_decode', 'url_encode', 'url_escape', 'url_for_type', 'url_for_vendor', 'url_param_escape', 'video_tag', 'weight_with_unit', 'where', 'within']);

export const DEPRECATED_FILTERS = new Set(['hex_to_rgba', 'currency_selector', 'article_img_url', 'collection_img_url', 'img_tag', 'img_url', 'product_img_url']);

/** liquidjs builtins we keep because Shopify has the same filter. */
const KEEP_BUILTINS = ['append', 'capitalize', 'compact', 'concat', 'downcase', 'escape', 'escape_once', 'find', 'find_index', 'first', 'has', 'join', 'last', 'lstrip', 'map', 'newline_to_br', 'prepend', 'reject', 'remove', 'remove_first', 'remove_last', 'replace', 'replace_first', 'replace_last', 'reverse', 'rstrip', 'size', 'slice', 'sort', 'sort_natural', 'strip', 'strip_html', 'strip_newlines', 'sum', 'truncate', 'truncatewords', 'uniq', 'upcase', 'url_decode', 'where', 'default', 'base64_encode', 'base64_decode'];

export const PLACEHOLDER_NAMES = new Set(['collection-1', 'collection-2', 'collection-3', 'collection-4', 'collection-5', 'collection-6', 'lifestyle-1', 'lifestyle-2', 'product-1', 'product-2', 'product-3', 'product-4', 'product-5', 'product-6', 'image', 'hero-apparel-1', 'hero-apparel-2', 'hero-apparel-3', 'blog-apparel-1', 'blog-apparel-2', 'blog-apparel-3', 'detailed-apparel-1', 'product-apparel-1', 'product-apparel-2', 'product-apparel-3', 'product-apparel-4', 'collection-apparel-1', 'collection-apparel-2', 'collection-apparel-3', 'collection-apparel-4']);

// --------------------------------------------------------------------- helpers
export function unwrap(v) {
  if (v instanceof RFloat) return v;
  if (v instanceof Drop && typeof v.valueOf === 'function') {
    const x = v.valueOf();
    return x === v ? v : x;
  }
  return v;
}

export function splitArgs(args) {
  const pos = []; const named = {};
  for (const a of args) {
    if (Array.isArray(a) && a.length === 2 && typeof a[0] === 'string' && a.__kv !== false && isKV(a)) named[a[0]] = a[1];
    else pos.push(a);
  }
  return { pos, named };
}
// liquidjs passes keyword args as 2-tuples; a literal array value never is one
// in practice, so treat every [string, any] tuple as a keyword arg.
function isKV(a) { return Array.isArray(a) && a.length === 2 && typeof a[0] === 'string'; }

function str(v) {
  v = unwrap(v);
  if (v == null) return '';
  if (v instanceof RFloat) return v.toString();
  if (Array.isArray(v)) return v.map(str).join('');
  return String(v);
}

function numInfo(v) {
  v = unwrap(v);
  if (v instanceof RFloat) return { n: v.n, float: true };
  if (typeof v === 'number') return { n: v, float: !Number.isInteger(v) };
  if (typeof v === 'string') {
    const s = v.trim();
    const m = s.match(/^-?\d+(\.\d+)?/);
    if (!m) return { n: 0, float: false };
    return { n: Number(m[0]), float: !!m[1] };
  }
  if (typeof v === 'boolean' || v == null) return { n: 0, float: false };
  const n = Number(v);
  return Number.isFinite(n) ? { n, float: !Number.isInteger(n) } : { n: 0, float: false };
}

/** Was positional arg i written as a float literal, e.g. `divided_by: 100.0`? */
function argIsFloatLiteral(self, i) {
  const toks = self && self.token && self.token.args;
  const t = toks && toks[i];
  if (!t || Array.isArray(t) || typeof t.getText !== 'function') return false;
  return /^-?\d+\.\d+$/.test(t.getText());
}

function argNum(self, v, i) {
  const info = numInfo(v);
  if (argIsFloatLiteral(self, i)) info.float = true;
  return info;
}

const mk = (n, float) => (float ? new RFloat(n) : n);

function rubyRound(n, digits = 0) {
  const f = Math.pow(10, digits);
  const x = Math.abs(n) * f;
  const r = Math.floor(x + 0.5 + 1e-9) / f;
  return n < 0 ? -r : r;
}

function formatMoneyAmount(cents, decimals = 2, thousands = ',', decimal = '.') {
  const n = Math.round(Number(cents) || 0);
  const neg = n < 0;
  const abs = Math.abs(n);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  const wholeStr = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
  return { neg, s: decimals ? `${wholeStr}${decimal}${frac}` : wholeStr, frac };
}

function applyMoneyFormat(format, cents) {
  const amountFor = (kind) => {
    switch (kind) {
      case 'amount_no_decimals': return formatMoneyAmount(cents, 0).s;
      case 'amount_with_comma_separator': return formatMoneyAmount(cents, 2, '.', ',').s;
      case 'amount_no_decimals_with_comma_separator': return formatMoneyAmount(cents, 0, '.').s;
      case 'amount_with_apostrophe_separator': return formatMoneyAmount(cents, 2, "'").s;
      default: return formatMoneyAmount(cents, 2).s;
    }
  };
  const neg = Number(cents) < 0;
  const out = String(format).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => amountFor(k));
  return neg ? `-${out}` : out;
}

function toCents(v) {
  v = unwrap(v);
  if (v instanceof RFloat) return v.n;
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function attrs(obj) {
  return Object.entries(obj)
    .filter(([, v]) => v !== null && v !== undefined && v !== false)
    .map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${escapeHtml(str(v))}"`))
    .join('');
}

// Ruby-style strftime in the shop's timezone (Europe/London).
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function londonParts(d) {
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false, weekday: 'short', timeZoneName: 'short' });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  const tz = parts.timeZoneName === 'BST' || parts.timeZoneName === 'GMT+1' ? { z: '+0100', Z: 'BST' } : { z: '+0000', Z: 'GMT' };
  return { Y: +parts.year, m: +parts.month, d: +parts.day, H: +parts.hour % 24, M: +parts.minute, S: +parts.second, w: wd, ...tz };
}

export function strftime(date, fmt) {
  const p = londonParts(date);
  const start = Date.UTC(p.Y, 0, 1);
  const yday = Math.floor((Date.UTC(p.Y, p.m - 1, p.d) - start) / 86400000) + 1;
  const h12 = p.H % 12 === 0 ? 12 : p.H % 12;
  return String(fmt).replace(/%([-_0^#]?)(\d*)([a-zA-Z%])/g, (all, flag, width, c) => {
    let v; let pad = '0'; let w = 2;
    switch (c) {
      case 'a': v = DAYS[p.w].slice(0, 3); w = 0; break;
      case 'A': v = DAYS[p.w]; w = 0; break;
      case 'b': case 'h': v = MONTHS[p.m - 1].slice(0, 3); w = 0; break;
      case 'B': v = MONTHS[p.m - 1]; w = 0; break;
      case 'c': return strftime(date, '%a %b %e %H:%M:%S %Y');
      case 'C': v = Math.floor(p.Y / 100); break;
      case 'd': v = p.d; break;
      case 'e': v = p.d; pad = ' '; break;
      case 'D': return strftime(date, '%m/%d/%y');
      case 'F': return strftime(date, '%Y-%m-%d');
      case 'H': v = p.H; break;
      case 'I': v = h12; break;
      case 'j': v = yday; w = 3; break;
      case 'k': v = p.H; pad = ' '; break;
      case 'l': v = h12; pad = ' '; break;
      case 'L': v = date.getMilliseconds(); w = 3; break;
      case 'm': v = p.m; break;
      case 'M': v = p.M; break;
      case 'N': v = date.getMilliseconds() * 1000000; w = 9; break;
      case 'p': v = p.H < 12 ? 'AM' : 'PM'; w = 0; break;
      case 'P': v = p.H < 12 ? 'am' : 'pm'; w = 0; break;
      case 's': v = Math.floor(date.getTime() / 1000); w = 0; break;
      case 'S': v = p.S; break;
      case 'T': return strftime(date, '%H:%M:%S');
      case 'u': v = p.w === 0 ? 7 : p.w; w = 0; break;
      case 'w': v = p.w; w = 0; break;
      case 'y': v = p.Y % 100; break;
      case 'Y': v = p.Y; w = 0; break;
      case 'z': v = p.z; w = 0; break;
      case 'Z': v = p.Z; w = 0; break;
      case '%': return '%';
      default: return all;
    }
    let s = String(v);
    if (width) w = Number(width);
    if (flag === '-') w = 0;
    if (flag === '_') pad = ' ';
    if (flag === '0') pad = '0';
    if (w && typeof v === 'number') s = s.padStart(w, pad);
    if (flag === '^') s = s.toUpperCase();
    return s;
  });
}

export function toDate(v) {
  v = unwrap(v);
  if (v == null || v === '') return null;
  if (v instanceof Date) return v;
  if (v === 'now' || v === 'today') return new Date();
  if (typeof v === 'number' || (typeof v === 'string' && /^\d+$/.test(v))) return new Date(Number(v) * 1000);
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

const DEFAULT_DATE_FORMATS = {
  abbreviated_date: '%b %d, %Y', basic: '%m/%d/%Y', date: '%B %d, %Y', date_at_time: '%B %d, %Y at %-l:%M %P',
  default: '%a, %b %d, %Y, %-l:%M %P %z', on_date: 'on %b %d, %Y', short: '%d %b %H:%M', long: '%B %d, %Y %H:%M',
  month_day_year: '%B %d, %Y', iso8601: '%Y-%m-%dT%H:%M:%S%z',
};

function placeholderSvg(name, cls) {
  return `<svg class="${escapeHtml(cls || '')}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 525.5 525.5" role="img" aria-hidden="true" focusable="false" data-placeholder="${escapeHtml(name)}"><rect width="525.5" height="525.5" fill="currentColor" opacity=".08"/><path d="M324.5 212.7H203c-1.6 0-2.8 1.3-2.8 2.8v95.1c0 1.6 1.3 2.8 2.8 2.8h121.5c1.6 0 2.8-1.3 2.8-2.8v-95.1c0-1.6-1.3-2.8-2.8-2.8zm-2.8 95.1H205.8v-89.4h115.9v89.4z" fill="currentColor" opacity=".35"/><circle cx="234" cy="243" r="12" fill="currentColor" opacity=".35"/></svg>`;
}

const PAYMENT_NAMES = { visa: 'Visa', master: 'Mastercard', american_express: 'American Express', paypal: 'PayPal', apple_pay: 'Apple Pay', google_pay: 'Google Pay', shopify_pay: 'Shop Pay', klarna: 'Klarna', maestro: 'Maestro', diners_club: 'Diners Club', discover: 'Discover', jcb: 'JCB', unionpay: 'UnionPay' };

function paymentSvg(type, cls) {
  const label = PAYMENT_NAMES[type] || type;
  return `<svg class="${escapeHtml(cls || '')}" xmlns="http://www.w3.org/2000/svg" role="img" viewBox="0 0 38 24" width="38" height="24" aria-labelledby="pi-${escapeHtml(type)}"><title id="pi-${escapeHtml(type)}">${escapeHtml(label)}</title><rect x=".5" y=".5" width="37" height="23" rx="3" fill="#fff" stroke="#000" stroke-opacity=".07"/><text x="19" y="15" font-size="7" text-anchor="middle" font-family="sans-serif" fill="#222">${escapeHtml(label.slice(0, 8))}</text></svg>`;
}

function safeJson(value) {
  const seen = new WeakSet();
  const replacer = function (k, v) {
    if (v instanceof RFloat) return v.n;
    if (v && typeof v === 'object') {
      if (typeof v.toJSON === 'function') return v;
      if (seen.has(v)) return null;
      seen.add(v);
    }
    if (typeof v === 'function') return undefined;
    return v;
  };
  const s = JSON.stringify(value === undefined ? null : value, replacer);
  return (s === undefined ? 'null' : s)
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

/** Resolve anything image-ish (image, media, product, variant, article, url) to {name, info, alt}. */
function resolveImageSource(env, input) {
  input = unwrap(input);
  if (input == null || input === '') return null;
  if (typeof input === 'string') {
    const info = imageInfoFromUrl(env.images, input) || env.images.info(input.split('/').pop().split('?')[0]);
    return info ? { info, alt: '', url: input } : { info: null, alt: '', url: input };
  }
  if (typeof input === 'object') {
    if (input.media_type === 'image' && input.src) return resolveImageSource(env, input.src) && { ...resolveImageSource(env, input.src), alt: input.alt || '' };
    if (input.preview_image) return resolveImageSource(env, input.preview_image);
    if ('featured_image' in input && input.featured_image) return resolveImageSource(env, input.featured_image);
    if ('featured_media' in input && input.featured_media) return resolveImageSource(env, input.featured_media);
    if ('image' in input && input.image) return resolveImageSource(env, input.image);
    if (input.src) return resolveImageSource(env, input.src);
    if ('product' in input && input.product && input.product.featured_image) return resolveImageSource(env, input.product.featured_image);
  }
  return null;
}

function imageUrlFor(info, { width, height, crop, format }) {
  const q = new URLSearchParams();
  q.set('v', '1');
  if (width) q.set('width', String(width));
  if (height) q.set('height', String(height));
  if (crop) q.set('crop', String(crop));
  if (format) q.set('format', String(format));
  return `/fixture-img/${encodeURIComponent(info.name)}?${q.toString()}`;
}

function srcDims(info, width, height) {
  const ar = info.width / info.height;
  if (width && height) return { w: Number(width), h: Number(height) };
  if (width) return { w: Number(width), h: Math.round(Number(width) / ar) };
  if (height) return { w: Math.round(Number(height) * ar), h: Number(height) };
  return { w: info.width, h: info.height };
}

// ------------------------------------------------------------------- factory
export function createShopifyFilters(env) {
  const F = {};
  const issue = (level, kind, msg) => env.issue(level, kind, msg);

  // ---- Ruby-typed math ---------------------------------------------------
  F.plus = function (v, a) { const x = numInfo(v); const y = argNum(this, a, 0); return mk(x.n + y.n, x.float || y.float); };
  F.minus = function (v, a) { const x = numInfo(v); const y = argNum(this, a, 0); return mk(x.n - y.n, x.float || y.float); };
  F.times = function (v, a) { const x = numInfo(v); const y = argNum(this, a, 0); return mk(x.n * y.n, x.float || y.float); };
  F.divided_by = function (v, a) {
    const x = numInfo(v); const y = argNum(this, a, 0);
    if (y.n === 0) { issue('error', 'liquid-error', 'divided by 0'); return null; }
    if (!x.float && !y.float) return Math.floor(x.n / y.n);
    return new RFloat(x.n / y.n);
  };
  F.modulo = function (v, a) {
    const x = numInfo(v); const y = argNum(this, a, 0);
    if (y.n === 0) { issue('error', 'liquid-error', 'divided by 0'); return null; }
    return mk(((x.n % y.n) + y.n) % y.n, x.float || y.float);
  };
  F.round = function (v, digits = 0) {
    const x = numInfo(v); const d = Math.trunc(numInfo(digits).n);
    if (!x.float) return x.n;
    return d > 0 ? new RFloat(rubyRound(x.n, d)) : rubyRound(x.n, 0);
  };
  F.ceil = (v) => Math.ceil(numInfo(v).n);
  F.floor = (v) => Math.floor(numInfo(v).n);
  F.abs = (v) => { const x = numInfo(v); return mk(Math.abs(x.n), x.float); };
  F.at_least = function (v, a) { const x = numInfo(v); const y = argNum(this, a, 0); return x.n >= y.n ? mk(x.n, x.float) : mk(y.n, y.float); };
  F.at_most = function (v, a) { const x = numInfo(v); const y = argNum(this, a, 0); return x.n <= y.n ? mk(x.n, x.float) : mk(y.n, y.float); };

  // ---- strings -------------------------------------------------------------
  F.split = (v, sep) => {
    const s = str(v); const p = str(sep);
    let arr = p === ' ' ? s.trim().split(/\s+/) : s.split(p);
    if (s === '') arr = [];
    while (arr.length && arr[arr.length - 1] === '') arr.pop();
    return arr;
  };
  F.handleize = (v) => handleize(str(v));
  F.handle = F.handleize;
  F.camelize = (v) => str(v).split(/[-_\s]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('');
  F.pluralize = (v, one, many) => (numInfo(v).n === 1 ? str(one) : str(many));
  F.url_encode = (v) => encodeURIComponent(str(v)).replace(/%20/g, '+').replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  F.url_escape = (v) => encodeURI(str(v)).replace(/[!'()*]/g, (c) => c);
  F.url_param_escape = (v) => encodeURI(str(v)).replace(/&/g, '%26');
  F.md5 = (v) => crypto.createHash('md5').update(str(v)).digest('hex');
  F.sha1 = (v) => crypto.createHash('sha1').update(str(v)).digest('hex');
  F.sha256 = (v) => crypto.createHash('sha256').update(str(v)).digest('hex');
  F.hmac_sha1 = (v, k) => crypto.createHmac('sha1', str(k)).update(str(v)).digest('hex');
  F.hmac_sha256 = (v, k) => crypto.createHmac('sha256', str(k)).update(str(v)).digest('hex');
  F.base64_url_safe_encode = (v) => Buffer.from(str(v)).toString('base64url');
  F.base64_url_safe_decode = (v) => Buffer.from(str(v), 'base64url').toString('utf8');
  F.json = (v) => safeJson(unwrapDeep(v));
  F.highlight = (v, terms) => {
    const t = str(terms).trim();
    if (!t) return str(v);
    const re = new RegExp(`(${t.split(/\s+/).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    return str(v).replace(/(<[^>]*>)|([^<]+)/g, (m, tag, text) => (tag ? tag : text.replace(re, '<strong class="highlight">$1</strong>')));
  };

  // ---- money ---------------------------------------------------------------
  const fmt = () => env.shop.money_format;
  F.money = (v) => { const c = toCents(v); return c == null ? '' : applyMoneyFormat(fmt(), c); };
  F.money_with_currency = (v) => { const c = toCents(v); return c == null ? '' : applyMoneyFormat(env.shop.money_with_currency_format, c); };
  F.money_without_currency = (v) => { const c = toCents(v); return c == null ? '' : applyMoneyFormat('{{amount}}', c); };
  F.money_amount = F.money_without_currency;
  F.money_without_trailing_zeros = (v) => {
    const c = toCents(v);
    if (c == null) return '';
    return Math.round(c) % 100 === 0 ? applyMoneyFormat(fmt().replace(/\{\{\s*amount\s*\}\}/, '{{amount_no_decimals}}'), c) : applyMoneyFormat(fmt(), c);
  };
  F.unit_price_with_measurement = (price, m) => (m ? `${F.money(price)}/${m.reference_value === 1 ? '' : m.reference_value}${m.reference_unit || ''}` : F.money(price));

  // ---- translations ----------------------------------------------------------
  F.t = function (key, ...args) { return env.translate(str(key), splitArgs(args).named); };
  F.translate = F.t;

  // ---- dates ---------------------------------------------------------------
  F.date = function (v, ...args) {
    const { pos, named } = splitArgs(args);
    const d = toDate(v);
    if (!d) return str(v);
    let f = pos[0] != null ? str(pos[0]) : null;
    if (named.format != null) f = env.dateFormat(str(named.format)) || DEFAULT_DATE_FORMATS[str(named.format)] || null;
    if (!f) return str(v);
    return strftime(d, f);
  };
  F.time_tag = function (v, ...args) {
    const { pos, named } = splitArgs(args);
    const d = toDate(v);
    if (!d) return str(v);
    let f = pos[0] != null ? str(pos[0]) : null;
    if (named.format != null) f = env.dateFormat(str(named.format)) || DEFAULT_DATE_FORMATS[str(named.format)] || null;
    const text = strftime(d, f || DEFAULT_DATE_FORMATS.default);
    const dt = named.datetime ? strftime(d, str(named.datetime)) : d.toISOString().replace(/\.\d{3}Z$/, 'Z');
    return `<time datetime="${escapeHtml(dt)}">${escapeHtml(text)}</time>`;
  };

  // ---- urls & assets --------------------------------------------------------
  F.asset_url = (v) => {
    const name = str(v);
    const a = env.asset(name);
    if (!a.exists) issue('error', 'missing-asset', `asset_url: assets/${name} does not exist`);
    return `/assets/${name}?v=${a.version}`;
  };
  F.asset_img_url = (v) => F.asset_url(v);
  F.shopify_asset_url = (v) => `/shopify-assets/${str(v)}`;
  F.global_asset_url = (v) => `/global-assets/${str(v)}`;
  F.file_url = (v) => `/files/${str(v)}`;
  F.file_img_url = (v) => `/files/${str(v)}`;
  F.inline_asset_content = (v) => env.assetContent(str(v));
  F.stylesheet_tag = (v, ...args) => {
    const { named } = splitArgs(args);
    if (named.preload) return `<link href="${str(v)}" rel="stylesheet" type="text/css" media="${escapeHtml(named.media || 'all')}" />`;
    return `<link href="${str(v)}" rel="stylesheet" type="text/css" media="${escapeHtml(named.media || 'all')}" />`;
  };
  F.script_tag = (v) => `<script src="${str(v)}" type="text/javascript"></script>`;
  F.preload_tag = (v, ...args) => {
    const { named } = splitArgs(args);
    if (!named.as) issue('error', 'liquid-error', 'preload_tag requires an `as` attribute');
    const rest = { ...named }; delete rest.as;
    return `<link href="${str(v)}" rel="preload" as="${escapeHtml(named.as || '')}"${attrs(rest)}>`;
  };
  F.link_to = (text, url, title) => `<a href="${escapeHtml(str(url))}"${title != null ? ` title="${escapeHtml(str(title))}"` : ''}>${str(text)}</a>`;
  F.within = (url, collection) => (collection && collection.handle ? `/collections/${collection.handle}${str(url)}` : str(url));
  F.sort_by = (url, by) => `${str(url)}${str(url).includes('?') ? '&' : '?'}sort_by=${encodeURIComponent(str(by))}`;
  F.url_for_type = (v) => `/collections/types?q=${F.url_encode(v)}`;
  F.url_for_vendor = (v) => `/collections/vendors?q=${F.url_encode(v)}`;
  F.link_to_type = (v) => `<a href="${F.url_for_type(v)}" title="${escapeHtml(str(v))}">${escapeHtml(str(v))}</a>`;
  F.link_to_vendor = (v) => `<a href="${F.url_for_vendor(v)}" title="${escapeHtml(str(v))}">${escapeHtml(str(v))}</a>`;
  const tagUrl = (tags) => `${env.currentCollectionPath()}/${tags.map(handleize).join('+')}`;
  F.link_to_tag = (label, tag) => `<a href="${tagUrl([str(tag)])}" title="Show products matching tag ${escapeHtml(str(tag))}">${str(label)}</a>`;
  F.link_to_add_tag = (label, tag) => `<a href="${tagUrl([str(tag)])}" title="Narrow selection to products matching tag ${escapeHtml(str(tag))}">${str(label)}</a>`;
  F.link_to_remove_tag = (label) => `<a href="${env.currentCollectionPath()}">${str(label)}</a>`;
  F.highlight_active_tag = (tag) => `<span class="active">${str(tag)}</span>`;
  F.customer_login_link = (v) => `<a href="/account/login" id="customer_login_link">${str(v)}</a>`;
  F.customer_logout_link = (v) => `<a href="/account/logout" id="customer_logout_link">${str(v)}</a>`;
  F.customer_register_link = (v) => `<a href="/account/register" id="customer_register_link">${str(v)}</a>`;
  F.login_button = () => '<shop-login-button></shop-login-button>';
  F.avatar = () => '<shopify-avatar></shopify-avatar>';

  F.default_pagination = (paginate, ...args) => {
    const { named } = splitArgs(args);
    if (!paginate || !paginate.parts) return '';
    const prev = named.previous != null ? str(named.previous) : '&laquo; Previous';
    const next = named.next != null ? str(named.next) : 'Next &raquo;';
    const out = [];
    if (paginate.previous) out.push(`<span class="prev"><a href="${escapeHtml(paginate.previous.url)}">${prev}</a></span>`);
    for (const p of paginate.parts) {
      if (p.is_link) out.push(`<span class="page"><a href="${escapeHtml(p.url)}">${p.title}</a></span>`);
      else if (String(p.title) === String(paginate.current_page)) out.push(`<span class="page current">${p.title}</span>`);
      else out.push(`<span class="deco">${p.title}</span>`);
    }
    if (paginate.next) out.push(`<span class="next"><a href="${escapeHtml(paginate.next.url)}">${next}</a></span>`);
    return out.join(' ');
  };

  // ---- images ----------------------------------------------------------------
  F.image_url = function (v, ...args) {
    const { named } = splitArgs(args);
    const src = resolveImageSource(env, v);
    if (!src) { issue('warn', 'image-url-nil', `image_url received ${v == null ? 'nil' : 'a non-image value'} (Shopify renders an error/empty string here)`); return ''; }
    for (const k of ['width', 'height']) {
      if (named[k] != null && !(numInfo(named[k]).n > 0)) issue('error', 'liquid-error', `image_url: ${k} must be a positive number`);
      if (named[k] != null && numInfo(named[k]).n > 5760) issue('error', 'liquid-error', `image_url: ${k} must be <= 5760`);
    }
    if (named.crop && !['top', 'center', 'bottom', 'left', 'right', 'region'].includes(str(named.crop))) issue('error', 'liquid-error', `image_url: invalid crop "${str(named.crop)}"`);
    if (!src.info) return src.url;
    return imageUrlFor(src.info, { width: named.width && numInfo(named.width).n, height: named.height && numInfo(named.height).n, crop: named.crop, format: named.format });
  };
  F.image_tag = function (v, ...args) {
    const { named } = splitArgs(args);
    const url = str(v);
    const info = imageInfoFromUrl(env.images, url);
    if (!url) { issue('warn', 'image-url-nil', 'image_tag received an empty url'); return ''; }
    const q = new URLSearchParams(url.split('?')[1] || '');
    const reqW = q.get('width') ? Number(q.get('width')) : null;
    const reqH = q.get('height') ? Number(q.get('height')) : null;
    const dims = info ? srcDims(info, reqW, reqH) : { w: reqW, h: reqH };
    const hasW = 'width' in named; const hasH = 'height' in named;
    let widthAttr = hasW ? named.width : dims.w;
    let heightAttr = hasH ? named.height : dims.h;
    if (hasW && named.width != null && !hasH && dims.w && dims.h) heightAttr = Math.round(Number(named.width) * dims.h / dims.w);
    let srcset = null;
    if (!('srcset' in named) || named.srcset != null) {
      if (named.srcset != null) srcset = str(named.srcset);
      else if (info) {
        const max = dims.w || info.width;
        const widths = named.widths != null ? str(named.widths).split(',').map((x) => Number(x.trim())).filter(Boolean) : [352, 832, 1200, 1920, 2560, 3840].filter((w) => w < max).concat([max]);
        const base = new URLSearchParams(q); base.delete('width'); base.delete('height');
        srcset = [...new Set(widths)].filter((w) => w <= Math.max(max, info.width)).map((w) => {
          const qq = new URLSearchParams(base);
          qq.set('width', String(w));
          if (reqW && reqH) qq.set('height', String(Math.round(w * reqH / reqW)));
          return `/fixture-img/${encodeURIComponent(info.name)}?${qq.toString()} ${w}w`;
        }).join(', ');
      }
    }
    const rest = { ...named };
    for (const k of ['width', 'height', 'srcset', 'widths', 'sizes', 'alt', 'class', 'loading', 'fetchpriority', 'preload', 'decoding']) delete rest[k];
    const alt = named.alt != null ? str(named.alt) : (info ? '' : '');
    if (named.alt == null) env.issue('warn', 'image-tag-alt', 'image_tag without an explicit alt: Shopify falls back to the image alt');
    const a = {
      src: url,
      alt,
      srcset,
      width: widthAttr == null ? null : widthAttr,
      height: heightAttr == null ? null : heightAttr,
      loading: named.loading != null ? named.loading : null,
      decoding: named.decoding != null ? named.decoding : null,
      fetchpriority: named.fetchpriority != null ? named.fetchpriority : null,
      sizes: named.sizes != null ? named.sizes : null,
      class: named.class != null ? named.class : null,
      ...rest,
    };
    return `<img${attrs(a).replace(' alt=""', ' alt=""')}>`;
  };
  F.img_url = function (v, size) {
    issue('warn', 'deprecated-filter', 'img_url is deprecated — use image_url');
    const src = resolveImageSource(env, v);
    if (!src || !src.info) return src ? src.url : '';
    const m = String(size || '').match(/^(\d+)?x?(\d+)?$/);
    return imageUrlFor(src.info, { width: m && m[1], height: m && m[2] });
  };
  F.img_tag = function (v, alt, cls) { issue('warn', 'deprecated-filter', 'img_tag is deprecated — use image_tag'); return `<img src="${str(v)}" alt="${escapeHtml(str(alt))}" class="${escapeHtml(str(cls))}">`; };
  F.product_img_url = F.img_url; F.collection_img_url = F.img_url; F.article_img_url = F.img_url;
  F.placeholder_svg_tag = (name, cls) => {
    const n = str(name);
    if (!PLACEHOLDER_NAMES.has(n)) issue('warn', 'placeholder-name', `placeholder_svg_tag: unknown placeholder "${n}"`);
    return placeholderSvg(n, cls == null ? '' : str(cls));
  };
  F.media_tag = function (media, ...args) {
    if (!media) return '';
    if (media.media_type === 'image' || !media.media_type) return F.image_tag.call(this, F.image_url.call(this, media, ['width', 1100]), ...args);
    if (media.media_type === 'video') return F.video_tag.call(this, media, ...args);
    if (media.media_type === 'external_video') return F.external_video_tag.call(this, media, ...args);
    return F.model_viewer_tag.call(this, media, ...args);
  };
  F.video_tag = (media, ...args) => {
    const { named } = splitArgs(args);
    if (!media) return '';
    const poster = media.preview_image ? media.preview_image.src : '';
    const a = { playsinline: 'playsinline', poster, preload: 'metadata', ...named };
    return `<video${attrs(a)}>${(media.sources || []).map((s) => `<source src="${escapeHtml(s.url)}" type="${escapeHtml(s.mime_type)}">`).join('')}</video>`;
  };
  F.external_video_url = (media, ...args) => {
    const { named } = splitArgs(args);
    if (!media) return '';
    const q = new URLSearchParams(Object.entries(named).map(([k, v]) => [k, str(v)])).toString();
    const id = media.external_id || media.id;
    const base = media.host === 'vimeo' || media.type === 'vimeo' ? `https://player.vimeo.com/video/${id}` : `https://www.youtube.com/embed/${id}`;
    return q ? `${base}?${q}` : base;
  };
  F.external_video_tag = (media, ...args) => {
    const { named } = splitArgs(args);
    if (!media) return '';
    return `<iframe frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen="allowfullscreen" src="${escapeHtml(typeof media === 'string' ? media : F.external_video_url(media))}"${attrs(named)}></iframe>`;
  };
  F.model_viewer_tag = (media) => (media ? `<model-viewer src="${escapeHtml(media.src || '')}" camera-controls></model-viewer>` : '');

  // ---- fonts -------------------------------------------------------------------
  F.font_modify = (font, prop, value) => {
    const f = modifyFont(font, str(prop), str(value));
    return f;
  };
  F.font_url = (font, kind) => {
    if (!font || !font.handle) return '';
    if (font.system) return '';
    return `/fonts/${font.handle}.${str(kind) === 'woff' ? 'woff' : 'woff2'}`;
  };
  F.font_face = (font, ...args) => {
    const { named } = splitArgs(args);
    if (!font || !font.handle || font.system) return '';
    return `@font-face {\n  font-family: ${font.family};\n  font-weight: ${font.weight};\n  font-style: ${font.style};\n${named.font_display ? `  font-display: ${str(named.font_display)};\n` : ''}  src: url("/fonts/${font.handle}.woff2") format("woff2"),\n       url("/fonts/${font.handle}.woff") format("woff");\n}`;
  };

  // ---- colours -----------------------------------------------------------------
  const col = (v) => {
    const c = parseColor(unwrap(v));
    if (!c && v != null && v !== '') issue('warn', 'color-filter', `colour filter received an unparseable colour "${str(v)}"`);
    return c;
  };
  F.color_to_rgb = (v) => { const c = col(v); return !c ? '' : c.a < 1 ? `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})` : `rgb(${c.r}, ${c.g}, ${c.b})`; };
  F.color_to_hsl = (v) => { const c = col(v); if (!c) return ''; const h = rgbToHsl(c.r, c.g, c.b); return c.a < 1 ? `hsla(${Math.round(h.h)}, ${Math.round(h.s)}%, ${Math.round(h.l)}%, ${c.a})` : `hsl(${Math.round(h.h)}, ${Math.round(h.s)}%, ${Math.round(h.l)}%)`; };
  F.color_to_hex = (v) => { const c = col(v); return c ? toHex({ ...c, a: 1 }) : ''; };
  F.hex_to_rgba = (v, a = 1) => { issue('warn', 'deprecated-filter', 'hex_to_rgba is deprecated'); const c = col(v); return c ? `rgba(${c.r},${c.g},${c.b},${numInfo(a).n})` : ''; };
  F.color_modify = (v, prop, value) => {
    const c = col(v); if (!c) return '';
    const n = numInfo(value).n; const p = str(prop);
    if (['red', 'green', 'blue'].includes(p)) c[p[0]] = Math.max(0, Math.min(255, n));
    else if (p === 'alpha') c.a = Math.max(0, Math.min(1, n));
    else if (['hue', 'saturation', 'lightness'].includes(p)) {
      const h = rgbToHsl(c.r, c.g, c.b);
      if (p === 'hue') h.h = n; if (p === 'saturation') h.s = n; if (p === 'lightness') h.l = n;
      Object.assign(c, hslToRgb(h.h, h.s, h.l));
    } else issue('error', 'liquid-error', `color_modify: unknown property "${p}"`);
    return colorOut(c);
  };
  const shiftHsl = (v, key, delta) => { const c = col(v); if (!c) return ''; const h = rgbToHsl(c.r, c.g, c.b); h[key] = Math.max(0, Math.min(100, h[key] + delta)); return colorOut({ ...c, ...hslToRgb(h.h, h.s, h.l) }); };
  F.color_lighten = (v, p) => shiftHsl(v, 'l', numInfo(p).n);
  F.color_darken = (v, p) => shiftHsl(v, 'l', -numInfo(p).n);
  F.color_saturate = (v, p) => shiftHsl(v, 's', numInfo(p).n);
  F.color_desaturate = (v, p) => shiftHsl(v, 's', -numInfo(p).n);
  F.color_mix = (v, other, weight = 50) => {
    const a = col(v); const b = col(other); if (!a || !b) return '';
    const w = Math.max(0, Math.min(100, numInfo(weight).n)) / 100;
    return colorOut({ r: a.r * w + b.r * (1 - w), g: a.g * w + b.g * (1 - w), b: a.b * w + b.b * (1 - w), a: a.a * w + b.a * (1 - w) });
  };
  const brightness = (c) => (c.r * 299 + c.g * 587 + c.b * 114) / 1000;
  const lum = (c) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  F.color_brightness = (v) => { const c = col(v); return c ? new RFloat(Math.round(brightness(c) * 100) / 100) : ''; };
  F.brightness_difference = (v, o) => { const a = col(v); const b = col(o); return a && b ? Math.round(Math.abs(brightness(a) - brightness(b))) : ''; };
  F.color_difference = (v, o) => { const a = col(v); const b = col(o); return a && b ? Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) : ''; };
  F.color_contrast = (v, o) => { const a = col(v); const b = col(o); if (!a || !b) return ''; const l1 = lum(a); const l2 = lum(b); return new RFloat(Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 10) / 10); };

  // ---- commerce helpers -----------------------------------------------------
  F.payment_type_svg_tag = (type, ...args) => { const { pos, named } = splitArgs(args); return paymentSvg(str(type), named.class != null ? str(named.class) : pos[0] != null ? str(pos[0]) : ''); };
  F.payment_type_img_url = (type) => `/payment-icons/${str(type)}.svg`;
  F.payment_button = (form) => {
    if (!form || form.form_type !== 'product') issue('error', 'liquid-error', 'payment_button must be used on a product form object');
    return '<div data-shopify="payment-button" class="shopify-payment-button" data-theme-dev-mock="payment-button"><button type="button" class="shopify-payment-button__button shopify-payment-button__button--unbranded" aria-disabled="true" data-theme-dev-mock>Buy it now</button></div>';
  };
  F.payment_terms = (form) => `<shopify-payment-terms variant-id="${escapeHtml(str(form && form.product && form.product.selected_or_first_available_variant && form.product.selected_or_first_available_variant.id))}" shopify-meta="{}"></shopify-payment-terms>`;
  F.weight_with_unit = (grams, unit) => {
    const g = numInfo(grams).n; const u = str(unit) || 'kg';
    const val = u === 'g' ? g : u === 'lb' ? g / 453.592 : u === 'oz' ? g / 28.3495 : g / 1000;
    return `${Number(val.toFixed(2))} ${u}`;
  };
  F.item_count_for_variant = (cart, id) => (cart && cart.items ? cart.items.filter((i) => i.variant_id === numInfo(id).n).reduce((s, i) => s + i.quantity, 0) : 0);
  F.line_items_for = (cart, obj) => (cart && cart.items && obj ? cart.items.filter((i) => (obj.variants ? i.product_id === obj.id : i.variant_id === obj.id)) : []);
  F.format_address = (a) => {
    if (!a) return '';
    const lines = [[a.first_name, a.last_name].filter(Boolean).join(' '), a.company, a.address1, a.address2, [a.city, a.province].filter(Boolean).join(' '), a.zip, a.country, a.phone].filter((x) => x);
    return `<p>${lines.map((l) => escapeHtml(l)).join('<br>')}</p>`;
  };
  F.default_errors = (errors) => {
    if (!errors) return '';
    const msgs = errors.messages || {};
    const items = Object.entries(msgs).map(([k, m]) => `<li>${escapeHtml(k === 'form' ? m : `${(errors.translated_fields || {})[k] || k} ${m}`)}</li>`);
    return items.length ? `<div class="errors"><ul>${items.join('')}</ul></div>` : '';
  };
  F.metafield_tag = (mf) => {
    if (!mf) return '';
    const type = mf.type || 'single_line_text_field';
    const v = mf.value;
    if (String(type).startsWith('list.')) {
      const t = type.slice(5);
      return `<ul class="metafield-${t}-array">${(v || []).map((x) => `<li class="metafield-${t}">${escapeHtml(str(x))}</li>`).join('')}</ul>`;
    }
    if (type === 'multi_line_text_field') return `<span class="metafield-multi_line_text_field">${escapeHtml(str(v)).replace(/\n/g, '<br>')}</span>`;
    if (type === 'rating') return `<span class="metafield-rating">${escapeHtml(str(v && v.rating))}</span>`;
    if (type === 'rich_text_field') return `<div class="metafield-rich_text_field">${str(v)}</div>`;
    return `<span class="metafield-${type}">${escapeHtml(str(v))}</span>`;
  };
  F.metafield_text = (mf) => {
    if (!mf) return '';
    if (Array.isArray(mf.value)) return mf.value.map(str).join(', ');
    if (mf.type === 'rating') return str(mf.value && mf.value.rating);
    return stripHtml(str(mf.value));
  };
  F.structured_data = (obj) => {
    if (!obj) return '';
    let data;
    if (obj.variants) {
      data = { '@context': 'http://schema.org/', '@type': 'Product', name: obj.title, url: obj.url, description: stripHtml(obj.description), brand: { '@type': 'Brand', name: obj.vendor }, offers: obj.variants.map((v) => ({ '@type': 'Offer', sku: v.sku, price: (v.price / 100).toFixed(2), priceCurrency: 'GBP', availability: v.available ? 'http://schema.org/InStock' : 'http://schema.org/OutOfStock', url: v.url })) };
    } else if (obj.object_type === 'article' || obj.author) {
      data = { '@context': 'http://schema.org/', '@type': 'Article', headline: obj.title, author: obj.author, datePublished: obj.published_at };
    } else data = {};
    return `<script type="application/ld+json">${safeJson(data)}</script>`;
  };
  F.standard_event_data = () => '{}';
  // Undocumented but real: Dawn's gift_card.liquid uses it (groups the code in fours).
  F.format_code = (v) => str(v).replace(/\s+/g, '').replace(/(.{4})(?=.)/g, '$1 ');
  F.currency_selector = () => { issue('warn', 'deprecated-filter', 'currency_selector is deprecated'); return ''; };

  return F;
}

/** Convert RFloat/Drop leaves so JSON output matches Shopify. */
function unwrapDeep(v) {
  if (v instanceof RFloat) return v.n;
  if (v instanceof ColorDrop || v instanceof MetafieldDrop) return v.toJSON();
  return v;
}

export { KEEP_BUILTINS, applyMoneyFormat, safeJson, numInfo, str as liquidString, makeFont };
