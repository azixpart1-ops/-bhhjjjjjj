#!/usr/bin/env node
// Shopify-flavoured Liquid renderer for the Lunova theme, on liquidjs.
//
//   import { ThemeRenderer } from './render.mjs'
//   const r = new ThemeRenderer({ themeDir, store })
//   const { html, status, issues } = r.renderPage(route, { cart })
//
// CLI:  node render.mjs /products/coniston-orthopaedic-dog-bed [--empty | --real] [--out file.html]
//       node render.mjs /cart --section cart-drawer
//
// Fidelity notes (what Shopify does that we emulate):
//  - render: isolated scope (globals only + params); include: shared scope.
//  - Errors inside a node render "Liquid error (file line N): msg" inline and
//    rendering continues, like Shopify. Parse errors fail the whole file.
//  - Unknown filters/tags, missing snippets/sections/assets/translations are
//    recorded as issues (kind + file + line) for check.mjs / the dev server.
//  - Ruby number semantics: integer division unless a float is involved.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { liquidjs, ColorDrop, RFloat, makeFont } from './lib/drops.mjs';
import { createShopifyFilters, KEEP_BUILTINS, SHOPIFY_FILTERS, DEPRECATED_FILTERS, safeJson } from './lib/filters.mjs';
import { createStore, keyed } from './fixtures/store.mjs';
import { resolveRoute } from './lib/routes.mjs';
import { cartDrop, cartJson, createCart } from './lib/cart.mjs';
import {
  DEFAULT_THEME_DIR, Issues, readText, mtime, exists, listFiles, stripJsonComment, deepMerge, getPath,
  escapeHtml, setThemeRootForRel, relTheme, parseArgs, formatIssue, stripHtml,
} from './lib/util.mjs';

const { Liquid, Tag, Hash, Drop, TypeGuards, Tokenizer, evalToken, evalQuotedToken, toValue } = liquidjs;

// Ruby keeps literal floats as floats (7.0 | divided_by: 2 == 3.5). Box them so math filters know.
if (!Tokenizer.prototype.__rfloatPatched) {
  const readNumber = Tokenizer.prototype.readNumber;
  Tokenizer.prototype.readNumber = function () {
    const t = readNumber.call(this);
    if (t && t.getText().includes('.')) t.content = new RFloat(t.content);
    return t;
  };
  Tokenizer.prototype.__rfloatPatched = true;
}

const cleanMsg = (m) => String(m).split(', line:')[0].replace(/, file:\S+$/, '');

export const TEMPLATE_ID = '24601';
export const sectionIdForTemplate = (key) => `template--${TEMPLATE_ID}__${key}`;
export function groupId(groupName) {
  let h = 0;
  for (const c of groupName) h = (h * 31 + c.charCodeAt(0)) % 9000;
  return `sections--${30000 + h}`;
}
export const sectionIdForGroup = (group, key) => `${groupId(group)}__${key}`;

class TemplateDrop extends Drop {
  constructor(name, suffix, directory) {
    super();
    this.name = name;
    this.suffix = suffix || null;
    this.directory = directory || null;
  }
  valueOf() { return `${this.directory ? this.directory + '/' : ''}${this.name}${this.suffix ? '.' + this.suffix : ''}`; }
  toString() { return this.valueOf(); }
  toJSON() { return this.valueOf(); }
}

class VideoUrlDrop extends Drop {
  constructor(url) {
    super();
    this.url = url;
    const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
    const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    this.type = yt ? 'youtube' : vm ? 'vimeo' : null;
    this.id = yt ? yt[1] : vm ? vm[1] : null;
  }
  valueOf() { return this.url; }
  toString() { return this.url; }
}

class RenderTimeout extends Error {}

const SETTING_TYPES_NO_VALUE = new Set(['header', 'paragraph']);

/** Text outside the tag markers of a schema-like block, used for raw-capture tags. */
function captureRaw(tagToken, remainTokens, endName) {
  let raw = '';
  while (remainTokens.length) {
    const t = remainTokens.shift();
    if (TypeGuards.isTagToken(t) && t.name === endName) return raw;
    raw += t.getText();
  }
  throw new Error(`tag ${tagToken.getText()} not closed`);
}

function parseBlock(parser, remainTokens, token, endName, onTag = {}) {
  const templates = [];
  let closed = false;
  const stream = parser.parseStream(remainTokens)
    .on(`tag:${endName}`, () => { closed = true; stream.stop(); })
    .on('template', (tpl) => templates.push(tpl))
    .on('end', () => { if (!closed) throw new Error(`tag ${token.getText()} not closed`); });
  for (const [k, fn] of Object.entries(onTag)) stream.on(`tag:${k}`, fn);
  stream.start();
  return templates;
}

function propPath(token) {
  if (!TypeGuards.isPropertyAccessToken(token)) return null;
  const parts = [];
  for (const p of token.props) {
    if (p.constructor.name === 'IdentifierToken' || TypeGuards.isQuotedToken(p)) parts.push(p.content);
    else return null;
  }
  return parts;
}

function replaceAtPath(root, props, value) {
  if (!props.length) return value;
  const [head, ...rest] = props;
  const base = root && typeof root === 'object' ? root : {};
  const copy = Array.isArray(base) ? [...base] : { ...base };
  if (base && typeof base.toJSON === 'function') Object.defineProperty(copy, 'toJSON', { value: base.toJSON, enumerable: false });
  copy[head] = replaceAtPath(base[head], rest, value);
  return copy;
}

function lineOf(loc) {
  if (!loc) return null;
  if (loc.line) return loc.line;
  if (loc.token) { try { loc.line = loc.token.getPosition()[0]; } catch { loc.line = null; } return loc.line; }
  return null;
}

function stringifyOut(v) {
  v = toValue(v);
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(stringifyOut).join('');
  return String(v);
}

export class ThemeRenderer {
  constructor({ themeDir = DEFAULT_THEME_DIR, store = createStore(), origin = 'http://localhost:9292', timeoutMs = 10000 } = {}) {
    this.themeDir = path.resolve(themeDir);
    setThemeRootForRel(this.themeDir);
    this.store = store;
    this.origin = origin;
    this.timeoutMs = timeoutMs;
    this.parseCache = new Map();
    this.sectionCache = new Map();
    this.cur = null;
    this.engine = this.createEngine();
    this.systemTranslations = loadSystemTranslations();
  }

  // ---------------------------------------------------------------- engine
  createEngine() {
    const R = this;
    const engine = new Liquid({
      root: [this.themeDir], extname: '', cache: false, dynamicPartials: true, strictFilters: false, strictVariables: false,
      ownPropertyOnly: true, greedy: true, jsTruthy: false, lenientIf: false, outputEscape: undefined, keepOutputType: false,
    });

    // Filters: keep only Shopify-valid builtins, add Shopify ones, record unknowns.
    const builtins = engine.filters;
    const allowed = {};
    for (const n of KEEP_BUILTINS) if (builtins[n]) allowed[n] = builtins[n];
    Object.assign(allowed, createShopifyFilters(this.filterEnv()));
    const unknownCache = new Map();
    engine.filters = new Proxy(allowed, {
      get(target, key) {
        if (typeof key !== 'string') return target[key];
        if (key in target) {
          if (DEPRECATED_FILTERS.has(key) && !['img_url', 'img_tag', 'hex_to_rgba', 'currency_selector'].includes(key)) {
            return function (...a) { R.issue('warn', 'deprecated-filter', `${key} is deprecated`); return target[key].apply(this, a); };
          }
          return target[key];
        }
        if (!unknownCache.has(key)) {
          unknownCache.set(key, function (v) {
            if (SHOPIFY_FILTERS.has(key)) R.issue('warn', 'unimplemented-filter', `filter "${key}" is valid Shopify but not emulated by the harness (value passed through)`);
            else R.issue('error', 'unknown-filter', `unknown filter "${key}" (not a Shopify filter)`);
            return v;
          });
        }
        return unknownCache.get(key);
      },
      has(target, key) { return true; },
    });

    // Tags: drop non-Shopify liquidjs tags, add Shopify ones.
    for (const t of ['layout', 'block', 'render', 'include']) delete engine.tags[t];
    this.installTags(engine);

    // Error isolation: a failing node renders a Shopify-style inline error.
    const renderer = engine.renderer;
    renderer.renderTemplates = function* (templates, ctx, emitter) {
      const own = !emitter;
      if (own) emitter = { buffer: '', write(h) { this.buffer += stringifyOut(h); } };
      for (const tpl of templates) {
        if (R.cur && Date.now() > R.cur.deadline) throw new RenderTimeout('render timed out (infinite loop?)');
        const prev = R.cur ? R.cur.loc : null;
        // Line numbers are computed lazily (getPosition scans the file) — only when an issue is recorded.
        if (R.cur && tpl.token && tpl.token.file) R.cur.loc = { file: tpl.token.file, token: tpl.token };
        try {
          const html = yield tpl.render(ctx, emitter);
          if (html) emitter.write(html);
          if (ctx.breakCalled || ctx.continueCalled) break;
        } catch (e) {
          if (e instanceof RenderTimeout) throw e;
          const orig = e.originalError || e;
          const msg = String(orig && orig.message ? orig.message : e).split(', line:')[0];
          const loc = R.cur ? R.cur.loc : null;
          R.issue('error', 'liquid-error', msg);
          emitter.write(`Liquid error (${loc && loc.file ? relTheme(loc.file).replace(/\.liquid$/, '') : 'unknown'} line ${lineOf(loc) || '?'}): ${escapeHtml(msg)}`);
        } finally {
          if (R.cur) R.cur.loc = prev;
        }
      }
      return own ? emitter.buffer : emitter.buffer;
    };
    return engine;
  }

