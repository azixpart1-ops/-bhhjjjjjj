# Snoozly — premium pet-bed theme for snoozly.co.uk

A complete, custom Shopify Online Store 2.0 theme, built from scratch for
**Snoozly**, plus the 64-bed Snoozly catalogue rebuilt from the PawLunova
product export ([`catalogue/README.md`](catalogue/README.md)).

| | |
|---|---|
| Live theme | **Snoozly — Premium v2 (catalogue update)** · ID `201473458511` (published by you on 29 Sept) |
| Ready to publish | **Snoozly — v3 (polish)** · ID `201570484559`: v2 plus your editor changes, the fixes and the copy pass in section 8 |
| Preview v3 | `https://snoozly.co.uk/?preview_theme_id=201570484559` |
| Publish | Online Store → Themes → *Snoozly — v3 (polish)* → **Publish** (Shopify only lets the owner do this) |

```
snoozly/
├── theme/          the Shopify theme exactly as installed (93 files)
├── src/css, src/js source for assets/snoozly.css and assets/snoozly.js
├── catalogue/      the 64 beds: names, copy, prices, Shopify import files
├── scripts/        build, validation and live-verification tools
└── dist/           built zip (ignored by git; `python3 scripts/build.py --zip`)
```

---

## 1. The brand system

**Snoozly = sleep.** The identity is built on night: a midnight-indigo ground,
a moon-gold highlight, soft cream paper, and a lilac accent. Most pet shops are
bright primaries or earthy greens; a moonlit palette is instantly different and
says the one thing the brand is about.

| Token | Hex | Role |
|---|---|---|
| Midnight | `#1A1838` | Text, primary buttons, dark sections |
| Moon gold | `#F5C35C` | Signature highlight, CTAs on dark, the logo moon |
| Moonlight cream | `#FBF8F3` | Page ground |
| Linen | `#F3EDE3` | Alternate ground |
| Lilac | `#5B4FC4` | Accent text, links, focus ring |

**Type.** Fraunces (with its *soft* axis at 100 — rounded, pillowy serifs) for
headings, Figtree for body. Both are self-hosted, subset to Latin and cut down
from ~300KB to **107KB total** (53KB + 37KB + 17KB), with no third-party font
requests. Emotional words in headings are set in the italic cut:
*"They sleep half their life. Make it **the good half.**"* — type `*like this*`
in any heading setting.

**Motif.** Moon and stars: the wordmark's crescent, the starfield drawn in pure
CSS on every dark section, twinkling stars in image placeholders, a glowing
crescent on the closing call to action.

### Colour-coded by sleep need

The whole store is organised around five **sleep needs**, each with its own
colour. The colour follows the need everywhere: the homepage tiles, the product
badges, collection headers, quiz results, the product-page story section, the
filters and the menu.

| Need | For | Tint / Deep | Collection |
|---|---|---|---|
| **Calm** | Nervous nappers — bolstered, high-sided | `#EEEBFB` / `#4A3FB0` | `/collections/calming-beds` |
| **Support** | Older joints, bigger dogs — memory/orthopaedic foam | `#FCF1DC` / `#8A5A0B` | `/collections/orthopaedic-beds` |
| **Cool** | Hot sleepers | `#E3F1F7` / `#1C5E7B` | `/collections/cooling-beds` |
| **Cosy** | Curlers, burrowers, cats | `#FBE9E4` / `#9A3D2C` | `/collections/cosy-beds` |
| **Stretch** | Sprawlers — box beds, mattresses | `#E6F0E8` / `#2F6247` | `/collections/sprawler-beds` |

A product joins a need through a tag (`need:calm` …). Products without one are
classified from their title and description (*orthopaedic*, *memory foam*,
*bolster*, *box bed*…), so a new bed is colour-coded the day it's added.

**Every colour pair is measured.** `scripts/contrast.py` checks all 9 schemes
and all 5 needs against WCAG AA. Lowest text pair: **5.29:1** (4.5 required).

---

