// Shopify schema rules (spec §6) + JSON template / section group / settings validation.
// Each validator pushes issues via `out.error(kind, msg, {file})` / `out.warn(...)`.
import { parseColor } from './drops.mjs';

export const SETTING_TYPES = new Set([
  'article', 'article_list', 'blog', 'checkbox', 'collection', 'collection_list', 'color', 'color_background', 'color_palette',
  'color_scheme', 'color_scheme_group', 'font_picker', 'html', 'image_picker', 'inline_richtext', 'link_list', 'liquid',
  'metaobject', 'metaobject_list', 'number', 'page', 'product', 'product_list', 'radio', 'range', 'richtext', 'select',
  'text', 'text_alignment', 'textarea', 'url', 'video', 'video_url', 'header', 'paragraph',
]);
const NO_DEFAULT = new Set(['image_picker', 'product', 'collection', 'page', 'blog', 'article', 'video', 'product_list', 'collection_list', 'metaobject', 'metaobject_list', 'article_list']);
const SIDEBAR = new Set(['header', 'paragraph']);
export const SECTION_TAGS = new Set(['section', 'div', 'aside', 'header', 'footer', 'article']);
export const TEMPLATE_TYPES = new Set(['*', '404', 'article', 'blog', 'captcha', 'cart', 'collection', 'customers/account', 'customers/activate_account', 'customers/addresses', 'customers/login', 'customers/order', 'customers/register', 'customers/reset_password', 'gift_card', 'index', 'list-collections', 'metaobject', 'page', 'password', 'policy', 'product', 'search']);
const BLOCK_TAGS_RE = /<\s*(p|div|ul|ol|li|h[1-6]|table|blockquote|section|article|br)\b/i;

export const ID_RE = /^[a-z_][a-z0-9_]*$/;
export const BLOCK_TYPE_RE = /^[a-z0-9_-]+$/;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function topLevelTags(html) {
  // crude top-level scan: strip nested content by tracking depth
  const tags = [];
  let depth = 0;
  const re = /<\/?([a-z0-9]+)\b[^>]*?(\/?)>|([^<]+)/gi;
  let m;
  while ((m = re.exec(html))) {
    if (m[3] !== undefined) { if (depth === 0 && m[3].trim()) tags.push('#text'); continue; }
    const closing = m[0].startsWith('</');
    const selfClose = m[2] === '/' || /^(br|img|hr)$/i.test(m[1]);
    if (closing) depth = Math.max(0, depth - 1);
    else {
      if (depth === 0) tags.push(m[1].toLowerCase());
      if (!selfClose) depth++;
    }
  }
  return tags;
}

/**
 * Validate an array of setting definitions.
 * @param {string} where  e.g. 'section settings', 'block "faq"'
 */
