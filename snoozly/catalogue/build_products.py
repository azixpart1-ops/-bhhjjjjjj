#!/usr/bin/env python3
"""
Turns plan.json + copy/NN.json into:

  products.jsonl                 one productSet input per line (bulk import)
  snoozly-products.csv           the same catalogue in Shopify's product CSV format
  preview/NN.html                each description as it will render (for review)

    python3 snoozly/catalogue/plan.py
    python3 snoozly/catalogue/validate_copy.py
    python3 snoozly/catalogue/build_products.py

Descriptions are assembled here, not written by hand, so every bed has the same
structure: value first, then what it is, what you get, who it suits, size, care.
"""
import csv
import html
import json
import os
from pathlib import Path

HERE = Path(__file__).resolve().parent

CATEGORY = {
    'orthopedic': 'gid://shopify/TaxonomyCategory/ap-2-9-8',
    'bolster': 'gid://shopify/TaxonomyCategory/ap-2-9-2',
    'nest': 'gid://shopify/TaxonomyCategory/ap-2-9-7',
    'pillow': 'gid://shopify/TaxonomyCategory/ap-2-9-11',
    'cot': 'gid://shopify/TaxonomyCategory/ap-2-9-10',
    'bed': 'gid://shopify/TaxonomyCategory/ap-2-9',
    'kennel': 'gid://shopify/TaxonomyCategory/ap-2-3-6',
}
CATEGORY_NAME = {
    'orthopedic': 'Animals & Pet Supplies > Pet Supplies > Pet Beds > Orthopedic Beds',
    'bolster': 'Animals & Pet Supplies > Pet Supplies > Pet Beds > Bolster Beds',
    'nest': 'Animals & Pet Supplies > Pet Supplies > Pet Beds > Nests',
    'pillow': 'Animals & Pet Supplies > Pet Supplies > Pet Beds > Pillow Beds',
    'cot': 'Animals & Pet Supplies > Pet Supplies > Pet Beds > Pet Cots',
    'bed': 'Animals & Pet Supplies > Pet Supplies > Pet Beds',
    'kennel': 'Animals & Pet Supplies > Pet Supplies > Dog Supplies > Dog Kennels & Runs',
}

# The source links these beds' colour variants to photos of a different colour
# (Kendal/Spruce: every "Beige" variant points at grey and green beds), so no
# variant gets its own photo and no alt text names a colour.
NO_VARIANT_IMAGES = {35}

VET_NOTE = ('A bed is for comfort, not treatment. If your dog is in pain, recovering or finding it '
            'hard to move, ask your vet about the right place for them to rest.')
PERSONAL_NOTE = ('Each bed is made to order with the name you type, so please check the spelling '
                 'carefully. Because it is personalised it can’t be returned for a change of mind. '
                 'If it arrives faulty or not as described, your full legal rights apply.')


def category_for(p):
    t, desc, needs = p['type'], p['title'].lower(), p['needs']
    if t == 'Dog Kennels':
        return 'kennel'
    if t in ('Elevated Dog Beds', 'Outdoor Day Beds'):
        return 'cot'
    if needs and needs[0] == 'support':
        return 'orthopedic'
    if 'nest' in desc:
        return 'nest'
    if 'bolster' in desc or t == 'Personalised Dog Beds':
        return 'bolster'
    if 'mattress' in desc or 'pillow' in desc or 'reversible' in desc:
        return 'pillow'
    return 'bed'


def esc(s):
    return html.escape(s, quote=False)


def split_size(v):
    if '·' in v:
        a, b = [x.strip() for x in v.split('·', 1)]
        return a, b
    return v, ''


