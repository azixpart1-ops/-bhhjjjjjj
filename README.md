# PawLunova — Homepage Redesign

A conversion-focused rebuild of the [pawlunova.co.uk](https://pawlunova.co.uk) homepage.
Self-contained: open `index.html` in a browser, or serve the folder.

```
index.html            the page
assets/styles.css     brand system, layout, motion
assets/app.js         bed finder, reveals, menu, accordion
assets/img/           product photography (pulled from the live Shopify CDN)
```

Every claim, price, product name, handle and stock figure on the page comes from
the live store — pulled from the Shopify Admin API on 6 August 2026. Nothing is invented.

---

## 1. What was wrong with the old homepage

Diagnosed from the live page before rebuilding.

| Problem | Effect on sales |
|---|---|
| **The `<title>` tag read "Emberbeck \| Orthopaedic Dog Beds…"** — a different brand name | Every Google result and browser tab showed the wrong company. Fixed. |
| Ten products dumped in a grid, then **the same ten repeated** under "Customer Favorites" and "Bring Nature Indoors" | Choice paralysis with 27 SKUs and no triage. The single biggest leak. |
| Trust icons filled with placeholder copy — *"We offer a straightforward return policy to ensure that"* (sentence cut off mid-clause) | Reads as an unfinished site. Trust collapses at exactly the moment it's being asked for. |
| Social proof stated four different ways: `+3700 Owners`, `3900+ verified reviews`, `Over 3,900 Happy Dogs`, `3,700+ UK OWNERS` | Inconsistent numbers read as fabricated. Standardised on **4.8/5 from 3,900+**. |
| A review titled **"Merino Beanie"**, and two reviews whose body text literally starts *"Emotional win."* / *"Emotional: our anxious rescue…"* | Theme-demo and prompt artifacts left in production. Reads as fake. |
| `"Orthopaedic 50kg/m³ — Relieves All Pain"` | An absolute medical claim. Not defensible and a CAP Code risk in the UK. Rewritten (see §4). |
| `"5 - Year Foam Guaratee"` | Typo, in a trust badge. |
| No sizing help, no "which bed for my dog", no problem framing | Visitors arrived, saw 27 beds, and had to self-serve the hardest decision. |

The one thing the old site got **right**: the product descriptions. *"He used to drop.
Now he lowers himself."* is excellent copy that was buried on product pages while the
homepage said nothing. This rebuild pulls that voice up to the homepage.

---

## 2. The conversion architecture

The page walks one emotional arc — *notice → name it → solve it → de-risk it → prove it → close* —
because for a £69–£219 considered purchase, the buyer must first be convinced there is a
problem worth £150 before any product is worth looking at.

| # | Section | Job it does |
|---|---|---|
| 1 | **Hero** | Brand line as headline; the emotional trigger as the deck; the mechanism (50kg/m³) as the rational backup. Dual CTA — one for the undecided, one for the ready. |
| 2 | **Trust strip** (above the fold line) | 100-night trial, 5-year guarantee, Yorkshire, free delivery. Risk is killed *before* the first price is seen. |
| 3 | **Marquee** | Continuous, low-cost repetition of the proof points. |
| 4 | **"Three signs"** | Problem awareness + self-diagnosis. Named behaviours the owner can check tonight: circling, sleeping on the floor, the slower rise. Turns a nice-to-have into a now-purchase. |
| 5 | **Bed finder** ⭐ | The centrepiece. Three questions → one bed. Replaces a 27-product wall with a single confident recommendation. |
| 6 | **"Density isn't firmness"** | Price justification. Explains 50kg/m³ so the price stops being compared to a £25 supermarket bed. Four-layer cross-section makes the invisible visible. |
| 7 | **Four products** | Curated, each with a *role* ("Stiff mornings", "For burrowers"), not an undifferentiated grid. Priced high → low to anchor. |
| 8 | **100-night trial** | The strongest asset in the business, given a full section instead of a footnote. *"We collect it free of charge and refund every penny."* |
| 9 | **Reviews** | 4.8/5 with a live count-up. Includes a 4-star review with a mild criticism — imperfection raises credibility far more than a wall of fives. |
| 10 | **Made in Yorkshire** | Brand + differentiation. The Lake District naming system is the strongest brand asset the store has and was previously unexplained. |
| 11 | **FAQ** | Six real objections, in buying order. Also emits `FAQPage` schema for rich results. |
| 12 | **Finale** | Emotional close, then the same two CTAs. |

### The bed finder

`assets/app.js` → `BEDS` + `MATRIX`. Three questions (sleep style × joint condition × size)
resolve to one of eleven real products, with real handles, real "from" prices and real stock.

| | No concerns | Slowing down | Diagnosed |
|---|---|---|---|
| **Curls up tight** | Buttermere Bouclé £69 | Windermere Nest £69 | Coniston £99 · Langdale £109 *(large)* |
| **Leans on something** | Harrogate £69 | Grasmere Sofa £79 | Grasmere Ortho £89 · **Borrowdale £154** *(large)* |
| **Sprawls flat out** | Sprawler £59 | Ambleside £124 | Kendal £169 |

The price ladder rises with need in every row — the more the dog needs, the more the owner
is willing to spend, and the finder puts them in front of exactly that bed.

### Branding

There was no coherent system before, so one was built from what the store already owns:
the **Lake District / Yorkshire dales** naming (Borrowdale, Coniston, Grasmere, Windermere…).

- **Palette** — bone `#FAF6EF`, oat, sand, deep moss `#27312A`, terracotta `#B35A33` for action.
  Warm British heritage, not bright pet-shop primary colours.
- **Type** — a transitional serif for display, system sans for body. Tracking and leading are
  size-specific (tight negative tracking on display, near-zero on body).
- **Voice** — observational and specific, taken from their own product copy. Never "premium
  quality pet products".

---

## 3. Craft notes

- **Motion** — `transform`/`opacity` only. Strong custom curves (`cubic-bezier(0.23, 1, 0.32, 1)`),
  never `ease-in` on entrances, never `transition: all`, never `scale(0)`. Press feedback fires
  on `:active` at 120ms. Hover motion is gated behind `@media (hover: hover) and (pointer: fine)`
  so a tap doesn't fire a phantom hover.
- **Reduced motion / transparency** — `prefers-reduced-motion` swaps movement for cross-fades and
  stops the marquee; `prefers-reduced-transparency` makes every frosted surface solid.
- **Accessibility** — skip link, visible focus rings, `aria-expanded` on the menu and FAQ,
  labelled star ratings, and a palette checked against WCAG AA (body 16.9:1, muted 5.5:1,
  CTA text 4.5:1, small terracotta 5.4:1, stars 3.6:1 for non-text contrast).
- **Performance** — no frameworks, no external requests. Hero preloaded with `fetchpriority="high"`,
  everything below the fold lazy-loaded with `srcset`. Total CSS+JS is ~35KB unminified.
- **Verified** — rendered in Chromium at 1440px and 390px: no console errors, no horizontal
  overflow, finder flow returns correct product/price/stock/link, sticky CTA shows and hides
  at the right thresholds, mobile menu opens, closes on Escape and anchors to the header.

---

## 4. Things I changed on purpose — please confirm

Three judgement calls where I did not reproduce the live site verbatim. All are reversible.

1. **"Relieves All Pain" → "Pressure-relieving support for ageing joints."**
   The original is an absolute medical claim. The FAQ answer on arthritis is likewise written
   to be truthful and defensible ("a bed isn't a treatment… please keep talking to your vet")
   rather than promising an outcome. This *increases* trust with the exact buyer you want.

2. **Review copy cleaned of artifacts.** The substance of each review is verbatim; I removed the
   demo title "Merino Beanie" and the leading `"Emotional win."` / `"Emotional:"` fragments.
   **These reviews still read as AI-generated** ("Wow! Impressed", "I love this product").
   Swapping in real verified reviews is the highest-value change you can make after launch.

3. **Ambleside shows "From £124".** The live homepage says £134; the Shopify catalogue says
   M £129 / L £124. I used the catalogue. Worth checking which is right.

Also standardised: **3,900+ reviews at 4.8/5** everywhere. The site currently says 3,700 in two
places and 3,900 in two others — please confirm the real figure.

---

## 5. ⚠️ Blocker before this goes live

**Much of the product photography carries other companies' branding.** I verified this by
inspecting the full-resolution files from your CDN:

| Image | What's visible |
|---|---|
| `borrowdale` (The Borrowdale Orthopaedic) | **"Heavenly Beds for Saved Souls"** watermark, bottom right |
| `harrogate` (The Harrogate Heritage) | Leather patch reading **"HOUND"** |
| `coniston_ortho` (Coniston Orthopaedic) | Label reading **"WILTON"** |
| `grasmere_sofa`, `buttermere_boucle`, `buttermere_mattress`, `ullswater`, `windermere_nest`, `kendal_cord` | Other manufacturers' leather tags |

This is why the hero, the Yorkshire section and the trial section use `rydal_plush`,
`wensleydale` and `coniston_rev` — the cleanest images in the library — and why the featured
four are Kendal / Coniston Reversible / Wensleydale / Rydal Nest rather than the Borrowdale
and Harrogate you currently lead with.

I did not edit the watermarks out: removing another company's mark from imagery you may not
own is not a fix, and the leather tags are part of the physical product in shot. **Reshooting
your own product is the fix.** It also directly contradicts the "made in our Yorkshire
workshop" claim the page leans on, which is a real exposure.

The bed finder still recommends the *correct* bed regardless of photo quality — swap the
images and nothing else needs to change.

---

## 6. It's installed on Shopify

Everything in `shopify/` is live in an **unpublished** theme on the store:

> **PawLunova — Conversion Homepage (preview)** · theme ID `190461313317`

The live theme is untouched. To look at it: **Online Store → Themes → … → Preview**.
To ship it: **Publish** that theme. To roll back: publish the previous one.

```
shopify/
├── assets/pl-styles.css      every rule scoped under .pl
├── assets/pl-app.js          reveals, FAQ, count-up, sticky CTA, bed finder
├── snippets/pl-icon.liquid   icons inlined per use, no shared sprite
├── snippets/pl-assets.liquid stylesheet + script tags
├── sections/pl-*.liquid      11 sections, each with a full schema
└── templates/index.json      the homepage, wired to real products
```

### Built to survive being edited

- The theme keeps its own header, footer, cart drawer and announcement bar. Only
  `templates/index.json` changes — `layout/theme.liquid` is untouched.
- All CSS is scoped under `.pl`, so nothing can reach the theme chrome or an app section.
  Verified: no `body`, `html` or bare element selector escapes the scope.
- Every section carries a `{% schema %}`, so copy, images, products, ordering and the finder's
  recommendation matrix are all editable in the theme editor without touching code.
- Each section renders the shared assets itself and inlines its own icons, so any section can be
  reordered or deleted without breaking the others. `pl-app.js` guards against double-initialising
  and re-runs on `shopify:section:load` for the editor.

### The finder reads live data

Price, stock, image and URL come from the catalogue at render time through a JSON island
(`#pl-beds`), so *"Only 2 left in stock"* is bound to real inventory — never a hardcoded number.
Recommendations are blocks with product pickers, so the matrix can be rewired in the editor.

### Verified on the rendered preview

Fetched the real Shopify output, then drove it in Chromium: no Liquid errors, all 11 sections
present, the finder JSON parses with all 11 recommendations at live prices and stock, the finder
returns the right bed / price / size / stock / link, the FAQ opens, the theme header and footer
are intact, and there's zero horizontal overflow at 1440px and 390px.

One carry-over: the competitor-branding problem in §5 applies to the Shopify build exactly as it
does to the standalone one. Images are pulled straight from your product records, so fixing them
there fixes them here — no code change needed.


---

## 7. The default product page

A single `templates/product.json` that serves **every** product — no per-product
templates. Installed in the same unpublished preview theme.

Nine sections: the buy block, a proof marquee, the product's own description plus a
specs panel, the 50kg/m³ explainer, the 100-night trial, reviews, related beds, the
FAQ and the closing CTA. Six of those are reused from the homepage, so a copy change
in one place changes both.

### Built to fit anything in the catalogue

Verified against the four hardest shapes in the store:

| Product | Shape | Result |
|---|---|---|
| Kendal Corduroy | 9 variants, 2 option sets, 13 images | Both pickers render, price moves £169 → £219 on size change |
| Windsor Memory Foam | 12 variants, 2 option sets | Both pickers render |
| Keswick Kennel | 1 variant, no options | Picker hidden entirely |
| Harewood Velvet Nest | 1 option set, 6 images | Renders; related section falls back cleanly when absent |

The variant picker is generic over `product.options_with_values`, so it doesn't care
whether the option is called "Size", "Accessory size", "Color" or "Colour". Combinations
that don't exist are struck through. Price, availability, stock, image and the `?variant=`
URL all update on selection.

### Add to basket

A real `<form action="/cart/add">` that works with JavaScript disabled, enhanced to
`fetch('/cart/add.js')` with an inline confirmation and a fallback to the native post if
the request fails. Verified end to end against the live endpoint: adding the Kendal
M / Beige variant returned HTTP 200 with the correct £219.00 line.

### Per-product copy, without per-product templates

Where a product has the metafields, the page uses them; where it doesn't, the section
defaults fill in:

- `vitals.tagline` → the italic hook under the title
- `vitals.top_benefit_1–3` → the benefit list in the buy column
- `vitals.key_benefit_1–3_*` → the layered detail cards below the description

### What this replaces

The old product template had problems that were costing sales on every product page:

| Was | Now |
|---|---|
| "10-Year Foam Guarantee" — contradicting the 5-year claim everywhere else | 5-year, consistently |
| "4.9★ from 2,400+ reviews" — a third different figure | 4.8 / 3,900+, worded as a store rating |
| "Why Pet Parents Trust **The Borrowdale**" on *every* product page | Reads from the product |
| "Breathable comfort… keeping you fresh all day", "Ultra-soft and gentle on the skin", "Stretchable fit" | Removed — that was clothing copy on a dog bed |
| "Higher density foam (60+ kg/m³)… standard foam (30-40 kg/m³)" | Removed — it framed your own 50kg/m³ as second tier |
| "GREEN LIVING COLLECTION" above related products | Reads from the collection |
| Fake purchase popups: invented buyer names, "purchased N minutes ago", labelled "Verified" | Not carried over — see §8 |


---

## 8. The rest of the site

You published the homepage/PDP theme partway through this round, so it became live
and theme writes against it are (correctly) blocked. Everything below is in a fresh
draft duplicated from it:

> **PawLunova — Collections, pages & PDP v2 (draft)** · theme ID `190481662245`

**Online Store → Themes → … → Preview**, then **Publish** when you're happy. The
currently-live theme is untouched.

### What's in it

| Template | Covers | Notes |
|---|---|---|
| `collection.json` | all 3 collections | Hero from the collection's own title/description/image, sort, paginated grid, in-grid promo tile to the bed finder, SEO copy moved below the grid, empty state |
| `page.json` | privacy, sitemap | Default page layout |
| `page.size.json` | Size & Firmness Guide | Tables styled properly |
| `page.our-story.json` | Our Story | |
| `page.faq.json` | FAQ | |
| `page.choose-orthopaedic-beds.json` | buying guide | |
| `page.contact.json` | Contact | Form with a breed/weight field, short-answers panel |
| `cart.json` | basket | Quantity controls, free-delivery progress bar, trust beside checkout |
| `blog.json` / `article.json` | News + 8 articles | |
| `404.json` | not found | Routes to the finder rather than a dead end |

Those four `page.*` suffix templates matter: the size guide, Our Story, FAQ and
buying guide each have a template suffix assigned, so `page.json` alone would never
have reached them.

### PDP enhancements

- **Product + BreadcrumbList JSON-LD** — per-variant offers with price, currency and
  availability. Verified on the Kendal: 9 offers, £169.00 GBP, InStock.
- **Size helper** in the buy column, where the sizing objection actually lands.
- **Click-to-zoom** on gallery images; closes on Escape or backdrop, focus returns.

### Collection heading fixes

Your orthopaedic collection title is `Orthopaedic Dog Beds UK | Memory Foam Joint
Support | Pawlunova` and was rendering verbatim as the H1. The heading now takes the
part before the first pipe; titles without a pipe are untouched. That collection's
description also opens with its own `<h1>`, so headings inside the rendered
description are demoted a level, leaving one H1 per page from my sections.

### Verified

All eleven page types rendered from the draft theme: no Liquid errors anywhere, the
collection grid is 4-up on desktop and 2-up on mobile with the promo tile placed,
sort works, zero horizontal overflow at 1440px and 390px.

### Two things I did not change

1. **Your footer marks its column headings as `<h1>`** — "About", "Shop", "About the
   shop". That gives every page on the site four H1s. It's in an app-provided footer
   section, so editing it there would be overwritten on the next app update. Worth
   fixing at the source.
2. **`/collections/orthopaedic-dog-beds` 404s** — I'd used it in the homepage nav in
   the earlier round. Corrected everywhere to `orthopaedic-dog-beds-uk`. If that URL
   is linked from ads or emails, set up a redirect.


---

## 9. Invisible text, and the slide-out cart

### The bug

Text on the dark sections was nearly invisible across the whole theme — cream on
cream. The cause was a CSS class-name collision, not a colour mistake:

```css
/* Horizon, base.css */
.shopify-section:not(.header-section) :is(.section,.cart-summary){background:transparent}
```

Three classes (0,3,0) against my two (`.pl .section--dark`, 0,2,0). The theme won and
forced my dark sections transparent, while my `color: var(--oat)` still applied — so
cream text landed on the cream page background.

Ten of my class names collided with theme classes: `.section` (63 theme rules),
`.card` (51), `.hero` (36), `.details` (34), `.field`, `.rte`, `.line`, `.stars`,
`.hero__media`, `.visually-hidden`.

**Why I missed it:** my offline render tests stripped the theme's stylesheets, so
there was nothing there to collide with and everything looked correct. Tests now load
the real cascade — all 18 stylesheets — before asserting anything.

### The fix

- All ten families namespaced to `pl-*` across CSS, Liquid and JS.
- Scope raised from `.pl` to `.pl.pl`, so a future three-class theme or app rule
  cannot outrank a single-class component of mine. No markup change.
- Verified against the real cascade: dark sections compute to `rgb(39,49,42)` with
  `rgb(241,233,219)` text — 11.2:1.

One thing to know: the rename regex also matched quoted tokens in schema JSON, so it
briefly rewrote `"tag": "section"` to `"pl-section"` in 21 sections and renamed a
block setting id to `pl-stars` (which is additionally invalid, as Liquid paths cannot
contain hyphens). Both were caught and reverted before deploying. The linter now
checks schema tags, setting ids, block types and Liquid paths for stray prefixes.

### Slide-out cart

`sections/pl-cart-drawer.liquid`, on every template except the cart page.

- Server-rendered, then re-rendered through the **Section Rendering API** after every
  change, so money formatting, discounts and currency stay with Shopify. Nothing about
  price is computed in JavaScript.
- Opens on add to basket and on any link to `/cart`; quantity and remove update in
  place; free-delivery progress bar; focus trap, Escape, scrim click, scroll lock.
- Enters and leaves along the same path on the iOS drawer curve
  (`cubic-bezier(0.32, 0.72, 0, 1)`, 340ms); reduced motion gets a fade instead.
- While the drawer is present the PDP no longer fires `cart:*` events, so the theme's
  own drawer cannot open on top of it.

A detail worth recording: the Section Rendering API needs the **qualified** section id
(`template--<n>__pl_cart_drawer`), not the `pl_cart_drawer` key from the template file.
Requesting the key returns `{"pl_cart_drawer": null}` and would have left the drawer
stale after every change. The section renders its own `{{ section.id }}` onto the
element and the script reads it from there.

Verified with real cart contents: line item, variant, price, quantity stepper, remove,
"Free UK delivery unlocked", subtotal from Shopify (including the volume discount your
app applies), checkout button. No console errors at 1440px or 390px.

---

## 10. Quiz sizing, collection filters, landing page

### The quiz was sending people to the wrong size

Three problems, all found by checking the recommendations back against the catalogue
rather than against what the copy said.

- **The Borrowdale was recommended for dogs over 25kg.** Its own description says
  *"Large 90 x 65cm — internal 68 x 45cm — Border Collie, Springer, Cocker, Sheltie.
  To 25kg."* It is a one-size bed rated **to** 25kg, so it now serves the medium band
  and the large band goes elsewhere.
- **The Windermere Nest topped out at 71 × 58cm**, which is not a bed for a Labrador.
  Large nest sleepers now go to the **Rydal**, which runs to 2XL at 88cm across.
- **The Langdale had no real sizes left** — its options are now `customizable` and
  `standard` — so it came out of the matrix entirely.

### And it was asking owners to guess kilos

Question 3 used to lead with weight bands. Most people do not know what their dog
weighs to the nearest 5kg, and the ones who guess, guess low. It now leads with breeds
and keeps the weight underneath as a cross-check:

> **Medium** — Cocker · Border Collie · Springer · Staffie — *10 – 25kg*

Underneath the options is the measure-up from the Borrowdale page, for anyone who wants
to be certain: *wait until they're asleep and stretched out, measure nose to base of
tail, add 20cm.*

### The result now names a size and links to it

Each recommendation block carries a size option **and** the real internal dimensions per
band. The result panel shows the price of *that* size, the dimensions, and links to the
variant URL — so the customer lands on the product page with the right size already
selected instead of having to pick again.

The Liquid that resolves it compares option tokens **exactly**:

```liquid
{%- assign parts = v.title | downcase | split: ' / ' -%}
{%- for part in parts -%}
  {%- if part | strip == wlower and vid == '' -%}
```

`contains` would let `l` match `large` — on the Rydal, whose variants are
`green / large`, that silently picked a bed two sizes too big.

### Collection filters

`sections/pl-collection.liquid` + `initFilters()` in `pl-app.js`.

Three facets — who it's for, what they need, budget — filtering the cards that are
already on the page. No reload, no flash, no Section Rendering round trip. The state
lives in the URL (`?fit=large&price=under-75`), so a filtered view can be sent to
someone or used as an ad landing URL.

Every attribute a filter reads comes from real product data at render time:

```liquid
data-price-band="{{ band }}"          {%- comment -%} from price_min {%- endcomment -%}
data-sizes="{{ sizes | escape }}"     {%- comment -%} from the size option's values {%- endcomment -%}
data-type="{{ item.type | downcase | escape }}"
data-tags="{{ item.tags | join: ',' | downcase | escape }}"
```

A bed with no size option is treated as suiting every dog rather than none. The size
bands map the store's actual option values (`s`, `m`, `l`, `xl`, `2xl`, `medium`,
`large`) onto small / medium / large, because the catalogue uses both conventions.

