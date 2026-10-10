// Fixture catalogue for the Lunova dev harness.
//
// Product names, handles, "from" prices and the "why" copy come from the
// PawLunova BEDS data in /assets/app.js. Variant ladders, inventory, tags and
// metafields are FIXTURE data shaped to exercise the theme's levers
// (default size, low stock, sold out, compare-at, ratings, finder tags).
// `custom` / `variantCustom` hold custom.* metafields in Admin API shape
// ({key: {type, value}}, typed by fixtures/store.mjs metafieldDrop): Coniston (low
// entry, with its real subtitle, "Worth it?" and Q&A), Ambleside (guarantee memory
// foam with a density), Langdale (egg-crate, foam_guarantee false), Kendal (partner
// warehouse, no dispatch days) and the Windermere cooling bed (partner, 3 to 5 days).
// The ratings below are test data for the rating snippet only, they are not
// store claims and never leave the harness.
//
// Deliberately realistic mess, lifted from README lessons on the live store:
//  - the orthopaedic collection's title is the old SEO title with pipes, and
//    its description opens with its own <h1>;
//  - the Borrowdale's only size is labelled "l" (lowercase);
//  - the Rydal runs to "2XL";
//  - one product has no images at all; one is entirely sold out;
//  - one variant is tracked with 2 left (low stock), one sells on backorder.

export const SHOP = {
  name: 'PawLunova',
  email: 'hello@pawlunova.co.uk',
  domain: 'pawlunova.co.uk',
  permanent_domain: '6maurr-uw.myshopify.com',
  description: 'Orthopaedic memory-foam dog beds, named for the Lakes and built for real sleep. 100-night trial, free UK delivery over £40.',
  currency: 'GBP',
  money_format: '£{{amount}}',
  money_with_currency_format: '£{{amount}} GBP',
};

const LADDER = (from, n, step = 2000) => Array.from({ length: n }, (_, i) => from + i * step);

