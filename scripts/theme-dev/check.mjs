#!/usr/bin/env node
// Lunova theme checks. Exits non-zero when any ERROR is found.
//
//   node check.mjs                 all checks
//   node check.mjs --only=schema,render
//   node check.mjs --no-theme-check
//   node check.mjs --json          also write .out/check.json
//   node check.mjs --verbose       print every warning (default caps each group)
//
// Output lines are greppable:  ERROR [schema] sections/hero.liquid  message
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ThemeRenderer, sectionIdForTemplate } from './render.mjs';
import { createStore } from './fixtures/store.mjs';
import { resolveRoute, routeCatalog } from './lib/routes.mjs';
import { createCart, cartAdd } from './lib/cart.mjs';
import { validateSectionSchema, validateTemplateJson, validateSettings, checkValue, CONTRACT_SETTINGS } from './lib/schema.mjs';
import { liquidjs } from './lib/drops.mjs';
import {
  DEFAULT_THEME_DIR, OUT_DIR, HARNESS_DIR, readText, exists, listFiles, stripJsonComment, deepMerge, getPath, parseArgs, relTheme, setThemeRootForRel,
} from './lib/util.mjs';

const args = parseArgs(process.argv.slice(2));
const THEME = path.resolve(args.theme || DEFAULT_THEME_DIR);
setThemeRootForRel(THEME);
const ONLY = args.only ? new Set(String(args.only).split(',')) : null;
const run = (name) => (!ONLY || ONLY.has(name)) && !(name === 'theme-check' && args['no-theme-check']);
const VERBOSE = !!args.verbose;
const CAP = VERBOSE ? Infinity : 40;

// Sections rendered statically (layout {% section %}, Section Rendering by file name). Auto-detected + spec.
const SPEC_STATIC = ['cart-drawer', 'quick-add', 'bed-finder', 'quick-add-product', 'predictive-search'];

const results = []; // {check, level, file, line, message, seen}
function add(check, level, message, { file = '', line = null, seen = null } = {}) {
  results.push({ check, level, file: file ? relTheme(file) : '', line, message, seen });
}
const sink = (check) => ({
  error: (kind, msg, w = {}) => add(check, 'error', kind && kind !== check ? `${msg}` : msg, w),
  warn: (kind, msg, w = {}) => add(check, 'warn', msg, w),
});

const rel = (f) => relTheme(f);
const T = (...p) => path.join(THEME, ...p);

function parseJson(file) {
  try { return { ok: true, value: JSON.parse(stripJsonComment(fs.readFileSync(file, 'utf8'))) }; } catch (e) { return { ok: false, error: e.message }; }
}

function mergedLocale() {
  const main = T('locales', 'en.default.json');
  if (exists(main)) { const p = parseJson(main); return p.ok ? p.value : {}; }
  const out = {};
  for (const f of listFiles(T('locales', '_parts'), { ext: ['.json'] })) { const p = parseJson(f); if (p.ok) deepMerge(out, p.value); }
  return out;
}

// --------------------------------------------------------------------------
// Liquid statement scanner (skips comments/raw/schema; splits {% liquid %})
function liquidStatements(src) {
  const out = [];
  const lineAt = (i) => src.slice(0, i).split('\n').length;
  const re = /\{\{-?([\s\S]*?)-?\}\}|\{%-?\s*([\s\S]*?)\s*-?%\}/g;
  let m; let skipUntil = null;
  while ((m = re.exec(src))) {
    if (m[2] !== undefined) {
      const body = m[2].trim();
      const name = body.split(/\s+/)[0];
      if (skipUntil) { if (name === skipUntil) skipUntil = null; continue; }
      if (['comment', 'raw', 'schema', 'stylesheet', 'javascript', 'doc'].includes(name)) { skipUntil = `end${name}`; continue; }
      if (name.startsWith('#')) continue;
      if (name === 'liquid') {
        const base = lineAt(m.index);
        let inComment = false;
        body.slice(6).split('\n').forEach((ln, i) => {
          const t = ln.trim();
          if (!t) return;
          const w = t.split(/\s+/)[0];
          if (inComment) { if (w === 'endcomment') inComment = false; return; }
          if (w === 'comment') { inComment = true; return; }
          if (w.startsWith('#')) return;
          out.push({ kind: 'tag', text: t, line: base + i });
        });
        continue;
      }
      out.push({ kind: 'tag', text: body, line: lineAt(m.index) });
    } else if (!skipUntil) out.push({ kind: 'output', text: m[1].trim(), line: lineAt(m.index) });
  }
  return out;
}

