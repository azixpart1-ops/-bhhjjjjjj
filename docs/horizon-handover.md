# PawLunova on Horizon: handover (12 October 2026)

A complete, conversion-focused theme built on the Horizon 4.2.0 copy already in the store. It is
unpublished. The live theme has not been touched.

## 1. Where it is

| What | Where |
| --- | --- |
| Theme in admin | Online Store > Themes > **PawLunova Horizon (12 Oct 2026)** (id 208804020566) |
| Preview on the real domain | https://pawlunova.co.uk/?preview_theme_id=208804020566 (works on your phone too; the preview sticks for the session) |
| Customise | Online Store > Themes > PawLunova Horizon (12 Oct 2026) > Customize |
| Code | repo branch `claude/pawlunova-horizon-theme`, folder `horizon/`; the plain theme files are also on branch `pawlunova-horizon-dist` |
| Housekeeping | Delete the two themes whose names start with **ZZ** (a half-imported first attempt and a superseded build). Delete `pawlunova-horizon-12oct2026.zip` and `pawlunova-horizon-12oct2026-b.zip` from Content > Files once you are happy (they were only used to import). **Copy of Horizon** is still your untouched stock copy; keep it or delete it as you like. |

Publishing: Themes > PawLunova Horizon (12 Oct 2026) > ... > Publish. Rolling back is the same
action on the theme that is live today (Shopify keeps it in the library when you publish another).

## 2. What is on each page, and why

The whole theme is built around one idea from the research: the shopper is an owner who has
noticed their dog slowing down and feels protective, not guilty. Every page moves them from
"is this a real problem" to "this is the bed, in this size" with the least thinking possible,
and every promise on the page is pulled from a theme setting or a product metafield so the theme
can only say what is true.

### Home

| Section (editor name) | Job | Lever |
| --- | --- | --- |
| PL: Hero | Emotional hook ("They've earned a proper bed."), keyword subhead, two routes: Bed Finder for the undecided, Shop all for the ready, four promises before any price | Choice architecture, risk reversal up front |
| PL: Trust bar | Trial, foam guarantee, free delivery threshold, a named person in the UK | Risk reversal, humanity |
| PL: Three signs | Three things to check tonight (circling, choosing the floor, the dip that does not spring back) | Problem awareness without blame |
| PL: Bed Finder | Four questions (how they sleep, life stage, size, name) to one bed and one size, add to basket from the result | Choice architecture, personalisation, goal gradient |
| PL: Need chips | "Stiff mornings", "Leans on the edge", "Stretches flat out", each pointing at one bed | Specificity, default options |
| PL: Mechanism | Foam, not filling: the layers, drawn | Specificity, mechanism beats adjectives |
| PL: Cost reframe | Price per night over the guarantee life next to everyday prices | Reframing |
| PL: Trial timeline | Night 1, night 50, night 100: what happens | Risk reversal, concreteness |
| PL: Honest proof | App review blocks, attributed quotes, and the three promises; a line that says how new the brand is | Honesty as proof |
| PL: Shop by need | Eight collections named by the dog's problem | Choice architecture |
| PL: Comparison | A fibre bed and a cot mattress, honestly compared | Pre-empting the obvious objection |
| PL: Named for Lakes | Why the beds carry Lake District names | Brand, memorability |
| PL: FAQ | Seven questions with FAQ structured data | Objection handling, SEO |
| Closing section | "They've given you every good year they had." and the two routes again | Protective pride |
| Newsletter | Sizing help and care tips, no bribe | Low-pressure capture |

### Product page

Gallery with thumbnails, then in the buy column: subtitle from metafield, title, "the finder
chose this for Bella" chip (only if they used the finder), price with instalments, price per
night (foam beds only), variant picker, **size cards** (sleeping area, breeds, weight, fit line
per size, from variant metafields), the live offer line (only while the offer in settings is
running and the price qualifies), the delivery line with real dates (working days, bank
holidays, partner-warehouse rules), the buy buttons, a trust row (trial, guarantee or delivery,
support), then an accordion: Why this bed (owner-voice bullets allowed by the product's own
data), What's inside (spec card), Questions owners ask (product Q&A metafield), Delivery and
returns, The full story (description). Below: mechanism, trial timeline, cost reframe,
comparison (foam beds only), recommendations with "best for" meta, proof, a product FAQ gated by
what the bed actually is (foam, memory foam, trial-eligible, own stock or partner), and a finder
banner. Sticky add to basket is on.

### Collection, basket, other pages

- Collection: an H1 built from the title, the first paragraph of the description as intro, need
  chips, the grid with "best for" meta on every card, finder banner, trust bar, the long SEO
  description folded under a disclosure, FAQ.
- Basket: "Your basket" (never "cart"), free-delivery and offer progress bars that read from
  settings, trust lines under checkout, a promises section.
