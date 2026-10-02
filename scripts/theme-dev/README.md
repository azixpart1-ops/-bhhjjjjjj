# Lunova theme dev harness

Renders the Lunova theme (`/theme`) locally the way Shopify would, serves it as a
mock storefront with fixture products, and tests it. The aim is to catch real
Shopify failures before you push: schemas Shopify would silently drop, Liquid
errors, missing snippets, assets or translations, and broken JavaScript flows.

It never writes to `theme/`.

## Setup

```sh
cd scripts/theme-dev
npm install          # liquidjs, @shopify/theme-check-node, axe-core (optional)
```

Playwright comes from the global install (`/opt/node22/lib/node_modules/playwright`),
and Chromium from `/opt/pw-browsers`. Don't run `playwright install`.
`node_modules/` and `.out/` are gitignored.

## Commands

| Command | What it does |
|---|---|
| `node server.mjs` | Mock storefront on http://127.0.0.1:9292 (`--port`, `--empty`, `--logged-in`, `--quiet`, `--theme <dir>`) |
| `node check.mjs` | All static and render checks plus theme-check. Exits 1 on any ERROR (`--no-theme-check`, `--only=json,schema,templates,static,locales,render,theme-check`, `--json`, `--verbose`) |
| `node browser-test.mjs` | Playwright page sweep and purchase flows. Starts its own server unless you pass `--url` (`--only=pages\|flows`, `--pages=home,product`, `--no-a11y`, `--strict-a11y`, `--viewport-only`) |
| `node render.mjs <path>` | Renders one URL to stdout and prints its issues to stderr (`--empty`, `--cart`, `--section <id>`, `--out file.html`) |
| `npm run test:harness` | Self-tests for the harness's Shopify emulation (Ruby maths, render scoping, paginate, forms, cart rules, schema rules) |
| `npm test` | Self-tests, then `check.mjs`, then `browser-test.mjs` |

Output lines are meant to be grepped: `ERROR [schema] sections/hero.liquid  message`,
`PASS  flow   finder→basket@390  …`, and a final `SUMMARY … → PASS|FAIL`.

## The mock storefront

- **Pages:** `/`, `/products/:h` (`?variant=`), `/collections` and `/collections/:h` (`sort_by`,
  `filter.v.availability`, `filter.v.price.gte/lte`, `filter.v.option.size|colour`,
  `filter.p.product_type`, `page`), `/cart`, `/search?q=`, `/pages/:h` (honours
  `template_suffix`, e.g. `page.bed-finder`), `/blogs/journal(/:article)`, `/policies/:h`,
  `/account/*`, `/password`, `/gift_cards/:code`. Anything else renders `404.json` with status 404.
- **AJAX:** `GET /cart.js`; `POST /cart/add.js | change.js | update.js | clear.js`
  (JSON, urlencoded or multipart; honours `sections` and `sections_url`; inventory and sold-out
  errors come back as 422 like Shopify); `GET /products/:h.js`;
  `GET /search/suggest?q=…&section_id=predictive-search`;
  `GET /recommendations/products?product_id=…&section_id=…`.
- **Section Rendering:** `?section_id=<id>` or `?sections=a,b` on any page. An id can be a
  template section (`template--24601__main`), a group section (`sections--NNNNN__header`),
  or a section file name such as `cart-drawer` or `quick-add-product`. File names render in
  the URL's resource context, so `product` is set on `/products/x?section_id=quick-add-product`.
