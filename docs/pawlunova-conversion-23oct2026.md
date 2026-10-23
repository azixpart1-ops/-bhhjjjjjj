# PawLunova: what is actually costing you sales

23 October 2026. Every number here comes from the live store — Shopify Admin API,
ShopifyQL, and the live storefront HTML fetched and measured today.

---

## Read this first: two things are urgent, and one of them is legal

**1. Four fake customer reviews are live on your homepage right now.**

Under the heading **"Owner reviews — What owners have told us."** your homepage carries
four named testimonials: Caleb Z., Willow T., Victor S., Daisy A. You have 43 orders and
**zero** reviews collected in any of your three review apps. One of them reads:

> "Our rescue is anxious and never settled anywhere. The bolsters on the **Harrogate**
> seem to give her the edges she was looking for. She sleeps through now…" — Willow T.

The Harrogate Heritage Bolster Dog Bed **has never sold a single unit.** It does not
appear anywhere in your sales data.

Publishing fake consumer reviews, or presenting them as genuine, is a banned practice
under the **Digital Markets, Competition and Consumers Act 2024** (in force since April
2025). The penalty ceiling is 10% of global turnover **or £300,000, whichever is higher**.
Ten percent of your lifetime revenue is £502, so the £300,000 floor is what applies —
roughly 60 times everything the store has ever earned.

This is a one-click fix and it should be done today. See action **O1** below.

**2. Your "Add to basket" button fails accessibility contrast, and add-to-cart fell 3.3× when it changed.**

The live button is gold `#C9943A` with white `#FFFFFF` text. Measured contrast: **2.70:1**.
WCAG AA requires 4.5:1 for normal text and 3:1 for large text — it fails both. Your own
`pln-gold.css` specifies ink `#17150F` on that gold, which measures **6.76:1**, and your
theme's saved "Lunova" preset uses terracotta `#B4532A` at 4.99:1. Someone changed the
accent colour in the theme editor and left the label white.

Engaged mobile add-to-cart fell from 15.74% to 4.76% between 18 and 22 October on flat
volume (z=3.21, p=0.0013). The button is the best explanation available.

The fix keeps your gold and changes only the label colour. See action **O2**.

---

## The thing that reframes everything: a quarter of your traffic is robots

Before any of the conversion numbers mean anything, this has to be corrected.

| Browser | Sessions | Bounce | Avg. duration | Orders |
|---|---|---|---|---|
| Mobile Safari | 1,380 | 71.1% | 120.5s | 17 |
| **Spider** | **988** | **99.80%** | **0.016s** | **0** |
| Chrome Mobile | 348 | 63.2% | 183.3s | 3 |
| Safari | 313 | 87.9% | 42.4s | 1 |
| Chrome | 261 | 70.1% | 108.8s | 4 |

**988 sessions — 25% of your reported traffic — are crawlers that Shopify itself labels
"Spider", averaging sixteen thousandths of a second on site.** A further 1,078 of your
1,569 "desktop" sessions come from the United States, on a UK-only store.

So the 0.82% conversion rate you are looking at is not your conversion rate. On UK traffic
with crawlers excluded:

| | Reported (all traffic) | **Real (UK, no crawlers)** |
|---|---|---|
| Sessions | 3,919 | **2,677** |
| Add-to-cart rate | 3.32% | **4.56%** |
| Checkout completion | 43.2% | **43.1%** |
| Conversion rate | 0.82% | **1.16%** |
| Average order value | £120.26 | **£139.40** |