/** Raw product specs. Prices in pence. */
export const PRODUCTS = [
  {
    key: 'buttermere_boucle',
    title: 'The Buttermere Bouclé Nest Bed',
    handle: 'buttermere-boucle-nest-dog-bed',
    type: 'Nest bed',
    images: [['buttermere_boucle.jpg', 'The Buttermere Bouclé Nest Bed, a deep-walled cream nest bed']],
    why: 'Deep bouclé walls to lean into and a cloud-soft nest to sink into, the bed your dog has been trying to build out of your cushions. Made for the dog who circles twice and curls tight.',
    tagline: 'For the dog who circles twice and curls tight',
    best_for: 'Curlers',
    options: [['Size', ['Small', 'Medium', 'Large']], ['Colour', ['Cream', 'Mink']]],
    prices: { Small: 6900, Medium: 8900, Large: 10900 },
    tags: ['finder:curl', 'finder:fine', 'best-for:Curlers', 'nest'],
    rating: [4.7, 38],
    created_at: '2025-03-04T10:00:00Z',
  },
  {
    key: 'windermere_nest',
    title: 'The Windermere Nest Orthopaedic Bed',
    handle: 'windermere-high-wall-nest-bed',
    type: 'Nest bed',
    images: [['windermere_nest.jpg', 'The Windermere Nest Orthopaedic Dog Bed with high walls, in a bright room']],
    why: 'High walls to burrow into, over an orthopaedic base that does not flatten. For the dog who tucks their nose under their tail and wants something solid at their back, and whose mornings have started getting slower.',
    options: [['Size', ['Small', 'Medium', 'Large']]],
    prices: { Small: 6900, Medium: 8400, Large: 9900 },
    tags: ['finder:curl', 'finder:slowing', 'nest', 'orthopaedic', 'guarantee:yes'],
    created_at: '2025-02-11T10:00:00Z',
  },
  {
    key: 'coniston_ortho',
    title: 'Coniston Orthopaedic Dog Bed',
    handle: 'coniston-orthopaedic-dog-bed',
    type: 'Orthopaedic bed',
    images: [
      ['coniston_ortho.jpg', 'Coniston Orthopaedic Dog Bed with a dog resting inside'],
      ['coniston_rev.jpg', 'The Coniston from the side, showing the raised walls'],
    ],
    why: 'Pressure-relief support built for the dog who has met you at the door for years, and for whom getting up is now the hard part. Raised sides to curl against, memory foam underneath for the joints.',
    tagline: 'For the dog for whom getting up is now the hard part',
    best_for: 'Stiff mornings',
    benefits: ['Memory foam that takes their shape', 'Raised sides to curl against', 'Removable, machine-washable cover'],
    specs: 'Foam: memory foam\nCover: Removable, 30°C wash\nBase: Non-slip',
    care: 'Unzip the cover and wash at 30°C.\nAir the foam in a dry room; never put it in the machine.',
    options: [['Size', ['Small', 'Medium', 'Large']]],
    prices: { Small: 9900, Medium: 11900, Large: 13900 },
    compare: { Medium: 13900 },
    mostChosen: 'Medium',
    inventory: { Medium: { qty: 14, policy: 'deny' } },
    tags: ['finder:curl', 'finder:diagnosed', 'best-for:Stiff mornings', 'badge:Most popular', 'orthopaedic', 'nest', 'guarantee:yes'],
    rating: [4.8, 126],
    created_at: '2024-11-20T10:00:00Z',
    // The low-entry bed: Coniston's real custom.* values (fixtures/real-metafields.json),
    // so non-real tests see the subtitle, "Worth it?", Q&A, liner and low-entry elements.
    custom: {
      subtitle: {"type": "single_line_text_field", "value": "A low step in for stiff legs, and memory foam to settle into."},
      core_type: {"type": "single_line_text_field", "value": "Memory foam"},
      foam_guarantee: {"type": "boolean", "value": "true"},
      feel: {"type": "number_integer", "value": "3"},
      has_liner: {"type": "boolean", "value": "true"},
      cover_type: {"type": "single_line_text_field", "value": "Zip-off fabric"},
      low_entry: {"type": "boolean", "value": "true"},
      sleep_style: {"type": "list.single_line_text_field", "value": "[\"Curls up\",\"Head on the edge\"]"},
      shape: {"type": "single_line_text_field", "value": "Bolster & sofa"},
      ships_from: {"type": "single_line_text_field", "value": "Own stock"},
      worth_it: {"type": "multi_line_text_field", "value": "A cheaper bed that goes flat by spring means buying another next winter, and a dog on the floor in between. Coniston's memory foam is guaranteed for 5 years: about 6p a night on the Small, under 10p on the Large. And you've got 100 nights at home to be sure."},
      qa: {"type": "json", "value": "[{\"q\":\"My dog is 12 and stiff in the mornings. Is Coniston too soft?\",\"a\":\"It's a medium feel: memory foam so hips and elbows sink in a little, firm enough that they can push up to stand. The low front means no climbing. If it isn't right, you have 100 nights to send it back.\"},{\"q\":\"Will my Labrador fit the Large?\",\"a\":\"If they sleep curled up, the Large is the one to look at: it is 97 × 76cm outside, and the rim takes up part of that. If they sprawl flat out, look at Ambleside or Grasmere. Send me a photo of them asleep and I'll tell you honestly.\"},{\"q\":\"What if they ignore it?\",\"a\":\"Some dogs claim a new bed the first night, some take a fortnight. Put it where they already sleep, with a blanket that smells of home on top. If it still isn't theirs inside 100 nights, we collect it free and refund you in full.\"},{\"q\":\"How do I wash it?\",\"a\":\"Unzip the cover and wash it following the sewn-in care label. The waterproof liner keeps accidents off the foam, so you never wash the foam itself.\"},{\"q\":\"When will it arrive?\",\"a\":\"You'll see the dates above the button before you order.\"}]"},
      entry_height_cm: { type: 'number_integer', value: '9' }
    },
    variantCustom: {
      Small: { sleep_area: { type: 'single_line_text_field', value: '48 × 38cm' }, suits_breeds: { type: 'single_line_text_field', value: 'Jack Russell, Dachshund, Pug, Shih Tzu' }, suits_weight: { type: 'single_line_text_field', value: 'Up to 10kg' } },
      Medium: { sleep_area: { type: 'single_line_text_field', value: '62 × 50cm' }, suits_breeds: { type: 'single_line_text_field', value: 'Cocker, Springer, Border Collie, Staffie' }, suits_weight: { type: 'single_line_text_field', value: '10–25kg' } },
      Large: { sleep_area: { type: 'single_line_text_field', value: '80 × 60cm' }, suits_breeds: { type: 'single_line_text_field', value: 'Labrador and Retriever who curl up' }, suits_weight: { type: 'single_line_text_field', value: '25–40kg' } },
    },
  },
  {
    key: 'langdale',
    title: 'The Langdale Raised-Edge Orthopaedic Bed',
    handle: 'dog-bed-kimba-orthopaedic-thick-padding-raised-edge',
    type: 'Orthopaedic bed',
    images: [['langdale.jpg', 'The Langdale Raised-Edge Orthopaedic Dog Bed with a large dog stretched across it']],
    why: 'A raised edge to lean into and a firm orthopaedic base that holds its shape, built for a big dog who curls, and whose joints need the support to still be there in year five.',
    options: [['Size', ['Medium', 'Large', 'XL']]],
    prices: { Medium: 10900, Large: 13900, XL: 16900 },
    inventory: { Large: { qty: 2, policy: 'deny' } },
    tags: ['finder:curl', 'finder:diagnosed', 'orthopaedic', 'guarantee:yes'],
    created_at: '2024-09-02T10:00:00Z',
    // The egg-crate bed: custom.foam_guarantee false beats the guarantee:yes tag, so
    // no guarantee, per-night or density element may show for it.
    custom: {
      subtitle: { type: 'single_line_text_field', value: 'Profiled egg-crate foam that spreads their weight, under a raised edge.' },
      core_type: { type: 'single_line_text_field', value: 'Egg-crate foam' },
      foam_guarantee: { type: 'boolean', value: 'false' },
      cover_type: { type: 'single_line_text_field', value: 'Zip-off fabric' },
      shape: { type: 'single_line_text_field', value: 'Bolster & sofa' },
      ships_from: { type: 'single_line_text_field', value: 'Own stock' },
    },
  },
  {
    key: 'harrogate',
    title: 'The Harrogate Heritage Dog Bed',
    handle: 'harrogate-heritage-dog-bed',
    type: 'Bolster bed',
    images: [['harrogate.jpg', 'The Harrogate Heritage Dog Bed with a golden retriever asleep on it']],
    why: 'Deep charcoal sides, warm beige trim, and a bolster on every side to hook a chin over. Our most-reviewed bed, and the one owners of healthy, happy leaners keep coming back for.',
    tagline: 'A bolster on every side to hook a chin over',
    best_for: 'Leaners',
    options: [['Size', ['Small', 'Medium', 'Large', 'XL']], ['Colour', ['Charcoal', 'Oat']]],
    prices: { Small: 6900, Medium: 8900, Large: 10900, XL: 12900 },
    mostChosen: 'Medium',
    tags: ['finder:lean', 'finder:fine', 'best-for:Leaners', 'badge:Most popular', 'bolster'],
    rating: [4.9, 212],
    created_at: '2024-06-15T10:00:00Z',
  },
  {
    key: 'grasmere_sofa',
    title: 'The Grasmere Bolster Sofa Dog Bed',
    handle: 'the-grasmere-bolster-sofa-dog-bed',
    type: 'Bolster bed',
    images: [['grasmere_sofa.jpg', 'The Grasmere Bolster Sofa Dog Bed with an older dog resting its head on the bolster']],
    why: 'Built for the dog who does not curl up, they collapse, legs everywhere, chin hooked over the arm. The raised bolster takes the weight off the neck and shoulders as they start to stiffen.',
    options: [['Size', ['Small', 'Medium', 'Large']]],
    prices: { Small: 7900, Medium: 9900, Large: 11900 },
    tags: ['finder:lean', 'finder:slowing', 'bolster'],
    created_at: '2025-01-08T10:00:00Z',
  },
  {
    key: 'grasmere_ortho',
    title: 'The Grasmere Orthopaedic Sofa Bed',
    handle: 'the-grasmere-orthopaedic-sofa-bed',
    type: 'Orthopaedic bed',
    images: [['grasmere_ortho.jpg', 'The Grasmere Orthopaedic Sofa Bed in a warm living room']],
    why: 'A proper sofa shape over an orthopaedic core, so there is a bolster to lean on and real support underneath. The one we point diagnosed dogs towards when they still want the sofa silhouette.',
    options: [['Size', ['Small', 'Medium', 'Large']]],
    prices: { Small: 8900, Medium: 10900, Large: 12900 },
    compare: { Small: 10900, Medium: 12900, Large: 14900 },
    tags: ['finder:lean', 'finder:diagnosed', 'orthopaedic', 'bolster', 'guarantee:yes'],
    rating: [4.6, 41],
    created_at: '2025-04-22T10:00:00Z',
  },
  {
    key: 'borrowdale',
    title: 'The Borrowdale Orthopaedic Dog Bed',
    handle: 'the-borrowdale-orthopaedic-dog-bed',
    type: 'Orthopaedic bed',
    images: [['borrowdale.jpg', 'The Borrowdale Orthopaedic Dog Bed, a four-sided bolster memory foam bed']],
    why: 'He used to drop. Now he lowers himself. Four-sided bolster over a 50kg/m³ memory foam core, something to lean into whichever way he turns, and support that will not bottom out under a big dog.',
    descriptionExtra: '<p>Large 90 x 65cm, internal 68 x 45cm, Border Collie, Springer, Cocker, Sheltie. To 25kg.</p>',
    options: [['Size', ['l']]],
    prices: { l: 15400 },
    inventory: { l: { qty: 9, policy: 'deny' } },
    tags: ['finder:lean', 'finder:diagnosed', 'orthopaedic', 'bolster', 'guarantee:yes'],
    created_at: '2024-10-10T10:00:00Z',
  },
  {
    key: 'sprawler',
    title: 'The Sprawler Flat Orthopaedic Dog Bed',
    handle: 'dream-paws-geometric-bed-in-grey-modern-comfort-that-goes-with-everything',
    type: 'Mattress bed',
    images: [['sprawler.jpg', 'The Sprawler Flat Orthopaedic Dog Bed in a modern grey quilted finish']],
    why: 'No walls, no bolsters, nothing to get in the way, just a flat orthopaedic surface big enough to stretch out across. For the dog who wants the whole thing and none of the fuss.',
    options: [],
    prices: { 'Default Title': 5900 },
    tags: ['finder:sprawl', 'finder:fine', 'cooling', 'orthopaedic', 'guarantee:yes'],
    created_at: '2025-05-30T10:00:00Z',
  },
  {
    key: 'ambleside',
    title: 'Ambleside Memory Foam Bed',
    handle: 'ambleside-memory-foam-dog-bed',
    type: 'Mattress bed',
    images: [['ambleside.jpg', 'Ambleside Memory Foam Bed with a dog lying flat on its side']],
    why: 'Edge-to-edge memory foam, so there is no dead space and no half-on, half-off. Watch where he actually sleeps: flat on his side, legs at full stretch. This is the bed built for that dog as he starts to stiffen.',
    options: [['Size', ['Medium', 'Large', 'XL']]],
    prices: { Medium: 12400, Large: 15400, XL: 18400 },
    inventory: { XL: { qty: 0, policy: 'continue' } },
    tags: ['finder:sprawl', 'finder:slowing', 'orthopaedic', 'guarantee:yes'],
    created_at: '2024-08-01T10:00:00Z',
    // The guarantee memory foam bed with a stated density and its own dispatch days.
    custom: {
      subtitle: { type: 'single_line_text_field', value: 'Edge-to-edge memory foam for the dog who sleeps flat out.' },
      core_type: { type: 'single_line_text_field', value: 'Memory foam' },
      foam_guarantee: { type: 'boolean', value: 'true' },
      density_kg_m3: { type: 'number_integer', value: '50' },
      foam_depth: { type: 'single_line_text_field', value: 'M 8cm · L 10cm · XL 10cm' },
      wash_temp: { type: 'number_integer', value: '30' },
      non_slip: { type: 'boolean', value: 'true' },
      cover_type: { type: 'single_line_text_field', value: 'Zip-off fabric' },
      sleep_style: { type: 'list.single_line_text_field', value: '["Stretches out"]' },
      shape: { type: 'single_line_text_field', value: 'Mattress' },
      ships_from: { type: 'single_line_text_field', value: 'Own stock' },
      dispatch_days_min: { type: 'number_integer', value: '1' },
      dispatch_days_max: { type: 'number_integer', value: '2' },
      ships_same_day: { type: 'boolean', value: 'false' },
    },
  },
  {
    key: 'kendal_cord',
    title: 'The Kendal Corduroy Orthopaedic Bed',
    handle: 'kendal-corduroy-orthopaedic-dog-bed',
    type: 'Orthopaedic bed',
    images: [['kendal_cord.jpg', 'The Kendal Corduroy Orthopaedic Bed in a bright living room']],
    why: 'Our most supportive build, for the dog whose mornings have got slower. A pause at the bottom of the stairs, a longer stretch before the first step, this is the bed we make for exactly that, with room to sprawl right across it.',
    best_for: 'Big sprawlers',
    options: [['Size', ['Medium', 'Large', 'XL']], ['Colour', ['Moss', 'Stone']]],
    prices: { Medium: 16900, Large: 19400, XL: 21900 },
    inventory: { 'XL / Stone': { qty: 0, policy: 'deny' } },
    tags: ['finder:sprawl', 'finder:diagnosed', 'best-for:Big sprawlers', 'orthopaedic', 'guarantee:yes'],
    rating: [4.6, 54],
    created_at: '2024-07-19T10:00:00Z',
    // The partner-warehouse bed with no dispatch days: no delivery dates at all.
    custom: {
      core_type: { type: 'single_line_text_field', value: 'Memory foam' },
      foam_guarantee: { type: 'boolean', value: 'true' },
      shape: { type: 'single_line_text_field', value: 'Mattress' },
      ships_from: { type: 'single_line_text_field', value: 'Partner warehouse' },
    },
  },
  {
    key: 'rydal_nest',
    title: 'The Rydal High-Sided Nest Bed',
    handle: 'the-rydal-high-sided-nest-dog-bed',
    type: 'Nest bed',
    images: [
      ['rydal_nest.jpg', 'The Rydal High-Sided Nest Bed with a large dog curled inside'],
      ['rydal_plush.jpg', 'Close-up of the Rydal textured plush'],
    ],
    why: 'A nest that keeps going up the size range, high plush sides for the big dog who still sleeps like a puppy, curled nose to tail.',
    options: [['Size', ['S', 'M', 'L', 'XL', '2XL']]],
    prices: Object.fromEntries(['S', 'M', 'L', 'XL', '2XL'].map((s, i) => [s, LADDER(7400, 5, 1500)[i]])),
    tags: ['finder:curl', 'finder:fine', 'nest'],
    created_at: '2025-06-12T10:00:00Z',
  },
  {
    key: 'wensleydale',
    title: 'The Wensleydale Nesting Bed',
    handle: 'wensleydale-nesting-bed',
    type: 'Nest bed',
    images: [['wensleydale.jpg', 'The Wensleydale Nesting Bed in oatmeal']],
    why: 'Soft, low walls and a deep fill for small dogs who like to be held while they sleep.',
    options: [['Size', ['Small', 'Medium']]],
    prices: { Small: 7900, Medium: 9400 },
    inventory: { Small: { qty: 0, policy: 'deny' }, Medium: { qty: 0, policy: 'deny' } },
    tags: ['finder:curl', 'finder:fine', 'nest'],
    created_at: '2024-12-01T10:00:00Z',
  },
  {
    key: 'windermere_cooling',
    title: 'Windermere Elevated Cooling Bed',
    handle: 'windermere-elevated-cooling-dog-bed',
    type: 'Cooling bed',
    images: [],
    why: 'A raised mesh frame that lets air move underneath, so the surface your dog lies on stays cooler than the floor. No freezing, no plugs, no batteries.',
    options: [['Size', ['Medium', 'Large']]],
    prices: { Medium: 5900, Large: 7900 },
    tags: ['cooling'],
    created_at: '2025-07-01T10:00:00Z',
    // A partner-warehouse bed that does state its dispatch days: dates, partner wording, no Express.
    custom: {
      core_type: { type: 'single_line_text_field', value: 'Mesh' },
      shape: { type: 'single_line_text_field', value: 'Elevated' },
      ships_from: { type: 'single_line_text_field', value: 'Partner warehouse' },
      dispatch_days_min: { type: 'number_integer', value: '3' },
      dispatch_days_max: { type: 'number_integer', value: '5' },
    },
  },
];