  filterEnv() {
    const R = this;
    return {
      get images() { return R.store.images; },
      get shop() { return R.store.shop; },
      issue: (level, kind, msg) => R.issue(level, kind, msg),
      translate: (key, named) => R.translate(key, named),
      asset: (name) => {
        const f = path.join(R.themeDir, 'assets', name);
        const f2 = `${f}.liquid`;
        const ok = exists(f) || exists(f2);
        return { exists: ok, version: Math.round((mtime(f) || mtime(f2) || 0) / 1000) };
      },
      assetContent: (name) => {
        const t = readText(path.join(R.themeDir, 'assets', name));
        if (t == null) R.issue('error', 'missing-asset', `inline_asset_content: assets/${name} does not exist`);
        return t || '';
      },
      dateFormat: (name) => getPath(R.locale(), `date_formats.${name}`) || null,
      currentCollectionPath: () => (R.cur && R.cur.route && R.cur.route.collection ? `/collections/${R.cur.route.collection.handle}` : '/collections/all'),
    };
  }

  installTags(engine) {
    const R = this;

    // {% render 'name', key: value %} / with / for / as — isolated scope.
    class RenderTag extends Tag {
      constructor(token, remainTokens, liquid, parser) {
        super(token, remainTokens, liquid);
        const tk = this.tokenizer;
        this.fileToken = tk.readValue();
        if (!this.fileToken) throw new Error(`illegal render tag: ${token.getText()}`);
        parseWithFor(this, tk);
        this.hash = new Hash(tk, liquid.options.keyValueSeparator);
        this.isInclude = false;
      }
      *render(ctx, emitter) {
        let name;
        if (TypeGuards.isQuotedToken(this.fileToken)) name = evalQuotedToken(this.fileToken);
        else {
          const v = yield evalToken(this.fileToken, ctx);
          if (v && typeof v === 'object' && 'type' in v && 'id' in v) {
            // {% render block %} — app/theme block.
            emitter.write(`<div id="shopify-block-${escapeHtml(v.id)}" class="shopify-app-block" data-theme-dev-app-block="${escapeHtml(v.type)}"></div>`);
            return;
          }
          R.issue('error', 'liquid-syntax', `${this.isInclude ? 'include' : 'render'} needs a string literal snippet name (got "${this.fileToken.getText()}")`);
          return;
        }
        const templates = R.loadSnippet(name);
        if (!templates) {
          emitter.write(R.inlineError(`Could not find asset snippets/${name}.liquid`));
          return;
        }
        if (this.isInclude) {
          R.issue('warn', 'deprecated-include', `include is deprecated — use render (snippets/${name})`);
          const scope = yield this.hash.render(ctx);
          if (this.with) scope[this.with.alias || name] = yield evalToken(this.with.value, ctx);
          ctx.push(scope);
          try { yield liquidRender(R, templates, ctx, emitter, name); } finally { ctx.pop(); }
          return;
        }
        const childCtx = ctx.spawn();
        const scope = childCtx.bottom();
        Object.assign(scope, yield this.hash.render(ctx));
        if (this.with) scope[this.with.alias || name] = yield evalToken(this.with.value, ctx);
        if (this.forBinding) {
          const { value, alias } = this.forBinding;
          let coll = yield evalToken(value, ctx);
          coll = coll == null ? [] : Array.isArray(coll) ? coll : (typeof coll === 'object' && coll[Symbol.iterator]) ? [...coll] : [coll];
          const ForloopDrop = makeForloop(coll.length, value.getText(), alias);
          scope.forloop = ForloopDrop;
          for (const item of coll) {
            scope[alias || name] = item;
            yield liquidRender(R, templates, childCtx, emitter, name);
            ForloopDrop.next();
          }
          return;
        }
        yield liquidRender(R, templates, childCtx, emitter, name);
      }
    }
    class IncludeTag extends RenderTag {
      constructor(...a) { super(...a); this.isInclude = true; }
    }
    function parseWithFor(self, tk) {
      while (!tk.end()) {
        tk.skipBlank();
        const begin = tk.p;
        const kw = tk.readIdentifier();
        if (kw.content === 'with' || kw.content === 'for') {
          tk.skipBlank();
          if (tk.peek() !== ':') {
            const value = tk.readValue();
            if (value) {
              const beforeAs = tk.p;
              const asStr = tk.readIdentifier();
              let alias;
              if (asStr.content === 'as') alias = tk.readIdentifier().content;
              else tk.p = beforeAs;
              if (kw.content === 'with') self.with = { value, alias };
              else self.forBinding = { value, alias };
              tk.skipBlank();
              if (tk.peek() === ',') tk.advance();
              continue;
            }
          }
        }
        tk.p = begin;
        break;
      }
      tk.skipBlank();
      if (tk.peek() === ',') tk.advance();
    }
    function makeForloop(length, collName, alias) {
      const d = { index0: 0, length, name: `${alias}-${collName}` };
      Object.defineProperties(d, {
        index: { get() { return this.index0 + 1; }, enumerable: true },
        rindex: { get() { return this.length - this.index0; }, enumerable: true },
        rindex0: { get() { return this.length - this.index0 - 1; }, enumerable: true },
        first: { get() { return this.index0 === 0; }, enumerable: true },
        last: { get() { return this.index0 === this.length - 1; }, enumerable: true },
        next: { value() { this.index0++; }, enumerable: false },
      });
      return d;
    }
    engine.registerTag('render', RenderTag);
    engine.registerTag('include', IncludeTag);

    // {% section 'name' %} — static section.
    engine.registerTag('section', class extends Tag {
      constructor(token, remainTokens, liquid) {
        super(token, remainTokens, liquid);
        this.nameToken = this.tokenizer.readValue();
        if (!this.nameToken || !TypeGuards.isQuotedToken(this.nameToken)) throw new Error('section tag needs a quoted section name');
      }
      *render(ctx, emitter) {
        const name = evalQuotedToken(this.nameToken);
        if (R.cur && R.cur.loc && /\/(sections|snippets|blocks)\//.test(R.cur.loc.file || '')) R.issue('error', 'liquid-syntax', `{% section '${name}' %} is only allowed in layouts and .liquid templates`);
        emitter.write(R.renderStaticSection(name));
      }
    });

    // {% sections 'header-group' %}
    engine.registerTag('sections', class extends Tag {
      constructor(token, remainTokens, liquid) {
        super(token, remainTokens, liquid);
        this.nameToken = this.tokenizer.readValue();
        if (!this.nameToken || !TypeGuards.isQuotedToken(this.nameToken)) throw new Error('sections tag needs a quoted group name');
      }
      *render(ctx, emitter) { emitter.write(R.renderGroup(evalQuotedToken(this.nameToken))); }
    });

    // Raw capture tags.
    engine.registerTag('schema', class extends Tag {
      constructor(token, remainTokens, liquid) { super(token, remainTokens, liquid); this.raw = captureRaw(token, remainTokens, 'endschema'); }
      render() { return ''; }
    });
    for (const [name, end] of [['stylesheet', 'endstylesheet'], ['javascript', 'endjavascript']]) {
      engine.registerTag(name, class extends Tag {
        constructor(token, remainTokens, liquid) {
          super(token, remainTokens, liquid);
          this.raw = captureRaw(token, remainTokens, end);
        }
        render() { return ''; }
      });
    }
    engine.registerTag('doc', class extends Tag {
      constructor(token, remainTokens, liquid) { super(token, remainTokens, liquid); captureRaw(token, remainTokens, 'enddoc'); }
      render() { return ''; }
    });

    // {% style %} renders Liquid inside a <style data-shopify> element.
    engine.registerTag('style', class extends Tag {
      constructor(token, remainTokens, liquid, parser) { super(token, remainTokens, liquid); this.templates = parseBlock(parser, remainTokens, token, 'endstyle'); }
      *render(ctx, emitter) {
        emitter.write('<style data-shopify>');
        yield liquid_r(this.liquid, this.templates, ctx, emitter);
        emitter.write('</style>');
      }
    });

    // {% layout none %} / {% layout 'password' %}
    engine.registerTag('layout', class extends Tag {
      constructor(token, remainTokens, liquid) {
        super(token, remainTokens, liquid);
        const v = this.tokenizer.readValue();
        this.value = !v ? undefined : v.getText() === 'none' ? null : TypeGuards.isQuotedToken(v) ? evalQuotedToken(v) : v.getText();
      }
      render() { if (R.cur) R.cur.layout = this.value; return ''; }
    });

    // {% form 'type', object, attr: value %} ... {% endform %}
    engine.registerTag('form', class extends Tag {
      constructor(token, remainTokens, liquid, parser) {
        super(token, remainTokens, liquid);
        const tk = this.tokenizer;
        this.typeToken = tk.readValue();
        if (!this.typeToken) throw new Error('form tag needs a form type');
        tk.skipBlank();
        if (tk.peek() === ',') tk.advance();
        tk.skipBlank();
        const save = tk.p;
        const maybe = tk.readValue();
        tk.skipBlank();
        if (maybe && tk.peek() !== ':') {
          this.objToken = maybe;
          if (tk.peek() === ',') tk.advance();
        } else tk.p = save;
        this.hash = new Hash(tk, liquid.options.keyValueSeparator);
        this.templates = parseBlock(parser, remainTokens, token, 'endform');
      }
      *render(ctx, emitter) {
        const type = String(toValue(yield evalToken(this.typeToken, ctx)));
        const obj = this.objToken ? yield evalToken(this.objToken, ctx) : null;
        const attrsIn = yield this.hash.render(ctx);
        const f = R.formSetup(type, obj, attrsIn);
        emitter.write(f.open);
        ctx.push({ form: f.form });
        try { yield liquid_r(this.liquid, this.templates, ctx, emitter); } finally { ctx.pop(); }
        emitter.write('</form>');
      }
    });

    // {% paginate collection.products by 12, window_size: 3 %}
    engine.registerTag('paginate', class extends Tag {
      constructor(token, remainTokens, liquid, parser) {
        super(token, remainTokens, liquid);
        const tk = this.tokenizer;
        this.collToken = tk.readValue();
        const by = tk.readIdentifier();
        if (!this.collToken || by.content !== 'by') throw new Error(`paginate syntax: ${token.getText()}`);
        this.byToken = tk.readValue();
        tk.skipBlank();
        if (tk.peek() === ',') tk.advance();
        this.hash = new Hash(tk, liquid.options.keyValueSeparator);
        this.templates = parseBlock(parser, remainTokens, token, 'endpaginate');
      }
      *render(ctx, emitter) {
        const size = Number(toValue(yield evalToken(this.byToken, ctx)));
        const opts = yield this.hash.render(ctx);
        let coll = yield evalToken(this.collToken, ctx);
        if (!(size >= 1 && size <= 250)) R.issue('error', 'liquid-error', `paginate: page size must be 1–250 (got ${size}); Shopify caps collection pages at 50 products and 250 per pagination`);
        const per = Math.max(1, Math.min(250, size || 1));
        if (per > 50 && /products/.test(this.collToken.getText())) R.issue('warn', 'paginate-size', `paginate by ${per}: Shopify returns at most 50 products per page`);
        // collection.products / search.results hold 50 items outside paginate (see shopifyLimited); paginate sees them all.
        const full = coll && Array.isArray(coll._all) ? coll._all : coll;
        const arr = full == null ? [] : Array.isArray(full) ? full : (typeof full === 'object' && full[Symbol.iterator]) ? [...full] : [];
        if (coll == null) R.issue('warn', 'paginate-nil', `paginate: "${this.collToken.getText()}" is nil`);
        const pg = R.paginate(arr.length, per, Number(opts.window_size) || 2);
        const slice = arr.slice(pg.current_offset, pg.current_offset + per);
        const props = propPath(this.collToken);
        const scope = { paginate: pg };
        if (props && props.length) {
          const root = yield ctx._get([props[0]]);
          scope[props[0]] = props.length === 1 ? slice : replaceAtPath(root, props.slice(1), slice);
        }
        ctx.push(scope);
        try { yield liquid_r(this.liquid, this.templates, ctx, emitter); } finally { ctx.pop(); }
      }
    });

    // {% content_for 'blocks' %} / {% content_for 'block', type: 'x', id: 'y' %} (theme blocks, basic)
    engine.registerTag('content_for', class extends Tag {
      constructor(token, remainTokens, liquid) {
        super(token, remainTokens, liquid);
        const tk = this.tokenizer;
        this.kindToken = tk.readValue();
        tk.skipBlank();
        if (tk.peek() === ',') tk.advance();
        this.hash = new Hash(tk, liquid.options.keyValueSeparator);
      }
      *render(ctx, emitter) {
        const kind = String(toValue(yield evalToken(this.kindToken, ctx)));
        const h = yield this.hash.render(ctx);
        const section = yield ctx._get(['section']);
        if (kind === 'blocks') {
          for (const b of (section && section.blocks) || []) emitter.write(R.renderThemeBlock(b, section));
        } else if (kind === 'block') {
          emitter.write(R.renderThemeBlock({ id: h.id || 'static', type: h.type, settings: {}, shopify_attributes: '' }, section));
        } else R.issue('error', 'liquid-syntax', `content_for: unknown kind "${kind}"`);
      }
    });

    function liquid_r(liquid, templates, ctx, emitter) { return liquid.renderer.renderTemplates(templates, ctx, emitter); }
    function liquidRender(r, templates, ctx, emitter, name) {
      r.cur.depth = (r.cur.depth || 0) + 1;
      if (r.cur.depth > 60) { r.issue('error', 'liquid-error', `render depth exceeded at snippets/${name} (recursive render?)`); r.cur.depth--; return ''; }
      const g = engine.renderer.renderTemplates(templates, ctx, emitter);
      return (function* () { try { return yield g; } finally { r.cur.depth--; } })();
    }
  }

  // ------------------------------------------------------------- issues
  issue(level, kind, message, where = null) {
    if (!this.cur) return;
    const loc = where || this.cur.loc || {};
    this.cur.issues.add(level, kind, message, { file: loc.file, line: lineOf(loc), extra: this.cur.tag ? { page: this.cur.tag } : undefined });
  }

  inlineError(msg) {
    const loc = this.cur && this.cur.loc;
    this.issue('error', /Could not find asset snippets/.test(msg) ? 'missing-snippet' : /sections\//.test(msg) ? 'missing-section' : 'liquid-error', msg);
    return `Liquid error (${loc && loc.file ? relTheme(loc.file).replace(/\.liquid$/, '') : 'unknown'} line ${lineOf(loc) || '?'}): ${escapeHtml(msg)}`;
  }

  // ---------------------------------------------------------- parse cache
  /** mtime, memoised for the duration of one render (files don't change mid-render). */
  stat(abs) {
    const c = this.cur && this.cur.stats;
    if (c && c.has(abs)) return c.get(abs);
    const m = mtime(abs);
    if (c) c.set(abs, m);
    return m;
  }

  parseFile(abs) {
    const m = this.stat(abs);
    if (!m) return { templates: null, missing: true };
    const hit = this.parseCache.get(abs);
    if (hit && hit.mtime === m) {
      if (hit.error && this.cur) this.issue('error', 'liquid-syntax', hit.error, { file: abs, line: hit.line });
      return hit;
    }
    const src = readText(abs);
    let entry;
    try {
      entry = { mtime: m, templates: this.engine.parse(src, abs), src };
    } catch (e) {
      const msg = cleanMsg(e.message || e);
      let line = null;
      try { line = e.token ? e.token.getPosition()[0] : null; } catch { /* ignore */ }
      entry = { mtime: m, templates: null, error: msg, line, src };
    }
    this.parseCache.set(abs, entry);
    if (entry.error && this.cur) this.issue('error', 'liquid-syntax', entry.error, { file: abs, line: entry.line });
    return entry;
  }

  loadSnippet(name) {
    const abs = path.join(this.themeDir, 'snippets', `${name}.liquid`);
    const e = this.parseFile(abs);
    if (e.missing) return null;
    if (!e.templates) return [];
    return e.templates;
  }

  /** Section file + parsed schema. */
  loadSection(type) {
    const abs = path.join(this.themeDir, 'sections', `${type}.liquid`);
    const e = this.parseFile(abs);
    if (e.missing) return { exists: false, file: abs };
    let cached = this.sectionCache.get(abs);
    if (!cached || cached.mtime !== e.mtime) {
      const m = (e.src || '').match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/);
      let schema = null; let schemaError = null;
      if (!m) schemaError = 'no {% schema %} tag';
      else {
        try { schema = JSON.parse(m[1]); } catch (err) { schemaError = `invalid schema JSON: ${err.message}`; }
      }
      cached = { mtime: e.mtime, schema, schemaError };
      this.sectionCache.set(abs, cached);
    }
    if (cached.schemaError && this.cur) this.issue('error', 'schema', cached.schemaError, { file: abs, line: null });
    return { exists: true, file: abs, templates: e.templates, schema: cached.schema || {}, schemaError: cached.schemaError };
  }

  // --------------------------------------------------------------- locale
  locale() {
    if (this.cur && this.cur.localeReady && this._locale) return this._locale;
    if (this.cur) this.cur.localeReady = true;
    const dir = path.join(this.themeDir, 'locales');
    const main = path.join(dir, 'en.default.json');
    const parts = listFiles(path.join(dir, '_parts'), { ext: ['.json'] });
    const key = [mtime(main), ...parts.map(mtime)].join('|');
    if (this._locale && this._localeKey === key) return this._locale;
    let data = {};
    let source = 'none';
    if (exists(main)) {
      try { data = JSON.parse(stripJsonComment(readText(main))); source = 'en.default.json'; } catch (e) { data = {}; source = `en.default.json (INVALID: ${e.message})`; }
    } else if (parts.length) {
      for (const p of parts) {
        try { deepMerge(data, JSON.parse(readText(p))); } catch { /* reported by check */ }
      }
      source = `locales/_parts/*.json (${parts.length} parts merged; en.default.json missing)`;
    }
    this._locale = data; this._localeKey = key; this.localeSource = source;
    return data;
  }

  translate(key, named = {}) {
    let v = getPath(this.locale(), key);
    if (v == null && key.startsWith('shopify.') && this.systemTranslations) v = this.systemTranslations[key] ?? getPath(this.systemTranslations, key);
    if (v == null) {
      this.issue('error', 'missing-translation', `translation missing: en.${key}`);
      return `translation missing: en.${key}`;
    }
    if (typeof v === 'object') {
      const count = named.count != null ? Number(toValue(named.count)) : null;
      let pick = null;
      if (count != null) pick = count === 0 && v.zero != null ? v.zero : count === 1 && v.one != null ? v.one : v.other;
      if (pick == null) {
        this.issue('error', 'missing-translation', `translation en.${key} is a group, not a string${count == null ? ' (pluralised key used without count:)' : ''}`);
        return `translation missing: en.${key}`;
      }
      v = pick;
    }
    const out = String(v).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, k) => {
      if (k in named) return stringifyOut(named[k]);
      this.issue('warn', 'translation-arg', `translation en.${key} uses {{ ${k} }} but it was not passed`);
      return '';
    });
    // Shopify HTML-escapes translations whose key doesn't end in _html (& < > " ' → &amp; … &#39;).
    // Seen on the live store: "Your dog's name" | t | json → "Your dog&#39;s name".
    return /_html$/.test(key) ? out : escapeHtml(out);
  }

  // ------------------------------------------------------------- settings
  settingsSchema() {
    const f = path.join(this.themeDir, 'config', 'settings_schema.json');
    const t = readText(f);
    if (t == null) return [];
    try { return JSON.parse(t); } catch { return []; }
  }

  settingsData() {
    const f = path.join(this.themeDir, 'config', 'settings_data.json');
    const t = readText(f);
    if (t == null) return { current: {} };
    try {
      const d = JSON.parse(stripJsonComment(t));
      let current = d.current;
      if (typeof current === 'string') current = (d.presets && d.presets[current]) || {};
      return { ...d, current: current || {} };
    } catch { return { current: {} }; }
  }

  globalSettings() {
    const key = [mtime(path.join(this.themeDir, 'config', 'settings_schema.json')), mtime(path.join(this.themeDir, 'config', 'settings_data.json')), this.store.mode || this.store.empty].join('|');
    if (this._settings && this._settingsKey === key) return this._settings;
    const defs = this.settingsSchema().flatMap((g) => (Array.isArray(g.settings) ? g.settings : []));
    const current = this.settingsData().current || {};
    const out = {};
    for (const d of defs) {
      if (!d.id || SETTING_TYPES_NO_VALUE.has(d.type)) continue;
      const has = Object.prototype.hasOwnProperty.call(current, d.id);
      out[d.id] = this.resolveSetting(d, has ? current[d.id] : d.default, has || d.default !== undefined);
    }
    for (const [k, v] of Object.entries(current)) {
      if (['sections', 'content_for_index', 'blocks'].includes(k) || k in out) continue;
      out[k] = v;
    }
    this._settings = out; this._settingsKey = key;
    return out;
  }

  resolveSetting(def, raw, hasValue = true) {
    const s = this.store;
    const t = def.type;
    if (!hasValue || raw === undefined) raw = null;
    switch (t) {
      case 'checkbox': return raw === true || raw === 'true';
      case 'number': return raw === null || raw === '' ? null : Number(raw);
      case 'range': {
        if (raw === null || raw === '') return null;
        const n = Number(raw);
        return def.step && !Number.isInteger(Number(def.step)) ? new RFloat(n) : n;
      }
      case 'image_picker': return raw ? s.images.fromSetting(raw) : null;
      case 'video': return null;
      case 'product': return raw ? s.productByHandle(String(raw)) : null;
      case 'product_list': return Array.isArray(raw) ? raw.map((h) => s.productByHandle(h)).filter(Boolean) : [];
      case 'collection': return raw ? s.collectionView(String(raw)) : null;
      case 'collection_list': return Array.isArray(raw) ? raw.map((h) => s.collectionView(h)).filter(Boolean) : [];
      case 'page': return raw ? s.pageByHandle(String(raw)) : null;
      case 'blog': return raw ? s.blogByHandle(String(raw)) : null;
      case 'article': {
        if (!raw) return null;
        const [b, a] = String(raw).split('/');
        const blog = s.blogByHandle(b);
        return blog ? blog.articles.find((x) => x.handle === a) || null : null;
      }
      case 'link_list': return raw ? s.linklists(this.cur && this.cur.route ? this.cur.route.path : null)[raw] || null : null;
      case 'url': return raw ? resolveUrlSetting(raw) : null;
      case 'video_url': return raw ? new VideoUrlDrop(String(raw)) : null;
      case 'font_picker': return raw ? makeFont(String(raw)) || makeFont(def.default) : null;
      case 'color': return raw ? new ColorDrop(String(raw)) : null;
      case 'metaobject': return null;
      case 'metaobject_list': return [];
      case 'liquid': return raw ? this.renderLiquidSetting(String(raw)) : null;
      default: return raw;
    }
  }

  renderLiquidSetting(src) {
    try { return this.engine.parseAndRenderSync(src, {}, { globals: this.cur ? this.cur.globals : {} }); } catch (e) { this.issue('error', 'liquid-error', `liquid setting: ${e.message}`); return ''; }
  }

  sectionSettings(schemaSettings, raw = {}) {
    const out = {};
    for (const d of schemaSettings || []) {
      if (!d || !d.id || SETTING_TYPES_NO_VALUE.has(d.type)) continue;
      const has = raw && Object.prototype.hasOwnProperty.call(raw, d.id);
      out[d.id] = this.resolveSetting(d, has ? raw[d.id] : d.default, has || d.default !== undefined);
    }
    for (const [k, v] of Object.entries(raw || {})) if (!(k in out)) out[k] = v;
    return out;
  }

  /** Build the Liquid `section` object. data = {settings, blocks, block_order} (template/group/settings_data shape). */
  buildSection(id, type, data, { location, index } = {}) {
    const sec = this.loadSection(type);
    const schema = sec.schema || {};
    const blockDefs = Array.isArray(schema.blocks) ? schema.blocks : [];
    const blocks = [];
    const order = Array.isArray(data.block_order) ? data.block_order : Object.keys(data.blocks || {});
    for (const bid of order) {
      const b = data.blocks && data.blocks[bid];
      if (!b) { this.issue('error', 'template', `section "${id}" block_order references missing block "${bid}"`, { file: sec.file }); continue; }
      if (b.disabled) continue;
      if (String(b.type).startsWith('shopify://apps/')) {
        if (!blockDefs.some((d) => d.type === '@app')) this.issue('error', 'template', `app block "${bid}" in section "${type}" but schema has no @app block`, { file: sec.file });
        blocks.push({ id: bid, type: '@app', settings: b.settings || {}, shopify_attributes: '' });
        continue;
      }
      const def = blockDefs.find((d) => d.type === b.type);
      if (!def) { this.issue('error', 'template', `block type "${b.type}" not in sections/${type}.liquid schema`, { file: sec.file }); continue; }
      blocks.push({ id: bid, type: b.type, settings: this.sectionSettings(def.settings, b.settings || {}), shopify_attributes: '' });
    }
    const section = {
      id,
      settings: this.sectionSettings(schema.settings, data.settings || {}),
      blocks,
      location: location || 'template',
    };
    if (index != null) { section.index = index; section.index0 = index - 1; }
    return { section, sec, schema };
  }

  renderSectionObject(section, sec, schema, { groupClass = '' } = {}) {
    if (!sec.exists) return this.inlineError(`Error: section file 'sections/${path.basename(sec.file)}' does not exist`);
    let inner = '';
    if (sec.templates) {
      const prevLoc = this.cur.loc;
      try {
        inner = this.engine.renderSync(sec.templates, { section }, { globals: this.cur.globals });
      } catch (e) {
        if (e instanceof RenderTimeout) throw e;
        inner = this.inlineError(String(e.message || e).split(', line:')[0]);
      } finally { this.cur.loc = prevLoc; }
    } else {
      inner = `Liquid syntax error (sections/${path.basename(sec.file)}): see issues`;
    }
    const tag = schema.tag && ['section', 'div', 'aside', 'header', 'footer', 'article'].includes(schema.tag) ? schema.tag : 'div';
    const cls = ['shopify-section', groupClass, schema.class].filter(Boolean).join(' ');
    return `<${tag} id="shopify-section-${escapeHtml(section.id)}" class="${escapeHtml(cls)}">${inner}</${tag}>`;
  }

  /** Static section ({% section 'x' %} or Section Rendering of a file name). */
  renderStaticSection(name) {
    const data = (this.settingsData().current.sections || {})[name];
    const sec = this.loadSection(name);
    let d = data;
    if (!d) {
      const def = (sec.schema && sec.schema.default) || {};
      const blocks = {}; const order = [];
      (def.blocks || []).forEach((b, i) => { const bid = `${name}-${i}`; blocks[bid] = b; order.push(bid); });
      d = { settings: def.settings || {}, blocks, block_order: order };
    }
    const { section, schema } = this.buildSection(name, name, d, { location: 'static' });
    return this.renderSectionObject(section, sec, schema);
  }

  loadGroup(name) {
    const f = path.join(this.themeDir, 'sections', `${name}.json`);
    const t = readText(f);
    if (t == null) return null;
    try { return JSON.parse(stripJsonComment(t)); } catch (e) { this.issue('error', 'json', `sections/${name}.json: ${e.message}`, { file: f }); return null; }
  }

  renderGroup(name) {
    const g = this.loadGroup(name);
    if (!g) return this.inlineError(`Error: section group 'sections/${name}.json' does not exist`);
    const out = [];
    let i = 0;
    for (const key of g.order || []) {
      const s = g.sections && g.sections[key];
      if (!s) { this.issue('error', 'template', `sections/${name}.json order lists missing section "${key}"`); continue; }
      if (s.disabled) continue;
      i++;
      const id = sectionIdForGroup(name, key);
      const { section, sec, schema } = this.buildSection(id, s.type, s, { location: g.type || 'group', index: i });
      out.push(this.renderSectionObject(section, sec, schema, { groupClass: `shopify-section-group-${name}` }));
    }
    return out.join('\n');
  }

  renderThemeBlock(block, section) {
    const f = path.join(this.themeDir, 'blocks', `${block.type}.liquid`);
    const e = this.parseFile(f);
    if (e.missing || !e.templates) { this.issue('warn', 'theme-block', `content_for: blocks/${block.type}.liquid not found`); return ''; }
    return this.engine.renderSync(e.templates, { block, section }, { globals: this.cur.globals });
  }

  // ------------------------------------------------------------- forms
  formSetup(type, obj, a) {
    const q = this.cur.route ? this.cur.route.query : new URLSearchParams();
    const known = {
      product: { action: '/cart/add', enctype: 'multipart/form-data' },
      cart: { action: '/cart', id: 'cart' },
      contact: { action: '/contact#contact_form', id: 'contact_form', posted: 'contact_posted' },
      customer: { action: '/contact#contact_form', id: 'contact_form', posted: 'customer_posted' },
      create_customer: { action: '/account', id: 'create_customer' },
      customer_login: { action: '/account/login', id: 'customer_login' },
      guest_login: { action: '/account/login', id: 'customer_login_guest' },
      recover_customer_password: { action: '/account/recover', id: 'recover_customer_password' },
      activate_customer_password: { action: '/account/activate', id: 'activate_customer_password' },
      reset_customer_password: { action: '/account/reset', id: 'reset_customer_password' },
      customer_address: { action: obj && obj.id ? `/account/addresses/${obj.id}` : '/account/addresses', id: obj && obj.id ? `address_form_${obj.id}` : 'address_form_new' },
      localization: { action: '/localization', id: 'localization_form', enctype: 'multipart/form-data' },
      new_comment: { action: obj && obj.url ? `${obj.url}/comments` : '/comments', id: 'comment_form' },
      storefront_password: { action: '/password', id: 'login_form' },
      currency: { action: '/cart/update', id: 'currency_form' },
    };
    const k = known[type];
    if (!k) this.issue('error', 'liquid-syntax', `form: unknown form type "${type}"`);
    if (type === 'product' && (!obj || !obj.variants)) this.issue('error', 'liquid-error', 'form \'product\' needs a product object as its second argument');
    if (type === 'new_comment' && !obj) this.issue('error', 'liquid-error', 'form \'new_comment\' needs an article object');
    const id = a.id != null ? String(toValue(a.id)) : (k && k.id) || null;
    const attrs = { method: 'post', action: (k && k.action) || '/', id, 'accept-charset': 'UTF-8', class: a.class != null ? String(toValue(a.class)) : null, enctype: k && k.enctype };
    for (const [ak, av] of Object.entries(a)) if (!['id', 'class', 'return_to'].includes(ak)) attrs[ak] = av === true ? ak : stringifyOut(av);
    const attrStr = Object.entries(attrs).filter(([, v]) => v != null && v !== '').map(([kk, v]) => ` ${kk}="${escapeHtml(v)}"`).join('');
    let hidden = `<input type="hidden" name="form_type" value="${escapeHtml(type)}" /><input type="hidden" name="utf8" value="✓" />`;
    if (a.return_to) hidden += `<input type="hidden" name="return_to" value="${escapeHtml(stringifyOut(a.return_to))}" />`;
    if (type === 'product' && obj) hidden += `<input type="hidden" name="product-id" value="${obj.id}" />`;
    if (type === 'localization') hidden += `<input type="hidden" name="_method" value="put" /><input type="hidden" name="return_to" value="${escapeHtml(this.cur.route ? this.cur.route.path : '/')}" />`;
    if (type === 'customer_address' && obj && obj.id) hidden += '<input type="hidden" name="_method" value="put" />';
    const posted = !!(k && k.posted && q.get(k.posted) === 'true');
    const withErrors = q.get('form_errors') === type || q.get('form_errors') === '1';
    const errors = withErrors ? makeFormErrors() : null;
    const form = {
      id,
      form_type: type,
      errors,
      'posted_successfully?': posted,
      posted_successfully: posted,
      email: null, body: null, name: null, phone: null, first_name: null, last_name: null, author: null,
      password_needed: true,
      'password_needed?': true,
      product: type === 'product' ? obj : null,
      address1: obj && obj.address1, address2: obj && obj.address2, city: obj && obj.city, company: obj && obj.company,
      country: obj && obj.country, province: obj && obj.province, zip: obj && obj.zip, set_as_default_checkbox: '<input type="checkbox" id="address_default_address" name="address[default]" value="1">',
      current_country: { iso_code: 'GB', name: 'United Kingdom', currency: { iso_code: 'GBP', symbol: '£' } },
      current_locale: { iso_code: 'en', name: 'English', endonym_name: 'English' },
      available_countries: [{ iso_code: 'GB', name: 'United Kingdom', currency: { iso_code: 'GBP', symbol: '£', name: 'British Pound' } }],
      available_locales: [{ iso_code: 'en', name: 'English', endonym_name: 'English' }],
    };
    return { open: `<form${attrStr}>${hidden}`, form };
  }

  paginate(total, per, windowSize) {
    const route = this.cur.route;
    const pages = Math.max(1, Math.ceil(total / per));
    const current = Math.min(route ? route.currentPage : 1, Math.max(pages, 1));
    const urlFor = (n) => {
      const q = new URLSearchParams(route ? route.query : '');
      q.delete('section_id'); q.delete('sections');
      if (n === 1) q.delete('page'); else q.set('page', String(n));
      const s = q.toString();
      return `${route ? route.path : '/'}${s ? '?' + s : ''}`;
    };
    const parts = [];
    for (let n = 1; n <= pages; n++) {
      if (n === 1 || n === pages || Math.abs(n - current) <= windowSize) parts.push({ title: n, url: urlFor(n), is_link: n !== current });
      else if (parts.length && parts[parts.length - 1].title !== '&hellip;') parts.push({ title: '&hellip;', url: null, is_link: false });
    }
    return {
      current_offset: (current - 1) * per,
      current_page: current,
      items: total,
      page_size: per,
      pages,
      parts,
      previous: current > 1 ? { title: '&laquo; Previous', url: urlFor(current - 1), is_link: true } : null,
      next: current < pages ? { title: 'Next &raquo;', url: urlFor(current + 1), is_link: true } : null,
      page_param: 'page',
    };
  }

  // ------------------------------------------------------------ templates
  templateFile(route) {
    const dir = path.join(this.themeDir, 'templates', route.directory || '');
    const cands = [];
    if (route.suffix) cands.push(`${route.template}.${route.suffix}`);
    cands.push(route.template);
    for (const c of cands) {
      for (const ext of ['.json', '.liquid']) {
        const f = path.join(dir, c + ext);
        if (exists(f)) return { file: f, kind: ext.slice(1), name: c, usedSuffix: c !== route.template };
      }
    }
    return null;
  }

  // --------------------------------------------------------------- globals
  buildGlobals(route, cartState) {
    const s = this.store;
    const shopDrop = this.shopDrop();
    const cart = cartDrop(cartState || createCart(), s);
    cart.toJSON = function () { return cartJsonFromDrop(this); };
    const templateName = route.template;
    const customer = route.needsCustomer || route.loggedIn ? s.customerDrop() : null;
    const collection = route.collection || null;
    const product = route.product || null;
    const globals = {
      settings: this.globalSettings(),
      shop: shopDrop,
      request: {
        design_mode: false,
        visual_preview_mode: false,
        page_type: route.pageType,
        path: route.path,
        host: new URL(this.origin).host,
        origin: this.origin,
        locale: { iso_code: 'en', name: 'English', endonym_name: 'English', primary: true, root_url: '/' },
      },
      routes: ROUTES,
      localization: LOCALIZATION,
      cart,
      customer,
      template: new TemplateDrop(templateName, route.suffix && this.templateFile(route) && this.templateFile(route).usedSuffix ? route.suffix : null, route.directory),
      content_for_header: this.contentForHeader(),
      content_for_additional_checkout_buttons: '<div class="additional-checkout-buttons" data-theme-dev-mock="additional-checkout-buttons"><button type="button" class="shopify-payment-button__button" aria-disabled="true">Shop Pay</button></div>',
      additional_checkout_buttons: true,
      canonical_url: `${this.origin}${route.path}${route.currentPage > 1 ? `?page=${route.currentPage}` : ''}`,
      page_title: route.title || shopDrop.name,
      page_description: route.description || shopDrop.description,
      handle: route.handle || '',
      current_page: route.currentPage,
      current_tags: route.currentTags || null,
      linklists: s.linklists(route.path),
      collections: s.collectionsKeyed(),
      all_products: s.allProductsKeyed(),
      pages: keyed(s.pages),
      blogs: keyed(s.blogs),
      articles: keyed(s.blogs.flatMap((b) => b.articles.map((a) => ({ ...a, _key: `${b.handle}/${a.handle}` }))), (a) => a._key),
      images: keyed([...s.images.files.keys()].map((n) => s.images.image(n)), (i) => i.src.split('/').pop()),
      policies: s.policies,
      powered_by_link: '<a target="_blank" rel="nofollow" href="https://www.shopify.com?utm_campaign=poweredby&amp;utm_medium=shopify&amp;utm_source=onlinestore">Powered by Shopify</a>',
      scripts: {},
      metaobjects: {},
      product,
      collection,
      search: route.search || null,
      page: route.page || null,
      blog: route.blog || null,
      article: route.article || null,
      gift_card: route.giftCard || null,
      recommendations: route.recommendations || { performed: false, 'performed?': false, products: [], products_count: 0, intent: 'related' },
      predictive_search: route.predictive || { performed: false, terms: '', types: [], resources: { products: [], collections: [], pages: [], articles: [], queries: [] } },
      order: route.template === 'order' && customer ? customer.orders.find((o) => String(o.id) === String(route.orderId)) || customer.orders[0] : null,
      checkout: null,
      // liquidjs resolves an unknown bare variable against the globals object
      // itself, so `{{ size }}` would read the globals' key count (~40) and
      // `{{ first }}`/`{{ last }}` fall through the same way. Shopify returns nil.
      // Shadow them here; params, `assign` and loop vars still win (scopes are
      // searched before globals).
      size: null,
      first: null,
      last: null,
    };
    return globals;
  }

  shopDrop() {
    const s = this.store;
    const shop = s.shop;
    const policy = (h) => s.policies.find((p) => p.handle === h) || null;
    return {
      id: 87000000001,
      name: shop.name,
      email: shop.email,
      domain: shop.domain,
      url: `https://${shop.domain}`,
      secure_url: `https://${shop.domain}`,
      permanent_domain: shop.permanent_domain,
      money_format: shop.money_format,
      money_with_currency_format: shop.money_with_currency_format,
      currency: shop.currency,
      description: shop.description,
      enabled_payment_types: ['visa', 'master', 'american_express', 'paypal', 'apple_pay', 'google_pay', 'shopify_pay', 'klarna'],
      customer_accounts_enabled: true,
      customer_accounts_optional: true,
      locale: 'en',
      password_message: 'Opening soon — beds named for the Lakes, built for real sleep.',
      products_count: s.products().length,
      collections_count: s.collectionHandles().length,
      types: [...new Set(s.products().map((p) => p.type))],
      vendors: ['PawLunova'],
      metafields: {},
      policies: s.policies,
      refund_policy: policy('refund-policy'),
      privacy_policy: policy('privacy-policy'),
      shipping_policy: policy('shipping-policy'),
      terms_of_service: policy('terms-of-service'),
      contact_information: policy('contact-information'),
      subscription_policy: null,
      accepts_gift_cards: true,
      'accepts_gift_cards?': true,
      phone: '',
      address: { address1: '', city: 'Kendal', country: 'United Kingdom', country_code: 'GB', zip: '', summary: 'Kendal, United Kingdom' },
      brand: { logo: null, colors: {}, short_description: 'Orthopaedic dog beds', slogan: null },
      published_locales: [{ iso_code: 'en', name: 'English', primary: true, root_url: '/' }],
    };
  }

  contentForHeader() {
    const assets = this.compiledAssets();
    const shopify = `<script>window.Shopify = window.Shopify || {};Shopify.shop = ${JSON.stringify(this.store.shop.permanent_domain)};Shopify.locale = "en";Shopify.currency = {"active":"GBP","rate":"1.0"};Shopify.country = "GB";Shopify.theme = {"name":"Lunova","id":${TEMPLATE_ID},"role":"main"};Shopify.routes = Shopify.routes || {};Shopify.routes.root = "/";Shopify.designMode = false;</script>`;
    let out = `<!-- content_for_header (theme-dev mock) -->${shopify}`;
    if (assets.css) out += `<link rel="stylesheet" href="/compiled_assets/styles.css?v=${assets.version}">`;
    if (assets.js) out += `<script src="/compiled_assets/scripts.js?v=${assets.version}" defer></script>`;
    return out;
  }

  /** {% stylesheet %} / {% javascript %} bundles across all sections/snippets/blocks (as Shopify compiles them). */
  compiledAssets() {
    const files = ['sections', 'snippets', 'blocks'].flatMap((d) => listFiles(path.join(this.themeDir, d), { ext: ['.liquid'] }));
    const key = files.map((f) => `${f}:${mtime(f)}`).join('|');
    if (this._compiled && this._compiledKey === key) return this._compiled;
    let css = ''; let js = '';
    for (const f of files) {
      const src = readText(f) || '';
      const sm = src.match(/\{%-?\s*stylesheet\s*-?%\}([\s\S]*?)\{%-?\s*endstylesheet\s*-?%\}/);
      const jm = src.match(/\{%-?\s*javascript\s*-?%\}([\s\S]*?)\{%-?\s*endjavascript\s*-?%\}/);
      if (sm && sm[1].trim()) css += `/* ${relTheme(f)} */\n${sm[1]}\n`;
      if (jm && jm[1].trim()) js += `/* ${relTheme(f)} */\n(function(){\n${jm[1]}\n})();\n`;
    }
    this._compiled = { css, js, version: Math.abs(hashString(key)) };
    this._compiledKey = key;
    return this._compiled;
  }

  // --------------------------------------------------------------- render
  begin(route, cartState, tag) {
    const issues = new Issues();
    this.cur = { issues, loc: null, route, layout: undefined, deadline: Date.now() + this.timeoutMs, depth: 0, tag, stats: new Map(), localeReady: false };
    this.cur.globals = this.buildGlobals(route, cartState);
    return issues;
  }

  /** content_for_layout for a route. Returns { html, layout } */
  renderTemplateBody(route) {
    const tf = this.templateFile(route);
    if (!tf) {
      this.issue('error', 'missing-template', `no template for "${route.template}${route.suffix ? '.' + route.suffix : ''}" (looked in templates/${route.directory ? route.directory + '/' : ''})`);
      return { html: this.inlineError(`template ${route.template} not found`), layout: 'theme' };
    }
    if (tf.kind === 'liquid') {
      const e = this.parseFile(tf.file);
      this.cur.layout = undefined;
      let html = '';
      if (e.templates) {
        try { html = this.engine.renderSync(e.templates, {}, { globals: this.cur.globals }); } catch (err) { if (err instanceof RenderTimeout) throw err; html = this.inlineError(err.message); }
      }
      return { html, layout: this.cur.layout === undefined ? 'theme' : this.cur.layout };
    }
    let json;
    try { json = JSON.parse(stripJsonComment(readText(tf.file))); } catch (e) {
      this.issue('error', 'json', `${relTheme(tf.file)}: ${e.message}`, { file: tf.file });
      return { html: this.inlineError(`invalid JSON template ${relTheme(tf.file)}`), layout: 'theme' };
    }
    const out = [];
    let i = 0;
    for (const key of json.order || []) {
      const s = json.sections && json.sections[key];
      if (!s) { this.issue('error', 'template', `${relTheme(tf.file)}: order lists missing section "${key}"`, { file: tf.file }); continue; }
      if (s.disabled) continue;
      i++;
      const id = sectionIdForTemplate(key);
      const { section, sec, schema } = this.buildSection(id, s.type, s, { location: 'template', index: i });
      if (!sec.exists) { out.push(this.inlineErrorAt(`Error: section 'sections/${s.type}.liquid' does not exist (templates/${path.basename(tf.file)} → "${key}")`, tf.file)); continue; }
      out.push(this.renderSectionObject(section, sec, schema));
    }
    let html = out.join('\n');
    if (json.wrapper) html = wrapWith(json.wrapper, html);
    const layout = json.layout === false ? null : (json.layout || 'theme');
    return { html, layout };
  }

  inlineErrorAt(msg, file) {
    this.issue('error', 'missing-section', msg, { file });
    return `Liquid error: ${escapeHtml(msg)}`;
  }

  renderLayout(name, contentHtml) {
    if (name === null) return contentHtml;
    const f = path.join(this.themeDir, 'layout', `${name}.liquid`);
    const e = this.parseFile(f);
    if (e.missing) { this.issue('error', 'missing-layout', `layout/${name}.liquid does not exist`); return contentHtml; }
    if (!e.templates) return contentHtml;
    this.cur.globals.content_for_layout = contentHtml;
    try { return this.engine.renderSync(e.templates, {}, { globals: this.cur.globals }); } catch (err) {
      if (err instanceof RenderTimeout) throw err;
      return this.inlineError(err.message) + contentHtml;
    }
  }

  /** Render a full page. */
  renderPage(route, { cart = null, tag = null } = {}) {
    const issues = this.begin(route, cart, tag);
    let html = '';
    try {
      if (route.template === 'policy') {
        const body = `<div class="shopify-policy__container"><div class="shopify-policy__title"><h1>${escapeHtml(route.policy.title)}</h1></div><div class="shopify-policy__body"><div class="rte">${route.policy.body}</div></div></div>`;
        html = this.renderLayout('theme', body);
      } else {
        const { html: body, layout } = this.renderTemplateBody(route);
        html = this.renderLayout(layout, body);
      }
    } catch (e) {
      if (e instanceof RenderTimeout) { this.issue('error', 'timeout', e.message); html = `<!-- ${escapeHtml(e.message)} -->`; } else throw e;
    } finally {
      this.cur = null;
    }
    return { html, status: route.status || 200, issues };
  }

  /** Section Rendering API: find section id in route's template or groups, else render the file statically. */
  renderSectionById(id, route, { cart = null, tag = null } = {}) {
    const issues = this.begin(route, cart, tag);
    let html = null;
    try {
      html = this.findAndRenderSection(id, route);
    } catch (e) {
      if (e instanceof RenderTimeout) { this.issue('error', 'timeout', e.message); html = ''; } else throw e;
    } finally {
      this.cur = null;
    }
    return { html, issues };
  }

  renderSectionsById(ids, route, { cart = null, tag = null } = {}) {
    const issues = this.begin(route, cart, tag);
    const out = {};
    try {
      for (const id of ids) out[id] = this.findAndRenderSection(id, route);
    } catch (e) {
      if (!(e instanceof RenderTimeout)) throw e;
      this.issue('error', 'timeout', e.message);
    } finally {
      this.cur = null;
    }
    return { sections: out, issues };
  }

  /** Render a section from ad-hoc data (e.g. a schema preset) in a route's context. */
  renderAdHocSection(id, type, data, route, { cart = null, tag = null } = {}) {
    const issues = this.begin(route, cart, tag);
    let html = null;
    try {
      const { section, sec, schema } = this.buildSection(id, type, data, { location: 'template', index: 1 });
      html = this.renderSectionObject(section, sec, schema);
    } catch (e) {
      if (e instanceof RenderTimeout) { this.issue('error', 'timeout', e.message); html = ''; } else throw e;
    } finally {
      this.cur = null;
    }
    return { html, issues };
  }

  findAndRenderSection(id, route) {
    const tf = this.templateFile(route);
    if (tf && tf.kind === 'json') {
      let json = null;
      try { json = JSON.parse(stripJsonComment(readText(tf.file))); } catch { /* reported elsewhere */ }
      if (json && json.sections) {
        let i = 0;
        for (const key of json.order || []) {
          const s = json.sections[key];
          if (!s || s.disabled) continue;
          i++;
          if (sectionIdForTemplate(key) === id) {
            const { section, sec, schema } = this.buildSection(id, s.type, s, { location: 'template', index: i });
            return this.renderSectionObject(section, sec, schema);
          }
        }
      }
    }
    for (const group of listFiles(path.join(this.themeDir, 'sections'), { ext: ['.json'] }).map((f) => path.basename(f, '.json'))) {
      const g = this.loadGroup(group);
      if (!g || !g.sections) continue;
      for (const key of Object.keys(g.sections)) {
        if (sectionIdForGroup(group, key) === id) {
          const s = g.sections[key];
          const { section, sec, schema } = this.buildSection(id, s.type, s, { location: g.type || 'group' });
          return this.renderSectionObject(section, sec, schema, { groupClass: `shopify-section-group-${group}` });
        }
      }
    }
    if (/^[a-z0-9_-]+$/i.test(id) && exists(path.join(this.themeDir, 'sections', `${id}.liquid`))) return this.renderStaticSection(id);
    return null;
  }
}

