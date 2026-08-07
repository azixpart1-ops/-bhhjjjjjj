# Product pages — comfortcrest.co.uk

Built from the live catalogue (8 products, pulled from `/products.json`).
Everything in this file is either a theme change already committed, or content
for you to paste into Shopify admin — I have no write access to the store, so
the admin steps are yours.

---

## 1. One product page, no assignment needed

There is a single authored product template: `templates/product.json`. It is the
default, so every product uses it unless something says otherwise — no dropdown
to set, nothing to remember when you add a product.

It adapts to the product instead of you maintaining variants of it. The
"In the box" line is worked out from the product's type and title:

| Product | Reads as | In the box |
| --- | --- | --- |
| The Pimlico (Divan Bed Base) | base | "the divan base and its fittings only — **no mattress and no headboard**" |
| The Kensington (Divan Bed Set) | set | "divan base, cushioned headboard and mattress — everything in one delivery" |
| The Marlow (Bed with Mattress) | mattress | "bed frame, headboard and the mattress" |
| Ashford / Nightingale / Ellery (mattress in title) | mattress | "bed frame, headboard and the mattress" |
| The Mayfair, The Hampstead | frame | "bed frame, headboard and all fittings" |

All eight of your products classify correctly, and it yields to an explicit
denial — a title saying "mattress not included" reads as a frame. The four
wordings are editable in the theme editor under the block's settings.

**The legacy template names still exist** (`product.d1.json`,
`product.d1 copy N.json`, `product.smi-backup.json`, `product.smi-humi-*.json`)
and now all contain that same one design. They are duplicates on disk, not a
second design to maintain: a product assigned to any of them gets the identical
page, and nothing 404s because a template went missing. If you confirm in admin
that no product references them, they can be deleted.

## 2. Rewrite the two supplier listings

Six of your eight listings are written in a consistent house voice. Two are raw
supplier text, and both leak a rival brand into your own product page.

### 2a. "Ottoman Bed Frame King Size Storage Bed With Mattress Pocket Sprung & Memory Foam"

Problems: the title says King but the product sells Single, Double and King; the
body says "This **double** ottoman storage bed"; the spec block credits
**Brand: Home Treats**; and it publishes **"Guarantee - 3 months"**, which
contradicts every other page on your site.

**New title**
```
The Ashford | Grey Linen Ottoman Storage Bed with Pocket Sprung Mattress
```

**New handle** — `the-ashford-grey-linen-ottoman-storage-bed`
(set up a 301 from the old handle, see §4)

**New description**
```html
<p>The bed that finally swallows the winter duvet.</p>

<p>The Ashford is upholstered in a soft grey hopsack linen — a quiet, textured
finish that sits happily against almost any wall colour and shrugs off marks and
splashes. Behind the padded headboard, sides and base sits a centre-supported
frame on strong sprung wooden slats.</p>

<p>Then it opens. A hydraulic dual-lift mechanism raises the base with almost no
effort and holds it there, revealing a storage compartment that runs the
footprint of the bed. The base is lined in fabric, so bedding and clothes come
back out dust-free rather than fluffy.</p>

<p>The mattress comes with it: a 16 cm hybrid with up to 620 independent pocket
springs under a 2 cm, 400 GSM memory foam top layer, so weight is absorbed where
you put it rather than transmitted across the bed. The cover is breathable,
hypoallergenic and treated against mites and dust. Medium firm, which suits back,
side and front sleepers alike.</p>

<h3>Why you'll love it</h3>
<ul>
  <li><strong>Storage across the whole footprint:</strong> gas-assisted dual lift,
      with a fabric-lined base to keep everything clean</li>
  <li><strong>Mattress included:</strong> 16 cm hybrid, up to 620 pocket springs
      plus a 400 GSM memory foam layer</li>
  <li><strong>Grey hopsack linen:</strong> hardwearing, mark and water resistant</li>
  <li><strong>Padded throughout:</strong> headboard, base and sides, on sprung
      wooden slats with a centre support beam</li>
  <li><strong>Medium firm:</strong> hypoallergenic, anti-mite and anti-dust cover</li>
</ul>

<h3>In the box</h3>
<p>Ottoman bed frame, headboard and mattress, flat-packed with all fittings and
assembly instructions.</p>
```

