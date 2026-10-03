// The theme's own Bed Finder engine (assets/global.js + assets/finder.js), run in Node
// without a browser, against pages the harness renders. Used by the finder-matrix
// self-test (test/finder-matrix.test.mjs) and `node lib/finder-engine.mjs`.
//
//   const eng = await loadFinderEngine({ store });     // a createStore() catalogue
//   eng.recommend({ style: 'curl', stage: 'fine', size: 'M' })  → { main, alt }
//   eng.L                                              // window.Lunova as the page has it
//
// What is real: the inline Lunova.settings script and the #finder-config island from
// the rendered /pages/bed-finder (or / when there is no finder page), the fallback beds
// from Section Rendering of <fallbackUrl>?section_id=finder-products (exactly what
// finder.js fetches), and the two scripts themselves. What is stubbed: the DOM, which
// the matching engine never reads (custom elements, observers and listeners register
// against inert stand-ins; storage is in memory).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import { ThemeRenderer } from '../render.mjs';
import { createStore } from '../fixtures/store.mjs';
import { fromSnapshot, REAL_FIXTURE } from '../fixtures/fetch-real.mjs';
import { resolveRoute } from './routes.mjs';
import { createCart } from './cart.mjs';
import { DEFAULT_THEME_DIR, parseArgs } from './util.mjs';

/** A stand-in that accepts any property read, call, construction or write. */
function inert() {
  const target = function () {};
  const proxy = new Proxy(target, {
    get(t, key) {
      if (key === Symbol.toPrimitive) return () => '';
      if (key === Symbol.iterator) return function* () {};
      if (key === 'length') return 0;
      if (key === 'then') return undefined;
      if (key === 'prototype') return t.prototype;
      return proxy;
    },
    apply() { return proxy; },
    construct() { return proxy; },
    set() { return true; },
    has() { return true; },
    deleteProperty() { return true; },
  });
  return proxy;
}

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(String(k)) ? m.get(String(k)) : null),
    setItem: (k, v) => { m.set(String(k), String(v)); },
    removeItem: (k) => { m.delete(String(k)); },
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
}

/** <script … id="x">text</script> → its raw text (what textContent gives for a script). */
function scriptById(html, id) {
  const re = new RegExp(`<script\\b[^>]*\\bid=["']${id}["'][^>]*>([\\s\\S]*?)</script>`, 'i');
  const m = re.exec(String(html || ''));
  return m ? m[1] : null;
}

/** The inline script that sets window.Lunova (routes, settings, strings). */
function lunovaScript(html) {
  for (const m of String(html || '').matchAll(/<script>([\s\S]*?)<\/script>/gi)) {
    if (/Lunova\.settings\s*=/.test(m[1])) return m[1];
  }
  return null;
}

