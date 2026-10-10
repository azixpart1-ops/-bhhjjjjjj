# Merge log: live and unpublished theme edits into `theme/` (Oct 2026 audit)

Prepared 10 Oct 2026 by the merge agent for the PawLunova mobile conversion audit build.

## What was compared

| Theme | Id | Role | Files | Compared with |
|---|---|---|---|---|
| "SEO update - ready to publish (9 Oct 2026)" | 208641360214 | MAIN (live), last update 2026-10-10 13:07:57 UTC | 139 | repo commit `58e17b0` `theme/` (133 files) |
| "Lunova (dash) PawLunova" (its name contains an em dash) | 208130998614 | UNPUBLISHED, last update 2026-10-09 16:45:36 UTC | 143 | repo `HEAD` `theme/` (141 files) |

How:

- Every file of both themes was downloaded read-only with Admin GraphQL (`theme(id:) { files(first: 50, after:) { … body … } }`, three pages each). All bodies came back as text; neither theme has image or font files and there were no URL bodies. Each text file's MD5 matched Shopify's `checksumMd5`, except JSON files, which the API returns with Shopify's "auto-generated" comment header and re-indented, so JSON was compared by parsed value instead.
- Nothing was written to either Shopify theme.
- The unpublished theme's last update (16:45:36 on 9 Oct) matches no file timestamp. Its newest file is 13:17:51 on 9 Oct, so the 16:45 change was to the theme itself (name or metadata), not to any file.
- When both themes changed the same thing, the live theme's edit is newer (its files are dated 9 Oct 19:46 to 10 Oct 13:07; the unpublished theme's are dated 8 Oct to 9 Oct 13:17). Where the two disagree, the live version is treated as the owner's latest intent.

Decisions: **ported** = carried into `theme/` (adapted where noted); **excluded** = deliberately not carried (the audit, UK law or the published policies rule it out); **already present** = `theme/` already has it; **not carried** = left out because a newer edit superseded it or the audit build owns that area; **no effect** = the theme editor wrote out schema defaults, and nothing changed for shoppers.

## Live theme 208641360214 vs `58e17b0`: 17 files (6 added, 11 changed, 0 removed)

