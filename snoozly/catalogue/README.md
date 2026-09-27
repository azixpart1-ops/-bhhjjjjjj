# Snoozly catalogue — 64 beds from the PawLunova export

The PawLunova product export (`source-pawlunova-export.csv`) rebuilt as Snoozly
products: new names, simpler value-first descriptions, new Google titles and
descriptions, sleep-need collections, and Snoozly prices.

| File | What it is |
|---|---|
| `source-pawlunova-export.csv` 🔒 | The upload, untouched |
| `facts.json` 🔒 | The 64 products extracted from it (the 2 app upsell items are left out) |
| `plan.py` → `plan.json` 🔒 | Names, needs, tags, options, SKUs and prices, as one readable table |
| `price-review.csv` 🔒 | Every variant: PawLunova price → Snoozly price, cost, margin before/after, flag |
| `copy/NN.json` | The written copy per bed (tagline, description parts, Google title and description, alt text) |
| `validate_copy.py` | The copy rules as code. It must print `0 with problems` |
| `build_products.py` | Builds the descriptions and `products.jsonl` 🔒 (Shopify import) and `snoozly-products.csv` 🔒 |
| `snoozly-products.csv` 🔒 | The whole new catalogue in Shopify's product CSV format: a backup you can re-import |
| `preview/NN.html` | Each description as it renders, with its Google snippet, for proofreading |

🔒 **Not in git.** These files carry supplier cost prices and margins, and this
repository is public. They are listed in `.gitignore` and were handed over
separately. Put them back in this folder to re-run the scripts.

```bash
python3 snoozly/catalogue/plan.py            # prices + plan
python3 snoozly/catalogue/validate_copy.py   # copy rules
python3 snoozly/catalogue/build_products.py  # import files
```

## Names: need-coded families

