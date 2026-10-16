# PawLunova on Yuva: the full build spec

Store: **pawlunova.co.uk** (GBP, UK). Theme: **Yuva** by Shine Dezign Infonet
(Theme Store; presets Yuva, Woofy, Amaze, Burn, Petal; v13.0.8). Catalogue
read from the live Admin API on 16 October 2026: **85 products** (79 live beds,
houses and steps named for the Lakes, plus 2 upsell products and a few test
products to delete), **27 collections**, 13 content pages, 4 menus, 21 redirects.

This document is the whole site, page by page and section by section: what
each section is, which Yuva feature or `pln-*` custom section builds it, the
copy it carries, the psychological job it does, and the SEO it ranks on. The
code is in `yuva/` (install steps in `yuva/README.md`).

**Scope note.** The brief asked for guilt-based manipulation. That isn't in this
build, and not for taste reasons: confirmshaming, false urgency, fake scarcity
and shame copy are now enforceable "banned practices" under the UK Digital
Markets, Competition and Consumers Act 2024, and Google's helpful-content and
page-experience systems demote exactly the patterns that generate them. They
would cost the ranking the brief asks for. What's here instead is stronger and
survives an audit: **recognition** ("they've started choosing the floor"),
**protective pride** ("they've earned a proper bed"), **anticipated relief**
(the first fortnight), **endowment** (the dog's name on the result), **loss
aversion turned to the buyer's side** (100 nights, free collection), and
**certainty** (dated delivery, what happens next).

---

## 1. Who the site is for, and the one arc every page walks

The buyer is the owner of a dog who is **slowing down**: usually a Labrador,
retriever, spaniel, collie or staffie between 7 and 12, in a UK home with
hard floors. They notice the pause at the bottom of the stairs before anyone
else does. They search "orthopaedic dog bed", "best bed for older dog", "memory
foam dog bed large", "dog keeps sleeping on the floor". They'll spend £69 to
£199 once they're convinced there's a problem worth that much.

Every page walks the same arc, in this order, because a considered £150
purchase needs the problem before the product:

> notice → name it → make one small choice → get a recommendation → understand
> why it works → see the cost in pennies → remove the risk → picture the
> outcome → handle the objections → decide

Surfaces follow the arc (bone = page, oat = lean in, calm green = risk taken
away, warm terracotta tint = the comfort being bought, moss = authority and the
close). Terracotta is reserved for one thing: the next step (buy, or find the
bed). Nothing decorative uses it.

---

## 2. Yuva: what it gives us, and what we add

Yuva's own sections, read from its Woofy demo (section types in brackets):
announcement bar, header with mega menu, slideshow/banner, split banner,
image banner, rich text, tabbed collections, collection list banner,
colour-based collections, featured collection, gallery, countdown with
images, before/after image, rotating text loop, lookbook, featured articles,
text with icons (services), video banner, images grid, FAQ, main product,
product recommendations, main collection, main cart, main search, newsletter
side popup, store locator, side drawer cart. Features: quick view, sticky
cart, size chart, product tabs, trust badges, stock counter, back-in-stock,
mega menu, swatch filters, infinite scroll, promo popups, age verifier.

| Keep from Yuva (native) | Why |
|---|---|
| Header, mega menu, announcement bar, footer, cart drawer, search | Chrome: tested, accessible, updated by the vendor. |
| Main product section (gallery, variant picker, buy buttons, product tabs, size chart) | The purchase form. We add one Custom Liquid block under the buy button. |
| Main collection (filters, sort, grid, infinite scroll) | We wrap it with an intro above and a guide below. |
| Product recommendations, recently viewed | Mere exposure; native is fine. |
| Newsletter popup (set to 25s / exit intent, once per 14 days, plain "No thanks") | Reciprocity, off by default until there's a lead magnet. |

| Switch OFF in Yuva | Why |
|---|---|
| Countdown timer, stock counter, "X viewing", promo popups with timers | Not bound to real inventory or a real deadline. Banned practice. |
| Animated stickers, parallax, image rollover zoom on cards | Core Web Vitals. CLS and INP are ranking signals. |
| Yuva's product JSON-LD and any reviews app rich snippets | `pln-pdp-why` emits one Product entity. Two conflict. |
| Yuva's collection banner title | `pln-collection-intro` carries the single H1. |
| Star ratings on cards and PDP | Until a reviews app holds ≥5 genuine buyer reviews per bed (`pln_show_ratings`). |

**Custom sections** (`yuva/sections/pln-*.liquid`, 27 files, all self-contained,
one shared stylesheet and script, scoped under `.pln` so Yuva's CSS is untouched):

| Section (editor name) | File | Job | Lever |
|---|---|---|---|
| PL: Hero | pln-hero | H1, deck, dual CTA, three-promise line | Recognition; protective pride |
| PL: Trust bar | pln-trust-bar | 4–5 promises, each gated on a setting | Risk removed before the first price |
| PL: Promise strip | pln-marquee | Static repetition of the promises | Mere exposure |
| PL: Current offer | pln-offer-band | Real end date only; self-removes when over | Honest urgency |
| PL: Three signs | pln-problem-signs | Self-diagnosis tonight | Problem awareness, no blame |
| PL: First question | pln-sleep-start | Q1 as picture cards; one tap opens the finder on Q2 | Foot in the door |
| PL: Bed Finder | pln-bed-finder | 3 questions + name → one bed, right size, add to basket | Choice architecture; endowment; default effect |
| PL: Good, better, best | pln-ladder | Three real beds, the middle one marked | Anchoring; compromise effect |
| PL: What's inside | pln-mechanism | Layer cross-section | Specificity; price justification |
| PL: Real cost | pln-cost-reframe | Price ÷ (years × 365), basis shown | Price reframing |
| PL: Sleep trial | pln-trial | The trial as a timeline | Risk reversal |
| PL: The first fortnight | pln-after | Night 1, week 1, week 2 | Anticipated relief; outcome vividness |
| PL: Vet note | pln-vet-note | What a bed can and can't do, 3 questions for the vet | Authority (honest), uncertainty reduction |
| PL: Honest proof | pln-honest-proof | Owner's promises, @app block for real reviews | Social proof without fabrication |
| PL: Shop by need | pln-shop-by-need | 8 collections framed by need | Internal linking; Hick's law |
| PL: Side by side | pln-comparison | Ours vs generic alternatives | Contrast |
| PL: Made in Yorkshire | pln-yorkshire | Provenance, Lake District naming | Identity; trust |
| PL: After you order | pln-order-timeline | Four dated steps | Certainty after the click |
| PL: FAQ | pln-faq | Objections in buying order + FAQPage schema | Objection handling; rich results |
| PL: The close | pln-final-cta | Emotional close + the same two CTAs | Peak-end |
| PL: Sticky finder bar | pln-sticky-bar | Phones: one next step always in reach | Friction removal |
| PL: Collection intro | pln-collection-intro | H1, intro, breadcrumb, chips, image | Recognition; crawl paths |
| PL: Start with sleep | pln-need-chips | 4 beds + finder tile above the grid | Hick's law |
| PL: Collection guide | pln-collection-seo | Long-form body + collection FAQ | Topical depth; FAQ rich results |
| PL: Why this bed | pln-pdp-why | Why-bullets, size cards, spec card, vet note, Product schema | Specificity; uncertainty reduction |
| PL: Page body | pln-page-body | H1 + long-form + Article schema + finder aside | Guides that rank |
| PL: Dead-end rescue | pln-empty-finder | 404 / empty states → the finder | Friction removal |

Snippets: `pln-assets`, `pln-icon`, `pln-product-card`, `pln-trial-eligible`,
`pln-buybox-promise` (the under-the-button block), `pln-schema-org`,
`pln-schema-product`. Settings group: `yuva/config/pln-settings-group.json`
("PawLunova promises": origin, trial, guarantee, delivery, who answers, vet,
social proof, offer, sizing).

---

## 3. Homepage (`templates/index.json`)

H1: **They've earned a proper bed.** One H1 on the page; every section
heading below is an H2.

| # | Section | Surface | Copy (final) | Job |
|---|---|---|---|---|
| 1 | PL: Hero | page | Eyebrow *Orthopaedic and memory foam dog beds* · H1 *They've earned a proper bed.* · Deck *You notice it before they do. The pause at the bottom of the stairs, the longer stretch before the first step. Our beds are built for how your dog actually sleeps, sized by breed and weight, with 100 nights at home to be sure.* · **Find my dog's bed** (4 questions · 30 seconds · no email) / Shop all beds · line: 100 nights to decide · 5-year foam guarantee · Made in Yorkshire · Image: Grasmere sofa with a greying dog | Recognition, then two exits |
| 2 | PL: Trust bar | oat | 100 nights to decide · 5-year foam guarantee · Made in Yorkshire · Free UK delivery over £40 · A real person in the UK (Abbas) | Kill risk before price |
| 3 | PL: Current offer | warm band | Only while an offer with a real end date is on. No countdown. | Honest urgency |
| 4 | PL: Three signs | page | *Three signs their bed has stopped working.* 1 circling after lying down · 2 choosing the floor · 3 a dip that doesn't spring back · note: *A bed can't undo ageing. What it can change is how much effort goes into lying down, and how much goes into getting back up.* | Self-diagnosis |
| 5 | PL: First question | oat | *How does your dog sleep?* Curled in a ball (Borrowdale photo) / Head on something (Grasmere) / Stretched flat out (Ambleside) | Commitment |
| 6 | PL: Bed Finder | oat | Q1 sleep · Q2 joints · Q3 size (weight + breeds) · Q4 name → result with reasons, price, size, per-night, **Add Bella's bed · £109**, trial line under the button | The centrepiece |
| 7 | PL: Good, better, best | page | Langdale £69 (Good) · **Coniston £79 (The sensible pick)** · Ennerdale £139 (Best) | Anchor |
| 8 | PL: What's inside | moss | *Foam, not filling.* 5 layers | Mechanism |
| 9 | PL: Real cost | page | *About 6p a night.* (Ambleside £99 ÷ 1,825 nights) vs coffee £3, treats £4, cinema £12 | Reframe |
| 10 | PL: Sleep trial | calm | *Try it for 100 nights. At our risk, not yours.* Night 1 / Night 50 / Night 100 | Risk reversal |
| 11 | PL: The first fortnight | warm | Night 1 *Straight in.* · Week 1 *Sleeps right through.* · Week 2 *Won't get off it.* | Outcome |
| 12 | PL: Vet note | page | *What a bed can change, and what it can't.* + 3 questions for the vet | Honest authority |
| 13 | PL: Honest proof | page | Three owner notes (sizing, claims, reviews) + @app block for real reviews + owner line | Proof without fabrication |
| 14 | PL: Shop by need | oat | 8 collections: orthopaedic, older dogs, low step-in, large, nests, sofas, waterproof, raised | Links + triage |
| 15 | PL: Side by side | page | 7 checks vs a supermarket bed / a human topper | Contrast |
| 16 | PL: Made in Yorkshire | oat | *Made in Yorkshire, named for the fells next door.* + place names | Provenance |
| 17 | PL: After you order | calm | Today → dispatched (1–2 wd) → arrives (dated, e.g. *Ordered today: Fri 23 Oct to Tue 27 Oct*) → trial starts | Certainty |
| 18 | PL: FAQ | page | 8 questions, FAQPage schema | Objections |
| 19 | PL: The close | moss | *They've given you every good year they had.* / *The least we can do is make the next ones easier to get up from.* | Peak-end |
| 20 | PL: Sticky finder bar | fixed, phones | *Not sure which bed? 4 questions.* **Find their bed** | Friction |

Bed Finder matches shipped in the template (all real handles, all in stock
on 16 Oct):

| | No concerns | Slowing down | Stiff or diagnosed |
|---|---|---|---|
| Curls up | Windermere Sherpa Nest £65 | Elterwater Bouclé Memory Foam Nest £109 | Coniston Low-Entry Memory Foam £79 |
| Leans | Harrogate Heritage Bolster £49 | Grasmere Memory Foam Bolster Sofa £109 | Borrowdale Memory Foam Bolster £109 |
| Sprawls | Buttermere Memory Foam Mattress £69 | Ambleside Edge-to-Edge Memory Foam £99 | Ennerdale Gel Memory Foam £139 |

The price rises with need in every row; the finder puts the owner in front of
exactly the bed they're willing to pay for. Sizes are resolved in the browser
from the chosen bed's own variants; a sold-out size offers the next size up
and says so.

---

## 4. Collection pages (`templates/collection.json`)

Order: **PL: Collection intro** → **PL: Start with sleep** → Yuva main
collection → **PL: Trust bar** (calm) → **PL: Collection guide** → sticky bar.

- **H1** = the collection title. Intro = `collection.metafields.custom.intro`,
  else the first paragraph of the collection description (already written for
  all 20 SEO collections in `content/collections/*.json`), with the dog's
  behaviour first: *Chin on the bottom stair, back against your legs?*
- Breadcrumb Home › Dog Beds › {collection}; chips to 8 sibling collections.
- Four "Best for…" beds + the Bed Finder tile before the grid.
- Yuva grid settings: 3 columns desktop, 2 mobile, filters by Size / Price /
  What's inside (tags), sort default Best selling; "Show more" not infinite
  scroll on the SEO collections (crawlable pagination).
- Collection guide: the rest of the description in two columns under an H2
  carrying the keyword (*Choosing Orthopaedic Dog Beds: what to look for*),
  then up to 6 collection-specific questions (FAQPage schema), then links to
  the five guides.

---

## 5. Product page (`templates/product.json`)

Order: Yuva main product → **PL: Why this bed** → **PL: Sleep trial** →
**PL: After you order** → **PL: FAQ** (product set, no schema) → Yuva
recommendations.

Inside Yuva's main product section, in this block order: title (H1, the
product title) · price · one-line subtitle from `custom.subtitle` (text
block) · variant picker (sizes with the sleeping area in the label where the
variant has `sleep_area`) · quantity off · buy buttons (dynamic checkout on)
· **Custom Liquid block**: `{% render 'pln-buybox-promise', product: product %}`
· product tabs: Description / What's inside / Delivery & returns · size
chart (Yuva's, fed from the size guide page).

The Custom Liquid block renders, directly under *Add to basket*:
dated delivery (*Order today, arrives Fri 23 Oct to Tue 27 Oct*) · free UK
delivery · **100 nights to decide** · **5-year foam guarantee** with the
per-night line (foam beds) · *Made in Yorkshire. Questions answered by Abbas.*
Partner-warehouse beds get *message us for the date* instead of a date;
personalised beds are told they're outside the trial.

**PL: Why this bed** reads only the product's own `custom.*` metafields (24
definitions already live: why, subtitle, sleep_style, low_entry,
entry_height_cm, has_liner, non_slip, wash_temp, core_type, foam_depth,
density_kg_m3, feel, shape, cover, ships_from, dispatch_days_min/max,
foam_guarantee, return_days; variant sleep_area, suits_breeds, suits_weight).
Blank means the line doesn't show. It emits the Product + BreadcrumbList
JSON-LD (one Offer per variant, shipping and return policy, GTIN when the
barcode is valid, `aggregateRating` only with ≥5 genuine reviews and the
setting on).

---

## 6. The other pages

| Page | Template | Sections | H1 |
|---|---|---|---|
| Bed Finder `/pages/bed-finder` | page.bed-finder | Finder (page tone) → page body (the existing SEO copy: *Which dog bed should I buy? Four questions decide it*) → trust bar | from the page title: Find Your Dog's Bed |
| FAQ `/pages/faq` | page.faq | PL: FAQ as H1 with 10 questions + FAQPage schema → page body → close | Sizing, foam, washing, the trial and delivery, answered. |
| Our story `/pages/our-story` | page.about | Made in Yorkshire (image right) → page body (existing story, Article schema) → vet note → trial → close | Our Story |
| 100-night trial `/pages/100-night-trial` | page.100-night-trial | Trial timeline → body → after you order → close | The 100-Night Sleep Trial |
| Guides: size-guide, foam-explained, older-dog-sleep, care-guide, dog-bed-guide, choose-orthopaedic-beds | page.guide | Page body (author line, Article schema, vet-reviewed flag) → vet note → 4 collections → close | the page title |
| Delivery & returns, review policy, contact | page / Yuva contact | Page body only | the page title |
| 404 | 404 | Dead-end rescue (H1) → 4 collections | That page has wandered off. |
| Cart | Yuva main cart | Yuva drawer + cart; promises line in the drawer footer text: *100 nights to decide · Free collection · 5-year foam guarantee on memory foam beds* | |

Header (Yuva mega menu, menu `lunova-main-menu`): **Find their bed** (button,
terracotta) · Dog beds (mega: by need / by size / by type, with the finder
tile) · Older dogs · Guides · Our story · 100-night trial. Announcement bar:
*Free UK delivery over £40 · 100 nights to decide · Made in Yorkshire*.

Footer (menus `lunova-footer-shop`, `-help`, `-about`): shop by need · help
(size guide, delivery, trial, FAQ, contact) · about (story, Yorkshire,
review policy) · newsletter (*Sizing help and care tips, now and then. Mostly
for big and older dogs.*) · payment icons · *PawLunova, Yorkshire, UK*.

---

## 7. SEO: the plan to rank, page by page

What a theme can do for ranking: one H1 per page, keyword-bearing titles and
descriptions, fast pages, clean crawl paths, structured data, topical depth,
and internal links that pass authority from the pages that get links to the
pages that make money. Ranking first for "dog beds uk" against Amazon, Pets
at Home and Big Barker also needs links, genuine reviews and time; the
theme makes every on-site signal as strong as it can be. No one can promise
position 1 and this document doesn't.

### 7.1 Keyword map (primary → page)

| Keyword cluster (UK) | Page | Title tag (≤60) | Meta description (≤155) |
|---|---|---|---|
| orthopaedic dog bed, orthopedic dog bed uk | /collections/orthopaedic-dog-beds | Orthopaedic Dog Beds UK: Memory Foam, M to XXL \| PawLunova | Orthopaedic dog beds on supportive foam that holds its shape, sized in cm for M to XXL dogs. 100 nights to decide, made in Yorkshire. |
| memory foam dog bed | /collections/memory-foam-dog-beds | Memory Foam Dog Beds: Crumb, Layered & Gel \| PawLunova | The heavy sigh, then the shuffle an hour later as a thin bed goes flat. Memory foam dog beds that hold their shape, with a 100-night trial. |
| best bed for older dog, senior dog bed | /collections/dog-beds-for-older-dogs | Dog Beds for Older Dogs: The Grey-Muzzle Years \| PawLunova | One more circle before lying down, the night they choose the floor. Senior dog beds with memory foam and a low step-in. 100 nights to decide. |
| large dog bed, labrador bed | /collections/large-dog-beds | Large Dog Beds UK for Labradors & Retrievers \| PawLunova | Sold as large but sized for a spaniel? Large dog beds in memory foam, egg-crate and soft fill, sleeping areas in cm. Free UK delivery over £40. |
| extra large / xxl dog bed | /collections/extra-large-dog-beds | Extra Large Dog Beds: XL & XXL for Giant Breeds \| PawLunova | (existing) |
| dog sofa bed | /collections/dog-sofa-beds | Dog Sofa Beds: A Seat of Their Own \| PawLunova | (existing) |
| bolster dog bed | /collections/bolster-dog-beds | Bolster Dog Beds: An Edge to Lean On \| PawLunova | (existing) |
| nest / donut dog bed | /collections/nest-dog-beds | Nest Dog Beds & Donut Beds for Dogs Who Curl Up \| PawLunova | (existing) |
| waterproof / washable dog bed | the two collections | (existing) | (existing) |
| dog beds uk (head) | /collections/dog-beds | Dog Beds UK: Matched to How They Sleep \| PawLunova | (existing) |
| which dog bed should I buy | /pages/bed-finder | Which Dog Bed Should I Buy? Take the Bed Finder \| PawLunova | (existing) |
| dog bed size guide | /pages/size-guide | Dog Bed Size Guide UK: Measure, Then Choose \| PawLunova | (existing) |
| memory foam vs egg crate dog bed | /pages/foam-explained | (existing) | (existing) |
| how to wash a dog bed | /pages/care-guide | (existing) | (existing) |
| dog beds made in yorkshire, uk made dog beds | /pages/our-story | Dog Beds Made in Yorkshire: Our Story \| PawLunova | Named for the Lakes, made in Yorkshire. Why we sort dog beds by how dogs sleep, what's inside each one, and the 100-night trial. |
| homepage brand + "orthopaedic dog beds uk" | / | Orthopaedic & Memory Foam Dog Beds, Made in Yorkshire \| PawLunova | Dog beds built for how your dog sleeps, sized by breed and weight. 100 nights to decide, free collection if it isn't right. Made in Yorkshire. |

The 20 collection titles and descriptions already live in Shopify (written
8–14 Oct) stay. Set the four new ones above in Online Store → Preferences
(home) and on the Our Story page.

### 7.2 Heading structure

- Home: H1 hero → H2 per section (signs, first question, finder, ladder,
  what's inside, real cost, trial, first fortnight, vet note, proof, shop by
  need, side by side, Yorkshire, after you order, FAQ, close); H3 inside
  cards. No H2 inside repeating components.
- Collection: H1 title → H2 *Start with how they sleep* → H2 *Choosing
  {title}: what to look for* → H2 *{title}: questions owners ask* → H3
  questions.
- Product: H1 title → H2 *What the {bed} does for them.* → H2 *Which size?*
  / *What's inside* → H2 trial → H2 after you order → H2 questions.
- Guides: H1 title → the page's own H2s (already written) → H2 vet note → H2
  where to go next.

### 7.3 Structured data (all in `yuva/snippets`)

- `Organization` (+ `PostalAddress` addressRegion Yorkshire, contact point,
  founder, sameAs) and `WebSite` with `SearchAction`: `pln-schema-org`, once
  from theme.liquid.
- `Product` + `Offer` per variant (+ shipping, returns, GTIN) and
  `BreadcrumbList`: `pln-schema-product`, from PL: Why this bed.
- `FAQPage`: PL: FAQ (home, FAQ page) and PL: Collection guide. One per page.
- `Article` with `author` and, when the vet setting is on, `reviewedBy`:
  PL: Page body on guides and the story.
- Nothing fabricated: no `aggregateRating` without ≥5 real reviews, no
  `Review` markup on owner notes, no `LocalBusiness` opening hours unless a
  physical address is published.

### 7.4 Internal linking

- Home → every need collection (shop by need), the finder (6 places), the
  story, the trial, the FAQ, the size guide.
- Every collection → 8 sibling collections (chips), 5 guides (guide links),
  the finder (tile at position 5).
- Every product → parent collection (breadcrumb), size guide, care guide,
  older-dog guide (FAQ answers), the trial page, the finder (size help).
- Every guide → 4 collections (where to go next), the finder (aside).
- The 21 existing redirects stay; add `/pages/about` → `/pages/our-story` if
  Yuva's demo content created one.

### 7.5 Speed and crawl

- `pln.css` (~16 KB) and `pln.js` (~14 KB) load once; no third-party fonts
  beyond Yuva's two; hero image `fetchpriority=high`, everything else lazy.
- Turn off Yuva's animations, parallax and stickers (CLS/INP); keep
  `prefers-reduced-motion` respected (the yv layer already does).
- Yuva's "Show more" pagination on SEO collections; infinite scroll only on
  `all`.
- Sitemap: exclude the two upsell products, "H", "No" and the untitled draft
  (delete them), the review-policy page until it's live.
- Hreflang/locale: en-GB only; `<html lang="en-GB">`.
- Target: Lighthouse mobile ≥ 90 performance, LCP < 2.5 s on the collection
  pages (the money pages).

### 7.6 Content programme (what ranks beyond the theme)

Blog, `blogs/guides`, with PL: Page body styling via `article.json` (add the
same sections). First 12 posts, one a week, each answering one query the
collection pages can't: *Why does my dog sleep on the floor instead of his
bed?* · *Dog bed too small? The 20cm rule* · *Memory foam density for dog
beds: what the numbers mean* · *Labrador bed size* · *Arthritis in dogs:
what helps at home (vet-reviewed)* · *Dachshund beds and backs* · *Greyhound
and whippet beds* · *Washing a dog bed cover at 30°C* · *Crate mattress vs
crate mat* · *Cooling beds in a British summer* · *Puppy to adult: when to
size up* · *Gifts for old dogs that get used*. Each links to one collection
and the finder; each carries the Article schema and, once the vet is on
board, `reviewedBy`.

Reviews: day-14 and day-60 request emails already written
(`content/emails/`). Stars switch on per bed at 5 genuine reviews.

---

## 8. The "vet structure"

A layer of veterinary framing runs through the site without a fabricated
endorsement:

1. **PL: Vet note** on the home, story and every guide: what a bed can and
   can't change, plus three questions for the next check-up.
2. **Vet note inside PL: Why this bed** on every foam bed.
3. **Vet line under the Bed Finder result** for the "stiff or diagnosed"
   answer.
4. **FAQ answers** on arthritis never claim treatment.
5. **Attribution switch** (Theme settings → Vet-informed content): name,
   RCVS number, practice, photo. When on, the vet appears as *Reviewed by* on
   vet notes and as `reviewedBy` in Article schema. **Only switch it on with
   a practising vet's written consent**; a named endorsement without consent
   is a misleading-action offence and an RCVS matter for them.

Until a vet is on board, the structure is live and honest: it reads as
"ask your vet", which the audience trusts more than a stock-photo doctor.

---

## 9. Made in Yorkshire

Set once in Theme settings → PawLunova promises → *Origin line* (default
**Made in Yorkshire**; region Yorkshire for structured data). It then
appears in: the hero promise line, the trust bar, the promise strip, the
buy-box block, PL: Why this bed, the Yorkshire section (eyebrow), the FAQ
("Where are the beds made?"), the close, the announcement bar copy, the
footer line, the homepage and story title tags, and `Organization.address`.
One field, so it is the same words everywhere and one edit changes them all.
It's a claim the owner stands behind for every product it appears beside;
beds that ship from the partner warehouse show *Ships from: Partner
warehouse* on their spec card, read from `custom.ships_from`.

---

## 10. Theme settings to set in Yuva (once)

| Yuva setting | Value |
|---|---|
| Colours: background | `#FAF6EF` bone; secondary surface `#F1E9DB` oat; text `#17150F`; buttons `#B4532A` with white text; dark scheme `#1A2B24` moss with `#F1E9DB` text |
| Typography | Heading: Playfair Display 500; body: DM Sans 400. Base 16px. Headings line-height 1.0 at display sizes |
| Layout | Page width 1280; card radius 14; buttons pill |
| Header | Sticky; mega menu; one terracotta button "Find their bed" → /pages/bed-finder |
| Announcement bar | *Free UK delivery over £40 · 100 nights to decide · Made in Yorkshire* (static, no rotation) |
| Product card | Second image on hover off; quick add on (size drawer); badges only "Sold out" and "Save £X" from compare-at; no stars until reviews are real |
| Cart | Drawer; note on; free-shipping progress bar at £40; no pre-ticked add-ons; delete "Next Day Delivry" and "Shipping protection" upsells or fix their names and make them opt-in |
| Popups | Newsletter: 25 s or exit intent, once per 14 days, "No thanks" plain. Age verifier off. Promo popups off |
| Search | Predictive on |
| PawLunova promises (new group) | Origin on, trial 100, free collection on, guarantee 5, threshold 40, dispatch 1–2, transit 4–6, express 2–3 at £6.99, holidays list, owner Abbas, email + hours, vet off, ratings off, offer off |

---

## 11. Honesty guardrails (what this theme will never do)

No fake reviews, counts or stars; no "X people viewing"; no countdowns that
aren't a real end date; no scarcity not bound to live inventory (and even
then only "Low stock", never a number, unless switched on); no pre-ticked
paid add-ons; no drip pricing; no confirmshaming; no medical claims. Every
store-wide claim is a setting, so the site can only say what the owner has
told it is true.

---

## 12. QA before publishing

- [ ] `python3 scripts/lint-shopify.py --root yuva` → 0 errors (passes now).
- [ ] Theme editor: every yv section renders with its preset; the Bed Finder
      returns a bed for all 9 style × joints pairs; Add puts the right
      variant in the basket.
- [ ] One H1 per template (check home, a collection, a product, a guide, 404).
- [ ] Rich Results Test: Organization, Product (one entity), FAQPage,
      BreadcrumbList, Article all valid; no `aggregateRating` while ratings
      are off.
- [ ] Mobile 390px: hero CTA in the first screen; sticky bar shows after the
      hero and hides over the finder and footer; no horizontal scroll.
- [ ] Lighthouse mobile on /collections/orthopaedic-dog-beds ≥ 90.
- [ ] Delivery dates on a Saturday read like Monday's order; a bank holiday
      in the list is skipped.
- [ ] Offer band disappears the minute after `pln_offer_ends`.
- [ ] Yuva's own product JSON-LD and the reviews app rich snippets are off.
