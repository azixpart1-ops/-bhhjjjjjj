// Drive the unpublished theme's live preview in Chromium and check every page
// type at desktop and phone widths.
//
//   node snoozly/scripts/verify-preview.mjs <theme_id> [outdir]
//
// Per page it records: HTTP status, Liquid errors or missing translations in
// the HTML, console errors, horizontal overflow, and a full-page screenshot.
// The sandbox's HTTPS proxy re-signs TLS, so Chromium is told to trust that
// one CA key (not to ignore certificate errors in general).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const themeId = process.argv[2];
const out = process.argv[3] || '/tmp/snoozly-verify';
const only = process.argv[4] ? new RegExp(process.argv[4]) : null;
fs.mkdirSync(out, { recursive: true });
const ORIGIN = 'https://snoozly.co.uk';

const PAGES = [
  ['home', '/'],
  ['collection-all', '/collections/all'],
  ['collection-calm', '/collections/calming-beds'],
  ['collection-support', '/collections/orthopaedic-beds'],
  ['collections-list', '/collections'],
  ['product-single', '/products/orthopedic-memory-foam-dog-bed'],
  ['product-variants', '/products/rattan-dog-sofa-bed'],
  ['product-soldout', '/products/vital-bed-lennox'],
  ['cart', '/cart'],
  ['search', '/search?q=bed'],
  ['page-story', '/pages/our-story'],
  ['page-contact', '/pages/contact'],
  ['page-faq', '/pages/faq'],
  ['page-delivery', '/pages/delivery-returns'],
  ['page-match', '/pages/sleep-match'],
  ['page-size', '/pages/size-guide'],
  ['blog', '/blogs/news'],
  ['404', '/pages/does-not-exist-snoozly']
];
const VIEWPORTS = [['desktop', 1440, 900], ['mobile', 390, 844]];

let spki = '';
try {
  spki = execSync("openssl x509 -in /root/.ccr/agent-proxy-ca.crt -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64").toString().trim();
} catch (e) { /* not in the sandbox */ }

const browser = await chromium.launch({
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
  args: spki ? [`--ignore-certificate-errors-spki-list=${spki}`] : []
});
const report = [];
for (const [vp, w, h] of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 1,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
  });
  const page = await ctx.newPage();
  // Establish the preview session once
  await page.goto(`${ORIGIN}/?preview_theme_id=${themeId}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4000);
  for (const [name, path] of PAGES) {
    if (only && !only.test(name)) continue;
    const errors = [];
    const onConsole = (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); };
    const onPageError = (e) => errors.push(`pageerror: ${String(e).slice(0, 200)}`);
    page.on('console', onConsole);
    page.on('pageerror', onPageError);
    const sep = path.includes('?') ? '&' : '?';
    let status = 0;
    try {
      const res = await page.goto(`${ORIGIN}${path}${sep}preview_theme_id=${themeId}`, { waitUntil: 'load', timeout: 90000 });
      status = res ? res.status() : 0;
      await page.waitForTimeout(1500);
      // Scroll the whole page so lazy images load, then reveal everything
      await page.evaluate(async () => {
        const step = Math.max(400, window.innerHeight * 0.8);
        for (let y = 0; y < document.body.scrollHeight; y += step) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
        window.scrollTo(0, 0);
        document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in'));
        document.querySelectorAll('img[loading="lazy"]').forEach((img) => { img.loading = 'eager'; });
      });
      await page.waitForTimeout(1500);
    } catch (e) { errors.push(`goto: ${e.message.slice(0, 160)}`); }
    const html = await page.content();
    const liquidErrors = [...html.matchAll(/Liquid (?:syntax )?error[^<]{0,160}/gi)].map((m) => m[0]);
    const missing = [...html.matchAll(/translation missing[^<"]{0,120}/gi)].map((m) => m[0]);
    const metrics = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      theme: (window.Shopify && window.Shopify.theme && window.Shopify.theme.id) || null,
      title: document.title,
      h1: document.querySelectorAll('h1').length
    }));
    const file = `${out}/${vp}-${name}.png`;
    await page.screenshot({ path: file, fullPage: true }).catch(() => {});
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    const row = { vp, name, status, theme: metrics.theme, title: metrics.title, h1: metrics.h1, overflow: metrics.overflow, liquidErrors, missing: [...new Set(missing)], errors: [...new Set(errors)] };
    report.push(row);
    const flag = (row.liquidErrors.length || row.missing.length || row.overflow > 0 || row.errors.length || status >= 500) ? 'CHECK' : 'ok';
    console.log(`${flag.padEnd(5)} ${vp.padEnd(7)} ${name.padEnd(18)} ${status} theme=${metrics.theme} h1=${metrics.h1} overflow=${metrics.overflow} liquid=${liquidErrors.length} missing=${row.missing.length} console=${row.errors.length}`);
    if (flag !== 'ok') {
      [...row.liquidErrors, ...row.missing, ...row.errors].slice(0, 6).forEach((x) => console.log(`        ${x}`));
    }
  }
  await ctx.close();
}
fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
await browser.close();
