// Self-tests for the harness's Shopify emulation (npm run test:harness).
// Builds a tiny throwaway theme so these never depend on the real theme's state.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ThemeRenderer, sectionIdForTemplate } from '../render.mjs';
import { createStore } from '../fixtures/store.mjs';
import { resolveRoute } from '../lib/routes.mjs';
import { createCart, cartAdd, cartChange, CartError } from '../lib/cart.mjs';
import { validateSettings } from '../lib/schema.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lunova-harness-'));
const w = (rel, body) => { const f = path.join(dir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body); };

w('layout/theme.liquid', '<html><body>{{ content_for_layout }}{% section "static-one" %}</body></html>');
w('locales/en.default.json', JSON.stringify({ t: { hello: 'Hello {{ name }}', items: { one: '{{ count }} bed', other: '{{ count }} beds' } } }));
w('assets/app.css', 'body{}');
w('snippets/peek.liquid', '[{{ secret }}|{{ passed }}|{{ settings.flag }}|{{ section.id }}]');
w('snippets/each.liquid', '{{ forloop.index }}:{{ item }};');
w('snippets/inc.liquid', '{% assign leaked = "yes" %}{{ secret }}');
w('sections/static-one.liquid', '<i>{{ section.id }}|{{ section.settings.label }}</i>{% schema %}{"name":"Static","settings":[{"type":"text","id":"label","label":"L","default":"dflt"}]}{% endschema %}');
w('sections/probe.liquid', `{%- assign secret = 's3' -%}
R{% render 'peek', passed: 'p' %}
I{% include 'inc' %}{{ leaked }}
F{% render 'each' for section.settings.list as item %}
M{{ 7 | divided_by: 2 }}/{{ 7 | divided_by: 2.0 }}/{{ 7.0 | divided_by: 2 }}/{{ 10 | modulo: 3 }}/{{ 2.5 | round }}/{{ 1.005 | round: 2 }}
G{{ 6950 | money }}/{{ 6900 | money_without_trailing_zeros }}/{{ 123456 | money_with_currency }}
T{{ 't.hello' | t: name: 'Bella' }}/{{ 't.items' | t: count: 1 }}/{{ 't.items' | t: count: 3 }}
B{% for b in section.blocks %}<{{ b.type }}:{{ b.settings.text }}>{% endfor %}
X{{ 'x' | not_a_filter }}
{% schema %}{"name":"Probe","settings":[{"type":"text","id":"list","label":"L"}],"blocks":[{"type":"line","name":"Line","settings":[{"type":"text","id":"text","label":"T","default":"d"}]},{"type":"@app"}],"presets":[{"name":"Probe"}]}{% endschema %}`);
w('sections/pager.liquid', `{% paginate collection.products by 5 %}N{{ collection.products.size }} P{{ paginate.current_page }}/{{ paginate.pages }} {{ paginate.next.url }}{% endpaginate %}{% form 'contact' %}{{ form.posted_successfully? }}{% endform %}{% schema %}{"name":"Pager"}{% endschema %}`);
w('templates/index.json', JSON.stringify({
  sections: {
    main: { type: 'probe', settings: { list: 'unused' }, blocks: { a: { type: 'line', settings: { text: 'one' } }, b: { type: 'line', disabled: true }, c: { type: 'shopify://apps/reviews/blocks/x/1' } }, block_order: ['a', 'b', 'c'] },
  },
  order: ['main'],
}));
w('templates/collection.json', JSON.stringify({ sections: { main: { type: 'pager' } }, order: ['main'] }));
w('config/settings_schema.json', JSON.stringify([{ name: 'theme_info' }, { name: 'G', settings: [{ type: 'checkbox', id: 'flag', label: 'F', default: true }] }]));

const store = createStore();
const r = new ThemeRenderer({ themeDir: dir, store });
const page = (url, cart) => { const u = new URL(url, 'http://x'); return r.renderPage(resolveRoute(store, u.pathname, u.searchParams), { cart }); };

test('render is isolated; include shares scope; globals visible in snippets', () => {
  const { html } = page('/');
  assert.match(html, /R\[\|p\|true\|\]/, 'render: no parent vars, no section, but settings visible');
  assert.match(html, /Is3yes/, 'include: sees and leaks parent scope');
});

test('Ruby number semantics', () => {
  const { html } = page('/');
  assert.match(html, /M3\/3\.5\/3\.5\/1\/3\/1\.01/);
});