export function validateSettings(settings, out, ctx) {
  const { file, where } = ctx;
  if (settings === undefined) return new Map();
  if (!Array.isArray(settings)) { out.error('schema', `${where}: "settings" must be an array`, { file }); return new Map(); }
  const ids = new Map();
  settings.forEach((s, i) => {
    const label = s && s.id ? `"${s.id}"` : `#${i}`;
    const at = `${where} setting ${label}`;
    if (!s || typeof s !== 'object') { out.error('schema', `${at}: not an object`, { file }); return; }
    if (!SETTING_TYPES.has(s.type)) { out.error('schema', `${at}: unknown type "${s.type}"`, { file }); return; }
    if (SIDEBAR.has(s.type)) {
      if (typeof s.content !== 'string' || !s.content.trim()) out.error('schema', `${at}: ${s.type} needs "content"${s.label ? ' (it uses content, not label)' : ''}`, { file });
      if (s.content && s.content.length > 500) out.error('schema', `${at}: ${s.type} content is ${s.content.length} characters; Shopify rejects the whole section over 500 (the async upload job drops it silently)`, { file });
      return;
    }
    if (typeof s.id !== 'string' || !s.id) { out.error('schema', `${at}: missing id`, { file }); return; }
    if (!ID_RE.test(s.id)) out.error('schema', `${at}: id must match [a-z_][a-z0-9_]*`, { file });
    if (ids.has(s.id)) out.error('schema', `${at}: duplicate id`, { file });
    ids.set(s.id, s);
    if (typeof s.label !== 'string' || !s.label.trim()) out.error('schema', `${at}: missing label`, { file });
    for (const k of ['label', 'info', 'placeholder']) {
      if (typeof s[k] === 'string' && /<[a-z/][^>]*>/i.test(s[k])) out.warn('schema', `${at}: ${k} contains HTML (plain text only; info may use markdown links)`, { file });
    }
    const has = Object.prototype.hasOwnProperty.call(s, 'default');
    const d = s.default;
    switch (s.type) {
      case 'range': {
        for (const k of ['min', 'max', 'step']) if (!isNum(s[k])) out.error('schema', `${at}: range needs numeric ${k}`, { file });
        if (!has || !isNum(d)) out.error('schema', `${at}: range needs a numeric default`, { file });
        if (isNum(s.min) && isNum(s.max) && isNum(s.step)) {
          if (s.step <= 0) out.error('schema', `${at}: step must be > 0`, { file });
          if (s.min >= s.max) out.error('schema', `${at}: min must be < max`, { file });
          const steps = (s.max - s.min) / s.step;
          if (steps > 101 + 1e-9) out.error('schema', `${at}: (max-min)/step = ${Math.round(steps * 100) / 100} > 101 (Shopify drops the section)`, { file });
          if (isNum(d)) {
            if (d < s.min || d > s.max) out.error('schema', `${at}: default ${d} outside ${s.min}..${s.max}`, { file });
            const k = (d - s.min) / s.step;
            if (Math.abs(k - Math.round(k)) > 1e-6) out.warn('schema', `${at}: default ${d} is not on a step from min ${s.min} (step ${s.step})`, { file });
          }
        }
        if (s.unit != null && String(s.unit).length > 3) out.error('schema', `${at}: unit "${s.unit}" longer than 3 characters`, { file });
        break;
      }
      case 'number':
        if (has && d !== null && !isNum(d)) out.error('schema', `${at}: number default must be a number (got ${JSON.stringify(d)})`, { file });
        break;
      case 'checkbox':
        if (has && typeof d !== 'boolean') out.error('schema', `${at}: checkbox default must be true/false`, { file });
        break;
      case 'select':
      case 'radio': {
        if (!Array.isArray(s.options) || !s.options.length) { out.error('schema', `${at}: ${s.type} needs non-empty options`, { file }); break; }
        const vals = new Set();
        s.options.forEach((o, j) => {
          if (!o || o.value === undefined || o.label === undefined) out.error('schema', `${at}: option #${j} needs value and label`, { file });
          else {
            if (typeof o.value !== 'string') out.warn('schema', `${at}: option value ${JSON.stringify(o.value)} should be a string`, { file });
            if (vals.has(String(o.value))) out.error('schema', `${at}: duplicate option value "${o.value}"`, { file });
            vals.add(String(o.value));
          }
        });
        if (has && !vals.has(String(d))) out.error('schema', `${at}: default "${d}" is not one of the option values [${[...vals].join(', ')}]`, { file });
        break;
      }
      case 'text': case 'textarea': case 'html': case 'liquid':
        if (has && typeof d !== 'string') out.error('schema', `${at}: default must be a string`, { file });
        else if (has && d === '') out.warn('schema', `${at}: empty-string default — omit "default" instead`, { file });
        break;
      case 'richtext':
        if (has) {
          if (typeof d !== 'string') out.error('schema', `${at}: richtext default must be a string`, { file });
          else {
            const bad = topLevelTags(d.trim()).filter((t) => !/^(p|ul|ol|h[1-6])$/.test(t));
            if (!d.trim() || bad.length) out.error('schema', `${at}: richtext default must be wrapped in <p>/<ul>/<ol>/<h1-6> (top level has: ${bad.join(', ') || 'nothing'})`, { file });
          }
        }
        break;
      case 'inline_richtext':
        if (has && typeof d === 'string' && BLOCK_TAGS_RE.test(d)) out.error('schema', `${at}: inline_richtext default may not contain block tags`, { file });
        break;
      case 'url':
        if (has && d !== '/collections' && d !== '/collections/all') out.error('schema', `${at}: url default may only be "/collections" or "/collections/all" (got ${JSON.stringify(d)})`, { file });
        break;
      case 'link_list':
        if (has && d !== 'main-menu' && d !== 'footer') out.error('schema', `${at}: link_list default may only be "main-menu" or "footer"`, { file });
        break;
      case 'font_picker':
        if (!has || typeof d !== 'string' || !/^[a-z0-9_]+_[ni][1-9]$/.test(d)) out.error('schema', `${at}: font_picker needs a default like "dm_sans_n4"`, { file });
        break;
      case 'video_url':
        if (!Array.isArray(s.accept) || !s.accept.length || s.accept.some((a) => !['youtube', 'vimeo'].includes(a))) out.error('schema', `${at}: video_url needs accept: ["youtube","vimeo"]`, { file });
        if (has) out.error('schema', `${at}: video_url may not have a default`, { file });
        break;
      case 'color':
        if (has && d !== '' && !parseColor(d)) out.error('schema', `${at}: invalid colour default ${JSON.stringify(d)}`, { file });
        break;
      case 'text_alignment':
        if (has && !['left', 'center', 'right'].includes(d)) out.error('schema', `${at}: text_alignment default must be left/center/right`, { file });
        break;
      case 'product_list': case 'collection_list':
        if (s.limit != null && (!Number.isInteger(s.limit) || s.limit > 50)) out.error('schema', `${at}: limit must be an integer <= 50`, { file });
        break;
      default:
    }
    if (NO_DEFAULT.has(s.type) && has) out.error('schema', `${at}: ${s.type} settings may not have a default`, { file });
  });
  return ids;
}

