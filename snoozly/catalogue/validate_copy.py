#!/usr/bin/env python3
"""
Checks every copy/NN.json against the Snoozly copy rules.

    python3 snoozly/catalogue/validate_copy.py            # all products
    python3 snoozly/catalogue/validate_copy.py 2 3 17     # just these ids

Exit code 1 if anything fails. Rules: lengths, required keys, the Snoozly name,
UK spelling, and nothing carried over from the old shop (names, trials,
guarantees, delivery promises, prices, other brands, medical claims).
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
KEYS = ['id', 'tagline', 'lead', 'value', 'intro', 'points', 'best_for', 'fit_note', 'care',
        'seo_title', 'seo_description', 'alt']

OLD_NAMES = ['Ambleside', 'Bassenthwaite', 'Blea Tarn', 'Blencathra', 'Borrowdale', 'Bowfell',
             'Braithwaite', 'Brotherswater', 'Burnmoor', 'Buttermere', 'Chatsworth', 'Coniston',
             'Crummock', 'Derwent', 'Duddon', 'Easedale', 'Elterwater', 'Ennerdale', 'Eskdale',
             'Esthwaite', 'Glenridding', 'Grasmere', 'Grizedale', 'Harewood', 'Harrogate',
             'Haweswater', 'Hawkshead', 'Helvellyn', 'Henley', 'Kendal', 'Kentmere', 'Keswick',
             'Langdale', 'Longsleddale', 'Loweswater', 'Mardale', 'Martindale', 'Melbreak',
             'Newlands', 'Nocturne', 'Patterdale', 'Ribble', 'Rosthwaite', 'Rydal', 'Sawrey',
             'Scafell', 'Seathwaite', 'Skelwith', 'Staveley', 'Tetbury', 'Thirlmere', 'Torver',
             'Troutbeck', 'Ullswater', 'Wasdale', 'Wastwater', 'Watendlath', 'Wensleydale',
             'Whinlatter', 'Windermere', 'Windsor']
BANNED = [
    (r'pawlunova|paw\s*luna', 'old shop name'),
    (r'\b\d+[- ]nights?\b|night trial|home trial|\btrial\b', 'trial promise'),
    (r'guarantee|no[- ]flatten|warranty', 'guarantee'),
    (r'refund|money[- ]back|free (uk )?(mainland )?collection|we collect', 'returns promise'),
    (r'free (standard )?(uk )?delivery|free shipping|dispatch|next[- ]day|working days', 'delivery promise'),
    (r'£\s*\d|\d+p a night|per night|a night\b', 'price or price maths'),
    (r'message us|whatsapp', 'old-shop contact wording (use "ask us")'),
    (r'bedsure|mekiy|lesfug|bingo ?paw|artisan dog|\bhound\b(?! ?stooth)|joyelf', 'another brand'),
    (r'\b(treat|treats|cure|cures|heal|heals|relieve|relieves|relief|prevent|prevents)\b', 'medical claim'),
    (r'arthritis|dysplasia|clinically|vet[- ]?(approved|recommended)|therapeutic|anxiety relief|pain', 'medical claim'),
    (r'\bultimate\b|\bluxurious\b|\bluxury\b|\bperfect\b|revolutionary|game[- ]changer|amazing|must[- ]have', 'hype word'),
    (r'!', 'exclamation mark'),
    (r'\bcolor\b|\bgray\b|orthopedic|\bcozy\b|\bcenter\b|favorite', 'US spelling'),
    (r'chew[- ](proof|resistant)|eco[- ]friendly|anti[- ]?microbial|hypoallergenic', 'unsupported feed claim'),
]


def words(s):
    return len(re.findall(r"[\w'’-]+", s))


def check(path, plan):
    errs = []
    try:
        d = json.loads(path.read_text())
    except Exception as e:  # noqa: BLE001
        return [f'invalid JSON: {e}']
    pid = d.get('id')
    p = plan.get(pid)
    if not p:
        return [f'unknown id {pid}']
    if path.stem != f'{pid:02d}':
        errs.append(f'file name should be {pid:02d}.json')
    missing = [k for k in KEYS if k not in d]
    extra = [k for k in d if k not in KEYS]
    if missing:
        errs.append(f'missing keys {missing}')
    if extra:
        errs.append(f'unexpected keys {extra}')
    if missing:
        return errs

    def need(cond, msg):
        if not cond:
            errs.append(msg)

    t, sd, st = d['tagline'], d['seo_description'], d['seo_title']
    need(40 <= len(t) <= 95, f'tagline {len(t)} chars (40–95)')
    need(t.endswith('.'), 'tagline must end with a full stop')
    need(8 <= words(d['lead']) <= 22, f"lead {words(d['lead'])} words (8–22)")
    need(8 <= words(d['value']) <= 30, f"value {words(d['value'])} words (8–30)")
    need(15 <= words(d['intro']) <= 45, f"intro {words(d['intro'])} words (15–45)")
    need(p['name'] in d['intro'], f"intro must contain the name {p['name']}")
    pts = d['points']
    need(isinstance(pts, list) and 3 <= len(pts) <= 5, 'points: 3–5 items')
    for i, pt in enumerate(pts if isinstance(pts, list) else []):
        if not (isinstance(pt, list) and len(pt) == 2):
            errs.append(f'point {i + 1} must be [label, sentence]')
            continue
        lab, sen = pt
        need(1 <= words(lab) <= 5 and not lab.endswith('.'), f'point {i + 1} label "{lab}" (1–5 words, no full stop)')
        need(words(sen) <= 22 and sen.endswith('.'), f'point {i + 1} sentence ≤22 words ending with a full stop')
    need(6 <= words(d['best_for']) <= 30, f"best_for {words(d['best_for'])} words (6–30)")
    need(not d['best_for'].lower().startswith('best for'), 'best_for must not start with "Best for"')
    need(10 <= words(d['fit_note']) <= 45, f"fit_note {words(d['fit_note'])} words (10–45)")
    need(8 <= words(d['care']) <= 40, f"care {words(d['care'])} words (8–40)")
    need(len(st) <= 60 and st.endswith(' | Snoozly'), f'seo_title {len(st)} chars, must be ≤60 and end " | Snoozly"')
    need(not st.startswith(p['name'] + ' '), 'seo_title must not start with the Snoozly name')
    need(120 <= len(sd) <= 155, f'seo_description {len(sd)} chars (120–155)')
    need(20 <= len(d['alt']) <= 110, f"alt {len(d['alt'])} chars (20–110)")
    need(d['alt'].startswith(p['name']), f"alt must start with {p['name']}")

    blob = ' '.join([t, d['lead'], d['value'], d['intro'], d['best_for'], d['fit_note'], d['care'], st, sd, d['alt']]
                    + [x for pt in pts if isinstance(pt, list) for x in pt])
    for n in OLD_NAMES:
        if re.search(rf'\b{re.escape(n)}\b', blob):
            errs.append(f'old product name "{n}"')
    for rx, why in BANNED:
        m = re.search(rx, blob, re.I)
        if m:
            errs.append(f'{why}: "{m.group(0)}"')
    for other in plan.values():
        if other['id'] != pid and re.search(rf"\b{re.escape(other['name'])}\b", blob) \
                and other['name'] not in {'Oak', 'Ash', 'Elm', 'Pine', 'Moss', 'Fern', 'Heather', 'Clover', 'Shore', 'Brook', 'Breeze', 'Cherry', 'Hare', 'Fox', 'Robin', 'Harbour', 'Cove', 'Lodge', 'Walnut', 'Chestnut', 'Hazel', 'Holly', 'Willow', 'Bramble'}:
            errs.append(f"mentions another product's name \"{other['name']}\"")
    return errs


def main(ids):
    plan = {p['id']: p for p in json.load(open(HERE / 'plan.json'))}
    files = sorted((HERE / 'copy').glob('*.json'))
    if ids:
        files = [HERE / 'copy' / f'{i:02d}.json' for i in ids]
    bad = 0
    seen_titles = {}
    for f in files:
        if not f.exists():
            print(f'{f.name}: MISSING')
            bad += 1
            continue
        errs = check(f, plan)
        try:
            st = json.loads(f.read_text()).get('seo_title')
            if st in seen_titles:
                errs.append(f'seo_title duplicates {seen_titles[st]}')
            seen_titles[st] = f.name
        except Exception:  # noqa: BLE001
            pass
        if errs:
            bad += 1
            print(f'{f.name}: ' + '; '.join(errs))
    if not ids:
        have = {int(f.stem) for f in files}
        for pid in plan:
            if pid not in have:
                print(f'{pid:02d}.json: MISSING')
                bad += 1
    print(f'{len(files)} checked, {bad} with problems')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main([int(a) for a in sys.argv[1:]]))
