# Yuva (Horizon): a Yuva-style theme built on Shopify Horizon

`yuva/` is a complete Shopify theme. It looks, feels and is customised like **Yuva**
(Shine Dezign, v13, the "Yuva" preset, demo: yuva-theme-amaze.myshopify.com), and it is built
natively on **Shopify Horizon 4.3.0**: Horizon's sections, theme blocks, settings and
JavaScript components, with a Yuva layer on top. Every new file starts with `yv-`, so the Yuva
layer is easy to tell apart from Horizon.

## Install it

**Upload a zip.** Run the packaging script, then in Shopify admin go to Online Store > Themes >
Add theme > Upload zip file.

```sh
scripts/package-yuva.sh            # writes dist/yuva-horizon-<version>.zip
```

**Or push with Shopify CLI** (as an unpublished theme you can preview first):

```sh
shopify theme push --path yuva --unpublished
```

## Licence and originality

Horizon's licence allows a theme derived from it to be used on your own store. It cannot be
resold, listed or redistributed. Nothing from Yuva itself is copied: the Liquid, CSS and
JavaScript are written from scratch to match Yuva's measured design and documented options, and
no Yuva demo images are included (image settings start empty and show placeholders).

## What you get

- **Every Yuva section**, from the official Yuva documentation (announcement bar to newsletter
  popup) plus the newer sections only seen on the v13 demos (split banner, image banner with a
  product strip, media grid with hotspots, images carousel, offer banner, spotlight, scrolling
  text). See the section catalogue below.
- **Yuva's options.** Section settings use Yuva's own wording and choices: colour sets
  (Primary, Secondary, Tertiary, Quaternary, Gradient), section visibility (all devices, small
  only, large only), separate desktop and mobile spacing, section borders, headings with a
  highlight font and highlight gradient on bold words, rotating heading words, and button sizes
  per device.
- **Yuva's look.** Manrope headings, Inter body text, pill buttons with the "criss-cross" hover
  fill, 30px inputs, rounded media, soft grey section bands, Yuva product cards (square image
  box, vendor line, "From" prices, colour dots, badges, hover image), a transparent glass header
  over the home hero, a dark four-column footer.
- **Yuva's theme settings**, regrouped into Yuva's order: colours and colour sets, typography,
  layout, animation, buttons, images, social media, search, cart drawer (free-shipping bar,
  note, gift wrap, upsells), breadcrumbs, product, product grid, badges, quick view, swatches,
  newsletter popup, age verification, cookie banner, SEO, stickers, scroll to top, Google Maps.
  Horizon settings Yuva doesn't need are hidden, not removed, so Horizon code keeps working.
- **Five style presets** in Theme settings > Theme style: **Yuva** (the default), **Woofy**,
  **Amaze**, **Burn** and **Petal**, each with the fonts, colours and radii of that Yuva demo.
