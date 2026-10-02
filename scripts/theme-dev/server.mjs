#!/usr/bin/env node
// Mock Shopify storefront for the Lunova theme.
//
//   node server.mjs [--port 9292] [--empty] [--theme ../../theme] [--quiet] [--logged-in]
//
// Pages: /, /products/:h, /collections(/:h), /cart, /search, /pages/:h, /blogs/:b(/:a),
//        /policies/:h, /account/*, /password, /gift_cards/:code, anything else → 404 template.
// AJAX:  GET /cart.js, POST /cart/add.js|change.js|update.js|clear.js (JSON, urlencoded or
//        multipart; honours sections + sections_url), GET /products/:h.js,
//        GET /search/suggest(?section_id=…), GET /recommendations/products(?section_id=…).
// Section Rendering: ?section_id=<id> or ?sections=a,b on any page URL.
// Modes: ?empty=1 / ?empty=0 switches the zero-products store for this browser (cookie).
// Dev:   GET /__dev/errors → recent render issues as JSON; response headers
//        X-Theme-Dev-Errors / X-Theme-Dev-Warnings on every rendered response.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ThemeRenderer } from './render.mjs';
import { createStore } from './fixtures/store.mjs';
import { resolveRoute } from './lib/routes.mjs';
import { createCart, cartAdd, cartChange, cartUpdate, cartClear, cartDrop, cartJson, lineJson, CartError } from './lib/cart.mjs';
import { productJson } from './lib/drops.mjs';
import { DEFAULT_THEME_DIR, FIXTURE_IMG_DIR, MIME, parseArgs, readText, exists, escapeHtml, formatIssue } from './lib/util.mjs';

// ------------------------------------------------------------------ helpers
function parseCookies(h) {
  const out = {};
  for (const part of String(h || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

/** a[b][c]=1 style keys → nested objects / arrays (Rack-like). */
function setNested(obj, key, value) {
  const parts = [];
  const m = key.match(/^([^[\]]+)((?:\[[^\]]*\])*)$/);
  if (!m) { obj[key] = value; return; }
  parts.push(m[1]);
  for (const x of m[2].matchAll(/\[([^\]]*)\]/g)) parts.push(x[1]);
  let cur = obj;
  for (let i = 0; i < parts.length; i++) {
    const k = parts[i];
    const last = i === parts.length - 1;
    if (k === '') {
      if (!Array.isArray(cur)) return;
      if (last) { cur.push(value); return; }
      const nxt = {}; cur.push(nxt); cur = nxt; continue;
    }
    if (last) { cur[k] = value; return; }
    if (cur[k] == null) cur[k] = parts[i + 1] === '' || /^\d+$/.test(parts[i + 1]) ? [] : {};
    cur = cur[k];
  }
}

function parseForm(str) {
  const out = {};
  for (const [k, v] of new URLSearchParams(str)) setNested(out, k, v);
  return out;
}

function parseMultipart(buf, boundary) {
  const out = {};
  const text = buf.toString('latin1');
  for (const part of text.split(`--${boundary}`)) {
    const i = part.indexOf('\r\n\r\n');
    if (i < 0) continue;
    const head = part.slice(0, i);
    const name = (head.match(/name="([^"]*)"/) || [])[1];
    if (!name || /filename="/.test(head)) continue;
    const value = Buffer.from(part.slice(i + 4).replace(/\r\n$/, ''), 'latin1').toString('utf8');
    setNested(out, name, value);
  }
  return out;
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const buf = Buffer.concat(chunks);
      const ct = String(req.headers['content-type'] || '');
      try {
        if (ct.includes('application/json')) return resolve(buf.length ? JSON.parse(buf.toString('utf8')) : {});
        if (ct.includes('multipart/form-data')) return resolve(parseMultipart(buf, (ct.match(/boundary=([^;]+)/) || [])[1]));
        return resolve(parseForm(buf.toString('utf8')));
      } catch (e) { resolve({ __parseError: e.message }); }
    });
  });
}

const normaliseItems = (items) => (Array.isArray(items) ? items : items && typeof items === 'object' ? Object.values(items) : []);