export const COLLECTIONS = [
  {
    handle: 'orthopaedic-dog-beds',
    title: 'Orthopaedic Dog Beds UK | Memory Foam Joint Support | Pawlunova',
    description:
      '<h1>Orthopaedic dog beds</h1><p>Every bed here sits on 50kg/m³ memory foam, dense enough to hold its shape under a big dog, year after year. Pressure-relieving support for ageing joints, in the shape your dog actually sleeps in.</p><h2>How to choose</h2><p>Watch how they sleep tonight: curled, leaning, or sprawled. That decides the shape; their weight decides the size.</p>',
    image: 'kendal_cord.jpg',
    products: ['coniston_ortho', 'langdale', 'grasmere_ortho', 'borrowdale', 'sprawler', 'ambleside', 'kendal_cord', 'windermere_nest'],
  },
  {
    handle: 'nest-beds',
    title: 'Nest Beds',
    description: '<p>High walls to burrow into and something solid at their back, for the dog who circles twice and curls tight.</p>',
    image: 'rydal_nest.jpg',
    products: ['buttermere_boucle', 'windermere_nest', 'coniston_ortho', 'langdale', 'rydal_nest', 'wensleydale'],
  },
  {
    handle: 'cooling',
    title: 'Cooling Dog Beds',
    description:
      '<p>British summers are short, but they are not gentle, and a dog carrying a double coat feels every degree. The Cooling Collection is built around materials that move heat away from your dog instead of trapping it: open mesh and raised frames that let air pass underneath. No freezing, no plugs, no batteries.</p>',
    image: null,
    products: ['windermere_cooling', 'sprawler'],
  },
  {
    handle: 'gifts',
    title: 'Gifts',
    description: '',
    image: null,
    products: [],
  },
];

