// Self-tests for theme blocks (blocks/*.liquid) as Horizon 4.x uses them: nested dynamic
// blocks, static blocks, closest.*, dynamic sources and colour palettes. Builds a throwaway
// theme like harness.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ThemeRenderer } from '../render.mjs';
import { createStore } from '../fixtures/store.mjs';
import { resolveRoute } from '../lib/routes.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lunova-theme-blocks-'));
const w = (rel, body) => { const f = path.join(dir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body); };

w('layout/theme.liquid', '<html><body>{{ content_for_layout }}</body></html>');
// Locale files are JSONC on Shopify (Horizon's en.default.json has // comments).
w('locales/en.default.json', '/* banner */\n{\n  // a comment\n  "t": { "hi": "Hi // not a comment" }\n}\n');
w('config/settings_schema.json', JSON.stringify([{ name: 'theme_info' }, { name: 'Colours', settings: [
  { type: 'color_palette', id: 'color_palette', default: { background: '#ffffff', foreground: '#000000' } },
  { type: 'color', id: 'text_color', label: 'T', default: '{{ settings.color_palette.foreground }}' },
] }]));
w('config/settings_data.json', JSON.stringify({ current: { color_palette: { background: '#fafafa', foreground: '#111111', color1: '#ff000080' } } }));
// A group renders its own children, not the section's: the old harness re-rendered
// section.blocks here and recursed until V8 aborted ("RegExpCompiler Allocation failed").
w('blocks/group.liquid', `<g id="{{ block.id }}" t="{{ block.settings.title }}">{% content_for 'blocks' %}</g>
{% schema %}{"name":"Group","blocks":[{"type":"@theme"}],"settings":[{"type":"text","id":"title","label":"T","default":"dt"},
{"type":"text","id":"x","label":"X","visible_if":"{{ block.settings.title == \\"G\\" }}"}]}{% endschema %}`);
w('blocks/text.liquid', '<t>{{ block.settings.text }}</t>{% schema %}{"name":"Text","settings":[{"type":"text","id":"text","label":"T","default":"dflt"}]}{% endschema %}');
w('blocks/_card.liquid', `{% doc %}@example {% render 'x' }{% enddoc %}<c v="{{ variant }}" p="{{ closest.product.handle }}">{% render 'card-snip' %}{% content_for 'blocks' %}</c>
{% schema %}{"name":"Card","blocks":[{"type":"@theme"}],"settings":[{"type":"text","id":"label","label":"L","default":"dl"}]}{% endschema %}`);
w('blocks/loop.liquid', '<l>{% content_for "block", type: "loop", id: "again" %}</l>{% schema %}{"name":"Loop"}{% endschema %}');
// Snippets see the section, the theme block and closest they were rendered from (shopify.dev render tag).
w('snippets/card-snip.liquid', '[{{ block.id }}|{{ block.settings.label }}|{{ closest.product.title }}|{{ section.id }}|{{ secret }}]');
w('sections/main.liquid', `{% assign secret = 's' %}{{ section.blocks.size }}:{% content_for 'blocks' %}|bg={{ section.settings.bg }}|tc={{ settings.text_color }}|{% for c in settings.color_palette %}{{ c.alpha }},{% endfor %}|
{%- for product in collections.all.products limit: 2 %}{% content_for 'block', type: '_card', id: 'card', variant: 'v1', closest.product: product %}{% endfor %}
{% schema %}{"name":"Main","blocks":[{"type":"@theme"}],"settings":[{"type":"color","id":"bg","label":"B","default":"{{ settings.color_palette.background }}"}]}{% endschema %}`);
w('sections/looper.liquid', '{% content_for "block", type: "loop", id: "first" %}{% schema %}{"name":"Looper"}{% endschema %}');
w('templates/index.json', JSON.stringify({
  sections: {
    main: {
      type: 'main',
      blocks: {
        g1: { type: 'group', settings: { title: 'G' }, blocks: {
          t1: { type: 'text', settings: { text: 'inner' } },
          g2: { type: 'group', blocks: { t2: { type: 'text', settings: { text: 'deep' } }, off: { type: 'text', disabled: true } }, block_order: ['t2', 'off'] },
        }, block_order: ['t1', 'g2'] },
        t0: { type: 'text', settings: { text: 'top' } },
        priv: { type: '_card' },
        card: { type: '_card', static: true, settings: { label: 'L' }, blocks: { ct: { type: 'text', settings: { text: '<b>{{ closest.product.title }}</b>' } } }, block_order: ['ct'] },
      },
      block_order: ['g1', 't0', 'priv'],
    },
  },
  order: ['main'],
}));
w('templates/page.json', JSON.stringify({ sections: { main: { type: 'looper' } }, order: ['main'] }));

const store = createStore();
const r = new ThemeRenderer({ themeDir: dir, store });
const page = (url) => {
  const u = new URL(url, 'http://x');
  const res = r.renderPage(resolveRoute(store, u.pathname, u.searchParams), {});
  return { ...res, html: res.html.replace(/\n/g, '') };
};

test("content_for 'blocks' renders the current block's children (nested groups, no recursion)", () => {
  const { html, issues } = page('/');
  assert.match(html, /<g id="g1" t="G"><t>inner<\/t><g id="g2" t="dt"><t>deep<\/t><\/g><\/g><t>top<\/t>/);
  assert.match(html, /^<html><body><div[^>]*>2:/, 'section.blocks: dynamic blocks only (no static, no rejected private block)');
  assert.ok(issues.errors.some((i) => /block type "_card" not accepted/.test(i.message)), 'private block outside @theme is rejected');
});

test("content_for 'block': saved static settings, extra args, closest.* and snippets' context", () => {
  const { html } = page('/');
  const cards = [...html.matchAll(/<c v="v1" p="([^"]+)">(.*?)<\/c>/g)];
  assert.equal(cards.length, 2, html);
  for (const [, handle, inner] of cards) {
    const p = store.productByHandle(handle);
    assert.equal(inner, `[card|L|${p.title}|template--24601__main|]<t><b>${p.title}</b></t>`, `card for ${handle}`);
  }
});

test('colour palette, palette-backed colour defaults, JSONC locales, raw schema/doc bodies', () => {
  const { html, issues } = page('/');
  assert.match(html, /\|bg=#fafafa\|tc=#111111\|1,1,0\.5,\|/);
  assert.equal(r.translate('t.hi'), 'Hi // not a comment');
  assert.ok(!issues.list.some((i) => i.kind === 'liquid-syntax'), JSON.stringify(issues.list.filter((i) => i.kind === 'liquid-syntax')));
});

test('a block that renders itself is stopped with an error instead of overflowing the stack', () => {
  const { html, issues } = page('/pages/about');
  assert.match(html, /^<html><body><div[^>]*>(<l>)+(<\/l>)+<\/div>/);
  assert.ok(issues.errors.some((i) => i.kind === 'theme-block' && /render loop/.test(i.message)));
});