One limit worth knowing: it filters the current page of results, which is 24 products.
Collections longer than that would need server-side filtering.

### The landing page

`templates/page.pl-landing.json`, built from three new sections plus the ones the
homepage already uses.

| Section | Job |
| --- | --- |
| `pl-landing-hero` | The recognition moment. *"He used to drop. Now he lowers himself."* |
| `pl-signs` | Naming the symptoms before offering the fix |
| `pl-landing-cost` | Loss aversion, then the price reframe — 9p a night |
| `pl-finder` | The quiz, as the buying path |
| `pl-mechanism` | Why 50kg/m³ costs what it costs |
| `pl-products` / `pl-reviews` | The beds, then other owners |
| `pl-landing-offer` | Everything included, then what you actually risk |
| `pl-finale` | The emotional close |

**Every line of copy on it is the store's own.** The hero, the two columns, the 9p
figure and the closing quote are all lifted from the Borrowdale product description —
which is the best-written thing on the site and was buried three clicks deep. Nothing
is invented: no countdown, no "3 people are viewing this", no discovered-today discount.

The one number that does arithmetic is the 9p: £169 across the five years the foam core
is guaranteed for is 9.26p a night, and the caption states that basis rather than just
asserting the figure.

The template is `page.pl-landing`, not `page.landing` — your theme already has a
`page.landing.json` and this must not overwrite it. To use it: **Pages → Add page →
Template suffix: `pl-landing`**.