export const PAGES = [
  {
    handle: 'about',
    title: 'Our story',
    template_suffix: 'about',
    content: '<p>PawLunova started with one old Labrador and a bed that went flat in a month. Every bed we make now is named for a place in the Lakes and built around one test: is the support still there in year five?</p><h2>Named for the Lakes, built for real sleep</h2><p>We use 50kg/m³ memory foam because it holds its shape under real dogs, and covers you can unzip and wash.</p>',
  },
  {
    handle: 'contact',
    title: 'Contact',
    template_suffix: 'contact',
    content: '<p>Questions about sizing, delivery or your 100-night trial? We answer every message ourselves, usually the same working day.</p>',
  },
  {
    handle: 'faq',
    title: 'Questions, answered',
    template_suffix: 'faq',
    content: '<p>The things owners ask us most, in the order they usually ask them.</p>',
  },
  {
    handle: 'bed-finder',
    title: "Find your dog's bed",
    template_suffix: 'bed-finder',
    content: '<p>Four quick questions, how they sleep, how their joints are, how big they are, and we will point you at one bed in the right size.</p>',
  },
  {
    handle: 'delivery-returns',
    title: 'Delivery & returns',
    template_suffix: null,
    content:
      '<h2>Delivery</h2><p>Free UK delivery on orders over £40. Orders placed before 3pm Monday to Friday are dispatched the same day.</p><table><thead><tr><th>Service</th><th>Time</th><th>Cost</th></tr></thead><tbody><tr><td>Standard</td><td>1–3 working days</td><td>£4.95, free over £40</td></tr></tbody></table><h2>Returns</h2><p>Sleep on it for 100 nights. If it is not right, we collect it free and refund every penny.</p>',
  },
];

