// Interactive checks on the live preview: the flows that make money.
//   node snoozly/scripts/verify-flows.mjs <theme_id> [outdir]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const themeId = process.argv[2];
const out = process.argv[3] || '/tmp/snoozly-flows';
fs.mkdirSync(out, { recursive: true });
const O = 'https://snoozly.co.uk';
const q = (path) => `${O}${path}${path.includes('?') ? '&' : '?'}preview_theme_id=${themeId}`;
const spki = execSync("openssl x509 -in /root/.ccr/agent-proxy-ca.crt -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64").toString().trim();
const browser = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY }, args: [`--ignore-certificate-errors-spki-list=${spki}`] });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };

async function run(vpName, viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  await page.goto(q('/'), { waitUntil: 'load', timeout: 90000 });
  // Dismiss Shopify's cookie banner if present
  await page.locator('#shopify-pc__banner__btn-decline, button:has-text("Decline")').first().click({ timeout: 4000 }).catch(() => {});

  // 1. Sleep Match: dog → curl → anxious → medium
  await page.locator('sleep-quiz').first().scrollIntoViewIfNeeded();
  const quiz = page.locator('sleep-quiz').first();
  await quiz.locator('[data-answer="dog"]').click();
  await quiz.locator('[data-step="style"] [data-answer="curl"]').click();
  await quiz.locator('[data-step="concern"] [data-answer="anxious"]').click();
  await quiz.locator('[data-step="size"] [data-answer="medium"]').click();
  await page.waitForTimeout(700);
  const resultText = await quiz.locator('[data-quiz-result]').innerText().catch(() => '');
  check(`${vpName} quiz shows a result`, /Calm/.test(resultText), resultText.split('\n').slice(0, 3).join(' | '));
  const recCount = await quiz.locator('.qres__product').count();
  check(`${vpName} quiz recommends beds`, recCount > 0, `${recCount} beds`);
  const stored = await page.evaluate(() => localStorage.getItem('sz-match'));
  check(`${vpName} quiz remembers the match`, !!stored && stored.includes('calm'), stored || '');
  await quiz.screenshot({ path: `${out}/${vpName}-quiz-result.png` });

  // 2. Product page: variant change updates price and URL
  await page.goto(q('/products/rattan-dog-sofa-bed'), { waitUntil: 'load' });
  const priceBefore = await page.locator('[data-price-slot] .price__now').first().innerText();
  await page.locator('label.opt__pill:has-text("Medium")').first().click();
  await page.waitForTimeout(400);
  const priceAfter = await page.locator('[data-price-slot] .price__now').first().innerText();
  check(`${vpName} variant change updates price`, priceBefore !== priceAfter, `${priceBefore.trim()} → ${priceAfter.trim()}`);
  check(`${vpName} variant change updates URL`, page.url().includes('variant='), page.url().split('?')[1] || '');

  // 3. Add to basket opens the drawer with the line and the free-delivery bar
  await page.locator('[data-atc]').first().click();
  await page.waitForSelector('#cart-drawer.is-open', { timeout: 15000 }).catch(() => {});
  const drawerOpen = await page.locator('#cart-drawer.is-open').count();
  check(`${vpName} add to basket opens drawer`, drawerOpen === 1);
  const lineTitle = await page.locator('#cart-drawer .line__title').first().innerText().catch(() => '');
  check(`${vpName} drawer shows the bed`, /Rattan/i.test(lineTitle), lineTitle);
  const ship = await page.locator('#cart-drawer .ship-bar__text').innerText().catch(() => '');
  check(`${vpName} free-delivery bar reflects basket`, /Free UK delivery/i.test(ship), ship.replace(/\s+/g, ' '));
  const count = await page.locator('[data-cart-count]').first().innerText().catch(() => '');
  check(`${vpName} header basket count updates`, count.trim() === '1', `count=${count}`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${vpName}-drawer.png` });

  // 4. Quantity + in drawer
  await page.locator('#cart-drawer [data-qty-step="1"]').first().click();
  await page.waitForTimeout(2500);
  const qty = await page.locator('#cart-drawer [data-line-qty]').first().inputValue().catch(() => '');
  check(`${vpName} drawer quantity stepper`, qty === '2', `qty=${qty}`);

  // 5. Remove, drawer empties
  await page.locator('#cart-drawer [data-line-remove]').first().click();
  await page.waitForTimeout(2500);
  const empty = await page.locator('#cart-drawer .cart-empty').count();
  check(`${vpName} remove empties basket`, empty === 1);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  check(`${vpName} Escape closes drawer`, (await page.locator('#cart-drawer.is-open').count()) === 0);

  // 6. Collection filter updates in place
  await page.goto(q('/collections/all'), { waitUntil: 'load' });
  const before = await page.locator('.plp-grid .card').count();
  if (vpName === 'mobile') {
    await page.locator('[data-drawer-open="facets-drawer"]').click();
    await page.waitForTimeout(500);
  }
  const avail = page.locator('#facets-form input[name="filter.v.availability"][value="1"]');
  if (await avail.count()) {
    await avail.first().check({ force: true });
    await page.waitForTimeout(3000);
    const after = await page.locator('.plp-grid .card').count();
    check(`${vpName} availability filter narrows grid`, after < before && after > 0, `${before} → ${after}`);
    check(`${vpName} filter state in URL`, page.url().includes('filter.v.availability=1'));
  } else {
    check(`${vpName} availability filter present`, false, 'no availability filter input');
  }

  // 7. Predictive search
  await page.goto(q('/'), { waitUntil: 'load' });
  await page.locator('[data-drawer-open="search-drawer"]').first().click();
  await page.locator('[data-psearch-input]').fill('orthop');
  await page.waitForTimeout(2500);
  const psr = await page.locator('#psearch-results .psr__product').count();
  check(`${vpName} predictive search returns beds`, psr > 0, `${psr} results`);

  // 8. Mobile menu
  if (vpName === 'mobile') {
    await page.keyboard.press('Escape');
    await page.locator('.header__burger').click();
    await page.waitForTimeout(500);
    check(`${vpName} menu drawer opens`, (await page.locator('#menu-drawer.is-open').count()) === 1);
    await page.screenshot({ path: `${out}/${vpName}-menu.png` });
  } else {
    await page.keyboard.press('Escape');
    await page.locator('.nav__item--mega').hover();
    await page.waitForTimeout(600);
    check(`${vpName} mega menu opens on hover`, (await page.locator('.nav__item--mega.is-open').count()) === 1);
    await page.screenshot({ path: `${out}/${vpName}-mega.png` });
  }
  check(`${vpName} no JS exceptions`, pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
  await ctx.close();
}

await run('desktop', { width: 1440, height: 900 });
await run('mobile', { width: 390, height: 844 });
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