### 2b. "Ottoman Bed Gas Lift Storage Leather Grey 3ft Single with 1 Mattress Pine Wood Bedroom"

Problems, in order of severity:

1. The description opens **"Kosy Koala presents this…"** and the spec block reads
   **Brand: Kosy Koala**. You are advertising a competitor on your own product page.
2. The "features and benefits" section is **copy from a different product** — it
   describes a children's bunk bed: *"Ottoman Beds for kids… The ladder can be
   positioned on either side of the bed."* There is no ladder.
3. Three different sets of dimensions appear: `202×90×85`, `205×98×85`, and
   `H 85 × L 205 × W 98`.
4. It says **1 year guarantee**; the Ashford listing says 3 months.

**New title**
```
The Ellery | Grey Faux Leather Single Ottoman Bed with Memory Foam Mattress
```

**New handle** — `the-ellery-grey-faux-leather-single-ottoman-bed`

**New description**
```html
<p>A single bed that stops a small room feeling like one.</p>

<p>The Ellery is a 3ft single in soft-touch grey faux leather — the kind of
finish that wipes clean in a second, which matters more in a spare room, a box
room or a teenager's room than anywhere else in the house. The matching
headboard is padded, and the frame is bolted rather than slotted, so it stays
solid and silent.</p>

<p>Gas lift arms take the weight of the base and hold it open on their own,
leaving both hands free to load or unload. Underneath is a full-length storage
bay for bedding, clothes and everything that has nowhere else to live. The
side-lift design can be built to open from the left or the right, so it works
whichever way the room is laid out.</p>

<p>The 3ft mattress is included: 2.5 cm of high-density memory foam over 12.6 cm
of high-density reflex foam, so it contours where you press into it and holds
its shape everywhere else. All foam is tested and certified for quality and
durability.</p>

<h3>Why you'll love it</h3>
<ul>
  <li><strong>Mattress included:</strong> 2.5 cm memory foam over 12.6 cm reflex
      foam, certified for durability</li>
  <li><strong>Gas lift that holds itself open:</strong> full-length storage bay,
      hands free</li>
  <li><strong>Opens left or right:</strong> choose at assembly to suit the room</li>
  <li><strong>Wipe-clean grey faux leather:</strong> soft-touch and low
      maintenance, with a matching padded headboard</li>
  <li><strong>Bolted static frame:</strong> solid construction, straightforward
      assembly with clear instructions</li>
</ul>

<h3>In the box</h3>
<p>Ottoman bed frame, headboard and 3ft mattress, flat-packed with all fittings
and assembly instructions.</p>
```

**Before you publish 2b**, settle the dimensions with your supplier and put one
set on the page. I have deliberately left them out rather than pick one, because
"will it fit" is the question a wrong number turns into a return.

---

## 3. Data to fix in admin

| Product | Field | Problem |
| --- | --- | --- |
| Ashford (was "Ottoman Bed Frame King Size…") | Specs | `Frame material: Metal` contradicts "sprung wooden slats" and "upholstered frame" |
| Ashford | Specs | `Bed size: King` shown, but Single/Double/King are all sold |
| Ashford | Variants | No SKUs set on any of the three variants |
| Ellery (was "Ottoman Bed Gas Lift…") | Description | Bunk-bed copy ("the ladder…", "for kids") |
| Ellery | Specs | `Height (mm) 85` — should be 850 |
| Ellery | Variants | No SKU set |
| Nightingale | Vendor | `ComfortCrest` — every other product is `Comfort Crest` |
| Nightingale | Variants | Single default variant, no size options |
| Nightingale | Variants | No SKU set |