| File | What changed | Decision | Reason |
|---|---|---|---|
| `assets/tapita-meta-data.json` (added) | Tapita SEO & Speed config `{"pageSpeedConfig":false,"instantPage":false}` | Ported | App file, unchanged (identical in the unpublished theme). |
| `assets/tapita-schema-config.json` (added, 9 Oct 21:28) | Tapita structured-data config: breadcrumb, article, sitelinks, Organization ("YUTANI LTD", Bury), product schema with a 100-day free return and UK shipping with handling 0 to 1 days and transit 0 to 2 days | Ported, with the delivery times corrected | App file kept. The shipping times contradict the published policy, so handling is set to 1 to 2 and transit to 4 to 6 (working days, standard delivery). The original times are quoted under "Owner settings not carried over". |
| `config/settings_data.json` | `favicon` | Already present | `theme/` already has `shopify://shop_images/IMG_2322.jpg`. |
| ″ | `store_rating` "4.8", `store_review_count` "By 3,900+ Bed Owners" | Excluded | No genuine reviews exist behind the rating or the count (audit P0-1, DMCC Act). |
| ″ | 13 app embeds (`current.blocks` of type `shopify://apps/…`) | 2 ported, 11 already present | Added `gptlab/app_embed` (enabled, no settings) and `tapita-seo-speed/app-embed` (enabled, `hide_price: false`). The other 11 match `theme/` exactly. `theme/` also keeps one embed the live theme lacks, `microsoft-clarity/brandAgents_js`, which is disabled. |
| ″ | `sections` (cart-drawer, quick-add, bed-finder) and `content_for_index: []` | No effect | The editor wrote out the schema defaults. |
| ″ | Unchanged from `58e17b0` but still on live: `low_stock_enable: true` (threshold 5), `delivery_promise_enable: true` | Excluded | Low stock must be off: `theme/` now sets `low_stock_enable: false` (current and preset). The delivery promise ("Order by 3pm … same-day dispatch") stays off, as it already was in `theme/`. |
| `layout/theme.liquid` | `{%- include 'tapita-seo-schema' -%}` at the top of `<head>` | Ported | This replaces `theme/`'s guarded `if content_for_header contains 'tapita-seo-script-tags'`. That string never appears on the live pages, so the guard kept Tapita's meta titles off. Tapita's own edit on the unpublished theme (8 Oct) made the same replacement. |
| `sections/collection-hero.liquid` | "All beds" breadcrumb (visible and BreadcrumbList JSON-LD) points to `/collections/dog-beds` and is skipped on that page | Ported, adapted | Uses the Dog Beds hub once it exists and has products, otherwise `/collections/all`. This keeps the theme's rule that a link never leads to an empty page. |
| `sections/footer-group.json` | Footer menus `lunova-footer-shop` / `lunova-footer-help`, an About links block (`lunova-footer-about`), contact `link: ""` | Already present | `theme/` has the same menus and the About block (as `links-about`). |
| `sections/header-group.json` | `menu: lunova-main-menu`, `sticky: none` | Already present | Same in `theme/`. |
| ″ | Rotating announcement bar: rating message, "Free UK delivery", same-day dispatch countdown, trial, guarantee | Excluded | It shows a fake rating, a dispatch promise the policy contradicts, and free delivery with no £40 threshold. The audit replaces it with one static line, built by another agent. Texts are quoted below. |
| ″ | Second bar `announcement_bar_Dd6KzP`: "£15 off orders of £129 or more · ends Sat 31 Oct" | Excluded | The audit moves the offer into the buy box (another agent). Text is quoted below. |
| `sections/need-chips.liquid` | "All beds" chip goes to `/collections/dog-beds` | Ported, adapted | Same rule as the collection breadcrumb: the hub once it has products, else `/collections/all`. |
| `sections/product-breadcrumbs.liquid` (added) | Visible product breadcrumb: Home / Dog Beds / {category} / {product} | Ported, adapted | The SEO trail is kept. The schema gains `enabled_on: product` and a preset, because the harness fails a section with no presets. Audit PDP-01 asks for a single "‹ Orthopaedic dog beds" back link on mobile instead; that is left to the product page build. |
| `snippets/meta-tags.liquid` | Meta description fallbacks: on the homepage, the last line of the store description; then the collection description (155 characters); then the store description | Ported | SEO, ported unchanged. |
| `snippets/product-jsonld.liquid` | BreadcrumbList built from `product-parent-handle` and the Dog Beds hub, instead of the collection the shopper arrived through | Ported | Same trail as the visible breadcrumb. |
| ″ | Trial return policy left out for Dog Houses, Personalised and Car Seat products | Already present | `theme/` does this more fully through `snippets/trial-eligible`. |
| `snippets/product-parent-handle.liquid` (added) | Maps product type to its parent collection handle | Ported | Unchanged. Every handle it names exists in the store. |
| `snippets/tapita-seo-schema.liquid` (added) | Tapita meta title and description snippet | Already present | Byte-identical in `theme/` (MD5 `705774a1…`). |
| `templates/collection.json` | `hero.show_image: true` | Ported (desktop) | The owner's choice. On phones the `<picture>` source gives a 1×1 GIF, so no photo is downloaded. |
| ″ | `hero.show_image_mobile: true` | Excluded | Audit COL-01: on mobile the H1 and intro go straight to the beds. |
| ″ | Need chips link to collections (orthopaedic, nest, bolster, mattresses, large, elevated-cooling) | Already present | `theme/` names the same collections and uses them once they have products. |
| ″ | `main.show_per_night: true` | Already present | `theme/` also has `true`. Audit P0-4 removes the per-night line from cards, which is the collection build's job. |
| ″ | `risk_reversal` and `faq` settings written out | No effect | Schema defaults from `58e17b0`, including the old "Every memory foam bed also carries…" wording. `theme/`'s wording stands. |
| `templates/index.json` | Hero heading "Orthopaedic dog beds\nfor the sleep they'd choose." | Ported | SEO H1. |
| ″ | Hero eyebrow "Memory foam dog beds, small to XXL" | Ported, adapted to "Dog beds, small to XXL" | Not every bed is memory foam (fibre nests, egg-crate cores, mesh, kennels). XXL sizes do exist (Bassenthwaite, Derwent, Rydal, Grasmere). |
| ″ | `problem_signs.fallback_link` → `/collections/dog-beds`; featured eyebrow "Our dog beds" | Ported | SEO links and copy. |
| ″ | Shop by need: eyebrow "Shop dog beds by need", tile labels with "dog beds" in them, new "Dog sofa beds" and "Waterproof dog beds" tiles | Ported, one label adapted | "Beds for older, arthritic dogs" became "Beds for older dogs", so no label suggests a bed helps arthritis. The other labels, and the two new tiles with their notes, are the owner's wording. |
| ″ | Hero image, `image_shape: rounded`, `mobile_media: banner`, hero/final CTA/view-all links to `/collections/dog-beds`, featured product handles, brand story image | Already present | Same in `theme/`. |
| ″ | Finder teaser settings, empty `link`/`product` fields, lower-case layer colours | No effect | Schema defaults written out by the editor. |
| `templates/llms.txt.liquid` (added) | App-generated llms.txt (9 Oct 21:28, 73 products, collections, pages, a blog post) | Ported, minus the "Blog Posts" entry | This is the newest app output. The one blog post is AI-written and makes medical claims (relieving arthritis and hip dysplasia, "clinical intervention"), so it was dropped. The product entries come from each bed's own description, which says a bed is not a treatment. |
| `templates/product.json` | `product-breadcrumbs` section added first | Ported | SEO (see the section above). |
| ″ | `rating` block removed from the buy box | Already present | `theme/` has no rating block. |
| ″ | Google & YouTube `automated_discounts_price` app block before the price | Already present | Same block id (`adHXmj`) and position in `theme/`. |
| ″ | `tagline.style: plain` | Not carried | Audit S05 replaces the tagline with the subtitle (product page build). |
| ″ | `about.open: true` | Excluded | Audit PDP-17 names the long all-open description as the problem and collapses it. |
| ″ | `mechanism`, `risk_reversal`, `reviews` and `faq` settings written out | Excluded / no effect | Schema defaults from `58e17b0`, including "What 50kg/m³ actually means" and "Our orthopaedic cores are 50kg/m³". No bed's data states a density. |

