# PawLunova PDP — conversion strategy

Written against live Shopify analytics and the live theme, September 2026.
Every number below was measured, not assumed.

---

## 1. Diagnosis: where the money actually leaks

The headline conversion rate is **0.81%**, which looks catastrophic. It is not,
and acting on that number would send you after the wrong problem. Segmented:

| Segment | Sessions | Add-to-cart | Orders | CVR |
|---|---|---|---|---|
| direct / desktop | 1,951 | 1.3% | 6 | **0.31%** |
| search / mobile | 1,861 | 3.7% | 18 | 0.97% |
| direct / mobile | 895 | 5.8% | 14 | **1.56%** |
| search / desktop | 343 | 3.5% | 4 | 1.17% |

`direct/desktop` is 38% of sessions and 14% of orders. The store began trading
around 24 August 2026 and has no brand awareness, so 1,951 direct desktop
sessions are almost certainly crawlers, monitors and preview traffic rather
than demand. **Excluding that segment: 3,208 sessions, 4.2% add-to-cart,
1.12% CVR.**

Checkout is healthy — 52.5% of carts reach checkout and 50% of those complete.
Nothing is broken after the Add to Cart button. The opportunity is the PDP, and
it is worth roughly **1.5–2x, not 10x**. Target a 6–8% add-to-cart rate.

**First action is not a conversion tactic at all:** filter the bot traffic, or
every measurement after this is noise. Until then, judge changes on the
`search/*` segments only.

Other measured context: AOV £113.43 · 64 orders · £8,034 gross (90d) ·
54% of sessions are mobile · 50 active SKUs, £65–£195 · 24 of 50 orthopaedic ·
25 of 50 SKUs hold ≤4 units (genuine scarcity, genuinely tracked).

---

## 2. Who is buying

A UK owner of a medium-to-large dog, most often buying at one of three moments:

1. **The ageing dog.** The dominant segment — orthopaedic is half the
   catalogue. They have noticed stiffness, a hesitation at the stairs, a change
   they cannot un-see. The emotion is not desire, it is **guilt plus urgency**:
   a sense of time running out and of having noticed late. This buyer is not
   price-sensitive; they are *proof*-sensitive.
2. **The new dog / new puppy.** Anxious about doing it right, no established
   preferences, highly suggestible to authority and to "what most owners choose".
3. **The replacement.** Their last bed flattened, split or never got used. Their
   objection is not price, it is **"will this one be different?"** — which is a
   durability question, and durability is the one thing you can evidence.

Underneath all three sits a motive owners rarely state: **the bed lives in their
living room.** Washability, smell, hair and whether it looks acceptable in a
home are real purchase drivers at this price, not afterthoughts.

---

## 3. What the competition does

Convergent tactics across Omlet, Lords & Labradors, Charley Chau, Collared
Creatures, Pets at Home, Big Barker and the mattress brands that sell foam at a
premium:

- **Reviews carrying the reviewer's dog.** Omlet's Topology shows 86 verified
  reviews with the full star distribution — including the 2-star ones — and each
  reviewer's breed. The visible bad reviews are *why* the good ones are believed.
- **A named, diagrammed foam system.** Big Barker sells "OrthoMedic™ foam";
  Purple sells the "GelFlex Grid". Unnamed foam is priced as filler.
- **A guarantee that names the failure mode.** Big Barker's is a ten-year
  "can't flatten, won't flatten" warranty. It answers the only real objection.
- **Cost-of-ownership framing.** "$20–40 a year over ten years" against the
  replacement cycle for cheap beds.
- **Sizing help that resolves the choice**, via breed pickers and measuring rules.

**You already out-gun most of them on offer** — 100 nights *slept on*, free UK
mainland collection, full refund, 5-year no-flatten guarantee, 50kg/m³ published
density, Yorkshire-made. You are simply not selling it hard enough, and you have
no social proof at all.

---

## 4. The psychological architecture

Ordered by the question a buyer asks at each step.

