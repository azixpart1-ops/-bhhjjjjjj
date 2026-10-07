#!/usr/bin/env node
// Browser tests for the Lunova theme against the mock storefront (Playwright + Chromium).
//
//   node browser-test.mjs                       starts server.mjs on a free port, runs everything
//   node browser-test.mjs --real                same, against the live catalogue (.out/real-products.json):
//                                               Chromium goes through HTTPS_PROXY so CDN images load
//                                               (placeholder images if the CDN can't be reached)
//   node browser-test.mjs --url http://127.0.0.1:9292   test an already running server
//   node browser-test.mjs --port 9871                    start its server on that port (default: a free one)
//   node browser-test.mjs --only=pages|flows|matrix    --pages=home,product   --no-a11y   --strict-a11y
//   node browser-test.mjs --viewport-only       skip full-page screenshots
//   node browser-test.mjs --real --all-products also sweep every real product page at 390px
//
// Output: one line per check — PASS/FAIL/SKIP/WARN <kind> <name> <detail>; exit 1 on any FAIL.
// Screenshots: .out/shots/<page>-<width>.png (real-<page>-<width>.png with --real)
// Finder matrix: every style × stage × size answer → .out/finder-matrix[-real].json
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { startServer } from './server.mjs';
import { createStore } from './fixtures/store.mjs';
import { OUT_DIR, HARNESS_DIR, DEFAULT_THEME_DIR, parseArgs } from './lib/util.mjs';

process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
const require = createRequire(path.join(HARNESS_DIR, 'package.json'));
function loadPlaywright() {
  for (const id of ['playwright', '/opt/node22/lib/node_modules/playwright', 'playwright-core']) {
    try { return require(id); } catch { /* try next */ }
  }
  return null;
}

/**
 * Which dog a bed size is for, as a hint index: from the breeds in the label when it
 * lists them ("Large: Cocker Spaniel | Cockapoo | Staffie" → the hint whose breeds
 * include Cocker/Staffie), else from the size word. → { cls, via } or null.
 */
function fitClass(label, hints) {
  const text = String(label || '');
  const breedPart = text.includes(':') ? text.split(':').slice(1).join(':') : '';
  if (breedPart && Array.isArray(hints) && hints.length) {
    const hits = [];
    for (const breed of breedPart.split(/[|,]/).map((b) => b.trim().toLowerCase()).filter(Boolean)) {
      const i = hints.findIndex((h) => String(h.breeds || '').toLowerCase().split(/,\s*/).some((t) => t && (breed.includes(t) || t.includes(breed))));
      if (i > -1) hits.push(i);
    }
    if (hits.length) return { cls: Math.round(hits.reduce((a, b) => a + b, 0) / hits.length), via: 'breeds' };
  }
  const c = sizeClass(text.split(/[·:(|]/)[0]);
  return c == null ? null : { cls: c, via: 'label' };
}
let axeSource = null;
try { axeSource = require('axe-core').source; } catch { /* optional */ }

const args = parseArgs(process.argv.slice(2));
const ONLY = args.only ? String(args.only) : null;
const REAL = !!args.real;
const RUN_MODE = REAL ? 'real' : 'full';
const PREFIX = REAL ? 'real-' : '';
const CDN_HOST = 'cdn.shopify.com';
let cdnMode = 'blocked'; // real mode: 'live' (through the proxy) or 'placeholder'
const PAGE_FILTER = args.pages ? new Set(String(args.pages).split(',')) : null;
const SHOTS = path.join(OUT_DIR, 'shots');
const VIEWPORTS = [{ w: 1440, h: 900 }, { w: 390, h: 844 }];

const results = [];
function report(status, kind, name, detail = '') {
  results.push({ status, kind, name, detail });
  console.log(`${status.padEnd(5)} ${kind.padEnd(6)} ${name.padEnd(34)} ${detail}`);
}

const FIXTURE_PAGES = [
  ['home', '/'],
  ['collection', '/collections/orthopaedic-dog-beds'],
  ['collection-all', '/collections/all'],
  ['product', '/products/coniston-orthopaedic-dog-bed'],
  ['product-single', '/products/dream-paws-geometric-bed-in-grey-modern-comfort-that-goes-with-everything'],
  ['product-colour', '/products/harrogate-heritage-dog-bed'],
  ['product-soldout', '/products/wensleydale-nesting-bed'],
  ['product-noimage', '/products/windermere-elevated-cooling-dog-bed'],
  ['cart-empty', '/cart'],
  ['cart', '/cart', { fillCart: true }],
  ['search', '/search?q=bed'],
  ['search-none', '/search?q=zzzz'],
  ['finder-page', '/pages/bed-finder'],
  ['faq', '/pages/faq'],
  ['contact', '/pages/contact'],
  ['about', '/pages/about'],
  ['page', '/pages/delivery-returns'],
  ['blog', '/blogs/journal'],
  ['article', '/blogs/journal/signs-your-dogs-bed-has-stopped-supporting-them'],
  ['list-collections', '/collections'],
  ['404', '/does-not-exist'],
  ['login', '/account/login'],
  ['account', '/account?login=1'],
  ['password', '/password'],
  ['gift-card', '/gift_cards/demo'],
  ['empty-home', '/?empty=1', { empty: true }],
  ['empty-collection', '/collections/all?empty=1', { empty: true }],
  ['empty-cart', '/cart?empty=1', { empty: true }],
];

const isColourName = (n) => /^colou?rs?$/i.test(String(n).trim());
const isSizeName = (n) => /\bsize\b/i.test(String(n));

/**
 * Real-catalogue pages, chosen by shape rather than handle so the list follows the
 * store: each awkward option format, the non-bed products, pagination past 50.
 */
function realPages(store) {
  const ps = store.products();
  const out = [
    ['home', '/'],
    ['collection-all', '/collections/all'],
    ['collection-all-p3', '/collections/all?page=3'],
    ['collection-frontpage', '/collections/frontpage'],
  ];
  const pick = (name, pred) => { const p = ps.find(pred); if (p) out.push([name, p.url]); };
  pick('product-sizes', (p) => p.options.length === 1 && isSizeName(p.options[0]) && p.variants.length >= 3 && p.price_varies);
  pick('product-colour-size', (p) => isColourName(p.options[0]) && p.options.some(isSizeName) && p.variants.length > 2);
  pick('product-size-colour', (p) => isSizeName(p.options[0]) && p.options.slice(1).some(isColourName));
  pick('product-breed-sizes', (p) => p.variants.some((v) => /:.*\|/.test(v.title)));
  pick('product-one-size', (p) => p.variants.length === 1 && /one size/i.test(p.variants[0].title));
  pick('product-default-title', (p) => p.has_only_default_variant && /^Dog Beds/.test(p.type));
  const most = [...ps].sort((a, b) => b.variants.length - a.variants.length)[0];
  if (most && !out.some(([, u]) => u === most.url)) out.push(['product-most-variants', most.url]);
  pick('product-kennel', (p) => /^Dog Houses/.test(p.type));
  pick('product-car-seat', (p) => /car seat/i.test(p.title));
  pick('product-crate', (p) => /crate/i.test(p.type) && !/car seat/i.test(p.title));
  out.push(
    ['cart-empty', '/cart'],
    ['cart', '/cart', { fillCart: true }],
    ['search', '/search?q=bed'],
    ['search-p2', '/search?q=dog&page=2'],
    ['search-none', '/search?q=zzzz'],
    ['finder-page', '/pages/bed-finder'],
    ['list-collections', '/collections'],
    ['404', '/does-not-exist'],
  );
  if (args['all-products']) for (const p of ps) out.push([`p-${p.handle.slice(0, 40)}`, p.url, { only: 390 }]);
  return out;
}

/** Which products the flows use. Fixture handles by default; main() picks real ones with --real. */
let CFG = {
  pdpHandle: 'coniston-orthopaedic-dog-bed',     // size-only, prices differ by size
  cartHandle: 'coniston-orthopaedic-dog-bed',
  stickyHandle: 'coniston-orthopaedic-dog-bed',
  soldOutHandle: 'wensleydale-nesting-bed',
  quickAddPath: '/collections/orthopaedic-dog-beds',
  searchTerm: 'con',
  searchExpect: 'Coniston',
  colourProducts: [],                            // colour + size products (real mode)
};

// ------------------------------------------------------------------ helpers
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newContext(browser, base, { w, h }, { reducedMotion = 'no-preference' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion, hasTouch: w < 800, isMobile: false, ignoreHTTPSErrors: REAL });
  const host = new URL(base).host;
  await ctx.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (REAL && u.host === CDN_HOST) {
      if (cdnMode === 'live') return route.continue();
      // CDN unreachable: the mock server's placeholder image route stands in.
      try {
        const r = await fetch(`${base}/__dev/placeholder-img/${encodeURIComponent(u.pathname.split('/').pop())}?${u.searchParams}`);
        return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: await r.text() });
      } catch { return route.abort(); }
    }
    if (u.host !== host && u.protocol.startsWith('http')) return route.abort();
    return route.continue();
  });
  return ctx;
}

/** Catalogue mode for this context (cookie read by server.mjs). */
async function setMode(ctx, base, mode) {
  await ctx.addCookies([
    { name: 'theme_dev_mode', value: mode, url: base },
    { name: 'theme_dev_empty', value: mode === 'empty' ? '1' : '0', url: base },
  ]);
}

