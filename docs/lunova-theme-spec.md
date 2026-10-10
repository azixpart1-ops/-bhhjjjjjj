# Lunova — the PawLunova Shopify theme · build spec

A standalone Online Store 2.0 theme for the **new** PawLunova store
(`6maurr-uw.myshopify.com`, GBP, UK). It replaces the old approach (pl-* sections
layered on Horizon, in `shopify/`) with a complete theme of its own, in `theme/`.

Brief from the owner: *"Enhanced like PawLunova, but much more psychological and
easier for someone to buy."*

Read this whole file before writing anything. The contracts in §4–§7 are what
let several people build different parts at the same time and have them fit.

---

## 1. Context you need

- The store is brand new: **0 products, 0 collections** except `frontpage`.
  Products will be added later. Every section must render sensibly with **no
  products** (use `placeholder_svg_tag` / hide gracefully) AND with real ones.
- The previous theme work for the old store is in `shopify/` (sections,
  snippets, CSS, JS) and `index.html` + `assets/` (static prototype). Mine it
  for **brand voice and copy** (`shopify/templates/index.json`,
  `shopify/templates/product.json`, `shopify/sections/*`, `assets/app.js` BEDS
  data) and for hard-won lessons (`README.md`). Do not copy its `.pl.pl` scoping
  hack — this is a standalone theme; we own the whole cascade.
- Product line: orthopaedic memory-foam dog beds (50kg/m³ foam), nest/donut
  beds, bolster/sofa beds, flat mattress beds, cooling mats. £59–£219. Product
  names are Lake District places: Borrowdale, Coniston, Grasmere, Windermere,
  Kendal, Ambleside, Rydal, Buttermere, Langdale, Harrogate, Wensleydale…
- UK English throughout: *basket* (not cart) in UI copy, *colour*, *£*,
  *delivery*, *dispatch*.

## 2. Brand system (keep, refine)

| Token | Default | Use |
|---|---|---|
| bone | `#FAF6EF` | page background |
| oat | `#F1E9DB` | raised surfaces, alt sections |
| sand | `#E3D7C3` | hairlines, dividers (decorative only) |
| ink | `#17150F` | text (16.9:1 on bone) |
| ink-muted | `#5E5442` | secondary text (6.9:1 on bone) |
| control-line | `#8C7F66` | borders on **controls** (inputs, size buttons) ≥3:1 on bone |
| moss | `#1A2B24` | dark sections |
| on-dark | `#F1E9DB` / muted `#A9BBB1` | text on moss (12.3 / 7.4) |
| **accent (CTA)** | `#B4532A` terracotta, text `#FFFFFF` (4.99:1) | the ONE colour for "buy" actions |
| highlight | gold, must be ≥3:1 on bone (e.g. `#A87821`) | stars, small badges |
| alert | `#A8340E` (6.2:1) | real low-stock only |
| success | `#2E6B4F` (5.9:1) | in stock, free delivery unlocked |