## Unpublished theme 208130998614 vs `HEAD`: 8 files (2 added, 6 changed, 0 removed)

| File | What changed (when) | Decision | Reason |
|---|---|---|---|
| `assets/tapita-meta-data.json` (added) | Tapita config (8 Oct 08:54) | Ported | Same as live. |
| `config/settings_data.json` (9 Oct 13:17) | `color_accent` #B4532A → #CC983A | Not carried | White button text on #CC983A is 2.6:1 contrast, which fails WCAG AA. The live theme (newer) keeps #B4532A. |
| ″ | `delivery_promise_enable` false → true | Excluded | It turns back on "Order by 3pm Mon–Fri for same-day dispatch", which the shipping policy (dispatch in 1 to 2 working days) contradicts. |
| ″ | `show_installments` false → true (Klarna, 3 payments) | Excluded | Checkout has no pay-in-3 (payments text: Visa, Mastercard, Maestro, Revolut Pay). Audit item 9 adds it only once a provider is installed. Live keeps it off. |
| ″ | `cart_show_discount_hint` false → true | Not carried | No discount codes are running (the £15 offer is automatic), so the hint sends people looking for a code. Live keeps it off. |
| ″ | `tapita-seo-speed` and `gptlab` app embeds added | Ported | Identical to live. |
| ″ | `store_rating` "4.8", `store_review_count` "3,900" | Excluded | No genuine reviews. |
| ″ | `cart_upsell_product` "ambleside-edge-to-edge-memory-foam-bed" (heading "Complete the set") | Not carried | It offers a £139 to £189 orthopaedic mattress as a basket add-on with every order. Live (newer) sets no upsell, and the audit's add-ons are accessories (spare covers, steps). |
| ″ | `sections` and `content_for_index` written out | No effect | Schema defaults. |
| `layout/theme.liquid` (8 Oct 08:54) | Tapita replaced the guarded include with `{%- include 'tapita-seo-schema' -%}` | Ported | Same as live. |
| `sections/zz-probe-v1.liquid` (added 7 Oct 21:40) | Empty "Deploy probe (unused)" section from our 7 Oct deploy check | Excluded | Not used by any template. It can be deleted from that theme. |
| `templates/collection.json` (9 Oct 13:14) | `hero.show_count: true` | Excluded | Audit COL-01 lists the "37 beds" count among the things that push the first bed down. |
| ″ | `need_chips.color_scheme` moss, `main.color_scheme` oat | Not carried | Live (10 Oct, newer) keeps bone. The collection page's look belongs to the audit build. |
| ″ | `risk_reversal` and `faq` settings written out | No effect | Defaults from `HEAD`'s schema. |
| `templates/index.json` (9 Oct 11:08) | `hero.color_scheme` bone → oat | Not carried | Live (newer) keeps bone. |
| ″ | Finder teaser, empty link and product fields, colour case | No effect | Schema defaults written out. |
| `templates/llms.txt.liquid` (8 Oct 08:56) | App regenerated (73 products) | Not carried | Superseded by the live 9 Oct 21:28 version, which was ported. |
| `templates/product.json` (9 Oct 13:17) | Google & YouTube price block moved after the price with a new id (`7XhMyf`) | Not carried | Live (10 Oct 13:07, newer) keeps it before the price as `adHXmj`, which `theme/` already has. Only one copy is kept. |
| ″ | `variant_picker.show_size_hints` false → true | Excluded | The generic breed and weight hints contradicted beds' own dimensions, which is why `theme/` turned them off. The audit uses per-variant `suits_breeds` and `suits_weight` instead. |
| ″ | `buy_buttons.show_quantity` false → true; `main.color_scheme` oat | Not carried | Live (newer) keeps false and bone. |
| ″ | `reviews` section removed | Not carried | Live keeps it. It renders nothing until a reviews app has reviews (audit S11 starts that). |
| ″ | `mechanism`, `risk_reversal`, `faq` and `compare` settings written out | No effect | Defaults from `HEAD`'s schema. |

