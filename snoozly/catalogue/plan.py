#!/usr/bin/env python3
"""
Snoozly catalogue plan: names, sleep needs, collections, options and prices
for the 64 beds imported from the PawLunova export.

    python3 snoozly/catalogue/plan.py        # writes plan.json + price-review.csv

Everything a product needs apart from its copy is decided here, in one table,
so the rules can be read, checked and re-run.

NAMING. Every bed gets one short name from a family that tells you its sleep
need at a glance, then a plain description a shopper would search for:

    Support  → trees      (Oak, Ash, Cedar…)      they hold you up
    Calm     → birds      (Wren, Robin, Linnet…)  they build nests
    Cosy     → burrowers  (Dormouse, Badger…)     they curl up somewhere soft
    Cool     → water/air  (Breeze, Brook…)        air moves, heat goes
    Stretch  → meadow     (Clover, Fern, Moss…)   open ground to sprawl on
    Outdoor  → shore/huts (Cove, Shore, Bothy…)   garden day beds and houses,
                                                  no sleep-need badge

PRICING ("value first"). PawLunova's price is the anchor.
  * Known cost: aim ~12% under the anchor, on Snoozly's price ladder, but never
    below a 30% margin after UK VAT (price / 1.2 − cost ≥ 30% of price / 1.2).
    If the anchor itself was under that margin, the price rises to the floor
    and the line is flagged RAISED.
  * Cost unknown: one price point under the anchor, flagged COST-MISSING.
  * Within a product, a size PawLunova charged more for always costs at
    least one price point more than the size below it.
No "was" prices are set: Snoozly has never sold at PawLunova's prices, and a
reference price you have not charged is misleading under UK consumer law.
"""
import csv
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent

VAT = 1.2
MARGIN_FLOOR = 0.30
KNOWN_COST_CUT = 0.88
LADDER = [39, 44, 49, 54, 59, 64, 69, 74, 79, 84, 89, 94, 99, 109, 119, 129, 139, 149,
          159, 169, 179, 189, 199, 219, 229, 249, 269, 279, 299, 329, 349, 379, 399]

TYPES = {
    'ortho': 'Orthopaedic Dog Beds',
    'sofa': 'Dog Sofas & Chaises',
    'mattress': 'Dog Mattresses',
    'nest': 'Bolster & Nest Beds',
    'elevated': 'Elevated Dog Beds',
    'crate': 'Crate & Travel Beds',
    'daybed': 'Outdoor Day Beds',
    'kennel': 'Dog Kennels',
    'personal': 'Personalised Dog Beds',
}

