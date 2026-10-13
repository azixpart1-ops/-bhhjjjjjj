# Horizon conversion pass, October 2026

The same design-skill pass that `lunova-design-pass-oct2026.md` describes for
the Lunova theme, applied to the store's Horizon-based theme, plus the
conversion work the brief asked for: new sections, a tighter page structure,
honest psychological and emotional levers, and a palette-driven colour system.

**Where it lives.** A duplicate of the store theme "PawLunova Horizon
(12 Oct 2026)" was made and edited, so the original is untouched:

> **PawLunova Horizon + conversion pass (13 Oct 2026)** ·
> `gid://shopify/OnlineStoreTheme/208944759126` · unpublished

The source for that theme is the `horizon/` directory in this repo (the pl-*
layer plus the Horizon files it depends on). The published theme, MAIN
"Premium polish (13 Oct 2026)", is Lunova-based and was not changed.

## 1. The levers, and where each one lands

Every lever comes from the October mobile audit's psychology playbook
(`PawLunova_Mobile_Conversion_Audit_Oct2026.pdf`, pp. 32–33). Its "never" list
holds: no invented reviews or stars, no resetting timers, no stock counts, no
medical claims, no brand copy dressed as a review.

| Lever | Section | What it does |
|---|---|---|
| Small commitment | **PL: First question** (`pl-sleep-start`), new | "How does your dog sleep?" as three picture cards before the Bed Finder. One tap answers question one and the finder scrolls to question two, so the remaining three questions feel like finishing something already started. On a page without the finder the card opens `/pages/bed-finder?style=curl`, which the finder reads on load. |
| Good, better, best | **PL: Good, better, best** (`pl-ladder`), new | Langdale £99 / Coniston £109 / Ennerdale £179 side by side, Coniston marked "The sensible pick" with the one terracotta border and the only primary button in the row. Each rung shows per-night cost, its foam and trial verdicts, and one line on who it suits. The middle option is the anchor, not a trick: it is the bed most dogs end up with. |
| Protective pride, the emotional after-state | **PL: The first fortnight** (`pl-after`), new | What the owner will notice at night one, night three, and week two: "straight in", "sleeps right through", "stops circling". It sells the outcome the owner is quietly hoping for, in their own words, with no review markup and a schema note telling editors not to paste reviews in. |
| Certainty after the click | **PL: After you order** (`pl-order-timeline`), new | Four steps from order to first night, with the arrival step filled by `pl-ui.js` from the real dispatch and transit settings and the bank-holiday list, so the date shown is the date they will get. |
| Real deadline only | **PL: Current offer** (`pl-offer-bar`), new | "£15 off orders over £129 at checkout, until Sat 31 Oct", read from Theme settings › PawLunova promises › Current offer. The server drops the section once the end date passes; `gateOffer()` in `pl-ui.js` removes it on the shopper's clock too, so a cached page cannot keep promising it. No countdown. |
| Keep the next step within reach | sticky bar in **PL: Hero** (`pl-hero`) | On phones, once the hero scrolls out, a one-line bar ("Not sure which bed? 4 questions." + "Find their bed") sits at the bottom. It hides while the finder or footer is in view, so it never covers the thing it points at. Off by one checkbox in the hero's settings. |
| Risk reversal, pennies a day | existing sections, kept | The 100-night trial, free collection, 5-year guarantee and per-night cost already in the Horizon pl-* layer were left as they were and now sit in a tighter order. |

## 2. Homepage structure

`templates/index.json` now runs: hero → trust bar → current offer → problem
signs → **first question** → bed finder → **good, better, best** → mechanism
→ cost reframe → trial timeline → **the first fortnight** → honest proof →
shop by need → comparison → story → **after you order** → FAQ → final CTA →
newsletter. The old "start" section was removed; the first-question cards
replace it.

The shape follows the audit's funnel: recognise the problem, make one small
choice, get a recommendation, understand why it works, see the cost in
pennies, remove the risk, picture the outcome, then everything that handles
objections. Backgrounds alternate bone / oat / moss so each step reads as its
own beat; moss is reserved for mechanism and the final CTA.

## 3. Colour system

Tokens for the pl-* layer are now derived from Theme settings › Colours in
`snippets/pl-head.liquid`, so a palette change in the editor recolours every
PawLunova section at once. The roles are fixed; only the values move.

