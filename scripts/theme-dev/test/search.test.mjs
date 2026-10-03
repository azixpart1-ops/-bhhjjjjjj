// The mock search's Shopify field syntax, against counts read from the live store
// (storefront /search?q=…&type=product on 2026-10-03) for the queries the theme links to.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../fixtures/store.mjs';
import { fromSnapshot, REAL_FIXTURE } from '../fixtures/fetch-real.mjs';

const store = createStore({ real: true, realCatalog: fromSnapshot(REAL_FIXTURE) });
const count = (q) => store.search(q, { types: ['product'] }).results_count;

test('field searches the theme links to find what the live store finds', () => {
  assert.equal(count('tag:"flat dog bed"'), 9);
  assert.equal(count('tag:"large dog"'), 45);
  assert.equal(count('tag:"small dog bed"'), 12);
  assert.equal(count('tag:"dog bed for older dogs" OR tag:"senior dog bed"'), 10);
  assert.equal(count('product_type:"Dog Beds > Orthopaedic Dog Beds"'), 27);
  assert.equal(count('product_type:"Dog Beds > Cooling & Elevated Beds"'), 3);
});

test('plain words, NOT and pages', () => {
  assert.ok(count('nest') > 0);
  assert.ok(count('bolster -nest') < count('bolster'));
  const r = store.search('tag:"flat dog bed"', { types: ['product', 'page', 'article'] });
  assert.equal(r.results_count, 9, 'a tag: search never matches pages or articles');
});
