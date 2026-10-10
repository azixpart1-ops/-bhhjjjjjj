// Self-tests for the October 2026 audit plumbing (npm run test:harness):
// the custom.* metafield overlay typed like Shopify's Liquid, whole-pound money in
// Liquid and in Lunova.money, Lunova.delivery.window's working-day count, and the
// claim gates (foam guarantee, per-night) on the fixture catalogue.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, metafieldDrop, loadMetafieldOverlay } from '../fixtures/store.mjs';
import { fromSnapshot, REAL_FIXTURE } from '../fixtures/fetch-real.mjs';
import { createShopifyFilters } from '../lib/filters.mjs';
import { loadFinderEngine } from '../lib/finder-engine.mjs';
import { ThemeRenderer } from '../render.mjs';
import { resolveRoute } from '../lib/routes.mjs';
import { DEFAULT_THEME_DIR } from '../lib/util.mjs';

test('metafield drops are typed like Shopify Liquid', () => {
  assert.equal(metafieldDrop({ type: 'boolean', value: 'true' }).value, true);
  assert.equal(metafieldDrop({ type: 'boolean', value: 'false' }).value, false);
  assert.equal(metafieldDrop({ type: 'number_integer', value: '50' }).value, 50);
  assert.deepEqual(metafieldDrop({ type: 'list.single_line_text_field', value: '["Curls up","Head on the edge"]' }).value, ['Curls up', 'Head on the edge']);
  const qa = metafieldDrop({ type: 'json', value: '[{"q":"Q?","a":"A."}]' });
  assert.equal(qa.type, 'json');
  assert.equal(qa.value[0].q, 'Q?');
  assert.equal(metafieldDrop({ type: 'multi_line_text_field', value: 'one\ntwo' }).value, 'one\ntwo');
  assert.equal(metafieldDrop({ type: 'single_line_text_field', value: '' }), null, 'empty → no drop (blank)');
});

test('real mode merges fixtures/real-metafields.json into product and variant custom.*', () => {
  const overlay = loadMetafieldOverlay();
  assert.ok(Object.keys(overlay.products).length > 0, 'overlay has products');
  const store = createStore({ real: true, realCatalog: fromSnapshot(REAL_FIXTURE) });
  const p = store.productByHandle('coniston-orthopaedic-dog-bed');
  const c = p.metafields.custom;
  assert.equal(c.foam_guarantee.value, true);
  assert.equal(c.foam_guarantee.type, 'boolean');
  assert.equal(c.low_entry.value, true);
  assert.equal(c.feel.value, 3);
  assert.ok(Array.isArray(c.sleep_style.value) && c.sleep_style.value.includes('Curls up'));
  assert.ok(Array.isArray(c.qa.value) && c.qa.value.length >= 3 && c.qa.value[0].q);
  const withArea = store.products().flatMap((x) => x.variants).filter((v) => v.metafields.custom && v.metafields.custom.sleep_area);
  assert.ok(withArea.length > 10, `variant sleep_area merged (${withArea.length})`);
});

test('fixture catalogue carries representative custom.* values', () => {
  const store = createStore();
  const m = (h) => store.productByHandle(h).metafields.custom || {};
  assert.equal(m('ambleside-memory-foam-dog-bed').density_kg_m3.value, 50);
  assert.equal(m('dog-bed-kimba-orthopaedic-thick-padding-raised-edge').foam_guarantee.value, false);
  assert.equal(m('dog-bed-kimba-orthopaedic-thick-padding-raised-edge').core_type.value, 'Egg-crate foam');
  assert.equal(m('kendal-corduroy-orthopaedic-dog-bed').ships_from.value, 'Partner warehouse');
  assert.equal(m('coniston-orthopaedic-dog-bed').low_entry.value, true);
  assert.ok(m('coniston-orthopaedic-dog-bed').worth_it.value.length > 40);
  const v = store.productByHandle('coniston-orthopaedic-dog-bed').variants[1];
  assert.equal(v.metafields.custom.sleep_area.value, '62 × 50cm');
  assert.equal(v.metafields.custom.most_chosen.value, true, 'most_chosen still set beside the overlay');
});

