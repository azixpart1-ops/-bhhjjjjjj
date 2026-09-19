# shopping-feed

## Sources actually fetched

- https://support.google.com/merchants/answer/6324415 — Title [title] and structured title [structured_title], Google Merchant Center Help (fetched)
- https://support.google.com/merchants/answer/6324468 — Description [description], Google Merchant Center Help (fetched)
- https://support.google.com/merchants/answer/7052112 — Product data specification (full attribute list), Google Merchant Center Help (fetched)
- https://support.google.com/merchants/answer/16989427 — Merchant Center product data specification update 2026, Google Merchant Center Help (fetched)
- https://support.google.com/merchants/answer/9216100 — Product highlight [product_highlight], Google Merchant Center Help (fetched)
- https://support.google.com/merchants/answer/9218260 — Product detail [product_detail], Google Merchant Center Help (fetched)
- https://support.google.com/merchants/answer/9103186 — Lifestyle image link [lifestyle_image_link], Google Merchant Center Help (fetched)
- https://support.google.com/merchants/answer/6324478 — Identifier exists [identifier_exists], Google Merchant Center Help (fetched)
- https://support.google.com/merchants/answer/6324351 — Brand [brand], Google Merchant Center Help (fetched)
- https://support.google.com/merchants/answer/13693497 — Fixing Merchant Center disapprovals for product data quality violations (fetched)
- https://support.google.com/merchants/answer/6150127 — Misrepresentation policy, Google Merchant Center Help (fetched)
- https://support.google.com/merchants/answer/14743464 — AI-generated content, Google Merchant Center Help (fetched)
- https://support.google.com/merchants/answer/13889434 — Free listings for products, Google Merchant Center Help (fetched)
- https://support.google.com/merchants/answer/7331077 — Set up structured data for Merchant Center (fetched)
- https://support.google.com/merchants/answer/7380908 — Tips to optimize your product data, Google Merchant Center Help (fetched)
- https://support.google.com/merchants/answer/14966351 — How to fix: Description text too short (fetched)
- https://support.google.com/merchants/answer/14989281 — How to fix: Text too long (fetched)
- https://support.google.com/merchants/answer/14549080 — Product Ratings eligibility, Google Merchant Center Help (fetched)
- https://support.google.com/merchants/answer/6098512 — Product Ratings policies, Google Merchant Center Help (fetched)
- https://developers.google.com/search/docs/appearance/structured-data/product — Product structured data, Google Search Central (fetched)
- https://developers.google.com/search/docs/appearance/structured-data/merchant-listing — Merchant listing structured data, Google Search Central (fetched)
- https://developers.google.com/search/docs/appearance/structured-data/review-snippet — Review snippet structured data, Google Search Central (fetched)
- https://developers.google.com/search/docs/essentials/spam-policies — Spam policies for Google web search, Google Search Central (fetched)
- https://developers.google.com/search/docs/fundamentals/creating-helpful-content — Creating helpful, reliable, people-first content, Google Search Central (fetched)
- https://www.google.com/basepages/producttype/taxonomy-with-ids.en-GB.txt — Google product taxonomy with IDs, en-GB (fetched via curl)
- https://www.storegrowers.com/google-merchant-center-feed-attributes/ — Every Google Merchant Center Feed Attribute Explained, Store Growers (fetched, practitioner)
- https://feedops.com/google-shopping-product-title-optimization/ — Google Shopping Title Optimization Guide 2026, FeedOps (fetched, practitioner)

## Findings (22)

### The brief's core instruction — write descriptions in an 'emotionally and psychologically manipulated way' — is directly disallowed in the Google feed fields, and is the single biggest risk to the Google Shopping goal

Google's Misrepresentation policy prohibits 'false claims or claims that entice the user with an improbable result' and content that deceives 'by excluding relevant product information or providing misleading information'. The [title] spec says: 'Don't use capital letters for emphasis. Capitalized text is common in spam and untrustworthy ads' and to avoid 'gimmicky ways of drawing attention such as all caps, symbols, HTML tags, and promotional text'. The [description] spec adds: 'Don't include comparisons or details about other products. For example, "even better than X."' and 'Don't include promotional text such as price, sale price, sale dates, shipping, delivery date, other time-related information, or your company's name.' Merchant Center lists 'excessively capitalized product titles' as a named data-quality disapproval reason. So the exact tactics that read as 'manipulative' (urgency, superlatives, ALL CAPS, fear framing, competitor knocks) are the tactics that get products suppressed or disapproved — the opposite of the stated goal of ranking top in Shopping.

Source: https://support.google.com/merchants/answer/6150127 ; https://support.google.com/merchants/answer/6324415 ; https://support.google.com/merchants/answer/6324468 ; https://support.google.com/merchants/answer/13693497