// ==========================================================================
// (a) JSON
function checkJson() {
  const files = listFiles(THEME, { recursive: true, ext: ['.json'] }).filter((f) => !f.includes(`${path.sep}node_modules${path.sep}`));
  let ok = 0;
  for (const f of files) {
    const src = readText(f);
    const isTemplateLike = /[/\\](templates|sections)[/\\]/.test(f) || /settings_data\.json$/.test(f);
    if (!isTemplateLike && /^\s*\/\*/.test(src)) add('json', 'error', 'comment header only allowed in templates/section groups/settings_data', { file: f });
    const p = parseJson(f);
    if (!p.ok) add('json', 'error', `invalid JSON: ${p.error}`, { file: f });
    else ok++;
  }
  return { files: files.length, ok };
}

// ==========================================================================
// (b) section schemas
const sectionInfo = new Map(); // type -> {exists, schema, info, src}
function detectStatic() {
  const set = new Set(SPEC_STATIC);
  for (const f of listFiles(THEME, { recursive: true, ext: ['.liquid'] })) {
    for (const s of liquidStatements(readText(f) || '')) {
      const m = s.text.match(/^section\s+['"]([^'"]+)['"]/);
      if (m) set.add(m[1]);
    }
  }
  for (const f of listFiles(T('assets'), { ext: ['.js'] })) {
    const src = readText(f) || '';
    for (const m of src.matchAll(/section_id['"]?\s*[,:=]\s*['"]([a-z0-9-]+)['"]/g)) set.add(m[1]);
    for (const m of src.matchAll(/section_id=([a-z0-9-]+)/g)) set.add(m[1]);
  }
  return set;
}

function loadSchemaLocale() {
  const p = parseJson(T('locales', 'en.default.schema.json'));
  return p.ok ? p.value : null;
}