### Two things in the catalogue

- **A product called "Test" at £1.00 is published and sits in the Orthopaedic
  Dog Beds collection.** It shows up in every filter combination, because a £1
  product with no tags and no size options matches everything. Unpublish it.
- The Borrowdale's size option is labelled **`l`** while its description rates it
  **to 25kg**. The quiz follows the description; the collection filter follows the
  option label, because that is what a customer sees on the product page. Worth
  renaming the option if the description is the truth.

### Verified

Quiz answered end to end for two combinations; result name, price, size, dimensions and
variant deep link checked against the catalogue. Filters clicked, combined, shared by
URL, restored from URL and cleared. Landing page checked at 1440px and 390px for
horizontal overflow, and every text/background pair on it measured for contrast — with
the theme's own stylesheets loaded, which is the step that was missing when the
invisible-text bug got through.

---

## 11. The Cooling Collection

### Colour coding

The collection runs on a **cool colourway**: same typeface, same layout, same
components, only the palette moves. It lives in `snippets/pl-cool-palette.liquid`
as a token override, so the product cards, filters, promo tile, FAQ, trial block
and cart drawer all recolour without a line changing in any of those sections.

The one non-obvious bit: the override is written at `.pl.pl.pl`, not `.pl.pl`.
Every `pl-*` section renders its own `<link>` to `pl-styles.css`, so a section
further down the page reloads the sheet *after* the override and would win on
source order. One extra class settles it without `!important`.