Guarantee is the one to settle first: the two supplier listings say 3 months and
1 year, and nothing on the site states a house guarantee. Until you decide,
the theme claims nothing beyond your published returns policy.

---

## 4. Handles that expose your suppliers

Four URLs name the supplier or read as raw search terms. Changing a handle in
Shopify offers to create the 301 automatically — accept it, so you keep any
existing links and rankings.

| Current handle | Change to |
| --- | --- |
| `vida-designs-lisbon-king-size-faux-leather-bed-grey-gel-memory-foam-pocket-spring-mattress-king` | `the-marlow-faux-leather-bed-with-mattress` |
| `naples-cream-platform-top-divan-bed-base-only-5ft-king-size-with-2-drawers` | `the-pimlico-cream-divan-base-with-drawers` |
| `platform-ottoman-bed-storage-bed-with-mattress` | `the-nightingale-black-velvet-ottoman-bed` |
| `ottoman-bed-frame-king-size-storage-bed-with-mattress-pocket-sprung-memory-foam` | `the-ashford-grey-linen-ottoman-storage-bed` |
| `ottoman-bed-gas-lift-storage-leather-grey-3ft-single-with-1-mattress-pine-wood-bedroom` | `the-ellery-grey-faux-leather-single-ottoman-bed` |

---

## 5. Two things that were wrong on the live site

### Every product page was returning 404

`/collections/all` listed all eight beds and linked to them; every one of those
links returned a 404. Products were published (they appear in `/products.json`),
so the break was at the template layer: Shopify 404s a product whose assigned
**Theme template** no longer exists in the theme, and the previous commit
deleted ten `product.d1 copy N` templates as duplicates.

All of them are restored, each now containing the new product layout, so nothing
404s regardless of which suffix a product is assigned to. Once you have done §1,
those legacy templates are unused but harmless — leave them in place unless you
first confirm in admin that no product references them.

To confirm the fix on your side: open any product in admin and look at **Theme
template** in the right-hand column. If it says anything other than `Default
product`, that is the template name it needs, and it now exists.

### The theme was publishing promises the store does not make

Placeholder copy I wrote in the previous build went live unedited, and it
contradicted your own policy pages:

| Was live on the site | Your published policy |
| --- | --- |
| "100-night comfort trial" | 30-day returns |
| "we collect it and refund you in full, no restocking fee" | Collection cost is quoted and **deducted from the refund** |
| "no need to have kept the packaging" | Must be **unused, in original packaging** |
| "10-year guarantee on every frame" | Product data says 3 months / 1 year |
| "Two-person delivery to the room of your choice, full assembly, packaging removal" | Specialist courier **to your front door**, beds arrive **flat-packed** |
| "Order up to five free swatches" | No swatch service exists |
| "Add old-bed removal at checkout" | Not offered |
| "Klarna and Clearpay at checkout" | Not stated anywhere |
| "4.8 out of 5 · 2,412 reviews" | No review data on the store |
| Three named customer reviews | Written by me, not by customers |

Every one of those is now either corrected against
`/policies/shipping-policy` and `/policies/refund-policy`, or removed:

- The invented review wall and the competitor comparison table are **deleted**
  from the homepage. The review section still exists in the theme — add real
  reviews to it whenever you have them.
- Star ratings are off by default everywhere. The product page rating reads the
  standard `reviews.rating` metafield, so it appears by itself once a review app
  is connected, and stays hidden until then.
- Section defaults are fixed too, so dropping a fresh section onto a page no
  longer publishes a claim you have not made. Where a promise is yours to write,
  the default now says so rather than guessing.

If any of those claims are things you *do* offer — Klarna, a longer guarantee,
assembly — tell me and I will put them back. They were removed for lack of
evidence, not because they are impossible.
