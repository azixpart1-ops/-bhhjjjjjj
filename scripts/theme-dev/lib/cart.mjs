// In-memory cart with Shopify AJAX Cart API semantics.
import crypto from 'node:crypto';
import { imageJson } from './drops.mjs';
import { stripHtml } from './util.mjs';

export class CartError extends Error {
  constructor(status, description, message = 'Cart Error') {
    super(description);
    this.status = status;
    this.description = description;
    this.title = message;
  }
  toJSON() { return { status: this.status, message: this.title, description: this.description }; }
}

export function createCart() {
  return { token: crypto.randomBytes(12).toString('hex'), lines: [], note: '', attributes: {} };
}

function propsHash(props) {
  const clean = Object.fromEntries(Object.entries(props || {}).filter(([, v]) => v !== '' && v != null));
  if (!Object.keys(clean).length) return '';
  return crypto.createHash('md5').update(JSON.stringify(clean)).digest('hex').slice(0, 32);
}

function lineKey(variantId, props) {
  return `${variantId}:${propsHash(props) || crypto.createHash('md5').update(String(variantId)).digest('hex').slice(0, 32)}`;
}

function cleanProps(props) {
  if (!props || typeof props !== 'object') return {};
  return Object.fromEntries(Object.entries(props).filter(([, v]) => v !== '' && v != null).map(([k, v]) => [k, String(v)]));
}

/** Add items [{id, quantity, properties}] → returns the affected lines (JSON). */
export function cartAdd(cart, store, items) {
  if (!Array.isArray(items) || !items.length) throw new CartError(422, 'Parameter Missing or Invalid: Required parameter missing or invalid: items');
  const touched = [];
  for (const item of items) {
    const id = Number(item.id);
    const qty = item.quantity == null || item.quantity === '' ? 1 : Number(item.quantity);
    if (!Number.isFinite(qty) || qty < 1) throw new CartError(422, 'Quantity must be a positive number');
    const variant = store.variantById(id);
    if (!variant) throw new CartError(404, 'Cannot find variant');
    const product = variant.product;
    if (!variant.available) throw new CartError(422, `The product '${product.title}' is already sold out.`);
    const props = cleanProps(item.properties);
    const key = lineKey(id, props);
    const existing = cart.lines.find((l) => l.key === key);
    const already = cart.lines.filter((l) => l.variantId === id).reduce((s, l) => s + l.quantity, 0);
    if (variant.inventory_management === 'shopify' && variant.inventory_policy === 'deny') {
      const left = variant.inventory_quantity - already;
      if (left <= 0) throw new CartError(422, `All ${variant.inventory_quantity} ${variant.name} are in your cart.`);
      if (qty > left) throw new CartError(422, `You can only add ${left} ${variant.name} to the cart.`);
    }
    if (existing) existing.quantity += qty;
    else cart.lines.unshift({ key, variantId: id, quantity: qty, properties: props });
    touched.push(key);
  }
  return touched;
}

/** /cart/change.js — id (line key or variant id) or line (1-based), quantity. */
export function cartChange(cart, store, { id, line, quantity, properties }) {
  let idx = -1;
  if (line != null && line !== '') idx = Number(line) - 1;
  else if (id != null && id !== '') {
    const s = String(id);
    idx = s.includes(':') ? cart.lines.findIndex((l) => l.key === s) : cart.lines.findIndex((l) => l.variantId === Number(s));
  }
  if (idx < 0 || idx >= cart.lines.length) throw new CartError(400, 'no valid id or line parameter', 'Bad Request');
  const l = cart.lines[idx];
  if (properties && typeof properties === 'object') l.properties = cleanProps(properties);
  if (quantity != null && quantity !== '') {
    const q = Number(quantity);
    if (!Number.isFinite(q) || q < 0) throw new CartError(422, 'Quantity must be 0 or more');
    if (q === 0) cart.lines.splice(idx, 1);
    else {
      const v = store.variantById(l.variantId);
      if (v && v.inventory_management === 'shopify' && v.inventory_policy === 'deny' && q > v.inventory_quantity) {
        l.quantity = Math.max(0, v.inventory_quantity);
        throw new CartError(422, `You can only add ${v.inventory_quantity} ${v.name} to the cart.`);
      }
      l.quantity = q;
    }
  }
}

/** /cart/update.js — updates {key|variantId: qty} or array by line, note, attributes. */
export function cartUpdate(cart, store, { updates, note, attributes }) {
  if (Array.isArray(updates)) {
    updates.forEach((q, i) => { if (cart.lines[i]) cartChange(cart, store, { line: i + 1, quantity: q }); });
  } else if (updates && typeof updates === 'object') {
    for (const [k, q] of Object.entries(updates)) {
      const exists = String(k).includes(':') ? cart.lines.some((l) => l.key === k) : cart.lines.some((l) => l.variantId === Number(k));
      if (exists) cartChange(cart, store, { id: k, quantity: q });
      else if (Number(q) > 0) cartAdd(cart, store, [{ id: k, quantity: q }]);
    }
  }
  if (note != null) cart.note = String(note);
  if (attributes && typeof attributes === 'object') Object.assign(cart.attributes, attributes);
}

