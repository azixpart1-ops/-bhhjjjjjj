# Contract for implementing the October mobile conversion audit

Source: docs/PawLunova_Mobile_Conversion_Audit_Oct2026.pdf (42 pages; read the sections you need with the Read tool,
`pages` parameter). Page map: S01 short version p3-4 · S02 numbers p5-6 · S03 fix-first 72h list p7-9 ·
S04 product page audit p10-15 · S05 new product page + Coniston copy deck + template rules + subtitles by bed type p16-19 ·
S06 collection audit p20-23 · S07 new collection page + copy deck p24-25 · S08 competitors p26-27 ·
S09 customers' words + fifteen owner-voice lines p28-31 · S10 psychology playbook p32-33 · S11 reviews engine p34 ·
S12 photos/price presentation p35-36 · S13 implementation plan + metafields + snippets p37-38 · S14 measuring p39 ·
Appendix A claims per bed, B size-label fixes, C handles p40-41.

## Stores, themes
- Live (MAIN, not writable through the MCP): "SEO update - ready to publish (9 Oct 2026)" 208641360214 = copy of the old
  first draft (repo commit 58e17b0) + SEO edits on 9-10 Oct (sections/product-breadcrumbs.liquid, snippets/product-parent-handle.liquid,
  snippets/meta-tags.liquid, snippets/product-jsonld.liquid, sections/collection-hero.liquid, sections/need-chips.liquid,
  sections/header-group.json, sections/footer-group.json, templates/index.json, templates/product.json, templates/collection.json,
  templates/llms.txt.liquid, assets/tapita-*.json, config/settings_data.json, layout/theme.liquid).
- Our fixed theme (repo HEAD theme/) was deployed to unpublished 208130998614 on 7 Oct; that theme shows an update at
  2026-10-09 16:45 by someone else. The audit build ships as a NEW unpublished theme created from a zip.
- Real catalogue snapshot: content/.catalogue-snapshot.json (73 products, storefront products.json, 10 Oct).
- Shipping policy (published): dispatch within 1-2 working days; Standard £4.99 or free over £40, arrives 4-6 working days
  after dispatch; Express £6.99, 2-3 working days after dispatch; some items ship from manufacturing partners and take longer,
  "the product page shows the expected delivery time before you order". (The Shopify rate itself is still free from £50: owner fix.)
- Refund policy: 100-night trial on every item except personalised items made to specification; collection free from mainland GB
  (other UK areas arranged at no cost); one trial per household; 5-year foam guarantee "on every PawLunova memory foam bed".
- Contact policy: Yutani Ltd t/a PawLunova, Bury; abbas@pawlunova.co.uk; +44 7598 327268 Mon-Fri 9-5. Owner: Abbas.
- Automatic discount: "Cosy Season Saving" £15 off order subtotal ≥ £129, ends 2026-10-31 23:59 (Sat 31 Oct). Non-combinable.

## Metafield contract (namespace `custom`) — the data agent creates the definitions and fills values ONLY from each
product's own description (never invent). Blank = unknown → the theme hides that element.
Product: subtitle (single_line_text_field) · best_for (single_line_text_field) ·
core_type (single_line_text_field; one of: Memory foam | Egg-crate foam | Crumb memory foam | Fibre | Mesh) ·
foam_guarantee (boolean) · density_kg_m3 (number_integer) · foam_depth (single_line_text_field, e.g. "S 6cm · M 8cm · L 10cm" or "24cm") ·
feel (number_integer 1-5) · has_liner (boolean) · cover_type (single_line_text_field; Zip-off fabric | Coated, wipe clean | Fixed cover) ·
wash_temp (number_integer) · non_slip (boolean) · low_entry (boolean) · entry_height_cm (number_integer) ·
sleep_style (list.single_line_text_field; Curls up | Head on the edge | Stretches out) ·
shape (single_line_text_field; Bolster & sofa | Mattress | Nest | Corner & chaise | Elevated | Crate mat | Car seat | Kennel | Steps) ·
ships_from (single_line_text_field; Own stock | Partner warehouse) · dispatch_days_min / dispatch_days_max (number_integer) ·
ships_same_day (boolean) · worth_it (multi_line_text_field) · qa (json: [{"q": "...", "a": "..."}]).
Existing keys the theme already reads stay valid: custom.tagline (subtitle supersedes it), custom.benefits, custom.specs, custom.care.
Variant: sleep_area (single_line_text_field "62 × 50cm") · suits_breeds (single_line_text_field) ·
suits_weight (single_line_text_field; Up to 10kg | 10–25kg | 25–40kg | 40kg+).
Definitions that should drive smart collections / filters are created with smartCollectionCondition + adminFilterable
capabilities where the API allows (low_entry, core_type, has_liner, shape, sleep_style, suits_weight).
A smart collection `low-entry-dog-beds` ("Low Step-In Dog Beds") is created from low_entry = true if the API allows a
metafield condition; otherwise tag those products `low-entry` and use a TAG rule.
A harness overlay with every product's and variant's custom.* metafields is exported to
scripts/theme-dev/fixtures/real-metafields.json and merged into --real fixtures.

## Theme rules the builders follow
- Claims only from data: guarantee/per-night/"year five"/density blocks need custom.foam_guarantee true (fallback: the existing
  description rule); density only with custom.density_kg_m3; liner only with has_liner; 30°C only with wash_temp; low-entry only with low_entry.
- No "Only N left" anywhere (low-stock display off by default). No ratings or counts unless ≥5 genuine reviews from an app.
- Whole-pound prices on the storefront (£149, not £149.00) — Liquid and JS; pence kept only when non-zero.
- No em dashes in theme copy (house style). British spelling.
- Delivery: never "same-day dispatch" unless custom.ships_same_day; dates = dispatch (metafield or policy 1-2 working days)
  + Standard 4-6 working days, excluding weekends and England & Wales bank holidays; Partner warehouse with no dispatch days →
  no dates, "Free, tracked delivery from our partner warehouse".