The repo `HEAD` also held one file that only the unpublished theme shares (it is not in live):

| File | What it is | Decision | Reason |
|---|---|---|---|
| `blocks/ai_gen_block_0bb1bac.liquid` | An AI-generated "Product rating stars" theme block. The rating is typed into the editor (default **4.8**) and no reviews sit behind it. Carried in by the 7 Oct merge; no template uses it. | Excluded (file removed from `theme/`) | It could put an unverifiable star rating on any product page (DMCC Act, CMA fake reviews). |

## Owner settings not carried over

Quoted exactly as they are in the live theme (L) or the unpublished theme (U).

**Ratings and review counts (no genuine reviews exist)**

- `store_rating`: `"4.8"` (L, U)
- `store_review_count`: `"By 3,900+ Bed Owners"` (L); `"3,900"` (U)
- What the live announcement bar showed from them: "Rated 4.8/5 by By 3,900+ Bed Owners owners". The live homepage hero shows a bare "4.8" from the same setting.
- AI theme block "Product rating stars" (`blocks/ai_gen_block_0bb1bac.liquid`, U and the old `HEAD`): `"rating"` range, `"default": 4.8`.

**Low stock ("Only N left")**

- `low_stock_enable: true`, `low_stock_threshold: 5` (L); `low_stock_enable: true`, `low_stock_threshold: 3` (U). `theme/` now has `low_stock_enable: false`.

**Delivery and dispatch claims**

- `delivery_promise_enable: true`, `dispatch_cutoff_hour: 15`, `dispatch_days: "1,2,3,4,5"`, `delivery_min_days: 1`, `delivery_max_days: 3` (L, and U for the toggle). On live this shows as "Order by 3pm Mon–Fri for same-day dispatch".
- Tapita product schema shipping (L, `assets/tapita-schema-config.json`): `"handlingTime":{"minValue":0,"maxValue":1}`, `"transitTime":{"minValue":0,"maxValue":2}`.
- Announcement message `message-free-delivery` (L): promise `custom`, text `&nbsp;<strong>Free UK delivery</strong>&nbsp;`. It has no £40 threshold; the policy is free over £40, otherwise £4.99.