Cooling PDPs pick the colourway up automatically, off their own tags and type —
so the collection and the product pages match, and a new cooling bed is the right
colour the day it is added.

Every pair on the page was measured against the ground it actually lands on.
Lowest is 5.07:1 where 4.5 is required.

### Sections

| Section | Job |
| --- | --- |
| `pl-cool-hero` | H1, subhead, intro, two CTAs, reassurance chips |
| `pl-cool-how` | The three mechanisms — gel, airflow, covers — each with a spec line |
| `pl-cool-guide` | "Which one for your dog", seven rows, each linking to a real product at its live price |
| `pl-collection` | The existing grid, with the filters already built for collections |
| `pl-cool-trust` | Trust bar under the grid |

`templates/collection.pl-cooling.json` ties them together with the FAQ, trial and
closing CTA. `pl-collection` gained a `show_header` toggle so the bespoke hero can
carry the H1 without the page shipping two of them.

The template is `collection.pl-cooling`, not `collection.cooling` — your theme
already has a `collection.cooling.json` and this must not overwrite it.

### The compliance guardrails, and where they bit

- **No medical claims.** The copy says what the products physically do: draw heat
  away, allow airflow, keep the surface cooler than the floor.
- **The safety line** — *"not a substitute for shade, fresh water, or keeping a dog
  out of a hot car"* — appears twice on the collection page, once in the collection
  description, and on **every cooling PDP automatically**. It is driven off product
  tags and type rather than a per-product setting, so nobody has to remember it.