## 2. How the homepage sells

One emotional arc — *hook → name the problem → solve it → justify the price →
de-risk → prove → close*.

| # | Section | Psychological job |
|---|---|---|
| 1 | **Hero** (midnight) | Reframe: "They sleep half their life. Make it the good half." Primary CTA is the quiz (low commitment), secondary is shop. Trust row before the first price. |
| 2 | **Proof band** (moon gold) | Continuous, low-cost repetition of promises. |
| 3 | **Shop by sleep need** | Choice architecture: 16 beds become 5 colour decisions; a "Not sure?" tile catches the undecided. |
| 4 | **Five signs** | Problem awareness. Things an owner can check tonight — each colour-linked to the need that fixes it. |
| 5 | **Sleep Match quiz** ⭐ | Micro-commitments → a personal answer. Four questions (pet, sleep style, concern, size) scored across the five needs; recommends in-stock beds from that need's collection with the **right size pre-selected**, plus a size to look for and a runner-up. |
| 6 | **The Snoozly edit** | Products with instant colour filters; in-stock beds first. |
| 7 | **Four things a good night depends on** | Education that justifies price. |
| 8 | **Comparison** | Snoozly vs a typical pet-shop bed. |
| 9 | **Big numbers** | Price reframe: *under 1p an hour* — with the arithmetic shown. |
| 10 | **Promise** | Risk reversal. Figures come from theme settings, so they can't disagree with the basket. |
| 11 | **Makers we stock** | Borrowed authority (Danish Design, Banbury & Co, Trixie, Red Hamper). |
| 12 | **Reviews** | Disabled until real reviews exist (see §6). |
| 13 | **FAQ** | Objections in buying order, with FAQ structured data for Google. |
| 14 | **Closing CTA** | Emotional close: "Give them the best sleep of their whole life." |

**Honest by construction.** No fake countdowns, no "12 people are viewing
this", no invented reviews or ratings. Urgency is only ever real stock
("Only 3 left" from actual inventory). Star ratings appear only when a reviews
app writes them. Delivery, returns and free-delivery figures are single
settings reused everywhere.

---

## 3. Every page

| Page | What's on it |
|---|---|
| **Header** | Announcement rotator · logo/wordmark · mega menu with colour-coded needs + quiz promo · "Find their bed" CTA · predictive search · basket count |
| **Basket drawer** | Free-delivery progress bar (real £50 threshold) · "Great choice" confirmation · quantity/remove · "Complete their sleep set-up" suggestions · gift note · Shop Pay / PayPal / Google Pay |
| **Product** | Gallery (swipe, thumbs, zoom) · sleep-need badge · price with Shop Pay instalments · "why it suits them" · size pills with sold-out combos crossed out · size-guide drawer · honest stock line · add to basket with price · express checkout · **delivery date estimate** · trust row · cleaned description · need explainer · delivery & care accordions · sticky add-to-basket bar · back-in-stock request when sold out · colour-coded "Made for…" story · recommendations · FAQ · Product structured data |
| **Collection** | Hero recoloured by need · need shortcuts · **real Shopify filters** (availability, price, type, brand…) updating in place with shareable URLs · sort · in-stock first · quiz tile in the grid · SEO copy below the grid |
| **Search** | Same filters · products + pages · helpful empty state |
| **Basket page** | Lines, free-delivery bar, sticky summary, trust, payment icons, upsell row |
| **Sleep Match** `/pages/sleep-match` | The quiz as a landing page (use in ads) + need tiles + promise + FAQ |
| **Our story** `/pages/our-story` | Story, numbers, four promises, makers |
| **Contact** `/pages/contact` | Form (pet & breed, order number, topic) + quick answers |
| **FAQ** `/pages/faq` | 12 answers in four groups, structured data |
| **Delivery & returns** `/pages/delivery-returns` | Rates table from your real shipping settings + returns |
| **Size guide** `/pages/size-guide` | Breed-by-breed table + four sizing tips |
| **Blog / article** | The Snooze Journal, with a quiz call-to-action in every article |
| **All collections, 404, password, gift card, account pages** | All designed; nothing falls back to a blank default |

