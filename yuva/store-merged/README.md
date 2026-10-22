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