**Action:** Split the copy into two registers. FEED register (title, description, product_highlight, product_detail, and anything Google crawls as the product data): plain, factual, specification-dense, zero promotional language. PAGE register (the on-page rich description body, hero copy, benefit blocks): emotionally resonant and empathetic — but grounded in true, verifiable product facts, not invented urgency or fear. Emotional resonance that is TRUE is both legal and converts; fabricated scarcity or health claims put the whole Merchant Center account at risk.

### AI-generated titles and descriptions MUST be disclosed to Google via [structured_title] / [structured_description] — this is mandatory, not optional, and it applies to this entire project

Google: 'When using AI-generated content for the title and description text attributes, an alternative attribute must be used instead of, or in addition to, the existing title or description attribute.' [structured_title] takes two required sub-attributes: digital_source_type (must be set to 'trained_algorithmic_media') and content (the AI-generated title, plain text). [structured_description] takes the same two sub-attributes. The 2026 product data specification confirms [structured_title] is capped at 150 characters and [structured_description] at 5,000 characters, matching their plain counterparts. Separately: 'All images created using generative AI must contain meta data indicating that the image was AI-generated by using the IPTC DigitalSourceType TrainedAlgorithmicMedia metadata tag' and 'Don't remove embedded metadata tags.' One practitioner source reports that if both title and structured_title are supplied Google uses title — worth verifying against the live Merchant API before relying on it.

Source: https://support.google.com/merchants/answer/14743464 ; https://support.google.com/merchants/answer/7052112

**Action:** Decide now which it is. Option A: rewrites are AI-drafted and shipped as-is → the Shopify→Google feed must map to structured_title/structured_description with digital_source_type='trained_algorithmic_media'. Option B: every AI draft is materially reviewed and edited by a human before publishing, which is the normal editorial position and keeps plain [title]/[description] usable. Whichever you pick, make it an explicit, recorded decision — this is a compliance fork, not a style preference. Do not quietly ship AI text in the plain attributes.

### Exact title limits: 1–150 characters submitted, but only about the first 70 characters are seen

Google: title is '1–150 characters'. Best practice: 'Put the most important details first. Users will usually notice only the first 70 or fewer characters' and separately 'Use all 150 characters' to include product-defining detail. The 'Text too long' help page states the display limit is 70 characters on Shopping ads and free listings and that Google 'strongly encourage[s]' keeping titles to '70 or less characters whenever possible'. Text over the limit is truncated for display — the product is not rejected, it is flagged as a data-quality issue in the 'Needs attention' tab.

Source: https://support.google.com/merchants/answer/6324415 ; https://support.google.com/merchants/answer/14989281

**Action:** Write feed titles so the first 70 characters stand alone as a complete, buyable product description. Use the remaining characters up to 150 for secondary qualifiers (material, size variant, colour). Never start a title with size, SKU or a promotional word.

### Title attribute order that performs: Brand + Product Type + Key Attribute + Model/Range + Colour + Size

Google's own optimisation guidance says: 'Include important attributes in your title, such as strong brand names, age group, gender, size, color, size type, or personalization options' and place 'key details at the front of your product title, especially if they're not visible in the image'. Practitioner consensus across two fetched sources converges on Brand + Product Type + Model or Range + Key Attribute + Colour + Size or Variant, with FeedOps stating 'the first 60 to 70 characters carry the core product meaning' and 'Put the strongest words near the beginning' because 'Google uses title position to assess relevance'. Store Growers calls title 'the single most impactful attribute in your feed' and reports '81% of high-performing advertisers use different, more keyword-optimized titles in their feeds compared to their product pages'. FeedOps' worked example: weak = 'Size 10 Black Air Zoom Pegasus 40 Running Shoes by Nike'; stronger = 'Nike Men's Running Shoes Air Zoom Pegasus 40 Black Size 10'. Note the 81% figure is a vendor claim, not a Google figure.

Source: https://support.google.com/merchants/answer/7380908 ; https://feedops.com/google-shopping-product-title-optimization/ ; https://www.storegrowers.com/google-merchant-center-feed-attributes/

**Action:** For PawLunova the performing pattern is: PawLunova + [Bed Type] Dog Bed + [Key Feature] + [Size] + [Colour]. Example shape: 'PawLunova Orthopaedic Memory Foam Dog Bed Waterproof Removable Cover Large Grey'. That lands the buying terms inside 70 characters. Because PawLunova is not yet a recognised brand, consider testing product-type-first variants ('Orthopaedic Memory Foam Dog Bed — PawLunova …') since practitioner guidance is to lead with brand only for high-intent branded search.

### Exact description limits: 1–5,000 characters, recommended 500–1,000, with the decisive content in the first 160–500 characters

Google: description is '1–5,000 characters' and over-length text is truncated with a warning. The 'Description text too short' help page recommends 'around 500 to 1,000 characters, but you can submit up to 5,000 characters' and classifies too-short as an invalid attribute rather than a warning. The description spec's best practice: 'List the most important details in the first 160 - 500 characters' and include 'size, material, age range, technical specifications, design, and variants'. Content must stay 'consistent with other details in the data source...and on your landing pages'.