- **No stars, no review counts, no origin claims.** "UK-based support" only.
- **Duration claims.** The brief said 3–4 hours, recharging in 15–20 minutes. The
  store's own spec sheet on the Coniston gel mat says *"Cooling duration:
  approximately 3 hours per cycle"* and *"self-recharging during rest"* with no
  recharge figure. The page says **around 3 hours**, and gives no recharge number.
  If a supplier sheet backs 3–4 hours, the spec line is a section setting.
- **The 5-year foam guarantee is off this collection.** None of the beds in it are
  memory foam. The 100-night trial stays.

---

## 12. The Fourth Bed, and a global audit

### A second landing page, on a different lever

`templates/page.pl-story.json`. Not a replacement for `page.pl-landing` — a
second angle to test against it.

| | Runs on | Best for |
| --- | --- | --- |
| `page.pl-landing` | Loss aversion. What the next six months cost. | Warm traffic, owners of an ageing dog |
| `page.pl-story` | Sunk cost, answered with the mechanism. | Cold traffic, anyone who has already bought a bed that failed |

Two new sections:

- **`pl-story-hero`** — a ledger of the beds that came before, closing on what
  they had in common. No invented prices: the rows describe what happened, which
  is the store's own framing (*"You have bought him beds before. Good ones."*).
- **`pl-story-autopsy`** — fibre migration **drawn rather than asserted**. Each
  stage renders a cross-section whose top edge sags by the amount its block
  specifies, against a dashed line marking the loft the bed arrived with. The SVG
  path is computed from the settings, so the drawing cannot drift from the
  numbers — change the loft, the diagram changes.

### What the design-system pass changed, and what it didn't

Ran the `ux` skill's design-system generator. Three of its recommendations were
rejected on the evidence:

- **Liquid Glass style** — the tool flags it itself as *"Performance:
  ⚠ Moderate-Poor, Accessibility: ⚠ Text contrast"*. Wrong trade for a shop.
- **Amatic SC / Cabin** typography — Amatic SC is a thin handwritten display
  face. It would have replaced a type system already shipped across 31 sections,
  against the skill's own `consistency` rule.
- **Horizontal Scroll Journey** pattern — poor for mobile commerce.

What it did earn:

- **The palette was independently validated.** The skill's colour database
  returns `#1C1917 / #44403C / #A16207 / #FAFAF9` for premium e-commerce. The
  brand already runs `--ink #17150F / --ink-2 #3A352A / --gold #A87821 /
  --bone #FAF6EF` — the same family. No change needed, and now there's a reason
  on file for keeping it.
- **Stagger timing was wrong.** The guidance is 30–50ms per item; reveals were
  at 70ms, so a five-item row spent 350ms of pure delay before the last card
  began. Now 45ms, applied across every section at once.