function watch(page, base, { expectStatus = 200 } = {}) {
  const w = { console: [], pageErrors: [], failed: [] };
  const host = new URL(base).host;
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const loc = msg.location() && msg.location().url ? msg.location().url : '';
    if (/\/fonts\//.test(loc)) return; // Shopify font files are not available offline
    if (loc && !loc.includes(host)) return; // blocked third-party (offline sandbox)
    if (/net::ERR_FAILED|ERR_BLOCKED/.test(msg.text()) && !loc.includes(host)) return;
    if (expectStatus === 404 && /status of 404/.test(msg.text()) && loc && new URL(loc).pathname === new URL(page.url()).pathname) return;
    w.console.push(`${msg.text().slice(0, 200)}${loc ? ` @ ${loc.replace(base, '')}` : ''}`);
  });
  page.on('pageerror', (e) => w.pageErrors.push(String(e && e.message ? e.message : e).slice(0, 300)));
  const ours = (u) => u.host === host || (REAL && cdnMode === 'live' && u.host === CDN_HOST);
  page.on('response', (r) => {
    const u = new URL(r.url());
    if (r.request().isNavigationRequest() && r.request().frame() === page.mainFrame()) return; // the document itself is checked separately
    if (ours(u) && r.status() >= 400 && !u.pathname.startsWith('/fonts/')) w.failed.push(`${r.status()} ${u.host === host ? u.pathname : u.href.slice(0, 120)}`);
  });
  page.on('requestfailed', (r) => {
    const u = new URL(r.url());
    const err = r.failure() && r.failure().errorText;
    if (/ERR_ABORTED/.test(err || '') && u.host === CDN_HOST) return; // lazy image cancelled by navigation/scroll
    if (ours(u) && !u.pathname.startsWith('/fonts/')) w.failed.push(`failed ${u.host === host ? u.pathname : u.href.slice(0, 120)} (${err})`);
  });
  return w;
}

async function firstVisible(scope, selectors) {
  for (const sel of selectors) {
    const loc = scope.locator(sel).filter({ visible: true }).first();
    if (await loc.count()) return loc;
  }
  return null;
}

async function waitFor(fn, timeout = 5000, step = 100) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await fn()) return true; } catch { /* retry */ }
    await sleep(step);
  }
  return false;
}

/**
 * HTML entities shown as text ("Your dog&#39;s name"): a translation escaped by Shopify's
 * t filter (keys without _html) and then escaped again, or put into textContent from JSON.
 * Checks visible text plus aria-label/title/alt/placeholder under `sel`.
 */
async function entityLeaks(page, sel = 'body') {
  return page.evaluate((sel) => {
    const src = '&(?:#\\d+|#x[0-9a-f]+|amp|quot|lt|gt|apos|nbsp|rsquo|lsquo|ldquo|rdquo|hellip|ndash|mdash|pound|times|middot);';
    const out = [];
    for (const root of document.querySelectorAll(sel)) {
      const t = root.innerText || '';
      for (const m of t.matchAll(new RegExp(src, 'gi'))) out.push(`text "…${t.slice(Math.max(0, m.index - 28), m.index + m[0].length + 8).replace(/\s+/g, ' ')}…"`);
      for (const el of root.querySelectorAll('[aria-label],[title],[alt],[placeholder]')) {
        for (const a of ['aria-label', 'title', 'alt', 'placeholder']) {
          const v = el.getAttribute(a);
          if (v && new RegExp(src, 'i').test(v)) out.push(`${a}="${v.slice(0, 60)}"`);
        }
      }
    }
    return [...new Set(out)].slice(0, 4);
  }, sel);
}

const cartCount = (page) => page.evaluate(() => fetch('/cart.js', { headers: { Accept: 'application/json' } }).then((r) => r.json()).then((c) => c.item_count));

async function drawerHasLine(page) {
  return waitFor(async () => (await page.locator('cart-drawer[open]').count()) > 0 && (await page.locator('cart-drawer [data-line-key]').count()) > 0, 6000);
}

async function overflow(page) {
  return page.evaluate(() => {
    const se = document.scrollingElement || document.documentElement;
    const vw = window.innerWidth;
    const out = { scroll: se.scrollWidth, vw, offenders: [] };
    if (se.scrollWidth > vw) {
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width && r.right > vw + 1 && getComputedStyle(el).position !== 'fixed') {
          const s = el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + (el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : '');
          if (!out.offenders.includes(s)) out.offenders.push(s);
          if (out.offenders.length >= 4) break;
        }
      }
    }
    return out;
  });
}

async function fillCart(ctx, base) {
  const p = await (await ctx.request.get(`${base}/products/${CFG.cartHandle}.js`)).json();
  await ctx.request.post(`${base}/cart/add.js`, { data: { items: [{ id: (p.variants[1] || p.variants[0]).id, quantity: 1 }] } });
}

// ------------------------------------------------------------------ page checks
async function checkPages(browser, base, pages) {
  fs.mkdirSync(SHOTS, { recursive: true });
  for (const [name, url, opts = {}] of pages) {
    if (PAGE_FILTER && !PAGE_FILTER.has(name)) continue;
    for (const vp of VIEWPORTS) {
      if (opts.only && opts.only !== vp.w) continue;
      const id = `${PREFIX}${name}@${vp.w}`;
      const ctx = await newContext(browser, base, vp, { reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      const w = watch(page, base, { expectStatus: name === '404' ? 404 : 200 });
      let resp;
      try {
        await setMode(ctx, base, opts.empty ? 'empty' : RUN_MODE);
        if (opts.fillCart) await fillCart(ctx, base);
        resp = await page.goto(base + url, { waitUntil: 'load', timeout: 20000 });
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        // scroll through once so lazy images and [data-reveal] observers fire
        await page.evaluate(async () => { const H = document.scrollingElement.scrollHeight; for (let y = 0; y < H; y += Math.round(innerHeight * 0.8)) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } scrollTo(0, 0); });
        await sleep(250);
      } catch (e) {
        report('FAIL', 'page', id, `navigation: ${e.message.split('\n')[0]}`);
        await ctx.close();
        continue;
      }
      const problems = [];
      const status = resp ? resp.status() : 0;
      const expected = name === '404' ? 404 : 200;
      if (status !== expected) problems.push(`HTTP ${status}`);
      const liquidErrors = resp ? Number(resp.headers()['x-theme-dev-errors'] || 0) : 0;
      if (liquidErrors) problems.push(`${liquidErrors} Liquid/render error(s) (see /__dev/errors)`);
      const html = await page.content();
      if (/Liquid (syntax )?error/.test(html)) problems.push('"Liquid error" text in page');
      if (/translation missing/.test(html)) problems.push('"translation missing" text in page');
      const leaks = await entityLeaks(page);
      if (leaks.length) problems.push(`HTML entity shown as text: ${leaks.join(' | ')}`);
      if (w.pageErrors.length) problems.push(`JS errors: ${w.pageErrors.slice(0, 2).join(' | ')}`);
      if (w.console.length) problems.push(`console errors: ${w.console.slice(0, 2).join(' | ')}`);
      if (w.failed.length) problems.push(`failed requests: ${[...new Set(w.failed)].slice(0, 3).join(', ')}`);
      const ov = await overflow(page);
      if (ov.scroll > ov.vw) problems.push(`horizontal overflow ${ov.scroll}px > ${ov.vw}px (${ov.offenders.join(', ')})`);
      const shot = path.join(SHOTS, `${PREFIX}${name}-${vp.w}.png`);
      try { await page.screenshot({ path: shot, fullPage: !args['viewport-only'], animations: 'disabled', timeout: 20000 }); } catch (e) { problems.push(`screenshot failed: ${e.message.split('\n')[0]}`); }
      report(problems.length ? 'FAIL' : 'PASS', 'page', id, problems.length ? problems.join('; ') : `HTTP ${status} · no console/JS errors · no overflow · ${path.relative(HARNESS_DIR, shot)}`);
      if (axeSource && !args['no-a11y'] && vp.w === 390) await a11y(page, `${PREFIX}${name}`);
      await ctx.close();
    }
  }
}

async function a11y(page, name) {
  try {
    await page.addScriptTag({ content: axeSource });
    const res = await page.evaluate(async () => {
      // eslint-disable-next-line no-undef
      const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] });
      return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, target: v.nodes[0] && v.nodes[0].target.join(' '), summary: v.nodes[0] && v.nodes[0].failureSummary }));
    });
    const serious = res.filter((v) => ['serious', 'critical'].includes(v.impact));
    const level = serious.length ? (args['strict-a11y'] ? 'FAIL' : 'WARN') : 'PASS';
    const detail = res.length ? res.map((v) => `${v.impact}:${v.id}×${v.n} (${String(v.target).slice(0, 60)})`).join('; ') : 'axe: no WCAG 2.2 A/AA violations';
    report(level, 'a11y', `${name}@390`, detail);
  } catch (e) {
    report('SKIP', 'a11y', `${name}@390`, `axe failed: ${e.message.split('\n')[0]}`);
  }
}

// ------------------------------------------------------------------ flows
async function flow(browser, base, name, vp, fn) {
  const ctx = await newContext(browser, base, vp);
  const page = await ctx.newPage();
  const w = watch(page, base);
  name = `${PREFIX}${name}`;
  try {
    await setMode(ctx, base, RUN_MODE);
    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
    const out = await fn(page);
    const status = out && out.status ? out.status : 'PASS';
    let detail = (out && out.detail) || '';
    if (status === 'PASS' && (w.pageErrors.length || w.console.length)) {
      report('FAIL', 'flow', `${name}@${vp.w}`, `${detail} — but JS errors: ${[...w.pageErrors, ...w.console].slice(0, 2).join(' | ')}`);
    } else report(status, 'flow', `${name}@${vp.w}`, detail);
  } catch (e) {
    const shot = path.join(SHOTS, `flow-${name}-${vp.w}.png`);
    try { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: shot }); } catch { /* ignore */ }
    report('FAIL', 'flow', `${name}@${vp.w}`, `${e.message.split('\n')[0]}${w.pageErrors.length ? ` · JS: ${w.pageErrors[0]}` : ''} · ${path.relative(HARNESS_DIR, shot)}`);
  } finally {
    await ctx.close();
  }
}