test('money filters (GBP)', () => {
  assert.match(page("/").html, /G£69\.50\/£69\/£1,234\.56 GBP/);
});

test('t filter: interpolation + pluralisation', () => {
  assert.match(page('/').html, /THello Bella\/1 bed\/3 beds/);
});

test('blocks: disabled skipped, app blocks typed @app; unknown filter recorded', () => {
  const { html, issues } = page('/');
  assert.match(html, /B<line:one><@app:>/);
  assert.ok(issues.errors.some((i) => i.kind === 'unknown-filter' && /not_a_filter/.test(i.message)));
});

test('static section + JSON template section ids', () => {
  const { html } = page('/');
  assert.match(html, /id="shopify-section-template--\d+__main"/);
  assert.match(html, /id="shopify-section-static-one".*<i>static-one\|dflt<\/i>/s);
});

test('paginate slices and builds urls; form tag + posted flag', () => {
  const p2 = page('/collections/all?page=2&contact_posted=true');
  assert.match(p2.html, /N5 P2\/3 \/collections\/all\?[^<]*page=3/);
  assert.match(p2.html, /<form method="post" action="\/contact#contact_form" id="contact_form"[^>]*><input type="hidden" name="form_type" value="contact" \/>.*true<\/form>/s);
});

test('Section Rendering: template id, static file, unknown → null', () => {
  const route = resolveRoute(store, '/', new URLSearchParams());
  assert.match(r.renderSectionById(sectionIdForTemplate('main'), route).html, /^<div id="shopify-section-template/);
  assert.match(r.renderSectionById('static-one', route).html, /dflt/);
  assert.equal(r.renderSectionById('nope', route).html, null);
});

test('cart: inventory deny limits, change by key, sold out', () => {
  const cart = createCart();
  const langdale = store.productByHandle('dog-bed-kimba-orthopaedic-thick-padding-raised-edge');
  const large = langdale.variants.find((v) => v.title === 'Large');
  cartAdd(cart, store, [{ id: large.id, quantity: 2 }]);
  assert.throws(() => cartAdd(cart, store, [{ id: large.id, quantity: 1 }]), CartError);
  cartChange(cart, store, { id: cart.lines[0].key, quantity: 0 });
  assert.equal(cart.lines.length, 0);
  const sold = store.productByHandle('wensleydale-nesting-bed').variants[0];
  assert.throws(() => cartAdd(cart, store, [{ id: sold.id, quantity: 1 }]), /sold out/);
});

test('schema rules: range maths, select default, url & richtext defaults', () => {
  const errs = [];
  const out = { error: (k, m) => errs.push(m), warn: () => {} };
  validateSettings([
    { type: 'range', id: 'a', label: 'A', min: 0, max: 500, step: 1, default: 10 },
    { type: 'select', id: 'b', label: 'B', options: [{ value: 'x', label: 'X' }], default: 'y' },
    { type: 'url', id: 'c', label: 'C', default: '/pages/x' },
    { type: 'richtext', id: 'd', label: 'D', default: 'plain' },
    { type: 'range', id: 'e', label: 'E', min: 0, max: 120, step: 4, default: 40 },
  ], out, { file: 'x', where: 's' });
  assert.equal(errs.length, 4, errs.join('\n'));
});

test('image_url / image_tag emit sized srcset for fixture images', () => {
  const p = store.productByHandle('coniston-orthopaedic-dog-bed');
  const route = resolveRoute(store, '/', new URLSearchParams());
  r.begin(route, null);
  const html = r.engine.parseAndRenderSync("{{ p.featured_image | image_url: width: 800 | image_tag: loading: 'lazy', alt: 'x' }}", { p }, { globals: r.cur.globals });
  r.cur = null;
  assert.match(html, /src="\/fixture-img\/coniston_ortho\.jpg\?v=1&amp;width=800"/);
  assert.match(html, /srcset="[^"]*352w/);
  assert.match(html, /width="800" height="\d+"/);
});

test('bare size/first/last are nil (not the globals key count); params and assign still win', () => {
  const route = resolveRoute(store, '/', new URLSearchParams());
  r.begin(route, null);
  const g = { globals: r.cur.globals };
  const out = r.engine.parseAndRenderSync("[{{ size }}|{{ first }}|{{ last }}|{{ size | default: 0 | plus: 0 }}]{% assign size = 5 %}{{ size }}", {}, g);
  const param = r.engine.parseAndRenderSync('{{ size }}', { size: 12 }, g);
  r.cur = null;
  assert.equal(out, '[|||0]5');
  assert.equal(param, '12');
});