/** Validate a value stored in a template / preset / settings_data against its setting def. */
export function checkValue(def, v) {
  if (v === null || v === undefined) return null;
  switch (def.type) {
    case 'checkbox': return typeof v === 'boolean' ? null : `must be true/false (got ${JSON.stringify(v)})`;
    case 'range': {
      if (!isNum(v)) return `must be a number (got ${JSON.stringify(v)})`;
      if (isNum(def.min) && v < def.min) return `${v} below min ${def.min}`;
      if (isNum(def.max) && v > def.max) return `${v} above max ${def.max}`;
      return null;
    }
    case 'number': return v === '' || isNum(v) ? null : `must be a number (got ${JSON.stringify(v)})`;
    case 'select': case 'radio': {
      const vals = (def.options || []).map((o) => String(o.value));
      return vals.includes(String(v)) ? null : `"${v}" is not one of [${vals.join(', ')}]`;
    }
    case 'text': case 'textarea': case 'richtext': case 'inline_richtext': case 'html': case 'liquid':
      if (typeof v !== 'string') return `must be a string (got ${typeof v})`;
      if (def.type === 'richtext' && v.trim()) {
        const bad = topLevelTags(v.trim()).filter((t) => !/^(p|ul|ol|h[1-6])$/.test(t));
        if (bad.length) return `richtext top level must be <p>/<ul>/<ol>/<h1-6> (has ${bad.join(', ')})`;
      }
      if (def.type === 'inline_richtext' && BLOCK_TAGS_RE.test(v)) return 'inline_richtext may not contain block tags';
      return null;
    case 'url':
      if (typeof v !== 'string') return 'must be a string';
      return v === '' || /^(https?:\/\/|mailto:|tel:|sms:|\/|#|shopify:\/\/)/.test(v) ? null : `"${v}" is not a valid url value`;
    case 'image_picker':
      return typeof v === 'string' && /^shopify:\/\/shop_images\//.test(v) ? null : `image_picker value must be "shopify://shop_images/<file>" (got ${JSON.stringify(v)})`;
    case 'product': case 'collection': case 'page': case 'blog': case 'link_list': case 'article':
      return typeof v === 'string' ? null : `must be a handle string (got ${JSON.stringify(v)})`;
    case 'product_list': case 'collection_list':
      if (!Array.isArray(v)) return 'must be an array of handles';
      if (def.limit && v.length > def.limit) return `has ${v.length} items, limit ${def.limit}`;
      return null;
    case 'color': return v === '' || parseColor(v) ? null : `invalid colour ${JSON.stringify(v)}`;
    case 'font_picker': return typeof v === 'string' && /^[a-z0-9_]+_[ni][1-9]$/.test(v) ? null : `invalid font handle ${JSON.stringify(v)}`;
    default: return null;
  }
}

function checkSettingsValues(values, defsMap, out, { file, where, unknown = 'warn' }) {
  if (values == null) return;
  if (typeof values !== 'object' || Array.isArray(values)) { out.error('template', `${where}: settings must be an object`, { file }); return; }
  for (const [k, v] of Object.entries(values)) {
    const def = defsMap.get(k);
    if (!def) { out[unknown]('template', `${where}: setting "${k}" is not in the schema (ignored by Shopify)`, { file }); continue; }
    const err = checkValue(def, v);
    if (err) out.error('template', `${where}: setting "${k}" ${err}`, { file });
  }
}

/** Validate one section's {% schema %} object. Returns { settings: Map, blocks: Map<type, {def, settings: Map}> } */
export function validateSectionSchema(schema, out, { file, sectionName, needsPreset, isMain, schemaLocale }) {
  const res = { settings: new Map(), blocks: new Map(), hasApp: false };
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) { out.error('schema', 'schema must be a JSON object', { file }); return res; }
  const nameVal = resolveT(schema.name, schemaLocale);
  if (typeof schema.name !== 'string' || !schema.name.trim()) out.error('schema', 'schema needs a "name"', { file });
  else if (nameVal.length > 25) out.error('schema', `schema name "${nameVal}" is ${nameVal.length} chars (max 25)`, { file });
  if (schema.tag !== undefined && !SECTION_TAGS.has(schema.tag)) out.error('schema', `"tag" must be one of ${[...SECTION_TAGS].join('|')} (got "${schema.tag}")`, { file });
  if (schema.class !== undefined && typeof schema.class !== 'string') out.error('schema', '"class" must be a string', { file });
  if (schema.limit !== undefined && !(Number.isInteger(schema.limit) && schema.limit >= 1)) out.error('schema', '"limit" must be a positive integer', { file });
  if (schema.templates !== undefined) out.warn('schema', '"templates" is deprecated — use enabled_on/disabled_on', { file });
  if (schema.enabled_on && schema.disabled_on) out.error('schema', 'enabled_on and disabled_on cannot both be set', { file });
  for (const key of ['enabled_on', 'disabled_on']) {
    const eo = schema[key];
    if (!eo) continue;
    if (eo.templates && (!Array.isArray(eo.templates) || eo.templates.some((t) => !TEMPLATE_TYPES.has(t)))) out.error('schema', `${key}.templates has invalid values: ${JSON.stringify(eo.templates)}`, { file });
    if (eo.groups && (!Array.isArray(eo.groups) || eo.groups.some((g) => !['*', 'header', 'footer', 'aside'].includes(g) && !/^custom\.[a-z0-9_-]+$/.test(g)))) out.error('schema', `${key}.groups has invalid values: ${JSON.stringify(eo.groups)}`, { file });
  }

  res.settings = validateSettings(schema.settings, out, { file, where: 'section' });

  if (schema.blocks !== undefined) {
    if (!Array.isArray(schema.blocks)) out.error('schema', '"blocks" must be an array', { file });
    else {
      schema.blocks.forEach((b, i) => {
        if (!b || typeof b !== 'object') { out.error('schema', `block #${i}: not an object`, { file }); return; }
        if (b.type === '@app' || b.type === '@theme') {
          if (b.type === '@app') res.hasApp = true;
          res.blocks.set(b.type, { def: b, settings: new Map() });
          return;
        }
        const at = `block "${b.type}"`;
        if (typeof b.type !== 'string' || !BLOCK_TYPE_RE.test(b.type)) out.error('schema', `${at}: type must match [a-z0-9_-]+`, { file });
        if (res.blocks.has(b.type)) out.error('schema', `${at}: duplicate block type`, { file });
        const bn = resolveT(b.name, schemaLocale);
        if (typeof b.name !== 'string' || !b.name.trim()) out.error('schema', `${at}: needs a name`, { file });
        else if (bn.length > 25) out.error('schema', `${at}: name "${bn}" is ${bn.length} chars (max 25)`, { file });
        if (b.limit !== undefined && !(Number.isInteger(b.limit) && b.limit >= 1)) out.error('schema', `${at}: limit must be a positive integer`, { file });
        res.blocks.set(b.type, { def: b, settings: validateSettings(b.settings, out, { file, where: at }) });
      });
    }
  }
  if (schema.max_blocks !== undefined && !(Number.isInteger(schema.max_blocks) && schema.max_blocks >= 1 && schema.max_blocks <= 50)) out.error('schema', `max_blocks must be an integer 1–50 (got ${schema.max_blocks})`, { file });

  const presets = schema.presets;
  if (presets !== undefined) {
    if (!Array.isArray(presets)) out.error('schema', '"presets" must be an array', { file });
    else {
      const names = new Set();
      presets.forEach((p, i) => {
        const at = `preset #${i}${p && p.name ? ` "${resolveT(p.name, schemaLocale)}"` : ''}`;
        if (!p || typeof p.name !== 'string' || !p.name) { out.error('schema', `${at}: needs a name`, { file }); return; }
        if (names.has(p.name)) out.error('schema', `${at}: duplicate preset name`, { file });
        names.add(p.name);
        checkPresetLike(p, res, schema, out, { file, where: at });
      });
    }
    if (isMain) out.warn('schema', 'main-* section has presets (spec: presets only for non-main sections)', { file });
  } else if (needsPreset) {
    out.error('schema', 'no "presets" — non-main, non-static sections need one to be addable in the editor (spec §6)', { file });
  }
  if (schema.default !== undefined) checkPresetLike(schema.default, res, schema, out, { file, where: '"default"' });
  return res;
}