---

## 4. What was changed on the store (all additive)

- **Theme** created, unpublished. Live theme untouched.
- **Tags** added to all 16 products (`need:*`, `pet:dog` / `pet:cat`, and
  `delivery:14-21` on the Vital Bed Lennox, which ships from Germany in 2–3 weeks).
  No existing tag or product field was changed.
- **7 smart collections**, published to the Online Store: calming-beds,
  orthopaedic-beds, cooling-beds (empty for now — hidden automatically),
  cosy-beds, sprawler-beds, dog-beds, cat-beds.
- **5 pages**: our-story, faq, delivery-returns, sleep-match, size-guide.
- **4 menus** with new handles (`snoozly-main`, `snoozly-footer-*`). Your
  existing "Main menu" and "Footer menu" are untouched, so the live site's
  navigation hasn't changed.
- The "News" blog was renamed **The Snooze Journal** (the address stays `/blogs/news`).

---

## 5. Verified

| Check | Result |
|---|---|
| Shopify theme-check | **0 errors, 0 warnings** |
| Strict Liquid parse (`scripts/liquid-parse.rb`) | every file parses |
| Schema/template validator (`scripts/validate.py`) | 37 sections, 26 templates clean |
| Contrast audit (`scripts/contrast.py`) | 0 failures |
| Live preview, 18 page types × desktop 1440 + phone 390 | **36/36** render on the new theme: 1 H1 each, 0 Liquid errors, 0 missing translations, 0 horizontal overflow |
| Interactive flows (`scripts/verify-flows.mjs`) | **34/34** — quiz → result → remembered; variant → price + URL; add → drawer → free-delivery bar → qty → remove; filters; predictive search; menus; no JS exceptions |
| axe-core WCAG 2.1 AA | no violations in theme code |

The only console noise in the preview comes from Shopify's own analytics and
Shop Pay telemetry, which this build environment's network blocks.

Bugs the checks caught and fixed before hand-over: a range setting with 106
steps (Shopify's limit is 101, so it would have rejected the settings), two
Liquid strings whose `}` broke Shopify's tokenizer (the upload refused the
whole theme until they were fixed), a header that measured itself and grew,
a skip link taking space, product pages overflowing sideways on phones, and
announcement links focusable while hidden.

---

## 6. ⚠️ Before you publish — your to-do list

**Must do**
1. **Add your photos.** Every image slot shows a designed moon placeholder
   until you fill it (in the editor it says which photo goes where): hero,
   "five signs", Our story, size guide, mega-menu promo, closing CTA (optional),
   collection images (optional).
2. **Rename the store** from "My Store" to *Snoozly* (Settings → General). It
   appears at checkout, in order emails, and in your privacy policy.
3. **Add a refund policy** (Settings → Policies). Only a privacy policy exists.
   The theme says **14-day returns** — the UK legal minimum, so it's always
   true. If you offer 30 days, change *Theme settings → Delivery, returns and
   trust → Returns window* and every mention updates.
4. **Confirm the delivery window.** The theme says *3–6 working days* for UK
   orders. Your suppliers' real times weren't available; adjust the setting to match.
5. **Set up `hello@snoozly.co.uk`** (or change it in Theme settings). Contact
   form messages currently go to the store contact email, `abbas@pawlunova.co.uk` —
   change that under Settings → General too if Snoozly should be separate.
6. **Re-enable app embeds** on the new theme after publishing (Customize → App embeds).

**Biggest sales levers in the catalogue** (not theme problems)
7. **13 of the 16 older products are sold out** — the North East Pets /
   Collective items show 0 stock. The theme handles this gracefully (in-stock
   first, "Back soon", back-in-stock requests, the quiz prefers in-stock beds).
   The 64 Snoozly beds from the catalogue are all buyable.