- Pages: Bed Finder (`page.bed-finder`), FAQ (`page.faq`), About (`page.about`), Contact
  (`page.contact`), plus 404 and search pages that send people to the finder and the dog-beds
  collection rather than a dead end.
- Header: announcement bar with the trial and delivery promise, Bed Finder button next to the
  basket, mega menu with collection images, sticky on scroll up. Footer: brand line, three menus,
  newsletter, policies.

## 3. Competitors: what was taken as an idea, and what was done instead

Four sites were studied for ideas and keywords only. Nothing was copied.

| Competitor | What they do well | What PawLunova does with the idea |
| --- | --- | --- |
| Big Barker (US) | Leads with a long no-flatten warranty, a three-layer foam build drawn out, sizing by nose-to-tail length, a university study | The foam guarantee is a theme setting shown everywhere it applies and nowhere it does not; the layer diagram is the Mechanism section with the real layers per bed on the spec card; the size cards use nose-to-tail plus the fit allowance. No clinical claims: the FAQ says plainly that a bed is for comfort, not a treatment. |
| Omlet (UK) | 180-day money-back guarantee repeated in the buy box, zip-on washable toppers, reviews that say what kind of dog the reviewer has, "limited availability" banners | The 100-night trial sits in the hero, trust bar, product trust row, basket and FAQ, with free collection; washability and liners are stated per bed from metafields; proof is attributed and honest; no scarcity banners, stock checks or countdowns. |
| George Barclay (UK) | "What size do I need?" bed selector, box/sofa/mattress tiles, a water-resistant inner lining as a named feature, UK design heritage | The Bed Finder goes further (sleep style, life stage, size, name, one result with an alternative, add to basket from it); Shop by need uses the dog's problem rather than the product shape; the liner is a per-bed fact, not a blanket claim. |
| Charley Chau (UK) | Segments by how the dog sleeps ("Designed for the Burrowers"), "how do I measure my dog" guidance, independent reviews, press logos, free shipping threshold in the header | Sleep style is question one of the finder and the first "need chip"; measuring guidance is on every product page in the size cards; the header carries the real delivery threshold from settings. Press logos and review counts are left out until there are real ones to show. |

Keywords carried through the copy, headings and alt text: orthopaedic dog bed, memory foam dog
bed, dog beds for older dogs, large dog beds, low step-in dog bed, waterproof dog bed, washable
dog bed cover, bolster dog bed, dog sofa bed, dog mattress, raised cooling dog bed.

## 4. Colour and type

- Palette: oat background `#FAF6EF`, ink foreground `#17150F`, moss `#1F2E27` for the deep
  sections (mechanism, closing, footer), sand `#E3D7C3` for dividers and chips, terracotta
  `#B4532A` for the one thing that should be pressed on each screen. Warm, natural, and the
  opposite of the white-and-blue pet-shop look the competitors share. Terracotta is used only
  for primary actions so the eye always lands on the next step.
- Type: Fraunces for headings (warm, slightly old-fashioned, reads as a small British maker),
  DM Sans for everything else (clear on phones). Sizes: h1 56, h2 40, h3 32, h4 24, h5 18, h6 14
  uppercase; body 16.
- Shapes: 14px radius on cards and media, pill buttons, 12px inputs. Soft, not toy-like.

## 5. The honesty rules the theme enforces

- No invented reviews, ratings, counts, timers or scarcity. Ratings are off (`Show star
  ratings` in theme settings) until a reviews app is installed and has real reviews.
- Every store-wide promise reads from Theme settings > **PawLunova promises**: trial nights and
  exclusions, guarantee years, delivery threshold and prices, dispatch and transit days, bank
  holidays, the current offer (label, amount, minimum, end date), owner name and contact.
  Turn a promise off and every mention disappears.
- Product-level claims read from metafields (`custom.core_type`, `sleep_style`, `shape`,
  `low_entry`, `has_liner`, `wash_temp`, `non_slip`, `entry_height_cm`, `foam_guarantee`,
  `ships_from`, `dispatch_days_min/max`, `lead_time_days`, `benefits`, `qa`, `worth_it`,
  `subtitle`, `best_for`; per variant `sleep_area`, `suits_breeds`, `suits_weight`). A bed
  without a metafield simply does not make that claim.
- No medical claims. Comfort and support language only.
- UK English throughout, "basket" not "cart", no em dashes in shop copy.

## 6. Owner to-dos before publishing

1. **Photos.** The hero uses the Lingholm sofa photo and the story section a Braithwaite photo
   from your Files. Swap in lifestyle shots of real dogs on the beds as soon as you have them
   (Customize > the section > Image).
2. **Logo.** Theme settings > Logo. The header and footer fall back to the shop name in Fraunces
   until then.
3. **Menus.** The theme expects `lunova-main-menu`, `lunova-footer-shop`, `lunova-footer-help`
   and `lunova-footer-about` (Navigation). If they are named differently, pick yours in the
   header and footer blocks.