# id: (name, description, type, needs (first = primary, badge colour), ranges)
# ranges → tags:  sofa → range:sofa,  crate → range:crate-travel,
#                 outdoor → range:outdoor,  wp → feature:waterproof,  large → size:large
PLAN = {
    1:  ('Oak', '24cm Gel Memory Foam Orthopaedic Dog Bed', 'ortho', ['support', 'stretch'], ['large']),
    2:  ('Swallow', 'Memory Foam Dog Car Seat', 'crate', ['calm'], ['crate']),
    3:  ('Walnut', 'Velvet Memory Foam Dog Bed', 'ortho', ['support'], []),
    4:  ('Cedar', 'Memory Foam Dog Mattress with Raised Headrest', 'mattress', ['support', 'stretch'], ['large', 'wp']),
    5:  ('Fern', 'Waterproof Pillow Dog Mattress', 'mattress', ['stretch'], ['large', 'wp']),
    6:  ('Ash', 'XL Orthopaedic Bolster Dog Bed', 'ortho', ['support'], ['large', 'wp']),
    7:  ('Hazel', 'Memory Foam Nest Dog Sofa', 'sofa', ['support', 'calm'], ['sofa']),
    8:  ('Elm', 'XL Orthopaedic Dog Sofa Bed', 'sofa', ['support'], ['sofa', 'large', 'wp']),
    9:  ('Rowan', 'Memory Foam Bolster Dog Bed', 'ortho', ['support'], []),
    10: ('Chestnut', 'Tweed Orthopaedic Dog Mattress', 'mattress', ['support', 'stretch'], ['large']),
    11: ('Holly', 'Orthopaedic Dog Sofa Bed', 'sofa', ['support', 'calm'], ['sofa', 'wp']),
    12: ('Yew', 'Memory Foam Bolster Dog Bed', 'ortho', ['support'], ['large']),
    13: ('Larch', 'XXL Memory Foam Bolster Dog Bed', 'ortho', ['support'], ['large']),
    14: ('Linnet', 'Stonewashed Bolster Dog Bed', 'nest', ['calm', 'cosy'], []),
    15: ('Moss', 'Sherpa Pillow Dog Mattress', 'mattress', ['stretch'], ['large']),
    16: ('Beech', 'XXL Memory Foam Bolster Dog Bed', 'ortho', ['support'], ['large']),
    17: ('Magpie', 'Houndstooth Bolster Dog Bed', 'nest', ['calm'], ['large']),
    18: ('Alder', 'Corner Orthopaedic Dog Bed', 'ortho', ['support', 'calm'], ['wp']),
    19: ('Sedge', 'Herringbone Pillow Dog Mattress', 'mattress', ['stretch'], ['large']),
    20: ('Maple', 'Orthopaedic Chaise Dog Bed', 'sofa', ['support', 'stretch'], ['sofa', 'large']),
    21: ('Curlew', 'Tartan Bolster Dog Bed', 'nest', ['calm'], ['large', 'wp']),
    22: ('Birch', 'Bouclé Memory Foam Nest Dog Bed', 'nest', ['support', 'calm', 'cosy'], ['large', 'wp']),
    23: ('Juniper', 'XL Orthopaedic Dog Sofa Bed', 'sofa', ['support', 'calm'], ['sofa', 'large', 'wp']),
    24: ('Wren', 'Herringbone Nest Dog Bed', 'nest', ['calm', 'cosy'], []),
    25: ('Hornbeam', 'XXL Orthopaedic Dog Sofa Bed', 'sofa', ['support', 'calm'], ['sofa', 'large', 'wp']),
    26: ('Harbour', 'XL Elevated Mesh Bolster Dog Bed', 'elevated', ['cool'], ['outdoor', 'large']),
    27: ('Aspen', 'Orthopaedic Chaise Dog Bed', 'sofa', ['support', 'calm'], ['sofa', 'wp']),
    28: ('Linden', 'XXL Orthopaedic Chaise Dog Bed', 'sofa', ['support', 'stretch'], ['sofa', 'large']),
    29: ('Hawthorn', 'XL Orthopaedic Bolster Dog Bed', 'ortho', ['support'], ['large', 'wp']),
    30: ('Blackthorn', 'Orthopaedic Bolster Dog Bed', 'ortho', ['support'], ['large', 'wp']),
    31: ('Willow', 'Memory Foam Bolster Dog Bed', 'ortho', ['support', 'calm'], ['wp']),
    32: ('Hare', 'Reversible Fleece & Canvas Dog Bed', 'mattress', ['cosy', 'stretch'], []),
    33: ('Robin', 'High-Sided Nest Dog Bed', 'nest', ['calm', 'cosy'], ['large']),
    34: ('Pine', 'Memory Foam Bolster Dog Sofa', 'sofa', ['support'], ['sofa', 'large']),
    35: ('Spruce', 'Corduroy Memory Foam Dog Bed', 'ortho', ['support', 'calm'], []),
    36: ('Fox', 'Personalised Plush Dog Bed', 'personal', ['cosy'], ['large']),
    37: ('Clover', 'Wipe-Clean Dog Crate Mat', 'crate', ['stretch'], ['crate', 'wp']),
    38: ('Cypress', 'Edge-to-Edge Memory Foam Dog Mattress', 'mattress', ['support', 'stretch'], ['large']),
    39: ('Poplar', 'Oval Memory Foam Dog Bed', 'ortho', ['support'], ['wp']),
    40: ('Dove', 'Felt Nest Dog Bed', 'nest', ['calm'], []),
    41: ('Brook', 'Elevated Mesh Dog Bed', 'elevated', ['cool', 'stretch'], ['outdoor', 'large']),
    42: ('Cove', 'Woven Canopy Dog Day Bed', 'daybed', [], ['outdoor']),  # shade only: source says a canopy doesn't stop overheating
    43: ('Otter', 'Velvet Nest Dog Bed', 'nest', ['cosy'], []),
    44: ('Whitebeam', 'Memory Foam Dog Mattress', 'mattress', ['support', 'stretch'], ['large']),
    45: ('Breeze', 'Elevated Cooling Dog Bed', 'elevated', ['cool', 'stretch'], ['outdoor', 'large']),
    46: ('Elder', 'Memory Foam Dog Sofa', 'sofa', ['support'], ['sofa']),
    47: ('Cherry', 'Memory Foam Bolster Dog Bed', 'ortho', ['support', 'calm'], []),
    48: ('Dormouse', 'Sherpa Nest Dog Bed', 'nest', ['cosy'], []),
    49: ('Heron', 'Waterproof Nest Dog Bed', 'nest', ['calm'], ['wp']),
    50: ('Bothy', 'Raised-Floor Dog House', 'kennel', [], ['outdoor']),
    51: ('Shore', 'Woven Canopy Dog Day Bed', 'daybed', [], ['outdoor']),
    52: ('Lodge', 'Raised Dog Kennel with Ramp', 'kennel', [], ['outdoor']),
    53: ('Damson', 'Upholstered Orthopaedic Dog Sofa', 'sofa', ['support'], ['sofa', 'large']),
    54: ('Hedgehog', 'Bouclé Nest Dog Bed', 'nest', ['cosy'], []),
    55: ('Thrush', 'Plush Bolster Dog Bed', 'nest', ['calm', 'cosy'], ['large']),
    56: ('Badger', 'Deep Nest Dog Bed', 'nest', ['cosy'], []),
    57: ('Nightingale', 'Songbird Print Bolster Dog Bed', 'nest', ['calm'], []),
    58: ('Sparrow', 'Four-Sided Bolster Dog Bed', 'nest', ['calm'], ['large']),
    59: ('Finch', 'Bolster Dog Crate Bed', 'crate', ['calm'], ['crate', 'wp', 'large']),
    60: ('Sycamore', 'Raised-Edge Orthopaedic Dog Bed', 'ortho', ['support'], ['large']),
    61: ('Siskin', 'Sherpa High-Sided Nest Dog Bed', 'nest', ['calm', 'cosy'], []),
    62: ('Starling', 'Heritage Bolster Dog Bed', 'nest', ['calm'], ['large']),
    63: ('Heather', 'Geometric Dog Mattress', 'mattress', ['stretch'], ['large']),
    64: ('Bramble', 'Quilted Dog Crate Mattress', 'crate', ['stretch'], ['crate', 'large']),
}