const fail = (msg) => { throw new Error(msg); };

async function finderFlow(page) {
  await page.waitForLoadState('load');
  const opener = await firstVisible(page, ['[data-site-header] [data-open-finder]', 'header [data-open-finder]', '.header [data-open-finder]', 'a[href$="#bed-finder"]']);
  if (!opener) fail('no visible [data-open-finder] in the header');
  await opener.click();
  const dialog = page.locator('bed-finder dialog[open], [data-finder-modal][open]').first();
  if (!(await waitFor(async () => (await dialog.count()) && dialog.isVisible(), 4000))) fail('finder modal did not open');
  let named = false;
  let answered = 0;
  const leaks = new Set();
  const dialogSel = 'bed-finder dialog[open], [data-finder-modal][open], dialog[open]:has(bed-finder)';
  for (let i = 0; i < 16; i++) {
    for (const l of await entityLeaks(page, dialogSel)) leaks.add(l);
    if (leaks.size) fail(`finder shows HTML entities as text (step ${answered + 1}): ${[...leaks].slice(0, 3).join(' | ')}`);
    const add = await firstVisible(dialog, ['.finder-result__add', '[data-finder-add]', 'button.btn--primary:has-text("Add")']);
    if (add) {
      const resultText = (await dialog.innerText()).replace(/\s+/g, ' ');
      // Store claims are filled from settings: no [token] may reach the shopper,
      // and the trial line carries the returns wording from Theme settings.
      const token = /\[[a-z_]+\]/.exec(resultText);
      if (token) fail(`finder result shows an unfilled placeholder ${token[0]}`);
      const terms = await page.evaluate(() => (window.Lunova && Lunova.settings && Lunova.settings.trialNights > 0 && Lunova.settings.trialTerms) || '');
      if (terms && !resultText.includes(terms.replace(/\s+/g, ' ').trim())) fail(`finder result trial line is missing the trial terms ("${terms}")`);
      await add.click();
      if (!(await drawerHasLine(page))) fail(`added from finder result but cart drawer did not open with the item (answered ${answered} steps)`);
      const personal = /Bella/.test(resultText);
      return { detail: `answered ${answered} questions${named ? ' + name' : ''} → result → drawer has item${personal ? ' · result personalised ("Bella")' : ' · WARN result does not mention the dog name'}` };
    }
    const name = await firstVisible(dialog, ['.finder-name input', 'input[autocomplete="off"][maxlength="40"]']);
    if (name && !named) { await name.fill('Bella'); await name.press('Enter'); named = true; await sleep(500); continue; }
    const radios = dialog.locator('[role="radio"]').filter({ visible: true });
    const n = await radios.count();
    if (n) {
      const before = await dialog.innerText();
      await radios.nth(Math.min(1, n - 1)).click();
      answered++;
      await sleep(550);
      const next = await firstVisible(dialog, ['.finder__next:not([hidden])', '[data-next]:not([hidden])']);
      if (next && (await dialog.innerText()) === before) await next.click();
      await sleep(250);
      continue;
    }
    const next = await firstVisible(dialog, ['.finder__next:not([hidden])', 'button:has-text("Next")', 'button[type="submit"]']);
    if (next) { await next.click(); await sleep(400); continue; }
    await sleep(400);
  }
  fail(`no result with an Add button after ${answered} answers`);
}

async function pdpFlow(page) {
  await page.goto(`${new URL(page.url()).origin}/products/${CFG.pdpHandle}`, { waitUntil: 'load' });
  const priceSel = ['[data-price-wrap]', '.buy-box__price', '.price'];
  const priceEl = await firstVisible(page, priceSel);
  if (!priceEl) fail('no visible price in the buy box');
  const before = (await priceEl.innerText()).replace(/\s+/g, ' ');
  const urlBefore = page.url();
  const labels = page.locator('variant-picker [data-value-label]').filter({ visible: true });
  const n = await labels.count();
  if (!n) fail('no visible size options ([data-value-label]) in variant-picker');
  let clicked = false;
  for (let i = 0; i < n; i++) {
    const l = labels.nth(i);
    const forId = await l.getAttribute('for');
    const checked = forId ? await page.locator(`#${forId}`).isChecked().catch(() => false) : false;
    if (!checked) { await l.click(); clicked = true; break; }
  }
  if (!clicked) fail('could not find an unselected size');
  const changed = await waitFor(async () => (await priceEl.innerText()).replace(/\s+/g, ' ') !== before && page.url() !== urlBefore, 3000);
  const after = (await priceEl.innerText()).replace(/\s+/g, ' ');
  if (!changed) fail(`size change did not update ${page.url() === urlBefore ? 'URL' : ''}${after === before ? ' price' : ''} (price "${before.slice(0, 40)}")`);
  if (!/variant=\d+/.test(page.url())) fail('URL has no ?variant= after size change');
  const add = await firstVisible(page, ['product-form [data-add-button]', '[data-add-button]', 'button[name="add"]']);
  if (!add) fail('no visible Add to basket button');
  const btnText = (await add.innerText()).replace(/\s+/g, ' ');
  await add.click();
  if (!(await drawerHasLine(page))) fail('Add to basket did not open the drawer with the item');
  return { detail: `price "${before.slice(0, 24)}" → "${after.slice(0, 24)}" · URL ?variant · button "${btnText.slice(0, 40)}" → drawer has item` };
}

async function drawerQtyFlow(page) {
  await page.goto(`${new URL(page.url()).origin}/products/${CFG.cartHandle}`, { waitUntil: 'load' });
  const add = await firstVisible(page, ['product-form [data-add-button]', '[data-add-button]']);
  if (!add) fail('no Add to basket button');
  await add.click();
  if (!(await drawerHasLine(page))) fail('drawer did not open with item');
  const plus = page.locator('cart-drawer [data-qty-step="1"]').filter({ visible: true }).first();
  if (!(await plus.count())) fail('no visible + quantity button in drawer');
  const c0 = await cartCount(page);
  await plus.click();
  if (!(await waitFor(async () => (await cartCount(page)) === c0 + 1, 5000))) fail(`+ did not increase the basket (still ${await cartCount(page)})`);
  const input = page.locator('cart-drawer [data-qty-input]').first();
  const shown = await waitFor(async () => String(await input.inputValue()) === String(c0 + 1), 3000);
  const remove = page.locator('cart-drawer [data-line-remove]').filter({ visible: true }).first();
  if (!(await remove.count())) fail('no visible remove control in drawer');
  await remove.click();
  if (!(await waitFor(async () => (await cartCount(page)) === 0, 5000))) fail('remove did not empty the basket');
  const linesGone = await waitFor(async () => (await page.locator('cart-drawer [data-line-key]').count()) === 0, 4000);
  if (!linesGone) fail('basket empty but drawer still shows lines');
  return { detail: `+ → ${c0 + 1}${shown ? ' (input updated)' : ' (WARN input not updated)'} · remove → empty drawer` };
}

async function quickAddFlow(page) {
  await page.goto(`${new URL(page.url()).origin}${CFG.quickAddPath}`, { waitUntil: 'load' });
  const cards = page.locator('[data-product-card]').filter({ visible: true });
  if (!(await cards.count())) fail('no product cards on collection page');
  let btn = null;
  for (let i = 0; i < Math.min(await cards.count(), 6); i++) {
    const c = cards.nth(i);
    await c.hover().catch(() => {});
    const b = c.locator('[data-quick-add]').first();
    if (await b.count()) { btn = b; break; }
  }
  if (!btn) fail('no [data-quick-add] button on any card');
  await btn.click({ force: true });
  const drawer = page.locator('quick-add-drawer[open]');
  if (!(await waitFor(async () => (await drawer.count()) > 0, 4000))) fail('quick-add drawer did not open');
  const content = page.locator('quick-add-drawer [data-quick-add-content]');
  if (!(await waitFor(async () => (await content.locator('[data-add-button], button[name="add"]').count()) > 0, 6000))) fail('quick-add drawer never showed an Add button (section quick-add-product)');
  const labels = content.locator('[data-value-label]').filter({ visible: true });
  if (await labels.count()) await labels.first().click();
  const add = content.locator('[data-add-button], button[name="add"]').filter({ visible: true }).first();
  await add.click();
  if (!(await drawerHasLine(page))) fail('adding from quick-add did not open the cart drawer with the item');
  return { detail: 'card → quick-add drawer → size → add → cart drawer has item' };
}