8. **Supplier copy leaks through.** "Dream Paws Teddy Boucle Bed" is described
   as "animal bedding/forage material"; several have filler bullets ("Choice of
   Variant", "Designed for dogs"). The theme already strips the other shop's
   "Check in-store availability / WhatsApp us" boxes and "by The North East Pet
   Shop" from titles (both are editable settings), but rewriting descriptions
   is the real fix.
9. **Another brand's name on product imagery**: the Orthopedic Memory Foam
   Dog Bed's main photo is a "JOYELF" infographic. Replace it with a clean shot.
10. **Sizes are separate products** (e.g. Danish Design Small / Medium / Large
    are three listings). Merging them into one product with size variants
    would make the size pills, the quiz's size matching and the filters work far better.
11. **Reviews**: install a reviews app (Judge.me, Shopify Product Reviews…). Stars
    then appear automatically on cards and product pages. The homepage reviews
    section is switched off until you add real quotes — it never shows empty or invented reviews.
12. **Three cooling beds** (Harbour, Brook, Breeze) now fill the Cool need.

---

## 7. Working on it

```bash
python3 snoozly/scripts/build.py --zip       # concat src → theme/assets, zip to dist/
python3 snoozly/scripts/validate.py          # schema + template rules Shopify enforces
ruby snoozly/scripts/liquid-parse.rb snoozly/theme   # strict Liquid parse (gem install liquid)
python3 snoozly/scripts/contrast.py          # palette contrast audit
node snoozly/scripts/verify-preview.mjs <theme_id> [outdir]   # every page, 2 widths
node snoozly/scripts/verify-flows.mjs <theme_id> [outdir]     # quiz, basket, filters, search
node snoozly/scripts/verify-a11y.mjs <theme_id> <axe.min.js>  # WCAG 2.1 AA
```

Edit CSS and JS in `src/`, never the built `theme/assets/snoozly.*` files.
Theme-editor changes made on the store are stored in the theme's
`config/settings_data.json` and template JSON — pull those back before
redeploying templates from here, or they'll be overwritten.

## 8. Polish pass (v3)

**Bugs fixed**
- Product pages printed their Google product data (JSON-LD) as text under the
  gallery. It is now inside its `<script>` tag, where Google reads it and
  shoppers don't see it.
- The Delivery page showed `[min_days]–[max_days]` instead of the day range.
- `/collections/all` was titled "Products"; it is now "All beds".
- An empty "Similar beds" band (Shopify has no recommendations for new
  products yet) no longer leaves a blank gap.
- A personalised bed no longer shows "14-day returns" beside the buy button.
  It says "Made to order with their name", and the express checkout buttons
  stay off for it.

**Looking less like a template**
- The italic accent on every headline, the small uppercase label above every
  section, the starfield on dark sections, the giant footer wordmark and the
  floating stickers on the hero photo are all switched off (Theme settings, or
  each section's settings).
- Every heading and paragraph was rewritten in plain British English: no long
  dashes, no "not just X, it's Y", no claims the shop can't back up
  ("makers we trust", "real people", "one friendly email a fortnight").
- The homepage went from 14 sections to 8. The ticker, comparison table,
  stat trio, brand strip and closing banner are switched off, not deleted,
  so any of them can come back from the theme editor. The promise block that
  repeated the footer's delivery row is off on product, collection and Sleep
  Match pages.
- Copy is dog-first, since the catalogue is dog beds.

**Store changes (live straight away)**
- New collection **Our picks** (`/collections/our-picks`): eight beds, one or
  more per sleep need, from £54 to £189. v3 uses it on the homepage and in the
  basket instead of the first eight beds alphabetically.
- Page text for Our story, FAQ, Delivery & returns, Sleep Match and Size guide
  rewritten the same way. Delivery & returns now says personalised beds can't
  be returned for a change of mind (UK law exempts made-to-order goods) but
  are covered if faulty.
- The footer's "Snoozly" menu now holds just "Our story": the Journal has no
  posts yet and "Contact" was already under Help.