FAMILY = {'support': 'tree', 'calm': 'bird', 'cosy': 'burrower', 'cool': 'water', 'stretch': 'meadow'}
PRIORITY = ['cool', 'support', 'calm', 'cosy', 'stretch']  # snippets/need-key.liquid
RANGE_TAGS = {'sofa': 'range:sofa', 'crate': 'range:crate-travel', 'outdoor': 'range:outdoor',
              'wp': 'feature:waterproof', 'large': 'size:large'}

# Option values that need more than the general clean-up below. Sizes use the
# supplier's listed dimensions where the source gives them.
SIZE_FIX = {
    1: {'xl-114-89-24-cm': 'XL · 114 × 89 × 24cm', 'large-91-69-24-cm': 'Large · 91 × 69 × 24cm'},
    5: {'Medium': 'Medium · 75 × 55 × 10cm', 'Large': 'Large · 95 × 75 × 12cm'},
    11: {'m-71-x-58-x-16-cm': 'Medium · 71 × 58 × 16cm', 'l-89-x-63-5-x-16-5cm': 'Large · 89 × 63.5 × 16.5cm'},
    12: {'l-96-71-16-5-cm': 'Large · 96 × 71 × 16.5cm', 'xl-104-x-68-5-x-16-5cm': 'XL · 104 × 68.5 × 16.5cm'},
    24: {'Small': 'Small · 50 × 40cm', 'Medium': 'Medium · 70 × 50cm', 'Large': 'Large · 90 × 60cm'},
}
# Sizes the source gives no measurements for. Listed in the review so the
# supplier's figures can be added; nothing is guessed.
SIZE_NOTES = {}
SIZE_ORDER = ['XS', 'Small', 'Medium', 'Large', 'XL', 'XXL', '3XL', 'One size']
COLOUR_FIX = {'gray': 'Grey', 'grey': 'Grey', 'beige': 'Beige', 'green': 'Green', 'dark grey': 'Dark Grey'}
IMAGE_EXCLUDE = {
    (11, 3): 'infographic headed "The Bedsure promise" (another brand)',
    (18, 4): '"Mekiy – for a happy, healthy life" watermark (another brand)',
    (35, 4): '"PAWLUNOVA" watermark',
}


def slug(s):
    s = s.lower().replace('&', 'and').replace('é', 'e')
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


def ladder_nearest(x):
    return min(LADDER, key=lambda p: (abs(p - x), p))


