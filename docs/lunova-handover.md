# Lunova: what's live and what's left

> **Superseded on the store.** Since 12 October the published theme is the
> Horizon-based "Yuva" build with the `pln-` layer (`yuva/`, `docs/yuva-theme-spec.md`);
> the latest change to it is the product page pass in `docs/yuva-pdp-pass-oct2026.md`.
> The Lunova theme below is unpublished. Its data rules (metafields, claims, policies)
> still describe the store's content.

October 2026 build: the mobile conversion audit
(`docs/PawLunova_Mobile_Conversion_Audit_Oct2026.pdf`, contract in `docs/audit-oct-contract.md`).

## On the store now

| What | Where | State |
|---|---|---|
| Live theme **Lunova - Mobile audit build (10 Oct 2026)** | Online Store → Themes (id 208711778646) | Published by the owner at 20:12 on 10 Oct. This build, uploaded from a zip of `theme/` (repo commit c2ff099). |
| Previous live theme "SEO update - ready to publish (9 Oct 2026)" | id 208641360214 | Unpublished. Its 9 to 10 Oct SEO edits and app embeds are carried into this build (`docs/audit-oct-merge-log.md`). |
| The 7 Oct Lunova theme | id 208130998614 | Unpublished. Superseded. |
| 24 `custom.*` metafield definitions, 551 product and 46 variant values | Settings → Custom data | Live. Filled only from each product's own description; blank means unknown. Full record and rules in `docs/audit-oct-data-log.md`. |
| New collection `low-entry-dog-beds` "Low Step-In Dog Beds" | `/collections/low-entry-dog-beds` | Live, smart rule on `custom.low_entry` = true (5 beds). |
| Orthopaedic collection | `/collections/orthopaedic-dog-beds` | New manual order (Grasmere, Ambleside, Coniston, Langdale, Nocturne, then memory foam high to low, then egg-crate), new intro and description. |
| Size and colour labels | 12 products | Breed names moved out of variant titles, sizes small to large, Kendal colours Beige, Grey, Green. No variant id, price or SKU changed. |
| Coniston | product | Title "Coniston Low-Entry Memory Foam Dog Bed", SEO title and description, tag `bolster dog bed`. |
| Review policy page `review-policy` | Pages | **Unpublished** until a reviews app is live. Review request emails in `content/emails/`. |
| 18 older collections, 12 pages, 4 menus, 21 redirects | as before | Live (see `content/manifest.json`). |

Every revert recipe is in `docs/audit-oct-data-log.md`.

## Do now: star ratings (legal)

A reviews app wrote star ratings to about 30 beds at 18:44 on 10 Oct: 4 to 10 reviews each,
mostly 4.7 stars. The store's first real order was on 3 Oct and it has about 20 orders, most of
them for Ambleside, Grasmere and Coniston; many rated beds (Ennerdale 10 reviews, Borrowdale,
Crummock, Easedale 6 each) have never been sold here. Those reviews cannot be from PawLunova
buyers. Showing them as PawLunova reviews, or marking them up for Google, is a banned practice
under the DMCC Act 2024 (fines up to 10% of turnover), and the audit (S11) says the same.

