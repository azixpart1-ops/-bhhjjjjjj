# What needs a decision from PawLunova

Everything in this file is a gap the rewrite could not close, because closing it
would have meant inventing a fact. Each one is either a missing piece of product
data or a claim that needs confirming before it can be written.

They are ordered by what they cost you.

---

## 1. Three products state a price they do not sell for

Found by comparing every `£` figure in the body copy against the live variant
prices. A misstated price on a landing page is an exposure under the Digital
Markets, Competition and Consumers Act 2024, so these were corrected in the
rewrite — but you should know they were live, and for how long.

| Product | Sells for | Its own copy said |
|---|---|---|
| Melbreak (`the-loweswater-orthopaedic-bolster-dog-bed`) | £155 | *"£195 is a lot for a dog bed"*, and computed 11p a night from £195 |
| Buttermere (`the-buttermere-orthopaedic-memory-foam-mattress`) | £79 | *"£105 works out at under 6p a night"*, and *"you are not gambling the £105"* |
| Ambleside (`ambleside-edge-to-edge-memory-foam-bed`) | £109 Medium | *"the Medium works out at around 8p a night"* — £109 over 1825 nights is 6p |

Every per-night figure is now computed from the live variant price at 1825
nights, and only appears on beds that actually carry the 5-year foam guarantee.
**If you change a price, that arithmetic goes stale again.** Re-run
`scripts/check-copy.py` after any price change.

---

## 2. A 4.8-star rating shows on every product page, and there are no reviews

`templates/product.json` carries a block named "Star rating"
(`ai_gen_block_8fe6b9e_brMRWi`) with `rating_value: 4.8` hardcoded. It renders on
all 64 products. The store has **zero** published reviews — Judge.me reports
`number_of_reviews: 0` on all 47 products it tracks, and the `reviews.rating`
metafield is empty catalogue-wide.

Directly underneath it sits `pl-buybox part: 'rating'`, which is written
correctly: it is gated on real review data and currently renders nothing. The
honest block is already in place. Only the hardcoded one needs removing.

Two reasons this matters more than it looks:

- Displaying a rating with no reviews behind it is a banned commercial practice
  under the DMCC Act 2024, which carries strict liability.
- Google Merchant Center's Misrepresentation policy suspends accounts for it
  **without prior warning**. That would end the Shopping goal outright.

You asked to leave it in place for now, so it has been left untouched in both the
live theme and the draft. This entry is the record of that decision.

The fix, when you want it: delete the `ai_gen_block_8fe6b9e_brMRWi` entry from
`templates/product.json` and remove it from `block_order`. Nothing else changes —
real stars appear on their own once reviews exist.

---

## 3. Claims the copy is not making, because they are unconfirmed

None of these appear anywhere in the 64 rewritten descriptions. Confirm any of
them and they become some of the strongest lines available.

| Claim | Why it is held back | What it is worth |
|---|---|---|
| **Where the beds are made** | No origin fact exists in any product record. Your homepage leans on "our Yorkshire workshop", but nothing in the catalogue substantiates it per product. An unsubstantiated origin claim is a CAP Code breach. | High. UK-made is a genuine differentiator in this category and competitors state it plainly. |
| **Spare / replacement covers** | Not sold as products and not mentioned in any description. | Highest of the three. It was the most-requested unmet need across the whole competitor review corpus, raised independently in six reviews across four brands. If you sell them, it belongs in the description and the highlights. If you don't, it is the clearest product opportunity the research surfaced. |
| **Returns without the original packaging** | The returns policy is linked but does not settle it. | Moderate. "You do not need to have kept the box" removes a real hesitation, but only if it is true. |
| **What "no-flatten" means, measurably** | The 5-year guarantee is stated everywhere; the threshold that triggers it is not defined anywhere. | Moderate. CAP treats an omitted material limitation as misleading. A definition ("loses no more than X% of its original height under normal domestic use") makes the guarantee both safer and more persuasive. |

---

## 4. Product data that is missing, and only you can see the product

These are Shopify standard category metafields. Each one that is blank silently
removes a row from the Specification panel on the product page — the shopper
sees a shorter spec table and does not know anything is absent.

25 gaps across 16 products. They were left blank rather than guessed, because a
wrong measurement or colour is a return.