Source: https://support.google.com/merchants/answer/6324468 ; https://support.google.com/merchants/answer/14966351

**Action:** Target 500–1,000 characters for the feed description on every one of the 64 products. Front-load the first 160 characters with: bed type, foam construction, key orthopaedic benefit, cover material, waterproof status, size range. Save narrative and emotional framing for the on-page body copy, which can be much longer.

### product_highlight: 1–150 characters per highlight, minimum 2, maximum 100, Google recommends 4–6

Google: '1 - 150 characters (per highlight)', minimum 2, maximum 100, recommended 4-6. Purpose: 'short bulleted lists of the most relevant highlights' — 'focus on selling benefits' in 'quick-to-scan sentence fragments'. Prohibited: promotional text, price, sale dates, shipping/delivery, company name, comparisons to other products, references to categorisation systems, links, all caps, symbols, foreign characters 'for gimmicky purposes', and critically: 'Don't list keywords or search terms' and 'Don't duplicate data' already in other attributes. Also 'Don't describe other aspects like details about compatible products, accessories' and 'Don't provide your business's history or policies'.

Source: https://support.google.com/merchants/answer/9216100

**Action:** Give every product exactly 4–6 highlights, each under 150 characters, each a benefit fragment tied to a real spec. Note the trap: the 100-night trial and 5-year guarantee are BUSINESS POLICIES and are explicitly barred from product_highlight ('Don't provide your business's history or policies'). Put those on the landing page and in on-site trust blocks, not in the feed highlights.

### product_detail: 1–150 characters per detail, up to 100 details, strict section_name:attribute_name:attribute_value format

Google: '1 - 150 characters (per detail)', 'Up to 100' repeated values per product. Format is three sub-attributes separated by exactly two colons — section_name:attribute_name:attribute_value. section_name is optional but recommended; attribute_name and attribute_value are both required. Prohibited: price, sale price, sale dates, shipping, delivery date, 'other time-related information', company names, keywords or search terms, 'information covered in other attributes or promotion text', unconfirmed attribute values, and data duplicated from title or description.

Source: https://support.google.com/merchants/answer/9218260

**Action:** This is the highest-leverage under-used field for a dog bed store. Build a standard section schema across all 64 products, e.g. 'Construction:Foam type:CertiPUR memory foam', 'Construction:Foam depth:10cm', 'Cover:Material:Waterproof Oxford', 'Cover:Removable:Yes', 'Cover:Machine washable:Yes at 30C', 'Dimensions:Internal sleeping area:90 x 60cm', 'Suitability:Recommended dog weight:25-40kg'. Only assert values you can confirm from the existing descriptions — 'Don't include unconfirmed attribute values'.

### Full attribute set with exact limits for the attributes named in the brief

From the product data specification: [id] 50 chars; [title]/[structured_title] 150 chars; [description]/[structured_description] 5,000 chars; [link] 2,000 chars; [image_link] 2,000 chars; [additional_image_link] 2,000 chars, up to 10 images; [lifestyle_image_link] 2,000 chars, up to 5 images, min 600x600px, aspect ratio between 2:0 and 2:3, max 64 megapixels and 16MB, no CTAs, price info, overlays, watermarks, logos, borders or padding; [brand] 70 chars; [mpn] 70 chars; [material] 200 chars, multiple values separated by '/'; [product_type] 750 chars, merchant-defined, '>' separated; [google_product_category] numeric ID or full taxonomy path; [custom_label_0] through [custom_label_4] 100 chars each; [item_group_title] 150 chars; [question_and_answer] 10,000 chars total, max 30 pairs; [variant_option] 5,000 chars total, max 30 values; [size_type] values regular/petite/maternity/big/tall/plus, max 2; [size_system] US/UK/EU/DE/FR/JP/CN/IT/BR/MEX/AU, max 2; [condition] new/refurbished/used; [availability] in_stock/out_of_stock/preorder/backorder; [sale_price] with [sale_price_effective_date] 51 chars ISO 8601 range; [shipping] format country:region:service:price; [product_length]/[product_width]/[product_height] number + cm or in, range 1–3000; [product_weight] number + lb/oz/g/kg, range 0–2000; [popularity_rank] float 0–100.0. [gender], [age_group], [color], [size] are required for Apparel & Accessories free listings — NOT for dog beds, which sit outside that category.

Source: https://support.google.com/merchants/answer/7052112 ; https://support.google.com/merchants/answer/9103186 ; https://support.google.com/merchants/answer/13889434

**Action:** Populate [material], [color], [pattern], [product_length/width/height], [product_weight] and [product_detail] on all 64 — these are optional for dog beds but they are the fields that let Google match long-tail queries like 'waterproof memory foam dog bed 90cm grey'. Do NOT force [age_group]/[gender] — they are apparel attributes and irrelevant here.

### The correct google_product_category IDs for this catalogue — verified against Google's live en-GB taxonomy file