export const BLOGS = [
  {
    handle: 'journal',
    title: 'The Journal',
    articles: [
      {
        handle: 'signs-your-dogs-bed-has-stopped-supporting-them',
        title: "Five signs your dog's bed has stopped supporting them",
        author: 'The PawLunova team',
        image: 'langdale.jpg',
        tags: ['Joints', 'Guides'],
        published_at: '2026-08-14T08:00:00Z',
        excerpt: '<p>A pause at the bottom of the stairs, a longer stretch before the first step. Here is what to look for, and what a supportive bed physically does about it.</p>',
        content:
          '<p>A pause at the bottom of the stairs, a longer stretch before the first step. These are the small changes owners notice first.</p><h2>1. They sleep on the floor instead</h2><p>If the bed has bottomed out, the floor feels no different, so they stop bothering.</p><h2>2. The dip</h2><p>Press the middle of the bed. If you can feel the floor through it, so can they.</p><blockquote><p>He used to drop. Now he lowers himself.</p></blockquote>',
      },
      {
        handle: 'sizing-a-dog-bed-measure-the-sprawl',
        title: 'Sizing a dog bed: measure the sprawl, not the dog',
        author: 'The PawLunova team',
        image: null,
        tags: ['Sizing'],
        published_at: '2026-07-02T08:00:00Z',
        excerpt: '',
        content:
          '<p>Measure your dog lying flat out, nose to the base of the tail, then add 15–20cm. Curlers can go a size down; sprawlers never should.</p><ul><li>Under 10kg: Small</li><li>10–25kg: Medium</li><li>25–40kg: Large</li><li>40kg+: Extra large</li></ul>',
        comments: [
          { author: 'Ellie', email: 'ellie@example.com', content: '<p>This saved us ordering the wrong size for our Springer.</p>', created_at: '2026-07-03T09:12:00Z' },
        ],
      },
    ],
  },
];

