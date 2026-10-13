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

Second pass, 13 October. The first pass derived the tokens from the palette; this one gives
every colour a job, checks every pair on the surface it actually sits on, and lets the editor set
the emotional rhythm of a page by name rather than by hex.

### The two families

Two hues carry every meaning, each with a text tone, a surface tint and a tone for the dark
ground. Nothing else is added: "success" is a lighter, more saturated moss, "alert" a deeper
terracotta, so the semantic colours stay inside the brand and a palette change moves them all.

| Family | Token | Derived from | Job |
|---|---|---|---|
| Calm (moss) | `--pl-moss` | color1 | the dark ground: authority ("What's inside") and the close |
| | `--pl-success` | moss at 40% saturation, 29% lightness | reassurance as text and icons: trial, guarantee, delivery, "done" |
| | `--pl-success-tint` | page mixed 88% with success | the calm surface: sections whose job is to take fear away |
| | `--pl-success-on-dark` | success at 62% lightness | the same reassurance on moss |
| Warm (terracotta) | `--pl-terracotta` | color3 | the one accent: purchase actions, the sensible pick, the offer |
| | `--pl-terracotta-text` | accent darkened in 6-point steps until it passes 4.5:1 on its own tint | the accent as text |
| | `--pl-terracotta-tint` | page mixed 88% with accent | the warm surface: comfort, desire, the offer band |
| | `--pl-terracotta-on-dark` | accent at 62% lightness, with ink text | the accent on moss |
| Neutrals | `--pl-bone`, `--pl-oat`, `--pl-sand`, `--pl-ink`, `--pl-ink-muted` | palette | page, lean-in band, hairline, text, muted text on oat |

Why these hues. Green is the colour of safety and rest across every study the audit draws on,
and the dark end of it reads as expertise; it is also what the category leader in orthopaedic
dog beds uses (Big Barker: warm neutrals, a sage ground, a terracotta accent). Terracotta is
warmth, appetite and the body; it is the colour of the thing being bought, a warm place to lie,
so it is reserved for the moment of buying. The UK mattress brands (Simba, Emma, Casper) lean on
navy for institutional trust; PawLunova is a one-person UK brand selling comfort for old dogs,
and warm earth with a green promise fits that better than a bank's palette. Emma is the useful
reference for structure: a green tint under guarantee content and a warm tint under offers.

### Contrast, checked on the real surfaces

The first pass checked the accent on the page only. On oat it was 4.10:1 and on its own tint
3.95:1, both under 4.5. The accent-as-text token is now darkened until it passes on the tint, the
darkest light surface it ever sits on (`#9b4824`: 4.97:1 on tint, 5.16 on oat, 5.83 on bone).
On moss, the primary button was terracotta on dark green at 2.85:1, under the 3:1 a control edge
needs; on dark surfaces the button now lightens to `#da8662` (5.12:1 against moss) with ink text
(6.58:1). Success green on the page is 5.85:1; on its own tint 5.15:1. Every derived pair was
computed, not eyeballed, and the figures are in the commit.

### Surfaces by name

Every PawLunova section has a **Surface** setting: page, oat, calm, warm or moss. It adds a
`pl-tone--*` class, so the section's mood is a word in the editor and the palette supplies the
colour. Moss goes through Horizon's contrast override and also gets `pl-on-dark`, as does any
custom background darker than mid-grey; on dark surfaces buttons, accent eyebrows, trust icons
and badges all step to their on-dark tones automatically. The old hex backgrounds in
`templates/index.json` are gone; the homepage now reads:

| Section | Surface | Why |
|---|---|---|
| Hero | page | calm welcome |
| Trust bar | oat | lean in: the four promises |
| Current offer | page, warm band | one warm thing to want |
| Three signs | page | recognition without alarm |
| First question, Bed Finder | oat | one continuous "choose" zone |
| Good, better, best | page | the pick card carries the warm tint |
| What's inside | moss | authority |
| Real cost | page | |
| Sleep trial | calm | risk taken away |
| The first fortnight | warm | the comfort being bought |
| Honest proof | page | |
| Shop by need | oat | |
| Side by side | page | |
| Named for Lakes | oat | |
| After you order | calm | certainty |
| FAQ | page | |
| The close | moss | the page slows down and the reader decides |

The close is a new PawLunova section (`pl-final-cta`) in place of Horizon's generic section, so
it follows the same rules as the rest of the page. The newsletter band is still a Horizon section
with a hex background; it is the one surface not driven by the palette.

### Everything fits

The same colour never means two things. Trust icons are success green everywhere (trust bar,
honest proof, basket promises, product page delivery line, the close); the offer icon is the
only warm badge. Every hard-coded colour in the sections, the finder stylesheet and the mechanism
card is gone, replaced by a token, so a palette change in the editor reaches every pixel.

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
| `horizon/sections/pl-final-cta.liquid` | new, the close on moss |
| all 23 `horizon/sections/pl-*.liquid` | Surface setting, tokens in place of hex |
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
