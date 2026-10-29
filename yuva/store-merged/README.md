# Files as uploaded to the store's Yuva (Horizon) themes

The store's "Yuva" theme is a Horizon-based build, so its product and
collection templates keep Horizon's own `product-information` and
`main-collection` sections. These are the merged versions that were uploaded
on 16 Oct 2026 (the generic `yuva/templates/*.json` target a real Yuva theme).

`templates/product.json` here already carries the three follow-up fixes that
could not be pushed once the theme went live: the PL: Why this bed section's
"Emit Product structured data" is off (Horizon emits ProductGroup and
BreadcrumbList itself). The other two fixes are `yuva/sections/pln-page-body.liquid`
(new "Title level" setting) and `yuva/templates/page.faq.json` (body title at H2).

To apply them to the live theme: Online Store → Themes → Edit code, open each
of the three files and paste the repo version over it. Or duplicate the theme
and ask for the three files to be uploaded to the copy.

## 22 October 2026: product page pass

`templates/product.json` is now the version uploaded to the unpublished copy
**PDP enhancements - size help, Q&A, tidy buy box (22 Oct 2026)**
(`gid://shopify/OnlineStoreTheme/209684463958`), duplicated from the live theme
"PDP bug fixes - JS, reveal, copy (20 Oct 2026)". It adds the Custom Liquid blocks
`{% render 'pln-size-fit', product: product %}` (after the variant picker) and
`{% render 'pln-worth-it', product: product %}` (under the payment logos), the
`pln-pdp-qa` section, and drops Yuva's quantity, stock-count and "Specifications"
blocks, the demo "Explore More" tab, and the Side by side and After you order
sections. The only settings change on that theme is
`currency_code_enabled_product_pages: false`. Full account:
`docs/yuva-pdp-pass-oct2026.md`.

The "title level" fixes above (`pln-page-body.liquid`, `page.faq.json`) are still
pending on the store.

## 28 October 2026: add to cart pass

The published theme is now **LIVE - delivery + apps fixed (23 Oct)**
(`gid://shopify/OnlineStoreTheme/209757995350`). Every add-to-cart path on it was
clicked and read back (`docs/yuva-add-to-cart-pass-oct2026.md`); the Bed Finder's
add was the one that bypassed the cart drawer and reloaded onto `/cart`. The fix
(`assets/pln.js`, `assets/pln.css`, `sections/pln-bed-finder.liquid`) is uploaded to
the unpublished duplicate **Add to cart fixes - finder adds to the drawer (28 Oct)**
(`gid://shopify/OnlineStoreTheme/210255577430`). `snippets/pln-cart-promise.liquid`,
`snippets/pln-buybox-promise.liquid`, `snippets/pln-delivery-claim.liquid` and
`blocks/_pln-card-buy.liquid` were copied back from the live theme, which had moved
on since the 22 October commits.

## 22 October 2026: premium design pass

`config/settings_data.json`, `sections/header-group.json`, `sections/footer-group.json`,
`layout/theme.liquid` and `templates/index.json` are the versions uploaded for the
premium design pass (`docs/yuva-premium-pass-oct2026.md`): Playfair Display over DM
Sans, bone page, quiet header, one-line announcement, oat footer, the hero's new
"cover" layout, `assets/pln-premium.css` loaded from the layout. The owner published
the first upload (theme 209699242326); the finished version with the three follow-up
files is the unpublished "Premium pass v2" theme (209701699926).

## 29 October 2026: 10% offer line under the price

The owner published the 28 October theme, so **Add to cart fixes - finder adds to the
drawer (28 Oct)** (`gid://shopify/OnlineStoreTheme/210255577430`) is now live. Its
`templates/product.json` had moved on again in the editor (app blocks for tabs, stars,
stock chip, quantity breaks and product icons added to the buy column; the
`pln-buybox-promise` and TrustShop blocks removed; media on the right). The repo copies of
`templates/product.json` and `config/settings_data.json` are now that live version plus
this pass: a Custom Liquid block `{% render 'pln-offer-line', product: product %}` directly
after the Price block, and `pln_offer_type: percent`, `pln_offer_percent: 10`,
`pln_offer_min: 0` in the settings. The first duplicate, **10% offer line under the price
(29 Oct)** (`gid://shopify/OnlineStoreTheme/210333565270`), was published from the admin while
the upload was in progress, so it is now the live theme and carries `assets/pln-pdp.css`,
`snippets/pln-offer-line.liquid`, `sections/pln-offer-band.liquid` and the live
`config/settings_schema.json` with the updated PawLunova promises group, but not the template
or settings (the API refuses writes to a published theme). Those two are on the second
duplicate, **10% offer line v2 - PUBLISH after creating the 10% discount (29 Oct)**
(`gid://shopify/OnlineStoreTheme/210334908758`), which is the theme to preview and publish.
Full account: `docs/yuva-offer-pass-oct2026.md`.