test('keyed globals: sortable arrays that still resolve by handle', () => {
  const route = resolveRoute(store, '/', new URLSearchParams());
  r.begin(route, null);
  const html = r.engine.parseAndRenderSync(
    "{% assign sorted = collections | sort: 'title' %}{% for c in sorted %}<{{ c.handle }}|{{ c.url }}>{% endfor %}"
      + "S{{ collections.size }}/{{ collections | sort_natural: 'title' | map: 'handle' | join: ',' }}"
      + "H{{ collections['nest-beds'].title }}/{{ collections.cooling.handle }}/{{ linklists['main-menu'].handle }}",
    {}, { globals: r.cur.globals });
  const n = store.collectionHandles().length;
  r.cur = null;
  assert.doesNotMatch(html, /<\|>/, 'sort must not yield a blank item');
  assert.equal((html.match(/<[a-z-]+\|\/collections\/[a-z-]+>/g) || []).length, n);
  assert.match(html, new RegExp(`S${n}/`));
  assert.match(html, /H[^/]+\/cooling\/main-menu$/);
});

// ---------------------------------------------------------------- real-catalogue mode
// A synthetic products.json (no network): 60 products, so collection.products hits the
// 50-product cap, one colour-first product with variant images, one Default Title kennel.
const cdn = (n) => `https://cdn.shopify.com/s/files/1/0000/0000/0001/files/${n}.jpg?v=17`;
const synthetic = (() => {
  const products = [];
  for (let i = 0; i < 58; i++) {
    products.push({
      id: 1000 + i, title: `Bed ${String(i).padStart(2, '0')}`, handle: `bed-${i}`, body_html: '<p>Soft.</p>', vendor: 'PawLunova', product_type: 'Dog Beds > Orthopaedic Dog Beds', tags: ['PawLunova'],
      created_at: '2026-10-02T15:54:26-04:00', published_at: '2026-10-02T15:54:26-04:00',
      options: [{ name: 'Size', position: 1, values: ['Medium · 70 × 55cm', 'Large · 90 × 70cm'] }],
      variants: [
        { id: 50000 + i * 10, title: 'Medium · 70 × 55cm', option1: 'Medium · 70 × 55cm', option2: null, option3: null, price: '79.00', compare_at_price: null, available: true, sku: `B${i}M`, grams: 0, featured_image: null },
        { id: 50001 + i * 10, title: 'Large · 90 × 70cm', option1: 'Large · 90 × 70cm', option2: null, option3: null, price: '99.50', compare_at_price: '120.00', available: true, sku: `B${i}L`, grams: 0, featured_image: null },
      ],
      images: [{ id: 7000 + i, position: 1, src: cdn(`bed-${i}`), width: 1200, height: 800, variant_ids: [], alt: `Bed ${i} - Pawlunova`, media_id: 9000 + i }],
    });
  }
  products.push({
    id: 2001, title: 'Colour Bed', handle: 'colour-bed', body_html: '', vendor: 'PawLunova', product_type: 'Dog Beds > Bolster & Nest Beds', tags: [],
    options: [{ name: 'Colour', position: 1, values: ['Green', 'Grey'] }, { name: 'Size', position: 2, values: ['Small', 'Large'] }],
    variants: [['Green', 'Small', 69], ['Green', 'Large', 99], ['Grey', 'Small', 69], ['Grey', 'Large', 99]].map(([c, s, p], i) => ({
      id: 60000 + i, title: `${c} / ${s}`, option1: c, option2: s, option3: null, price: `${p}.00`, compare_at_price: null, available: true, sku: '', grams: 0,
      featured_image: { id: c === 'Green' ? 8001 : 8002, alt: `${c} bed`, src: cdn(c), width: 1000, height: 1000 },
    })),
    images: [{ id: 8001, position: 1, src: cdn('Green'), width: 1000, height: 1000, variant_ids: [60000, 60001], media_id: 9901 }, { id: 8002, position: 2, src: cdn('Grey'), width: 1000, height: 1000, variant_ids: [60002, 60003], media_id: 9902 }],
  });
  products.push({
    id: 2002, title: 'Keswick Kennel', handle: 'kennel', body_html: '', vendor: 'PawLunova', product_type: 'Dog Houses > Outdoor Kennels', tags: [],
    options: [{ name: 'Title', position: 1, values: ['Default Title'] }],
    variants: [{ id: 61000, title: 'Default Title', option1: 'Default Title', option2: null, option3: null, price: '149.00', compare_at_price: null, available: true, sku: 'K', grams: 0, featured_image: null }],
    images: [],
  });
  const all = [...products].sort((a, b) => a.title.localeCompare(b.title)).map((p) => p.handle);
  return { meta: { source: 'test' }, products, all, collections: [{ handle: 'frontpage', title: 'Home page', products: ['colour-bed'] }] };
})();
const realStore = createStore({ real: true, realCatalog: synthetic });
const rr = new ThemeRenderer({ themeDir: dir, store: realStore });

