// axe-core accessibility audit of the live preview.
//   node snoozly/scripts/verify-a11y.mjs <theme_id> <path-to-axe.min.js>
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
const [themeId, axePath] = process.argv.slice(2);
const axe = fs.readFileSync(axePath, 'utf8');
const spki = execSync("openssl x509 -in /root/.ccr/agent-proxy-ca.crt -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64").toString().trim();
const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY }, args: [`--ignore-certificate-errors-spki-list=${spki}`] });
const pages = ['/', '/collections/calming-beds', '/products/rattan-dog-sofa-bed', '/pages/sleep-match', '/pages/contact', '/cart'];
for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  const ctx = await b.newContext({ viewport: vp });
  const p = await ctx.newPage();
  for (const path of pages) {
    await p.goto(`https://snoozly.co.uk${path}?preview_theme_id=${themeId}`, { waitUntil: 'load', timeout: 90000 });
    await p.waitForTimeout(1500);
    await p.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
    await p.evaluate(() => document.querySelectorAll('[data-reveal]').forEach((e) => e.classList.add('is-in')));
    await p.waitForTimeout(300);
    await p.addScriptTag({ content: axe });
    const res = await p.evaluate(async () => {
      const r = await window.axe.run(document, {
        exclude: [['#shopify-pc__banner'], ['#PBarNextFrameWrapper'], ['#PBarNextFrame'], ['#preview-bar-iframe'], ['iframe'], ['shopify-accelerated-checkout'], ['.shopify-payment-button']],
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }
      });
      return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes.slice(0, 3).map((x) => x.target.join(' ') + ' :: ' + (x.failureSummary || '').split('\n').slice(1, 2).join(' ')) }));
    });
    console.log(`${vp.width}px ${path} — ${res.length} rule(s) violated`);
    res.forEach((v) => { console.log(`   [${v.impact}] ${v.id} ×${v.n}`); v.sample.forEach((s) => console.log(`      ${s.slice(0, 220)}`)); });
  }
  await ctx.close();
}
await b.close();
