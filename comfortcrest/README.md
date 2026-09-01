# ComfortCrest — Shopify theme

A rebuild of Shopify's **Horizon** theme for ComfortCrest, a UK bed company.

The store is `comfortcrest.co.uk`. Work is deployed to an **unpublished draft
theme** so nothing here can break the live storefront:

| | |
|---|---|
| Draft theme | `ComfortCrest — Premium (draft)` |
| Theme ID | `206992048459` |
| Preview | `https://comfortcrest.co.uk/?preview_theme_id=206992048459` |

> The preview link only works once Shopify has set a session cookie. Use
> `scripts/preview.sh` — an anonymous request silently returns the **live**
> theme, which looks exactly like "my changes did not deploy".

## What is here

```
theme/
  assets/      cc-core.css (tokens, primitives), cc-components.css, cc-app.js
  snippets/    cc-assets, cc-icon, cc-price, cc-stars, cc-product-card
  sections/    cc-*.liquid — 17 ComfortCrest sections + header/footer groups
  blocks/      cc-*.liquid — product-page blocks for Horizon's buy column
  config/      settings_data.json — brand palette and type scale
  templates/   index / product / collection
scripts/
  lint-shopify.py    pre-deploy checks (see "Deploying")
  preview.sh         fetch a page from the draft theme
  stage-uploads.py   push files to Shopify staged uploads
```

## Design system

Three rules the CSS keeps to, and the reason the site reads as premium
without any photography loaded:

1. **Colour is ink, brass and warm paper.** Anything else has to earn it.
2. **Corners are near-sharp (2px).** Furniture retail is not a phone app.
3. **Depth comes from hairline rules and paper tone**, not drop shadows.

| Token | Value | Role |
|---|---|---|
| `--cc-ink` | `#171C22` | Headings, dark grounds |
| `--cc-brass` | `#A97F4B` | The single accent |
| `--cc-alabaster` | `#FAF7F2` | Page ground |
| `--cc-linen` | `#F2ECE2` | Alternate section ground |
| `--cc-stone` | `#E3DBCE` | Hairline rules |
| `--cc-claret` | `#8C2F39` | Sale and urgency — deep, never garish |

Type: **Playfair Display** for display, **DM Sans** for body, **Jost** for the
letterspaced small-caps labels. All three are served from Shopify's font CDN.

## Sections, and why each exists

The homepage is ordered as a funnel, not a list. Every section is removable
and reorderable in the theme editor.

| Order | Section | Job |
|---|---|---|
| 1 | `cc-hero` | The hook. Falls back to a promises panel when no photo is set. |
| 2 | `cc-trust` | Answers "are this lot legitimate?" immediately. |
| 3 | `cc-categories` | Most bed shoppers know the *format* they want first. |
| 4 | `cc-products` | Best sellers — social proof plus product. |
| 5 | `cc-feature` | Ottoman storage: the highest-margin category, argued properly. |
| 6 | `cc-finder` | Captures the undecided into a filtered collection. |
| 7 | `cc-craft` | Justifies the price. The one dark block on the page. |
| 8 | `cc-swatches` | Fabric range plus the free-samples hook. |
| 9 | `cc-reviews` | Social proof. **Merchant-supplied — ships empty.** |
| 10 | `cc-products` | Second product exposure, after trust is built. |
| 11 | `cc-sizes` | UK bed sizes. Cuts returns and earns the search. |
| 12 | `cc-finance` | Removes the price objection. |
| 13 | `cc-delivery` | Removes the logistics objection. |
| 14 | `cc-faq` | Everything else, with FAQPage structured data. |
| 15 | `cc-newsletter` | Final capture, framed around samples. |

## Honesty rules built into the theme

These are enforced in code, not left to discipline:

- `cc-stars` renders **nothing** without a real rating. A bed with no reviews
  never shows five hollow stars.
- `cc-reviews` ships with **no quotes and no score**. The score panel hides
  itself until you enter a figure. Put real reviews in, or leave it out.
- `cc-price` shows a saving only when `compare_at_price` is genuinely higher.
- `cc-finance` computes its monthly figure from a price and term you set, so
  the number on the page always matches the terms you actually offer. Provider
  marks are blocks — list only what is live at your checkout.
- `cc-delivery-eta` shows the made-to-order line instead of a date when the
  variant is unavailable.

## Deploying

There is no Shopify CLI or admin token in this environment; the only write
path is the Admin GraphQL `themeFilesUpsert` mutation. Inlining 240KB of
Liquid into a mutation body is slow and easy to corrupt, so files go through
staged uploads instead:

```bash
python3 scripts/lint-shopify.py --root theme     # always, before anything
scripts/stage-uploads.py --print-input           # -> stagedUploadsCreate input
# run stagedUploadsCreate, save the response, then:
scripts/stage-uploads.py <staged-response.json> --theme-id gid://shopify/OnlineStoreTheme/206992048459
# -> themeFilesUpsert variables, using body {type: URL}
scripts/preview.sh /                             # verify
```

**Upload sections and blocks before the templates that reference them.** A
template naming a section that does not exist is rejected whole.

### Two failures worth remembering

Both cost a deploy, and both are now caught by the linter or documented here.

1. **`{% render 'x', arg: value | filter %}` is not valid Liquid.** Shopify
   accepts the upload, then drops the file — the section simply stops
   existing, and the only symptom is a template silently keeping its previous
   version. Three files were lost to this. `check_render_filters` in
   `lint-shopify.py` now fails the build on it.

2. **`body: {type: URL}` swallows validation errors.** `themeFilesUpsert`
   returns `userErrors: []` and an empty `upsertedThemeFiles`, and the file is
   simply not written. The same upload with `body: {type: TEXT}` returns the
   real message — `Setting 'gap' can't be greater than 48`. When a file will
   not land and you cannot see why, re-send that one file as TEXT to get the
   error.

## Still to do

- **Photography.** Every image slot is wired with correct crops, `sizes`
  attributes and alt text. Sections with no image fall back to a designed
  paper panel rather than a grey box, so the site is presentable now and
  improves the moment real photographs are added.
- **Reviews.** `cc-reviews` is deliberately empty.
- **Footer legal line.** The registration line is a placeholder. Replace the
  company number, VAT number and registered address before going live.
- **Catalogue.** Collections are smart collections driven by tags:
  `ottoman-storage`, `bed-frame`, `divan`, `tv-bed`, `headboard`, `mattress`,
  `bestseller`, `new`. Tag a product and it appears in the right places
  automatically.