// ------------------------------------------------------------------ constants
export const ROUTES = {
  root_url: '/',
  account_url: '/account',
  account_login_url: '/account/login',
  account_logout_url: '/account/logout',
  account_register_url: '/account/register',
  account_addresses_url: '/account/addresses',
  account_recover_url: '/account/recover',
  collections_url: '/collections',
  all_products_collection_url: '/collections/all',
  search_url: '/search',
  predictive_search_url: '/search/suggest',
  cart_url: '/cart',
  cart_add_url: '/cart/add',
  cart_change_url: '/cart/change',
  cart_clear_url: '/cart/clear',
  cart_update_url: '/cart/update',
  product_recommendations_url: '/recommendations/products',
  storefront_login_url: '/storefront/login',
};

const GB = { iso_code: 'GB', name: 'United Kingdom', currency: { iso_code: 'GBP', name: 'British Pound', symbol: '£' }, unit_system: 'metric', available_languages: [{ iso_code: 'en', name: 'English', endonym_name: 'English', primary: true, root_url: '/' }], market: { id: 1, handle: 'gb', metafields: {} } };
export const LOCALIZATION = {
  available_countries: [GB, { iso_code: 'IE', name: 'Ireland', currency: { iso_code: 'EUR', name: 'Euro', symbol: '€' }, unit_system: 'metric' }],
  available_languages: [{ iso_code: 'en', name: 'English', endonym_name: 'English', primary: true, root_url: '/' }],
  country: GB,
  language: { iso_code: 'en', name: 'English', endonym_name: 'English', primary: true, root_url: '/' },
  market: { id: 1, handle: 'gb', metafields: {} },
};