def body_html(p, c):
    out = [f"<p><strong>{esc(c['lead'])}</strong> {esc(c['value'])}</p>",
           f"<p>{esc(c['intro'])}</p>",
           '<h3>What you get</h3>',
           '<ul>' + ''.join(f'<li><strong>{esc(a)}.</strong> {esc(b)}</li>' for a, b in c['points']) + '</ul>',
           '<h3>Best for</h3>',
           f"<p>{esc(c['best_for'])}</p>",
           '<h3>Size and fit</h3>']
    if 'Size' in p['options']:
        si = p['options'].index('Size')
        sizes = list(dict.fromkeys(v['values'][si] for v in p['variants']))
        rows = [split_size(s) for s in sizes]
        if any(d for _, d in rows):
            out.append('<table><thead><tr><th>Size</th><th>Dimensions</th></tr></thead><tbody>'
                       + ''.join(f'<tr><td>{esc(n)}</td><td>{esc(d) if d else "Ask us"}</td></tr>' for n, d in rows)
                       + '</tbody></table>')
    out.append(f"<p>{esc(c['fit_note'])}</p>")
    out += ['<h3>Care</h3>', f"<p>{esc(c['care'])}</p>"]
    if p['needs'] and p['needs'][0] == 'support':
        out.append(f'<p><em>{esc(VET_NOTE)}</em></p>')
    if 'personalise:name' in p['tags']:
        out += ['<h3>Before you order</h3>', f'<p>{esc(PERSONAL_NOTE)}</p>']
    return '\n'.join(out)


def lower_after_name(p):
    return p['name'] + ' ' + p['title'][len(p['name']) + 1:].lower().replace('xl ', 'XL ').replace('xxl ', 'XXL ')