def ladder_below(x):
    below = [p for p in LADDER if p < x]
    return below[-1] if below else LADDER[0]


def margin(price, cost):
    net = price / VAT
    return (net - cost) / net


def ladder_floor(cost):
    for p in LADDER:
        if margin(p, cost) >= MARGIN_FLOOR - 0.0005:
            return p
    raise ValueError(cost)


def price_variant(anchor, cost):
    if cost:
        target = ladder_nearest(anchor * KNOWN_COST_CUT)
        if target >= anchor:
            target = ladder_below(anchor)
        floor = ladder_floor(cost)
        price = max(target, floor)
        flag = 'RAISED' if price > anchor else ('AT-FLOOR' if price == floor and floor > target else '')
        return price, flag
    return ladder_below(anchor), 'COST-MISSING'


def size_word(v):
    head = re.split(r'[·:]', v)[0].strip()
    head = {'Extra Large': 'XL', 'Extra large': 'XL'}.get(head, head)
    return head


def clean_size(pid, v):
    v = v.strip()
    if ':' in v:  # "Medium: Springer Spaniel | Cockapoo | Staffie"
        v = v.split(':')[0].strip()
    fixed = SIZE_FIX.get(pid, {}).get(v)
    if fixed:
        return fixed
    return v.replace('Extra Large', 'XL')


def clean_colour(v):
    return COLOUR_FIX.get(v.strip().lower(), v.strip().title())