From https://www.google.com/basepages/producttype/taxonomy-with-ids.en-GB.txt : 4434 = Animals & Pet Supplies > Pet Supplies > Dog Supplies > Dog Beds; 5094 = Animals & Pet Supplies > Pet Supplies > Dog Supplies > Dog Houses; 7274 = Animals & Pet Supplies > Pet Supplies > Dog Supplies > Dog Kennels & Runs; 7428 = Animals & Pet Supplies > Pet Supplies > Dog Supplies > Dog Kennel & Run Accessories; 5 = Animals & Pet Supplies > Pet Supplies > Dog Supplies (too shallow, do not use). Note: 5092 is 'Pet Bed Accessories' and is NOT dog beds — a common mis-mapping. Google's guidance is to use values 'at least 2-3 levels deep'.

Source: https://www.google.com/basepages/producttype/taxonomy-with-ids.en-GB.txt ; https://support.google.com/merchants/answer/7380908

**Action:** Map all bed products (orthopaedic, memory foam, nest, bolster, waterproof, elevated-cooling, crate beds) to 4434. Map the outdoor dog houses to 5094. Only use 7274 if a product is genuinely a kennel/run rather than a house. Never leave these on 5.

### product_type is separate from google_product_category and is the field you control — Store Growers calls it 'the most underrated attribute'

google_product_category uses Google's fixed taxonomy; product_type 'allows your own custom categorization for products, using whatever hierarchy makes sense for your business', up to 750 characters, '>' separated. It 'directly maps to how you can organize and bid on products in your Shopping campaigns'. Google's own tip: provide 'the most detailed product type values you have' and structure so it starts broad and ends specific, e.g. 'Apparel & Accessories > Clothing > Outerwear > Coats & Jackets > Denim Jackets'. Critically: 'Avoid adding synonyms, search query terms, or promotional text.'

Source: https://www.storegrowers.com/google-merchant-center-feed-attributes/ ; https://support.google.com/merchants/answer/7380908 ; https://support.google.com/merchants/answer/7052112

**Action:** Build a 4-level product_type tree, e.g. 'Dog Beds > Orthopaedic Dog Beds > Memory Foam Dog Beds > Waterproof Memory Foam Dog Beds' and 'Dog Beds > Nest & Bolster Dog Beds > Calming Nest Dog Beds'. Resist stuffing search terms in here — Google explicitly warns against it.

### PawLunova almost certainly has no GTINs — the correct handling is brand + mpn, NOT identifier_exists=no

Google: use identifier_exists 'no'/'false' only for 'Products that don't have a GTIN, MPN, or brand' — custom goods, handmade items, vintage/antique products, books published before 1970. Warning: 'Products for which the identifier exists attribute is incorrectly set to no or false and for which there is evidence that a unique product identifier exists, will receive a warning.' On brand for own-label: 'Use your store name for the brand attribute if you manufacture the product or if your product is a private-label product' and 'Use the store name as the brand name in cases where the merchant is also the manufacturer and the only seller of a product that has no official brand'. [brand] is 1–70 chars and is 'Required for each product where the manufacturer is also the merchant'. [mpn] is required only if no GTIN is assigned. Missing/incorrect GTIN, MPN or brand is a named disapproval reason. Store Growers claims products with GTINs get 'up to 40% more clicks' — vendor claim, not a Google figure.

Source: https://support.google.com/merchants/answer/6324478 ; https://support.google.com/merchants/answer/6324351 ; https://support.google.com/merchants/answer/13693497 ; https://www.storegrowers.com/google-merchant-center-feed-attributes/

**Action:** Set brand='PawLunova' on all 64. Assign a stable MPN per variant (your own SKU is fine). Leave identifier_exists unset or 'yes' — do NOT set it to 'no', because you do have a brand and an MPN, and setting it wrongly triggers a warning. If the beds are manufacturer-supplied with real EAN/GTIN barcodes, get them and submit them; that is the single most mechanical ranking upgrade available.

### Free listings — the organic Shopping surface — have their own explicit required-attribute list, and free listings are where a £49–£299 store wins without ad spend

Required for all products in free listings: [id], [title], [link], [image_link], [price], [description], [availability], plus [gtin] if assigned by the manufacturer and [mpn] if no GTIN exists. [condition] required for used/refurbished. [brand] required 'For each product with a clearly associated brand or manufacturer'. [item_group_id] required for product variants. [multipack] and [is_bundle] where applicable. Free listings surface on 'Google Search, the Shopping tab, Google Images, Google Lens, YouTube, Gemini, and Business Profile product modules'. Google is explicit that approval is not ranking: 'The status on the Free listings page controls permission to show products for free across Google, but doesn't guarantee that your products will be shown to customers' — and 'We rely on the data that you provide to us to match your products with what customers might be searching for.'

Source: https://support.google.com/merchants/answer/13889434