async function filterFlow(page) {
  await page.goto(`${new URL(page.url()).origin}/collections/all`, { waitUntil: 'load' });
  const countEl = await firstVisible(page, ['[data-results-count]', '.facets-bar__count', '[data-swap="bar-count"]']);
  const before = countEl ? await countEl.innerText() : '';
  const opener = await firstVisible(page, ['[data-facets-open]']);
  if (opener) { await opener.click(); await sleep(400); }
  const label = await firstVisible(page, ['[data-facets-panel] label.facets-list__label', '[data-facets-panel] label:has(input[type="checkbox"])', 'facet-filters label']);
  if (!label) fail(`no visible filter option${opener ? ' after opening the panel' : ' (no [data-facets-open] either)'}`);
  const labelText = (await label.innerText()).replace(/\s+/g, ' ').trim();
  await label.click();
  let ok = await waitFor(async () => /filter\./.test(page.url()), 2500);
  if (!ok) {
    const apply = await firstVisible(page, ['[data-facets-panel] button[type="submit"]', '[data-facets-apply]']);
    if (apply) { await apply.click(); ok = await waitFor(async () => /filter\./.test(page.url()), 5000); }
  }
  if (!ok) fail(`checking "${labelText}" did not apply a filter (URL has no filter.*)`);
  const after = countEl ? await countEl.innerText().catch(() => '') : '';
  return { detail: `"${labelText.slice(0, 30)}" → ${new URL(page.url()).search.slice(0, 60)}${before && after && before !== after ? ` · count "${before}" → "${after}"` : ''}` };
}

async function searchFlow(page) {
  await page.goto(`${new URL(page.url()).origin}/`, { waitUntil: 'load' });
  let opener = await firstVisible(page, ['[data-site-header] [data-search-open]', 'header [data-search-open]']);
  let via = 'header';
  if (!opener) {
    // Mobile: search lives in the menu drawer.
    const toggle = await firstVisible(page, ['[data-menu-open]', '[aria-controls="MenuDrawer"]']);
    if (toggle) { await toggle.click(); await sleep(400); opener = await firstVisible(page, ['#MenuDrawer [data-search-open]', 'menu-drawer [data-search-open]']); via = 'menu drawer'; }
  }
  if (!opener) fail('no visible [data-search-open] in the header or menu drawer');
  await opener.click();
  const input = await (async () => { await waitFor(async () => !!(await firstVisible(page, ['#SearchModalInput', 'search-modal input[type="search"]'])), 3000); return firstVisible(page, ['#SearchModalInput', 'search-modal input[type="search"]']); })();
  if (!input) fail('search modal input did not appear');
  await input.pressSequentially(CFG.searchTerm, { delay: 60 });
  const results = page.locator('[data-predictive-results]');
  const expect = new RegExp(CFG.searchExpect, 'i');
  const ok = await waitFor(async () => (await results.isVisible()) && expect.test(await results.innerText()), 5000);
  if (!ok) fail(`typing "${CFG.searchTerm}" did not show predictive results containing "${CFG.searchExpect}"`);
  const expanded = await input.getAttribute('aria-expanded');
  return { detail: `opened from ${via} · "${CFG.searchTerm}" → results incl. ${CFG.searchExpect} · aria-expanded=${expanded}` };
}

async function menuFlow(page) {
  await page.goto(`${new URL(page.url()).origin}/`, { waitUntil: 'load' });
  const toggle = await firstVisible(page, ['[data-menu-open]', '[aria-controls="MenuDrawer"]']);
  if (!toggle) fail('no visible menu toggle at mobile width');
  await toggle.click();
  const open = await waitFor(async () => (await page.locator('menu-drawer[open], #MenuDrawer[open]').count()) > 0 || (await page.locator('#MenuDrawer dialog[open]').count()) > 0, 3000);
  if (!open) fail('menu drawer did not open');
  await sleep(300);
  await page.keyboard.press('Escape');
  const closed = await waitFor(async () => (await page.locator('menu-drawer[open], #MenuDrawer[open], #MenuDrawer dialog[open]').count()) === 0, 3000);
  if (!closed) fail('Escape did not close the menu drawer');
  await sleep(350);
  const focusBack = await page.evaluate(() => !!document.activeElement && (document.activeElement.matches('[data-menu-open], [aria-controls="MenuDrawer"]')));
  const expanded = await toggle.getAttribute('aria-expanded');
  return { status: focusBack ? 'PASS' : 'FAIL', detail: `open → Escape → closed · focus returned to toggle: ${focusBack} · aria-expanded=${expanded}` };
}

async function stickyFlow(page) {
  // Rule: the bar shows whenever the main Add button is out of view (below
  // the fold at first paint, or scrolled up past the top), hides while the
  // main button is on screen, and never greets a visitor below the fold
  // with a disabled "Sold out" bar.
  const origin = new URL(page.url()).origin;
  await page.goto(`${origin}/products/${CFG.stickyHandle}`, { waitUntil: 'load' });
  const bar = page.locator('sticky-atc').first();
  if (!(await bar.count())) fail('no <sticky-atc> on the product page');
  const isShown = () => bar.evaluate((el) => el.classList.contains('is-visible') && !el.inert && el.getAttribute('aria-hidden') === 'false' && el.getBoundingClientRect().height > 0 && el.getBoundingClientRect().top < innerHeight);
  const isHidden = () => bar.evaluate((el) => !el.classList.contains('is-visible') && el.inert && el.getAttribute('aria-hidden') === 'true');
  const mainRect = () => page.evaluate(() => { const b = document.querySelector('product-form [data-add-button]'); if (!b) return null; const r = b.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, vh: innerHeight }; });
  const notes = [];
  // 1. first paint: main Add below the fold → bar visible; in view → bar hidden
  const r0 = await mainRect();
  if (!r0) fail('no main Add button (product-form [data-add-button])');
  const belowFold = r0.top > r0.vh;
  await sleep(300);
  if (belowFold) {
    if (!(await waitFor(isShown, 2000))) fail(`main Add starts below the fold (top ${Math.round(r0.top)} > ${r0.vh}) but the sticky bar is hidden at first paint`);
    notes.push(`at top (Add at ${Math.round(r0.top)}px): bar shown`);
  } else {
    if (!(await waitFor(isHidden, 2000))) fail('main Add is in view at first paint but the sticky bar is showing too');
    notes.push('at top (Add in view): bar hidden');
  }
  // 2. realistic scrolling (wheel steps) until the main Add button is fully in view → bar hides
  await page.mouse.move(195, 400);
  let inView = false;
  for (let i = 0; i < 40; i++) {
    const r = await mainRect();
    if (r.top >= 0 && r.bottom <= r.vh - 120) { inView = true; break; }
    await page.mouse.wheel(0, Math.max(60, Math.min(300, r.top - r.vh / 2)));
    await sleep(140);
  }
  if (!inView) fail('could not scroll the main Add button into view');
  if (!(await waitFor(isHidden, 2000))) fail('sticky bar stayed visible while the main Add button was on screen (two Add buttons in view)');
  notes.push('hides while main Add in view');
  // 3. keep scrolling until the main Add has left the top → bar shows again
  for (let i = 0; i < 40; i++) {
    const r = await mainRect();
    if (r.bottom < -150) break;
    await page.mouse.wheel(0, 350);
    await sleep(120);
  }
  if (!(await waitFor(isShown, 3000))) fail('sticky add-to-basket did not reappear after scrolling past the main Add button');
  notes.push('shows again after scrolling past it');
  // 4. jump straight past the button (reload with restored scroll / anchor link)
  await page.goto(`${origin}/products/${CFG.stickyHandle}`, { waitUntil: 'load' });
  await page.evaluate(() => { const b = document.querySelector('product-form [data-add-button]'); scrollTo(0, b.getBoundingClientRect().bottom + scrollY + 1200); });
  const jumpOk = await waitFor(isShown, 2000);
  notes.push(`after a jump past it (reload/anchor): ${jumpOk}`);
  // 5. a sold-out product never greets the visitor with a disabled bar
  if (CFG.soldOutHandle) await page.goto(`${origin}/products/${CFG.soldOutHandle}`, { waitUntil: 'load' });
  await sleep(400);
  const soldOutBelow = !!CFG.soldOutHandle && await page.evaluate(() => { const b = document.querySelector('product-form [data-add-button]'); return !!b && b.disabled && b.getBoundingClientRect().top > innerHeight; });
  let soldOutOk = true;
  if (soldOutBelow) {
    soldOutOk = await waitFor(isHidden, 1000);
    if (!soldOutOk) fail('sold-out product: a disabled sticky bar shows at first paint');
    notes.push('sold out at top: bar hidden');
  }
  return { status: jumpOk ? 'PASS' : 'WARN', detail: notes.join(' · ') };
}

// ------------------------------------------------------------------ colour + size PDP
const escRe = (x) => String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pounds = (c) => (Number(c) / 100).toFixed(2);

/**
 * PDP with a colour and a size option: pick another colour, then a size whose price
 * differs; the price, ?variant= and the variant that lands in the basket must all be
 * the one for that colour + size.
 */