function checkPresetLike(p, res, schema, out, { file, where }) {
  if (p.settings !== undefined) checkSettingsValues(p.settings, res.settings, out, { file, where, unknown: 'error' });
  if (p.blocks !== undefined) {
    const list = Array.isArray(p.blocks) ? p.blocks : (p.blocks && typeof p.blocks === 'object' ? Object.values(p.blocks) : null);
    if (!list) { out.error('schema', `${where}: blocks must be an array`, { file }); return; }
    if (schema.max_blocks && list.length > schema.max_blocks) out.error('schema', `${where}: ${list.length} blocks > max_blocks ${schema.max_blocks}`, { file });
    const counts = {};
    list.forEach((b, j) => {
      const bd = res.blocks.get(b && b.type);
      if (!bd) { out.error('schema', `${where}: block #${j} type "${b && b.type}" is not defined in blocks`, { file }); return; }
      counts[b.type] = (counts[b.type] || 0) + 1;
      if (bd.def.limit && counts[b.type] > bd.def.limit) out.error('schema', `${where}: more "${b.type}" blocks than its limit ${bd.def.limit}`, { file });
      checkSettingsValues(b.settings, bd.settings, out, { file, where: `${where} block #${j} (${b.type})`, unknown: 'error' });
    });
  }
}

