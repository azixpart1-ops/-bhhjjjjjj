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