function pdpColourFlow(prod) {
  return async (page) => {
    const origin = new URL(page.url()).origin;
    await page.goto(`${origin}${prod.url}`, { waitUntil: 'load' });
    const cIdx = prod.options.findIndex(isColourName);
    const sIdx = prod.options.findIndex(isSizeName);
    if (cIdx < 0 || sIdx < 0) fail(`${prod.handle}: needs a colour and a size option (${prod.options.join(' / ')})`);
    const picker = page.locator('variant-picker').filter({ visible: true }).first();
    if (!(await picker.count())) fail('no visible variant-picker');
    const urlVariant = () => { const m = page.url().match(/[?&]variant=(\d+)/); return m ? Number(m[1]) : null; };
    const variantFor = (vals) => prod.variants.find((v) => vals.every((x, i) => x == null || v.options[i] === x));
    const current = () => prod.variants.find((v) => v.id === urlVariant()) || prod.selected_or_first_available_variant;
    const priceEl = await firstVisible(page, ['[data-price-wrap]', '.buy-box__price', '.price']);
    if (!priceEl) fail('no visible price in the buy box');
    const price = async () => (await priceEl.innerText()).replace(/\s+/g, ' ');
    const choose = async (idx, value) => {
      const group = picker.locator(`fieldset[data-option-index="${idx}"]`);
      if (!(await group.count())) fail(`no fieldset[data-option-index="${idx}"] for "${prod.options[idx]}"`);
      const target = group.locator(`[data-value-label][data-value="${value.replace(/["\\]/g, '\\$&')}"]`).filter({ visible: true }).first();
      if (!(await target.count())) fail(`"${prod.options[idx]}" has no visible option "${value}"`);
      await target.click();
    };
    const notes = [];
    // 1. another colour (same size)
    const start = current();
    const colours = [...new Set(prod.variants.map((v) => v.options[cIdx]))];
    const colour = colours.find((c) => c !== start.options[cIdx] && variantFor(start.options.map((x, i) => (i === cIdx ? c : x))));
    if (!colour) fail(`no second colour with the size "${start.options[sIdx]}"`);
    await choose(cIdx, colour);
    const v1 = variantFor(start.options.map((x, i) => (i === cIdx ? colour : x)));
    if (!(await waitFor(async () => urlVariant() === v1.id, 3000))) fail(`colour "${colour}" → URL variant ${urlVariant()}, expected ${v1.id} (${v1.title})`);
    notes.push(`colour → ${colour} (variant ${v1.id})`);
    // 2. a size with a different price, keeping that colour
    const v2 = prod.variants.find((v) => v.options[cIdx] === colour && v.options[sIdx] !== v1.options[sIdx] && v.price !== v1.price && v.available)
      || prod.variants.find((v) => v.options[cIdx] === colour && v.options[sIdx] !== v1.options[sIdx] && v.available);
    if (!v2) fail(`no other size in "${colour}"`);
    const before = await price();
    await choose(sIdx, v2.options[sIdx]);
    if (!(await waitFor(async () => urlVariant() === v2.id, 3000))) fail(`size "${v2.options[sIdx]}" → URL variant ${urlVariant()}, expected ${v2.id} (${v2.title})`);
    const after = await price();
    if (v2.price !== v1.price && !(await waitFor(async () => (await price()).replace(/,/g, '').includes(pounds(v2.price)) || (await price()).includes(String(v2.price / 100)), 3000))) fail(`price shows "${after.slice(0, 40)}", expected £${pounds(v2.price)} for ${v2.title}`);
    notes.push(`size → ${v2.options[sIdx].slice(0, 24)}: "${before.slice(0, 16)}" → "${(await price()).slice(0, 16)}"`);
    // 3. the basket gets exactly that variant
    const add = await firstVisible(page, ['product-form [data-add-button]', '[data-add-button]', 'button[name="add"]']);
    if (!add) fail('no visible Add to basket button');
    await add.click();
    if (!(await drawerHasLine(page))) fail('Add to basket did not open the drawer with the item');
    const ids = await page.evaluate(() => fetch('/cart.js', { headers: { Accept: 'application/json' } }).then((r) => r.json()).then((c) => c.items.map((i) => i.variant_id)));
    if (!ids.includes(v2.id)) fail(`basket holds variant(s) ${ids.join(',')} — expected ${v2.id} (${v2.title})`);
    notes.push('basket has that variant');
    return { detail: `${prod.handle.slice(0, 28)}: ${notes.join(' · ')}` };
  };
}

// ------------------------------------------------------------------ finder matrix
const STYLES = ['curl', 'lean', 'sprawl'];
const STAGES = ['fine', 'slowing', 'diagnosed'];
/** Never a finder answer for "which bed": kennels/day beds and the car seat. */
const notABed = (p) => (p && /^Dog Houses/i.test(p.type || '') ? `product_type "${p.type}"` : p && /car seat/i.test(p.title || '') ? 'a car seat' : null);
/** XS…XXL as 0…5 from a size label or title ("XL · 114 × 89cm", "Medium: Cocker…", "Bowfell XXL …"). */
function sizeClass(text) {
  const t = String(text || '').toLowerCase();
  if (/\b(xxl|2xl|xx-?large|extra extra large)\b/.test(t)) return 5;
  if (/\b(xl|x-?large|extra large)\b/.test(t)) return 4;
  if (/\b(xs|x-?small|extra small)\b/.test(t)) return 0;
  if (/\b(s|small)\b/.test(t)) return 1;
  if (/\b(m|medium)\b/.test(t)) return 2;
  if (/\b(l|large)\b/.test(t)) return 3;
  return null;
}

/**
 * Every style × stage × size answer through the theme's own finder (finder.js, via its
 * lunova:finder:open event with step "result"), recorded and checked: there must be a
 * result, and it must be a bed. Writes .out/finder-matrix[-real].json.
 */