**Rotating announcement bar and offer bar (L, `sections/header-group.json`)**

Bar 1 `announcement-bar` (scheme moss, `desktop_layout: rotate`, autoplay, speed 5), in order:

1. `message_AUynzU`: promise `rating`, text `&nbsp;<strong>Free UK delivery</strong>&nbsp;`. It rendered "Rated 4.8/5 by By 3,900+ Bed Owners owners".
2. `message-free-delivery`: promise `custom`, text `&nbsp;<strong>Free UK delivery</strong>&nbsp;`. It rendered "Free UK delivery".
3. `countdown`. It rendered "Order by 3pm Mon–Fri for same-day dispatch".
4. `message-trial`: promise `trial`. It rendered "100-night sleep trial · Free collection, full refund".
5. `message-guarantee`: promise `guarantee`. It rendered "5-year foam guarantee on our memory foam beds".

Bar 2 `announcement_bar_Dd6KzP` (scheme white, rotate), one message `message_wniVUH`: promise `custom`, text `&nbsp;<strong>£15 off</strong> orders of £129 or more · ends Sat 31 Oct&nbsp;`.

**Basket upsell**

- Product "Next Day Delivry" (sic): id `gid://shopify/Product/11336896479574`, handle `essential-cart-order-upsell-6bbf273e-d94a-46f1-a4f4-376be6fa3d0e`, status UNLISTED, product type "Order Upsell", tag `essential-cart-order-upsell`, £4.00, created 2 Oct 2026 by a cart-upsell app. Neither theme references it; no app embed, setting or template uses it. It is unlisted, so storefront search, collections and recommendations never show it. Nothing to carry. The owner should delete or archive it in the admin, or remove it from the upsell app (audit P0-3).
- `cart_upsell_product: "ambleside-edge-to-edge-memory-foam-bed"` with `cart_upsell_heading: "Complete the set"` (U). Not carried (see the table).

**Other owner choices not carried**

- `color_accent: "#CC983A"` (U), `show_installments: true` with `installments_provider: "Klarna"`, `installments_count: 3` (U), `cart_show_discount_hint: true` (U).
- Collection: `hero.show_image_mobile: true` (L), `hero.show_count: true` (U), `need_chips.color_scheme: "moss"`, `main.color_scheme: "oat"` (U).
- Homepage: `hero.color_scheme: "oat"` (U).
- Product: `tagline.style: "plain"`, `about.open: true` (L); `variant_picker.show_size_hints: true`, `buy_buttons.show_quantity: true`, `main.color_scheme: "oat"`, `reviews` section removed, Google price block moved after the price (U).

**SEO text ported with a change**

- Homepage hero eyebrow: owner "Memory foam dog beds, small to XXL" → "Dog beds, small to XXL".
- Shop by need tile: owner "Beds for older, arthritic dogs" → "Beds for older dogs".
- llms.txt: the "Blog Posts" entry was dropped. It was "Orthopaedic Dog Beds, Memory Foam Dog Beds That End Joint Aches" (`/blogs/news/orthopaedic-dog-beds-memory-foam-dog-beds-that-end-joint-aches`), whose text includes "How Orthopaedic Support Spreads Pressure to Relieve Arthritis, Hip Dysplasia, and Post-Exercise Soreness" and "a proper orthopaedic bed isn't a luxury", then "it's a clinical intervention". The article is still published on the store. The owner should edit or unpublish it, because it makes the medical claims the audit rules out.

## Chat widget