export function cartClear(cart) { cart.lines = []; cart.note = ''; cart.attributes = {}; }

/** Drop the lines whose variants no longer exist (e.g. switching to --empty). */
export function pruneCart(cart, store) { cart.lines = cart.lines.filter((l) => store.variantById(l.variantId)); }

function lineDrop(l, store) {
  const variant = store.variantById(l.variantId);
  const product = variant.product;
  const price = variant.price;
  const image = variant.featured_image || product.featured_image || null;
  return {
    id: variant.id,
    key: l.key,
    quantity: l.quantity,
    title: variant.title === 'Default Title' ? product.title : `${product.title} - ${variant.title}`,
    product,
    variant,
    product_id: product.id,
    variant_id: variant.id,
    url: variant.url,
    image,
    sku: variant.sku,
    vendor: product.vendor,
    price,
    original_price: price,
    final_price: price,
    discounted_price: price,
    line_price: price * l.quantity,
    original_line_price: price * l.quantity,
    final_line_price: price * l.quantity,
    total_discount: 0,
    discounts: [],
    line_level_discount_allocations: [],
    line_level_total_discount: 0,
    properties: l.properties,
    selling_plan_allocation: null,
    gift_card: false,
    requires_shipping: true,
    taxable: true,
    options_with_values: product.has_only_default_variant ? [] : product.options.map((name, i) => ({ name, value: variant.options[i] })),
    unit_price: null,
    unit_price_measurement: null,
    message: '',
    fulfillment: null,
    item_components: [],
    quantity_rule: { min: 1, max: null, increment: 1 },
    has_components: false,
  };
}

export function cartDrop(cart, store) {
  pruneCart(cart, store);
  const items = cart.lines.map((l) => lineDrop(l, store));
  const total = items.reduce((s, i) => s + i.final_line_price, 0);
  return {
    token: cart.token,
    item_count: items.reduce((s, i) => s + i.quantity, 0),
    items,
    items_count: items.length,
    total_price: total,
    original_total_price: total,
    items_subtotal_price: total,
    checkout_charge_amount: total,
    total_discount: 0,
    total_weight: items.reduce((s, i) => s + i.variant.weight * i.quantity, 0),
    currency: { iso_code: 'GBP', name: 'British Pound', symbol: '£' },
    note: cart.note || null,
    attributes: cart.attributes,
    requires_shipping: items.length > 0,
    cart_level_discount_applications: [],
    discount_applications: [],
    'empty?': items.length === 0,
    taxes_included: true,
    duties_included: false,
  };
}

export function lineJson(i) {
  const v = i.variant; const p = i.product;
  return {
    id: v.id,
    properties: i.properties,
    quantity: i.quantity,
    variant_id: v.id,
    key: i.key,
    title: i.title,
    price: i.price,
    original_price: i.original_price,
    presentment_price: i.price / 100,
    discounted_price: i.final_price,
    line_price: i.line_price,
    original_line_price: i.original_line_price,
    total_discount: 0,
    discounts: [],
    sku: v.sku,
    grams: v.weight,
    vendor: p.vendor,
    taxable: true,
    product_id: p.id,
    product_has_only_default_variant: p.has_only_default_variant,
    gift_card: false,
    final_price: i.final_price,
    final_line_price: i.final_line_price,
    url: i.url,
    featured_image: i.image ? imageJson(i.image) : null,
    image: i.image ? i.image.src : null,
    handle: p.handle,
    requires_shipping: true,
    product_type: p.type,
    product_title: p.title,
    product_description: stripHtml(p.description),
    variant_title: v.title === 'Default Title' ? null : v.title,
    variant_options: v.options,
    options_with_values: i.options_with_values,
    line_level_discount_allocations: [],
    line_level_total_discount: 0,
    quantity_rule: { min: 1, max: null, increment: 1 },
    has_components: false,
  };
}

export function cartJson(drop) {
  return {
    token: drop.token,
    note: drop.note,
    attributes: drop.attributes,
    original_total_price: drop.original_total_price,
    total_price: drop.total_price,
    total_discount: 0,
    total_weight: drop.total_weight,
    item_count: drop.item_count,
    items: drop.items.map(lineJson),
    requires_shipping: drop.requires_shipping,
    currency: 'GBP',
    items_subtotal_price: drop.items_subtotal_price,
    cart_level_discount_applications: [],
  };
}