async function finderMatrix(browser, base, vp, store) {
  const name = `${PREFIX}finder style×stage×size@${vp.w}`;
  const ctx = await newContext(browser, base, vp, { reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const w = watch(page, base);
  const byHandle = new Map(store.products().map((p) => [p.handle, p]));
  const records = [];
  try {
    await setMode(ctx, base, RUN_MODE);
    await page.goto(`${base}/pages/bed-finder`, { waitUntil: 'load' });
    let where = 'inline (/pages/bed-finder)';
    if (!(await page.locator('bed-finder[mode="inline"]').count())) {
      await page.goto(`${base}/`, { waitUntil: 'load' });
      where = 'modal (/)';
    }
    if (!(await waitFor(async () => page.evaluate(() => !!customElements.get('bed-finder') && !!document.querySelector('bed-finder')), 8000))) fail('no <bed-finder> element (finder.js not loaded?)');
    const hints = await page.evaluate(() => {
      const ok = (l) => (Array.isArray(l) && l.length && l.every((h) => h && h.value) ? l : null);
      let cfg = null;
      try { cfg = JSON.parse(document.getElementById('finder-config').textContent); } catch { /* none */ }
      return ok(cfg && cfg.sizeHints) || ok(window.Lunova && Lunova.settings && Lunova.settings.sizeHints) || ['XS', 'S', 'M', 'L', 'XL'].map((value) => ({ value }));
    });
    const sizes = hints.map((h) => h.value);
    for (const style of STYLES) for (const stage of STAGES) for (const size of sizes) {
      const r = await page.evaluate(async ({ style, stage, size }) => {
        const root = document.querySelector('bed-finder[mode="inline"]') || document.querySelector('bed-finder');
        root.querySelectorAll('.finder-result').forEach((el) => el.setAttribute('data-matrix-stale', ''));
        const detail = { step: 'result', answers: { style, stage, size } };
        if (window.Lunova && typeof Lunova.emit === 'function') Lunova.emit('lunova:finder:open', detail);
        else document.dispatchEvent(new CustomEvent('lunova:finder:open', { detail }));
        const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
        const leak = (el) => { const m = el && (el.innerText || '').match(/.{0,28}&(?:#\d+|#x[0-9a-f]+|amp|quot|lt|gt|apos|nbsp);.{0,8}/i); return m ? m[0] : null; };
        const t0 = Date.now();
        while (Date.now() - t0 < 12000) {
          const res = root.querySelector('.finder-result:not([data-matrix-stale])');
          if (res) {
            if (res.classList.contains('finder-result--empty')) return { empty: true, heading: txt(res.querySelector('h2, h3')), text: txt(res).slice(0, 200), leak: leak(root) };
            const link = res.querySelector('.finder-result__link');
            const altView = res.querySelector('.finder-alt__view') || (root.querySelector('.finder-alt:not([data-matrix-stale]) .finder-alt__view'));
            // What the result promises, against the theme's own verdicts in the product JSON.
            const cfg = window.Lunova && Lunova.finderEngine ? Lunova.finderEngine.config() : null;
            const hrefPath = link ? new URL(link.getAttribute('href'), location.href).pathname : '';
            const handle = (hrefPath.match(/\/products\/([^/]+)/) || [])[1];
            const prod = cfg && handle ? cfg.products[decodeURIComponent(handle)] : null;
            const years = window.Lunova && Lunova.settings ? Number(Lunova.settings.guaranteeYears) || 0 : 0;
            const nights = window.Lunova && Lunova.settings ? Number(Lunova.settings.trialNights) || 0 : 0;
            const gText = cfg && cfg.copy && cfg.copy.guaranteeText ? cfg.copy.guaranteeText.replace(/\[years\]/g, years) : '';
            const riskText = txt(res.querySelector('.finder-result__risk'));
            const whyText = txt(res.querySelector('.finder-result__bullets'));
            const claims = {
              foam: prod ? prod.foam : null,
              trial: prod ? prod.trial : null,
              personalised: prod ? prod.personalised === true : null,
              perNight: !!res.querySelector('.finder-result__per-night'),
              guarantee: !!gText && riskText.indexOf(gText) > -1,
              trialLine: nights > 0 && (new RegExp('\\b' + nights + '[- ]night')).test(riskText + ' ' + whyText),
              addIsLink: !!res.querySelector('a.finder-result__add'),
            };
            return {
              claims,
              href: link ? link.getAttribute('href') : null,
              title: txt(link),
              sizeLine: txt(res.querySelector('.finder-result__size')),
              add: txt(res.querySelector('.finder-result__add, [data-finder-add]')),
              altHref: altView ? altView.getAttribute('href') : null,
              leak: leak(root),
            };
          }
          await new Promise((ok) => setTimeout(ok, 50));
        }
        return { timeout: true, step: root.state ? root.state.step : null };
      }, { style, stage, size });
      const parse = (href) => {
        if (!href) return { handle: null, variant: null };
        const u = new URL(href, base);
        const m = u.pathname.match(/\/products\/([^/?#]+)/);
        return { handle: m ? decodeURIComponent(m[1]) : null, variant: Number(u.searchParams.get('variant')) || null };
      };
      const main = parse(r.href);
      const alt = parse(r.altHref);
      const prod = main.handle ? byHandle.get(main.handle) : null;
      const altProd = alt.handle ? byHandle.get(alt.handle) : null;
      const variant = prod && main.variant ? prod.variants.find((v) => v.id === main.variant) : null;
      const rec = {
        style, stage, size,
        result: prod ? { handle: prod.handle, title: prod.title, type: prod.type, variant: variant ? variant.title : null, sizeLine: r.sizeLine } : main.handle ? { handle: main.handle, title: r.title, type: null, unknown: true } : null,
        alternative: altProd ? { handle: altProd.handle, title: altProd.title, type: altProd.type } : alt.handle ? { handle: alt.handle, unknown: true } : null,
        empty: r.empty ? { heading: r.heading } : null,
        timeout: !!r.timeout,
        problems: [],
      };
      // Size fit (WARN only): which dog the chosen size is for vs the answer. Breed-labelled
      // sizes ("Large: Cocker Spaniel | …") must match; a size word may be one step up
      // (the finder offers the next size when one is missing or sold out).
      const asked = sizes.indexOf(size);
      const label = variant && !variant.options.every((o) => o === 'Default Title') ? (prod.options.findIndex(isSizeName) > -1 ? variant.options[prod.options.findIndex(isSizeName)] : variant.title) : prod ? prod.title : '';
      const fit = prod ? fitClass(label, hints) : null;
      // One size up is the finder's stated fallback ("the next size up"), whatever names the
      // size; a smaller size is wrong when its breeds say so, or two size words away.
      if (fit && asked > -1 && (fit.cls > asked ? fit.cls - asked >= 2 : asked - fit.cls >= (fit.via === 'breeds' ? 1 : 2))) rec.sizeFit = `asked ${size}, got "${label}" (${fit.via === 'breeds' ? `for ${hints[fit.cls] ? hints[fit.cls].value : '?'} dogs by its breeds` : 'by its size word'})`;
      if (r.timeout) rec.problems.push(`no result within 12s (finder step: ${r.step})`);
      else if (r.empty) rec.problems.push(`no bed: "${r.heading}"`);
      else if (!main.handle) rec.problems.push('result has no product link');
      const bad = notABed(prod);
      if (bad) rec.problems.push(`result is ${bad}: ${prod.title}`);
      const badAlt = notABed(altProd);
      if (badAlt) rec.problems.push(`alternative is ${badAlt}: ${altProd.title}`);
      if (r.leak) rec.leak = r.leak;
      const c = r.claims;
      if (c) {
        rec.claims = c;
        if (c.perNight && c.foam !== true) rec.problems.push(`per-night sum on ${prod ? prod.title : main.handle}, which the foam guarantee doesn't cover`);
        if (c.guarantee && c.foam !== true) rec.problems.push(`guarantee line on ${prod ? prod.title : main.handle}, which the foam guarantee doesn't cover`);
        if (c.trialLine && c.trial === false) rec.problems.push(`trial line on ${prod ? prod.title : main.handle}, which the trial doesn't cover`);
        if (c.personalised && !c.addIsLink) rec.problems.push(`Add puts ${prod ? prod.title : main.handle} in the basket without the name it's made with`);
      }
      records.push(rec);
    }
    // ---- report
    const failing = records.filter((r) => r.problems.length);
    for (const r of failing) report('FAIL', 'matrix', `${PREFIX}finder ${r.style}/${r.stage}/${r.size}@${vp.w}`, r.problems.join(' · '));
    const short = (r) => (r.result ? r.result.title.replace(/^The /, '').split(/\s+/).slice(0, 2).join(' ') : r.timeout ? '(timeout)' : '(none)');
    console.log(`       finder matrix — ${where}, sizes ${sizes.join('/')}  (! = problem, ~ = size made for a different dog)`);
    for (const style of STYLES) for (const stage of STAGES) {
      const row = sizes.map((size) => { const r = records.find((x) => x.style === style && x.stage === stage && x.size === size); return `${size}:${short(r)}${r.problems.length ? '!' : r.sizeFit ? '~' : ''}`; });
      console.log(`       ${`${style}/${stage}`.padEnd(18)} ${row.join(' | ')}`);
    }
    const counts = {};
    for (const r of records) if (r.result) counts[r.result.title] = (counts[r.result.title] || 0) + 1;
    const n = (pred) => records.filter(pred).length;
    const summary = `${records.length} answers · ${records.length - failing.length} ok · ${n((r) => r.problems.some((x) => /Dog Houses/.test(x)))} dog house · ${n((r) => r.problems.some((x) => /car seat/.test(x)))} car seat · ${n((r) => r.empty || r.timeout || (!r.result && !r.empty))} no result · ${Object.keys(counts).length} distinct beds`;
    const file = path.join(OUT_DIR, `finder-matrix${REAL ? '-real' : ''}.json`);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ mode: RUN_MODE, viewport: vp, where, sizes, summary, distinct: counts, records }, null, 2));
    const leaked = [...new Set(records.map((r) => r.leak).filter(Boolean))];
    if (leaked.length) report('FAIL', 'matrix', `${PREFIX}finder result text@${vp.w}`, `HTML entity shown as text in ${records.filter((r) => r.leak).length}/${records.length} results: "${leaked.slice(0, 2).join('" | "')}"`);
    const misfit = records.filter((r) => r.sizeFit && !r.problems.length);
    if (misfit.length) report('WARN', 'matrix', `${PREFIX}finder size fit@${vp.w}`, `${misfit.length}/${records.length} answers get a size made for a different dog, e.g. ${misfit.slice(0, 3).map((r) => `${r.style}/${r.stage}/${r.size} → ${r.result.title.split(/\s+/).slice(0, 2).join(' ')} ${r.sizeFit.replace(/^asked \S+, got /, '')}`).join('; ')} (all in ${path.relative(HARNESS_DIR, path.join(OUT_DIR, `finder-matrix${REAL ? '-real' : ''}.json`))})`);
    const js = [...w.pageErrors, ...w.console];
    if (js.length) report('FAIL', 'matrix', name, `${summary} — but JS errors: ${js.slice(0, 2).join(' | ')}`);
    else report(failing.length ? 'FAIL' : 'PASS', 'matrix', name, `${summary} → ${path.relative(HARNESS_DIR, file)}`);
  } catch (e) {
    report('FAIL', 'matrix', name, `${e.message.split('\n')[0]}${w.pageErrors.length ? ` · JS: ${w.pageErrors[0]}` : ''}`);
  } finally {
    await ctx.close();
  }
}

// ------------------------------------------------------------------ offer (Theme settings → Offer)
// The offer must never be claimed where the basket won't get it. Each flow pins the
// offer and the store's automatic discount with the dev cookies (server.mjs), so the
// results don't depend on today's date: settings offer_* (theme_dev_settings) and a
// £15-off-£129 automatic discount with no end (theme_dev_discounts).
const OFFER = { label: 'Cosy Season Saving', amount: 1500, min: 12900 };
const ukStamp = (ms) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
const shortMoney = (c) => `£${Number(c) % 100 ? (Number(c) / 100).toFixed(2) : Number(c) / 100}`;

async function offerCookies(ctx, base, { ends, discounts } = {}) {
  const settings = {
    offer_enable: true,
    offer_label: OFFER.label,
    offer_amount: OFFER.amount / 100,
    offer_min_subtotal: OFFER.min / 100,
    offer_ends: ends || ukStamp(Date.now() + 30 * 86400000),
  };
  const disc = discounts || [{ title: `${OFFER.label}: £15 Off.`, amount: OFFER.amount, min: OFFER.min }];
  await ctx.addCookies([
    { name: 'theme_dev_settings', value: encodeURIComponent(JSON.stringify(settings)), url: base },
    { name: 'theme_dev_discounts', value: encodeURIComponent(JSON.stringify(disc)), url: base },
  ]);
}

/** A size-only product with a size under the minimum and one at or over it. */
function offerProduct(store) {
  for (const p of store.products()) {
    if (!p.available || p.options.length !== 1 || !isSizeName(p.options[0])) continue;
    const vs = p.variants.filter((v) => v.available);
    const below = vs.filter((v) => v.price < OFFER.min).sort((a, b) => a.price - b.price)[0];
    const above = vs.filter((v) => v.price >= OFFER.min).sort((a, b) => a.price - b.price)[0];
    if (below && above) return { handle: p.handle, below: { id: below.id, value: below.options[0], price: below.price }, above: { id: above.id, value: above.options[0], price: above.price } };
  }
  return null;
}

async function readOffer(page) {
  return page.evaluate(() => {
    const box = document.querySelector('[data-product-scope] [data-offer-pdp]');
    if (!box) return null;
    const vis = (el) => !!el && !el.hidden && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none';
    const line = box.querySelector('[data-offer-line]');
    const nudge = box.querySelector('[data-offer-nudge]');
    return { state: box.getAttribute('data-state'), shown: vis(box), line: vis(line), nudge: vis(nudge), lineText: line ? line.innerText.replace(/\s+/g, ' ').trim() : '', nudgeText: nudge ? nudge.innerText.replace(/\s+/g, ' ').trim() : '' };
  });
}

function offerPdpFlow(P) {
  return async (page) => {
    if (!P) return { status: 'SKIP', detail: 'no size-only product with sizes either side of the offer minimum' };
    const origin = new URL(page.url()).origin;
    await offerCookies(page.context(), origin);
    // 1. below the minimum: one quiet line naming the size that qualifies, never the net line too
    await page.goto(`${origin}/products/${P.handle}?variant=${P.below.id}`, { waitUntil: 'load' });
    let o = await readOffer(page);
    if (!o || !o.shown) fail(`price ${shortMoney(P.below.price)} is under the minimum but no offer nudge shows`);
    if (o.state !== 'nudge' || !o.nudge || o.line) fail(`under the minimum: expected only the nudge, got state ${o.state} line=${o.line} nudge=${o.nudge}`);
    if (!/qualifies for £15 off/.test(o.nudgeText) || !o.nudgeText.includes(shortMoney(P.above.price))) fail(`nudge text "${o.nudgeText}" doesn't name ${shortMoney(P.above.price)} qualifying for £15 off`);
    const marks = await page.evaluate(() => [...document.querySelectorAll('[data-product-scope] variant-picker [data-value-label]')].map((l) => ({ v: l.getAttribute('data-value'), m: !!l.querySelector('[data-value-offer]:not([hidden])') })));
    const markAbove = marks.find((m) => m.v === P.above.value);
    const markBelow = marks.find((m) => m.v === P.below.value);
    if (!markAbove || !markAbove.m || (markBelow && markBelow.m)) fail(`size marks wrong: ${JSON.stringify(marks).slice(0, 160)}`);
    // 2. a size at or over the minimum: "£15 off at checkout — you pay £X", no nudge
    await page.locator(`[data-product-scope] variant-picker [data-value-label][data-value="${P.above.value.replace(/"/g, '\\"')}"]`).filter({ visible: true }).first().click();
    const net = shortMoney(P.above.price - OFFER.amount);
    if (!(await waitFor(async () => { o = await readOffer(page); return o && o.state === 'line'; }, 3000))) fail(`choosing ${P.above.value} (${shortMoney(P.above.price)}) didn't show the net price (state ${o && o.state})`);
    if (!o.line || o.nudge) fail(`over the minimum: line=${o.line} nudge=${o.nudge} (never both)`);
    if (!/£15 off at checkout/.test(o.lineText) || !o.lineText.includes(`you pay ${net}`)) fail(`net line "${o.lineText}" should say £15 off at checkout — you pay ${net}`);
    // 3. back under: nudge again
    await page.locator(`[data-product-scope] variant-picker [data-value-label][data-value="${P.below.value.replace(/"/g, '\\"')}"]`).filter({ visible: true }).first().click();
    if (!(await waitFor(async () => { o = await readOffer(page); return o && o.state === 'nudge' && !o.line; }, 3000))) fail('switching back under the minimum did not return to the nudge');
    return { detail: `${P.handle}: ${P.below.value} → "${o.nudgeText.slice(0, 44)}" · ${P.above.value} → "…you pay ${net}" · marks on qualifying sizes only` };
  };
}

function offerEndedFlow(P) {
  return async (page) => {
    if (!P) return { status: 'SKIP', detail: 'no product with sizes either side of the offer minimum' };
    const origin = new URL(page.url()).origin;
    const ctx = page.context();
    // 1. Liquid: an end date in the past (settings override) → nothing rendered anywhere
    await offerCookies(ctx, origin, { ends: '2020-01-01 00:00' });
    await page.goto(`${origin}/products/${P.handle}?variant=${P.above.id}`, { waitUntil: 'load' });
    const pdpLeft = await page.locator('[data-offer]').count();
    if (pdpLeft) fail(`offer ended (offer_ends 2020-01-01) but ${pdpLeft} [data-offer] element(s) still render on the product page`);
    const ann = await page.locator('announcement-bar').allInnerTexts();
    if (ann.some((t) => /£15 off/.test(t))) fail('offer ended but the announcement bar still advertises it');
    await page.goto(`${origin}${CFG.quickAddPath}`, { waitUntil: 'load' });
    const badges = await page.locator('.badge--offer').count();
    if (badges) fail(`offer ended but ${badges} card badge(s) still show it`);
    // 2. JS: a page rendered while the offer ran, read after its end on the shopper's clock
    const ends = Date.now() + 2 * 86400000;
    await offerCookies(ctx, origin, { ends: ukStamp(ends) });
    await page.clock.install({ time: new Date(ends + 3600000) });
    await page.goto(`${origin}/products/${P.handle}?variant=${P.above.id}`, { waitUntil: 'load' });
    const rendered = await page.locator('[data-offer-pdp]').count();
    const ended = await page.evaluate(() => document.documentElement.classList.contains('offer-ended'));
    const visible = await page.locator('[data-offer]').filter({ visible: true }).count();
    if (!rendered) fail('control: with a future end date the server should still render the offer');
    if (!ended || visible) fail(`past the end on the shopper's clock: html.offer-ended=${ended}, ${visible} offer element(s) still visible`);
    return { detail: `past end (setting) → 0 offer elements on PDP, bar and cards · rendered but past end (clock) → html.offer-ended, ${rendered} hidden` };
  };
}

function offerCartFlow(P) {
  return async (page) => {
    if (!P) return { status: 'SKIP', detail: 'no product with sizes either side of the offer minimum' };
    const origin = new URL(page.url()).origin;
    const ctx = page.context();
    await offerCookies(ctx, origin);
    const add = (id) => ctx.request.post(`${origin}/cart/add.js`, { data: { items: [{ id, quantity: 1 }] } });
    // 1. under the minimum: the goal bar, never beside the free-delivery bar
    await add(P.below.id);
    await page.goto(`${origin}/cart`, { waitUntil: 'load' });
    const bar = page.locator('[data-offer-bar]').filter({ visible: true });
    if (!(await bar.count())) fail(`basket ${shortMoney(P.below.price)} is under ${shortMoney(OFFER.min)} but no "away from £15 off" bar`);
    const barText = (await bar.first().innerText()).replace(/\s+/g, ' ');
    const away = shortMoney(OFFER.min - P.below.price);
    if (!barText.includes(`${away} away from £15 off`)) fail(`goal bar "${barText.slice(0, 80)}" should say ${away} away from £15 off`);
    if (await page.locator('[data-free-shipping]:not([data-offer-bar])').filter({ visible: true }).count()) fail('offer bar and free-delivery bar both show');
    if (await page.locator('.cart__discounts').count()) fail('a discount line shows before Shopify applied any discount');
    // 2. over the minimum: Shopify's own discount application, named by the offer
    await add(P.above.id);
    await page.goto(`${origin}/cart`, { waitUntil: 'load' });
    const line = page.locator('.cart__discounts li').first();
    if (!(await line.count())) fail('the automatic discount applied but no discount line shows on the basket page');
    const lineText = (await line.innerText()).replace(/\s+/g, ' ');
    if (!lineText.includes(OFFER.label) || !lineText.includes('−£15.00')) fail(`discount line "${lineText}" should read "${OFFER.label} −£15.00"`);
    if (await page.locator('[data-offer-bar]').count()) fail('goal bar still shows once the discount is applied');
    // 3. the drawer says the same after an add from the product page, and the PDP stops promising another £15
    await page.goto(`${origin}/products/${P.handle}?variant=${P.above.id}`, { waitUntil: 'load' });
    const o = await readOffer(page);
    if (o && o.line) fail('basket already has the discount, but the product page still offers "£15 off — you pay…"');
    await page.locator('product-form [data-add-button]').first().click();
    if (!(await drawerHasLine(page))) fail('drawer did not open');
    const dl = page.locator('cart-drawer [data-cart-discounts] li').first();
    if (!(await waitFor(async () => (await dl.count()) > 0, 4000))) fail('drawer shows no discount line');
    const dText = (await dl.innerText()).replace(/\s+/g, ' ');
    if (!dText.includes(OFFER.label) || !dText.includes('−£15.00')) fail(`drawer discount line "${dText}"`);
    const deliv = await page.locator('cart-drawer [data-delivery-options]').filter({ visible: true }).count();
    return { status: deliv ? 'PASS' : 'WARN', detail: `under → "${barText.slice(0, 40)}…" · over → "${lineText}" (page + drawer) · PDP state ${o ? o.state : 'none'}${deliv ? ' · drawer delivery line' : ' · WARN no delivery line in drawer'}` };
  };
}

/**
 * One per order, and it combines with no other discount (the live discount's
 * Combinations are all off): once the basket has it, card badges and size
 * marks stop promising it; with another discount in play (Google's automated
 * discount: the _gad cart attribute, or its ?pv2= landing link) the product
 * page, the goal bar and the offer banner say nothing about it at all.
 */
function offerOneDiscountFlow(P) {
  return async (page) => {
    if (!P) return { status: 'SKIP', detail: 'no product with sizes either side of the offer minimum' };
    const origin = new URL(page.url()).origin;
    const ctx = page.context();
    await offerCookies(ctx, origin);
    const visibleCount = (sel) => page.locator(sel).filter({ visible: true }).count();
    const add = (id) => ctx.request.post(`${origin}/cart/add.js`, { data: { items: [{ id, quantity: 1 }] } });
    // control: an empty basket shows the card badges
    await page.goto(`${origin}${CFG.quickAddPath}`, { waitUntil: 'load' });
    const before = await visibleCount('.badge--offer');
    if (!before) fail('control: no offer badge on any card with an empty basket');
    // 1. applied → no card badge, no size mark promises a second £15
    await add(P.above.id);
    await page.goto(`${origin}${CFG.quickAddPath}`, { waitUntil: 'load' });
    const after = await visibleCount('.badge--offer');
    if (after) fail(`the basket already has the £15 off, but ${after} card badge(s) still offer it`);
    await page.goto(`${origin}/products/${P.handle}?variant=${P.below.id}`, { waitUntil: 'load' });
    const marks = await visibleCount('[data-product-scope] [data-value-offer]');
    if (marks) fail(`the basket already has the £15 off, but ${marks} size mark(s) still offer it`);
    // 2. another discount in play (the _gad attribute) → nothing promises it
    await ctx.request.post(`${origin}/cart/clear.js`);
    await ctx.request.post(`${origin}/cart/update.js`, { data: { attributes: { _gad: 'test' } } });
    await add(P.below.id);
    await page.goto(`${origin}/products/${P.handle}?variant=${P.above.id}`, { waitUntil: 'load' });
    if (await visibleCount('[data-product-scope] [data-offer-pdp]')) fail('another discount is on the basket (_gad), but the product page still promises £15 off');
    if (await visibleCount('[data-offer-banner]')) fail('another discount is on the basket (_gad), but the offer banner still shows');
    await page.goto(`${origin}/cart`, { waitUntil: 'load' });
    if (await visibleCount('[data-offer-bar]')) fail('another discount is on the basket (_gad), but the "away from £15 off" bar still shows');
    // 3. a Google automated-discount landing link (?pv2=) with an empty basket
    await ctx.request.post(`${origin}/cart/clear.js`);
    await page.goto(`${origin}/products/${P.handle}?variant=${P.above.id}&pv2=test`, { waitUntil: 'load' });
    if (await visibleCount('[data-product-scope] [data-offer-pdp]')) fail('Google discount landing (?pv2=) but the product page still promises £15 off');
    return { detail: `card badges ${before} → 0 once applied · no size marks · _gad: no PDP line, banner or goal bar · ?pv2=: no PDP line` };
  };
}

// ------------------------------------------------------------------ main
/** Pick the flows' products from the real catalogue (by shape, not handle). */
function realConfig(store) {
  const ps = store.products();
  const by = (pred) => ps.find(pred) || null;
  const multi = by((p) => p.options.length === 1 && isSizeName(p.options[0]) && p.variants.length >= 3 && p.price_varies && p.available) || by((p) => p.variants.length > 1 && p.available) || by((p) => p.available) || ps[0];
  const colourFirst = by((p) => isColourName(p.options[0]) && p.options.some(isSizeName) && new Set(p.variants.map((v) => v.options[0])).size > 1 && p.price_varies);
  const sizeFirst = by((p) => isSizeName(p.options[0]) && p.options.slice(1).some((n) => /^color$/i.test(n)) && p.price_varies)
    || by((p) => isSizeName(p.options[0]) && p.options.slice(1).some(isColourName) && p.price_varies);
  const soldOut = by((p) => !p.available);
  const searchProd = multi;
  return {
    pdpHandle: multi.handle,
    cartHandle: multi.handle,
    stickyHandle: multi.handle,
    soldOutHandle: soldOut ? soldOut.handle : null,
    quickAddPath: '/collections/all',
    searchTerm: searchProd.title.replace(/^The /, '').split(/\s+/)[0].slice(0, 5).toLowerCase(),
    searchExpect: escRe(searchProd.title.replace(/^The /, '').split(/\s+/)[0]),
    colourProducts: [colourFirst, sizeFirst].filter(Boolean),
  };
}

async function launch(pw) {
  if (!REAL) return pw.chromium.launch({ headless: true });
  // Real mode: product images live on cdn.shopify.com, reachable only through the sandbox proxy.
  // Chrome's own --proxy-server flag, not Playwright's proxy option: Playwright adds <-loopback>,
  // which would send the local mock server through the proxy too (405s).
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  return pw.chromium.launch({ headless: true, args: ['--ignore-certificate-errors', ...(proxy ? [`--proxy-server=${proxy}`] : [])] });
}

/** Can the browser load a CDN image? Otherwise product images are swapped for placeholders. */
async function probeCdn(browser, base, store) {
  const img = store.products().map((p) => p.featured_image).find(Boolean);
  if (!img) return 'live';
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    const page = await ctx.newPage();
    await page.goto(`${base}/__dev/health`);
    const w = await page.evaluate((src) => new Promise((ok) => {
      const i = new Image();
      const t = setTimeout(() => ok(0), 15000);
      i.onload = () => { clearTimeout(t); ok(i.naturalWidth); };
      i.onerror = () => { clearTimeout(t); ok(0); };
      i.src = src;
    }), `${img.src}${img.src.includes('?') ? '&' : '?'}width=100`);
    return w > 0 ? 'live' : 'placeholder';
  } catch { return 'placeholder'; } finally { await ctx.close(); }
}

async function main() {
  const pw = loadPlaywright();
  if (!pw) { console.log('FAIL  setup  playwright not found (expected /opt/node22/lib/node_modules/playwright)'); process.exit(1); }
  let base = args.url ? String(args.url).replace(/\/$/, '') : null;
  let srv = null;
  if (!base) {
    srv = await startServer({ port: Number(args.port) || 0, quiet: true, real: REAL, themeDir: path.resolve(args.theme || DEFAULT_THEME_DIR), log: () => {} });
    base = srv.origin;
  }
  const store = srv ? srv.store(RUN_MODE) : createStore({ real: REAL });
  if (REAL) CFG = realConfig(store);
  const pages = REAL ? realPages(store) : FIXTURE_PAGES;
  console.log(`== Lunova browser tests — ${base} · ${REAL ? `REAL catalogue (${store.products().length} products, ${store.realMeta.source} ${store.realMeta.fetched_at})` : 'fixture catalogue'}${axeSource ? ' · axe-core ' + require('axe-core').version : ' · axe-core not installed (a11y skipped)'}`);
  let browser;
  try {
    browser = await launch(pw);
  } catch (e) {
    console.log(`FAIL  setup  could not launch Chromium: ${e.message.split('\n')[0]}`);
    if (srv) await srv.close();
    process.exit(1);
  }
  if (REAL) {
    cdnMode = await probeCdn(browser, base, store);
    report(cdnMode === 'live' ? 'PASS' : 'WARN', 'setup', 'CDN images', cdnMode === 'live' ? `${CDN_HOST} reachable${process.env.HTTPS_PROXY ? ' through HTTPS_PROXY' : ''}` : `${CDN_HOST} unreachable — product images replaced by /__dev/placeholder-img`);
  }
  try {
    if (!ONLY || ONLY === 'pages') await checkPages(browser, base, pages);
    if (!ONLY || ONLY === 'flows') {
      const desk = VIEWPORTS[0]; const mob = VIEWPORTS[1];
      await flow(browser, base, 'finder→basket', mob, finderFlow);
      await flow(browser, base, 'finder→basket', desk, finderFlow);
      await flow(browser, base, 'pdp size→price/url→basket', mob, pdpFlow);
      await flow(browser, base, 'pdp size→price/url→basket', desk, pdpFlow);
      for (const prod of CFG.colourProducts) {
        const label = `pdp ${prod.options.join('+').toLowerCase()}→basket`;
        await flow(browser, base, label, mob, pdpColourFlow(prod));
        await flow(browser, base, label, desk, pdpColourFlow(prod));
      }
      await flow(browser, base, 'drawer qty+ / remove', desk, drawerQtyFlow);
      await flow(browser, base, 'drawer qty+ / remove', mob, drawerQtyFlow);
      await flow(browser, base, 'quick-add from card', desk, quickAddFlow);
      await flow(browser, base, 'quick-add from card', mob, quickAddFlow);
      await flow(browser, base, 'collection filter', mob, filterFlow);
      await flow(browser, base, 'collection filter', desk, filterFlow);
      await flow(browser, base, 'predictive search', desk, searchFlow);
      await flow(browser, base, 'predictive search', mob, searchFlow);
      await flow(browser, base, 'mobile menu + Escape', mob, menuFlow);
      await flow(browser, base, 'sticky ATC', mob, stickyFlow);
      await flow(browser, base, 'sticky ATC', desk, stickyFlow);
      const offerP = offerProduct(store);
      await flow(browser, base, 'offer: pdp net price / nudge', mob, offerPdpFlow(offerP));
      await flow(browser, base, 'offer: pdp net price / nudge', desk, offerPdpFlow(offerP));
      await flow(browser, base, 'offer: hidden after end date', mob, offerEndedFlow(offerP));
      await flow(browser, base, 'offer: basket bar + discount line', mob, offerCartFlow(offerP));
      await flow(browser, base, 'offer: basket bar + discount line', desk, offerCartFlow(offerP));
      await flow(browser, base, 'offer: one per order, no other discount', mob, offerOneDiscountFlow(offerP));
    }
    if ((!ONLY || ONLY === 'matrix') && !args['no-matrix']) await finderMatrix(browser, base, VIEWPORTS[1], store);
  } finally {
    await browser.close();
    if (srv) await srv.close();
  }
  const count = (s) => results.filter((r) => r.status === s).length;
  console.log(`\nSUMMARY ${REAL ? '[real] ' : ''}pass=${count('PASS')} fail=${count('FAIL')} warn=${count('WARN')} skip=${count('SKIP')} → ${count('FAIL') ? 'FAIL' : 'PASS'}  (screenshots: ${path.relative(process.cwd(), SHOTS) || SHOTS})`);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, `browser-test${REAL ? '-real' : ''}.json`), JSON.stringify(results, null, 2));
  process.exit(count('FAIL') ? 1 : 0);
}

main().catch((e) => { console.error('FAIL  setup  harness crashed:', e && e.stack ? e.stack : e); process.exit(2); });