- **App:** SupChat (WhatsApp button), app handle `supchat-whatsapp-button`.
- **Block type:** `shopify://apps/supchat-whatsapp-button/blocks/supchat-embed/0b598f52-d69b-49f5-86f2-f3590eee2706`, block id `17284481637642976426`, `disabled: false`, settings `{}` in both themes. Already present in `theme/` with the same values.
- **Configuration as rendered on live** (from the embed's `data-settings` on pawlunova.co.uk, 10 Oct):
  - `position`: `"right"` (class `supchat--right`), `mobile_only`: false, `visibility`: "yes"
  - `color`: `"rgba(98, 153, 63, 1)"` (green), `dark_mode`: ["yes"], custom `button_image` (a file in Shopify Files), `qr`: false, `whatsapp_web`: false
  - `header`: `"__custom__"`, `custom_header`: `"Not sure which size?"`
  - `tooltip`: null, so the app's default bubble text shows, in Spanish: "¿Necesitas ayuda?" (the close button's title is "Cerrar")
  - `message_text` (greeting): `"Hi! 👋\nHow can I help you?"` (rendered "Hi! How can I help you?"), `message_start`: "Open chat", `message_badge`: true, `message_delay`: 4, `message_views`: 2, `button_delay`: 1
  - `message_send` (prefilled WhatsApp text): `"Hi *{STORE}*. I need more information about {TITLE} {URL}"`
  - `telephone`: `"4407424441043"`. This is not the contact-policy number (+44 7598 327268), and the 0 after 44 looks wrong for a wa.me link (should be 447424441043). The owner should check it.
- **Configurable from the theme?** No. The embed has no theme-editor settings (its settings object is empty in both themes). Greeting, tooltip, header, colour, position and phone are all set in the SupChat app admin, and the app injects them into the page. The theme can only move the bubble with CSS. `theme/assets/product.css` already lifts it above the sticky Add to basket bar (`.has-sticky-atc .supchat { --bottom: … }`). Moving it bottom-left on product pages (audit P0-5) would be another CSS override of `.supchat--right`. The audit's wording ("Size questions? Message Abbas" and the opening message from Abbas) must be entered in SupChat by the owner.

## Repo files changed by this merge

- Added: `theme/assets/tapita-meta-data.json`, `theme/assets/tapita-schema-config.json`, `theme/sections/product-breadcrumbs.liquid`, `theme/snippets/product-parent-handle.liquid`.
- Edited (small, targeted): `theme/layout/theme.liquid` (line 4), `theme/snippets/meta-tags.liquid` (meta description), `theme/snippets/product-jsonld.liquid` (BreadcrumbList), `theme/sections/collection-hero.liquid` (hub crumb), `theme/sections/need-chips.liquid` (`all_url`), `theme/config/settings_data.json` (2 app embeds, `low_stock_enable: false`), `theme/templates/product.json` (breadcrumbs section), `theme/templates/collection.json` (`hero.show_image`), `theme/templates/index.json` (hero heading and eyebrow, problem signs link, featured eyebrow, shop by need), `theme/templates/llms.txt.liquid` (replaced).
- Removed: `theme/blocks/ai_gen_block_0bb1bac.liquid`.

Checks: `node check.mjs --no-theme-check` gives PASS, 0 errors. `node check.mjs --no-theme-check --real` gives PASS, 0 errors. The new warnings are all expected: `product-breadcrumbs` has no colour scheme, padding or section-styles (it keeps the owner's own markup), and `include` is deprecated for Tapita's snippet (Tapita requires `include`).

## For the owner (outside the theme)

1. SupChat: set the bubble text and greeting in English (audit P0-5), and check the WhatsApp number `4407424441043`.
2. Tapita SEO & Speed: in the app, set product schema shipping to dispatch 1 to 2 and transit 4 to 6 working days. The app currently stores 0 to 1 and 0 to 2 (on live the product schema is switched off). The Organization telephone is just "+44".
3. Blog post "Orthopaedic Dog Beds, Memory Foam Dog Beds That End Joint Aches": edit or unpublish it (medical claims).
4. "Next Day Delivry" upsell product: archive it, or remove it from the upsell app.
5. The `frontpage` collection's description still reads "Explore Pawlunova's exclusive collection of handcrafted, ethically-made jewelry…", and llms.txt repeats it. Replace it in the admin.
6. The store description (Preferences) is used for the homepage meta description. Its last line reads "They gave you their best years. Give them a bed that won't flatten. Orthopaedic memory foam dog beds, 100-night home trial, free UK delivery over £40." "Won't flatten" and "memory foam" describe the whole range; consider wording that holds for every bed.
