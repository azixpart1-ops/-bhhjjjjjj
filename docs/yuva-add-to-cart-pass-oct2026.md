# Add to cart on the live Yuva/Horizon theme, 28–29 October 2026

Every way a shopper can add a bed to the basket was clicked in Chromium against the
**published** theme ("LIVE - delivery + apps fixed (23 Oct)", `209757995350`), at 1440×900
and at 390×844 with an iPhone user agent, and the basket read back through `/cart.js` after
each click. The one path that did not behave like the rest of the store was fixed and
uploaded to an unpublished duplicate of the live theme.

**Where it lives.**

> **Add to cart fixes - finder adds to the drawer (28 Oct)** ·
> `gid://shopify/OnlineStoreTheme/210255577430` · unpublished, a duplicate of the live
> theme made on 28 October at 23:58 UTC plus three files: `assets/pln.js`,
> `assets/pln.css`, `sections/pln-bed-finder.liquid`.

Online Store → Themes → that theme → **Preview** to check, **Publish** to ship. Nothing else
on it differs from the live theme. Roll back by publishing the previous theme.

## 1. What was tested on the live theme, and what happened

| Where | What was clicked | Result on the live theme |
|---|---|---|
| Product page, desktop and phone (Coniston, Borrowdale, Hartsop) | The gold **Add to cart** under the size picker | Works. `POST /cart/add.js`, basket 0 → 1 with the chosen size, the cart drawer opens, "Added" is announced, the header count reads 1. |
| Product page, phone | Horizon's **sticky add-to-cart bar** (appears once the main button scrolls away) | Works: it presses the main button for you, the drawer opens. On desktop the bar never appears, which is Horizon's own behaviour when the buy buttons are still in reach. |
| Collection grid, desktop | The card's **Add to cart** (one-size products; `blocks/_pln-card-buy.liquid`) | Works. Adds the card's product, drawer opens. |
| Collection grid, phone and desktop | The card's **Choose size** (multi-size products) | Opens Horizon's quick-add drawer with the size buttons; picking XL and pressing Add to cart puts the XL in the basket and opens the cart drawer. |
| Bed Finder, `/pages/bed-finder` and the homepage | **Add to basket · £99** on the result | **Added the bed, then did a full page load onto `/cart`.** No drawer, no "Added" state, header count still 0 until the reload. On the phone the shopper is thrown off the page they were on. |
| Bed Finder | The size note | Choosing XS for a bed that starts at Small said *"Your size is sold out just now, so we've picked the next size up."* Nothing was sold out: the bed isn't made in XS. |

Also looked at and left alone: Yuva's hidden basket icon on card images (0×0, switched off
by the owner's quick-view settings) and "Buy it now" (Shopify's own accelerated checkout).

## 2. What changed

### `assets/pln.js` (the finder result)

- On the Horizon build the result now renders a real Horizon product form:
  `<product-form-component>` with the hidden `id` input, `<add-to-cart-component>` and a
  submit button, wired with the same `on:submit="/handleSubmit"` and
  `on:click="/handleClick"` attributes as the product page. Horizon's own `product-form.js`
  does the rest, so the finder's add is now identical to every other add on the store: the
  cart drawer opens with the bed in it, the header count updates, "Added ✓" shows on the
  button, and the shopper stays on the page. If Horizon's script has not loaded yet, the
  form posts to `/cart/add` natively and lands on the basket page, which is Horizon's own
  fallback too.
- Detection is `Theme.routes.cart_add_url` (Horizon's `snippets/scripts.liquid` declares
  `Theme` as a top-level `const`, so it is checked as a global binding, not `window.Theme`;
  the first draft checked `window.Theme` and silently fell back to the old path).
- A theme without Horizon's product form (the generic Yuva target of this layer) keeps the
  previous fetch-then-redirect button.
- Size choice: the nearest **larger in-stock** size is taken when the asked-for size is sold
  out or not made; the note says which. New string `sizeNone`:
  *"This bed isn't made in [size], so we've picked the nearest size it comes in."* The
  "sold out" line is only used when that size exists.

### `assets/pln.css`

Eleven lines under the Bed Finder block: the form wrappers are `display: contents` so the
button sits in the action row as before; the theme's error line (`ref="addToCartTextError"`)
takes its own row; the button swaps its label for "Added ✓" while Horizon marks it
`data-added="true"`.

### `sections/pln-bed-finder.liquid`

Two strings added to the JSON island: `sizeNone` and `added`.

## 3. Verified on the preview theme (`?preview_theme_id=210255577430`)

- Homepage, desktop: tap "Curled in a ball" on the first question → finder opens on step 2 →
  Slowing down → M → name "Biscuit" → result "Biscuit's bed", Elterwater Bouclé, Medium,
  £109. The result's `product-form-component` upgrades to Horizon's `ProductFormComponent`
  with `variantId` and `liveRegion` refs. Pressing **Add Biscuit's bed · £109**: the button
  reads "Added ✓", `POST /cart/add.js` with the Medium variant, basket 1, the cart drawer
  opens showing the Elterwater Medium at £109.00, header count 1, URL unchanged.
- `/pages/bed-finder`, phone: Curls up → No concerns → XS → Skip → Windermere Sherpa nest,
  Small, with the new note *"This bed isn't made in XS, so we've picked the nearest size it
  comes in."* Add to basket → basket 1, drawer open, page not reloaded.
- `assets/pln.js` and the other two files match the repo byte for byte (MD5 checked through
  the Admin API after upload). `python3 scripts/lint-shopify.py --root yuva`: 31 sections,
  0 errors, 0 warnings.

## 4. Repo sync

The store had three files that were never committed or had moved on since the 22 October
commits; they are now in the repo exactly as they are on the live theme:
`snippets/pln-cart-promise.liquid` (delivery line in the drawer promises),
`snippets/pln-buybox-promise.liquid` (delivery claim through the new snippet),
`snippets/pln-delivery-claim.liquid` (new: the free-delivery wording in one place) and
`blocks/_pln-card-buy.liquid` (threshold read as a number).

## 5. For the owner

1. **Preview, then publish** the theme above.
2. Three things noticed on the way that are not add-to-cart bugs but contradict each other
   on the same screen, all owner settings or apps rather than theme code:
   - The yellow bar at the top ("£28 away from free shipping", "over £100") comes from an
     app; Settings → Shipping has one UK zone with Standard at £0.00 and no minimum, so
     delivery is free on everything and the theme says so. One of the two is wrong.
   - The product page's "Delivery & returns" row still says *"free on orders over £40
     (£4.99 below)"*. Same contradiction, in the tab copy.
   - "Only 5 left" under every size comes from the Section Shop stock-urgency app block,
     with a placeholder count on every variant. The October audit rated invented urgency
     a P0; the block can be removed from the product template in the editor.
