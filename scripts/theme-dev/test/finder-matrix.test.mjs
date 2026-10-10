// The Bed Finder against the real catalogue, headless (npm run test:harness).
// The fixture is the committed snapshot of the live store (fixtures/real-catalogue.json):
// 64 products, kennels and day beds ("Dog Houses > …"), a car seat and crate mats,
// sizes written "Large · 91 × 69 × 24cm", "Medium: Springer Spaniel | Cockapoo | Staffie"
// and "Extra Large · 107 × 76 × 19cm", and 21 single-variant ("Default Title") beds.
// Every style × stage × size answer goes through the theme's own engine
// (Lunova.finderEngine.recommend), as rendered by the harness; see lib/finder-matrix.mjs
// for what fails.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, loadMetafieldOverlay } from '../fixtures/store.mjs';
import { fromSnapshot, REAL_FIXTURE } from '../fixtures/fetch-real.mjs';
import { loadFinderEngine } from '../lib/finder-engine.mjs';
import { runFinderMatrix, matrixGrid, rawByHandle, foamRule } from '../lib/finder-matrix.mjs';

const catalogue = fromSnapshot(REAL_FIXTURE);
const overlay = loadMetafieldOverlay();

test('the fixture is the shape of the live catalogue', () => {
  const ps = catalogue.products;
  assert.equal(ps.length, 64);
  assert.ok(ps.some((p) => /^Dog Houses > Outdoor Kennels/.test(p.product_type)), 'a kennel');
  assert.ok(ps.some((p) => /^Dog Houses > Outdoor Day Beds/.test(p.product_type)), 'a day bed');
  assert.ok(ps.some((p) => /car seat/i.test(p.title)), 'the car seat');
  assert.ok(ps.some((p) => /crate mat/i.test(p.title)), 'a crate mat');
  const values = ps.flatMap((p) => p.options.flatMap((o) => o.values));
  assert.ok(values.some((v) => /^Large · \d+ × \d+ × \d+cm$/.test(v)), '"Label · dims" sizes');
  assert.ok(values.some((v) => /^Medium: [A-Z][a-z]+ [A-Z][a-z]+ \| /.test(v)), '"Label: breeds" sizes');
  assert.ok(values.some((v) => /^Extra Large · \d+ × \d+/.test(v)), '"Extra Large · dims" sizes');
  assert.equal(ps.filter((p) => p.variants.length === 1 && p.variants[0].title === 'Default Title').length, 21, 'Default Title beds');
  assert.equal(ps.filter((p) => foamRule(p)).length, 20, 'beds whose own copy gives the no-flatten guarantee');
});

test('finder matrix on the real catalogue: 3 styles × 3 stages × 5 sizes', async (t) => {
  const store = createStore({ real: true, realCatalog: catalogue });
  const eng = await loadFinderEngine({ store });
  assert.deepEqual(eng.issues, [], 'the finder page and finder-products render without Liquid errors');
  assert.equal(eng.sizes.length, 5, `sizes from Theme settings → Sizing (${eng.sizes.join('/')})`);
  const fallback = eng.cfg.fallback.length;
  assert.ok(fallback >= 50, `every bed reaches the finder, past Shopify's 50-a-page limit (${fallback} candidates)`);
  const result = runFinderMatrix(eng, { raw: rawByHandle(catalogue.products, overlay) });
  t.diagnostic(result.summary);
  for (const line of matrixGrid(result, eng.sizes)) t.diagnostic(line);
  assert.deepEqual(result.problems, []);
});

test('finder matrix on the fixture catalogue', async (t) => {
  const store = createStore();
  const eng = await loadFinderEngine({ store });
  const result = runFinderMatrix(eng, { raw: new Map() });
  t.diagnostic(result.summary);
  assert.deepEqual(result.problems.filter((p) => !/curl and lean/.test(p)), []);
});

test('finder claims follow the shared rules for named products', async () => {
  const store = createStore({ real: true, realCatalog: catalogue });
  const eng = await loadFinderEngine({ store });
  const byTitle = (s) => Object.values(eng.cfg.products).find((p) => p.title.includes(s));
  const claims = (s) => eng.engine.claims(byTitle(s));
  // Orthopaedic in the name, but no no-flatten guarantee in its own copy.
  for (const s of ['Burnmoor', 'Patterdale Tweed', 'Nocturne', 'Bowfell', 'Elterwater']) {
    const c = claims(s);
    assert.equal(c.foam, false, `${s}: no foam guarantee`);
    assert.equal(c.perNight, false, `${s}: no per-night sum`);
  }
  for (const s of ['Chatsworth', 'Ambleside', 'Grasmere', 'Skelwith', 'Wastwater']) assert.equal(claims(s).foam, true, `${s}: foam guarantee`);
  // The car seat never reaches the finder; the personalised bed is flagged so its Add opens the product page.
  assert.equal(byTitle('Whinlatter') && !byTitle('Whinlatter').excluded, false, 'car seat is excluded');
  const rydal = byTitle('Rydal Personalised');
  assert.ok(rydal && rydal.personalised, 'Rydal Personalised needs a name');
  assert.equal(claims('Rydal Personalised').trialNights, 0, 'personalised: no trial');
  assert.ok(claims('Chatsworth').trialNights > 0, 'Chatsworth: trial');
});