function wrapWith(wrapper, html) {
  const m = String(wrapper).match(/^([a-z]+)((?:[#.][\w-]+)*)(\[.*\])?$/i);
  if (!m) return html;
  const tag = m[1];
  const id = (m[2].match(/#([\w-]+)/) || [])[1];
  const classes = [...m[2].matchAll(/\.([\w-]+)/g)].map((x) => x[1]);
  return `<${tag}${id ? ` id="${id}"` : ''}${classes.length ? ` class="${classes.join(' ')}"` : ''}>${html}</${tag}>`;
}

function resolveUrlSetting(raw) {
  const s = String(raw);
  const m = s.match(/^shopify:\/\/(collections|products|pages|blogs|policies|search)(?:\/(.*))?$/);
  if (!m) return s;
  if (m[1] === 'search') return '/search';
  return `/${m[1]}${m[2] ? '/' + m[2] : ''}`;
}

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function makeFormErrors() {
  const messages = { email: 'is invalid', form: 'Please check the highlighted fields.' };
  const e = { messages, translated_fields: { email: 'Email' } };
  Object.defineProperty(e, 'size', { value: 2, enumerable: false });
  Object.defineProperty(e, Symbol.iterator, { value: function* () { yield* Object.keys(messages); }, enumerable: false });
  return e;
}

function cartJsonFromDrop(drop) {
  return cartJson(drop);
}

function loadSystemTranslations() {
  const f = path.join(process.env.HOME || '/root', '.cache', 'theme-liquid-docs-nodejs', 'shopify_system_translations.json');
  const t = readText(f);
  if (!t) return null;
  try { return JSON.parse(t); } catch { return null; }
}

// ------------------------------------------------------------------- CLI
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = new URL(args._[0] || '/', 'http://localhost:9292');
  const store = createStore({ empty: !!args.empty, real: !!args.real });
  const r = new ThemeRenderer({ themeDir: args.theme || DEFAULT_THEME_DIR, store });
  const route = resolveRoute(store, url.pathname, url.searchParams, { loggedIn: true });
  if (route.redirect) { console.error(`redirect → ${route.redirect}`); process.exit(0); }
  const cart = createCart();
  if (args.cart && !store.empty) {
    const p = store.products()[0];
    if (p) cart.lines.push({ key: `${p.variants[0].id}:cli`, variantId: p.variants[0].id, quantity: 1, properties: {} });
  }
  const result = args.section ? r.renderSectionById(String(args.section), route, { cart }) : r.renderPage(route, { cart });
  const html = result.html == null ? '' : result.html;
  if (args.out) fs.writeFileSync(args.out, html);
  else process.stdout.write(html + '\n');
  for (const i of result.issues.list) console.error(formatIssue(i));
  console.error(`# ${url.pathname}${url.search} template=${route.template}${route.suffix ? '.' + route.suffix : ''} status=${route.status} errors=${result.issues.errors.length} warnings=${result.issues.warnings.length} locale=${r.localeSource || '-'}`);
  // exitCode, not exit(): exit() would cut a large page short when stdout is a pipe.
  process.exitCode = result.issues.errors.length ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((e) => { console.error(e); process.exit(2); });
}
