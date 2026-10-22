# Premium design pass on the Yuva/Horizon theme, 22 October 2026

The brief: look at the dog-bed stores on Shopify that read as premium and bring
that design to the PawLunova "Yuva" build. What was taken is the *pattern* (type,
colour, spacing, shapes, layout, hierarchy), never a store's photos, copy, code or
name. Every rule below is applied through theme settings and the `pln-` layer, so
it can be adjusted in the editor or undone by deleting one line in
`layout/theme.liquid`.

**Where it lives.** Two themes on the store:

> **Premium design pass - serif, quiet header, cover hero (22 Oct 2026)** ·
> `gid://shopify/OnlineStoreTheme/209699242326` · **published by the owner at
> 16:24 on 22 October**, before the second round of fixes could be written to it.
>
> **Premium pass v2 - serif in sections, card prices, one-line bar (22 Oct 2026)** ·
> `gid://shopify/OnlineStoreTheme/209701699926` · unpublished. A duplicate of the
> live theme plus three files: `assets/pln-premium.css` (the pln sections now
> actually get the serif; muted eyebrows; regular-weight price; squared chips),
> `sections/header-group.json` (announcement shortened so it is one line on a
> phone) and `config/settings_data.json` (no currency codes on cards or in the
> basket). **Publish v2** to get the finished pass; or paste those three files
> from the repo over the live theme's.

The live theme (v1) therefore shows the chrome, hero and product page of this pass,
but its section headings are still in the sans and its cards still say "GBP". Both
themes also contain the product page pass (`docs/yuva-pdp-pass-oct2026.md`).

## 1. Who was studied, and what they share

Nine stores were rendered on 22 October at 1440 and 390 and their computed styles
read off the page (`scratchpad/comp/`, not committed): Big Barker (Impulse theme),
Charley Chau (Release), Lords & Labradors (Dawn), Mungo & Maud (Pacific), Cloud7
(Broadcast), MiaCara (custom), Wild One (Dawn), George Barclay (Vela), and
PawLunova itself as the baseline. LABONI and Omlet are not on Shopify.

| What the premium ones do | Big Barker | Charley Chau | Mungo & Maud | Cloud7 | MiaCara | Wild One | PawLunova before |
|---|---|---|---|---|---|---|---|
| Header ground | light grey | white | warm grey | white | transparent / white | white | **near-black** |
| Display face | Fraunces (serif) | Cormorant (serif) | Optima | Roboto Condensed caps | Avant Garde | Roboto Serif | Manrope, −2.5 tracking |
| Body face | DM Sans 15px | Helvetica 14px | Brandon 15px | Harmonia 13.6px | Aeonik | Modern Era 16px | Inter **13.4px** |
| Buttons | square, uppercase 14px, 2px tracking | square, caps | square, caps | square, caps | 30px pill, sentence | 30px pill, sentence | **pill, uppercase, animated fill** |
| Accent | one terracotta | one pink | none | none | none | one lilac | gold **and** terracotta eyebrows, green announcement bar |
| Hero | photo edge to edge, headline on it | photo edge to edge | framed photo | video edge to edge | video edge to edge | split, flat colour | split, framed photo |
| Product page gallery | large + 2-up grid | large + thumbnails | large + thumbnails | large + grid | **2-up grid** | **2-up grid** | carousel |
| Buy box details | accordion rows | tabs | accordion rows | inline | **hairline accordion** | **hairline accordion** | tabs |
| Cards | no border, image on light grey, name + price | no border | no border | no border | no border | no border | **borders, 25px radius, vendor line, stock line** |

The common ground, reduced to six rules: a quiet light header with a wordmark and
small tracked navigation; a serif display face at a light weight over a neutral sans
body, no negative tracking; squared or softly rounded buttons with small tracked
labels and no animation; one accent; full-bleed hero photography with the headline
on the image; borderless cards with imagery on a warm neutral ground and small radii.

## 2. What changed

### Theme settings (`yuva/store-merged/config/settings_data.json`, 90 values)

| Area | Before | Now |
|---|---|---|
| Headings | Manrope 600, −2.5 tracking, 95% scale | **Playfair Display 400**, 0 tracking, 100% scale, line-height 1.1 |
| Body | Inter 400, 14px base at 96% (13.4px) | **DM Sans 400, 16px**, line-height 1.5 |
| Subheading / accent | Inter 600 / Outfit 600 | DM Sans 500 |
| Heading sizes | h1 56, h2 32, h3 32 | h1 56, h2 40, h3 24, h4 20 |
| Page | white, black text | **bone #FAF6EF, ink #17150F** (the pln sections' own palette, so chrome and sections are one surface system) |
| Palette | grey-blue / grey / gold | moss #1A2B24 · oat #F1E9DB · sand #E3D7C3 · gold #C9943A (kept: the owner's buy-button colour) |
| Secondary scheme | #F6F6F6 / black | oat / ink; dark scheme moss / oat |
| Primary and secondary buttons | black fill, 50px radius, criss-cross hover fill | ink fill / outline, **4px radius, no animation**; uppercase kept, tracking added in CSS |
| Radii | layout 10, cards 25, grid 12, inputs 30, variants 6 | 4 / 6 / 4 / 4 / 2 |
| Product images | border on, grey #F3EFEC behind | border off, **oat** behind |
| Product cards | vendor line, stock line, centred, hover lift, auto-sliding carousel | name and price only, left-aligned, no lift, second image on hover |
| Badges | red sold-out, red pre-order | muted ink / moss |
| "Scroll to top" rotating badge | on | off |