Your orders need the same correction. Of 43 orders: **5 are test orders** (#1001 £2.00,
#1002 £5.00, #1015 £9.99, #1031 £0.90, #1032 £4.50 — product titles "Ww", "No", "H") and
**2 were refunded** (#1010 £170.99, #1012 £69.00). You have **36 real orders and £5,019 of
kept revenue**, at a real AOV of **£139.40**, not the £120.26 Shopify reports.

**Why this matters more than it sounds:** you have shipped eight design passes in
twenty-one days chasing a 66% "conversion collapse" that is substantially a measurement
artefact. The 20 October traffic spike (468 sessions) was a 218-session junk burst against
a single collection URL. Chasing that number is what produced eighteen themes.

---

## Where the money actually is: the checkout

This is the one leak that survives every correction. On clean UK traffic:

```
2,677 sessions
  →  122 added to cart      4.56%   (benchmark 7–10%)
  →   72 reached checkout   59.0%   (benchmark 65–70%)
  →   31 completed          43.1%   (benchmark 60–70%)  ← the leak
```

**Why it leaks — part one: you advertise eight payment methods you cannot accept.**

Rendered in a real mobile browser, your product page paints **eleven payment logos 140
pixels below the "Add to basket" button**: Mastercard, PayPal, Maestro, Visa, American
Express, Google Pay, Apple Pay, Clearpay, Klarna, Afterpay, Amazon Pay.

Your checkout accepts **Visa, Mastercard, Visa Electron and American Express.** Eight of
the eleven are false.

They come from the Vitals app — module 15, `vtl-pl-main-widget__logo`, with the logo list
`mastercard,paypal,maestro,visa,american_express,google_pay,apple_pay,afterpay,klarna,afterpay2,amazon_pay`
configured in it. They are injected by JavaScript at runtime, which is why they do not
appear in the page source.

*(I got this wrong earlier in the session. I checked the theme's footer payment-icon
setting, found it unrendered, and told you there were no fake badges. That was true of the
footer and false of the buy box. Vitals is the source, and the badges are real and visible
— see the screenshot.)*

The sequence a mobile buyer actually experiences: sees Apple Pay and Klarna under the
button → taps Add to basket → reaches checkout → is asked to type a sixteen-digit card
number → is redirected to an unfamiliar domain. Of your 47 available Vitals modules, this
false badge row is the only one that renders anything.

**Why it leaks — part two.** Your checkout offers exactly one way to pay. Extracted from
the live checkout page today, after putting a real bed in a real basket and following it
through:

```
paymentMethodIdentifier : "Card Payments by Teya"
paymentBrands           : ["visa","master","visaelectron","american_express"]
showRedirectionNotice   : true          ← the buyer is sent off-site to pay
shopify_payments        : 0 occurrences anywhere in the checkout document
supportedDigitalWallets : []            ← Admin API, authoritative
```

No Apple Pay. No Google Pay. No Shop Pay. No PayPal. No Klarna or Clearpay. A card number,
typed by hand, then a redirect to an unfamiliar domain.

**78% of your orders are placed on a phone.** At an average order of £139, on a brand the
buyer met ten minutes ago.

Your product page makes it worse: it tells shoppers *"Pay by Visa, Mastercard or Maestro,
or with **Revolut Pay**, on Revolut's secure payment page."* You are not on Revolut. They
arrive at Teya. The one promise you make about payment is wrong, at the exact moment the
buyer is deciding whether to trust you with a card.

**What closing this is worth**, from your own funnel:

| Checkout completion | Orders from the same 72 | Gain | Revenue at £139.40 |
|---|---|---|---|
| 43.1% (today) | 31 | — | — |
| 60% | 43 | **+12** | **+£1,701** |
| 65% | 47 | **+16** | **+£2,203** |
| 70% | 50 | **+19** | **+£2,704** |

Your lifetime kept revenue is £5,019. A +16-order improvement over three weeks is
**+44% revenue**, from a settings change, with no design work at all.

Note that your 94KB `portable-wallets.en.js` already loads on every page. You are paying
the bandwidth for wallet buttons and rendering none.

---

## What I changed (done, live, verified)

### Discounts: three overlapping offers → one honest one
You were running a free-shipping code on a store where shipping is already free, plus £15
off over £129, plus a blanket 10% off 26 collections. 37 discount applications across 43
orders — 86% of sales discounted, 9.1% of revenue given away, with your product pages
promising £15 while the 10% was what actually applied.

- Deactivated `9P8FV7QYV3WG` (free shipping — it did nothing; shipping is already £0)
- Deactivated "10% off on all products"
- Kept "Cosy Season Saving: £15 Off." over £129

Verified on live carts: a £79 bed now pays £79. A £159 bed pays £144. **Two £79 beds pay
£143** — so the offer now pulls order value up instead of discounting everything.

Both are *deactivated*, not deleted — one click in Discounts to restore either.

The 10% launched on 10 October, which is exactly when the decline you were chasing began.

### Catalogue: non-beds out of your bed collections
Your brand, copy and 100-night trial are about orthopaedic beds. Rattan garden day beds
were sitting in "Luxury Dog Beds", and a memory-foam car seat in "Small Dog Beds" and
"Washable Dog Beds".

- Removed the over-broad bed tags from Henley, Torver and Whinlatter
- Changed "Outdoor Dog Beds & Kennels" to a tag-driven rule and renamed it
  **"Outdoor & Raised Dog Beds"** — it now holds 4 genuine beds (Bassenthwaite, Windermere,
  Honister, Brotherswater) instead of 8 mixed items
- Keswick, Blencathra, Henley and Torver are now in **no** collection: still live and
  buyable by direct link, no longer consuming browse clicks or diluting the range.
  All four verified HTTP 200.
- **Left Kirkstone stairs alone** — it is your cross-sell for low-entry and older-dog beds,
  which is average-order-value work, not catalogue drift.

Your collection URL and its Google history are unchanged; only the display title moved.

### Delivery claim: say the free delivery you actually give
Your delivery profile has one UK zone: **Standard £0.00, no minimum.** Free on everything.
`pln_free_delivery_threshold` had no stored value, so the Liquid `| default: 40` invented a
£40 minimum that your checkout never charges. Every surface inherited it, and the buy-box
promise was *hidden entirely* on beds under £40.

Fixed in the repo (commit `78eca70`): the claim now lives in one snippet,
`yuva/snippets/pln-delivery-claim.liquid`, rendering "Free UK delivery" at a threshold of 0
and appending a minimum only if one genuinely exists. Swept the same false claim out of 28
files across the superseded layers, `index.html` and `templates/llms.txt.liquid`.

**One honest caveat:** I later established that the live theme is a different, self-contained
build that carries none of the `pln-` assets, so this commit improves the repo and will
apply whenever that layer next ships — it is not what is live today. The live theme already
has `delivery_standard_price: "Free"` and its shipping progress bar switched off, so the
remaining "over £40" text on your live site sits in the product template's shipping tab and
in your shop meta description. Both are listed below as **O8** and **O9**.

---

## What needs you (I cannot do these)

Ordered by money per minute of your time.

| | Action | Where | Time |
|---|---|---|---|
| **O1** | **Delete the four homepage testimonials.** Theme editor → Home → Testimonials → untick "These are real customers' words", or delete the four blocks. Do not rewrite them — delete them. | Theme editor | 2 min |
| **O2** | **Fix the buy-button contrast.** Theme editor → Colours → set accent **text** to `#17150F`. Keeps your gold, takes contrast from 2.70:1 to 6.76:1. | Theme editor | 1 min |
| **O3** | **Turn off the Vitals payment-badge module.** Eight of the eleven logos under your buy button are methods you cannot accept. Either switch that module off in Vitals, or disable the Vitals app embed entirely — it is the only Vitals module rendering anything, and it costs 209KB and 854ms of phone CPU to tell your customers something untrue. Say the word and I will disable the embed on the fixed theme. | Vitals app | 2 min |
| **O4** | **Enable Shopify Payments** and switch on Apple Pay, Google Pay and Shop Pay. This is the single biggest lever in the business (+£1,700–£2,700 per three weeks). If you are on Teya for a reason — rates, a contract — tell me and I will work out whether Teya can serve wallets through Shopify, or whether running Shopify Payments alongside it is better. Doing **O3 and O4 together** is the point: either accept the methods you advertise, or stop advertising them. | Settings → Payments | 10 min |
| **O5** | **Switch off the low-stock warnings.** Your bestseller's page says "Low stock in Medium" — on placeholder inventory. Nearly every variant in the catalogue reads exactly 5 units, which is not real stock data. Unfounded scarcity claims are an unfair-commercial-practice risk, and your theme's own preset ships them off. | Theme editor | 1 min |
| **O6** | **Fix the Spanish chat widget.** "¿Necesitas ayuda?" renders on every page of your UK store — home, collection, product and cart — from the SupChat WhatsApp app. Set its language to English or remove it. | SupChat app | 2 min |
| **O7** | **Pick one review app and uninstall the other six.** Seven are installed: Loox, ProViews, TrustShop, REVIEWS.io, Shping, Trust Flow and Star Product Reviews. **Keep Loox** — 1 request, 27KB, 29ms, eight times fewer requests than TrustShop and purchase-verified with photos, which is the right proof for a bed. TrustShop is also printing **"0 (0 review)"** above the price on every product page, because `show_rating_when_empty` is on — a zero-star rating on your best converter. Then collect real reviews from your 36 real buyers — the day-14 and day-60 emails are already written in `content/emails/`. | Apps | 15 min |
| **O8** | **Fix your shop meta description.** It promises "free UK delivery over £40" — understating your own offer. Not editable via the API. | Online Store → Preferences | 1 min |
| **O9** | **Fix the product shipping tab**, which still says free "on orders over £40 (£4.99 below)". | Theme editor → product template | 2 min |
| **O10** | **Restore Google Search Console access.** Without it nobody can see which queries land on which page, so SEO work is guesswork. | — | 5 min |

---

## Things I was wrong about, and things that are not the problem

I checked these and they do not hold. Each one is a sprint you do not need to spend.

- **Desktop is not broken.** It looked like it was — 0.32% against mobile's 1.10%. It is
  crawler contamination. On UK non-crawler traffic desktop converts at **1.18%**, slightly
  *better* than mobile, and on mainstream browsers only it reaches 3.45% — about 3× mobile,
  which is the normal pattern for a considered purchase. Measured at 1440×900 and 1920×1080:
  no overflow, no stranded columns, no mobile sticky bar, no persistent hamburger. **Cancel
  any desktop redesign.** It is your best-converting surface and the acquisition growth has
  all gone to mobile, which is worth about a third as much per session.
- **The eight design passes did not cause the decline.** Every file on your live theme is
  stamped 13 October 22:38. The 18, 20 and 22 October themes — gold buttons, outline Buy
  now, serif, quiet header — are all still unpublished. The regression came through theme
  *settings*, not code.
- **One product page converting 5.7× better than another was noise.** Windermere (0.35%)
  and Crummock (2.00%) render byte-identical pages and perform identically at add-to-cart
  (2.83% vs 3.19%, Fisher p=0.81). The whole gap tests at p=0.10. At 283 sessions a month
  you cannot read a product page on order conversion — measure add-to-cart, which has
  roughly seven times the events.
- **Your prices are not too high.** Across 35 pages with ≥10 sessions, the correlation
  between entry price and add-to-cart is **positive** (Spearman ρ = +0.32). Dearer beds
  convert better. The premium positioning is landing. Do not cut prices and do not add a
  fourth discount.
- **The £15 badge is honest.** It reads "£15 off at £129+", carries `hidden` by default and
  a per-size `data-min="12900"` gate. I initially read it as a broken promise; it is not.
- **Shipping cost is not the checkout leak.** Standard delivery is genuinely £0 with no
  minimum.
- **`/password` was never a conversion gate.** 81 of its 84 sessions are crawlers.
- **The fake star ratings from 10 October are gone.** `reviews.rating` is empty on all 85
  products, and no `aggregateRating` or `Review` is emitted in any JSON-LD on any page. I
  said earlier this looked cleared, then an agent reported 11 `aggregateRating` occurrences
  — those were JavaScript source text with `ratingValue: 0`, not emitted markup. My original
  read was right. The homepage testimonials in **O1** are a separate and real problem.

---

## The real root cause

You have a conversion *measurement* problem that has been driving conversion *design* work.

A quarter of the traffic is robots, five orders are £2 tests, and the headline rate is
therefore wrong by a third. Eighteen themes and eight design passes in three weeks were
spent chasing that number, while the two things actually costing money — a checkout with one
card-only off-site payment method, and a buy button nobody can read — went untouched,
because neither is a design idea. One is a settings page and one is a colour field.

The simplest version of the fix is: **stop redesigning, correct the measurement, and change
four settings.**

### The one number to watch

Put this in Analytics → Reports and judge every future change by it, not by the dashboard:

```sql
FROM sessions
SHOW sessions, added_to_cart_rate, conversion_rate
WHERE session_country = 'United Kingdom' AND session_device_browser != 'Spider'
GROUP BY session_device_type
TIMESERIES week SINCE -60d
```

Baseline to beat: **4.56% add-to-cart, 1.16% conversion, £139.40 average order.**
Watch add-to-cart rate daily and orders weekly — at your traffic, daily order counts are
noise. Exclude 20 October from any before/after comparison.

Then change **one thing at a time** and give it three clean days. Eight simultaneous passes
is why nobody can tell you what worked.

### After the settings, in order
1. **Fill three metafields on your top ten beds** — `core_type`, `foam_depth`,
   `foam_guarantee`. Buttermere has them and converts at 18.92% add-to-cart (p=0.0005); 83
   of 85 products do not, and the missing fields silently remove a spec card, a per-night
   price line and a trust chip. This is a data fill, not a redesign. I can do it — say the
   word.
2. **Cross-sell.** 34 of your 36 real orders are a single bed. 95% of your customers buy one
   thing, from a brand selling beds, blankets and stairs.
3. **Capture email.** 2,646 real UK visitors did not buy and were never contacted again.
4. **Cut the app load.** Measured on a throttled UK 4G phone: your pages need **14.8–16.5
   seconds to become interactive**, and the product page's LCP on slow 4G is **7.8 seconds**
   (Google rates anything over 4.0s as "poor"). Your own theme code is **2.9% of the bytes**.

   Blocking the measurement stack and six storefront apps removed **6,082ms of blocking
   time, 10.6 seconds of time-to-interactive and 1,786KB of JavaScript** — and add-to-basket
   still worked. Removal list, in measured-cost order:

   | Remove | Saves |
   |---|---|
   | Google tag duplication — 13 loads, 6 tag IDs, **2 GA4 properties, 2 Ads accounts** | −2,970ms, −1,475KB |
   | MIDA Replay Heatmaps (duplicate of Microsoft Clarity) | −1,416ms |
   | Vitals (its one rendered widget is the false badge row) | −854ms, −209KB |
   | Microsoft Clarity | −345ms |
   | SupChat (the Spanish widget) | −220ms |
   | TrustShop, ProViews (keep Loox) | −145ms |

   You are delivering roughly **7.85GB of Google tag JavaScript** across the window to
   instrument a paid channel that produced **10 sessions and £0**. Consolidate to one GA4
   property and one Ads account.

   Also: the "gptlab" app embed emits JSON-LD containing an unescaped newline, so that whole
   block is invalid and Google discards it.

5. **Cut the navigation.** 26 collection links produce **559 listings of 73 products** —
   each product appears 7.7 times. Twenty-five of those 26 links earned **155 sessions and
   1 order in eight weeks**. Six links would partition the catalogue honestly: Orthopaedic &
   memory foam, Bolster & nest, Mattresses & crate beds, Raised & cooling, Small dogs,
   Large & XL. The 15-item "Shop by dog" menu is doing nothing.

6. **Reorder the collection your traffic actually lands on.** `/collections/orthopaedic-dog-beds`
   takes 424 sessions at 1.18% — your best major entry — but **three of your top five
   revenue products are not in it**, and Buttermere, which converts at 8.11%, is not near the
   top. Revenue order would be: Ambleside, Grasmere, Crummock, Buttermere, Scafell,
   Elterwater. Ten products carry 77% of revenue; **58 of 77 have never sold**.

7. **Stop discounting the beds that sell.** No order in 21 days was placed below £69, median
   £129 — yet every bed that sells has been cut by a median 28%, and those cuts pushed 63%
   of stock below the £129 minimum for your own £15 offer. The data says your prices are not
   the problem (dearer beds convert better); the cuts lowered AOV 18% and bought nothing.

8. **Check your real stock.** Nine of the twelve products that produced all your real orders
   have their best-selling size down to **1–3 units** on `inventoryPolicy: DENY`, which makes
   them unbuyable at zero. Ambleside Medium — 10.5% of your orders — has **one unit left**.
   Nearly every other variant reads exactly 5, which is placeholder data, not stock.

---

*Measurements: live storefront fetched 23 Oct 2026; funnel from ShopifyQL over the store's
full trading life (3–23 Oct 2026); contrast ratios computed to WCAG 2.1 relative-luminance;
JS weights are gzipped transfer sizes measured per asset.*
