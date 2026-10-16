# PawLunova layer for the Yuva theme

> Prefix note: every file, class, CSS variable and setting in this layer is
> prefixed `pln-` / `pln_` (PawLunova). The store's own "Yuva (Horizon)" theme
> already uses a `yv-` prefix for its Yuva-look sections and snippets, so the
> two never collide.

Everything in this folder drops into an unmodified copy of **Yuva** (Shine
Dezign Infonet). Yuva's own header, footer, cart, product form and collection
grid stay native; the 27 `pln-*` sections, 7 snippets, one stylesheet and one
script add the conversion structure, copy and SEO described in
`docs/yuva-theme-spec.md`.

```
yuva/
  assets/pln.css, pln.js            shared, loaded once, scoped under .pln
  config/pln-settings-group.json   a settings group to paste into Yuva's settings_schema.json
  snippets/pln-*.liquid            assets loader, icons, product card, trial rule, buy-box promise, schema
  sections/pln-*.liquid            the sections (editor names start "PL: ")
  templates/*.json                index, collection, product, 404, page, page.bed-finder,
                                  page.faq, page.about, page.100-night-trial, page.guide
```

## Install (about 40 minutes)

1. **Duplicate** the Yuva theme in Online Store → Themes so the original is
   untouched. Work on the copy.
2. **Upload the files** in the code editor (Edit code): add each file under
   `assets/`, `snippets/`, `sections/`, `templates/` with the same name.
   (Or `shopify theme push --only` with the Shopify CLI from this folder
   merged over a theme pull.)
3. **Settings group**: open `config/settings_schema.json`, and paste the
   object in `config/pln-settings-group.json` as a new entry at the end of
   the array. Save. Theme settings now shows **PawLunova promises**. Fill it:
   origin line, trial, guarantee, delivery days and bank holidays, who
   answers, offer (off), ratings (off), vet (off until consent).
4. **Head**: in `layout/theme.liquid`, inside `<head>`, add
   `{% render 'pln-schema-org' %}` and `<html lang="en-GB">` if Yuva doesn't
   already set the locale. Switch Yuva's product JSON-LD off in its settings
   (or remove its snippet render from the product section).
5. **Templates**: the JSON templates reference Yuva's `main-product`,
   `main-collection` and `product-recommendations` by those names (read from
   Yuva's demo). If your Yuva version names them differently, open
   `templates/product.json` in Yuva before overwriting, note the `type` of its
   main section, and use that name.
6. **Product form block**: Customize → a product page → Yuva's product
   section → Add block → **Custom Liquid**, placed right after the buy
   buttons, containing:
   ```liquid
   {% render 'pln-buybox-promise', product: product %}
   ```
7. **Pages**: assign templates in Online Store → Pages: bed-finder →
   `page.bed-finder`; faq → `page.faq`; our-story → `page.about`;
   100-night-trial → `page.100-night-trial`; size-guide, foam-explained,
   older-dog-sleep, care-guide, dog-bed-guide, choose-orthopaedic-beds →
   `page.guide`; everything else → `page`.
8. **Yuva settings** per section 10 of the spec: colours, type, header
   button, announcement bar, cart drawer, popups. Turn off countdowns, stock
   counters, stickers and parallax.
9. **Check** with the list in section 12 of the spec, then publish.

## How claims work

Every store-wide claim (trial nights, guarantee years, delivery days, free
delivery threshold, origin line, owner name, vet attribution, offer) is read
from Theme settings → PawLunova promises. Blank or off means the line
disappears everywhere. Product-level claims (what's inside, low step-in,
liner, wash temperature, sleeping areas) are read from the product's own
`custom.*` metafields and never guessed.

## Validation

```
python3 scripts/lint-shopify.py --root yuva      # schema and Liquid checks, 0 errors
node -e "new Function(require('fs').readFileSync('yuva/assets/pln.js','utf8'))"
```
