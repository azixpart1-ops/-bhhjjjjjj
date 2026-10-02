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
