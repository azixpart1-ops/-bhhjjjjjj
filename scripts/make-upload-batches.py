#!/usr/bin/env python3
"""Turn a theme build folder into ordered themeFilesUpsert batches.

    python3 scripts/make-upload-batches.py <build_dir> <baseline_dir> <out_dir> <theme_gid>

Writes <out_dir>/batch-NN.json ({"themeId", "files": [{filename, body:{type:TEXT,value}}]}),
<out_dir>/deletes.json (files in the baseline but not in the build) and
<out_dir>/manifest.json ({filename: {batch, md5, kind}}) where kind is "text" (compare
checksumMd5) or "json" (Shopify rewrites JSON on save: compare parsed content).

Order, so nothing references a file that is not there yet:
  1 config/settings_schema.json  2 assets  3 snippets  4 blocks  5 sections/*.liquid
  6 layout  7 locales  8 sections/*.json  9 templates  10 config/settings_data.json
Batches hold at most 25 files and about 60 KB; a bigger single file gets its own batch.
"""
import hashlib
import json
import os
import sys

build, base, out, theme = sys.argv[1:5]
os.makedirs(out, exist_ok=True)
for f in os.listdir(out):
    if f.startswith('batch-') or f in ('manifest.json', 'deletes.json'):
        os.remove(os.path.join(out, f))


def walk(root):
    res = []
    for d, _, fs in os.walk(root):
        for f in fs:
            res.append(os.path.relpath(os.path.join(d, f), root))
    return res


def md5(p):
    return hashlib.md5(open(p, 'rb').read()).hexdigest() if os.path.exists(p) else None


changed = [f for f in walk(build) if md5(os.path.join(build, f)) != md5(os.path.join(base, f))]
deletes = sorted(f for f in walk(base) if not os.path.exists(os.path.join(build, f)))


def rank(f):
    if f == 'config/settings_schema.json':
        return 1
    if f.startswith('assets/'):
        return 2
    if f.startswith('snippets/'):
        return 3
    if f.startswith('blocks/'):
        return 4
    if f.startswith('sections/') and f.endswith('.liquid'):
        return 5
    if f.startswith('layout/'):
        return 6
    if f.startswith('locales/'):
        return 7
    if f.startswith('sections/') and f.endswith('.json'):
        return 8
    if f.startswith('templates/'):
        return 9
    if f == 'config/settings_data.json':
        return 10
    return 11


changed.sort(key=lambda f: (rank(f), f))
batches, cur, size, cur_rank = [], [], 0, None
for f in changed:
    s = os.path.getsize(os.path.join(build, f))
    r = rank(f)
    if cur and (len(cur) >= 25 or size + s > 60000 or r != cur_rank):
        batches.append(cur)
        cur, size = [], 0
    cur.append(f)
    size += s
    cur_rank = r
if cur:
    batches.append(cur)

manifest = {}
for i, b in enumerate(batches, 1):
    payload = {'themeId': theme, 'files': [{'filename': f, 'body': {'type': 'TEXT', 'value': open(os.path.join(build, f), encoding='utf-8').read()}} for f in b]}
    name = f'batch-{i:02d}.json'
    json.dump(payload, open(os.path.join(out, name), 'w'), ensure_ascii=False)
    for f in b:
        manifest[f] = {'batch': name, 'md5': md5(os.path.join(build, f)), 'kind': 'json' if f.endswith('.json') else 'text'}
json.dump(manifest, open(os.path.join(out, 'manifest.json'), 'w'), indent=1)
json.dump({'themeId': theme, 'files': deletes}, open(os.path.join(out, 'deletes.json'), 'w'), indent=1)
for i, b in enumerate(batches, 1):
    print(f'batch-{i:02d}.json  {len(b):2d} files  {sum(os.path.getsize(os.path.join(build, f)) for f in b):7d} bytes  {b[0]} .. {b[-1]}')
print(f'{len(changed)} files to upload in {len(batches)} batches; {len(deletes)} to delete: {deletes}')