// ------------------------------------------------------------------ server
export function startServer({ port = 9292, host = '127.0.0.1', empty = false, themeDir = DEFAULT_THEME_DIR, quiet = false, loggedIn = false, log = console.log } = {}) {
  let origin = `http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`;
  const stores = { full: createStore(), empty: createStore({ empty: true }) };
  const renderers = {};
  const makeRenderers = () => { for (const m of ['full', 'empty']) renderers[m] = new ThemeRenderer({ themeDir, store: stores[m], origin }); };
  makeRenderers();
  const carts = new Map();
  const recent = [];
  const printed = new Set();
  const missingAssets = new Set();

  function record(method, url, status, ms, issues, extra = '') {
    const errs = issues ? issues.errors.length : 0;
    const warns = issues ? issues.warnings.length : 0;
    if (issues && issues.list.length) recent.unshift({ at: new Date().toISOString(), method, url, issues: issues.list });
    recent.length = Math.min(recent.length, 200);
    if (quiet && !errs) return;
    log(`${status} ${method.padEnd(4)} ${url} ${ms}ms${extra}${issues ? ` errors=${errs} warnings=${warns}` : ''}`);
    if (issues) {
      for (const i of issues.list) {
        const key = `${i.level}|${i.kind}|${i.file}|${i.line}|${i.message}`;
        if (i.level !== 'error' && quiet) continue;
        if (printed.has(key)) continue;
        printed.add(key);
        log(`   ${formatIssue(i)}`);
      }
    }
  }

  function send(res, status, body, type = 'text/html; charset=utf-8', headers = {}) {
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...headers });
    res.end(body);
  }
  const sendJson = (res, status, obj, headers = {}) => send(res, status, JSON.stringify(obj), 'application/json; charset=utf-8', headers);
  const issueHeaders = (issues) => (issues ? { 'X-Theme-Dev-Errors': String(issues.errors.length), 'X-Theme-Dev-Warnings': String(issues.warnings.length) } : {});

  function serveFile(res, file, req) {
    if (!exists(file) || !fs.statSync(file).isFile()) return false;
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    if (req.method === 'HEAD') { res.end(); return true; }
    fs.createReadStream(file).pipe(res);
    return true;
  }

  async function handle(req, res) {
    const t0 = Date.now();
    const url = new URL(req.url, origin);
    const p = url.pathname;
    const q = url.searchParams;
    const cookies = parseCookies(req.headers.cookie);
    const setCookies = [];

    // mode + cart + login
    let mode = empty ? 'empty' : 'full';
    if (q.has('empty')) { mode = q.get('empty') === '1' ? 'empty' : 'full'; setCookies.push(`theme_dev_empty=${mode === 'empty' ? 1 : 0}; Path=/; SameSite=Lax`); }
    else if (cookies.theme_dev_empty) mode = cookies.theme_dev_empty === '1' ? 'empty' : 'full';
    const store = stores[mode];
    const renderer = renderers[mode];
    let cart = cookies.cart && carts.get(cookies.cart);
    if (!cart) { cart = createCart(); carts.set(cart.token, cart); setCookies.push(`cart=${cart.token}; Path=/; SameSite=Lax`); }
    let isLoggedIn = loggedIn || cookies.theme_dev_customer === '1';
    if (q.get('login') === '1') { isLoggedIn = true; setCookies.push('theme_dev_customer=1; Path=/; SameSite=Lax'); }
    const baseHeaders = setCookies.length ? { 'Set-Cookie': setCookies } : {};

    const done = (status, issues, extra) => record(req.method, `${p}${url.search}`, status, Date.now() - t0, issues, extra);
    const redirect = (to, extraHeaders = {}) => { res.writeHead(302, { Location: to, ...baseHeaders, ...extraHeaders }); res.end(); done(302, null, ` → ${to}`); };

    // ---------------------------------------------------------- static
    if (p.startsWith('/assets/')) {
      const name = decodeURIComponent(p.slice(8));
      const f = path.join(themeDir, 'assets', name);
      if (!name.includes('..') && serveFile(res, f, req)) return;
      if (!name.includes('..') && exists(`${f}.liquid`)) {
        const out = renderer.engine.parseAndRenderSync(readText(`${f}.liquid`), {}, { globals: { settings: renderer.globalSettings() } });
        return send(res, 200, out, MIME[path.extname(f)] || 'text/plain');
      }
      missingAssets.add(name);
      send(res, 404, `asset not found: ${escapeHtml(name)}`, 'text/plain');
      return done(404, null, ' (missing theme asset)');
    }
    if (p.startsWith('/fixture-img/')) {
      const name = decodeURIComponent(p.slice(13));
      if (!name.includes('..') && serveFile(res, path.join(FIXTURE_IMG_DIR, name), req)) return;
      return send(res, 404, 'image not found', 'text/plain');
    }
    if (p.startsWith('/fonts/')) return send(res, 404, 'Shopify font files are not available offline (theme-dev mock)', 'text/plain');
    if (p.startsWith('/compiled_assets/')) {
      const a = renderer.compiledAssets();
      return p.endsWith('.css') ? send(res, 200, a.css, 'text/css; charset=utf-8') : send(res, 200, a.js, 'application/javascript; charset=utf-8');
    }
    if (p.startsWith('/shopify-assets/') || p.startsWith('/global-assets/')) {
      // Shopify-hosted assets (shopify_asset_url): offline stand-ins so pages behave like production.
      if (p.endsWith('/qrcode.js')) return send(res, 200, 'window.QRCode=window.QRCode||function(el,o){var d=document.createElement("div");d.setAttribute("data-theme-dev-qr",(o&&o.text)||"");d.style.cssText="width:"+((o&&o.width)||120)+"px;height:"+((o&&o.height)||120)+"px;background:repeating-conic-gradient(#000 0 25%,#fff 0 50%) 0 0/12px 12px";el.appendChild(d);};', 'application/javascript; charset=utf-8');
      if (p.endsWith('.svg')) return send(res, 200, '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40"><rect width="120" height="40" rx="6"/><text x="60" y="25" fill="#fff" font-size="11" text-anchor="middle" font-family="sans-serif">Wallet (mock)</text></svg>', 'image/svg+xml');
      if (p.endsWith('.js')) return send(res, 200, '/* theme-dev stub for a Shopify-hosted script */', 'application/javascript; charset=utf-8');
      if (p.endsWith('.css')) return send(res, 200, '/* theme-dev stub */', 'text/css; charset=utf-8');
      return send(res, 404, 'unknown Shopify asset (theme-dev mock)', 'text/plain');
    }
    if (p.startsWith('/payment-icons/')) return send(res, 200, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 38 24"><rect width="38" height="24" rx="3" fill="#eee"/></svg>', 'image/svg+xml');
    if (p === '/favicon.ico') return send(res, 204, '');
    if (p === '/__dev/health') return send(res, 200, 'ok', 'text/plain');
    if (p === '/__dev/errors') return sendJson(res, 200, { mode, missingAssets: [...missingAssets], recent });
    if (p === '/__dev/reset') { carts.clear(); recent.length = 0; printed.clear(); missingAssets.clear(); makeRenderers(); return sendJson(res, 200, { ok: true }); }

    // ---------------------------------------------------------- cart API
    const sectionsFor = async (body) => {
      let ids = body.sections;
      if (!ids) return null;
      ids = Array.isArray(ids) ? ids : String(ids).split(',');
      ids = ids.map((s) => String(s).trim()).filter(Boolean).slice(0, 5);
      const su = new URL(body.sections_url || '/', origin);
      const route = resolveRoute(store, su.pathname, su.searchParams, { loggedIn: isLoggedIn });
      const r = renderer.renderSectionsById(ids, route.redirect ? resolveRoute(store, '/', new URLSearchParams()) : route, { cart });
      return r;
    };
    const cartResponse = async (body, payload, status = 200) => {
      const sec = await sectionsFor(body);
      if (sec) payload.sections = sec.sections;
      sendJson(res, status, payload, { ...baseHeaders, ...issueHeaders(sec && sec.issues) });
      done(status, sec && sec.issues);
    };
    const cartErr = (e) => {
      if (!(e instanceof CartError)) throw e;
      sendJson(res, e.status, e.toJSON(), baseHeaders);
      done(e.status, null, ` cart error: ${e.description}`);
    };

    if (p === '/cart.js' || p === '/cart.json') {
      sendJson(res, 200, cartJson(cartDrop(cart, store)), baseHeaders);
      return done(200, null);
    }
    if (req.method === 'POST' && (p === '/cart/add.js' || p === '/cart/add')) {
      const body = await readBody(req);
      const viaItems = body.items != null;
      const items = viaItems ? normaliseItems(body.items) : [{ id: body.id, quantity: body.quantity, properties: body.properties }];
      try {
        const keys = cartAdd(cart, store, items);
        if (p === '/cart/add') return redirect(body.return_to || '/cart');
        const drop = cartDrop(cart, store);
        const lines = keys.map((k) => drop.items.find((i) => i.key === k)).filter(Boolean).map(lineJson);
        return cartResponse(body, viaItems ? { items: lines } : { ...lines[0] });
      } catch (e) { if (p === '/cart/add' && e instanceof CartError) return redirect('/cart'); return cartErr(e); }
    }
    if (req.method === 'POST' && (p === '/cart/change.js' || p === '/cart/change')) {
      const body = await readBody(req);
      try {
        cartChange(cart, store, body);
        if (p === '/cart/change') return redirect('/cart');
        return cartResponse(body, cartJson(cartDrop(cart, store)));
      } catch (e) { return cartErr(e); }
    }
    if (p === '/cart/change' && req.method === 'GET') {
      try { cartChange(cart, store, { line: q.get('line'), id: q.get('id'), quantity: q.get('quantity') }); } catch { /* ignore */ }
      return redirect('/cart');
    }
    if (req.method === 'POST' && (p === '/cart/update.js' || p === '/cart/update' || p === '/cart')) {
      const body = await readBody(req);
      try {
        cartUpdate(cart, store, body);
        if (p !== '/cart/update.js') return redirect(body.checkout !== undefined ? '/checkout' : '/cart');
        return cartResponse(body, cartJson(cartDrop(cart, store)));
      } catch (e) { return cartErr(e); }
    }
    if (p === '/cart/clear.js' || p === '/cart/clear') {
      const body = req.method === 'POST' ? await readBody(req) : {};
      cartClear(cart);
      if (p === '/cart/clear') return redirect('/cart');
      return cartResponse(body, cartJson(cartDrop(cart, store)));
    }
    if (p === '/checkout' || p.startsWith('/checkouts/')) {
      send(res, 200, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Checkout (mock)</title></head><body><main><h1>Checkout (theme-dev mock)</h1><p>${cartDrop(cart, store).item_count} item(s). The harness stops here.</p><p><a href="/cart">Back to basket</a></p></main></body></html>`, 'text/html; charset=utf-8', baseHeaders);
      return done(200, null);
    }

    // ---------------------------------------------------------- product JSON
    let m;
    if ((m = p.match(/^\/products\/([^/]+)\.(js|json)$/))) {
      const prod = store.productByHandle(decodeURIComponent(m[1]));
      if (!prod) { sendJson(res, 404, { status: 404, message: 'Not Found', description: 'Product not found' }); return done(404, null); }
      const j = productJson(prod);
      sendJson(res, 200, m[2] === 'js' ? j : { product: j }, baseHeaders);
      return done(200, null);
    }

    // ---------------------------------------------------------- predictive search
    if (p === '/search/suggest' || p === '/search/suggest.json') {
      const term = q.get('q') || '';
      const types = (q.get('resources[type]') || 'product,collection,page,article,query').split(',').map((s) => s.trim());
      const limit = Number(q.get('resources[limit]') || 4);
      const predictive = store.predictive(term, { limit, types });
      const sid = q.get('section_id');
      if (sid && p === '/search/suggest') {
        const route = { template: 'search', pageType: 'search', path: '/search/suggest', query: q, status: 200, currentPage: 1, predictive };
        const r = renderer.renderSectionById(sid, route, { cart });
        if (r.html == null) { send(res, 404, '', 'text/html', baseHeaders); return done(404, r.issues); }
        send(res, 200, r.html, 'text/html; charset=utf-8', { ...baseHeaders, ...issueHeaders(r.issues) });
        return done(200, r.issues);
      }
      const R = predictive.resources;
      sendJson(res, 200, { resources: { results: { products: R.products.map(productJson), collections: R.collections.map((c) => ({ id: c.id, title: c.title, handle: c.handle, url: c.url, body: c.description })), pages: R.pages.map((x) => ({ id: x.id, title: x.title, handle: x.handle, url: x.url })), articles: R.articles.map((x) => ({ id: x.id, title: x.title, handle: x.handle, url: x.url })), queries: R.queries } } }, baseHeaders);
      return done(200, null);
    }

    // ---------------------------------------------------------- recommendations
    if (p === '/recommendations/products' || p === '/recommendations/products.json') {
      const rec = store.recommend(q.get('product_id'), { intent: q.get('intent') || 'related', limit: q.get('limit') || 4 });
      const sid = q.get('section_id');
      if (sid && p === '/recommendations/products') {
        const route = { template: 'product', pageType: 'product', path: p, query: q, status: 200, currentPage: 1, product: null, recommendations: rec };
        const r = renderer.renderSectionById(sid, route, { cart });
        if (r.html == null) { send(res, 404, '', 'text/html', baseHeaders); return done(404, r.issues); }
        send(res, 200, r.html, 'text/html; charset=utf-8', { ...baseHeaders, ...issueHeaders(r.issues) });
        return done(200, r.issues);
      }
      sendJson(res, 200, { intent: rec.intent, products: rec.products.map(productJson) }, baseHeaders);
      return done(200, null);
    }

    // ---------------------------------------------------------- form posts
    if (req.method === 'POST') {
      const body = await readBody(req);
      const back = (req.headers.referer && new URL(req.headers.referer).pathname) || '/';
      if (p === '/contact') {
        const posted = body.form_type === 'customer' ? 'customer_posted' : 'contact_posted';
        const target = new URL(body.return_to || back, origin);
        target.searchParams.set(posted, 'true');
        return redirect(`${target.pathname}${target.search}#${body.form_type === 'customer' ? 'newsletter' : 'contact_form'}`);
      }
      if (p === '/account/login' || p === '/account') return redirect('/account', { 'Set-Cookie': [...setCookies, 'theme_dev_customer=1; Path=/; SameSite=Lax'] });
      if (p === '/account/recover') return redirect('/account/login#recover');
      if (p === '/localization') return redirect(body.return_to || back);
      if (p === '/password') return redirect('/');
      if (/\/comments$/.test(p)) return redirect(`${p.replace(/\/comments$/, '')}?comment_posted=true#comments`);
      if (p.startsWith('/account/addresses')) return redirect('/account/addresses');
    }
    if (p === '/account/logout') return redirect('/', { 'Set-Cookie': [...setCookies, 'theme_dev_customer=0; Path=/; Max-Age=0'] });

    // ---------------------------------------------------------- pages
    if (req.method !== 'GET' && req.method !== 'HEAD') { send(res, 405, 'Method not allowed', 'text/plain'); return done(405, null); }
    const route = resolveRoute(store, p, q, { loggedIn: isLoggedIn });
    if (route.redirect) return redirect(route.redirect);
    route.loggedIn = isLoggedIn;
    const sid = q.get('section_id');
    const sids = q.get('sections');
    if (sid) {
      const r = renderer.renderSectionById(sid, route, { cart });
      if (r.html == null) { send(res, 404, '', 'text/html', { ...baseHeaders, ...issueHeaders(r.issues) }); return done(404, r.issues, ` section_id=${sid} not found`); }
      send(res, 200, r.html, 'text/html; charset=utf-8', { ...baseHeaders, ...issueHeaders(r.issues) });
      return done(200, r.issues);
    }
    if (sids) {
      const ids = sids.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 5);
      const r = renderer.renderSectionsById(ids, route, { cart });
      sendJson(res, 200, r.sections, { ...baseHeaders, ...issueHeaders(r.issues) });
      return done(200, r.issues);
    }
    const r = renderer.renderPage(route, { cart });
    send(res, r.status, r.html, 'text/html; charset=utf-8', { ...baseHeaders, ...issueHeaders(r.issues), 'X-Theme-Dev-Template': `${route.directory ? route.directory + '/' : ''}${route.template}${route.suffix ? '.' + route.suffix : ''}`, 'X-Theme-Dev-Mode': mode });
    return done(r.status, r.issues, ` tpl=${route.template}${route.suffix ? '.' + route.suffix : ''}${mode === 'empty' ? ' [empty]' : ''}`);
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((e) => {
      log(`500 ${req.method} ${req.url} harness crash: ${e && e.stack ? e.stack : e}`);
      try { send(res, 500, `<pre>theme-dev harness error:\n${escapeHtml(e && e.stack ? e.stack : String(e))}</pre>`); } catch { /* ignore */ }
    });
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, host, () => {
      const actual = server.address().port;
      origin = `http://${host === '0.0.0.0' ? 'localhost' : host}:${actual}`;
      if (actual !== port) makeRenderers();
      resolve({ server, origin, port: actual, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = parseArgs(process.argv.slice(2));
  const port = Number(args.port || process.env.PORT || 9292);
  startServer({ port, host: args.host || '127.0.0.1', empty: !!args.empty, themeDir: path.resolve(args.theme || DEFAULT_THEME_DIR), quiet: !!args.quiet, loggedIn: !!args['logged-in'] })
    .then(({ origin }) => {
      console.log(`Lunova mock storefront → ${origin}  (theme: ${path.resolve(args.theme || DEFAULT_THEME_DIR)}${args.empty ? ', EMPTY store' : ''})`);
      console.log('  ?empty=1 / ?empty=0 switch fixture mode · ?login=1 signs in · /__dev/errors lists render issues');
    })
    .catch((e) => { console.error(`could not start: ${e.message}`); process.exit(1); });
}