def build():
    facts = {p['id']: p for p in json.load(open(HERE / 'facts.json'))}
    weights = {}
    for r in csv.DictReader(open(HERE / 'source-pawlunova-export.csv', encoding='utf-8-sig')):
        if r['Variant SKU'] and float(r['Variant Grams'] or 0) > 0:
            weights[r['Variant SKU']] = float(r['Variant Grams'])

    assert sorted(PLAN) == sorted(facts), 'plan must cover every product'
    names = [v[0] for v in PLAN.values()]
    assert len(set(names)) == len(names), 'names must be unique'

    out, review = [], []
    for pid, (name, desc, tkey, needs, ranges) in PLAN.items():
        src = facts[pid]
        title = f'{name} {desc}'
        handle = slug(title)
        # badge colour = highest-priority need tag, so primary must win
        if needs:
            assert min(needs, key=PRIORITY.index) == needs[0], f'{pid}: primary need would not win the badge'
        tags = [f'need:{n}' for n in needs] + ['pet:dog'] + [RANGE_TAGS[r] for r in ranges]
        if tkey == 'personal':
            tags.append('personalise:name')

        # ---- options ----
        onames = [o for o in src['options']]
        variants = []
        is_default = len(src['variants']) == 1 and src['variants'][0]['o'] == ['Default Title']
        if is_default:
            options = []
        else:
            kinds = ['colour' if re.search(r'colou?r', o, re.I) else 'size' for o in onames]
            order = sorted(range(len(kinds)), key=lambda i: 0 if kinds[i] == 'size' else 1)
            options = [{'size': 'Size', 'colour': 'Colour'}[kinds[i]] for i in order]
        for v in src['variants']:
            vals = []
            if not is_default:
                for i in order:
                    raw = v['o'][i]
                    vals.append(clean_size(pid, raw) if kinds[i] == 'size' else clean_colour(raw))
            anchor = float(v['price'])
            cost = float(v['cost']) if v.get('cost') else None
            variants.append({'values': vals, 'anchor': anchor, 'cost': cost, 'src_sku': v['sku'],
                             'img': v.get('img'), 'grams': weights.get(v['sku'])})

        # drop an option that only ever has one value when another option varies
        if len(options) > 1:
            keep = [i for i in range(len(options)) if len({tuple(x['values'])[i] for x in variants}) > 1]
            if keep and len(keep) < len(options):
                options = [options[i] for i in keep]
                for x in variants:
                    x['values'] = [x['values'][i] for i in keep]

        # sort by size ladder then colour
        def skey(x):
            if not options:
                return (0,)
            si = options.index('Size') if 'Size' in options else None
            w = size_word(x['values'][si]) if si is not None else ''
            rank = SIZE_ORDER.index(w) if w in SIZE_ORDER else 50
            return (rank, x['anchor'])
        variants.sort(key=skey)  # stable: colours keep the supplier's order

        # ---- prices ----
        for x in variants:
            x['price'], x['flag'] = price_variant(x['anchor'], x['cost'])
        # monotonic by anchor within the product; same anchor → same price
        by_anchor = {}
        for x in variants:
            by_anchor[x['anchor']] = max(by_anchor.get(x['anchor'], 0), x['price'])
        running = 0
        for a in sorted(by_anchor):
            if by_anchor[a] <= running:  # a bigger size must cost more, by one step
                by_anchor[a] = next(p for p in LADDER if p > running)
            running = by_anchor[a]
        for x in variants:
            if by_anchor[x['anchor']] != x['price']:
                x['flag'] = (x['flag'] + ' LADDER-BUMP').strip()
                x['price'] = by_anchor[x['anchor']]
        # and a bigger size never costs the same as a smaller one, even where the
        # source charged both the same (Ribble/Finch M and L were both £89)
        if 'Size' in options:
            si = options.index('Size')
            floor_price = 0
            for size in dict.fromkeys(x['values'][si] for x in variants):
                group = [x for x in variants if x['values'][si] == size]
                top = max(x['price'] for x in group)
                if top <= floor_price:
                    top = next(p for p in LADDER if p > floor_price)
                    for x in group:
                        x['flag'] = (x['flag'] + ' LADDER-BUMP').strip()
                for x in group:
                    x['price'] = top
                floor_price = top

        # ---- SKUs ----
        code = re.sub(r'[^A-Z]', '', name.upper())[:6]
        for x in variants:
            parts = ['SZ', code]
            for val, oname in zip(x['values'], options):
                if oname == 'Size':
                    w = size_word(val).upper().replace(' ', '')
                    parts.append({'SMALL': 'S', 'MEDIUM': 'M', 'LARGE': 'L', 'ONESIZE': 'OS'}.get(w, w))
                else:
                    parts.append(re.sub(r'[^A-Z]', '', val.upper())[:4])
            x['sku'] = '-'.join(parts)
        skus = [x['sku'] for x in variants]
        assert len(set(skus)) == len(skus), f'{pid}: duplicate SKU {skus}'

        images = []
        for i, im in enumerate(src['images'], 1):
            if (pid, i) in IMAGE_EXCLUDE:
                continue
            images.append(im['src'])

        entry = {
            'id': pid, 'src_title': src['title'], 'src_handle': src['handle'],
            'name': name, 'title': title, 'handle': handle,
            'family': FAMILY.get(needs[0], 'shelter') if needs else 'shelter',
            'type': TYPES[tkey], 'needs': needs, 'tags': tags,
            'options': options, 'variants': variants, 'images': images,
            'size_note': SIZE_NOTES.get(pid, ''),
        }
        out.append(entry)
        for x in variants:
            m_old = margin(x['anchor'], x['cost']) if x['cost'] else None
            m_new = margin(x['price'], x['cost']) if x['cost'] else None
            review.append({
                'id': pid, 'snoozly_title': title, 'variant': ' / '.join(x['values']) or 'One size',
                'sku': x['sku'], 'pawlunova_sku': x['src_sku'],
                'pawlunova_price': f"{x['anchor']:.2f}", 'snoozly_price': f"{x['price']:.2f}",
                'change_pct': f"{(x['price'] / x['anchor'] - 1) * 100:+.1f}",
                'cost': f"{x['cost']:.2f}" if x['cost'] else '',
                'margin_before': f'{m_old * 100:.0f}%' if m_old is not None else '',
                'margin_after': f'{m_new * 100:.0f}%' if m_new is not None else '',
                'flag': x['flag'],
            })

    (HERE / 'plan.json').write_text(json.dumps(out, indent=1, ensure_ascii=False))
    with open(HERE / 'price-review.csv', 'w', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=list(review[0]))
        w.writeheader()
        w.writerows(review)
    return out, review


if __name__ == '__main__':
    out, review = build()
    flags = {}
    for r in review:
        for f in (r['flag'] or 'OK').split():
            flags[f] = flags.get(f, 0) + 1
    down = sum(1 for r in review if float(r['change_pct']) < 0)
    up = sum(1 for r in review if float(r['change_pct']) > 0)
    same = len(review) - down - up
    print(f'{len(out)} products, {len(review)} variants: {down} cheaper, {same} same, {up} dearer')
    print('flags:', flags)
    old = sum(float(r['pawlunova_price']) for r in review)
    new = sum(float(r['snoozly_price']) for r in review)
    print(f'average variant price £{old / len(review):.2f} → £{new / len(review):.2f} ({(new / old - 1) * 100:+.1f}%)')