- **A missing token.** `--clay` is tuned for bone and only reaches **2.84:1** on
  `--moss`, so accent text on any dark section was failing. Added
  `--clay-onDark` (#D18A5E, 4.82:1) and its cool-colourway counterpart
  (#4FA3BE, 4.85:1). A gap in the system, not a one-off.

### Global colour audit — two live failures

Audited every foreground/background pair the theme's own `settings_data.json`
binds to a role. Two fail, both on conversion elements:

| Token | Role | Now | Needs | Fix |
| --- | --- | --- | --- | --- |
| `color3` | Secondary button label **and** border | **2.51:1** | 4.5:1 | `#8a6420` → 4.97:1 |
| `color4` | Input **and variant-selector** borders | **1.34:1** | 3:1 | `#9c9184` → 3.09:1 |

`color4` is the expensive one: it is the border on the size selector, so on
every product page the control a customer must use to buy is drawn at 1.34:1 —
effectively invisible. Both replacements hold the original hue.

These are theme-editor values, so they are **not** changed in code here — set
them in **Theme → Colours** rather than have a file write race the editor.

The other palette entries (`color10`–`color16`) are unbound swatches with no
role mapping, so they were left alone; several would fail as text but may be
used deliberately as backgrounds.

### Correcting an earlier note

I previously reported the footer marking column headings as `<h1>` and blamed
the theme. Checked against the rendered HTML: the theme's menu block puts `h1`
on a `<summary>` as a **type-scale class**, not a heading element. The real
source is the **smi footer app**, which emits three genuine `<h1>` elements
("About", "Shop", "About the shop"). With the theme's `visually-hidden` H1 and
the page's own, that is five H1s on the homepage. Fix it in that app's settings,
not in theme code.

Also verified while in there: meta description and canonical **are** present
(an earlier strict grep of mine missed them). But **`og:image` is genuinely
absent** while `twitter:card` is set to `summary_large_image` — so every share
of the homepage renders as a bare text card. And the homepage title reads
*"I'm Pawlunova | Orthopaedic Dog Beds Made for Real Sleep – PawLunova"*, which
opens oddly and duplicates the brand.

One caveat on method. Shopify's bot protection now issues a Cloudflare challenge to
any request carrying a preview-theme cookie, so the draft theme's URLs could not be
loaded from this sandbox — the challenge needs a real browser and this sandbox's
browser has no outbound network. The pages were therefore rendered locally from the
same `.liquid` files and the same template JSON, with the live theme's real
stylesheets downloaded and loaded in their real cascade order, and the quiz and
filter JSON built from live variant, tag and option data pulled through the Admin
API. Shopify still validated every section server-side on upload — a section whose
schema it rejects simply never appears, and all of them appear at exactly their
local byte size.

---

## 13. Homepage redesign — every section editable, no copy touched

The brief for this round: redesign the homepage into something that converts,
**without changing a word of the text**, and make each section as customisable in
the theme editor as it can reasonably be, because the shop will be tuned there
rather than in code from now on.

So this round adds no copy and removes none. It changes what the sections *are*,
and it hands the controls over.

### The copy promise, checked rather than asserted

`scripts/` has a companion to the linter for this. It diffs the committed
`templates/index.json` against the working one and fails if any value that existed
before has changed or disappeared; only new keys and a new `order` are allowed.

```
PASS — every value that existed before is byte identical.
       100 new keys added (all design settings).
       197 copy strings before, 197 after, on the same keys.
       No copy string added, removed or altered.
```

### What changed on the page

| | Was | Now | Why |
|---|---|---|---|
| **Hero image** | Rounded rectangle | **Arch** | The one silhouette no stock Shopify theme ships with, and the shape that crops a square product photo least badly — which is what the catalogue is full of. |
| **Trust row on mobile** | 2×2 block | **One swipeable row** | At 2×2 the delivery promise sat below the fold. All four claims now stay in play. |
| **Shop by need** | 52px thumbnail beside a label | **Image tiles, 3-up** | A photograph of a nest bed answers "which of these is my dog" faster than the words "Nest & bolster" do. Falls back to the compact row on its own if the collections have no images, so it cannot ship as six empty boxes. |
| **Four beds on mobile** | 2-up grid | **One swipeable row** | A grid puts cards three and four below the fold with nothing to say they exist. A snapping row shows the edge of the next card, which is the signal. |
| **Layer diagram** | Four separate cards | **Stacked cross-section** | The section's whole argument is that the bed is four layers in a fixed order. Now it is drawn that way. |
| **Reviews on mobile** | Four stacked cards | **One swipeable row** | Same reasoning; it also stops the section costing four screens of scroll. |
| **FAQ** | One column, six questions | **Two columns above 900px** | Halves the scroll depth immediately before the close. Reverts to one column below 900px, where two would be worse. |
| **Closing CTA** | Flat green | **Photograph behind a scrim** | Bookends the page with the hero's image. |
| **Marquee** | 42s loop | **58s, pauses on hover** | At 42s a claim left the screen before it could be read. |
| **Order** | … mechanism → **reviews → trial** → brand … | … mechanism → **trial → reviews** → brand … | §2 of this document sets out the arc as *notice → name it → solve it → de-risk it → prove it → close*. The template had prove before de-risk. The 100-night trial now lands while the price is still the thing in the reader's head, and the reviews become the last push before the FAQ and the close. |

### The contrast floor on the new background image

The scrim over the closing photograph is a slider, and its floor is 75%, not 0.
Worst case for a background image is a fully white region under the text. Measured
against that:

| Scrim | Heading | Sub-line | Fine print |
|---|---|---|---|
| 40% | 1.96:1 | 1.79:1 | 1.18:1 |
| 60% | 3.38:1 | 3.07:1 | 2.03:1 |
| **75%** | **5.46:1** | **4.96:1** | 3.27:1 |
| 80% (default) | 6.47:1 | 5.88:1 | 3.88:1 |

The fine print is the one that still fails at the floor, so over an image it takes
the brighter of the two on-dark inks instead of the muted one — 4.96:1 at 75%. On a
plain ground nothing changes. The slider cannot be dragged low enough to publish an
unreadable close, which is the same principle `pl-scheme` already applies to colour.

### The controls each section now has

Every homepage section carries three groups: **Design**, **Layout and spacing**,
**Colour**. Colour was already there. The other two are new.

**Layout and spacing**, on all of them:

- Content width — narrow 1040 / normal 1240 / wide 1440 / full
- Heading alignment, where the section has a head to align
- Heading size, 70–130%, which scales the display type *only* — body copy stays put
- Top and bottom padding, separately for desktop and for phones
- Hairline above / below
- Corner radius — square, soft, rounded
- Reveal on scroll, on or off
- An anchor id, so a button anywhere can jump to the section

**Design**, section by section:

| Section | Controls |
|---|---|
| Hero | Split or stacked layout · image left or right · copy/media balance · image shape (rounded, arch, square) · aspect ratio · drop shadow · trust row style, column count and mobile behaviour |
| Proof marquee | Band colour (dark, oat, accent, rules only) · caps or sentence case · dot, slash or no separator · loop speed · direction · gap · text size · band height · pause on hover |
| Shop by need | Compact row or image tiles · 2–6 columns or auto-fit · tile aspect ratio · arrow on/off |
| Three signs | 2–4 columns · cards, rule-above or plain · numbering on/off |
| Bed finder | Raised card or flat panel · step counter on/off · anchor id (with a warning that five other buttons point at it) |
| Four beds | 2–5 columns · image aspect ratio · bare or framed cards · grid or swipe row on mobile · role label, price and link text each on/off |
| Why it costs this | Diagram left or right · balance · cards, stacked cross-section or colour bars · 1–4 proof points per row |
| Reviews | 2–4 columns · framed or plain · stacked or swipe row on mobile · score panel on/off |
| 100-night trial | Image left or right · balance · image aspect ratio |
| Made in Yorkshire | Image left or right · balance · image aspect ratio |
| FAQ | One or two columns · open the first answer on/off · structured data on/off |
| Closing CTA | Centred or left · background image (or a product's photo) · scrim · second button style |

### How it is built, and why nothing else moved

`snippets/pl-layout.liquid` is the companion to `pl-scheme`: where that one moves a
section's colour tokens, this one moves its geometry, by emitting custom properties
scoped to a single `#shopify-section-…`. The stylesheet was rewritten to read those
properties **with the old value as the fallback**:

```css
.pl.pl .pl-section {
  padding-block: var(--sec-pt, clamp(3.5rem, 8vw, 7rem))
                 var(--sec-pb, clamp(3.5rem, 8vw, 7rem));
}
```

That matters because six of these sections are shared with the product page,
the collection pages and eleven `page.*` templates, whose JSON does not carry any
of the new keys. Every new default was chosen to reproduce what that section
already did — the 96px desktop default is what `clamp(3.5rem, 8vw, 7rem)` resolves
to at 1240px, and 56px is exactly what it resolves to on a phone.

Two defaults needed care. `pl-faq` and `pl-finder` hardcoded a centred section
head, so their alignment control defaults to centred rather than to the shared
default of left — otherwise eight other templates would have quietly reflowed.

One deliberate behaviour change everywhere: the marquee now pauses on hover.

### Verified

- `scripts/lint-shopify.py` — 33 sections, 0 errors, 0 warnings.
- `@shopify/theme-check-node` — **0 errors** across the theme.
- Rendered in Chromium at 1440px and 390px against the real stylesheet: zero
  horizontal overflow at both, no console errors, and every new control measured on
  the computed styles — arch radius applied, padding honoured, 4-up grids on desktop
  becoming flex swipe rows on mobile, tiles at 3-up and 2-up, the FAQ resolving to
  two column positions on desktop and one on mobile, the stacked layers sitting
  edge to edge, and the scrim and background image in the right paint order.

### Two things I fixed that were not the homepage

Both were found by the checks above rather than looked for.

1. **`sections/pl-pdp-main.liquid` had a Liquid syntax error** —
   `{% render 'pl-icon', icon: block.settings.icon | default: 'check' %}`. A filter
   cannot be applied to a `render` argument; it fails as a syntax error that takes
   the whole section down, not just that line. The filter now runs in an `assign`
   first. This is the same class of fault that has bitten this project before, and
   theme-check reports it as an error rather than a warning for that reason.
2. **The FAQ accordion was bound by `getElementById('plFaq')`** — so a merchant
   adding the FAQ section twice (one general, one about delivery, which the new
   controls make an obvious thing to do) would have got a second accordion that
   did nothing, with nothing to explain why. It is now bound per list.

### What is not done

**None of this is on the store.** The Shopify connection this session was working
through was lost part-way and re-authorising needs an interactive OAuth flow that a
remote session cannot run, so these files were not uploaded to the preview theme and
nothing was verified against a live render. Everything above was verified against the
files themselves. Reconnect Shopify from claude.ai → Settings → Connectors and the
upload is the last step.

The standalone `index.html` at the repo root was **not** updated. It is the original
prototype and had already diverged from the Shopify build — different palette values,
no `.pl` scoping, half the stylesheet. The `shopify/` directory is the source of
truth; treat the root page as a historical artefact.

---

## 14. Installed on the store, as a draft

> **DRAFT — Homepage redesign + editor controls (Claude)** · theme ID `205853622614`
>
> Online Store → Themes → … → **Preview**. The live theme is untouched.

Duplicated from the **live** theme, so the draft carries the current header,
footer, settings and every other template, and only the seventeen files below
differ from it.

### The store had moved on from this branch

Before writing anything, every file was checksummed against the live theme.
Thirteen were byte-identical to this branch. Four were not:

| File | What had happened |
|---|---|
| `templates/index.json` | **Every string of homepage copy had been rewritten on the store**, and two app sections added (a Modulo featured-products row, an SMI sales-notification popup). |
| `snippets/pl-product-card.liquid` | Gained a Klarna instalment line. |
| `sections/pl-pdp-main.liquid` | Refactored, and 20KB smaller — the PDP was split into `pl-pdp-*` snippets. |
| `snippets/pl-assets.liquid` | Now also loads `pl-pdp-plus.css`. |

Uploading this branch's versions would have reverted all of it. So the two
files that needed my changes were **merged onto the live content** rather than
replacing it, and the two that did not were left alone — the PDP section is
untouched, and the syntax error §13 reports fixing no longer exists there,
because that file has since been rewritten on the store.

**The homepage copy on the draft is the store's, not this branch's.** The
branch's older wording was not restored anywhere.

### Proof that no copy changed

Two independent checks, both on the merge rather than on my own file:

```
live templates/index.json  vs  merged templates/index.json
  757 values carried through byte identical
  100 new keys, all design settings, on the 12 pl_* sections only
  255 copy strings before, 255 after — identical
```

Then, on the actual rendered pages fetched from Shopify:

```
live homepage  vs  draft homepage
  211 visible text fragments on each
  0 present on live and missing from the draft
  0 on the draft that were not on live
  0 Liquid errors
```

Section order is the single intended swap, with both app sections in place:

> hero → marquee → **[app: featured]** → categories → signs → finder →
> products → mechanism → **trial → reviews** → brand → faq → finale →
> cart drawer → **[app: popup]**

### The stylesheet was not touched

`pl-styles.css` on the store is 98KB and is edited there independently, so
folding 13KB of new rules into it would make every future store-side change a
merge conflict on the one file every page loads. Instead the new rules live in
**`assets/pl-layout.css`**, loaded after it by `pl-layout.liquid`:

- **Part 1** re-declares the dozen base rules that had to become
  variable-driven — same selectors, same specificity, later in the cascade, so
  they win on source order. Each keeps the original value as its fallback.
- **Part 2** is the new modifier classes, which the base file has never heard of.

Verified by rendering the harness against **the store's own `pl-styles.css`**
plus this overlay: identical computed styles to the full rewritten stylesheet,
zero horizontal overflow at 1440px and 390px, no console errors.

`pl-app.js` was likewise not uploaded. Its only change was the FAQ
per-list binding, so the FAQ section keeps the `plFaq` id the store's existing
script binds to. The fix stays in this branch for whenever that file next
deploys; both combinations work.

### One deploy failure worth recording

`sections/pl-marquee.liquid` uploaded successfully, reported no error, and did
not change. Sixteen other files in the same call landed fine.

The cause: its `speed` slider ran `min: 15, max: 120, step: 1` — **105 steps,
where Shopify's cap is 101.** A section whose schema breaks that rule is
dropped on upload *silently*: the API returns success, no `userErrors`, and the
previous version of the file simply stays in place.

Fixed to `min: 20, max: 120, step: 2`, and **`scripts/lint-shopify.py` now
checks it** — step count, default within range, and default on a step — so the
next one fails locally instead of in a deploy. Confirmed the check fires on the
old values before the fix went in.

### Two things left for you

1. **Three probe files** are in the draft from verifying the upload path:
   `assets/pl-probe.txt`, `sections/pl-probe2.liquid`, `sections/pl-probe3.liquid`.
   They carry no preset, so they never appear in the Add section picker, and
   nothing references them. `themeFilesDelete` is blocked for this connection,
   so delete them in **Edit code** if you want them gone. Each one says so in
   its own contents.
2. **Category tiles need images.** `pl_categories` is set to the image-tile
   style, but its blocks have no image override, so each tile falls back to its
   collection's image. Any collection without one makes the whole section fall
   back to the compact row — that is deliberate, not a bug. Set collection
   images, or an image per block, to get the tiles.

### This branch is still behind the store

Only the files above were reconciled. The store also carries
`pl-finder-bar.*`, `pl-pdp-plus.*`, `pl-delivery`, `pl-pdp-footnotes`,
`pl-pdp-gallery`, `pl-pdp-jsonld` and `pl-pdp-options`, none of which exist
here. `snippets/pl-bnpl.liquid` was pulled in because the merged product card
renders it. Treat the **store** as the source of truth for the product page and
the Klarna work; treat this branch as the source of truth for the homepage.

---

## 15. The bed finder now holds the whole catalogue

The quiz recommended eleven beds. The homepage's own sales-notification
section lists twenty-two product handles, so **fifteen products were not in the
quiz at all** — including every cooling, waterproof, travel and mattress line.

That was structural, not an oversight. The matrix maps nine answer
combinations to one bed each, so there was nowhere to put a twelfth bed.

### One answer, several beds

The data island was a map of `slot -> bed`, which is what capped it. It is an
array now, and several blocks can share a slot: the first is the
recommendation, the rest become a shortlist beneath it. The script groups
them, and still reads the old shape, so a template that has not been re-saved
keeps working.

That also matters for conversion on its own. A single take-it-or-leave-it
recommendation asks a shopper who does not fancy that particular bed to start
again or leave. Two alternates give them somewhere to go without losing the
answer they just gave.

### Adding a bed needs no copy

The reason line falls back to the product's **own** words — its
`vitals.tagline` metafield, or the opening sentence of its description — so a
bed joins the quiz with nothing but a product picker and a slot. Copy written
in the block still wins where somebody has written it.

This is why thirteen products could be added here without inventing a single
claim about any of them. Checked: 857 values in `index.json` carried through
unchanged, 260 copy strings intact, and every new string is a handle, a slot
name or a block key.

### What went where

Placement is read off each handle's own words — `…-bolster-…`,
`…-high-wall-boucle-…`, `…-elevated-cooling-…`, `…-waterproof-…-mat`. Sleep
style is unambiguous from those; the joints axis is my inference, with the
memory-foam and orthopaedic lines going to the "diagnosed" rows. **Worth a
sanity check in the editor** — it is the one judgement here that the handles
do not fully settle.

| Answer | Recommendation | Shortlist added |
|---|---|---|
| Curls up · no concerns | Buttermere Bouclé | Cotswold high-wall bouclé, Harewood velvet nest |
| Curls up · slowing | Windermere Nest | Balmoral calming donut, herringbone classic |
| Curls up · slowing, large | Rydal High-Sided | Coniston waterproof nest |
| Leans · no concerns | Harrogate Heritage | Marlow tartan bolster |
| Leans · slowing | Grasmere Bolster Sofa | Chatsworth memory foam bolster |
| Sprawls · no concerns | The Sprawler | Coniston reversible, Derwent waterproof mat |
| Sprawls · slowing | Ambleside | Portable elevated, Windermere elevated cooling |
| Sprawls · diagnosed | Kendal Corduroy | PawLunova orthopaedic L/XL, Buttermere mattress |

Two are deliberately still out: the **plastic dog house** is not a bed, and
the **personalised bed** says nothing about how a dog sleeps. Placing either
would have been a guess.

### The thing that would have gone wrong

A shortlist bed whose size did not match shows **no price**. The island falls
back to the first available variant when the size a shopper picked is not on
that bed, and printing that figure under their chosen size reads as the price
for their dog when it is not. Verified in Chromium end to end: Cotswold quotes
£119 because Medium matched; Harewood, which does not come in Medium, quotes
nothing.

The new blocks are added with their size fields blank, so the editor's own
size-check panel now lists exactly which ones need their option values filled
in. Filling them in is what turns the price on.