| Token | Source | Role |
|---|---|---|
| `--pl-bone`, `--pl-ink` | palette background, foreground | page and text |
| `--pl-moss` | color1 | dark ground (mechanism, final CTA, dark chips) |
| `--pl-sand` | color2 | hairlines |
| `--pl-oat` | background mixed 55% with sand | alternate section background |
| `--pl-terracotta` | color3 | the one accent, purchase actions only |
| `--pl-terracotta-text` | color3, darkened 12% if its contrast on the background is under 4.5:1 | accent used as text or on a hairline |
| `--pl-terracotta-tint` | background mixed 88% with the accent | soft warm band (offer bar, the sensible pick) |
| `--pl-on-moss`, `--pl-on-moss-muted` | background, background mixed with moss | text on dark ground |

The store's palette is unchanged: bone `#FAF6EF`, ink `#17150F`, moss
`#1F2E27`, sand `#E3D7C3`, terracotta `#B4532A` (4.99:1 on white, 4.63:1 on
bone). `pl-base.css` keeps the same values as fallbacks.

## 4. TypeUI rules applied

Same checklist as the Lunova pass, applied to `assets/pl-base.css` and the
section stylesheets:

- Supporting text floor of 14px: every 13px supporting size moved to 0.875rem.
  Pills and stamps stay at 12–13px as labels, not reading text.
- Heading to paragraph: 32px between a section heading and its lede; eyebrow
  to heading stays tight. Display headings at line-height 1.05.
- One accent: terracotta only on buttons, the ladder's pick card, and the
  "Start with this" links. Dark-ground text uses the on-moss tokens instead of
  hard-coded white.
- Buttons never wrap; offer and sticky buttons go full-width under 750px.
- Hover lifts only under `(hover: hover) and (pointer: fine)`; every card has a
  visible focus ring; scrolling triggered by the first-question cards respects
  `prefers-reduced-motion`.

## 5. Files

| File | Change |
|---|---|
| `horizon/sections/pl-sleep-start.liquid` | new |
| `horizon/sections/pl-ladder.liquid` | new |
| `horizon/sections/pl-after.liquid` | new |
| `horizon/sections/pl-order-timeline.liquid` | new |
| `horizon/sections/pl-offer-bar.liquid` | new |
| `horizon/sections/pl-hero.liquid` | sticky bar markup, styles and settings; lede spacing; caption colours |
| `horizon/snippets/pl-head.liquid` | palette-derived tokens |
| `horizon/assets/pl-base.css` | token fallbacks, type floor, heading spacing, accent and on-moss colours |
| `horizon/assets/pl-ui.js` | `gateOffer`, `initSticky`, `initSleepStart` |
| `horizon/assets/pl-finder.js` | `preset()` and `?style=` / `?stage=` on load |
| `horizon/templates/index.json` | new sections wired to real products, new order, background rhythm |

## 6. Verification, and its limits

- All eleven files were uploaded with `themeFilesUpsert`, which validates
  Liquid and section schemas server-side. No errors. The MD5 Shopify reports
  for each file matches the local copy.
- `@shopify/theme-check-node` over `horizon/`: no errors in the changed files.
  Two notes on the output. The `ValidScopedCSSClass` warnings on `section` and
  `button-secondary` are Horizon's own global classes used as intended. The
  `JSONMissingBlock` error for `blocks/email-signup.liquid` is a block that
  exists on the store but was never pulled into this directory; it is not part
  of this pass.
- Horizon cannot be rendered by the local harness in `scripts/theme-dev`, and
  the storefront preview is behind a Cloudflare challenge from this
  environment, so **this pass has not been looked at in a browser**. Before
  publishing, open the theme in the editor and check: the sticky bar on a
  phone-width preview; a tap on a first-question card jumping the finder to
  question two; the ladder's three product images; the offer bar reading
  "until Sat 31 Oct"; the arrival date in "After you order".
- The first-question cards and "The first fortnight" ship with icons rather
  than photos. Each block has an image picker; a photo of a curled, leaning
  and sprawled dog will do more than any copy there.

## 7. To preview or publish

Online Store → Themes → **PawLunova Horizon + conversion pass (13 Oct 2026)**
→ Customize to edit, Preview to see it. Publish from the same menu; roll back
by publishing the previous theme. The original "PawLunova Horizon
(12 Oct 2026)" is still there, unchanged.