def build():
    plan = json.load(open(HERE / 'plan.json'))
    lines, csv_rows = [], []
    (HERE / 'preview').mkdir(exist_ok=True)
    for p in plan:
        cp = HERE / 'copy' / f"{p['id']:02d}.json"
        if not cp.exists() and os.environ.get('PARTIAL'):
            continue
        c = json.load(open(cp))
        assert c['id'] == p['id']
        desc = body_html(p, c)
        cat = category_for(p)

        # images: first gets the written alt; colour-variant images name their colour
        colour_of = {}
        if 'Colour' in p['options'] and p['id'] not in NO_VARIANT_IMAGES:
            ci = p['options'].index('Colour')
            for v in p['variants']:
                if v['img']:
                    colour_of.setdefault(v['img'], v['values'][ci])
        imgs = p['images']
        files = []
        for k, src in enumerate(imgs, 1):
            if k == 1:
                alt = c['alt']
            elif src in colour_of:
                alt = f"{lower_after_name(p)} in {colour_of[src].lower()}"
            else:
                alt = f"{c['alt']}, photo {k} of {len(imgs)}"
            files.append({'originalSource': src, 'alt': alt[:512], 'contentType': 'IMAGE'})
        by_src = {f['originalSource']: f for f in files}

        variants = []
        for pos, v in enumerate(p['variants'], 1):
            vin = {
                'position': pos,
                'price': f"{v['price']:.2f}",
                'sku': v['sku'],
                'taxable': True,
                'inventoryPolicy': 'DENY',
                'inventoryItem': {'sku': v['sku'], 'tracked': False, 'requiresShipping': True},
                'optionValues': ([{'optionName': n, 'name': val} for n, val in zip(p['options'], v['values'])]
                                 or [{'optionName': 'Title', 'name': 'Default Title'}]),
            }
            if v['cost']:
                vin['inventoryItem']['cost'] = f"{v['cost']:.2f}"
            if v['grams']:
                vin['inventoryItem']['measurement'] = {'weight': {'value': round(v['grams']), 'unit': 'GRAMS'}}
            if v['img'] and v['img'] in by_src and p['id'] not in NO_VARIANT_IMAGES:
                vin['file'] = dict(by_src[v['img']])
            variants.append(vin)

        if p['options']:
            opts = [{'name': n, 'position': i + 1,
                     'values': [{'name': x} for x in dict.fromkeys(v['values'][i] for v in p['variants'])]}
                    for i, n in enumerate(p['options'])]
        else:
            opts = [{'name': 'Title', 'position': 1, 'values': [{'name': 'Default Title'}]}]

        product = {
            'title': p['title'],
            'handle': p['handle'],
            'descriptionHtml': desc,
            'vendor': 'Snoozly',
            'productType': p['type'],
            'category': CATEGORY[cat],
            'tags': p['tags'],
            # A personalised bed needs the theme's name field (Snoozly v2 theme). Until
            # that theme is live it is UNLISTED: reachable by link, hidden from the shop.
            'status': 'UNLISTED' if 'personalise:name' in p['tags'] else 'ACTIVE',
            'seo': {'title': c['seo_title'], 'description': c['seo_description']},
            'metafields': [{'namespace': 'custom', 'key': 'tagline', 'type': 'single_line_text_field',
                            'value': c['tagline']}],
            'files': files,
            'productOptions': opts,
            'variants': variants,
        }
        lines.append(json.dumps({'input': product}, ensure_ascii=False))

        prices = ' / '.join(f"{x['price']:.0f}" for x in p['variants'])
        (HERE / 'preview' / f"{p['id']:02d}.html").write_text(
            f"<!doctype html><meta charset=utf-8><title>{esc(p['title'])}</title>"
            f"<style>body{{font:16px/1.55 system-ui;max-width:680px;margin:2rem auto;padding:0 1rem}}"
            f"table{{border-collapse:collapse;width:100%}}td,th{{border-bottom:1px solid #ddd;text-align:left;padding:.4em}}</style>"
            f"<h1>{esc(p['title'])}</h1><p><em>{esc(c['tagline'])}</em></p>"
            f"<p>£{prices} · {esc(', '.join(p['tags']))}</p>{desc}"
            f"<hr><p><b>Google:</b> {esc(c['seo_title'])}<br>{esc(c['seo_description'])}</p>")

        # Shopify product CSV rows
        for i in range(max(len(p['variants']), len(files))):
            row = {k: '' for k in CSV_COLS}
            row['Handle'] = p['handle']
            if i == 0:
                row.update({'Title': p['title'], 'Body (HTML)': desc, 'Vendor': 'Snoozly',
                            'Product Category': CATEGORY_NAME[cat], 'Type': p['type'],
                            'Tags': ', '.join(p['tags']), 'Published': 'TRUE',
                            'SEO Title': c['seo_title'], 'SEO Description': c['seo_description'],
                            'Tagline (product.metafields.custom.tagline)': c['tagline'], 'Status': 'active'})
            if i < len(p['variants']):
                v = p['variants'][i]
                names = p['options'] or ['Title']
                vals = v['values'] or ['Default Title']
                for j, (n, val) in enumerate(zip(names, vals), 1):
                    if i == 0:
                        row[f'Option{j} Name'] = n
                    row[f'Option{j} Value'] = val
                row.update({'Variant SKU': v['sku'], 'Variant Grams': str(int(v['grams'] or 0)),
                            'Variant Inventory Policy': 'deny', 'Variant Fulfillment Service': 'manual',
                            'Variant Price': f"{v['price']:.2f}", 'Variant Requires Shipping': 'TRUE',
                            'Variant Taxable': 'TRUE', 'Variant Weight Unit': 'kg',
                            'Variant Image': v['img'] if v['img'] in by_src else '',
                            'Cost per item': f"{v['cost']:.2f}" if v['cost'] else ''})
            if i < len(files):
                row.update({'Image Src': files[i]['originalSource'], 'Image Position': str(i + 1),
                            'Image Alt Text': files[i]['alt']})
            csv_rows.append(row)

    (HERE / 'products.jsonl').write_text('\n'.join(lines) + '\n')
    with open(HERE / 'snoozly-products.csv', 'w', newline='', encoding='utf-8') as fh:
        w = csv.DictWriter(fh, fieldnames=CSV_COLS)
        w.writeheader()
        w.writerows(csv_rows)
    return plan, lines


CSV_COLS = ['Handle', 'Title', 'Body (HTML)', 'Vendor', 'Product Category', 'Type', 'Tags', 'Published',
            'Option1 Name', 'Option1 Value', 'Option2 Name', 'Option2 Value', 'Option3 Name', 'Option3 Value',
            'Variant SKU', 'Variant Grams', 'Variant Inventory Tracker', 'Variant Inventory Policy',
            'Variant Fulfillment Service', 'Variant Price', 'Variant Compare At Price', 'Variant Requires Shipping',
            'Variant Taxable', 'Image Src', 'Image Position', 'Image Alt Text', 'SEO Title', 'SEO Description',
            'Tagline (product.metafields.custom.tagline)', 'Variant Image', 'Variant Weight Unit', 'Cost per item',
            'Status']

if __name__ == '__main__':
    plan, lines = build()
    n_img = sum(len(json.loads(x)['input']['files']) for x in lines)
    n_var = sum(len(json.loads(x)['input']['variants']) for x in lines)
    print(f'{len(lines)} products, {n_var} variants, {n_img} images → products.jsonl, snoozly-products.csv, preview/')
