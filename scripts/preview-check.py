#!/usr/bin/env python3
"""Render storefront pages on an unpublished theme and check them.

    python3 scripts/preview-check.py <theme_numeric_id> [--out DIR] [--only key,key]

For each page it reports: HTTP status, bytes, Liquid errors / missing assets, the number of
<h1>, the JSON-LD @types (and duplicates of Product / BreadcrumbList / Organization /
FAQPage), and page-specific markers that must or must not appear. Pages are fetched with
?preview_theme_id=<id> (and _ab=0&_fd=0&_sc=1) through one cookie jar; a bot-check page
is retried. Writes each page's HTML to --out (default /tmp/preview) for inspection.
Exit 1 when any page has an error.
"""
import http.cookiejar
import json
import os
import re
import sys
import time
import urllib.request

THEME = sys.argv[1]
OUT = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else '/tmp/preview'
ONLY = set(sys.argv[sys.argv.index('--only') + 1].split(',')) if '--only' in sys.argv else None
os.makedirs(OUT, exist_ok=True)
HOST = 'https://pawlunova.co.uk'

# key: (path, must_contain[], must_not_contain[], expect_status)
PAGES = {
    'home': ('/', ['pln-hero', 'pln-bed-finder'], ['3900+', 'Rated 4.8', '60 DAY RETURN', 'Smart Tech', 'Earbuds', 'Men collection', 'Summer'], 200),
    'collection': ('/collections/orthopaedic-dog-beds', ['pln-collection-intro'], ['in stock', 'left', 'Hot'], 200),
    'collection-p2': ('/collections/dog-beds?page=2', [], [], 200),
    'list-collections': ('/collections', [], ['Explore More, Live Better', 'Home page'], 200),
    'product-own': ('/products/coniston-orthopaedic-dog-bed', ['pln-trust-row', 'pln-delivery-line'], ['in stock', 'Explore More', 'Recommended Products'], 200),
    'product-partner': ('/products/the-eskdale-tartan-bolster-dog-bed', [], ['Made in Yorkshire', 'countryOfOrigin'], 200),
    'product-soldout': ('/products/threlkeld-velvet-gel-memory-foam-dog-sofa', [], [], 200),
    'product-personalised': ('/products/the-rydal-textured-plush-dog-bed?view=pln-personalised', [], ['100 nights to decide'], 200),
    'cart': ('/cart', [], ['Cruelty free', 'Vegan Friendly', 'Tracked and insured'], 200),
    'search-none': ('/search?q=zzqqxxnothing', [], [], 200),
    'search': ('/search?q=bolster', [], [], 200),
    'faq': ('/pages/faq', [], [], 200),
    'contact': ('/pages/contact', [], ['+1234567890', 'info@email.com', 'abc main city', 'Toronto'], 200),
    'bed-finder': ('/pages/bed-finder', ['pln-bed-finder'], [], 200),
    'about': ('/pages/our-story', [], [], 200),
    'size-guide': ('/pages/size-guide?view=pln-size-guide', [], [], 200),
    'delivery': ('/pages/delivery-returns?view=pln-delivery', [], [], 200),
    'trial': ('/pages/100-night-trial?view=100-night-trial', [], [], 200),
    'guide': ('/pages/foam-explained?view=guide', [], [], 200),
    'guarantee-form': ('/pages/contact?view=pln-guarantee', [], [], 200),
    'order-help': ('/pages/contact?view=pln-order-help', [], [], 200),
    'demo-template-gone': ('/pages/contact?view=section-library-2', [], ['50K+', 'Toronto'], None),
    'blog': ('/blogs/news', [], [], None),
    '404': ('/pages/this-does-not-exist-pln', [], [], 404),
    'robots': ('/robots.txt', ['User-agent', 'Sitemap'], [], 200),
    'llms': ('/llms.txt', ['PawLunova'], ['jewellery', 'jewelry'], 200),
}

jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
opener.addheaders = [('User-Agent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'),
                     ('Accept', 'text/html,application/xhtml+xml'), ('Accept-Language', 'en-GB')]


def fetch(path):
    sep = '&' if '?' in path else '?'
    url = f'{HOST}{path}{sep}preview_theme_id={THEME}&_ab=0&_fd=0&_sc=1'
    for attempt in range(4):
        try:
            r = opener.open(url, timeout=60)
            body, status = r.read().decode('utf-8', 'replace'), r.status
        except urllib.error.HTTPError as e:
            body, status = e.read().decode('utf-8', 'replace'), e.code
        except Exception as e:  # network
            body, status = str(e), 0
        if 'connection needs to be verified' in body or status in (0, 429, 503):
            time.sleep(3 * (attempt + 1))
            continue
        return status, body
    return status, body


errors = 0
summary = []
for key, (path, must, mustnot, want) in PAGES.items():
    if ONLY and key not in ONLY:
        continue
    status, html = fetch(path)
    open(os.path.join(OUT, f'{key}.html'), 'w').write(html)
    probs = []
    if want is not None and status != want:
        probs.append(f'status {status} (want {want})')
    if 'connection needs to be verified' in html:
        probs.append('bot check page (not rendered)')
    for m in re.finditer(r'(Liquid (syntax )?error[^<]{0,160}|Could not find asset[^<]{0,120}|translation missing[^<"]{0,80})', html, re.I):
        probs.append(m.group(1).strip())
    is_html = '<html' in html[:2000].lower()
    if is_html and f'preview_theme_id' not in html and THEME not in html:
        probs.append('page does not look like it rendered the preview theme')
    h1 = len(re.findall(r'<h1[\s>]', html, re.I))
    types = []
    for block in re.findall(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', html, re.S | re.I):
        try:
            d = json.loads(block)
        except Exception:
            probs.append('invalid JSON-LD block')
            continue
        items = d.get('@graph', [d]) if isinstance(d, dict) else d
        for it in items if isinstance(items, list) else [items]:
            if isinstance(it, dict):
                t = it.get('@type')
                types.extend(t if isinstance(t, list) else [t])
    for t in ('Product', 'ProductGroup', 'BreadcrumbList', 'Organization', 'FAQPage', 'WebSite'):
        if types.count(t) > 1:
            probs.append(f'{types.count(t)}x {t} JSON-LD')
    if types.count('Product') and types.count('ProductGroup'):
        probs.append('both Product and ProductGroup JSON-LD')
    if is_html and key not in ('robots', 'llms') and h1 != 1 and status == 200:
        probs.append(f'{h1} <h1> elements')
    for m in must:
        if m not in html:
            probs.append(f'missing marker "{m}"')
    visible = re.sub(r'<script.*?</script>|<style.*?</style>', '', html, flags=re.S | re.I)
    for m in mustnot:
        if m in visible:
            probs.append(f'forbidden text "{m}"')
    if 'aggregateRating' in html:
        probs.append('aggregateRating present')
    errors += 1 if probs else 0
    summary.append({'page': key, 'path': path, 'status': status, 'bytes': len(html), 'h1': h1, 'jsonld': types, 'problems': probs})
    print(f'{"FAIL" if probs else "OK  "} {key:22s} {status} {len(html):7d}b h1={h1} ld={",".join(str(t) for t in types)}')
    for p in probs:
        print(f'       - {p}')
json.dump(summary, open(os.path.join(OUT, 'summary.json'), 'w'), indent=1)
print(f'SUMMARY pages={len(summary)} failing={errors}')
sys.exit(1 if errors else 0)
