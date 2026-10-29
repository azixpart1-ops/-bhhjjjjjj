# 10% offer line on the product page, 29 October 2026

Request: show a 10 percent discount on the product page (PDP). The store's published theme
is the Horizon-based "Yuva" build with the `pln-` layer, now
**Add to cart fixes - finder adds to the drawer (28 Oct)** (`gid://shopify/OnlineStoreTheme/210255577430`),
which the owner published after the 28 October pass.

**Where it lives.** A duplicate of the live theme was made and the change uploaded to it.
Halfway through that upload (20:20 UTC) the duplicate was published from the admin and its
`templates/product.json` edited there (price centred, "From" price and the shipping-policy line
switched on), so the first four files (settings schema, `pln-pdp.css`, `pln-offer-line.liquid`,
`pln-offer-band.liquid`) are now on the **live** theme
**10% offer line under the price (29 Oct)** (`gid://shopify/OnlineStoreTheme/210333565270`),
while the product template and settings could not follow: the Admin API refuses writes to a
published theme. Nothing changed for shoppers: the live template has no offer block and the
homepage band still has no end date, so neither renders. The finished version is a second
duplicate, made from the live theme as it stands and carrying the last two files:

> **10% offer line v2 - PUBLISH after creating the 10% discount (29 Oct)** ·
> `gid://shopify/OnlineStoreTheme/210334908758` · unpublished

Online Store → Themes → that theme → **Preview** to check it, **Publish** to ship it (after
the step in "Before publishing" below). Roll back by publishing the previous theme.

## What the shopper sees

Directly under the price in the buy column, one line for the selected size:

> **10% off** &nbsp; Cosy Season Saving: 10% off at checkout: you pay **£98.10**, not £109.00.
> <br><small>No code needed. Can't be combined with other discounts.</small>

Horizon re-renders the buy column when a size is chosen, so the figures follow the size
(Medium: you pay £116.10, not £129.00). The quick-add drawer renders the same column, so it
carries the line too. Nothing shows on a sold-out size, on a size under the offer's minimum
(when one is set), after the end date (when one is set, checked on the server and again on the
shopper's clock by `pln.js`), or when the offer is switched off.

Why a line and not a struck-through price: Horizon strikes a price through only when a
variant has a compare-at price, and that would mean editing the price of every variant in the
catalogue and dressing a discount up as a "was" price. An automatic discount is applied by
Shopify at checkout; the honest display is the one the handover already used for the £15
offer ("£15 off this size at checkout"), now with the price the shopper will actually pay.

## How it is wired

Everything reads from **Theme settings → PawLunova promises → Current offer**, which gained a
**Type** (£ off orders over a minimum, or % off each product) and a **% off** figure:

| Setting | On the draft theme |
|---|---|
| Offer is on | on (already was) |
| Name | Cosy Season Saving (default) |
| Type | % off each product (new) |
| % off | 10 (new) |
| £ off | 15 (unused while Type is % off) |
| On orders over £ (0 means every order) | 0 |
| Ends | blank: no end date, so no "until …" |
| Small print | No code needed. Can't be combined with other discounts. (default) |

Files:

| File | Change |
|---|---|
| `yuva/snippets/pln-offer-line.liquid` | new: the line, gated as above; percent maths in pence (`price × percent ÷ 100`, rounded to the penny, then subtracted) |
| `yuva/assets/pln-pdp.css` | `.pln-offer-line` styles (pill in the accent tint, body text, muted small print) |
| `yuva/config/pln-settings-group.json` | `pln_offer_type` select and `pln_offer_percent` number; header and labels reworded; a paragraph saying the theme only describes the discount |
| `yuva/sections/pln-offer-band.liquid` | the homepage band reads the new Type too ("10% off every product, taken off at checkout until …"); it still needs an end date, as before |
| `yuva/store-merged/templates/product.json` | the live template (including the owner's 20:20 edits) plus a Custom Liquid block `pln_offer` (`{% render 'pln-offer-line', product: product %}`) directly after the `price` block |
| `yuva/store-merged/config/settings_data.json` | the live settings plus `pln_offer_type`, `pln_offer_percent`, `pln_offer_min` |
| `yuva/README.md`, `yuva/store-merged/README.md` | install step and log |

On the store, the live `config/settings_schema.json` was uploaded with the repo's PawLunova
promises group swapped in (the repo keeps only the group, `yuva/config/pln-settings-group.json`).

### The live template had moved on

The live `templates/product.json` differs from the 22 October repo copy: the owner added app
blocks to the buy column (Section Shop tabs with an "Expert Review" by "Sofia Ramos",
"Verified Expert", five stars, dated 24 August 2026; an "sp-stars" block reading "Rated 4.8/5
based on 1800+ Testimonials"; a stock chip with "Only {qty} left" and a manual quantity of 7;
"Buy More, Save More" quantity breaks; a "Free shipping · Easy returns · Secure payment" icon
row), removed the `pln-buybox-promise` block and the TrustShop rating block, moved the media
to the right and turned the GBP currency code back on. This pass builds on the live template
exactly as it is and changes nothing else in it. The invented review, the testimonial count
and the manual "Only 7 left" fall under the handover's DMCC Act 2024 guardrails (no invented
reviews, counts or scarcity) and are flagged in the owner notes below, not touched.

## Before publishing: the discount itself

The theme can only describe the discount; Shopify applies it. **There is no 10% discount in
Shopify admin → Discounts today.** The active automatic discounts are "Cosy Season Saving:
£15 Off." (£15 off a subtotal of £129 or more, no end date, not combinable) and "Free Gift
with Purchase". If this theme is published as it stands, the line promises £98.10 and the
checkout charges £109.00 (or £15 off from £129).

So, before publishing, one of:

1. **Create the matching discount** (Discounts → Create → Amount off products → Automatic:
   10% off, all products, no minimum, no end date or the date you then type into Theme
   settings → Current offer → Ends). Decide what happens to the £15 offer: Shopify applies
   only one of two non-combinable order-level discounts, so either end the £15 one or expect
   shoppers to get whichever is larger for their basket. Then publish.
2. **Keep the £15 offer instead**: set Type back to "£ off orders over a minimum" (the line
   then reads "£15 off this size at checkout" on sizes from £129), and publish.

Either way, Theme settings → Current offer must match Discounts exactly, including the end
date; the handover's rule 12 still applies.

## Verified on the preview theme