| Missing field | Products |
|---|---|
| `accessory-size` (10) | braithwaite-orthopaedic-bed · keswick-raised-plastic-dog-kennel · rosthwaite-xl-waterproof-orthopaedic-bed · skelwith-memory-foam-sofa-bed · the-blencathra-dog-house · the-henley-rattan-dog-house-with-canopy-beige · the-kentmere-orthopaedic-bolster-dog-bed · the-scafell-orthopaedic-dog-sofa-bed · the-watendlath-velvet-orthopaedic-dog-bed · the-whinlatter-dog-car-seat |
| `color-pattern` (5) | longsleddale-xxl-bolster-bed · rosthwaite-xl-waterproof-orthopaedic-bed · the-elterwater-boucle-high-wall-nest-dog-bed · the-loweswater-orthopaedic-bolster-dog-bed · wasdale-xxl-orthopaedic-sofa-bed |
| `shape` (5) | keswick-raised-plastic-dog-kennel · the-blencathra-dog-house · the-elterwater-boucle-high-wall-nest-dog-bed · the-henley-rattan-dog-house-with-canopy-beige · the-whinlatter-dog-car-seat |
| `pet-bedding-features` (4) | keswick-raised-plastic-dog-kennel · the-blencathra-dog-house · the-henley-rattan-dog-house-with-canopy-beige · the-torver-rattan-elevated-dog-day-bed-with-sun-canopy |
| `suitable-space` (1) | the-whinlatter-dog-car-seat |

One was fillable from the product's own words and has been set:
`the-wasdale-waterproof-pillow-bed` → colour **Green**, because its description
says *"a green waterproof exterior"*.

### Sizes with no measurements anywhere

Nine products have size options that carry no dimensions, so the size table on
their product page had nothing to render. Two were recoverable from tables inside
their own descriptions and are now set on the variants:

- **Crummock** — Small 50 × 40cm, Medium 70 × 50cm, Large 90 × 60cm
- **Wasdale waterproof pillow** — Medium 75 × 55 × 10cm, Large 95 × 75 × 12cm

The other seven have no measurements in any record, and their own copy says so:
*"Ask us for exact measurements before choosing."* Measure one of each and set
`custom.dimensions` on the variant, and a size table appears on each of these:

`the-elterwater-boucle-high-wall-nest-dog-bed` ·
`the-kentmere-houndstooth-bolster-dog-bed` ·
`the-patterdale-tweed-pillow-dog-bed` ·
`the-rydal-high-sided-nest-dog-bed` ·
`tetbury-songbird-bolster-bed` ·
`wensleydale-nesting-bed` ·
`the-windsor-memory-foam-sofa-dog-bed`

Plus two single sizes: `the-haweswater-orthopaedic-sofa-bed` (XL) and
`the-sawrey-nest-bed` (Small).

---

## 5. Reviews are the highest-leverage thing left, and no amount of copy substitutes

Berkeley Dog Beds ranks page one for competitive UK terms on **seven** reviews.
Google's threshold for star ratings in search results is around 50 genuine
reviews across the catalogue, plus two to four weeks of processing.

You have a 100-night trial, which means you already have a natural, non-pushy
moment to ask: the check-in partway through it. Judge.me is already installed on
47 products and returning zeroes. Turning on post-delivery review capture is a
single afternoon and it unlocks the one proof asset the copy is currently
writing around.

Until then, no description on this store may state a rating, a review count or a
number of happy owners. Those lines are absent by design, not by oversight.

---

## 6. Two naming inconsistencies worth tidying

Neither affects a customer, but both will confuse whoever edits this catalogue next.

**Handles no longer match titles.** Products were renamed without their URLs
changing, so `the-loweswater-orthopaedic-bolster-dog-bed` is the Melbreak,
`buttermere-boucle-nest-dog-bed` is the Blea Tarn, `kendal-quilted-dog-mattress`
is the Glenridding, and `orthopaedic-dog-bed` is the Nocturne. **Do not fix this
by changing the handles** — that breaks the URLs and discards whatever ranking
they hold. It is a documentation problem, not a data problem.

**A generic handle on a real product.** `orthopaedic-dog-bed` is the single best
handle in the catalogue for the category's head term, and it belongs to one
product. Worth considering whether that URL would earn more as a collection.
