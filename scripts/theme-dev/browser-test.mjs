#!/usr/bin/env node
// Browser tests for the Lunova theme against the mock storefront (Playwright + Chromium).
//
//   node browser-test.mjs                       starts server.mjs on a free port, runs everything
//   node browser-test.mjs --url http://127.0.0.1:9292   test an already running server
//   node browser-test.mjs --only=pages|flows    --pages=home,product   --no-a11y   --strict-a11y
//   node browser-test.mjs --viewport-only       skip full-page screenshots
//
// Output: one line per check — PASS/FAIL/SKIP/WARN <kind> <name> <detail>; exit 1 on any FAIL.
// Screenshots: .out/shots/<page>-<width>.png
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { startServer } from './server.mjs';
import { OUT_DIR, HARNESS_DIR, DEFAULT_THEME_DIR, parseArgs } from './lib/util.mjs';

process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
const require = createRequire(path.join(HARNESS_DIR, 'package.json'));
function loadPlaywright() {
  for (const id of ['playwright', '/opt/node22/lib/node_modules/playwright', 'playwright-core']) {
    try { return require(id); } catch { /* try next */ }
  }
  return null;
}
let axeSource = null;
try { axeSource = require('axe-core').source; } catch { /* optional */ }

const args = parseArgs(process.argv.slice(2));
const ONLY = args.only ? String(args.only) : null;
const PAGE_FILTER = args.pages ? new Set(String(args.pages).split(',')) : null;
const SHOTS = path.join(OUT_DIR, 'shots');
const VIEWPORTS = [{ w: 1440, h: 900 }, { w: 390, h: 844 }];

const results = [];
function report(status, kind, name, detail = '') {
  results.push({ status, kind, name, detail });
  console.log(`${status.padEnd(5)} ${kind.padEnd(6)} ${name.padEnd(34)} ${detail}`);
}