export const MENUS = {
  'main-menu': {
    title: 'Main menu',
    links: [
      {
        title: 'Shop beds',
        url: '/collections/all',
        links: [
          { title: 'Orthopaedic beds', url: '/collections/orthopaedic-dog-beds' },
          { title: 'Nest beds', url: '/collections/nest-beds' },
          { title: 'Cooling beds', url: '/collections/cooling' },
          { title: 'Shop all beds', url: '/collections/all' },
        ],
      },
      { title: 'Find my bed', url: '/pages/bed-finder' },
      { title: 'Our story', url: '/pages/about' },
      { title: 'FAQ', url: '/pages/faq' },
      { title: 'Contact', url: '/pages/contact' },
    ],
  },
  footer: {
    title: 'Footer menu',
    links: [
      { title: 'Shop all beds', url: '/collections/all' },
      { title: 'Find my bed', url: '/pages/bed-finder' },
      { title: 'Delivery & returns', url: '/pages/delivery-returns' },
      { title: 'FAQ', url: '/pages/faq' },
      { title: 'Journal', url: '/blogs/journal' },
      { title: 'Contact', url: '/pages/contact' },
      { title: 'Search', url: '/search' },
    ],
  },
};

/** What a brand-new Shopify store ships with (zero-products mode). */
export const EMPTY_MENUS = {
  'main-menu': {
    title: 'Main menu',
    links: [
      { title: 'Home', url: '/' },
      { title: 'Catalog', url: '/collections/all' },
      { title: 'Contact', url: '/pages/contact' },
    ],
  },
  footer: { title: 'Footer menu', links: [{ title: 'Search', url: '/search' }] },
};