export async function loadFinderEngine({ store = null, themeDir = DEFAULT_THEME_DIR, page = null } = {}) {
  store = store || createStore({ real: true, realCatalog: fromSnapshot(REAL_FIXTURE) });
  const renderer = new ThemeRenderer({ themeDir, store });
  const cart = createCart();
  const issues = [];
  const render = (url, section = null) => {
    const u = new URL(url, 'http://localhost:9292');
    const route = resolveRoute(store, u.pathname, u.searchParams);
    const res = section ? renderer.renderSectionById(section, route, { cart }) : renderer.renderPage(route, { cart });
    for (const i of (res.issues && res.issues.list) || []) if (i.level === 'error') issues.push({ url, ...i });
    return res;
  };

  let where = page;
  let pageHtml = null;
  for (const candidate of page ? [page] : ['/pages/bed-finder', '/']) {
    const res = render(candidate);
    if (res.html && scriptById(res.html, 'finder-config')) { pageHtml = res.html; where = candidate; break; }
  }
  if (!pageHtml) throw new Error('no #finder-config on /pages/bed-finder or / (is the Bed Finder section on?)');
  const configText = scriptById(pageHtml, 'finder-config');
  const settingsScript = lunovaScript(pageHtml);
  if (!settingsScript) throw new Error(`${where}: no inline Lunova.settings script`);

  const fetched = [];
  const doc = inert();
  const documentStub = new Proxy(doc, {
    get(t, key) {
      if (key === 'getElementById') return (id) => (id === 'finder-config' ? { textContent: configText, nodeType: 1 } : null);
      if (key === 'querySelector') return () => null;
      if (key === 'querySelectorAll') return () => [];
      if (key === 'readyState') return 'complete';
      if (key === 'visibilityState') return 'visible';
      if (key === 'cookie') return '';
      return t[key];
    },
  });
  const sandbox = {
    console,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    queueMicrotask,
    URL, URLSearchParams, Intl,
    document: documentStub,
    navigator: inert(), location: { href: 'http://localhost:9292' + where, pathname: where, search: '', hash: '', origin: 'http://localhost:9292' },
    history: inert(),
    localStorage: memoryStorage(), sessionStorage: memoryStorage(),
    customElements: { get: () => undefined, define: () => {}, whenDefined: () => Promise.resolve() },
    HTMLElement: class {}, Element: class {}, Node: class {}, HTMLFormElement: class {}, HTMLInputElement: class {},
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    Event: class { constructor(type) { this.type = type; } },
    IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
    requestAnimationFrame: (fn) => setTimeout(fn, 0), cancelAnimationFrame: () => {},
    getComputedStyle: () => inert(),
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true,
    scrollTo: () => {},
    DOMParser: class {
      parseFromString(html) { return { getElementById: (id) => { const t = scriptById(html, id); return t == null ? null : { textContent: t }; } }; }
    },
    fetch: async (url) => {
      const u = new URL(String(url), 'http://localhost:9292');
      const section = u.searchParams.get('section_id');
      fetched.push(u.pathname + u.search);
      const res = section ? render(u.pathname + u.search, section) : render(u.pathname + u.search);
      const body = res.html == null ? '' : res.html;
      return { ok: res.html != null, status: res.html == null ? 404 : 200, text: async () => body, json: async () => JSON.parse(body) };
    },
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  const run = (code, file) => vm.runInContext(code, ctx, { filename: file });
  run(settingsScript, `${where} (inline Lunova script)`);
  for (const f of ['global.js', 'finder.js']) run(fs.readFileSync(path.join(themeDir, 'assets', f), 'utf8'), `assets/${f}`);

  const L = sandbox.Lunova;
  if (!L || !L.finderEngine) throw new Error('assets/finder.js did not expose Lunova.finderEngine');
  const engine = L.finderEngine;
  const cfg = await engine.loadProducts();
  if (!cfg || !cfg.productsReady) throw new Error(`finder products did not load (fetched: ${fetched.join(', ') || 'nothing'})`);
  const hints = (Array.isArray(L.settings.sizeHints) && L.settings.sizeHints.length ? L.settings.sizeHints : cfg.sizeHints) || [];
  return {
    L, engine, cfg, store, where, fetched, issues,
    sizes: hints.map((h) => h.value),
    hints,
    recommend: (answers, { alt = true, ctx: context = null } = {}) => engine.recommend(cfg, answers, alt, context),
  };
}

/** `node lib/finder-engine.mjs [--real|--full]`: print the grid the engine produces. */
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = parseArgs(process.argv.slice(2));
  const store = args.full ? createStore() : createStore({ real: true, realCatalog: fromSnapshot(REAL_FIXTURE) });
  const eng = await loadFinderEngine({ store });
  const f = (c) => (c ? `${c.product.title.slice(0, 44)} [${c.fit.kind}${c.fit.value ? ': ' + c.fit.value : ''}] £${(c.fit.variant.price / 100).toFixed(0)}` : '-');
  for (const style of ['curl', 'lean', 'sprawl']) for (const stage of ['fine', 'slowing', 'diagnosed']) for (const size of eng.sizes) {
    const r = eng.recommend({ style, stage, size });
    console.log(`${style}/${stage}/${size}`.padEnd(20), f(r.main), '|| alt', f(r.alt));
  }
}