const PAGES = [
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

// ------------------------------------------------------------------ helpers
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newContext(browser, base, { w, h }, { reducedMotion = 'no-preference' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion, hasTouch: w < 800, isMobile: false });
  const host = new URL(base).host;
  await ctx.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.host !== host && u.protocol.startsWith('http')) return route.abort();
    return route.continue();
  });
  return ctx;
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
  page.on('response', (r) => {
    const u = new URL(r.url());
    if (r.request().isNavigationRequest() && r.request().frame() === page.mainFrame()) return; // the document itself is checked separately
    if (u.host === host && r.status() >= 400 && !u.pathname.startsWith('/fonts/')) w.failed.push(`${r.status()} ${u.pathname}`);
  });
  page.on('requestfailed', (r) => {
    const u = new URL(r.url());
    if (u.host === host && !u.pathname.startsWith('/fonts/')) w.failed.push(`failed ${u.pathname} (${r.failure() && r.failure().errorText})`);
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
  const p = await (await ctx.request.get(`${base}/products/coniston-orthopaedic-dog-bed.js`)).json();
  await ctx.request.post(`${base}/cart/add.js`, { data: { items: [{ id: p.variants[1].id, quantity: 1 }] } });
}

// ------------------------------------------------------------------ page checks
async function checkPages(browser, base) {
  fs.mkdirSync(SHOTS, { recursive: true });
  for (const [name, url, opts = {}] of PAGES) {
    if (PAGE_FILTER && !PAGE_FILTER.has(name)) continue;
    for (const vp of VIEWPORTS) {
      const id = `${name}@${vp.w}`;
      const ctx = await newContext(browser, base, vp, { reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      const w = watch(page, base, { expectStatus: name === '404' ? 404 : 200 });
      let resp;
      try {
        await ctx.addCookies([{ name: 'theme_dev_empty', value: opts.empty ? '1' : '0', url: base }]);
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
      if (w.pageErrors.length) problems.push(`JS errors: ${w.pageErrors.slice(0, 2).join(' | ')}`);
      if (w.console.length) problems.push(`console errors: ${w.console.slice(0, 2).join(' | ')}`);
      if (w.failed.length) problems.push(`failed requests: ${[...new Set(w.failed)].slice(0, 3).join(', ')}`);
      const ov = await overflow(page);
      if (ov.scroll > ov.vw) problems.push(`horizontal overflow ${ov.scroll}px > ${ov.vw}px (${ov.offenders.join(', ')})`);
      const shot = path.join(SHOTS, `${name}-${vp.w}.png`);
      try { await page.screenshot({ path: shot, fullPage: !args['viewport-only'], animations: 'disabled', timeout: 20000 }); } catch (e) { problems.push(`screenshot failed: ${e.message.split('\n')[0]}`); }
      report(problems.length ? 'FAIL' : 'PASS', 'page', id, problems.length ? problems.join('; ') : `HTTP ${status} · no console/JS errors · no overflow · ${path.relative(HARNESS_DIR, shot)}`);
      if (axeSource && !args['no-a11y'] && vp.w === 390) await a11y(page, name);
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
  try {
    await ctx.addCookies([{ name: 'theme_dev_empty', value: '0', url: base }]);
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
  for (let i = 0; i < 16; i++) {
    const add = await firstVisible(dialog, ['.finder-result__add', '[data-finder-add]', 'button.btn--primary:has-text("Add")']);
    if (add) {
      const resultText = (await dialog.innerText()).replace(/\s+/g, ' ');
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
  await page.goto(`${new URL(page.url()).origin}/products/coniston-orthopaedic-dog-bed`, { waitUntil: 'load' });
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
  await page.goto(`${new URL(page.url()).origin}/products/coniston-orthopaedic-dog-bed`, { waitUntil: 'load' });
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
  await page.goto(`${new URL(page.url()).origin}/collections/orthopaedic-dog-beds`, { waitUntil: 'load' });
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
  await input.pressSequentially('con', { delay: 60 });
  const results = page.locator('[data-predictive-results]');
  const ok = await waitFor(async () => (await results.isVisible()) && /Coniston/i.test(await results.innerText()), 5000);
  if (!ok) fail('typing "con" did not show predictive results containing "Coniston"');
  const expanded = await input.getAttribute('aria-expanded');
  return { detail: `opened from ${via} · "con" → results incl. Coniston · aria-expanded=${expanded}` };
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
  const origin = new URL(page.url()).origin;
  await page.goto(`${origin}/products/coniston-orthopaedic-dog-bed`, { waitUntil: 'load' });
  const bar = page.locator('sticky-atc').first();
  if (!(await bar.count())) fail('no <sticky-atc> on the product page');
  const isShown = () => bar.evaluate((el) => el.classList.contains('is-visible') && el.getBoundingClientRect().height > 0 && el.getBoundingClientRect().top < innerHeight);
  const visibleAtTop = await isShown();
  // 1. realistic scrolling (wheel steps) until the main Add button has left the viewport
  await page.mouse.move(195, 400);
  for (let i = 0; i < 40; i++) {
    const bottom = await page.evaluate(() => { const b = document.querySelector('product-form [data-add-button]'); return b ? b.getBoundingClientRect().bottom : -1; });
    if (bottom < -150) break;
    await page.mouse.wheel(0, 350);
    await sleep(120);
  }
  const shown = await waitFor(isShown, 3000);
  if (!shown) fail('sticky add-to-basket did not appear after scrolling past the main Add button');
  // 2. jump straight past the button (reload with restored scroll / anchor link)
  await page.goto(`${origin}/products/coniston-orthopaedic-dog-bed`, { waitUntil: 'load' });
  await page.evaluate(() => { const b = document.querySelector('product-form [data-add-button]'); scrollTo(0, b.getBoundingClientRect().bottom + scrollY + 1200); });
  const jumpOk = await waitFor(isShown, 2000);
  return {
    status: !visibleAtTop ? (jumpOk ? 'PASS' : 'WARN') : 'FAIL',
    detail: `hidden at top: ${!visibleAtTop} · shows after scrolling past Add: true · after a jump past it (reload/anchor): ${jumpOk}${jumpOk ? '' : ' — IntersectionObserver never sees the button cross when it starts below the fold'}`,
  };
}

// ------------------------------------------------------------------ main
async function main() {
  const pw = loadPlaywright();
  if (!pw) { console.log('FAIL  setup  playwright not found (expected /opt/node22/lib/node_modules/playwright)'); process.exit(1); }
  let base = args.url ? String(args.url).replace(/\/$/, '') : null;
  let srv = null;
  if (!base) {
    srv = await startServer({ port: 0, quiet: true, themeDir: path.resolve(args.theme || DEFAULT_THEME_DIR), log: () => {} });
    base = srv.origin;
  }
  console.log(`== Lunova browser tests — ${base}${axeSource ? ' · axe-core ' + require('axe-core').version : ' · axe-core not installed (a11y skipped)'}`);
  let browser;
  try {
    browser = await pw.chromium.launch({ headless: true });
  } catch (e) {
    console.log(`FAIL  setup  could not launch Chromium: ${e.message.split('\n')[0]}`);
    if (srv) await srv.close();
    process.exit(1);
  }
  try {
    if (!ONLY || ONLY === 'pages') await checkPages(browser, base);
    if (!ONLY || ONLY === 'flows') {
      const desk = VIEWPORTS[0]; const mob = VIEWPORTS[1];
      await flow(browser, base, 'finder→basket', mob, finderFlow);
      await flow(browser, base, 'finder→basket', desk, finderFlow);
      await flow(browser, base, 'pdp size→price/url→basket', mob, pdpFlow);
      await flow(browser, base, 'pdp size→price/url→basket', desk, pdpFlow);
      await flow(browser, base, 'drawer qty+ / remove', desk, drawerQtyFlow);
      await flow(browser, base, 'drawer qty+ / remove', mob, drawerQtyFlow);
      await flow(browser, base, 'quick-add from card', desk, quickAddFlow);
      await flow(browser, base, 'quick-add from card', mob, quickAddFlow);
      await flow(browser, base, 'collection filter', mob, filterFlow);
      await flow(browser, base, 'collection filter', desk, filterFlow);
      await flow(browser, base, 'predictive search', desk, searchFlow);
      await flow(browser, base, 'predictive search', mob, searchFlow);
      await flow(browser, base, 'mobile menu + Escape', mob, menuFlow);
      await flow(browser, base, 'sticky ATC after scroll', mob, stickyFlow);
    }
  } finally {
    await browser.close();
    if (srv) await srv.close();
  }
  const count = (s) => results.filter((r) => r.status === s).length;
  console.log(`\nSUMMARY pass=${count('PASS')} fail=${count('FAIL')} warn=${count('WARN')} skip=${count('SKIP')} → ${count('FAIL') ? 'FAIL' : 'PASS'}  (screenshots: ${path.relative(process.cwd(), SHOTS) || SHOTS})`);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'browser-test.json'), JSON.stringify(results, null, 2));
  process.exit(count('FAIL') ? 1 : 0);
}

main().catch((e) => { console.error('FAIL  setup  harness crashed:', e && e.stack ? e.stack : e); process.exit(2); });