4. **Pages.** Make sure these pages exist with the matching template chosen in the page's
   Theme template box: Bed Finder (`page.bed-finder`, handle `bed-finder`), FAQ (`page.faq`),
   About (`page.about`), Contact (`page.contact`), Our story (`our-story`), 100-night trial
   (`100-night-trial`).
5. **The offer.** The theme shows "Cosy Season Saving, £15 off orders over £129 until 31 Oct"
   because that is what is in settings. It does not create the discount. Keep Discounts and the
   settings in step, or turn the offer off in settings.
6. **Metafields.** The more of the list in section 5 each bed has, the more the product page can
   say. The size cards, delivery line and finder all get better with `sleep_area`,
   `suits_breeds`, `suits_weight`, `core_type`, `sleep_style` and `ships_from` filled in.
7. **Reviews.** Install a reviews app, add its blocks to the Honest proof sections, then turn
   `Show star ratings` on.
8. Delete the broken import theme and the zip in Files (section 1).

## 7. For whoever edits the code next

- Validate before uploading: `python3 scripts/theme-dev/validate-templates.py horizon` checks
  every template, section group and `settings_data.json` against the section, block and theme
  setting schemas (range steps, select options, block types, blank or disallowed defaults). All of
  these were things Shopify rejected silently at import. Then run theme-check (`.theme-check.yml`
  is in `horizon/`).
- Templates deliberately omit values equal to the schema default. It keeps them readable and
  under 16KB, which matters because the MCP upload path (`themeFilesUpsert`) is capped at 16KB
  per GraphQL document and drops `variables`.
- Shopify rules learnt the hard way: `url` settings may only default to `/collections` or
  `/collections/all`; a `text` setting cannot default to `""`; range values must sit on the
  step; the theme's `settings_schema.json` failing validation makes every `{{ settings.x }}`
  reference in templates fail too.
- To re-import from scratch: zip the `horizon/` folder, upload it under Content > Files, and
  create a theme from the file's CDN URL (`themeCreate(source:)`), or use `shopify theme push`.
  Shopify would not fetch the GitHub codeload zip ("Src is empty"), so the Files route is the
  one that works from the API. A theme created from a zip is not linked to the Theme Store, so
  Horizon updates will not be offered for it; apply them by hand if you ever want them.
- When uploading single files, send a section before any template that uses a new setting of
  it: Shopify normalises templates on save and silently drops settings its schema does not know
  yet.
- `assets/pl-finder.js` is over 16KB, so it cannot go through the MCP upsert; change it in the
  repo and re-import, or push with the Shopify CLI.
- `pl-` prefixes everything that is PawLunova's: `assets/pl-base.css`, `pl-ui.js` (delivery
  dates, finder memory), `pl-finder.js` (the Bed Finder), sections `sections/pl-*.liquid`,
  blocks `blocks/pl-*.liquid`, snippets `snippets/pl-*.liquid`. Stock Horizon files were
  touched in six places only: `layout/theme.liquid` (loads `pl-head`), `snippets/header-actions`
  (finder button), `snippets/cart-summary` (bars and trust), `snippets/price` and
  `snippets/format-price` (no trailing zeros), and the two product-card blocks (card meta).

## 8. Verification (12 October 2026, theme 208804020566)

Checked in headless Chromium at 390px and 1440px against the live domain with
`preview_theme_id`, after the clean import:

- Home, Bed Finder page, collection, two product pages (a memory foam bed and the dog house,
  which is outside the trial), basket, FAQ, contact, search and the 404 page all return the
  right status with zero `Liquid error` and zero `Translation missing` strings, no horizontal
  overflow, and exactly one H1 each (the search page has none, as in stock Horizon).
- Bed Finder: only one step is visible at a time; answering "head on something", "starting to
  slow down", Medium and "Bella" returns the Coniston in Medium with five reasons, "Bella's bed"
  (apostrophes render correctly), the add button adds the right variant to the basket, the
  basket drawer opens with the item, the free-delivery bar reads "unlocked" and the offer bar
  shows the £15 saving, which the basket also applies. The product page then shows
  "Recommended for Bella: Medium".
- Dark sections (What's inside, closing section, footer) keep readable text; the header's Bed
  Finder button is icon-only on phones so the logo has room.
- Recommendations, "Shop by need" tiles and the Lakes story all load their images.
- Theme-check: 0 errors (10 warnings, all `ValidScopedCSSClass` on shared classes or doc
  params). `validate-templates.py`: 0 errors.
- Two console messages come from stock Horizon, not this theme: on the 404 page its section
  renderer logs "Section ... not found in the section rendering response", and once on the
  contact page "No empty section markup found". Neither affects the page.

Screens from that pass are in `docs/horizon-screens/`.