- **Modes:** `?empty=1` switches this browser to the zero-products store (the real store
  today: no products, only the `all` and `frontpage` collections, Shopify's default menus);
  `?empty=0` switches back. `?login=1` signs in the fixture customer.
- **Carts** are in memory, one per `cart` cookie, for the life of the server.
- **Dev endpoints:** `/__dev/errors` returns recent render issues as JSON. Every rendered
  response carries `X-Theme-Dev-Errors` and `X-Theme-Dev-Warnings` headers. `/__dev/reset`
  clears carts and caches.

## Fixtures (`fixtures/`)

`catalog.mjs` holds 14 products. The eleven in `assets/app.js` BEDS keep their names,
handles, prices and "why" copy; Rydal, Wensleydale and the Windermere cooling bed are
added. Variant ladders are S/M/L(/XL), and Colour appears on Buttermere, Harrogate and
Kendal. Langdale Large is tracked with 2 left (low stock). Kendal XL/Stone and all of
Wensleydale are sold out, and Ambleside XL sells on backorder. Two products have
compare-at prices. Tags cover `finder:*`, `best-for:*` and `badge:Most popular`.
Metafields cover `reviews.rating`, `custom.best_for`, `tagline`, `benefits`, `specs`,
`care` and `variant custom.most_chosen`. Images are served from `/assets/img`.

The catalogue also reproduces mess from the live store, as recorded in the README:

- the orthopaedic collection's title is the old SEO title, with its pipes;
- that collection's description opens with its own `<h1>`;
- Borrowdale's only size is a lowercase `l`;
- Rydal runs to `2XL`;
- the cooling bed has no images.

The collections are `all`, `frontpage`, `orthopaedic-dog-beds`, `nest-beds`, `cooling`
and an empty `gifts`. The rest of the fixtures are pages (`about`, `contact`, `faq`,
`bed-finder`, `delivery-returns`), the `journal` blog with 2 articles, the `main-menu`
and `footer` menus, policies, a customer with one order, and a gift card. Ratings in
the fixtures are test data for the rating snippet, not store claims.

## What the renderer emulates (`render.mjs`)

- **Tags:** `section`, `sections`, `render` (isolated scope, `with`/`for`/`as`), and
  `{% render block %}` for app blocks. `include` shares scope and is flagged as deprecated.
  Also `schema`, `style`, `stylesheet` and `javascript`, with the last two compiled into
  `/compiled_assets/*` the way Shopify does. Plus `form` (every type, with hidden inputs,
  `form.errors` and `posted_successfully?`), `paginate` (slices the collection and builds
  the `paginate` object), `layout none`, `content_for` (basic), `doc`, and the standard
  Liquid tags.
- **Filters:** every filter in Shopify's filter list, implemented or passed through with a
  warning. Liquid-only filters that Shopify lacks, such as `group_by`, are reported as
  unknown. Number filters follow Ruby rules: `7 | divided_by: 2` gives `3`, and `7.0` or
  `2.0` gives a float.
- **Errors:** an error renders inline as `Liquid error (file line N): …` and the page keeps
  rendering, as on Shopify. Each error is also recorded with its kind, file and line.
  Recorded kinds are:
  - `liquid-syntax`
  - `liquid-error`
  - `unknown-filter`
  - `missing-snippet`
  - `missing-section`
  - `missing-asset`
  - `missing-translation`
- **Translations:** the renderer uses `locales/en.default.json`. If that file is missing,
  it merges `locales/_parts/*.json` instead.

## What `check.mjs` checks

1. **json:** every JSON file in `theme/` parses.
2. **schema:** every section schema against spec §6. That covers:
   - setting ids and types
   - range maths and range defaults
   - select defaults
   - url and link_list defaults
   - richtext wrapping and inline_richtext
   - no defaults on resource pickers
   - font_picker defaults and video_url `accept`
   - block types and names, `max_blocks`, the 25-character name limit
   - presets and their contents
   - `enabled_on` / `disabled_on`

   The **spec** group adds `color_scheme`, padding, `section-styles`,
   `block.shopify_attributes` and `!important` conventions.
3. **templates and settings:** section types and block types exist; settings values are
   valid against the schema, and unknown keys are warned; `order` and `block_order` are
   consistent; group and template compatibility; the template set required by §7; every
   §5.6 contract setting id with its type and default; `settings_data` values.
4. **static and i18n:** every file parses with liquidjs. Every literal `render`,
   `section`, `sections`, `asset_url` and `| t` reference resolves. Icon names exist in
   `snippets/icon.liquid`. Inline non-JSON `<script>` and deprecated filters are flagged.
   Locale parts are checked for conflicts, for HTML in keys without `_html`, and for being
   assembled and shipped.
5. **render:** every route in both fixture modes; the full and empty cart; the drawer and
   quick-add Section Rendering for every product; predictive search; recommendations; and
   every section preset as a merchant would add it.
6. **theme-check:** `@shopify/theme-check-node` runs on a copy of the theme with
   `en.default.json` assembled from the parts. Its docs are cached in
   `~/.cache/theme-liquid-docs-nodejs`. If the first run can't reach the network, this step
   becomes a WARN.

## What `browser-test.mjs` checks

**Page sweep.** 28 pages (including empty-store pages) at 1440×900 and 390×844. A page
fails on any of:

- an HTTP status other than the expected one
- Liquid errors, read from the response header
- "Liquid error" or "translation missing" text in the page
- JS page errors or console errors
- failed same-origin requests
- horizontal overflow, reported with the offending elements

Each page gets a full-page screenshot in `.out/shots/<page>-<width>.png`. At 390px, axe
reports WCAG 2.2 A/AA violations as WARN, or as FAIL with `--strict-a11y`.

**Flows:**

- finder from the header, answering every step with the dog named "Bella", then the result,
  Add to basket, and the drawer showing the item;
- PDP size change updating the price and `?variant=`, then Add to basket opening the drawer;
- drawer + quantity and remove;
- quick-add from a collection card;
- a collection filter checkbox applying `filter.*`;
- predictive search (on mobile it is opened from the menu drawer);
- the mobile menu closing on Escape with focus returned;
- the sticky add-to-basket bar after scrolling past the button.

**Offline limits.** Shopify font files (`/fonts/*`) aren't available and are ignored.
Third-party requests are blocked. Dynamic checkout and Shop Pay buttons are inert stand-ins.

## Known limits

- Theme editor (`request.design_mode`) and `shopify_attributes` output are not emulated.
  Pages always render as the live storefront.
- Each product page uses one recommendation algorithm (shared `finder:` tags).
  Complementary recommendations are always empty.
- Markets, selling plans, discounts, metaobjects and theme blocks (`blocks/`) are minimal.
- A float literal is only typed as a float when it's written in the source (`2.0`).