test('money_without_trailing_zeros matches Shopify', () => {
  const F = createShopifyFilters({ shop: { money_format: '£{{amount}}', money_with_currency_format: '£{{amount}} GBP' } });
  assert.equal(F.money_without_trailing_zeros(14900), '£149');
  assert.equal(F.money_without_trailing_zeros(499), '£4.99');
  assert.equal(F.money_without_trailing_zeros(104900), '£1,049');
  assert.equal(F.money_without_trailing_zeros(450), '£4.50');
});

test('theme JS: Lunova.money, Lunova.delivery.window, Lunova.perNight', async () => {
  const eng = await loadFinderEngine({ store: createStore() });
  const L = eng.L;
  assert.equal(L.money(14900), '£149');
  assert.equal(L.money(499), '£4.99');
  assert.equal(L.money(104900), '£1,049');
  assert.equal(L.moneyFull(14900), '£149.00');
  const ymd = (d) => d.toISOString().slice(0, 10);
  // Order Mon 12 Oct 2026: dispatch Tue 13 to Wed 14, Standard 4 to 6 working days.
  let w = L.delivery.window({ dispatchMin: 1, dispatchMax: 2, transitMin: 4, transitMax: 6, from: '2026-10-12' });
  assert.equal(ymd(w.dispatchEarliest), '2026-10-13');
  assert.equal(ymd(w.earliest), '2026-10-19');
  assert.equal(ymd(w.latest), '2026-10-22');
  // Saturday order: shipping policy s3 processes it on Monday, so it dates like a Monday
  // order (dispatch Tue 13 to Wed 14, arrives Mon 19 to Thu 22; Express Thu 15 to Mon 19).
  w = L.delivery.window({ dispatchMin: 1, dispatchMax: 2, transitMin: 4, transitMax: 6, from: '2026-10-10' });
  assert.equal(ymd(w.dispatchEarliest), '2026-10-13');
  assert.equal(ymd(w.dispatchLatest), '2026-10-14');
  assert.equal(ymd(w.earliest), '2026-10-19');
  assert.equal(ymd(w.latest), '2026-10-22');
  w = L.delivery.window({ dispatchMin: 1, dispatchMax: 2, transitMin: 2, transitMax: 3, from: '2026-10-10' });
  assert.equal(ymd(w.earliest), '2026-10-15');
  assert.equal(ymd(w.latest), '2026-10-19');
  // Sunday and Monday orders give the same dates as Saturday's.
  for (const day of ['2026-10-11', '2026-10-12']) {
    w = L.delivery.window({ dispatchMin: 1, dispatchMax: 2, transitMin: 4, transitMax: 6, from: day });
    assert.equal(ymd(w.earliest), '2026-10-19', day);
    assert.equal(ymd(w.latest), '2026-10-22', day);
  }
  // Bank holidays count as closed days too: Christmas Day dates like Tue 29 Dec,
  // Easter Monday 2027 like Tue 30 Mar.
  const same = (a, b) => {
    const wa = L.delivery.window({ dispatchMin: 1, dispatchMax: 2, transitMin: 4, transitMax: 6, from: a });
    const wb = L.delivery.window({ dispatchMin: 1, dispatchMax: 2, transitMin: 4, transitMax: 6, from: b });
    assert.equal(wa.text, wb.text, `${a} dates like ${b}`);
    return wa;
  };
  w = same('2026-12-25', '2026-12-29');
  assert.equal(ymd(w.earliest), '2027-01-06');
  assert.equal(ymd(w.latest), '2027-01-11');
  same('2027-03-29', '2027-03-30');
  // Same day never counts on a closed day, even with sameDay.
  w = L.delivery.window({ dispatchMin: 0, dispatchMax: 1, transitMin: 4, transitMax: 6, from: new Date('2026-10-10T08:00:00Z'), sameDay: true, cutoffHour: 15 });
  assert.equal(ymd(w.dispatchEarliest), '2026-10-13');
  // Christmas: 25 and 28 Dec 2026 and 1 Jan 2027 are bank holidays.
  w = L.delivery.window({ dispatchMin: 1, dispatchMax: 2, transitMin: 4, transitMax: 6, from: '2026-12-23' });
  assert.equal(ymd(w.dispatchEarliest), '2026-12-24');
  assert.equal(ymd(w.dispatchLatest), '2026-12-29');
  assert.equal(ymd(w.earliest), '2027-01-04');
  assert.equal(ymd(w.latest), '2027-01-07');
  // Dispatch 0 never counts today without sameDay.
  w = L.delivery.window({ dispatchMin: 0, dispatchMax: 2, transitMin: 2, transitMax: 3, from: '2026-10-12' });
  assert.equal(ymd(w.dispatchEarliest), '2026-10-13');
  assert.equal(L.delivery.window({ transitMin: 4, transitMax: 6 }), null, 'no dispatch days → no dates');
  // Per night over 5 years = 1,826 nights.
  assert.equal(L.guaranteeNights(), 1826);
  assert.equal(L.perNight(14900), '8p');
  assert.equal(L.perNight(10900), '6p');
  assert.equal(L.perNightExact(10900), '5.97p');
});