- **Von Restorff rule:** the terracotta accent is reserved for purchase
  actions (Add to basket, Checkout, Find my bed's final "Add", primary hero CTA).
  Nothing decorative uses it. Secondary actions are ink outline / text links.
- **Type:** display serif (Shopify font `playfair_display_n4`, use
  `font_modify: 'weight', 'bolder'` where needed) + body sans (`dm_sans_n4`).
  Load via `font_face` with `font_display: 'swap'` and preload the body woff2.
- Radius: 14px cards, 22px large panels, pill buttons. Soft shadows.
- Motion: `transform`/`opacity` only; `cubic-bezier(0.23,1,0.32,1)`; respect
  `prefers-reduced-motion`. Hover effects only under
  `@media (hover:hover) and (pointer:fine)`.
- Accessibility: WCAG 2.2 AA. Visible focus ring (`:focus-visible`, 2px ink +
  2px bone offset). Tap targets ≥44px. Every interactive custom element works
  with keyboard. Contrast checked against the ground it actually sits on.

## 3. The conversion-psychology playbook (the point of this theme)

Every section exists to move one of these levers. Use real levers only — see
the guardrails at the end of this section, which are non-negotiable (UK law).

1. **Choice architecture / Hick's law.** 27 similar beds paralyse. The theme
   leads with a **Bed Finder** (4 taps → one recommended bed in the right size,
   addable to basket from the result). It's reachable from: header button,
   hero, homepage inline teaser, collection grid tile, PDP "Not sure which
   size?", 404, empty cart, search no-results.
2. **Foot-in-the-door / commitment.** The homepage teaser asks question 1
   inline ("How does your dog sleep?" with picture cards). Tapping an answer
   opens the finder already on question 2. Progress bar (Zeigarnik / goal
   gradient: "2 of 4").
3. **Personalisation / endowment.** Finder asks the dog's name (optional).
   From then on: result headline "Bella's bed", PDP shows "Recommended for
   Bella: Medium", product cards show a "Bella's match" chip, cart says "Bella's
   new bed". Stored in `localStorage` (`lunova:finder`).
4. **Default effect.** Size pre-selected from the finder; otherwise the
   merchant-marked most-chosen size (variant metafield or section setting),
   otherwise first available. Never pre-tick paid add-ons.
5. **Anchoring & price framing.** Compare-at shown struck through with
   "Save £X"; size ladder shows all prices; "**From £69**"; **per-night
   reframe** ("about 9p a night over the 5-year guarantee", computed:
   price ÷ (guarantee_years × 365), rounded honestly, basis stated in a
   tooltip/footnote); price inside the Add button ("Add to basket · £99").
6. **Risk reversal / loss aversion.** The 100-night trial and 5-year
   guarantee sit **directly under the Add button**, not in the footer:
   "Sleep on it for 100 nights. If it isn't right, we collect it free and
   refund every penny." Repeated in cart drawer under Checkout.
7. **Goal gradient.** Free-delivery progress bar in cart drawer + cart page
   ("You're £11 away from free delivery" → "Free UK delivery unlocked").
8. **Honest urgency.** Delivery countdown computed from merchant's real
   dispatch cut-off + dispatch days + holidays: "Order within **2h 14m** for
   dispatch today — arrives **Thu 8 Oct**–**Sat 10 Oct**". Never resets on
   reload, never invented.
9. **Honest scarcity.** "Only 3 left in Medium" only when the variant tracks
   inventory, policy is `deny`, and quantity ≤ threshold. Uses
   `variant.inventory_quantity`. Nothing else.
10. **Social proof.** Product ratings from Shopify's standard
    `product.metafields.reviews.rating` / `reviews.rating_count` (written by
    any reviews app). Store-level rating line only renders if the merchant
    fills `store_rating` + `store_review_count`. Testimonials are merchant
    entered, with name + dog + optional photo. `@app` blocks in PDP + a
    reviews section so a reviews app drops straight in.
11. **Specificity & mechanism.** "50kg/m³" explained visually (layer
    cross-section) — concrete numbers beat adjectives.
12. **Uncertainty reduction.** PDP "What happens after you order" 4-step
    timeline; size guide built from the variants with breed examples;
    delivery & returns accordion; FAQ handling the top objections in buying
    order; secure-checkout + payment icons near the CTA.
13. **Friction removal.** Sticky add-to-basket bar; quick-add from cards
    (size picker in a drawer, no page load); cart drawer opens on add;
    dynamic checkout buttons (Shop Pay / Apple Pay / Google Pay) on PDP and
    `content_for_additional_checkout_buttons` in cart; big tap targets; no
    account required.
14. **Peak-end.** Drawer "added" moment is warm ("Bella's bed is in your
    basket"), with the trial reminder.
15. **Mere exposure / recency.** Recently viewed row (localStorage, fetched
    via `/products/<handle>.js`) on PDP and cart page.
16. **Reciprocity.** Free size guide / buying guide content; optional email
    capture with a value offer (OFF by default; exit-intent desktop / 25s on
    mobile; shown once per 14 days; plain "No thanks" dismiss).

### Guardrails — never ship these (DMCC Act 2024 / CMA online choice architecture)
- No fake or invented reviews, ratings, review counts, "X people viewing",
  "Y bought in the last hour", fake purchase pop-ups.
- No countdown that isn't the real dispatch cut-off; no "sale ends" timer.
- No scarcity not bound to live inventory.
- No pre-ticked add-ons, no drip pricing, no hidden costs.
- No confirm-shaming ("No thanks, I don't love my dog").
- No medical claims ("relieves all pain", "cures arthritis"). Say what the
  product physically does ("pressure-relieving support for ageing joints").
- Store-wide claims (trial length, guarantee, free-delivery threshold,
  "made in Yorkshire") come from **settings**, never hardcoded, so the owner can
  make them match reality. Default copy must not assert manufacturing origin
  ("Designed in Yorkshire"/"Made in Yorkshire" is a setting-driven line, default
  blank-safe wording: "Designed in Britain for British homes" is also a claim —
  prefer neutral: "Named for the Lakes, built for real sleep").

---

## 4. File layout & ownership

All theme files live under `theme/`. Each builder owns exactly the files listed
for them and must not edit anyone else's. If you need something from another
area, code to the contract below; if the contract is missing something, note it
in your final report — do not edit the other file.

```
theme/
  layout/theme.liquid, layout/password.liquid
  config/settings_schema.json, config/settings_data.json
  locales/en.default.json            (assembled at the end from locales/_parts/*.json)
  locales/_parts/<area>.json         (each builder writes its own part)
  sections/*.liquid, sections/header-group.json, sections/footer-group.json
  snippets/*.liquid
  assets/*.css, *.js, (svgs)
  templates/*.json, templates/gift_card.liquid, templates/customers/*.json
```

| Area | Owner | Files |
|---|---|---|
| A. Core | core | `layout/*`, `config/*`, `assets/base.css`, `assets/global.js`, snippets: `meta-tags`, `structured-data-org`, `icon`, `image`, `price`, `rating`, `product-card`, `badge`, `social-icons`, `payment-icons`, `per-night`, `delivery-promise` (Liquid part), `free-shipping-bar`, `trust-list`, `section-styles`, `size-hints`; `locales/_parts/core.json` |
| B. Chrome | chrome | sections: `announcement-bar`, `header`, `footer`, `cart-drawer`, `quick-add` (drawer shell, static), `predictive-search` (section used by Section Rendering), `email-popup`; `sections/header-group.json`, `sections/footer-group.json`; `assets/chrome.css`, `assets/cart.js`, `assets/search.js`; snippets `cart-line`, `menu-drawer`; `locales/_parts/chrome.json` |
| C. Product | product | sections: `main-product`, `product-recommendations`, `product-timeline`, `product-compare`, `recently-viewed`, `sticky-atc` (if a section; else snippet); snippets: `variant-picker`, `buy-box`, `size-guide`, `product-jsonld`, `product-gallery`; `assets/product.css`, `assets/product.js`; `templates/product.json`; `locales/_parts/product.json` |
| D. Collection/Search/Cart page | collection | sections: `main-collection`, `main-list-collections`, `main-search`, `main-cart`, `collection-hero`, `need-chips`; snippets `facets`, `pagination`, `finder-tile`; `assets/collection.css`, `assets/collection.js`; templates `collection.json`, `list-collections.json`, `search.json`, `cart.json`; `locales/_parts/collection.json` |
| E. Bed Finder | finder | sections: `bed-finder` (static, global, modal + config), `finder-teaser` (homepage inline Q1), `main-finder-page`; `assets/finder.css`, `assets/finder.js`; `templates/page.bed-finder.json`; `locales/_parts/finder.json` |
| F. Homepage & marketing sections | home | sections: `hero`, `trust-bar`, `marquee`, `problem-signs`, `shop-by-need`, `featured-products`, `mechanism`, `cost-reframe`, `risk-reversal`, `testimonials`, `comparison-table`, `image-with-text`, `brand-story`, `faq`, `final-cta`, `newsletter`, `rich-text`, `multicolumn`, `video`, `reviews-app` (wrapper with `@app` blocks); `assets/sections.css`, `assets/sections.js` (if needed); `templates/index.json`; `locales/_parts/home.json` |
| G. Content & system pages | pages | sections: `main-page`, `main-contact`, `main-blog`, `main-article`, `main-404`, `main-password`, `main-login`, `main-register`, `main-account`, `main-order`, `main-addresses`, `main-activate-account`, `main-reset-password`; templates: `page.json`, `page.contact.json`, `page.faq.json`, `page.about.json`, `blog.json`, `article.json`, `404.json`, `password.json`, `gift_card.liquid`, `customers/*.json`; `assets/pages.css`; `locales/_parts/pages.json` |
| H. Dev harness | harness | `scripts/theme-dev/**` (Node; local renderer + mock storefront server + tests). Never edits `theme/`. |

`page.faq.json` uses the `faq` section from area F (contract §6).

---

## 5. Global contracts

### 5.1 `layout/theme.liquid` (core) provides

- `<html lang="{{ request.locale.iso_code }}">`, `content_for_header`,
  `meta-tags` snippet, fonts, CSS variables from settings in an inline
  `<style>`, `base.css` (render-blocking), `global.js` (`defer`).
- `{% sections 'header-group' %}`, `<main id="MainContent" tabindex="-1">`
  `{{ content_for_layout }}`, `{% sections 'footer-group' %}`.
- Static sections rendered once on every page: `{% section 'cart-drawer' %}`,
  `{% section 'quick-add' %}`, `{% section 'bed-finder' %}`.
  (On the cart template the drawer still renders but `cart.js` routes
  "open drawer" to a no-op.)
- Skip link to `#MainContent`.
- `<script>window.Lunova = window.Lunova || {}; Lunova.routes = {...}; Lunova.moneyFormat = {{ shop.money_format | json }}; Lunova.settings = {...}; Lunova.strings = {...};</script>`
  where `routes` = `{root, cart, cartAdd, cartChange, cartUpdate, cartUrl:
  routes.cart_url, search: routes.search_url, predictiveSearch:
  routes.predictive_search_url, productRecommendations:
  routes.product_recommendations_url}` and `settings` = `{ freeShippingThreshold
  (in minor units, number or null), trialNights, trialFreeCollection,
  trialTerms, trialTermsShort (plain text from snippets/trial-terms),
  guaranteeYears, cutoffHour,
  dispatchDays: [1,2,3,4,5], deliveryMin, deliveryMax, holidays: ["YYYY-MM-DD"],
  lowStockThreshold, cartType: "drawer"|"page", perNight: bool, installments:
  {enabled, count, provider}, finderEnabled: bool }`.
- `body` classes: `template-{{ template.name }}` and `template-suffix-...`.

### 5.2 CSS (core: `assets/base.css`)

Variables (set on `:root` in theme.liquid from settings):
```
--c-bg --c-surface --c-sand --c-ink --c-muted --c-control-line
--c-dark --c-on-dark --c-on-dark-muted
--c-accent --c-accent-text --c-accent-hover --c-highlight --c-alert --c-success
--font-heading --font-heading-weight --font-body --font-body-weight
--fs-body (px) --heading-scale (unitless)
--page-width --radius --radius-lg --radius-btn
--ease-out: cubic-bezier(0.23,1,0.32,1); --dur-fast:150ms; --dur:240ms; --dur-slow:600ms
--header-h (set by header JS)  --shadow-sm --shadow-md --shadow-lg
```
Colour schemes — every section has a `color_scheme` select setting with values
`bone | oat | moss | white`, rendered as class `scheme-<value>` on the section
wrapper. `base.css` maps each scheme to local tokens:
`--bg --fg --fg-muted --line --card-bg --link --btn-secondary-fg --btn-secondary-line --focus`.
The accent CTA stays terracotta on all four schemes.

Shared component classes (defined in base.css; others use, never redefine):
- Layout: `.page-width` (max-width var, side padding 16px mobile / 32px desktop),
  `.section` (vertical padding from `--section-pt/--section-pb`), `.stack`,
  `.grid`, `.grid--2/3/4` responsive, `.visually-hidden`, `.skip-link`.
- Type: `.h0 .h1 .h2 .h3 .h4` (fluid clamp × `--heading-scale`), `.eyebrow`,
  `.lede`, `.small`, `.muted`, `.rte` (rich text: lists, tables, links).
- Buttons: `.btn` + `.btn--primary` (accent), `.btn--secondary` (ink outline),
  `.btn--ghost` (text), `.btn--lg`, `.btn--block`, `[aria-busy=true]` spinner
  state, `:disabled`.
- `.chip`, `.chip[aria-pressed=true]`, `.badge`, `.badge--sale`, `.badge--accent`,
  `.badge--muted`, `.badge--match` (finder match), `.stars` (from `rating`
  snippet), `.trust-list`, `.price`, `.price__compare`, `.price__save`,
  `.card`, `.product-card` (whole card styles live in base.css since the card
  appears everywhere), `.field`, `.input`, `.select`, `.checkbox`,
  `.accordion` (styled `<details>`), `.drawer` (+ `.drawer__panel`,
  `.drawer__header`, `.drawer__body`, `.drawer__footer`, open state
  `[open]`/`.is-open`), `.overlay`, `.modal` (native `<dialog>` styling),
  `.slider-row` (horizontal scroll-snap row with edge peek on mobile),
  `.progress` (bar), `.icon` (1em, currentColor), `[data-reveal]` (fade-up
  when `.is-revealed`), `.placeholder-svg`.

Each area's own CSS file is loaded **by its sections** with
`{{ 'x.css' | asset_url | stylesheet_tag }}` — except `chrome.css` which
`theme.liquid` loads since chrome is on every page. `stylesheet_tag` does
**not** de-dupe: each repeated link is downloaded once but parsed and applied
again, which slows style recalculation. So on the home page (`template.name ==
'index'`) `theme.liquid` links `sections.css` once in `<head>`, and the
home-area sections wrap their own link in `{%- unless template.name == 'index'
-%}`. Other templates keep the per-section links (two or three at most).
No `!important` except `[hidden]{display:none!important}`.
No selectors on bare elements outside base.css.

### 5.3 JavaScript (core: `assets/global.js`)

Vanilla JS, no frameworks, no build step. ES2019+, no modules needed.
`global.js` defines on `window.Lunova`:

```js
Lunova.money(cents)                      // Lunova.moneyFormat, whole pounds: 14900 → "£149", 499 → "£4.99", 104900 → "£1,049" (= Liquid money_without_trailing_zeros)
Lunova.moneyFull(cents)                  // pence always ("£149.00"), only where a sum shows its working
Lunova.fetchJSON(url, opts)               // fetch w/ JSON headers, throws on !ok with {status, description}
Lunova.cart = {
  get(): Promise<cart>,
  add(items /* [{id, quantity, properties?}] */, {sections} = {}): Promise<{cart, sections}>,
  change(lineKeyOrIndex, quantity, {sections}): Promise<{cart, sections}>,
  // after any mutation: dispatches 'lunova:cart:updated' {detail:{cart, source}}
}
Lunova.on(evt, fn) / Lunova.emit(evt, detail)   // thin wrappers on document CustomEvent
Lunova.store = { get(key), set(key, value), remove(key) }  // try/catch localStorage, JSON
Lunova.finder = { get(): {dogName, style, stage, size, handle, variantId, ts}|null, set(obj), clear() }
Lunova.trapFocus(container) -> release()
Lunova.lockScroll() / Lunova.unlockScroll()
Lunova.debounce(fn, ms)
Lunova.delivery = {
  estimate(now) -> {cutoffMs, dispatchDate, arriveFrom, arriveTo}   // dispatch countdown only (off by default)
  window({dispatchMin, dispatchMax, transitMin, transitMax, from?, sameDay?, cutoffHour?, rangeTemplate?})
    -> {earliest, latest, dispatchEarliest, dispatchLatest, earliestText, latestText, text} | null   // §9.3
  updateEstimates(root, variant?)          // fills every [data-delivery-estimate] in root (§9.3)
  isWorkingDay(date), format(date)          // Mon to Fri, not a bank holiday · "Thu 15 Oct"
}
Lunova.offer.update(root, priceCents, {available}?) -> 'line'|'none'   // the buy box's "£15 off this size" line (§9.2)
Lunova.perNight(cents) -> string|null      // "8p" / "£1.12", whole pence over years × 365¼ nights (1,826 for 5), null if disabled
Lunova.perNightExact(cents)                // "8.16p" for the basis line; Lunova.guaranteeNights() → 1826
Lunova.foamBed(product) -> bool            // snippets/foam-bed's rule (§9.4); the finder JSON carries the Liquid verdict
Lunova.sectionsUrl(sectionIds[]) -> url for ?sections=
```

Events (all on `document`, names fixed):
| Event | detail | Fired by → used by |
|---|---|---|
| `lunova:cart:updated` | `{cart, source}` | cart API → header count, drawer, cart page, sticky bar |
| `lunova:cart:open` | `{added?: lineItem, reason?}` | product form, quick-add, finder → drawer |
| `lunova:quickadd:open` | `{handle, url}` | product-card button → quick-add drawer |
| `lunova:finder:open` | `{step?, answers?}` | any `[data-open-finder]` / `a[href="#bed-finder"]` → finder modal |
| `lunova:finder:complete` | `{result}` | finder → PDP/cards personalisation |
| `lunova:variant:change` | `{sectionId, variant}` | variant picker → buy box, sticky bar, gallery, delivery |

`global.js` also: binds `[data-open-finder]` and `a[href$="#bed-finder"]` clicks
→ emit `lunova:finder:open` (preventDefault) if the finder modal exists; runs
`[data-reveal]` IntersectionObserver; sets `--header-h`; `<details>` accordion
animation (optional); `[data-countdown]` delivery countdown elements
(text filled from `Lunova.delivery.estimate()`, updates every 30s, hidden if
settings disable it); `[data-finder-name]` elements get the dog's name, and
`[data-finder-match-handle]` cards get `.is-finder-match` + reveal their
`.badge--match` when handle matches the stored finder result; re-inits on
`shopify:section:load`.

Custom elements: each defined once with
`if (!customElements.get('x-y')) customElements.define(...)`. Names:
`cart-drawer` (chrome), `cart-count` (chrome), `predictive-search` (chrome),
`quick-add-drawer` (chrome), `product-form` (product; also used inside
quick-add), `variant-picker` (product), `sticky-atc` (product),
`media-gallery` (product), `recently-viewed` (product), `bed-finder`
(finder), `finder-teaser` (finder), `facet-filters` (collection),
`cart-items` (collection, cart page), `slider-row` (core), `email-popup`
(chrome).

Script loading: each area's JS is included by its section with
`<script src="{{ 'x.js' | asset_url }}" defer></script>`. `product.js` is also
needed by the quick-add drawer — chrome's `quick-add` section includes it.
`cart.js` is loaded from theme.liquid (needed everywhere).

### 5.4 Cart & Section Rendering

- Add: `POST /cart/add.js` with `{items, sections: "cart-drawer", sections_url: location.pathname}`.
  The drawer re-renders from the returned `sections['cart-drawer']` HTML
  (replace the inner `[data-drawer-content]`).
- Change: `POST /cart/change.js` `{id: line.key, quantity, sections}`.
- Static sections in layout have section id equal to their file name
  (`cart-drawer`, `quick-add`, `bed-finder`).
- The cart page (`main-cart`) re-renders itself via `sections: <its section.id>`.
- Header cart count: element `<cart-count data-cart-count>` updated from
  `cart.item_count` on `lunova:cart:updated`.
- Quick add: `quick-add-drawer` fetches `/products/<handle>?section_id=quick-add-product`
  — **chrome owns a section `quick-add-product.liquid`** that renders
  the compact buy box for `product` (it must `{% render 'buy-box', product: product, section: section, compact: true %}`
  which product area owns). So `buy-box` must work with `compact: true`.

### 5.5 Snippet signatures (core unless noted)

```
{% render 'icon', name: 'truck', size: 20, class: '' %}
  names: truck, shield, medal, moon, heart, check, check-circle, star, star-half,
  chevron-down/right/left, arrow-right, close, menu, search, user, basket, plus,
  minus, info, clock, gift, leaf, paw, bed, ruler, lock, return, chat, play,
  instagram, facebook, tiktok, pinterest, youtube, sparkle, snowflake, bone, home
{% render 'image', image: img, widths: '360,540,720,960,1200', sizes: '(min-width: 990px) 50vw, 100vw', class: '', loading: 'lazy'|'eager', fetchpriority: 'high'|'auto', alt: '', aspect: 1|null, crop: 'center'|nil %}
  → <img> with srcset via image_url; if image blank renders placeholder_svg_tag('product-1'…)
{% render 'price', product: p, variant: v (optional), show_from: true, show_save: true, size: 'sm'|'md'|'lg' %}
  → .price markup; "From £X" when price_varies & no variant; compare/save per settings; whole pounds (money_without_trailing_zeros)
{% render 'rating', product: p, size: 'sm'|'md', show_count: true %}
  → nothing if no reviews.rating metafield
{% render 'product-card', product: p, image_ratio: settings.card_image_ratio, show_quick_add: true, lazy: true, heading_level: 'h3', role_label: '' %}
  → card with data-finder-match-handle, role label (custom.best_for metafield
    or tag prefix 'best-for:'), badges (tag prefix 'badge:', sale, sold out,
    low-stock), rating, price, size range text (e.g. "S–XL"), quick-add button
    (emits lunova:quickadd:open; single-variant products add directly).
{% render 'badge', text: '', style: 'accent'|'sale'|'muted'|'match' %}
{% render 'per-night', price: cents, product: p %}   → ONE line "About 8p a night over the 5-year foam guarantee" + (i) basis; nothing unless the foam guarantee covers p (§9.4)
{% render 'delivery-estimate', product: p, variant: v %}   → dated delivery line, partner wording (§9.3)
{% render 'delivery-options', product: p %} → the same as delivery-estimate; {% render 'delivery-options', basket: cart %} → the basket's one-line delivery choices
{% render 'delivery-promise', variant: v, compact: false %}
  → dispatch countdown, OFF by default; even when on, only for a product with custom.ships_same_day = true (basket: every line)
{% render 'free-shipping-bar', cart: cart %}   → bar + message (server-side computed, JS-free)
{% render 'trust-list', items: 'trial,guarantee,delivery,secure', layout: 'row'|'stack', size: 'sm'|'md' %}
  → reads settings for numbers; hides items whose setting is disabled
{% render 'size-hints' %}  → parses settings.size_hints into a JSON <script type="application/json" id="size-hints">; also callable as
{% render 'size-hints', value: 'M', mode: 'inline' %} → "Cocker, Springer · 10–25kg" text for that option value
{% render 'section-styles', section: section %} → <style> block setting --section-pt/pb for #shopify-section-{{section.id}}
{% render 'social-icons' %}  {% render 'payment-icons' %}  {% render 'meta-tags' %}
```
Product area owns `buy-box`, `variant-picker`, `size-guide`, `product-gallery`,
`product-jsonld`. Collection area owns `facets`, `pagination`, `finder-tile`.
Chrome owns `cart-line`, `menu-drawer`.

### 5.6 Global theme settings (core defines these exact ids in `settings_schema.json`)

```
theme_info: theme_name "Lunova", theme_version "1.0.0", theme_author "PawLunova",
            theme_documentation_url "https://pawlunova.co.uk", theme_support_url "https://pawlunova.co.uk/pages/contact"
Logo:        logo (image_picker), logo_width (range 60–260, 140), favicon (image_picker)
Colours:     color_bg, color_surface, color_sand, color_ink, color_muted, color_control_line,
             color_dark, color_on_dark, color_on_dark_muted, color_accent, color_accent_text,
             color_highlight, color_alert, color_success
Typography:  type_heading_font (font_picker, playfair_display_n4), type_body_font (font_picker, dm_sans_n4),
             heading_scale (range 80–130 step 5, 100), body_size (range 14–18, 16)
Layout:      page_width (select 1200|1320|1440, 1320), radius (range 0–24 step 2, 14),
             button_shape (select pill|soft|square, pill), animations (checkbox, true)
Promises:    trial_enable (true), trial_nights (number 100), guarantee_enable (true), guarantee_years (number 5),
             free_shipping_enable (true), free_shipping_threshold (number 40, major units),
             delivery_promise_enable (false: the same-day countdown, and only for custom.ships_same_day beds), dispatch_cutoff_hour (range 0–23, 15),
             dispatch_days (text "1,2,3,4,5"; 0 = Sunday), holiday_dates (textarea, one YYYY-MM-DD per line),
             Delivery dates (§9.3): delivery_dispatch_min (number 1), delivery_dispatch_max (number 2),
             delivery_min_days (number 4), delivery_max_days (number 6)  ← Standard, working days after dispatch,
             delivery_standard_price (text "4.99"), delivery_express_enable (true), delivery_express_price (text "6.99"),
             delivery_express_min (number 2), delivery_express_max (number 3),
             delivery_standard_text / delivery_express_text / delivery_times_note (the basket's delivery line),
             origin_line (text, "", e.g. "Made in Yorkshire"; hidden if blank)
Pricing:     show_compare_savings (true), savings_format (select amount|percent, amount),
             show_per_night (true), show_installments (false), installments_count (range 2–4, 3),
             installments_provider (text "Klarna")
Proof:       store_rating (text "", stays blank), store_review_count (text "", stays blank), show_product_ratings (true;
             snippets/rating renders nothing under 5 reviews: reviews.rating_count >= 5)
Scarcity:    low_stock_enable (FALSE, opt-in), low_stock_threshold (range 0–20, 0 = never). The copy never states a
             count: "Low stock" / "Low stock in Medium" (audit P0-2: no "Only N left" anywhere)
Offer:       offer_enable, offer_label, offer_amount, offer_min_subtotal, offer_ends ("YYYY-MM-DD HH:MM" UK), offer_note,
             offer_countdown (false). Mirrors the real automatic discount (£15 off £129+, ends 2026-10-31 23:59).
Sizing:      size_hints (textarea; lines "VALUE|Label|Weight|Breeds", default:
             "XS|Extra small|Up to 5kg|Chihuahua, Yorkie, Pomeranian
              S|Small|5–10kg|Jack Russell, Dachshund, Pug, Shih Tzu
              M|Medium|10–25kg|Cocker, Springer, Border Collie, Staffie
              L|Large|25–40kg|Labrador, Retriever, Boxer, Pointer
              XL|Extra large|40kg+|German Shepherd, Bernese, Great Dane")
             Matching of a variant option value to a line is case-insensitive and also accepts the
             Label (e.g. "Medium" ≡ "M"), and "2XL"/"XXL" fall into XL.
Cart:        cart_type (select drawer|page, drawer), cart_upsell_product (product), cart_upsell_heading (text "Complete the set"),
             cart_show_note (false)
Cards:       card_image_ratio (select square|portrait|landscape, square), card_show_rating (true),
             card_show_role (true), card_quick_add (true), card_secondary_image (true)
Finder:      finder_enable (true), finder_cta_label (text "Find my dog's bed")
Social:      social_instagram, social_facebook, social_tiktok, social_pinterest, social_youtube (text)
Search:      predictive_search_enable (true)
```
`settings_data.json` "current" = these defaults (+ a "Lunova" preset).

Metafields the theme reads (all optional, always with a fallback):
`product.metafields.reviews.rating` (rating type) · `reviews.rating_count` ·
`product.metafields.custom.best_for` (single line, e.g. "Stiff mornings") ·
`custom.tagline` (single line hook) · `custom.benefits` (list of single line
or multi-line text, one per line) · `custom.specs` (multi-line "Label: value") ·
`custom.care` (rich text / multi-line) · `variant.metafields.custom.most_chosen`
(boolean). Tags: `badge:<text>`, `best-for:<text>`,
`finder:curl|lean|sprawl`, `finder:fine|slowing|diagnosed`.
Plus the October 2026 `custom.*` metafields (product and variant), listed with
the rules that read them in §9.1.

---

## 6. Section conventions (everyone)

- Every section: wrapper `<section class="section scheme-{{ section.settings.color_scheme }} <name>" id="{{ section.id }}-wrap" aria-labelledby=…>` (or `div` for non-landmarks); `{% render 'section-styles', section: section %}` for padding; schema includes
  `color_scheme` (select bone/oat/moss/white), `padding_top`, `padding_bottom`
  (range 0–120 step 4) — plus a `presets` entry (so it's addable in the editor)
  for every non-`main-*`, non-static section; `"enabled_on"`/`"disabled_on"` where sensible.
- Schema validity is critical: Shopify silently drops a section with an invalid
  schema. Rules: setting ids are `[a-z_][a-z0-9_]*`; `range` needs min/max/step
  and default within range and (max-min)/step ≤ 101; `select`/`radio` defaults
  must be one of the option values; `number` default must be a number; `url`
  defaults only `/collections` or `/collections/all`; `richtext` default must
  be wrapped in `<p>`/`<ul>`/`<ol>`/`<h1-6>`; `inline_richtext` no block tags;
  `image_picker`, `product`, `collection`, `page`, `blog`, `link_list`,
  `video_url`(needs accept), `font_picker`(needs default) — no defaults except
  link_list (`"main-menu"`, `"footer"`) and font_picker; block `type` ids
  `[a-z0-9_-]+`; `max_blocks` ≤ 50; preset names unique; `"tag"` (if used) one
  of `section|div|aside|header|footer|article`; schema `name` ≤ 25 chars;
  `label`/`info` plain text (no HTML except links in `info` via markdown).
  `header`/`paragraph` settings use `content`, not `label`.
- `{{ block.shopify_attributes }}` on every block's root element.
- No inline `<script>` except JSON islands (`type="application/json"`) and the
  layout config. No `document.write`. No external CDNs (fonts via Shopify).
- Images: always via `image` snippet (srcset + width/height to stop CLS).
  Above the fold: `loading: 'eager', fetchpriority: 'high'`.
- Copy defaults: write real, warm, specific PawLunova copy (see §1 sources) —
  never lorem ipsum, never "Image with text". UK English.
- Empty states: product/collection pickers unset → show
  `placeholder_svg_tag` cards (in the editor) or hide the section on the live
  store if it would be meaningless (`request.design_mode`).
- Liquid: prefer `{%- liquid -%}` for logic blocks; whitespace-trim tags; no
  deprecated filters (`img_url` → `image_url`); `| escape` user text in
  attributes; JSON via `| json`.
- Translations: UI strings (not merchant copy) go through `{{ 'area.key' | t }}`
  with keys in your `locales/_parts/<area>.json`
  (nested JSON, top-level key = your area name, e.g. `{"product": {"add_to_basket": "Add to basket"}}`).
  Core's part also defines `general.*` and `accessibility.*` shared keys:
  `general.close, general.open_menu, general.search, general.cart, general.account,
  general.skip_to_content, general.loading, general.view_all, general.continue_shopping,
  general.sold_out, general.unavailable, general.from, general.save, general.each,
  accessibility.rating ("{{ rating }} out of {{ max }} stars"), accessibility.new_window,
  accessibility.previous, accessibility.next, accessibility.close_dialog`.

## 7. Templates map

| Template | Sections (in order) | Owner |
|---|---|---|
| `index.json` | hero → trust-bar → marquee → problem-signs → finder-teaser → featured-products ("The four most chosen") → mechanism → cost-reframe → risk-reversal → testimonials → comparison-table → shop-by-need → brand-story → faq → final-cta | home (finder-teaser from finder area) |
| `product.json` | main-product → product-timeline → mechanism → product-compare → risk-reversal → reviews-app → faq → product-recommendations → recently-viewed | product (+ home sections) |
| `collection.json` | collection-hero → need-chips → main-collection → risk-reversal → faq | collection (+home) |
| `list-collections.json` | main-list-collections | collection |
| `search.json` | main-search | collection |
| `cart.json` | main-cart → recently-viewed? (product owns it) → featured-products | collection |
| `page.bed-finder.json` | main-finder-page | finder |
| `page.json`, `page.contact.json`, `page.faq.json`, `page.about.json`, `blog.json`, `article.json`, `404.json`, `password.json`, `customers/*.json`, `gift_card.liquid` | main-* | pages |

## 8. Definition of done (every builder)

1. Every file you own exists, parses (JSON valid; Liquid tags balanced), and
   every schema follows §6 rules.
2. Renders with **zero products** and with products, with no Liquid errors.
3. Mobile-first: works at 360px wide with no horizontal overflow; 44px targets.
4. Keyboard + screen reader basics; contrast ≥ AA on its actual ground.
5. Every psychology lever you were assigned is present, honest, and switchable.
6. Final report: files written, contract assumptions you relied on, anything
   you needed from another area that the contract didn't cover, known gaps.

---

## 9. October 2026 audit: shared contracts (core)

The mobile conversion audit (docs/PawLunova_Mobile_Conversion_Audit_Oct2026.pdf,
contract in docs/audit-oct-contract.md) changes what the theme may claim. These
are the pieces every builder codes against. Rule zero: every factual claim about
a product comes from that product's own data (description, metafields, options,
tags) or the published policies; when the data is blank, the element hides.
House style: British spelling, no em dashes, whole-pound prices.

### 9.1 Metafields (namespace `custom`) and what each one allows

Product: `subtitle` (supersedes `tagline`) · `best_for` · `core_type` (Memory foam |
Egg-crate foam | Crumb memory foam | Fibre | Mesh) · `foam_guarantee` (boolean) ·
`density_kg_m3` (integer) · `foam_depth` · `feel` (1 to 5) · `has_liner` (boolean) ·
`cover_type` · `wash_temp` (integer) · `non_slip` (boolean) · `low_entry` (boolean) ·
`entry_height_cm` (integer) · `sleep_style` (list) · `shape` · `ships_from` (Own stock |
Partner warehouse) · `dispatch_days_min` / `dispatch_days_max` (integer) ·
`ships_same_day` (boolean) · `worth_it` (multi-line) · `qa` (json `[{"q","a"}]`).
Variant: `sleep_area` · `suits_breeds` · `suits_weight`. Older keys stay valid:
`tagline`, `benefits`, `specs`, `care`, `most_chosen`.

In Liquid always read `.value` and compare booleans with `== true` / `== false`
(never `!= blank` on a boolean: Shopify treats `false` as blank). Integers and
text: `| append: ''` then test `!= ''`.

| Element | Shows only when |
|---|---|
| Foam guarantee line, "year five", per-night, guarantee in the trust row | `snippets/foam-bed` says true (§9.4) |
| Density figure / "Density isn't firmness" | `density_kg_m3` has a value |
| Waterproof liner bullet / spec row | `has_liner` is true |
| 30°C (any wash temperature) | `wash_temp` has a value |
| Low-entry bullet, chip, filter | `low_entry` is true (step-in height only with `entry_height_cm`) |
| Non-slip base | `non_slip` is true |
| Delivery dates | §9.3 (`ships_from`, `dispatch_days_*`) |
| Same-day dispatch, cut-off countdown | `ships_same_day` is true AND Theme settings → `delivery_promise_enable` |
| Stars and review count | `reviews.rating_count` >= 5 from a reviews app (`snippets/rating`) |

`snippets/product-fact` answers these for you:
`{%- capture d -%}{%- render 'product-fact', product: product, key: 'density' -%}{%- endcapture -%}`
gives "50" or nothing. Keys: `guarantee`, `per_night`, `liner`, `low_entry`,
`non_slip`, `same_day`, `partner` ("true" or nothing); `density`, `wash_temp`,
`entry_height`, `feel` (whole numbers or nothing); `subtitle` (falls back to
`tagline`), `best_for` (falls back to the `best-for:` tag), `core_type`,
`foam_depth`, `cover_type`, `shape`, `ships_from`, `sleep_style` (joined ", "),
`worth_it` (escaped, `<br>` line breaks), `qa_count`. For the Q&A pairs read
`product.metafields.custom.qa.value` (an array of `{q, a}`).

### 9.2 Prices and the offer

- Every storefront price prints with `money_without_trailing_zeros` (£149, £4.99,
  £1,049) and in JS with `Lunova.money` (same output). `money_with_currency` stays
  only in structured data; JSON-LD keeps numeric prices.
- Offer (Theme settings → Offer, mirroring the automatic discount): the buy box
  calls `{% render 'offer', mode: 'pdp', product: product, variant: current, cart: cart %}`.
  It prints ONE line, "£15 off this size at checkout, until Sat 31 Oct", only when
  that variant's own price reaches the minimum, it is available, the offer is
  running and the basket can still get it (not already applied: one per order;
  no other discount in play). Any other size: nothing visible. Contract:
  `[data-offer-size]` (root, `hidden` unless it qualifies; `data-min`,
  `data-amount`, `data-offer-price` in pence, `data-product-id`, `data-state`
  'line' | 'none') and `[data-offer-size-text]`. On a size change call
  `Lunova.offer.update(scope, variant.price, {available: variant.available})`;
  global.js also does it on `lunova:variant:change` (from the section with id
  `shopify-section-<sectionId>`, or the element with `data-section-id`) and on
  `lunova:offer:change`. No nudge, no net price, no offer in the announcement bar.
- The old `[data-offer-pdp]` / `data-tpl-*` markup is gone; product.js's
  `updateOffer()` now finds nothing and can be deleted.
- Basket: the discount line comes only from Shopify's
  `cart.cart_level_discount_applications` ("Cosy Season Saving −£15");
  `{% render 'offer', mode: 'cart_bar', cart: cart %}` is the "£X away from £15 off"
  goal bar (below the minimum, never beside the free-delivery bar). Card badge:
  `mode: 'badge'`.

### 9.3 Delivery dates

`{% render 'delivery-estimate', product: product, variant: current %}` (or
`delivery-options` with `product:`) prints, for example:

- own stock: "Free standard delivery: arrives Thu 15 Oct to Mon 19 Oct" and
  "Express £6.99: arrives Tue 13 Oct to Wed 14 Oct";
- below the free threshold: "Standard delivery £4.99: arrives …";
- `ships_from` "Partner warehouse" with dispatch days: "Free, tracked delivery
  from our partner warehouse: arrives …" (no Express line);
- `ships_from` "Partner warehouse" with NO dispatch days: no dates at all,
  "Tracked delivery from our partner warehouse; delivery time shown at checkout"
  ("Free, tracked …" only when the price reaches the free threshold).

Numbers: dispatch = `dispatch_days_min/max` when set, else Theme settings
`delivery_dispatch_min/max` (policy 1 to 2 working days, not for partner beds);
Standard = `delivery_min_days/max_days` (4 to 6) after dispatch; Express =
`delivery_express_min/max` (2 to 3). Free when the variant's price is at or above
`free_shipping_threshold` (£40). A dispatch minimum of 0 only counts today with
`ships_same_day` true, on a working day before `dispatch_cutoff_hour`.

The dates are filled in by JS (cached pages stay right); without JS the line
states the working-day ranges ("dispatched in 1 to 2 working days, then 4 to 6
working days"). Contract: `[data-delivery-estimate]` (`data-dates`,
`data-dispatch-min/max`, `data-same-day`, `data-free-from`, `data-free-enabled`,
`data-estimate-price`, `data-tpl-range`, `data-tpl-nodates-free/-paid`) holding
`[data-delivery-line="standard"|"express"]` (`data-transit-min/max`, `data-cost`,
`data-tpl-free`, `data-tpl-paid`) and `[data-delivery-text]`.
`Lunova.delivery.updateEstimates(root, variant)` refills it; global.js runs it on
load, on `lunova:variant:change` and for injected HTML (quick add). Neither
element uses a bare `data-price` attribute: product.js rewrites every
`[data-price]` (except `[data-per-night]`) as a price block.

`Lunova.delivery.window({dispatchMin, dispatchMax, transitMin, transitMax, from})`
counts working days only: no Saturdays, Sundays or England & Wales bank holidays
(hard-coded for 2026 to 2027 in global.js `BANK_HOLIDAYS`, plus Theme settings
`holiday_dates`; the list needs extending after 2027). `from` is a Date or
"YYYY-MM-DD" (default now, store time zone); dispatch is N working days after the
order day (an order on a Saturday dispatches from Monday). Returns civil dates
(12:00 UTC) and `text` ("Thu 15 Oct to Mon 19 Oct"), or null without numbers.

The dispatch countdown (`delivery-promise`) stays off by default and never
renders for a product without `ships_same_day` true.

### 9.4 Claim gates

- `snippets/foam-bed` (= `Lunova.foamBed`): `custom.foam_guarantee` decides when
  set (true: covered, false: not); a `core_type` that isn't memory foam → not
  covered; only when both are blank, the older rule (tags guarantee:no/yes, bed
  type, car seat, "no-flatten guarantee" in the description).
- `snippets/per-night`: ONE line, "About 8p a night over the 5-year foam
  guarantee" (whole pence, price ÷ 1,826 nights for 5 years, i.e. years × 365¼),
  basis behind the (i): "£149 ÷ 1,826 nights (5 years) = 8.16p a night. A way of
  seeing the cost over the guaranteed life of the foam, not a payment plan."
  Renders nothing without a product the foam guarantee covers, or with
  show_per_night / guarantee_enable off. The audit removes it from collection
  cards (product-card).
- `snippets/trial-eligible`: unchanged and independent of the foam guarantee
  (refund policy: 100 nights on everything except personalised items).
- `snippets/rating`: nothing under 5 reviews; store_rating stays blank.
- Low stock: off by default, threshold 0, never a count.

### 9.5 Announcement bar

One static line from Theme settings ("Our promises"): "Free UK delivery over £40
· 100 nights to decide · Free collection", each part dropping out when its
promise is off. No rotation, no countdown, no offer. `sections/header-group.json`
holds just this bar and the header.

### 9.6 Harness

`fixtures/store.mjs` merges `fixtures/real-metafields.json` into real-mode
products and variants (`metafieldDrop` types them like Shopify: boolean, integer,
list → array, json → object, text → string; drops expose `.value` and `.type`).
The fixture catalogue carries custom.* values on Coniston (low entry, subtitle,
"Worth it?", Q&A, variant sleep areas), Ambleside (guarantee memory foam, density
50, dispatch 1 to 2), Langdale (egg-crate, foam_guarantee false), Kendal (partner,
no dispatch days) and the Windermere cooling bed (partner, 3 to 5 days).
`check.mjs` adds `[audit]` checks (no "Only N left", no same-day claim without
`ships_same_day`, ".00" prices and em dashes as warnings); `browser-test.mjs`
checks the offer line and the delivery dates; `test/audit.test.mjs` covers the
metafield typing, money, the working-day maths and the claim gates.