- **Ready-made pages** (assign them in each page's "Theme template"): `about`, `contact`
  (form and map), `faq`, `lookbook`, `events`, `compare`, `timeline`, `stores`, and
  `section-library` / `section-library-2`, which hold every Yuva section once so you can see,
  copy and restyle any of them.
- **Translations** of every new storefront string into all the languages Horizon ships.

## After installing: a short setup list

1. **Logo.** Upload a logo, and a white "inverse" logo for the transparent home header
   (Theme settings > Logo and favicon).
2. **Menus.** Main menu for the header; pick link lists for the header's browse links
   ("Smart Tech / Earbuds / Accessories") and quick links ("All Categories", "Shipping &
   Return"), and for the footer columns. A footer column with no menu stays hidden.
3. **Mega menus.** In the header section, add a mega menu block (products & gallery, tabs or
   product list) and type the top-level menu item it belongs to.
4. **Social links** in Theme settings > Social media. The top bar, footer and drawer show icons
   only for the links you fill in.
5. **Collections and images** in each homepage section. Sections that list products use the
   "all" collection until you choose one.
6. **Google Maps API key** (Theme settings > Google Maps) for the interactive map and store
   locator; without it the Map section shows a basic embed.
7. **Popups.** The newsletter popup, age verification and cookie banner are off by default;
   turn them on in Theme settings.

## Section catalogue

59 Yuva sections, grouped as they appear in the theme editor's "Add section" list.

### Banners

| Section | Presets | Blocks |
|---|---|---|
| **Collage**<br>`sections/yv-collage.liquid` | Collage, Mosaic collage, Three image collage | Image |
| **Image banner**<br>`sections/yv-image-banner.liquid` | Image banner, Image banner, centered | Product strip |
| **Page banner**<br>`sections/yv-page-banner.liquid` | Page banner | – |
| **Slideshow**<br>`sections/yv-slideshow.liquid` | Slideshow, Fade slideshow, Single slide banner | Slide |
| **Split banner**<br>`sections/yv-split-banner.liquid` | Split banner, Split banner, centered | Panel |
| **Split slideshow**<br>`sections/yv-split-slideshow.liquid` | Split slideshow | Slide |

### Collections

| Section | Presets | Blocks |
|---|---|---|
| **Collection carousel**<br>`sections/yv-collection-carousel.liquid` | Collection carousel, Collection slider | Collection |
| **Collection list**<br>`sections/yv-collection-list.liquid` | Collection list, Collection circles | Collection |
| **Collection tabs**<br>`sections/yv-collection-tabs.liquid` | Collection tabs, Collection product grid, Product tabs, Product carousel | Collection |
| **Color based collections**<br>`sections/yv-color-based-collections.liquid` | Color based collections, Shop by color | Collection |
| **Featured collection**<br>`sections/yv-featured-collection.liquid` | Featured collection, New arrival split, Collection banner | – |
| **Featured collections list**<br>`sections/yv-featured-collections-list.liquid` | Featured collections list | Collection |

### Forms

| Section | Presets | Blocks |
|---|---|---|
| **Contact form**<br>`sections/yv-contact-form.liquid` | Contact form | Contact detail |
| **Newsletter**<br>`sections/yv-newsletter.liquid` | Newsletter | – |

### Layout

| Section | Presets | Blocks |
|---|---|---|
| **Breadcrumbs**<br>`sections/yv-breadcrumbs.liquid` | Breadcrumbs | – |
| **Spacer**<br>`sections/yv-spacer.liquid` | Spacer, Divider line | – |
| **Yuva footer**<br>`sections/yv-footer.liquid` (header/footer group) | Yuva footer | Menu, Text, Newsletter, Apps |

### Media

| Section | Presets | Blocks |
|---|---|---|
| **Before/after image**<br>`sections/yv-before-after.liquid` | Before/after image, Before/after full width | – |
| **Gallery carousel**<br>`sections/yv-gallery-carousel.liquid` | Gallery carousel, Circle gallery, Category tiles | Image |
| **Image gallery**<br>`sections/yv-image-gallery.liquid` | Image gallery, Image gallery grid | Image |
| **Images carousel**<br>`sections/yv-images-carousel.liquid` | Images carousel | Slide |
| **Images grid**<br>`sections/yv-images-grid.liquid` | Images grid | Image |
| **Map**<br>`sections/yv-map.liquid` | Map, Map, no content | Subheading, Heading, Text, Button |
| **Media banner**<br>`sections/yv-media-banner.liquid` | Media banner, Full screen banner | – |
| **Media grid**<br>`sections/yv-media-grid.liquid` | Media grid, Media grid with cards | Media, Text, Media with text |
| **Spotlight**<br>`sections/yv-spotlight.liquid` | Spotlight | Hotspot |
| **Tabbed collage**<br>`sections/yv-tabbed-collage.liquid` | Tabbed collage, Tabbed collage: hover, Tabbed collage: accordion | Media, Product |
| **Video banner**<br>`sections/yv-video-banner.liquid` | Video banner, Boxed video banner, Video with play button, Sticky video banner | – |

### Other

| Section | Presets | Blocks |
|---|---|---|
| **Custom liquid**<br>`sections/yv-custom-liquid.liquid` | Custom liquid | – |

### Products

| Section | Presets | Blocks |
|---|---|---|
| **Featured product**<br>`sections/yv-featured-product.liquid` | Featured product | Title, Text, Review stars, SKU, Price, Variant picker, Quantity selector, Buy buttons, Social sharing, Custom Liquid, Short videos, Countdown, Inventory status, Apps |
| **Lookbook**<br>`sections/yv-lookbook.liquid` | Lookbook, Lookbook: carousel, Lookbook: products only | Look |
| **Product comparison grid**<br>`sections/yv-product-comparison.liquid` | Product comparison grid | Compare product |
| **Recently viewed products**<br>`sections/yv-recently-viewed.liquid` | Recently viewed products | – |
| **Shop the look**<br>`sections/yv-shop-the-look.liquid` | Shop the look | Look, Media with text |

### Promotional

| Section | Presets | Blocks |
|---|---|---|
| **Announcement bar**<br>`sections/yv-announcement-bar.liquid` (header/footer group) | Announcement bar | Announcement |
| **Countdown with images**<br>`sections/yv-countdown-with-images.liquid` | Countdown with images, Countdown, two images | – |
| **Offer banner**<br>`sections/yv-offer-banner.liquid` | Offer banner | – |
| **Promotional banner**<br>`sections/yv-promotional-banner.liquid` | Promotional banner, Promo banner with deal | Counter |
| **Sidebar offer**<br>`sections/yv-sidebar-offer.liquid` (header/footer group) | Sidebar offer | Offer |

### Social

| Section | Presets | Blocks |
|---|---|---|
| **Social media gallery**<br>`sections/yv-social-media-gallery.liquid` | Social media gallery | Image |

### Storytelling

| Section | Presets | Blocks |
|---|---|---|
| **Events calendar**<br>`sections/yv-events-calendar.liquid` | Events calendar | Event |
| **Featured posts**<br>`sections/yv-featured-posts.liquid` | Featured posts, Featured posts overlay | Post |
| **Image with text**<br>`sections/yv-image-with-text.liquid` | Image with text, Image with text (full) | Heading, Icon with text, Text, Stat box, Button |
| **Multi images with text**<br>`sections/yv-multi-images-with-text.liquid` | Multi images with text | Heading, Text, Button |
| **Testimonials**<br>`sections/yv-testimonials.liquid` | Testimonials, Testimonial cards | Quote |
| **Timeline**<br>`sections/yv-timeline.liquid` | Timeline | Timeline item |

### Text

| Section | Presets | Blocks |
|---|---|---|
| **Collapsible content**<br>`sections/yv-collapsible-content.liquid` | Collapsible content, FAQ with heading | Collapsible row |
| **Multicolumn**<br>`sections/yv-multicolumn.liquid` | Multicolumn | Column |
| **News ticker**<br>`sections/yv-news-ticker.liquid` | News ticker, News ticker, outline, News ticker, dark, News ticker, two rows | – |
| **Rich text**<br>`sections/yv-rich-text.liquid` | Rich text, Rotating heading, Statement heading, Rich text with page | Text, Page, Button |
| **Scrolling text**<br>`sections/yv-scrolling-text.liquid` | Scrolling text, Scrolling pills, Outline marquee, Logo ticker | Text, Image |
| **Text with icons**<br>`sections/yv-text-with-icons.liquid` | Text with icons, Services, bordered cards, Services, grey cards, Services, dark cards | Column |

### Theme pieces (added by the theme, not from "Add section")

| Section | Presets | Blocks |
|---|---|---|
| **Card pickup (rendering)**<br>`sections/yv-card-pickup.liquid` | – | – |
| **Cart upsells (rendering)**<br>`sections/yv-cart-upsells.liquid` | – | – |
| **Mobile dock**<br>`sections/yv-mobile-dock.liquid` | – | – |
| **Newsletter popup**<br>`sections/yv-newsletter-popup.liquid` | – | – |
| **Recently viewed card**<br>`sections/yv-recently-viewed-item.liquid` | – | – |
| **Side drawer content**<br>`sections/yv-side-drawer.liquid` | – | Collection list, Product list, Media with text |
| **Store locator**<br>`sections/yv-store-locator.liquid` | – | Store |

### Header, product page and store pages

These keep Horizon's own sections (so variant handling, filters, the cart and search work exactly as in Horizon) and gain Yuva blocks and styling.

- **Header** (`sections/header.liquid`): Yuva's transparent glass header over the home hero, top bar with browse links, quick links and social icons, and Yuva mega menus as header blocks: Mega: products & gallery, Mega: collection tabs, Mega: product list, Mega: submenu & products, Menu badge.
- **Product page blocks** (add them inside the product information section, or a Featured product section): Complementary Products, Inventory status, Countdown, Icons, Product meta, Product sign up, Product tabs, Title, Product variations, Quantity selector, Query form, Short videos, Size chart, Social sharing.
- **Collection, search, cart, blog, article, 404 and password pages**: Yuva product cards (vendor, "From" prices, colour dots, badges, hover image), filter counts, breadcrumbs, the category strip above collections, and the services strip under the cart.
- **Overlays**: cart drawer with free-shipping bar, note, gift wrap and upsells; quick view; newsletter popup; age verification; cookie banner; side drawer; mobile dock; scroll-to-top.

## For developers

- **Layout of the Yuva layer.** Shared design tokens and utilities are in
  `assets/yv-base.css`; component styles and the product-card look in
  `assets/yv-components.css`; per-section styles in each section's `{% stylesheet %}`.
  Shared Liquid pieces are `snippets/yv-*.liquid` (colour sets, headings, buttons, icons,
  social icons, newsletter form, carousel controls, countdown, hotspot, product list card…).
  Interactive pieces are ES modules in `assets/yv-*.js` built on Horizon's `Component` class.
- **Horizon files that were edited** carry a `yv:` comment at each change. The product page,
  collection page, cart, search, blog and article keep Horizon's sections and gain Yuva blocks
  and styling, so Horizon's variant handling, filters and cart logic are unchanged.
- **Translations.** Every Yuva label is a `t:yv.…` key. The keys live in a `yv` subtree of each
  locale file, so Horizon's own keys and comments are untouched. Shopify allows 3,400 translations
  per locale file; the editor (`*.schema.json`) files hold about 3,100, so keep new setting labels
  lean or reuse existing keys.
- **Local preview and checks.** `scripts/theme-dev` renders the theme as a mock storefront:
  `node scripts/theme-dev/server.mjs --theme yuva` (then open http://127.0.0.1:9292), and
  `node scripts/theme-dev/render.mjs <path> --theme yuva` prints render errors for one URL.
  Shopify's theme-check runs through `@shopify/theme-check-node` in the same folder.

## Known differences from Yuva

Everything in Yuva's documentation and on the Yuva demo is built. These are the places where the
theme behaves differently from the demo, and why.

**Content you add yourself**

- **No demo photos or products.** Image settings start empty and show Shopify's placeholders.
  Sections that list products use the "all" collection or show placeholder cards until you pick
  a collection. Hotspots without a product show a placeholder card on desktop only. While a
  banner, slide or collage tile still shows a placeholder, it gets at least a 30% dark overlay so
  its white text stays readable; once you choose an image, the section's own overlay setting
  applies.
- **Social links are blank.** The top bar, the menu drawer and the footer's newsletter column show
  their social icons once you fill in Theme settings > Social media. (Pre-filling them would link
  your store to someone else's accounts.)
- **Footer "Most Purchase" column** uses the `footer` menu, so it repeats the Collections links
  until you choose a menu of best-selling products for it.
- **Mega menus** only take over a top-level menu item once the mega menu block has content
  (collections, images or products). Until then the item works as a normal link.

**Built differently from Yuva**

- **Product page.** It keeps Horizon's product section, so variant handling, media, pickup
  availability and the cart behave exactly as in Horizon. The Yuva blocks and look are added on
  top. The sticky add-to-cart bar shows the chosen variant's name rather than Yuva's per-option
  pills, and the "Product meta" tab joins the product tabs with JavaScript (without JavaScript it
  stays an accordion row).
- **Section library** is split over two pages (`section-library` and `section-library-2`), because
  Shopify renders at most 25 sections per template. The header and footer group sections and the
  site-wide pieces (store locator, side drawer, newsletter popup, mobile dock) are not in it; you
  edit those from any page.
- **Tablet header (750–989px)** uses Horizon's drawer layout: one row with the menu button, the
  logo in the centre and the icons on the right, as Yuva does.
- **Video banner headings** use rich text (so highlight words work). Shopify's inline rich text has
  no manual line breaks, so long headings wrap on their own. The offer banner heading uses
  no-break spaces to keep Yuva's two-line split.
- **Google Maps.** With an API key, the Map section and the store locator use Google's classic map
  marker (Google has deprecated it in favour of "advanced markers", which need a Map ID, but it
  still works). Without a key, the Map section shows a basic embedded map.
- **Small measured differences.** The image overlay preset is 80% (Yuva measures 82%; Shopify's
  setting moves in steps of 5). The scroll-to-top button gets its white disc only over the dark
  footer.

**Checked locally, not on a live store**

The theme was checked in a local mock of Shopify's storefront (`scripts/theme-dev`), with
Shopify's theme-check, in a real browser at 390, 750, 800, 990, 1200 and 1440px wide. That mock
has limits: it serves no web fonts, it cannot reach Google Maps, and it draws Horizon's
placeholder product cards blank. Preview the theme on your store before publishing it: open the
theme editor on the home page, a product, a collection, the cart and each page template.
