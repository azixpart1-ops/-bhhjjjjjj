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
| `node server.mjs` | Mock storefront on http://127.0.0.1:9292 (`--port`, `--empty`, `--real`, `--logged-in`, `--quiet`, `--theme <dir>`) |
| `node check.mjs` | All static and render checks, the headless finder matrix, plus theme-check. Exits 1 on any ERROR (`--no-theme-check`, `--only=json,schema,templates,static,locales,render,finder,theme-check`, `--real`, `--modes=full,empty,real`, `--json`, `--verbose`) |
| `node browser-test.mjs` | Playwright page sweep, purchase flows and the finder matrix. Starts its own server (on `--port`, else a free port) unless you pass `--url` (`--real`, `--all-products`, `--only=pages\|flows\|matrix`, `--no-matrix`, `--pages=home,product`, `--no-a11y`, `--strict-a11y`, `--viewport-only`) |
| `node lib/finder-engine.mjs` | Prints the finder's pick for every answer, headless, on the committed real catalogue (`--full` for the fixture catalogue) |
| `node render.mjs <path>` | Renders one URL to stdout and prints its issues to stderr (`--empty`, `--real`, `--cart`, `--section <id>`, `--out file.html`) |
| `node fixtures/fetch-real.mjs` | Downloads the live catalogue into `.out/real-products.json` (`--offline` copies the snapshot, `--check` prints what the file holds) |
| `npm run test:harness` | Self-tests for the harness's Shopify emulation (Ruby maths, render scoping, paginate, forms, cart rules, schema rules) and the headless finder matrix on the real catalogue (`test/finder-matrix.test.mjs`) |
| `npm test` | Self-tests, then `check.mjs`, then `browser-test.mjs` |

Output lines are meant to be grepped: `ERROR [schema] sections/hero.liquid  message`,
`PASS  flow   finder→basket@390  …`, and a final `SUMMARY … → PASS|FAIL`.

## The mock storefront