export function resolveT(v, schemaLocale) {
  if (typeof v !== 'string') return '';
  if (v.startsWith('t:') && schemaLocale) {
    const val = v.slice(2).split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), schemaLocale);
    return typeof val === 'string' ? val : v;
  }
  return v;
}

/**
 * Validate a JSON template or section group.
 * getSection(type) -> { exists, schema, info } where info = validateSectionSchema result
 */
export function validateTemplateJson(json, out, { file, templateType, groupType, getSection, isGroup }) {
  if (!json || typeof json !== 'object') { out.error('template', 'not a JSON object', { file }); return; }
  if (isGroup) {
    if (typeof json.type !== 'string' || !(['header', 'footer', 'aside'].includes(json.type) || /^custom\.[a-z0-9_-]+$/.test(json.type))) out.error('template', `group "type" must be header|footer|aside|custom.<name> (got ${JSON.stringify(json.type)})`, { file });
    if (typeof json.name !== 'string' || !json.name) out.error('template', 'group needs a "name"', { file });
  } else {
    if (json.layout !== undefined && json.layout !== false && typeof json.layout !== 'string') out.error('template', '"layout" must be a layout name or false', { file });
    if (json.wrapper !== undefined && !/^(div|main|section)(?:[#.][\w-]+)*(\[[^\]]+\])*$/.test(json.wrapper)) out.error('template', `invalid "wrapper" ${JSON.stringify(json.wrapper)}`, { file });
  }
  const sections = json.sections;
  const order = json.order;
  if (!sections || typeof sections !== 'object' || Array.isArray(sections)) { out.error('template', '"sections" must be an object', { file }); return; }
  if (!Array.isArray(order)) { out.error('template', '"order" must be an array', { file }); return; }
  const keys = Object.keys(sections);
  if (keys.length > 25) out.error('template', `${keys.length} sections (max 25)`, { file });
  for (const k of order) if (!(k in sections)) out.error('template', `order lists "${k}" which is not in sections`, { file });
  for (const k of keys) if (!order.includes(k)) out.warn('template', `section "${k}" is not in order (never rendered)`, { file });
  if (new Set(order).size !== order.length) out.error('template', 'order has duplicates', { file });

  for (const [key, s] of Object.entries(sections)) {
    const where = `section "${key}"`;
    if (!s || typeof s.type !== 'string') { out.error('template', `${where}: missing type`, { file }); continue; }
    if (!/^[\w-]+$/.test(key)) out.error('template', `${where}: section key must be [A-Za-z0-9_-]`, { file });
    const sec = getSection(s.type);
    if (!sec.exists) { out.error('template', `${where}: sections/${s.type}.liquid does not exist`, { file }); continue; }
    if (!sec.info) continue; // schema invalid — reported in [schema]
    const schema = sec.schema || {};
    if (!isGroup && templateType) {
      const en = schema.enabled_on && schema.enabled_on.templates;
      const dis = schema.disabled_on && schema.disabled_on.templates;
      if (en && !en.includes('*') && !en.includes(templateType)) out.error('template', `${where}: "${s.type}" is not enabled_on template "${templateType}"`, { file });
      if (dis && (dis.includes('*') || dis.includes(templateType))) out.error('template', `${where}: "${s.type}" is disabled_on template "${templateType}"`, { file });
      if (schema.enabled_on && schema.enabled_on.groups && !schema.enabled_on.templates) out.error('template', `${where}: "${s.type}" is only enabled for groups, not templates`, { file });
    }
    if (isGroup && groupType) {
      const en = schema.enabled_on && schema.enabled_on.groups;
      const dis = schema.disabled_on && schema.disabled_on.groups;
      if (schema.enabled_on && !en) out.error('template', `${where}: "${s.type}" has enabled_on without groups — not allowed in group "${groupType}"`, { file });
      if (en && !en.includes('*') && !en.includes(groupType)) out.error('template', `${where}: "${s.type}" is not enabled_on group "${groupType}"`, { file });
      if (dis && (dis.includes('*') || dis.includes(groupType))) out.error('template', `${where}: "${s.type}" is disabled_on group "${groupType}"`, { file });
    }
    checkSettingsValues(s.settings, sec.info.settings, out, { file, where });
    const blocks = s.blocks || {};
    if (typeof blocks !== 'object' || Array.isArray(blocks)) { out.error('template', `${where}: blocks must be an object`, { file }); continue; }
    const bo = s.block_order || [];
    if (!Array.isArray(bo)) out.error('template', `${where}: block_order must be an array`, { file });
    else {
      for (const b of bo) if (!(b in blocks)) out.error('template', `${where}: block_order lists "${b}" which is not in blocks`, { file });
      for (const b of Object.keys(blocks)) if (!bo.includes(b)) out.warn('template', `${where}: block "${b}" not in block_order (never rendered)`, { file });
    }
    const n = Object.keys(blocks).length;
    if (schema.max_blocks && n > schema.max_blocks) out.error('template', `${where}: ${n} blocks > max_blocks ${schema.max_blocks}`, { file });
    if (n > 50) out.error('template', `${where}: ${n} blocks (max 50)`, { file });
    const counts = {};
    for (const [bid, b] of Object.entries(blocks)) {
      const bw = `${where} block "${bid}"`;
      if (!b || typeof b.type !== 'string') { out.error('template', `${bw}: missing type`, { file }); continue; }
      if (b.type.startsWith('shopify://apps/')) {
        if (!sec.info.hasApp) out.error('template', `${bw}: app block in a section without an @app block type`, { file });
        continue;
      }
      const bd = sec.info.blocks.get(b.type);
      if (!bd) { out.error('template', `${bw}: type "${b.type}" not in sections/${s.type}.liquid schema`, { file }); continue; }
      counts[b.type] = (counts[b.type] || 0) + 1;
      if (bd.def.limit && counts[b.type] > bd.def.limit) out.error('template', `${bw}: exceeds limit ${bd.def.limit} for "${b.type}"`, { file });
      checkSettingsValues(b.settings, bd.settings, out, { file, where: bw });
    }
  }
}

/** §5.6 contract: setting ids core must define (type, default). */
export const CONTRACT_SETTINGS = {
  logo: ['image_picker'], logo_width: ['range', 140], favicon: ['image_picker'],
  color_bg: ['color'], color_surface: ['color'], color_sand: ['color'], color_ink: ['color'], color_muted: ['color'], color_control_line: ['color'],
  color_dark: ['color'], color_on_dark: ['color'], color_on_dark_muted: ['color'], color_accent: ['color'], color_accent_text: ['color'],
  color_highlight: ['color'], color_alert: ['color'], color_success: ['color'],
  type_heading_font: ['font_picker', 'playfair_display_n4'], type_body_font: ['font_picker', 'dm_sans_n4'],
  heading_scale: ['range', 100], body_size: ['range', 16],
  page_width: ['select', '1320'], radius: ['range', 14], button_shape: ['select', 'pill'], animations: ['checkbox', true],
  trial_enable: ['checkbox', true], trial_nights: ['number', 100], guarantee_enable: ['checkbox', true], guarantee_years: ['number', 5],
  free_shipping_enable: ['checkbox', true], free_shipping_threshold: ['number', 40], delivery_promise_enable: ['checkbox', false],
  // Delivery (Oct 2026 audit, P0-3): Standard 4 to 6 working days after dispatch, dispatch 1 to 2
  // working days, Express 2 to 3 at £6.99, Standard £4.99 below the free threshold (the published
  // shipping policy). delivery_min/max_days are the Standard transit days.
  dispatch_cutoff_hour: ['range', 15], dispatch_days: ['text', '1,2,3,4,5'], delivery_min_days: ['number', 4], delivery_max_days: ['number', 6],
  delivery_dispatch_min: ['number', 1], delivery_dispatch_max: ['number', 2], delivery_standard_price: ['text', '4.99'],
  delivery_express_enable: ['checkbox', true], delivery_express_price: ['text', '6.99'], delivery_express_min: ['number', 2], delivery_express_max: ['number', 3],
  holiday_dates: ['textarea'], origin_line: ['text'],
  show_compare_savings: ['checkbox', true], savings_format: ['select', 'amount'], show_per_night: ['checkbox', true],
  show_installments: ['checkbox', false], installments_count: ['range', 3], installments_provider: ['text', 'Klarna'],
  store_rating: ['text'], store_review_count: ['text'], show_product_ratings: ['checkbox', true],
  // Low stock is opt-in and never shows by default (Oct 2026 audit, P0-2: no "Only N left";
  // placeholder stock of 5 on every variant would make it a false scarcity claim).
  low_stock_enable: ['checkbox', false], low_stock_threshold: ['range', 0],
  size_hints: ['textarea'],
  cart_type: ['select', 'drawer'], cart_upsell_product: ['product'], cart_upsell_heading: ['text', 'Complete the set'], cart_show_note: ['checkbox', false],
  card_image_ratio: ['select', 'square'], card_show_rating: ['checkbox', true], card_show_role: ['checkbox', true], card_quick_add: ['checkbox', true], card_secondary_image: ['checkbox', true],
  finder_enable: ['checkbox', true], finder_cta_label: ['text', "Find my dog's bed"],
  social_instagram: ['text'], social_facebook: ['text'], social_tiktok: ['text'], social_pinterest: ['text'], social_youtube: ['text'],
  predictive_search_enable: ['checkbox', true],
};