function checkSchemas() {
  const out = sink('schema');
  const statics = detectStatic();
  const schemaLocale = loadSchemaLocale();
  const files = listFiles(T('sections'), { ext: ['.liquid'] });
  for (const f of files) {
    const type = path.basename(f, '.liquid');
    const src = readText(f) || '';
    const blocks = [...src.matchAll(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/g)];
    if (blocks.length !== 1) { out.error('schema', blocks.length ? 'more than one {% schema %} tag' : 'no {% schema %} tag (Shopify drops the section)', { file: f }); sectionInfo.set(type, { exists: true, schema: null, info: null, src }); continue; }
    const raw = blocks[0][1];
    if (/\{\{|\{%/.test(raw)) out.error('schema', 'Liquid inside {% schema %} is not allowed', { file: f });
    let schema;
    try { schema = JSON.parse(raw); } catch (e) { out.error('schema', `invalid schema JSON: ${e.message}`, { file: f }); sectionInfo.set(type, { exists: true, schema: null, info: null, src }); continue; }
    const isMain = type.startsWith('main-');
    const isStatic = statics.has(type);
    const info = validateSectionSchema(schema, out, { file: f, sectionName: type, needsPreset: !isMain && !isStatic, isMain, schemaLocale });
    sectionInfo.set(type, { exists: true, schema, info, src, isStatic, isMain });
    specConventions(type, schema, src, f, { isStatic, isMain });
  }
  for (const f of listFiles(T('snippets'), { ext: ['.liquid'] })) {
    if (/\{%-?\s*schema\s*-?%\}/.test(readText(f) || '')) add('schema', 'error', 'snippets may not contain {% schema %}', { file: f });
  }
  return { sections: files.length, statics: [...statics].sort() };
}

function specConventions(type, schema, src, file, { isStatic }) {
  const w = (msg) => add('spec', 'warn', msg, { file });
  const settings = Array.isArray(schema.settings) ? schema.settings : [];
  const byId = Object.fromEntries(settings.filter((s) => s && s.id).map((s) => [s.id, s]));
  if (!isStatic) {
    const cs = byId.color_scheme;
    if (!cs) w('§6: no color_scheme setting');
    else if (cs.type !== 'select' || JSON.stringify((cs.options || []).map((o) => o.value).sort()) !== JSON.stringify(['bone', 'moss', 'oat', 'white'])) w('§6: color_scheme should be a select with bone|oat|moss|white');
    for (const p of ['padding_top', 'padding_bottom']) {
      const s = byId[p];
      if (!s) w(`§6: no ${p} setting`);
      else if (s.type !== 'range' || s.min !== 0 || s.max !== 120 || s.step !== 4) w(`§6: ${p} should be range 0–120 step 4`);
    }
    if (!/render\s+['"]section-styles['"]/.test(src)) w("§6: does not render 'section-styles'");
    if (!/scheme-\{\{/.test(src) && !/scheme-'/.test(src)) w('§6: wrapper has no scheme-<value> class');
  }
  const realBlocks = (schema.blocks || []).filter((b) => b && b.type && !b.type.startsWith('@'));
  if (realBlocks.length && !/shopify_attributes/.test(src)) {
    // The block may be passed to a snippet that outputs its attributes.
    const viaSnippet = [...src.matchAll(/render\s+['"]([^'"]+)['"][^%]*\bblock\s*:/g)].some((m) => /shopify_attributes/.test(readText(T('snippets', `${m[1]}.liquid`)) || ''));
    if (!viaSnippet) add('spec', 'warn', '§6: has blocks but never outputs block.shopify_attributes (theme editor cannot select blocks)', { file });
  }
  if (/\{%-?\s*render\s+block\s*-?%\}/.test(src) && !(schema.blocks || []).some((b) => b.type === '@app')) add('schema', 'error', 'renders app blocks but schema has no @app block type', { file });
}

const getSection = (type) => {
  if (sectionInfo.has(type)) return sectionInfo.get(type);
  return { exists: exists(T('sections', `${type}.liquid`)), schema: null, info: null };
};

// ==========================================================================
// (c) templates, groups, settings
function checkTemplates() {
  const out = sink('templates');
  const tdir = T('templates');
  const files = listFiles(tdir, { recursive: true, ext: ['.json', '.liquid'] });
  const names = new Map();
  for (const f of files) {
    const relName = path.relative(tdir, f).replace(/\\/g, '/');
    const base = relName.replace(/\.(json|liquid)$/, '');
    if (names.has(base)) add('templates', 'error', `both ${names.get(base)} and ${relName} exist — Shopify rejects duplicate template names`, { file: f });
    names.set(base, relName);
    if (!f.endsWith('.json')) {
      if (!/^(gift_card|robots\.txt)/.test(path.basename(f))) add('templates', 'warn', 'Liquid template (not JSON) — sections cannot be customised', { file: f });
      continue;
    }
    const p = parseJson(f);
    if (!p.ok) continue;
    const ttype = base.split('.')[0];
    validateTemplateJson(p.value, out, { file: f, templateType: ttype, getSection });
    const lay = p.value.layout;
    if (typeof lay === 'string' && !exists(T('layout', `${lay}.liquid`))) add('templates', 'error', `layout "${lay}" does not exist`, { file: f });
  }
  // spec §7 required templates
  for (const t of ['index', 'product', 'collection', 'list-collections', 'search', 'cart', 'page', 'page.contact', 'page.faq', 'page.about', 'page.bed-finder', 'blog', 'article', '404', 'password', 'gift_card', 'customers/account', 'customers/activate_account', 'customers/addresses', 'customers/login', 'customers/order', 'customers/register', 'customers/reset_password']) {
    if (!names.has(t)) add('templates', 'error', `§7: template ${t} missing`, { file: T('templates') });
  }
  for (const f of listFiles(T('sections'), { ext: ['.json'] })) {
    const p = parseJson(f);
    if (!p.ok) continue;
    validateTemplateJson(p.value, out, { file: f, isGroup: true, groupType: p.value.type, getSection });
  }
  for (const l of ['theme', 'password']) if (!exists(T('layout', `${l}.liquid`))) add('templates', 'error', `layout/${l}.liquid missing`, { file: T('layout') });
  return { templates: files.length };
}

function checkSettings() {
  const out = sink('settings');
  const sf = T('config', 'settings_schema.json');
  const p = parseJson(sf);
  if (!p.ok) { add('settings', 'error', p.error, { file: sf }); return {}; }
  const groups = p.value;
  if (!Array.isArray(groups)) { add('settings', 'error', 'settings_schema.json must be an array', { file: sf }); return {}; }
  const info = groups[0];
  if (!info || info.name !== 'theme_info') add('settings', 'error', 'first entry must be theme_info', { file: sf });
  else for (const k of ['theme_name', 'theme_version', 'theme_author', 'theme_documentation_url', 'theme_support_url']) if (!info[k]) add('settings', 'error', `theme_info.${k} missing`, { file: sf });
  const all = new Map();
  groups.slice(1).forEach((g) => {
    if (!g.name) add('settings', 'error', 'settings group without name', { file: sf });
    const ids = validateSettings(g.settings || [], out, { file: sf, where: `group "${g.name}"` });
    for (const [id, d] of ids) {
      if (all.has(id)) add('settings', 'error', `setting id "${id}" defined twice`, { file: sf });
      all.set(id, d);
    }
  });
  for (const [id, [type, def]] of Object.entries(CONTRACT_SETTINGS)) {
    const d = all.get(id);
    if (!d) { add('contract', 'error', `§5.6 setting "${id}" (${type}) missing from settings_schema.json`, { file: sf }); continue; }
    if (d.type !== type) add('contract', 'error', `§5.6 setting "${id}" should be ${type}, is ${d.type}`, { file: sf });
    else if (def !== undefined && d.default !== def && String(d.default) !== String(def)) add('contract', 'warn', `§5.6 setting "${id}" default ${JSON.stringify(d.default)} (spec: ${JSON.stringify(def)})`, { file: sf });
  }
  const df = T('config', 'settings_data.json');
  const dp = parseJson(df);
  if (dp.ok) {
    let cur = dp.value.current;
    if (typeof cur === 'string') {
      if (!dp.value.presets || !dp.value.presets[cur]) add('settings', 'error', `current refers to missing preset "${cur}"`, { file: df });
      cur = (dp.value.presets || {})[cur] || {};
    }
    for (const [k, v] of Object.entries(cur || {})) {
      if (['sections', 'content_for_index', 'blocks'].includes(k)) continue;
      const d = all.get(k);
      if (!d) { add('settings', 'warn', `settings_data current.${k} not in settings_schema`, { file: df }); continue; }
      const e = checkValue(d, v);
      if (e) add('settings', 'error', `settings_data current.${k} ${e}`, { file: df });
    }
    for (const [sid, s] of Object.entries((cur && cur.sections) || {})) {
      if (!s || !getSection(s.type).exists) add('settings', 'error', `settings_data current.sections.${sid}: section type "${s && s.type}" missing`, { file: df });
    }
  } else if (!exists(df)) add('settings', 'error', 'config/settings_data.json missing', { file: df });
  return { settings: all.size };
}

// ==========================================================================
// static references
function checkStatic(locale) {
  const files = ['layout', 'sections', 'snippets', 'templates', 'blocks'].flatMap((d) => listFiles(T(d), { recursive: true, ext: ['.liquid'] }));
  const snippetUses = new Map();
  let parsed = 0;
  // icon names the icon snippet implements (case/when) vs. names used with render 'icon'
  const iconSrc = readText(T('snippets', 'icon.liquid')) || '';
  const iconNames = new Set();
  for (const m of iconSrc.matchAll(/when\s+((?:['"][^'"]+['"]\s*(?:,|or)?\s*)+)/g)) for (const n of m[1].matchAll(/['"]([^'"]+)['"]/g)) iconNames.add(n[1]);
  const engine = new ThemeRenderer({ themeDir: THEME, store: createStore({ empty: true }) }).engine;
  for (const f of files) {
    const src = readText(f) || '';
    try { engine.parse(src, f); parsed++; } catch (e) {
      let line = null; try { line = e.token ? e.token.getPosition()[0] : null; } catch { /* */ }
      add('liquid', 'error', `syntax: ${String(e.message).split(', line:')[0].replace(/, file:\S+$/, '')}`, { file: f, line });
    }
    // Shopify's tokenizer is /{%.*?%}|{{.*?}}?/ — lazier than liquidjs. A '}' inside an output
    // tag (even in a string) ends the tag there: "Variable ... was not properly terminated".
    // liquidjs parses those happily, so this caught nothing until it broke the real homepage.
    for (const m of src.matchAll(/\{%[\s\S]*?%\}|\{\{[\s\S]*?\}\}?/g)) {
      if (m[0].startsWith('{{') && !m[0].endsWith('}}')) {
        add('liquid', 'error', `Shopify tokenizer: output tag is cut short at a '}' (${JSON.stringify(m[0].slice(0, 60))}) — build the string with capture instead`, { file: f, line: src.slice(0, m.index).split('\n').length });
      }
    }
    for (const s of liquidStatements(src)) {
      let m;
      if (s.kind === 'tag' && (m = s.text.match(/^(render|include)\s+['"]([^'"]+)['"]/))) {
        snippetUses.set(m[2], (snippetUses.get(m[2]) || 0) + 1);
        if (!exists(T('snippets', `${m[2]}.liquid`))) add('refs', 'error', `${m[1]} '${m[2]}': snippets/${m[2]}.liquid does not exist`, { file: f, line: s.line });
        if (m[1] === 'include') add('refs', 'warn', `include is deprecated (use render) — '${m[2]}'`, { file: f, line: s.line });
      }
      if (iconNames.size && s.kind === 'tag' && /^render\s+['"]icon['"]/.test(s.text) && (m = s.text.match(/\bname:\s*['"]([^'"]+)['"]/)) && !iconNames.has(m[1])) add('refs', 'warn', `icon '${m[1]}' is not implemented in snippets/icon.liquid (renders nothing)`, { file: f, line: s.line });
      if (s.kind === 'tag' && (m = s.text.match(/^section\s+['"]([^'"]+)['"]/)) && !exists(T('sections', `${m[1]}.liquid`))) add('refs', 'error', `section '${m[1]}': sections/${m[1]}.liquid does not exist`, { file: f, line: s.line });
      if (s.kind === 'tag' && (m = s.text.match(/^sections\s+['"]([^'"]+)['"]/)) && !exists(T('sections', `${m[1]}.json`))) add('refs', 'error', `sections '${m[1]}': sections/${m[1]}.json does not exist`, { file: f, line: s.line });
      for (const a of s.text.matchAll(/['"]([^'"]+)['"]\s*\|\s*asset_url/g)) {
        if (!exists(T('assets', a[1])) && !exists(T('assets', `${a[1]}.liquid`))) add('refs', 'error', `asset '${a[1]}' does not exist in assets/`, { file: f, line: s.line });
      }
      for (const a of s.text.matchAll(/['"]([A-Za-z0-9_.-]+)['"]\s*\|\s*(?:t|translate)\b/g)) {
        const key = a[1];
        if (key.startsWith('shopify.')) continue;
        const v = getPath(locale, key);
        if (v == null) add('i18n', 'error', `translation key "${key}" missing from locale`, { file: f, line: s.line });
        else if (typeof v === 'object' && !/count\s*:/.test(s.text)) add('i18n', 'warn', `translation "${key}" is pluralised but used without count:`, { file: f, line: s.line });
      }
      for (const a of s.text.matchAll(/\|\s*(img_url|img_tag|product_img_url|collection_img_url|article_img_url|hex_to_rgba|currency_selector)\b/g)) add('liquid', 'warn', `deprecated filter ${a[1]}`, { file: f, line: s.line });
    }
    // Inline scripts other than JSON islands (spec §6) in sections/snippets.
    if (/[/\\](sections|snippets|blocks)[/\\]/.test(f)) {
      for (const m of src.matchAll(/<script\b([^>]*)>/gi)) {
        const attrs = m[1];
        if (/\bsrc=/.test(attrs)) {
          if (!/\bdefer\b|\basync\b|type=["']module/.test(attrs)) add('perf', 'warn', 'parser-blocking <script src> (add defer)', { file: f, line: src.slice(0, m.index).split('\n').length });
          continue;
        }
        if (!/type=["'](application\/(ld\+)?json)["']/.test(attrs)) add('spec', 'warn', '§6: inline <script> that is not a JSON island', { file: f, line: src.slice(0, m.index).split('\n').length });
      }
    }
  }
  for (const f of listFiles(T('snippets'), { ext: ['.liquid'] })) {
    const name = path.basename(f, '.liquid');
    if (!snippetUses.has(name)) add('refs', 'warn', `snippet '${name}' is never rendered`, { file: f });
  }
  for (const f of listFiles(T('assets'), { ext: ['.css'] })) {
    const src = (readText(f) || '').replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
    for (const m of src.matchAll(/!important/g)) {
      const before = src.slice(0, m.index);
      const open = before.lastIndexOf('{');
      const selector = before.slice(before.lastIndexOf('}', open) + 1, open);
      if (!/\[hidden\]/.test(selector)) add('spec', 'warn', `§5.2: !important outside [hidden] (selector: ${selector.trim().replace(/\s+/g, ' ').slice(0, 60)})`, { file: f, line: before.split('\n').length });
    }
  }
  return { files: files.length, parsed };
}

// ==========================================================================
// locales
function checkLocales() {
  const dir = T('locales');
  const main = path.join(dir, 'en.default.json');
  const parts = listFiles(path.join(dir, '_parts'), { ext: ['.json'] });
  const leaves = (obj, prefix = '', acc = new Map()) => {
    for (const [k, v] of Object.entries(obj || {})) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) leaves(v, key, acc); else acc.set(key, v);
    }
    return acc;
  };
  const seen = new Map();
  for (const f of parts) {
    const p = parseJson(f);
    if (!p.ok) continue;
    const area = path.basename(f, '.json');
    const allowedTop = area === 'core' ? ['core', 'general', 'accessibility', 'date_formats', 'shopify'] : [area];
    for (const k of Object.keys(p.value)) if (!allowedTop.includes(k)) add('i18n', 'warn', `top-level key "${k}" (spec: parts use their area name "${area}")`, { file: f });
    for (const [k, v] of leaves(p.value)) {
      if (seen.has(k) && seen.get(k).v !== v) add('i18n', 'error', `key "${k}" defined differently in ${path.basename(seen.get(k).f)} and ${path.basename(f)}`, { file: f });
      seen.set(k, { v, f });
      if (typeof v === 'string' && /<[a-z][^>]*>/i.test(v) && !/_html$/.test(k.split('.').pop())) add('i18n', 'warn', `"${k}" contains HTML but the key does not end in _html (Shopify escapes it)`, { file: f });
    }
  }
  if (!exists(main)) {
    add('i18n', parts.length ? 'warn' : 'error', parts.length ? 'locales/en.default.json missing — assemble it from locales/_parts before deploy' : 'locales/en.default.json missing', { file: dir });
  } else {
    const p = parseJson(main);
    if (p.ok) {
      const have = leaves(p.value);
      for (const [k, { v, f }] of seen) {
        if (!have.has(k)) add('i18n', 'error', `key "${k}" from ${path.basename(f)} missing in en.default.json (stale assembly)`, { file: main });
        else if (have.get(k) !== v) add('i18n', 'warn', `key "${k}" differs between en.default.json and ${path.basename(f)}`, { file: main });
      }
    }
  }
  if (parts.length) add('i18n', 'warn', 'locales/_parts/ must not ship: Shopify only accepts files directly in locales/ (remove after assembling)', { file: path.join(dir, '_parts') });
  return { parts: parts.length, keys: seen.size };
}

// ==========================================================================
// (d) render sweep
const renderIssues = new Map(); // key -> {issue, seen: []}
let renderCount = 0;
function collect(issues, mode, url) {
  for (const i of issues.list) {
    const key = `${i.level}|${i.kind}|${i.file}|${i.line}|${i.message}`;
    if (!renderIssues.has(key)) renderIssues.set(key, { i, seen: [] });
    renderIssues.get(key).seen.push(`${mode} ${url}`);
  }
}

function renderSweep(mode) {
  const store = createStore({ empty: mode === 'empty' });
  const r = new ThemeRenderer({ themeDir: THEME, store });
  const empty = createCart();
  const full = createCart();
  const products = store.products();
  if (products.length) {
    const coniston = store.productByHandle('coniston-orthopaedic-dog-bed') || products[0];
    const single = products.find((p) => p.has_only_default_variant) || products[1] || products[0];
    cartAdd(full, store, [{ id: coniston.variants[1] ? coniston.variants[1].id : coniston.variants[0].id, quantity: 1 }, { id: single.variants[0].id, quantity: 2, properties: { "Dog's name": 'Bella' } }]);
  }
  const visit = (name, url, opts = {}) => {
    const u = new URL(url, 'http://localhost:9292');
    const route = resolveRoute(store, u.pathname, u.searchParams, { loggedIn: true });
    if (route.redirect) return;
    const res = opts.section ? r.renderSectionById(opts.section, route, { cart: opts.cart || empty }) : r.renderPage(route, { cart: opts.cart || empty });
    renderCount++;
    collect(res.issues, mode, `${url}${opts.section ? ` [section ${opts.section}]` : ''}${opts.cart === full ? ' [cart:full]' : ''}`);
    const html = res.html == null ? '' : res.html;
    if (opts.section && res.html == null) add('render', 'error', `Section Rendering returned nothing for section_id=${opts.section}`, { seen: [`${mode} ${url}`] });
    if (!opts.section && route.status === 200 && !/<\/html>/i.test(html) && route.template !== 'gift_card') add('render', 'warn', `${url}: output has no </html>`, { seen: [`${mode} ${url}`] });
    return { route, html };
  };

  for (const [name, url] of routeCatalog(store)) visit(name, url);
  if (products.length) {
    visit('cart-full', '/cart', { cart: full });
    visit('home-full-cart', '/', { cart: full });
    visit('drawer-full', '/', { cart: full, section: 'cart-drawer' });
    for (const p of products) visit(`quick-add ${p.handle}`, p.url, { section: 'quick-add-product' });
  }
  visit('drawer-empty', '/', { section: 'cart-drawer' });
  // Predictive search (Section Rendering of predictive-search with predictive_search set)
  for (const q of ['con', 'bed', 'zzzz', '']) {
    const route = { template: 'search', pageType: 'search', path: '/search/suggest', query: new URLSearchParams({ q }), status: 200, currentPage: 1, predictive: store.predictive(q) };
    const res = r.renderSectionById('predictive-search', route, { cart: empty });
    renderCount++;
    collect(res.issues, mode, `/search/suggest?q=${q} [section predictive-search]`);
    if (res.html == null) add('render', 'error', 'predictive-search section did not render', { seen: [`${mode} q=${q}`] });
  }
  // Product recommendations: section id from product.json
  const pj = parseJson(T('templates', 'product.json'));
  if (pj.ok && products.length) {
    for (const [key, s] of Object.entries(pj.value.sections || {})) {
      if (!/recommend/.test(s.type)) continue;
      const route = { template: 'product', pageType: 'product', path: '/recommendations/products', query: new URLSearchParams(), status: 200, currentPage: 1, product: null, recommendations: store.recommend(products[0].id, { limit: 4 }) };
      const res = r.renderSectionById(sectionIdForTemplate(key), route, { cart: empty });
      renderCount++;
      collect(res.issues, mode, `/recommendations/products [section ${key}]`);
    }
  }
  // Main cart re-render by section id
  const cj = parseJson(T('templates', 'cart.json'));
  if (cj.ok) {
    for (const [key, s] of Object.entries(cj.value.sections || {})) {
      if (s.type !== 'main-cart') continue;
      visit('main-cart', '/cart', { section: sectionIdForTemplate(key), cart: products.length ? full : empty });
    }
  }
  // Every section preset, as a merchant would add it from the editor (rendered on the home page context)
  for (const [type, info] of sectionInfo) {
    if (!info.schema || !Array.isArray(info.schema.presets)) continue;
    info.schema.presets.forEach((p, i) => {
      const blocks = {}; const order = [];
      const list = Array.isArray(p.blocks) ? p.blocks : Object.values(p.blocks || {});
      list.forEach((b, j) => { const id = `${b.type}_${j}`; blocks[id] = { type: b.type, settings: b.settings || {} }; order.push(id); });
      const route = resolveRoute(store, '/', new URLSearchParams());
      const res = r.renderAdHocSection(`template--preset__${type}_${i}`, type, { settings: p.settings || {}, blocks, block_order: order }, route, { cart: empty });
      renderCount++;
      collect(res.issues, mode, `[preset "${p.name}" of ${type}]`);
    });
  }
  return { store, r };
}

// ==========================================================================
// (e) theme-check
async function runThemeCheck(locale) {
  const require = createRequire(path.join(HARNESS_DIR, 'package.json'));
  let tc;
  try { tc = require('@shopify/theme-check-node'); } catch (e) {
    add('theme-check', 'warn', `@shopify/theme-check-node not installed (npm i in scripts/theme-dev) — skipped: ${e.message.split('\n')[0]}`);
    return { skipped: true };
  }
  const copy = path.join(OUT_DIR, 'theme-check', 'theme');
  fs.rmSync(copy, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(copy), { recursive: true });
  fs.cpSync(THEME, copy, { recursive: true, filter: (src) => !src.includes(`${path.sep}locales${path.sep}_parts`) });
  let assembled = false;
  if (!exists(path.join(copy, 'locales', 'en.default.json'))) {
    fs.mkdirSync(path.join(copy, 'locales'), { recursive: true });
    fs.writeFileSync(path.join(copy, 'locales', 'en.default.json'), JSON.stringify(locale, null, 2));
    assembled = true;
  }
  const t0 = Date.now();
  let runRes;
  try {
    runRes = await Promise.race([
      tc.themeCheckRun(copy, undefined, () => {}),
      new Promise((_, rej) => setTimeout(() => rej(new Error('theme-check timed out after 180s')), 180000)),
    ]);
  } catch (e) {
    add('theme-check', 'warn', `theme-check could not run (docs download needs network on first run?): ${e.message}`);
    return { skipped: true };
  }
  const counts = {};
  for (const o of runRes.offenses) {
    const file = o.uri.replace(/^file:\/\//, '').replace(copy, THEME);
    const level = o.severity === 0 ? 'error' : o.severity === 1 ? 'warn' : 'info';
    counts[o.check] = (counts[o.check] || 0) + 1;
    if (level === 'info') continue;
    add('theme-check', level, `${o.check}: ${o.message}`, { file, line: o.start ? o.start.line + 1 : null });
  }
  return { offenses: runRes.offenses.length, ms: Date.now() - t0, counts, assembledLocale: assembled };
}

// ==========================================================================
async function main() {
  const t0 = Date.now();
  if (!exists(THEME)) { console.log(`ERROR [setup] theme dir ${THEME} does not exist`); process.exit(1); }
  console.log(`== Lunova theme check — ${THEME}`);
  const locale = mergedLocale();
  const summary = {};
  if (run('json')) summary.json = checkJson();
  // schemas are needed by templates & render even when not reported
  checkSchemas();
  if (!run('schema')) for (let i = results.length - 1; i >= 0; i--) if (['schema', 'spec'].includes(results[i].check)) results.splice(i, 1);
  if (run('templates')) { summary.templates = checkTemplates(); summary.settings = checkSettings(); }
  if (run('static')) summary.static = checkStatic(locale);
  if (run('locales')) summary.locales = checkLocales();
  if (run('render')) {
    for (const mode of ['full', 'empty']) renderSweep(mode);
    for (const { i, seen } of renderIssues.values()) add('render', i.level, `${i.kind}: ${i.message}`, { file: i.file, line: i.line, seen });
    summary.render = { renders: renderCount };
  }
  if (run('theme-check')) summary.themeCheck = await runThemeCheck(locale);

  // ---- report
  const order = ['json', 'schema', 'spec', 'contract', 'templates', 'settings', 'liquid', 'refs', 'i18n', 'perf', 'render', 'theme-check'];
  const byCheck = new Map(order.map((c) => [c, []]));
  for (const r of results) { if (!byCheck.has(r.check)) byCheck.set(r.check, []); byCheck.get(r.check).push(r); }
  let errors = 0; let warnings = 0;
  for (const [check, list] of byCheck) {
    const e = list.filter((x) => x.level === 'error'); const w = list.filter((x) => x.level === 'warn');
    errors += e.length; warnings += w.length;
    if (!list.length) continue;
    console.log(`\n[${check}] errors=${e.length} warnings=${w.length}`);
    for (const x of [...e, ...w.slice(0, CAP)]) {
      const loc = x.file ? `${x.file}${x.line ? ':' + x.line : ''}` : '-';
      const seen = x.seen && x.seen.length ? `  (${x.seen[0]}${x.seen.length > 1 ? ` +${x.seen.length - 1} more` : ''})` : '';
      console.log(`${x.level === 'error' ? 'ERROR' : 'WARN '} [${check}] ${loc}  ${x.message}${seen}`);
    }
    if (w.length > CAP) console.log(`WARN  [${check}] … ${w.length - CAP} more warnings (use --verbose)`);
  }
  console.log('\n-- stats');
  for (const [k, v] of Object.entries(summary)) console.log(`   ${k}: ${JSON.stringify(v)}`);
  console.log(`\nSUMMARY errors=${errors} warnings=${warnings} time=${((Date.now() - t0) / 1000).toFixed(1)}s → ${errors ? 'FAIL' : 'PASS'}`);
  if (args.json) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, 'check.json'), JSON.stringify({ summary, errors, warnings, results }, null, 2));
  }
  process.exit(errors ? 1 : 0);
}

main().catch((e) => { console.error('ERROR [harness] crashed:', e && e.stack ? e.stack : e); process.exit(2); });
