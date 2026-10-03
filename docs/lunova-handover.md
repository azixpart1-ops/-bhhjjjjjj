# Lunova: what's live and what's left

## On the store now

| What | Where | State |
|---|---|---|
| Theme **Lunova — PawLunova** | Online Store → Themes (id 208130998614) | Unpublished. Preview, then Publish. |
| Older draft "Lunova — PawLunova (draft)" | id 208129851734 | Superseded. Delete it. |
| 18 collections | `/collections/dog-beds`, `orthopaedic-dog-beds`, … | Live, smart rules, SEO title/meta, image, intro |
| 12 pages | `/pages/our-story`, `faq`, `bed-finder`, `100-night-trial`, `delivery-returns`, `size-guide`, five guides, `contact` | Live, SEO title/meta |
| 4 menus | `lunova-main-menu`, `lunova-footer-shop/help/about` | Used by Lunova only; Horizon still uses `main-menu` |
| 21 redirects | old store URLs → new homes | Live (301) |
| 9 image alt fixes | Ennerdale, Longsleddale, Martindale | Live |

Everything created is listed with its Shopify ID in `content/manifest.json`.
The copy lives in `content/collections/*.json`, `content/pages/*.json` and `content/faq.json`.

## How claims are decided (so they stay true as products change)

- **100-night trial** shows on a product unless its description says it isn't covered
  ("not the 100-night sleep trial"), it is a dog house / day bed, it is personalised,
  or it is tagged `trial:no`. Tag `trial:yes` to force it on.
- **5-year foam guarantee and the per-night price** only show when the product's own
  description carries the guarantee, or it is tagged `guarantee:yes` (`guarantee:no` hides it).
- **"Only N left"** only when stock is tracked, can't be oversold, and is at or below 3.
- **Dispatch countdown** is OFF (Theme settings → Promises) until real cut-off times are confirmed.
- No foam density figure appears anywhere: no product states one.

## Before you publish (owner)

1. **Replace photos showing other brands' labels** — "RALPH & CO" (Eskdale, Wasdale),
   "CHAHZ" (Ennerdale) and others (Melbreak, Grasmere, Whinlatter, Wastwater, Chatsworth,
   Mardale, Watendlath, Coniston). Ennerdale image 2 also prints "CertiPUR-US Certified";
   keep it only with evidence.
2. **Archive the test product "Ww"** (£5, `/products/ww`).
3. **Confirm terms** the copy deliberately doesn't state: delivery times, refund timescale,
   off-mainland returns, whether the trial covers the Whinlatter car seat and the
   Shopify Collective (supplier-fulfilled) beds. Each content file's `claims_to_confirm`
   lists what its page avoided saying.
4. **Stock**: every variant holds exactly 5, which looks like placeholder stock.
5. **Search & Discovery**: add Product type and Size filters to collections.
6. Optional: rename handles that carry another product's name (e.g. `the-kentmere-orthopaedic-bolster-dog-bed`
   is Staveley) or "calming" (`windermere-calming-bolster-bed`), with redirects.

## Working on the theme

`scripts/theme-dev/` renders the theme locally like Shopify, serves it with fixture or
real catalogue data, and tests it — see its README. Before any upload:

```
cd scripts/theme-dev && npm install
node check.mjs && node check.mjs --real
node browser-test.mjs --strict-a11y && node browser-test.mjs --real --strict-a11y
```