| # | Buy-column block | Question answered | Lever |
|---|---|---|---|
| 1 | Breadcrumb, title, promise | What is this? | Fluency |
| 2 | Price | What does it cost? | — |
| 3 | **Per-night line** | Is that a lot? | Temporal reframing |
| 4 | **"Why £145, not £45"** | Why so much? | Reason-why, anchoring |
| 5 | **Size ladder** | Which one? | Compromise effect |
| 6 | Variant picker + size helper | Will it fit *my* dog? | Ambiguity reduction |
| 7 | Stock line | Do I have to decide now? | Scarcity (real) |
| 8 | Reassurance strip | What if it's wrong? | Loss aversion |
| 9 | **Add to Cart** | — | — |
| 10 | Trust strip, delivery, payment | Is this safe? | Risk reversal |
| 11 | **"What your dog is telling you"** | Is this urgent? | Self-identification |
| 12 | Build spec, guarantee, FAQ | Am I sure? | Substantiation |

Three deliberate orderings:

- **The per-night figure now divides by the guarantee (1,825 nights), not the
  trial (100).** £1.45 retrieves "a coffee" and invites the comparison you do
  not want. Under 8p retrieves nothing. Per Gourville (1999), the figure is left
  to work alone — no "less than a dog biscuit"; explicit comparisons *reversed*
  the effect in his data.
- **The anchor lands before the size ladder**, so £175 and £195 read as
  increments of a justified number rather than as fresh decisions.
- **The emotional block sits after the CTA, not before it.** An owner who is
  ready does not need to be made to feel guilty first, and guilt before the
  button suppresses more sales than it creates.

---

## 5. Shipped in this change

All in `shopify/snippets/pl-buybox.liquid` unless noted.

- **`anchor` rewritten.** Per-night now divides by the 5-year guarantee and
  renders **only on memory-foam SKUs** (detected from the material metafield,
  tags and product type). Mesh, crate and kennel SKUs show nothing rather than
  borrowing a guarantee they do not carry.
- **`ladder` (new).** Every size, priced, co-present, each a real link to its
  variant so it works with JavaScript off. Decorates the native picker; does not
  replace it.
- **`whyprice` (new).** Collapsed reason-why on the price. Makes *no* claim
  about competitors' construction — it states your two numbers and hands the
  shopper the question to ask of anything else they are considering:
  *what is the foam density, and how long is it guaranteed for?*
- **`signs` (new).** "What your dog is telling you" — six clinically recognised
  signs, opening on a real cited finding (Enomoto et al., *Scientific Reports*
  14, 2827, 2024: 123 dogs aged 8 months–4 years, 39.8% with radiographic
  osteoarthritis, only 2 of 29 with clinical signs receiving any pain
  management). Alarms and absolves in the same breath, which is what makes it
  read rather than repel. Claims only that it changes the surface they lie on.
- **`proof` (new).** Checkable credibility for a shop with no reviews yet.
- **`size` upgraded.** The restatement names the dog that fits, from a
  per-variant metafield — never generated from the size letter.
- **Fabricated ratings removed** from `pl-product-card`, `pl-hero`,
  `pl-pdp-main`, `pl-collection`, `pl-products`, `pl-reviews`, and the stale
  values stripped from five templates.

### Why the rating code was deleted rather than switched off

`templates/index.json` carried `pl_hero.rating_text = "4.8/5 across 3,900+
PawLunova owners"`, and the collection templates carried a `4.8` fallback
painted onto every card of every bed that had no reviews. Judge.me is installed
and holds **zero** reviews across the catalogue.

A default only governs a theme nobody has configured. Blanking it would have
left the saved values rendering. Deleting the read is what makes them go quiet
on deploy.

Displaying an aggregate rating you cannot evidence is a banned practice under
**Schedule 20 of the DMCC Act 2024** (in force April 2025). The CMA can fine up
to 10% of global turnover and does not have to prove any shopper was misled —
the display itself is the breach. It is also *costing* sales: a star row with no
count, that clicks through to nothing, is read as a lie about everything else on
the page. A bed with no reviews now shows no stars. That is the correct output.