**Action:** Treat description quality as a ranking input, not a formality — Google states matching depends on the data you supply. Ensure [item_group_id] groups every size/colour variant, otherwise variants compete against each other and dilute. Note Gemini is now a free-listing surface, which raises the value of clean, factual, parseable product_detail data.

### Structured data on the Shopify product page feeds Merchant Center directly — and a mismatch between page markup and feed breaks it

For automatic item updates Google requires these schema.org values: 'price, priceCurrency, availability and condition'. Matching rules: each offer annotated with a SKU must match the [id] attribute in the feed; offers with a GTIN must correspond to the [gtin] attribute. Google's crawler matches markup to the feed only when: a single offer is present on the landing page OR multiple offers each carry SKU/GTIN annotations matching feed values; markup is in the initial HTML, not JavaScript-generated; pricing and content don't change based on user information; and data matches what users actually see. 'If at least one of these conditions isn't met, the products on your landing page won't match your product data.' Search Central separately recommends 'putting Product structured data in the initial HTML for best results'.

Source: https://support.google.com/merchants/answer/7331077 ; https://developers.google.com/search/docs/appearance/structured-data/product

**Action:** Audit the theme's Product JSON-LD. Confirm sku matches the feed [id] exactly, that price/priceCurrency/availability/itemCondition are present, and that the markup renders server-side in the initial HTML rather than being injected by an app after page load. This is a silent killer — it degrades everything downstream and produces no obvious error.

### Merchant listing structured data: exact required vs recommended properties for rich results

Product — required: name, image, offers. Recommended: description, brand (via Brand type), aggregateRating, review, sku, gtin/gtin8/gtin12/gtin13/gtin14, category, color, material, pattern, size, audience (PeopleAudience). Offer — required: price or priceSpecification.price (must be greater than zero for merchant listings) and priceCurrency (three-letter ISO 4217). Recommended: availability, itemCondition (NewCondition/RefurbishedCondition/UsedCondition), url, priceValidUntil (ISO 8601), validFrom/validThrough, shippingDetails, hasMerchantReturnPolicy. OfferShippingDetails — shippingRate, shippingDestination (DefinedRegion with addressCountry), deliveryTime (ShippingDeliveryTime with handlingTime and transitTime). MerchantReturnPolicy — applicableCountry, returnPolicyCategory, merchantReturnDays, returnMethod, returnFees, returnShippingFeesAmount; Google notes 'We recommend you provide a global return policy for your business under Organization markup instead' of offer-level policies. Merchant listings require an Offer, not an AggregateOffer, and 'Only pages where a shopper can purchase a product are eligible for merchant listing experiences'.

Source: https://developers.google.com/search/docs/appearance/structured-data/merchant-listing

**Action:** Add OfferShippingDetails with the real UK mainland rate and handling/transit times, and set the 100-night trial up as an Organization-level MerchantReturnPolicy with merchantReturnDays=100. Shipping and returns annotations are among the few things that legitimately differentiate a listing visually in the Shopping grid — and the 100-night trial is a genuine, checkable advantage, which is exactly the kind of persuasion Google rewards rather than punishes.

### With zero reviews, AggregateRating markup must be left out entirely — fabricating it risks a manual action and Merchant Center suspension

aggregateRating and review are 'Recommended' for Product markup, and AggregateRating needs ratingValue plus 'At least one of ratingCount or reviewCount'. Review needs reviewRating (with ratingValue) and author (Person or Organization, max 100 characters, 'not promotional text'). But Google prohibits 'fake or undisclosed incentivized reviews on your page or in your structured data markup', explicitly including 'Reviews that aren't based on a genuine experience of a product or service'. Consequence: 'If your site violates one or more of these guidelines, then Google may take manual action against it' and 'the structured data on the page will be ignored'. Google also requires 'Ratings must be sourced directly from users.' Merchant Center's Product Ratings policies add: 'We don't allow reviews that are primarily generated by an automated program or artificial intelligence application' and 'We remove reviews that we believe have conflicts of interest and/or have been written by employees or people with a vested interest in the product.'

Source: https://developers.google.com/search/docs/appearance/structured-data/review-snippet ; https://support.google.com/merchants/answer/6098512 ; https://developers.google.com/search/docs/appearance/structured-data/merchant-listing

**Action:** Ship the rewrite with NO aggregateRating and NO review markup. Do not seed AI-written or staff-written reviews — that is explicitly prohibited and it endangers the Merchant Center account that the entire Shopping goal depends on. Instead, start a post-purchase review collection flow now; the 100-night trial gives a natural 100-day trigger point.

### Product Ratings thresholds: 50 reviews across the catalogue before stars appear anywhere

