# Product page pass on the live Yuva/Horizon theme, 22 October 2026

The store's published theme is the Horizon-based "Yuva" build with the `pln-` layer
("PDP bug fixes - JS, reveal, copy (20 Oct 2026)", id 209537794390). This pass
tightens its product page against the October mobile audit
(`PawLunova_Mobile_Conversion_Audit_Oct2026.pdf`, S04 and S05) and puts the two
pieces of per-bed content the owner already wrote into the metafields, but which the
Yuva page never showed, back on the page.

**Where it lives.** A duplicate of the live theme was made and the changes uploaded to
it, so the live theme is untouched:

> **PDP enhancements - size help, Q&A, tidy buy box (22 Oct 2026)** ·
> `gid://shopify/OnlineStoreTheme/209684463958` · unpublished

Online Store → Themes → that theme → **Preview** to check it, **Publish** to ship it.
Roll back by publishing the previous theme. The repo copy of every changed file is in
`yuva/` (see "Files" below); `yuva/store-merged/templates/product.json` is the template
exactly as uploaded.

## What was wrong, as rendered on the live page

Checked in Chromium at 390 and 1440 on the Coniston page, 22 October.

| Seen | Why it costs sales |
|---|---|
| Price "£99.00 GBP", centred, with "Shipping calculated at checkout" under it | The currency code reads as a foreign shop; the shipping line contradicts the "Free UK delivery" promise four lines below (audit PDP-05, PDP-07). |
| "5 in stock" with a red-to-yellow stock bar on every size | Every variant holds a placeholder 3 to 5, so this is invented urgency (audit P0-2; the handover rule is no "Only N left"). |
| A quantity stepper above the button | Nobody buys two of a £99 bed from the product page; it is one more control between the size and the button. |
| "Explore More" tab: *"Discover thoughtfully made essentials designed to make everyday life easier…"* | Yuva demo copy, live on every product. |
| "Specifications" tab: availability, SKU, vendor, type, collections | Noise; the "What's inside" card already carries the real spec. |
| Payment logos between the button and the trust row | Audit PDP-13: the three promises go directly under the button, logos underneath. |
| Two Product entities in the structured data (Horizon's ProductGroup + the `pln-schema-product` copy), two BreadcrumbLists | Google picks one and may flag the page; the repo's store-merged template already said to switch the PL copy off. |
| `custom.worth_it` and `custom.qa` filled on the best sellers (Coniston: a "Worth it?" paragraph and five owner questions answered) but never rendered | Audit PDP-17 and PDP-22: the two highest-value pieces of per-bed copy on the page, already written. |
| No size help where the size is chosen | Audit PDP-08 and PDP-10: the wrong size is the most common fixable complaint in the category. |
| Trial explained six times, guarantee seven, on a 17,000px mobile page | Audit PDP-18: each point once in full. |

## What changed

### Buy column (`templates/product.json`, Horizon `product-information` section)

- **Price** left-aligned like the rest of the column; "Shipping calculated at checkout" off;
  currency code off on product pages (`currency_code_enabled_product_pages: false` in
  `config/settings_data.json`, the only settings change). Price now reads "£99.00".
  Whole pounds ("£99") need the store money format changing under Settings → Store
  details → Currency formatting, which only the owner can do.
- **Removed**: Yuva's quantity stepper block, the stock-count block, the SKU/vendor
  "Specifications" block. Horizon's own quantity stepper inside the form is hidden by
  `assets/pln-pdp.css`; the form still posts quantity 1 and the basket can change it.
- **New: size help under the picker** (`snippets/pln-size-fit.liquid`, a Custom Liquid
  block right after the variant picker). Reads only data: the selected size's
  `sleep_area` / `suits_breeds` / `suits_weight` when the variant has them (no bed has
  them yet; the audit's gold items), "Best for: stiff mornings. Suits dogs who curl up or
  rest their head on the edge." from `custom.best_for` and `custom.sleep_style`, then the
  measuring rule with two ways to ask: a WhatsApp message with the bed's name started
  (when Theme settings → PawLunova promises → WhatsApp has a number; otherwise the
  contact page) and the Bed Finder. Horizon re-renders the column on every size change,
  verified: choosing Medium moves the price to £139.00 and the block re-renders.
- **Order**: buttons → "Included with this bed" promise row → payment logos.
- **New: "Worth it?"** (`snippets/pln-worth-it.liquid`, a Custom Liquid block under the
  logos): the bed's own `custom.worth_it` paragraph, signed "Abbas, PawLunova". Nothing
  on a bed without one.
- **Tabs**: Description · **Delivery & returns** (dispatch 1 to 2 working days, Standard
  free over £40 / £4.99, 4 to 6 working days, Express £6.99 2 to 3 days, partner-warehouse
  note, 100 nights with free mainland collection, links to both policies) · **Guarantee**
  (the refund policy's exclusions, word for word from the Lunova trust row). The demo
  "Explore More" tab is gone. Both are editable in the block's settings.

### Page (`templates/product.json`, section order)

- **New section: PL: Owners' questions** (`sections/pln-pdp-qa.liquid`) straight after
  "Why this bed": the bed's `custom.qa` list as open question-and-answer cards, signed by
  the owner, with an "Ask Abbas about this bed" button. Hidden on a bed with no Q&A. No
  stars, no review markup, no FAQPage schema (PL: FAQ on the same page keeps that off).
  Calm surface.
- **PL: Why this bed** → "Emit Product structured data" off. One Product graph on the
  page now (Horizon's), one BreadcrumbList (Yuva's).
- **Removed from the product page**: PL: Side by side (the generic four-column table, also
  on the homepage) and PL: After you order (the promise row already dates the arrival
  above the button, and the FAQ answers "When will it arrive?"). Both are still in the
  editor under Add section if wanted back. Net on the Coniston at 390px: about 2,000px
  shorter, with the Q&A section added.

Order now: breadcrumbs → product → Why this bed → Owners' questions → Right for your
dog? → Will it go flat? → Washing & accidents → Sleep trial → Real cost → Honest proof →
FAQ → recommendations → recently viewed.

## Verified on the preview theme

Rendered through `?preview_theme_id=209684463958` in Chromium at 390×844 and 1440×900:

- Coniston: no Liquid errors, one H1, no horizontal overflow, no page errors. Buy column
  reads title → subtitle → rating app → £99.00 → sizes → size help → button → promises →
  logos → Worth it? → tabs (Description, Delivery & returns, Guarantee). Quantity and
  stock controls gone. Choosing Medium: price £139.00, URL carries `?variant=`, the size
  help re-renders.
- Structured data: Organization, ProductGroup+Product×3, BreadcrumbList. No duplicate
  Product.
- Six product shapes fetched with no Liquid errors and one H1 each: Coniston (own stock,
  foam, 3 sizes), Eskdale (partner warehouse), Threlkeld (sold out), Rydal (personalised),
  Kirkstone stairs (not a bed, single size: size help renders nothing but the stylesheet),
  Ambleside. "Worth it?" and the Q&A section appear only where the metafields are filled
  (Coniston, Threlkeld).
- `python3 scripts/lint-shopify.py --root yuva`: 31 sections, 0 errors, 0 warnings.

Not checked here: the theme editor (the new blocks are Custom Liquid, so they show as
"Custom Liquid" in the editor; their copy is in the snippets), and Yuva's quick-add
drawer, which renders the same column and so now also carries the size help and
"Worth it?".

## For the owner

1. **Preview, then publish** the theme above. Everything else on it is identical to the
   live theme.
2. **WhatsApp**: Theme settings → PawLunova promises → WhatsApp number (digits with
   country code, e.g. 447598327268). Until it is set, the size help and the Q&A "Ask"
   button go to the contact page.
3. **Whole pounds**: Settings → Store details → Store currency → Change formatting,
   `£{{amount_no_decimals}}` for both HTML formats (audit PDP-05). The theme shows
   "£99.00" until then.
4. **Reviews widget**: the TrustShop rating block in the buy column shows "5 (3 reviews)"
   on the Coniston. The 10 October handover (`docs/lunova-handover.md`, "Do now") explains
   why imported reviews cannot be shown as PawLunova reviews under the DMCC Act 2024; that
   still stands. The block is the owner's app block and was left in place.
5. **Measure and fill** `sleep_area`, `suits_breeds` and `suits_weight` on each size
   (Products → the product → a variant → Metafields). The size help shows them the moment
   they exist: "Medium sleeps about 62 × 50cm · Cocker, Springer · 10–25kg".
6. **Product photos** still carry other brands' labels (the Coniston's first image shows a
   "WILTON" tag). A theme cannot fix that.

## Files

| File | Change |
|---|---|
| `yuva/store-merged/templates/product.json` | the template as uploaded (built by the transform described above from the live template) |
| `yuva/snippets/pln-size-fit.liquid` | new |
| `yuva/snippets/pln-worth-it.liquid` | new |
| `yuva/sections/pln-pdp-qa.liquid` | new |
| `yuva/assets/pln-pdp.css` | new, product-page styles and the quantity rule |
| `yuva/sections/pln-pdp-fit.liquid`, `pln-pdp-flat.liquid`, `pln-pdp-care.liquid`, `yuva/snippets/pln-cart-promise.liquid`, `yuva/blocks/_pln-card-buy.liquid`, `yuva/assets/pln-gold.css`, `pln-surface.css` | added to the repo from the live theme (they were built on the store on 20 October and never committed) |
| `yuva/assets/pln.js`, `yuva/sections/pln-pdp-why.liquid`, `pln-cost-reframe.liquid`, `yuva/snippets/pln-assets.liquid`, `pln-buybox-promise.liquid` | synced to the live theme's versions (byte-identical, checked by MD5) |

`yuva/sections/pln-page-body.liquid` and `yuva/templates/page.faq.json` keep the repo's
pending "title level" fix, which is still not on the store (see
`yuva/store-merged/README.md`).