Every bed gets one short name whose family tells you its sleep need, then a plain
description a shopper would actually search for ("Oak 24cm Gel Memory Foam
Orthopaedic Dog Bed").

| Family | Need | Names |
|---|---|---|
| Trees: they hold you up | Support (31 beds) | Oak, Ash, Cedar, Walnut, Hazel, Elm, Rowan, Chestnut, Holly, Yew, Larch, Beech, Alder, Maple, Birch, Juniper, Hornbeam, Aspen, Linden, Hawthorn, Blackthorn, Willow, Pine, Spruce, Cypress, Poplar, Whitebeam, Elder, Cherry, Damson, Sycamore |
| Birds: they build nests | Calm (14) | Swallow, Linnet, Magpie, Curlew, Wren, Robin, Dove, Heron, Thrush, Nightingale, Sparrow, Finch, Siskin, Starling |
| Burrowers: they curl up | Cosy (6) | Hare, Fox, Otter, Dormouse, Hedgehog, Badger |
| Water and air | Cool (3) | Harbour, Brook, Breeze |
| Meadow: open ground | Stretch (6) | Fern, Moss, Sedge, Clover, Heather, Bramble |
| Shore and huts | Outdoor, no need badge (4) | Cove, Shore, Bothy, Lodge |

## Collections

A bed's first need tag sets its colour badge; extra need tags put it in more
collections (a memory foam bolster bed sits in Orthopaedic *and* Calming).

| Collection | Rule | Beds |
|---|---|---|
| Orthopaedic & memory foam | `need:support` | 31 |
| Calming | `need:calm` | 24 |
| Sprawler beds & mattresses | `need:stretch` | 16 |
| Cosy | `need:cosy` | 12 |
| Cooling | `need:cool` | 3 |
| **Large & XL dog beds** (new) | `size:large` | 36 |
| **Waterproof & wipe-clean** (new) | `feature:waterproof` | 18 |
| **Dog sofas & chaises** (new) | `range:sofa` | 11 |
| **Garden & outdoor** (new) | `range:outdoor` | 7 |
| **Crate & travel** (new) | `range:crate-travel` | 4 |
| Dog beds | `pet:dog` | all 64 |

The counts are beds from this catalogue. The store also has 16 older products
(Shopify Collective and supplier items added 8–22 Sept) whose tags put them in
some of these collections too. Several are out of stock. Those weren't in the
export and were left alone.

## Pricing: value first

PawLunova's price is the anchor.

* **Cost known:** about 12% under the anchor, on Snoozly's price ladder
  (…£84, £89, £94, £99, £109, £119…), but **never below a 30% margin after
  20% VAT**.
* **Cost unknown** (106 of 170 variants): one price point under the anchor,
  flagged `COST-MISSING`. Add the cost in Shopify and re-check.
* A bigger size always costs at least one step more than the size below it.

Result: **135 of 170 variants are cheaper than PawLunova, 20 are the same, 15
are dearer.** The average price goes from £126.06 to £122.09. The 15 dearer ones
are beds PawLunova sold below a 30% margin, most of them far below. At those
prices a bed with free delivery loses money once payment fees and advertising
are paid. (The margins, before and after, are in `price-review.csv`.)

Finch Large stays at PawLunova's £89: PawLunova charged the same for Medium and
Large, so Medium drops to £84 and Large keeps its price.

| Bed | PawLunova | Snoozly |
|---|---|---|
| Larch XXL Memory Foam Bolster | £179 | £249 |
| Hornbeam XXL Orthopaedic Sofa | £199 | £269 |
| Yew Memory Foam Bolster (L / XL) | £179 / £199 | £229 / £249 |
| Cedar Memory Foam Mattress | £179 | £219 |
| Beech XXL Memory Foam Bolster | £199 | £249 |
| Linden XXL Orthopaedic Chaise | £169 | £219 |
| Harbour XL Elevated Mesh Bolster | £189 | £219 |
| Hawthorn XL Orthopaedic Bolster | £169 | £199 |
| Swallow Memory Foam Car Seat | £179 | £199 |
| Alder Corner Orthopaedic | £139 | £149 |
| Birch Bouclé Nest (M / L) | £139 / £149 | £149 / £169 |
| Ash XL Orthopaedic Bolster | £179 | £189 |
| Curlew Tartan Bolster (XL) | £149 | £159 |

To hold a PawLunova price anyway, change `MARGIN_FLOOR` in `plan.py` (or edit
the price in Shopify).

No "was" prices are set. Snoozly has never sold at PawLunova's prices, and
showing a reference price you haven't charged is misleading under UK consumer
law (DMCC Act 2024).

## Copy rules

Written to `validate_copy.py`, which checks every file:

* **Value first.** The bold opening line is what the dog gets. The next line is
  why it's worth the money, as a fact.
* **Facts only.** Every claim comes from the source description.
* **Removed:** all PawLunova policies (100-night trial, 5-year guarantee,
  free collection, £40 free delivery), old names, pence-per-night maths, other
  brands, medical claims, hype words and US spelling. Delivery and returns come
  from the theme's settings, so they can never disagree with checkout.
* **Google:** titles are 60 characters or fewer and lead with the search phrase,
  not the bed's name; descriptions are 120–155 characters. Every title is unique.
* Orthopaedic beds carry a one-line "comfort, not treatment" vet note. The
  personalised bed carries a spelling and made-to-order note.

## Images

Images are copied from the source CDN, first photo first. Three were left out:

* Newlands (now **Holly**) photo 3: an infographic headed "The Bedsure
  promise", which is another brand.
* Helvellyn (now **Alder**) photo 4: a "Mekiy – for a happy, healthy life"
  watermark.
* Kendal (now **Spruce**) photo 4: a "PAWLUNOVA" watermark.

**Photos to check before advertising these beds:**

* **Spruce:** PawLunova linked the Beige options to grey and green photos. The
  photos are no longer tied to a colour, so picking Beige doesn't show the
  wrong bed. The alt text doesn't name a colour. A true Beige photo would help.
* **Ash and Yew** use the same six photos. Ash is one XL size and Yew comes in
  Large and XL, so the pictures can't show how they differ.
* **Hazel and Beech** share two photos. Beech is PawLunova's three-sided XXL
  bolster (Mardale). Hazel is described as bolstered on all four sides. Check
  those two photos show a four-sided bed before running Hazel ads.

**Still visible, your call:** many beds carry the maker's sewn-on label in their
photos: "Bingo Paw" (Pine, Whitebeam, Sparrow, Finch), "LesFug" (Cedar), "BF"
(Cherry) and "HOUND" (Starling). Wren's photos show a "The Artisan Dog Co."
swing tag. That's what the product looks like when it arrives, so it isn't
misleading, but clean shots would look more premium.

## Gaps in the source data

Nothing here was made up to fill a gap. These are open questions for the
supplier:

* **No measurements at all (15 beds):** Walnut, Rowan, Chestnut, Magpie,
  Curlew, Birch, Aspen, Robin, Damson, Badger, Nightingale, the two day beds
  (Cove, Shore) and the two kennels (Bothy, Lodge). Their "Size and fit" note
  tells shoppers to ask. Add dimensions to the description when you have them.
* **One size missing:** Dormouse Small and Elder show "Ask us" in the size
  table.
* **Looks wrong:** Sparrow XL is listed as 127 × 94cm where the other sizes
  are width first (Large 76 × 105cm), so the XL figures may be swapped. Yew XL
  (104 × 68.5cm) is narrower than Yew Large (96 × 71cm).
* **No cost price on 106 of 170 variants.** They are priced one step under
  PawLunova and flagged `COST-MISSING` in `price-review.csv`. Add the cost in
  Shopify and re-run `plan.py` to check the margin.
* **Stock isn't tracked** (as in the PawLunova export), so every bed always
  shows as in stock. Turn on tracking per bed if your supplier gives you
  stock levels.

## In the store

* All 64 beds are live on the Online Store, vendor Snoozly, with the SEO title
  and description, the tagline metafield (`custom.tagline`, shown under the
  price) and a Google product category.
* **Fox (personalised) is Unlisted**: reachable by its link but not in
  collections or search. The name box it needs is in the v2 theme (below).
  Set Fox to Active after v2 is published.
* Five new smart collections: Large & XL, Waterproof, Dog sofas & chaises,
  Garden & outdoor, Crate & travel. The main menu has a "By type" column under
  Shop beds and "Large & XL" in the top bar; the footer links the two biggest.

## Theme v2: "Snoozly — Premium v2 (catalogue update)"

The live theme can't be edited from here, so the changes the catalogue needs
are in an unpublished copy. Its settings are identical to the live theme's
(checked on 27 Sept), so publishing it loses nothing.

* **Name box for Fox:** products tagged `personalise:name` get a required
  "Their name, as you want it embroidered" field (12 characters by default,
  set in the product page's Buy buttons block). Adding to the basket without a
  name shows an error, which clears as they type. The name goes on the order
  as "Name to embroider". Quick-add on cards and the express checkout buttons
  (Shop Pay, Apple Pay) are switched off for these products, because both
  skip the form and would let an order through without a name.
* **Fabric-toned colour swatches.** Shopify reads a value like "Green" as the
  web's pure green (#008000). The swatches now use muted fabric shades for
  Grey, Green, Beige, Blue, Brown and Navy. They also cover Bronze, Dark grey,
  Charcoal, Stone, Oatmeal, Natural, Cream, Sage and Slate, which Shopify
  doesn't recognise at all.
* **Product cards fill the frame** (Theme settings → Product cards → Image
  fit: cover). The new catalogue photos are room shots, which looked small
  inside the old padded frame.