test('real catalogue: options, variants in pence, 5 tracked on deny, Default Title, menus', () => {
  const p = realStore.productByHandle('colour-bed');
  assert.deepEqual(p.options, ['Colour', 'Size']);
  assert.equal(p.variants[1].title, 'Green / Large');
  assert.deepEqual([p.variants[1].option1, p.variants[1].option2, p.variants[1].option3], ['Green', 'Large', null]);
  assert.equal(p.variants[1].price, 9900);
  assert.equal(realStore.productByHandle('bed-3').variants[1].compare_at_price, 12000);
  assert.ok(p.variants.every((v) => v.inventory_quantity === 5 && v.inventory_management === 'shopify' && v.inventory_policy === 'deny' && v.available));
  const k = realStore.productByHandle('kennel');
  assert.equal(k.has_only_default_variant, true);
  assert.equal(k.type, 'Dog Houses > Outdoor Kennels');
  assert.deepEqual(realStore.linklists().map((l) => `${l.handle}:${l.links.map((x) => x.title).join(',')}`), ['main-menu:Home,Catalog,Contact', 'footer:Search']);
  assert.deepEqual(realStore.collectionView('frontpage').products.map((x) => x.handle), ['colour-bed']);
});

test('real catalogue: media ids differ from image ids; variant featured image/media', () => {
  const p = realStore.productByHandle('colour-bed');
  assert.equal(p.images[0].id, 8001);
  assert.equal(p.media[0].id, 9901);
  assert.equal(p.media[0].preview_image.id, 8001);
  assert.equal(p.variants[2].featured_image.id, 8002);
  assert.equal(p.variants[2].featured_media.id, 9902);
  assert.equal(p.images[0].alt, 'Green bed', 'alt from the variant image when products.json has none');
});

test('real catalogue: image_url returns the CDN URL with width; image_tag srcset on the CDN', () => {
  const p = realStore.productByHandle('bed-1');
  const route = resolveRoute(realStore, '/', new URLSearchParams());
  rr.begin(route, null);
  const html = rr.engine.parseAndRenderSync("{{ p.featured_image | image_url: width: 600 }}|{{ p.featured_image | image_url: width: 400 | image_tag: alt: '' }}", { p }, { globals: rr.cur.globals });
  rr.cur = null;
  assert.match(html, /^https:\/\/cdn\.shopify\.com\/s\/files\/1\/0000\/0000\/0001\/files\/bed-1\.jpg\?v=17&width=600\|/);
  assert.match(html, /srcset="https:\/\/cdn\.shopify\.com\/[^"]*bed-1\.jpg\?v=17&amp;width=352 352w/);
  assert.match(html, /width="400" height="267"/);
});

test('real catalogue: collection.products holds 50, paginate and products_count see all 60', () => {
  const c = realStore.collectionView('all');
  assert.equal(c.products.length, 50);
  assert.equal(c.products_count, 60);
  const p3 = rr.renderPage(resolveRoute(realStore, '/collections/all', new URLSearchParams('page=12')), {});
  assert.match(p3.html, /N5 P12\/12 /, p3.html.slice(0, 300));
  rr.begin(resolveRoute(realStore, '/collections/all', new URLSearchParams()), null);
  const n = rr.engine.parseAndRenderSync('{{ collections.all.products.size }}/{{ collections.all.products_count }}', {}, { globals: rr.cur.globals });
  rr.cur = null;
  assert.equal(n, '50/60');
});

test('Shopify escaping: t escapes keys without _html; json escapes slashes', () => {
  const route = resolveRoute(store, '/', new URLSearchParams());
  r.begin(route, null);
  const out = r.engine.parseAndRenderSync("{{ 't.hello' | t: name: \"Bella's <b>\" }}|{{ '/products/x' | json }}", {}, { globals: r.cur.globals });
  r.cur = null;
  assert.equal(out, 'Hello Bella&#39;s &lt;b&gt;|"\\/products\\/x"');
});