Google: 'You must have a minimum of 50 reviews across all of your products' to display ratings on Google Shopping or Google Ads. 'Your product review data source must be uploaded at least once a month and must contain updated reviews to maintain eligibility.' Onboarding shows 'inactive' for 'approximately 3–4 days', then 'It can take 2-4 weeks for reviews to go live after the review process.' A widely-cited practitioner threshold of 3 reviews per individual product for the rating to display on Shopping ads appears in third-party sources but I could not confirm it on the official eligibility page — treat it as unverified. Incentivised reviews are permitted but 'these incentives cannot be dependent on the sentiment of the review' and must be flagged with the <is_incentivized_review> attribute. Reviews cannot be filtered by star rating.

Source: https://support.google.com/merchants/answer/14549080 ; https://support.google.com/merchants/answer/6098512

**Action:** 50 genuine reviews is the gate, and at current volume that is a months-long project, not a copywriting one. Budget roughly 6 weeks from hitting 50 to stars actually appearing. Nothing in the description rewrite can substitute for this — so the rewrite should lean on the trust assets you genuinely have (100-night trial, 5-year no-flatten guarantee, UK delivery) rather than implying social proof you don't.

### Named data-quality violations that cause outright disapproval

From Google's disapproval fix guide: (1) missing or incorrect GTIN/MPN/brand — fix by assigning valid UPIs; (2) generic images — placeholder, logo-based or 'No image available'; (3) promotional overlays on images — retailer logos, calls-to-action, watermarks or obstructing elements; (4) images below minimum dimensions — 100x100px non-apparel, 250x250px apparel (note: the 2026 spec update raises [image_link] and [additional_image_link] minimums to '500 x 500 pixels across all product categories', warnings from 14 April 2026, enforced 31 January 2027); (5) invalid google_product_category not matching Google's taxonomy; (6) 'Excessively capitalized product titles'; (7) conflicting GTIN-brand values. Misrepresentation adds: missing or hidden business details (contact email, phone, physical address) and incomplete or inaccessible privacy, returns/refunds, terms and shipping policy pages; unclear or hidden costs; 'promoting products that aren't stocked, promoting a deal that's no longer active'; and 'denying return and refund for a product despite having a clear refund or return policy'.

Source: https://support.google.com/merchants/answer/13693497 ; https://support.google.com/merchants/answer/6150127 ; https://support.google.com/merchants/answer/16989427

**Action:** Two actions outside the copy itself: (a) audit all product imagery for overlays, badges and '100 NIGHT TRIAL' graphics burned into the image — those are a named disapproval cause; (b) confirm the storefront has visible contact details and accessible returns, shipping, privacy and terms pages, and that the published returns policy actually matches the 100-night trial you advertise. And start the image upgrade to 500x500 minimum now, ahead of the January 2027 enforcement date.

### Feed content must match the landing page — you cannot write one story for Google and another for the shopper

Google: 'Use the same product title and description that you do on your landing page' and 'Don't use synonyms or search query terms that aren't included in your product's landing page, as customers expect the messaging of your product ads and listings to match your landing pages.' Also: ensure 'the same product variant that you use in your Shopping ad or listing' appears on the landing page, and match 'color names in your product data' to those shown on landing pages exactly. The description spec requires content 'consistent with other details in the data source...and on your landing pages'. Discrepancies between ads, feed and site on title, price or availability are a named disapproval trigger.

Source: https://support.google.com/merchants/answer/7380908 ; https://support.google.com/merchants/answer/6324468 ; https://support.google.com/merchants/answer/13693497

**Action:** Whatever keywords go into the feed title and description must literally appear in the on-page description. This constrains the project: you cannot optimise the feed for 'orthopaedic arthritis dog bed' unless those words are on the product page too. Build the on-page copy first, then derive the feed copy from it — not the reverse.

### Google's Search-side stance on AI and keyword-stuffed content applies to the on-page descriptions, separately from the feed

Spam policies: 'Keyword stuffing refers to the practice of filling a web page with keywords or numbers in an attempt to manipulate rankings in Google Search results', including 'unnatural repetition of words/phrases'. 'Scaled content abuse is when many pages are generated for the primary purpose of manipulating search rankings and not helping users', explicitly covering 'Using generative AI tools or other similar tools to generate many pages without adding value for users'. Helpful-content guidance: 'If you use automation, including AI-generation, to produce content for the primary purpose of manipulating search rankings, that's a violation of our spam policies' and 'If the "why" is that you're primarily making content to attract search engine visits, that's not aligned with what our systems seek to reward.' On transparency: 'Is the use of automation, including AI-generation, self-evident to visitors through disclosures or in other ways?' On E-E-A-T: 'trust is most important' and content should 'clearly demonstrate first-hand expertise and a depth of knowledge (for example, expertise that comes from having actually used a product or service)'.

Source: https://developers.google.com/search/docs/essentials/spam-policies ; https://developers.google.com/search/docs/fundamentals/creating-helpful-content

**Action:** Rewriting 64 real product pages with genuinely useful, differentiated, accurate detail is not scaled content abuse — generating 64 near-identical templated pages stuffed with 'orthopaedic dog bed UK' is. The defence is differentiation and substance: each of the 64 must say something specifically true about THAT bed. Add real first-hand signals where you legitimately have them — measured foam depth, how the cover behaves after washing, which dog sizes each model actually suits.

