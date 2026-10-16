# Files as uploaded to the store's "Yuva (Horizon) – 16 Oct 2026" theme

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