### Header, announcement, footer (`yuva/store-merged/sections/*.json`)

- Header: bone ground, ink text, sand hairline, no blur; menu links at 0.75rem
  uppercase (tracking in CSS); mega-menu panels squared, oat alternate.
- Announcement bar: green carousel of two messages → **one static moss line**,
  "Free UK delivery over £40 · 100 nights to decide · Made in Yorkshire", no
  language, currency, flag or social clutter, arrows hidden.
- Footer: near-black → oat with ink headings and muted links.

### Hero (`yuva/sections/pln-hero.liquid`, `templates/index.json`)

New `layout` setting. **Cover**: the photo edge to edge (2400px wide, sized by
viewport, `fetchpriority="high"`), a scrim that darkens the left and bottom, the
H1 in white Playfair, the deck, both buttons, the three promises, and the caption
bottom-right. An optional portrait image takes over on phones; otherwise the
image's focal point in Shopify sets the crop. The original split layout is still
there as the other option.

### Chrome and section styles (`yuva/assets/pln-premium.css`)

Loaded from `layout/theme.liquid` after `pln-gold.css`. Weights and tracking for
the pln sections (Playfair at 400, eyebrows as muted tracked labels rather than a
second accent), button labels at 0.8125rem with 0.12em tracking, pln buttons from
pill to 4px, the text wordmark as tracked uppercase serif, the announcement bar as
small tracked caps, footer headings in the serif, hairline accordion rows and a
regular-weight price on the product page, and the hero cover styles.

### Product page (`yuva/store-merged/templates/product.json`)

Gallery: carousel → **two-column grid**, large first image, square, 4px radius.
Details: tabs → **accordion rows** (Description open, Delivery & returns,
Guarantee), price at h4 so the serif title leads, 22px gap between blocks.

## 3. What was deliberately not copied

- Big Barker's "clinically proven" and LABONI's condition claims (CAP Code, and
  the audit's rule against health claims).
- Omlet's "high demand" and FunnyFuzzy's countdowns and permanent was-prices
  (DMCC Act 2024 banned practices; the audit's "don't copy these" list).
- Any store's product photography, section copy, wordmark or theme code. The
  gold buy buttons stay as the owner set them on 19 October.

## 4. Verified on the v2 draft

Rendered through `?preview_theme_id=209701699926` in Chromium at 1440×900 and
390×844 (home, Coniston product page, orthopaedic collection), computed styles read
off the page:

- Body: bone `rgb(250,246,239)`, DM Sans. Headings: Playfair Display 400, tracking
  0 (hero H1 55px, product title 34px, collection H1 48px, section H2s).
- Header: bone ground, ink text, 68px; wordmark "PAWLUNOVA" in Playfair with 0.18em
  tracking; navigation 12px uppercase with 1.2px tracking.
- Announcement: one line, moss ground, 32px tall on a phone: "Free UK delivery over
  £40 · 100 nights to decide".
- Hero: cover layout renders edge to edge on desktop and phone, headline on the
  photo, gold primary and outlined secondary buttons at 4px with 0.12em tracked
  labels, promises in bone, caption bottom-right.
- Product page: two-column gallery grid, serif title, price £99.00 at regular
  weight, squared size buttons, size help, gold Add to cart, outlined Buy it now,
  promise box with 6px corners; no Liquid errors, no horizontal overflow.
- Collection: serif H1, squared chips, cards without borders, vendor or stock
  lines, prices "From £169.00" without a currency code, gold card buttons.
- No Liquid errors on any of the three pages; no page errors beyond Shopify's own
  web-pixel worker warnings.

Not changed, and visible in the captures: Yuva's quick-view (eye) and quick-add
(basket) icons floating on card images. They are the owner's quick-view settings;
with the card's own buy button in place they are redundant, and the premium stores
show none. Theme settings → Quick view switches them off.

A first run of this pass had three faults that the v2 draft fixes: `pln.css` reads
`--font-heading-family` while Horizon publishes `--font-heading--family`, so every
pln section heading fell back to the sans (it had been doing so on the live site
too); overrides in `pln-premium.css` lost to `pln.css`, which loads later, until
their specificity was raised; and the announcement wrapped to two lines on a phone.

## 5. For the owner

1. **Publish v2** (the draft above). The live theme already carries most of the pass. If something reads wrong, every
   value is a theme setting; the cover hero can be switched back to the framed
   layout in the hero section's settings; deleting the `pln-premium.css` line in
   `layout/theme.liquid` removes the CSS layer.
2. **Hero photo**: the cover layout needs a wide, sharp lifestyle photo (at least
   2400px) with the focal point set on the dog (Content → Files → the image →
   focal point). The current hero image is a product shot that was framed, not
   shot for full bleed; the premium stores all open on a photo made for it.
3. **Wordmark**: the header shows the shop name as text, now set as a tracked
   serif. A proper logo file (Theme settings → Logo) replaces it automatically.
4. **Product photos** still carry other brands' labels; borderless cards on oat make
   photography the whole card, which makes that more visible, not less.