---

## 6. Not shipped — needs a decision or data

Ordered by expected value.

1. **Remove the live fake rating block.** An AI-generated theme block
   (`ai-star-rating__…genblock…`) renders a hardcoded `4.8` in the buy column on
   the live store. It is in store-owned `templates/product.json`, which this
   repo must not upload. **Delete it in the theme editor.** This is the single
   most urgent item and it is a two-minute fix.
2. **Collect reviews.** You have 64 orders. Email every one of them asking for a
   photo and their dog's breed and size. Thirty real reviews with breeds beat a
   fabricated 4.8 outright — and Spiegel's data says purchase likelihood *peaks*
   around 4.2–4.5 stars and declines toward 5.0, so a mixed, real set outsells a
   perfect, implausible one. Never write, incentivise or suppress one.
3. **Populate `custom.fit_note` per variant.** The size ladder and the size
   restatement stay silent until this exists. Derive it from measured internal
   sleeping area, not the size letter: `max_dog_length = internal_length − 20cm`,
   using the +15–20cm rule already published on the site.
4. **Price anchoring, lawfully.** `compare_at_price` is null on all 50 products.
   Under CMA reference-pricing guidance a "was" price must have been genuinely
   charged. **Do not inflate prices to create a strikethrough.** The lawful path
   is either (a) the size ladder, which is a live comparison across your own
   range and is unconstrained, or (b) a genuine, dated, ending promotion with a
   real return to full price afterwards.
5. **Fix the desktop 0.31% segment** — filter bots first, then re-measure.
6. **Accessory SKUs** (waterproof liner, spare cover, blanket) to make the
   £40 delivery threshold reachable in one click and lift AOV.
7. **Single-variant products.** 22 of 50 offer no size choice at all. On a dog
   bed that is a hard stop for any buyer whose dog does not match.

### Explicitly rejected

- **Raising the free-delivery threshold from £40 to £130.** The goal-gradient
  effect behind it is real (Kivetz, Urminsky & Zheng, *JMR* 2006), but the
  supporting planks did not survive checking, and a threshold above AOV
  suppresses more orders than it enlarges at this volume.
- **Fabricated scarcity, countdown timers, "N people viewing", invented RRPs.**
  Banned under DMCC 2024, and unnecessary: 25 of 50 SKUs hold ≤4 genuinely
  tracked units, so the real number is already scarce enough to print.

---

## 7. Claims to verify before the next deploy

- **Eight products are tagged `Shopify Collective`** (Crummock Herringbone,
  Elterwater, Eskdale, Hawkshead, Kentmere, Loweswater, Patterdale, Seathwaite)
  while `/pages/delivery-returns` states *"Nothing is drop-shipped. Beds leave
  our Yorkshire workshop."* If those are third-party fulfilled, the claim needs
  narrowing to the beds it is true of.
- **`CertiPUR-US`** appears in the footer. US certification on UK-sold foam —
  confirm the certificate exists and covers these cores.
- **"Comparable UK orthopaedic beds run £240 to £320"** is a price comparison
  and needs a dated evidence file (which beds, which retailers, when checked).
- Two junk SKUs are live: **"Next Day Delivry"** (misspelled) and
  **"Shipping protection"** (stock −3).
- A stray label renders on the delivery page: *"PawLunova — Delivery & Returns
  (page source)"*.

---

## 8. Sequencing

**Week 1 (no new data needed):** delete the live fake rating block · deploy this
branch · filter bot traffic · fix the junk SKUs and the stray label.

**Week 2:** review request to all 64 customers · write `custom.fit_note` for
every variant of the top 20 sellers · build the evidence file for the £240–£320
claim.

**Week 3+:** accessory SKUs · sizes for the single-variant products · then, and
only then, consider a genuine dated promotion for lawful "was" pricing.

Measure on `search/*` segments only until the bot traffic is filtered.