export const POLICIES = [
  { handle: 'refund-policy', title: 'Refund policy', body: '<p>Sleep on it for 100 nights. If it is not right, we collect it free and refund every penny.</p>' },
  { handle: 'privacy-policy', title: 'Privacy policy', body: '<p>We only use your details to deliver your order and, if you ask us to, to send you our emails.</p>' },
  { handle: 'terms-of-service', title: 'Terms of service', body: '<p>These terms apply to orders placed with PawLunova.</p>' },
  { handle: 'shipping-policy', title: 'Shipping policy', body: '<p>Free UK delivery on orders over £40.</p>' },
  { handle: 'contact-information', title: 'Contact information', body: '<p>hello@pawlunova.co.uk</p>' },
];

export const CUSTOMER = {
  id: 7100000001,
  first_name: 'Sam',
  last_name: 'Whitfield',
  email: 'sam@example.com',
  phone: null,
  accepts_marketing: true,
  tags: [],
  addresses: [
    {
      id: 9100000001,
      first_name: 'Sam',
      last_name: 'Whitfield',
      company: '',
      address1: '12 Lakeside Road',
      address2: '',
      city: 'Kendal',
      province: 'Cumbria',
      province_code: '',
      zip: 'LA9 4AB',
      country: 'United Kingdom',
      country_code: 'GB',
      phone: '',
    },
  ],
  orders: [
    {
      id: 5500000001,
      name: '#1001',
      order_number: 1001,
      created_at: '2026-09-12T14:22:00Z',
      financial_status: 'paid',
      fulfillment_status: 'fulfilled',
      lines: [['coniston_ortho', 'Medium', 1]],
    },
  ],
};