The published build was uploaded with ratings on; the repo now ships them off. Until the reviews
are genuine buyer reviews:
1. Theme settings → Social proof → untick **Show product star ratings** (removes the stars on cards
   and the rating in the theme's product structured data).
2. In TrustShop and Loox: unpublish the imported reviews (or uninstall the app you are not
   keeping) and switch off their rich-snippet / structured-data output, which currently adds
   `aggregateRating` to every product page.
3. Collect real reviews with the day-14 and day-60 emails in `content/emails/`, then publish
   `review-policy` and switch the stars back on.

## What changed in this build

**Product page** (PDP-01 to PDP-25): back link instead of the breadcrumb on phones · one
subtitle per bed from `custom.subtitle` · no size chosen on arrival ("From £109", "Choose a
size"; the Bed Finder's size and `?variant=` still preselect) · "Add to basket · £149" · one
per-night line, memory foam beds only · "£15 off this size at checkout, until Sat 31 Oct" under
the sizes, qualifying sizes only, with the discount's small print under it ("No code needed.
Can't be combined with other discounts.", Theme settings → Offer → Small print; the basket's
"away from £15 off" bar carries it too) · size cards with sleeping area, breeds and weight where the
data has them · size help with the Bed Finder and a WhatsApp photo link · dated delivery line
above the button · one trust row (100 nights · 5-year foam guarantee or Free UK delivery · UK
owner support), each opening its terms · "Why <bed>" bullets and a "What's inside" spec card
from metafields · "Worth it?" · Q&A signed by Abbas · the story collapsed · "Complete their bed"
(Kirkstone stairs for low-entry and older-dog beds) · a three-way comparison on memory foam beds ·
twelve FAQ answers · a sticky bar that appears once the main button has scrolled away.

**Collection page** (COL-01 to COL-14): H1, intro and the new-brand line where the "4.8" was ·
"Start with how they sleep" (four beds) · quick filter chips that filter this page · a sticky
"Filter & sort" · cards with "Best for", "From £109 · S–L · 61–97cm", up to three spec chips
and no per-night line or stock count · the Bed Finder tile at position 5 and the trial tile at
12 · "Showing 24 of 37 · Show more beds (13)" · an honest empty state.

**Everywhere**: one static announcement bar ("Free UK delivery over £40 · 100 nights to decide
· Free collection") · whole pounds (£149, £4.99) in Liquid and JS · delivery dates from the
policy (dispatch 1 to 2 working days, Standard 4 to 6 after dispatch, Express 2 to 3; no weekends
or bank holidays; an order placed at the weekend or on a bank holiday counts from the next working
day, as the shipping policy says, so a Saturday order dates like Monday's) · no "Only N left" · no stars or counts under 5 genuine reviews · no em dashes
in shop copy · the new-brand line in place of reviews on the homepage until reviews are live.

**Made consistent across pages** (the integration pass):

- The quick add follows the product page: no size until the shopper picks one, the offer line
  waits for a qualifying size, the sizes carry the "£15 off" mark meanwhile.
- The basket drawer and basket page say delivery in the product page's own words ("Free standard
  delivery: dispatched in 1 to 2 working days, then 4 to 6 working days" · "Express £6.99: 2 to 3
  working days after dispatch"), with no Express for partner-warehouse items. The homepage and
  product FAQ use the same policy sentences as the trust-row sheet.
- Short promise lists everywhere say "100 nights to decide"; the guarantee reads "5-year foam
  guarantee" for a bed it covers and "5-year guarantee on memory foam beds" in the footer, menu
  and basket (and only when a foam bed is in the basket).
- One per-night sum on the homepage, product page and Bed Finder: price ÷ 1,826 nights.
- Same-day dispatch is never claimed store-wide: only on a product whose own data says so.
- Product copy says a removable cover "comes off" (the data never says it zips).
- The Bed Finder sizes one-size beds by their weight band too, never shows stars under 5
  reviews, and no longer says a bed supports joints (it spreads their weight).

## How claims are decided (so they stay true as products change)

Each claim reads the product's own `custom.*` metafields (Products → the product → Metafields).
Set a field and the claim appears; clear it and the claim goes. Nothing is ever guessed.

| Claim on the page | Shows only when |
|---|---|
| 5-year foam guarantee, per-night line, guarantee in the trust row and comparison | `foam_guarantee` decides when set (true or false). Blank: a `core_type` other than memory foam means no; otherwise the older rule (tag `guarantee:yes` / `guarantee:no`, else a bed whose description carries the "no-flatten guarantee") |
| "What's inside": core, foam depth, feel | `core_type`, `foam_depth`, `feel` (1 to 5) |
| Density figure | `density_kg_m3` (only from a supplier spec sheet you keep). No bed has one today. |
| Waterproof liner | `has_liner` is true |
| 30°C wash | `wash_temp` |
| Low step-in bullet, chip and the low-entry collection | `low_entry` is true (height only with `entry_height_cm`) |
| Non-slip base | `non_slip` is true |
| Size card "sleeps about", breeds, weight | variant `sleep_area`, `suits_breeds`, `suits_weight` |
| Size card and size guide "fits dogs up to ~Xcm" | the size's `sleep_area` length less 20cm (Theme settings → Sizing); without one, the outside length only on a bed with no walls (`shape` Mattress, Crate mat or Elevated, no bolster, nest, sofa or sides in the title). Bolster, nest and corner beds without `sleep_area` show no fit line; under 20cm shows none |
| Spec card "Sleeping area" and "Suits" | one-size beds: the variant's own `sleep_area` ("About 127 × 91cm") and `suits_breeds` / `suits_weight`; beds with sizes point to the size cards |
| "Best for dogs who sleep curled up" | `sleep_style` has Curls up and not Stretches out; then "Sprawls flat out? See Ambleside" when the bed picked in the product page's Size block (Bed for dogs who sprawl) is in stock and its own `sleep_style` has Stretches out |
| "Also suits dogs who curl up: …" (under Complete their bed) | two or three in-stock dog beds from the same parent collection whose `sleep_style` shares this bed's first one |
| Bed Finder size reason | "Size Medium." or, with the variant's own `suits_weight`, "Size Medium, for dogs 10–25kg"; never the store-wide breed hints |
| FAQ "Will it help a dog with arthritis or stiff hips?" | product pages: `core_type` contains foam, and not a car seat, steps or kennel (`shape`) |
| FAQ "When will it arrive?" | a bed that shows dates: "You'll see this bed's delivery dates above the button"; a partner-warehouse or made-to-order bed without dispatch days: why it takes longer and "message us before you order". A question the bed's own Q&A (`qa`) already asks isn't repeated (FAQ block setting "Skip when the bed's Q&A asks about") |
| Delivery dates | own stock: the policy's 1 to 2 dispatch days, or `dispatch_days_min/max`. Partner warehouse (`ships_from`) or made to order (personalised, `lead_time_days`, tag `made-to-order`): dates only with `dispatch_days_min/max`; otherwise no dates, "It takes longer than our own stock, so ask us for the expected date before you order", no Express for partner beds, and the basket never promises 1 to 2 day dispatch for them |
| Same-day dispatch, cut-off countdown | `ships_same_day` is true AND Theme settings → Promises → Dispatch countdown is on (it is off) |
| Stars and review count | a reviews app has 5 or more reviews for that bed |
| 100-night trial | everything except what Theme settings → Promises → Not covered by the trial lists (Dog Houses, Personalised, Dog car seat; `trial:yes` / `trial:no` tags override). Only personalised products are told they aren't covered; for the others the trial simply isn't mentioned, because the published refund policy excludes only personalised items (see "Before you publish") |
| Guarantee wording | the trust-row sheet, the Guarantee terms row and the FAQs list the refund policy's exclusions: covers, zips, liners, waterproof layers, bolsters, fibre filling and non-slip bases; chewing, scratching or accident damage; foam damaged by liquid (including urine) or washing; softening that recovers; commercial use. On product pages the guarantee is explained in the trust row and the terms row only (PDP-18) |
| "Only N left" | never; "Low stock" (no number) only if you switch it on in Theme settings |

Theme rules for builders: `docs/lunova-theme-spec.md` section 9.

## Before you publish (owner)

- **Trial for outdoor items and the car seat** (legal): the published refund policy (s2) gives
   the 100-night trial on "every item … except personalised items", and free collection on any
   14-day cancellation (s1). The dog-house and day-bed descriptions say "30-day change-of-mind
   window, with return at your cost, not the 100-night sleep trial", the Whinlatter car seat's says
   not to assume the trial applies, and the `100-night-trial` and `delivery-returns` pages say the
   same. Pick one version and publish it everywhere: either amend the refund policy (add the
   outdoor range and the car seat to the s2 exceptions; return costs inside the 14-day
   cancellation only if s1 is changed to say so), or correct those descriptions and pages. The
   theme meanwhile says nothing about the trial on those products and never tells shoppers they
   aren't covered (only personalised items, which the policy itself excludes). The FAQ page
   answer now follows the published policy.
- **Review apps** (live theme, 10 Oct evening): TrustShop and Loox are both switched on; keep one.
   ShopRank's Product JSON-LD embed is carried over **off**, because the theme already outputs
   the product's structured data. TrustShop's script adds a 0-star, 0-count `aggregateRating` to
   that structured data: switch its rich-snippet output off until there are genuine reviews.
   TrustShop's "product rating" block was not carried over (it was set to show Ambleside's rating
   on every bed); add it in the editor with Product left empty once the app hides stars below 5
   reviews. Details in `docs/audit-oct-merge-log.md`.

1. **Shipping rate**: the Shopify rate is still free from £50, but the policy and the theme say
   £40. Set free standard delivery over £40, £4.99 below, Express £6.99.
2. **Stock** (P0-2): every variant holds 3 to 5, which looks like placeholder stock. Set what you
   or the supplier can really ship, or stop tracking quantity on partner-warehouse beds.
3. **Honister** has `custom.ships_same_day` = true, which nobody can trace to its description.
   Confirm it really leaves the same day or delete the metafield (recipe in the data log).
4. **Measure and fill** (gold items in the audit): `sleep_area` per size (Coniston, Grasmere and
   the other bolster, sofa and nest beds), `foam_depth` per size, `entry_height_cm` on the five
   low-entry beds, `feel` beyond Coniston, `wash_temp` where the care label says 30°C, and
   `dispatch_days_min/max` on the nine partner-warehouse beds so they show dates (the shipping
   policy, s4, promises "the product page shows the expected delivery time before you order";
   until then those beds say to ask), and `lead_time_days` or `dispatch_days_max` on the
   personalised Rydal. `sleep_area` also drives the "fits dogs up to" line: Coniston and the other
   bolster beds show none until it is filled. Density only
   from a supplier spec sheet.
5. **Elterwater**: crumb memory foam but no guarantee paragraph. Decide whether the 5-year
   guarantee covers it; if so, add it to the description (or set `foam_guarantee`).
6. **Photos** (PDP-02): eight images and a 15-second video per best seller, a distinct alt text
   on each. Replace photos showing other brands' labels ("RALPH & CO" on Eskdale and Wasdale,
   "CHAHZ" on Ennerdale, and Melbreak, Grasmere, Whinlatter, Wastwater, Chatsworth, Mardale,
   Watendlath, Coniston). Coniston's photos look like a different, rectangular bed and its alt
   text still says "Oval". Ennerdale image 2 prints "CertiPUR-US Certified": keep it only with
   evidence.
7. **Chat bubble** (P0-5, set in SupChat, not the theme): "Size questions? Message Abbas", the
   English opening message from the audit, the correct phone number. The theme already lifts the
   bubble above the sticky bar.
8. **Reviews** (S11): install a reviews app, then publish the `review-policy` page and send the
   day-14 and day-60 emails in `content/emails/`. Stars appear on a bed once it has 5 genuine
   reviews; until then the new-brand line stands in.
9. **Filters** (COL-04): in Search & Discovery add the metafield filters (What's inside
   `core_type`, Features `has_liner` / `low_entry` / `non_slip`, How they sleep `sleep_style`,
   Shape `shape`). Dog's weight needs a product-level field: Shopify won't filter on the variant
   `suits_weight`. Rename the "Color" option on Kendal and Crummock Herringbone to "Colour", so
   the filter drawer shows one Colour group, not two.
10. **Pay in 3** (PDP-14): apply for PayPal Pay in 3 or Klarna, then add only the provider's own
    widget.
11. **Spare covers**: once sourced, add them as the second "Complete their bed" product and
    change the FAQ answer from "Not yet".
12. **The £15 offer**: Theme settings → Offer must match the automatic discount (£15 off £129,
    ends Sat 31 Oct 23:59). The lines disappear by themselves after the end date.
13. **Size labels outside Appendix B**: Windsor still says "Extra Large"; Loughrigg, Buttermere,
    Martindale and Newlands carry a depth in the size; Sawrey Small, Haweswater XL, Patterdale,
    Elterwater, Eskdale and Kentmere Houndstooth sizes have no measurements.
14. **Housekeeping**: archive the test product "Ww" and the drafts "No" and "Untitled
    Oct10_11:25:13"; delete the superseded themes once this one is live. Optional: rename
    handles that carry another product's name (e.g. `the-kentmere-orthopaedic-bolster-dog-bed`
    is Staveley) or "calming" (`windermere-calming-bolster-bed`), with redirects.
15. **Next year**: the bank holiday list in `assets/global.js` (`BANK_HOLIDAYS`) runs to the end of
    2027; extend it, or add dates in Theme settings → Promises → Holiday dates.

## Working on the theme

`scripts/theme-dev/` renders the theme locally like Shopify, serves it with fixture or real
catalogue data (with the live `custom.*` metafields merged in), and tests it. See its README.
Before any upload, all six must pass:

```
cd scripts/theme-dev && npm install
npm run test:harness
node check.mjs && node check.mjs --real
node browser-test.mjs --strict-a11y && node browser-test.mjs --real --strict-a11y
node browser-test.mjs --real --all-products --no-matrix
```

Refresh the real catalogue first with `node fixtures/fetch-real.mjs` (read-only). The committed
snapshot `fixtures/real-catalogue.json` still holds the 64 products of early October; the
finder-matrix self-test pins it, so refresh both together.