test('claim gates on the fixture catalogue: metafield first, then the older rule', () => {
  const store = createStore();
  const r = new ThemeRenderer({ themeDir: DEFAULT_THEME_DIR, store });
  const page = (url) => r.renderPage(resolveRoute(store, url, new URLSearchParams()), {}).html;
  const egg = page('/products/dog-bed-kimba-orthopaedic-thick-padding-raised-edge');
  assert.doesNotMatch(egg, /data-per-night\b/, 'egg-crate bed (foam_guarantee false, tag guarantee:yes): no per-night line');
  const amb = page('/products/ambleside-memory-foam-dog-bed');
  assert.match(amb, /data-per-night\b/, 'guarantee memory foam bed: per-night line');
  assert.match(amb, /a night over the 5-year foam guarantee/);
  const kendal = page('/products/kendal-corduroy-orthopaedic-dog-bed');
  assert.match(kendal, /data-dates="false"/, 'partner warehouse without dispatch days: no dates');
  assert.match(kendal, /from our partner warehouse\. It takes longer than our own stock, so ask us for the expected date/);
  assert.doesNotMatch(kendal, /shown at checkout|shown before you pay/, 'no delivery time promised that checkout cannot show');
  // FAQ (sections/faq on product.json): the delivery answer follows the bed's dates.
  assert.match(kendal, /When will it arrive\?<\/summary>\s*<div[^>]*>\s*<p>This bed ships from our partner warehouse, tracked, and takes longer than our own stock\. It doesn't show delivery dates here/);
  assert.doesNotMatch(kendal, /delivery dates above the button/, 'partner bed without dispatch days: never "dates above the button"');
  assert.match(amb, /You'll see this bed's delivery dates above the button before you order/);
  const cool = page('/products/windermere-elevated-cooling-dog-bed');
  assert.match(cool, /delivery dates above the button/, 'partner bed with its own dispatch days shows dates');
  // The arthritis question only on a foam-core bed (custom.core_type), never on a mesh cot.
  assert.match(amb, /Will it help a dog with arthritis or stiff hips\?/);
  assert.doesNotMatch(cool, /Will it help a dog with arthritis/, 'mesh cot: no arthritis question');
  assert.doesNotMatch(kendal, /data-delivery-line="express"/, 'no Express line for a partner bed');
  assert.match(amb, /data-dispatch-min="1"[\s\S]*data-dispatch-max="2"/);
  assert.match(amb, /Free standard delivery: dispatched in 1 to 2 working days, then 4 to 6 working days/);
  assert.match(amb, /data-delivery-line="express"/);
});
