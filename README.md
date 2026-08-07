# Comfort Crest — Horizon theme (conversion build)

The uploaded `theme_export__comfortcrestcoukhorizon` export, rebuilt as a
launch-ready storefront. The starting point was a working Horizon theme whose
templates had been assembled from four different section apps (`smi-*`,
`modulo-*`, `blocko-*`, plus app blocks), each with its own palette, type scale
and button style. Nothing was structurally broken; it just didn't read as one
shop, and the conversion machinery was inconsistent from page to page.

The build zip is produced by `./build.sh` and lands in `dist/`.

---

## What changed

### 1. One design system instead of five

`config/settings_data.json` was rewritten. The old file mixed a gold
(`#c9943a`), a yellow band (`#f0d969`), a green (`#0e7c5a`) and a forest
(`#2e3d33`) across the same page. Now there is a single warm-editorial palette:

| Token | Value | Used for |
| --- | --- | --- |
| `background` | `#f7f3ec` | Page — warm parchment |
| `foreground` | `#1e231f` | Ink |
| `color1` | `#5c6159` | Muted text |
| `color2` | `#e2d9c9` | Rules and borders |
| `color3` | `#ede5d6` | Soft surfaces |
| `color4` | `#9a5b3b` | Clay accent — eyebrows, badges, icons |
| `color5` | `#fbf8f2` | Lightest surface |

Deep forest `#2f3d34` carries the primary button, the announcement bar, the
guarantee band and the footer.

Type is Cormorant for headings against Inter for body and UI, with uppercase
letter-spaced h5/h6 doing the "eyebrow" work. Corners are square across
buttons, cards, inputs and badges; buttons are uppercase and tracked. Page
width is 1440px (Horizon labels this `narrow`; `normal` is 1920px and `wide` is
2400px, both too wide for an editorial layout).

Also set here: quick add on (including mobile), express checkout buttons on,
variant images on, page transitions **off** (they add a render-blocking
`<link rel="expect">` that costs LCP for a purely decorative effect).

### 2. New sections, built for this shop

Eleven self-contained sections under `sections/cc-*.liquid`, one theme block,
three snippets, one stylesheet and one 70-line script. No app dependency — they
render on a fresh install with nothing else connected.

| File | What it is |
| --- | --- |
| `cc-hero.liquid` | Full-bleed editorial hero: eyebrow, headline, dual CTA, star rating, up to four trust chips |
| `cc-trust-strip.liquid` | Bordered 2/4-up USP row |
| `cc-collection-cards.liquid` | Category cards, text below or over the image |
| `cc-split-feature.liquid` | Image plus icon checklist |
| `cc-testimonials.liquid` | Review wall with an aggregate summary |
| `cc-comparison.liquid` | Us-versus-them table, ticks or free text per cell |
| `cc-process.liquid` | Numbered "what happens after you order" steps |
| `cc-guarantee.liquid` | Risk-reversal band |
| `cc-faq.liquid` | Accordion with optional `FAQPage` structured data |
| `cc-marquee.liquid` | Scrolling USP ticker |
| `cc-newsletter.liquid` | Email capture wired to Shopify's customer form |
| `cc-footer.liquid` | Menus, brand blurb, rating, social, payment icons |
| `blocks/cc-product-trust.liquid` | PDP stock state, live delivery-date estimate, guarantee lines, payment icons |
| `snippets/cc-ship-meter.liquid` | Free-shipping progress bar in the cart and drawer |
| `snippets/cc-icon.liquid` | One 24px stroke icon set, so icons stop looking borrowed |
| `snippets/cc-rating.liquid` | Star row |

Every section resolves colour through the theme's own `contrast-override`
snippet, so a merchant changing the palette in Theme settings changes these too,
and text contrast stays safe automatically.

### 3. Templates rebuilt

Each page now runs a deliberate order rather than whatever the section apps
left behind.

**Home** — hero → trust strip → category cards → best sellers → why-buy-here →
USP marquee → how it works → returns band → FAQ.