- **Pages:** `/`, `/products/:h` (`?variant=`), `/collections` and `/collections/:h` (`sort_by`,
  `filter.v.availability`, `filter.v.price.gte/lte`, `filter.v.option.size|colour`,
  `filter.p.product_type`, `page`), `/cart`, `/search?q=` (with Shopify's field syntax as the
  theme's links use it: `tag:"…"`, `product_type:"…"`, `title:`, `body:`, `vendor:`,
  `variants.title:`, quoted phrases, `OR`, `NOT` / `-term`), `/pages/:h` (honours
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
- **Modes (catalogues):** `full` is the fixture catalogue below; `empty` is the
  zero-products store the theme was first built against (no products, only the `all` and
  `frontpage` collections, Shopify's default menus); `real` is the live catalogue (see
  [Real-catalogue mode](#real-catalogue-mode---real)). `--empty` / `--real` choose the default;
  `?empty=1|0` and `?real=1|0` switch this browser (cookie `theme_dev_mode`, which wins over
  the older `theme_dev_empty`). Every page response says which one rendered in
  `X-Theme-Dev-Mode`. `?login=1` signs in the fixture customer.
- **Carts** are in memory, one per `cart` cookie, for the life of the server.
- **Dev endpoints:** `/__dev/errors` returns recent render issues as JSON. Every rendered
  response carries `X-Theme-Dev-Errors` and `X-Theme-Dev-Warnings` headers. `/__dev/reset`
  clears carts and caches and re-reads the real catalogue file.
  `/__dev/placeholder-img/<name>?width=&height=` serves a neutral SVG that stands in for a
  CDN image when the CDN can't be reached.

## Fixtures (`fixtures/`)

`catalog.mjs` and `store.mjs` hold the fixture catalogue. `fetch-real.mjs` and
`store.mjs` build the real one (see [Real-catalogue mode](#real-catalogue-mode---real)).

`catalog.mjs` holds 14 products. The eleven in `assets/app.js` BEDS keep their names,
handles, prices and "why" copy; Rydal, Wensleydale and the Windermere cooling bed are
added. Variant ladders are S/M/L(/XL), and Colour appears on Buttermere, Harrogate and
Kendal. Langdale Large is tracked with 2 left (low stock). Kendal XL/Stone and all of
Wensleydale are sold out, and Ambleside XL sells on backorder. Two products have
compare-at prices. Tags cover `finder:*`, `best-for:*`, `badge:Most popular` and `guarantee:yes`
(on the eight orthopaedic beds, so the foam guarantee and per-night lines still render).
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

## Real-catalogue mode (`--real`)

The store now has 64 real products, and the theme was built while it had none. Real mode
renders the theme against that catalogue, so every fix can be tested locally against the
products shoppers will actually see.

```sh
node fixtures/fetch-real.mjs           # refresh .out/real-products.json from the live store
node server.mjs --real                 # or ?real=1 on a normal server
node check.mjs --no-theme-check --real # render-sweeps full, empty and real
node browser-test.mjs --real           # sweep, flows and finder matrix on the real catalogue
node browser-test.mjs --real --all-products   # also every real product page at 390px
node render.mjs /products/<handle> --real
```

**Where the data comes from.** `fixtures/fetch-real.mjs` makes read-only storefront GETs
with `curl`, because Node's `fetch` ignores `HTTPS_PROXY`. It reads:

- `/products.json?limit=250`, every page;
- `/products/<handle>.js` for each product, for the image alt text and media ids that
  `products.json` leaves out;
- `/collections/all/products.json`, for Shopify's order of the `all` collection;
- `/collections.json` and each listed collection's products.

The result goes to `.out/real-products.json`, which is gitignored. The file is created on
first use. Refreshing it is up to you: run the script again. If a refresh fails, the existing
file is kept. If there is no file and no network, the snapshot is copied instead
(`REAL_SNAPSHOT`, which defaults to the committed `fixtures/real-catalogue.json`: the live
`/products.json` with its 64 products, kept so real mode and the finder-matrix self-test
work offline and never change under a test). Set `REAL_STORE_ORIGIN` to read from another
store.

**What the fixture builds** (`createStore({ real: true })` in `fixtures/store.mjs`):

- **Products** keep exactly the options (name, position, values), variants (id, title,
  option1–3, sku, prices in pence, compare-at), images (CDN `src`, width, height, alt, media
  id, variant images), tags, `product_type`, vendor, `body_html`, handle and url from the
  live data. Their metafields are empty, because the store has none.
- **Stock:** every variant is tracked (`inventory_management: 'shopify'`, `inventory_policy:
  'deny'`) with `inventory_quantity: 5`, which is what the live store holds today.
- **Collections:** `all` holds every product in the live order (title A–Z) and `frontpage`
  holds its one product, as do any other published collections. Like Shopify,
  `collection.products` and `search.results` give at most 50 items outside `{% paginate %}`,
  while `paginate` and `products_count` see them all. So `collections.all.products` stops at
  50, and the last 14 products (by title) never reach `sections/finder-products`.
- **Menus** are Shopify's defaults (main-menu: Home, Catalog, Contact; footer: Search).
  Pages, blog, policies and the customer stay fixture content.
- **Images:** `image_url` returns the CDN URL with Shopify's params
  (`https://cdn.shopify.com/s/files/…/x.jpg?v=…&width=600`). `image_tag` builds the srcset
  on the CDN. Live Shopify prints `//pawlunova.co.uk/cdn/shop/files/x.jpg?…`, the same file
  on the shop's own domain. The harness keeps `cdn.shopify.com`, which loads through the
  proxy without the storefront's bot check.

**Browser tests in real mode.** Chromium is launched with `--proxy-server=$HTTPS_PROXY`, so
`cdn.shopify.com` loads while the local mock server stays direct. Playwright's own `proxy`
option is not used, because it adds `<-loopback>` and sends localhost through the proxy as
well, which gives 405s. A probe image is loaded first. If the CDN is unreachable, CDN
requests are answered from `/__dev/placeholder-img` and the run reports a WARN. In live mode,
broken CDN images count as failed requests.

The page list is chosen by shape, not by handle, so it follows the catalogue:

- size-only, colour-first (`Colour / Size`) and size-first (`Size / Color`) products;
- breed-labelled sizes (`Medium: Springer Spaniel | …`);
- `One size · …` products;
- a `Default Title` bed;
- the product with the most variants;
- a kennel, the car seat and a crate mat;
- pagination past 50, search page 2, the cart, the finder page and 404.

Screenshots are saved as `.out/shots/real-*.png`, and the results go to
`.out/browser-test-real.json`.

The real flows are:

- the finder from the header to the basket;
- size changes price and `?variant=` on a size-only product;
- **colour + size** on a colour-first product and a size-first `Color` product: pick
  another colour, then a size with a different price, and check that the price,
  `?variant=` and the variant that lands in the basket all match that colour and size;
- drawer quantity and remove;
- quick add from `/collections/all`;
- the collection filter;
- predictive search (the term comes from a real title);
- the mobile menu;
- the sticky add-to-basket bar.

The sold-out step is skipped while nothing is sold out.

**Fidelity.** Checked against the live preview of the draft theme (read-only curl), the
local real-mode output of `/collections/all?section_id=finder-products` is byte-identical
after host normalisation: the same 50 beds, the same order, prices, variants, stock,
alt text and aspect ratios. So are the product page's JSON islands (`data-product-json`,
`finder-config`, `LunovaChromeStrings`) for a colour-first product, a breed-sized product
and a kennel. That comparison found three things the harness now emulates in every mode:

- `| t` HTML-escapes translations whose key doesn't end in `_html` (`'` → `&#39;`);
- `| json` escapes `/` as `\/`;
- `media.id` is the media id, not the image id. `variant.featured_media` is a media drop
  and `variant.featured_image` is an image.

## The finder matrix

### Headless (`check.mjs`, `npm run test:harness`)

`lib/finder-engine.mjs` runs the theme's own `assets/global.js` and `assets/finder.js` in
Node (a `vm` context with an inert DOM), fed by what the harness renders: the inline
`Lunova.settings` script and `#finder-config` from `/pages/bed-finder`, and
`<fallbackUrl>?section_id=finder-products` for every page `finder.js` asks for. So the
Liquid verdicts in the product JSON (`foam`, `trial`, `personalised`), the size hints and the
"Never recommend" rules are the real ones. `lib/finder-matrix.mjs` then calls
`Lunova.finderEngine.recommend` for 3 styles × 3 stages × 5 sizes and fails an answer when:

- there is no bed;
- the main pick or the alternative is a "Never recommend" bed, a `Dog Houses` type, a car
  seat or a crate mat;
- the alternative is the main pick again;
- the chosen size is shorter than the shortest bed for that dog (`Lunova.sizeMin`), a
  one-size bed is made for a dog other than this one or one size up, or a size is more
  than one step up;
- a per-night sum or guarantee line would show on a bed the foam rule doesn't cover, or a
  trial line on a product the trial doesn't cover. Both rules are restated in the test from
  the raw product data (description, type, tags), so the Liquid, the JS and the stated
  rule must all agree, for every product, not only the ones picked;
- a reason line runs two sentences together (`/\.[A-Z]/`);
- curl and lean get the same bed for more than 2 of the 5 sizes at any stage.

`check.mjs` reports these as `[finder]` ERRORs for the fixture catalogue and, with `--real`,
the real one. `test/finder-matrix.test.mjs` runs them on `fixtures/real-catalogue.json`
(64 products: kennels and day beds, the car seat, crate mats, `Label · dims`, `Label: breeds`
and `Extra Large · dims` sizes, 21 `Default Title` beds) and prints the grid.

### In the browser (`browser-test.mjs`)

`browser-test.mjs` runs the matrix in both catalogues (`--only=matrix`, or skip it with
`--no-matrix`). It drives the theme's own finder through every style (curl, lean,
sprawl) × stage (fine, slowing, diagnosed) × size, taking the sizes from `sizeHints` (XS–XL).
It works through `finder.js`'s `lunova:finder:open` event with `step: 'result'`, which is
how the teaser and the editor resume it. It uses the inline finder on `/pages/bed-finder`,
or the modal on `/` if there is no inline finder.

Each answer's main result and alternative are recorded, with handle, title, type, chosen
variant and size line, in `.out/finder-matrix.json` or `.out/finder-matrix-real.json`. A
grid is printed as well.

An answer **FAILS** if:

- it produces no result (an empty or "no fit" state, or a timeout);
- its result or alternative has a `product_type` starting with `Dog Houses`;
- its result or alternative has a title containing `Car Seat`;
- the result shows a per-night sum or the guarantee line for a bed whose `foam` verdict
  (snippets/foam-bed, in the finder's product JSON) is false, or a trial line for one whose
  `trial` verdict is false;
- the result is a personalised bed and its Add button would put it in the basket without
  the name (it must link to the product page instead).

It also fails on visible HTML entities in the result.

Answers whose chosen size is made for a different dog are a **WARN** (`~` in the grid). That
covers a size two or more steps up (XS → "Burnmoor XXL"), a smaller breed-labelled size than
the answer's, or a size word two or more steps down. One size up is the finder's stated
fallback when the dog's own size is missing or sold out, so it is not flagged.

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
  it merges `locales/_parts/*.json` instead. As on Shopify, `| t` HTML-escapes the result
  unless the key ends in `_html`.
- **Shopify list limits:** `collection.products` and `search.results` hold 50 items outside
  `paginate`.

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
5. **render:** every route in each catalogue (full and empty, plus real with `--real`); the
   full and empty cart; the drawer and quick-add Section Rendering for every product; the
   finder's `finder-products` section; predictive search; recommendations; and every section
   preset as a merchant would add it. Every `application/json` or `ld+json` island in the
   output must parse. In real mode a `[real]` group adds observations about the store, for
   example "Only N left" showing on every product page while every variant holds 5.
6. **finder:** the headless finder matrix (see [The finder matrix](#the-finder-matrix)) for
   each catalogue with products.
7. **theme-check:** `@shopify/theme-check-node` runs on a copy of the theme with
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
- failed same-origin requests (and, in real mode, failed CDN images)
- HTML entities shown as text (`Your dog&#39;s name`) in visible text or in aria-label,
  title, alt or placeholder
- horizontal overflow, reported with the offending elements

Each page gets a full-page screenshot in `.out/shots/<page>-<width>.png`. At 390px, axe
reports WCAG 2.2 A/AA violations as WARN, or as FAIL with `--strict-a11y`.

**Flows:**

- finder from the header, answering every step with the dog named "Bella", then the result,
  Add to basket, and the drawer showing the item (no HTML entities as text at any step);
- PDP size change updating the price and `?variant=`, then Add to basket opening the drawer;
- drawer + quantity and remove;
- quick-add from a collection card;
- a collection filter checkbox applying `filter.*`;
- predictive search (on mobile it is opened from the menu drawer);
- the mobile menu closing on Escape with focus returned;
- the sticky add-to-basket bar: shown at first paint while the main Add button is below the
  fold, hidden while it is in view, shown again once scrolled past (and after a jump past it),
  never shown below the fold for a sold-out product (390 and 1440).

**Finder matrix.** See [The finder matrix](#the-finder-matrix).

**Offline limits.** Shopify font files (`/fonts/*`) aren't available and are ignored.
Third-party requests are blocked. Dynamic checkout and Shop Pay buttons are inert stand-ins.

## Known limits

- Theme editor (`request.design_mode`) and `shopify_attributes` output are not emulated.
  Pages always render as the live storefront.
- Each product page uses one recommendation algorithm (shared `finder:` tags).
  Complementary recommendations are always empty.
- Markets, selling plans, discounts, metaobjects and theme blocks (`blocks/`) are minimal.
- A float literal is only typed as a float when it's written in the source (`2.0`).