### 2026 spec changes that affect this store

Effective 14 April 2026: new [handling_cutoff_time] ('set a daily deadline for processing online orders'), new [minimum_order_value] ('specify the minimum spend required to purchase and deliver an order'), new [loyalty_program_label] and [loyalty_tier_label] sub-attributes on [shipping], and new optional [video_link] (technical validation errors reported from 14 April 2026; serving begins 30 June 2026). Effective 31 January 2027: [image_link] and [additional_image_link] minimum resolution rises to 500 x 500 pixels across all categories, with warnings from 14 April 2026 — Google states it 'will automatically optimize smaller images to meet requirements without merchant action'.

Source: https://support.google.com/merchants/answer/16989427

**Action:** [video_link] is now live and serving — a 20-second clip of a dog settling into the bed is a strong differentiator for a considered £80–£200 purchase and almost no small UK competitor will have one. [handling_cutoff_time] is worth setting if you have a genuine same-day dispatch cutoff, because it feeds accurate delivery estimates into the listing.

### custom_label_0 through custom_label_4 are invisible to shoppers and are for campaign segmentation only — 100 characters each

Merchant-defined labels, 100 characters each, five slots. Store Growers' standard scheme: label 0 = margin tier (high/medium/low), label 1 = seasonality, label 2 = performance tier (bestseller/average/underperformer), label 3 = price range buckets, label 4 = promo status. Purpose is to 'bid on them differently' by segment. These are not a place for keywords or copy.

Source: https://www.storegrowers.com/google-merchant-center-feed-attributes/ ; https://support.google.com/merchants/answer/7052112

**Action:** Set these up before running Shopping ads, not after — they are how you'll later shift budget toward the £150+ orthopaedic beds that carry the margin. Suggested for PawLunova: label_0 = margin tier; label_1 = bed type (orthopaedic/nest/crate/elevated/house); label_2 = price band (49-79 / 80-149 / 150-299); label_3 = dog size fit; label_4 = bestseller flag.

### sale_price and sale_price_effective_date are the ONLY compliant way to express a discount — urgency cannot be written into the copy

[sale_price] is submitted alongside the non-sale price in [price]; [sale_price_effective_date] is 51 characters, an ISO 8601 date range, used with sale_price. Both [title] and [description] explicitly bar 'price, sale price, sale dates, shipping, delivery date, other time-related information'. [product_highlight] and [product_detail] bar the same. Misrepresentation policy requires disclosure of 'the payment model and full expense that a customer will bear before and after purchase' and bars 'promoting a deal that's no longer active'. Search Central lists priceValidUntil as a recommended Offer property.

Source: https://support.google.com/merchants/answer/7052112 ; https://support.google.com/merchants/answer/6324415 ; https://support.google.com/merchants/answer/6324468 ; https://support.google.com/merchants/answer/6150127

**Action:** Every discount, countdown and 'ends Sunday' must live in [sale_price] + [sale_price_effective_date] and in priceValidUntil — never in the words. If the copywriters want urgency, the only compliant urgency is a real, dated, structurally-declared sale price. An invented deadline in the description text is both a policy violation and, under UK consumer protection law, a legal exposure worth checking with your own adviser.

## Hard rules