**Product** — the native `product-information` section with a rebuilt detail
column: eyebrow, title, rating, price (with instalments), variant picker,
**stock line + delivery-date estimate**, add to cart (now the *primary* button
— it was `button-secondary` in the Horizon preset), express checkout,
reassurance block with payment icons, three accordions, description,
complementary products. Below the fold: trust strip → why-buy-here → related
products → FAQ → returns band. Horizon's own variant-aware sticky add-to-cart
bar is switched on. Five variants of this template ship — see Product pages.

**Collection** — header → trust strip → filtered grid → sizing guide →
buying-guide FAQ with structured data → guarantee.

**Cart** — cart with the free-shipping meter → upsell grid → checkout trust row.

Also rebuilt: `blog.json` (it was shipping its own second header *and* footer on
top of the theme's own), the about and FAQ page templates, and the header and
footer section groups.

Every alternate template name that shipped with the export still exists —
`product.d1.json`, `product.d1 copy N.json`, the `*.smi-backup.json` files and
the `smi-humi-*` variants — each now carrying the rebuilt layout. Shopify 404s a
product whose assigned theme template is missing, so these names have to survive
even when the layout inside them is replaced.

### 4. Speed

- `smi-group` is no longer rendered from `layout/theme.liquid`. It injected the
  section app's full colour-scheme stylesheet — 4,600 lines of Liquid — inline
  on **every page**, all of it scoped to `.smi-section`, which no template uses
  any more. One line in the layout brings it back.
- Five app embeds (`3d-seasonal-effects`, `ot-theme-sections` script and style,
  `blocko-ai-theme-sections`, `ck-theme-sections-upsells`) are disabled in
  `settings_data.json`. They loaded global JS and CSS on every page for
  sections nothing renders. One toggle each in the admin re-enables them.
- Page transitions off (see above). Hero image is `fetchpriority="high"`,
  everything else lazy.

---

## Product pages

Five product templates — `product.json` plus `ottoman-bed`, `divan-set`,
`divan-base` and `bed-with-mattress` suffixes — each with the FAQ, "in the box"
line and specification panel written for that kind of bed. Assignment map,
paste-ready copy for the two supplier-written listings, and the catalogue data
issues found in the live store are all in **[docs/product-pages.md](docs/product-pages.md)**.

## Claims

Every customer-facing promise in this theme traces to
`/policies/shipping-policy` or `/policies/refund-policy`. The earlier build
shipped placeholder claims that went live and contradicted those policies
(100-night trial vs 30-day returns, 10-year guarantee vs 3 months, room-of-choice
assembly vs doorstep flat-pack, plus swatches, old-bed removal, Klarna and
invented reviews). All corrected or removed — the full list is in
`docs/product-pages.md` §5. Section *defaults* are fixed too, so a freshly added
section can no longer publish a promise the shop has not made.

## Before you go live

These need store data that isn't in a theme export:

1. **Hero image.** `cc-hero` has no image set and falls back to a placeholder.
   Set a landscape lifestyle shot, ideally 2400px wide.
2. **Category card images and links.** The three cards point at
   `collections/all-beds`; repoint them and add images.
3. **`/pages/contact`** — the only page CTA the theme still points at that you
   need to create. Everything else links to your real policy pages.
4. **Free-shipping threshold.** Theme settings → Cart. Default is 50; it must
   match your actual shipping profile or the meter lies.
5. **Reviews.** There is no review data on the store, so star ratings are off by
   default. The product page rating reads the standard `reviews.rating`
   metafield and appears by itself once Judge.me, Loox, Okendo or similar is
   connected.
6. **Assign the product templates.** See `docs/product-pages.md` §1.
7. **Footer menus and socials.** The footer blocks point at `main-menu` and
   `footer`; social URLs are empty and those icons stay hidden until filled.

## Validation

`@shopify/theme-check-node` reports **zero offenses** across every file this
build touched.

The 1,012 remaining offenses (94 of them errors) all sit in the app-generated
`smi-*`, `modulo-*` and `blocko-*` sections, which came in with the export and
are no longer referenced by any template. They are inert — nothing loads them —
so they were left in place rather than deleted, in case you want those apps
back. Deleting `sections/smi-*`, `sections/modulo-*`, `sections/blocko-*` and
their matching `snippets/smi-*` and `assets/smi-*`/`assets/modulo-*` files would
clear every remaining error and considerably tidy the theme editor's section
picker.