- FEED TITLE: 1–150 characters hard limit. Only the first ~70 characters display on Shopping ads and free listings — the first 70 must stand alone as a complete product description.
- FEED TITLE ORDER: Brand + Product Type + Key Attribute + Model/Range + Colour + Size. For PawLunova: 'PawLunova [Bed Type] Dog Bed [Key Feature] [Size] [Colour]'. Never lead with size, SKU, or a promotional word.
- FEED TITLE BANS: no price, sale price, sale dates, shipping, delivery date, any time-related information, or the company name. No ALL CAPS for emphasis. No symbols, HTML tags, emoji, or decorative characters. No extra whitespace. 'Excessively capitalized product titles' is a named disapproval reason.
- FEED DESCRIPTION: 1–5,000 characters hard limit. Target 500–1,000 characters. Put the decisive content in the first 160–500 characters: bed type, foam construction, orthopaedic benefit, cover material, waterproof status, size range.
- FEED DESCRIPTION BANS: no promotional text (price, sale price, sale dates, shipping, delivery date, other time-related info, company name). No comparisons to other products — Google's own example of what is banned is 'even better than X.' No links to your store or any other website. No ALL CAPS for emphasis. No gimmicky symbols.
- product_highlight: 1–150 characters PER highlight. Minimum 2, maximum 100, write exactly 4–6. Benefit fragments, quick to scan. No keywords or search terms. No duplicating data already in other attributes. No business history or policies — which means the 100-night trial and 5-year guarantee CANNOT go here.
- product_detail: 1–150 characters PER detail, up to 100 details per product. Format is exactly section_name:attribute_name:attribute_value — exactly two colons. attribute_name and attribute_value are required; section_name is optional but use it. Never submit an unconfirmed attribute value.
- google_product_category: dog beds = 4434 (Animals & Pet Supplies > Pet Supplies > Dog Supplies > Dog Beds). Dog houses = 5094. Dog kennels & runs = 7274. Never use 5 (too shallow). 5092 is Pet Bed Accessories and is WRONG for dog beds.
- product_type: up to 750 characters, '>' separated, 4 levels deep, broad to specific. No synonyms, no search query terms, no promotional text.
- brand: 1–70 characters. Set brand='PawLunova' on all 64 — Google's rule is to use your store name when you are the manufacturer or the product is private-label.
- identifier_exists: do NOT set this to 'no' or 'false'. You have a brand and can assign an MPN, so the identifier does exist. Setting it to no when Google finds evidence a UPI exists triggers a warning. Submit real GTINs if the manufacturer supplies them.
- AI DISCLOSURE: any title or description generated by AI must be submitted in [structured_title] / [structured_description] with digital_source_type = 'trained_algorithmic_media' and the text in the content sub-attribute. Any AI-generated image must retain its IPTC DigitalSourceType TrainedAlgorithmicMedia tag — never strip embedded metadata.
- NO FABRICATED REVIEWS, RATINGS OR TESTIMONIALS anywhere — not in copy, not in aggregateRating or review markup. Google bans reviews 'primarily generated by an automated program or artificial intelligence application' and reviews written by anyone with a vested interest. Penalty is manual action and markup being ignored. Ship with zero aggregateRating markup until you have real reviews.
- PRODUCT RATINGS GATE: 50 genuine reviews across the catalogue before stars can appear, feed refreshed at least monthly, 2–4 weeks processing. No copy can shortcut this.
- DISCOUNTS AND URGENCY live only in [sale_price] + [sale_price_effective_date] (51 chars, ISO 8601 range) and in priceValidUntil. Never write a deadline, countdown or 'only X left' into title, description, product_highlight or product_detail.
- FEED MUST MATCH PAGE: use the same title and description as the landing page. Do not use synonyms or search query terms that do not literally appear on the product page. Match colour names exactly. Write the on-page copy first, derive the feed copy from it.
- NO IMPROBABLE OR UNVERIFIABLE CLAIMS. Google's Misrepresentation policy bans 'claims that entice the user with an improbable result'. No implied veterinary or medical outcomes ('cures arthritis', 'eliminates joint pain'). Say what the product IS and let the buyer draw the conclusion: '10cm CertiPUR memory foam base that does not bottom out under a 35kg dog' beats 'ends your dog's suffering'.
- EMOTION IS ALLOWED WHEN IT IS TRUE. Write to the real moment — an ageing dog struggling to settle, the owner hearing them shift all night. Ground every emotional line in a real spec. Emotional accuracy converts; manufactured fear and false scarcity get the account suspended.
- REQUIRED FOR FREE LISTINGS on every product: [id], [title], [link], [image_link], [price], [description], [availability], plus [brand], plus [gtin] if the manufacturer assigned one or [mpn] if not. [item_group_id] is required for every size/colour variant.
- RECOMMENDED STRUCTURED DATA to add: Offer.shippingDetails (OfferShippingDetails with shippingRate, shippingDestination, deliveryTime including handlingTime and transitTime) and an Organization-level MerchantReturnPolicy with merchantReturnDays=100 for the trial. Product structured data must be in the initial server-rendered HTML, and Offer.sku must exactly match feed [id].
- IMAGES: no overlays, watermarks, logos, borders, padding, calls-to-action or price information burned into any image — a named disapproval cause. lifestyle_image_link: up to 5 images, minimum 600x600px, max 16MB and 64 megapixels. Upgrade all [image_link] and [additional_image_link] to 500x500px minimum ahead of 31 January 2027 enforcement.
- NO KEYWORD STUFFING on-page. Google defines it as 'unnatural repetition of words/phrases'. Each of the 64 pages must say something specifically true about that bed — 64 templated near-duplicates stuffed with the same phrase is scaled content abuse.
- USE PROFESSIONAL, GRAMMATICALLY CORRECT UK ENGLISH throughout. Google states this requirement explicitly for title, description, product_highlight and product_detail alike.
- custom_label_0 to custom_label_4: 100 characters each, invisible to shoppers, for bid segmentation only. Never put keywords or copy in them.
- CHARACTER LIMIT QUICK REFERENCE: id 50 | title / structured_title 150 | description / structured_description 5,000 | link / image_link / additional_image_link / lifestyle_image_link 2,000 | brand 70 | mpn 70 | material 200 | product_type 750 | custom_label_0-4 100 each | item_group_title 150 | product_highlight 150 per highlight (max 100) | product_detail 150 per detail (max 100) | sale_price_effective_date 51 | question_and_answer 10,000 total (max 30 pairs) | variant_option 5,000 total (max 30).
