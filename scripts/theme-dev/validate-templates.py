#!/usr/bin/env python3
"""Validate a Horizon theme's JSON templates, section groups and settings_data against the schemas in
sections/*.liquid, blocks/*.liquid and config/settings_schema.json. Mirrors the checks Shopify applies
at import/upsert time that theme-check does not catch (range steps, select options, block types,
blank defaults, url defaults). Usage: validate.py <theme dir> [--strip]
--strip rewrites templates/*.json and sections/*.json dropping values equal to the schema default."""
import json, re, sys, os, glob
ROOT = sys.argv[1]
STRIP = '--strip' in sys.argv
errors, warns = [], []
def err(f, m): errors.append(f'{f}: {m}')
def warn(f, m): warns.append(f'{f}: {m}')
def load_schema(path):
    s = open(path, encoding='utf-8').read()
    m = re.search(r'{%-?\s*schema\s*-?%}(.*?){%-?\s*endschema\s*-?%}', s, re.S)
    if not m: return {}
    try: return json.loads(m.group(1))
    except Exception as e: err(path, f'schema JSON error {e}'); return {}
def jload(path):
    s = open(path, encoding='utf-8').read()
    s = re.sub(r'^\s*/\*.*?\*/\s*', '', s, flags=re.S)
    return json.loads(s)
sections = {os.path.basename(p)[:-7]: load_schema(p) for p in glob.glob(f'{ROOT}/sections/*.liquid')}
blocks = {os.path.basename(p)[:-7]: load_schema(p) for p in glob.glob(f'{ROOT}/blocks/*.liquid')}
settings_schema = jload(f'{ROOT}/config/settings_schema.json')
theme_settings = {}
for g in settings_schema:
    for st in g.get('settings', []):
        if 'id' in st: theme_settings[st['id']] = st
ALLOWED_URL_DEFAULTS = {'/collections', '/collections/all'}
def check_schema_settings(f, ctx, sets):
    for st in sets:
        if 'id' not in st: continue
        t = st.get('type'); d = st.get('default', None)
        if 'default' in st and d == '' and not (t == 'select' and '' in [o.get('value') for o in st.get('options', [])]): err(f, f'{ctx}: setting {st["id"]} has blank default')
        if t == 'url' and 'default' in st and d not in ALLOWED_URL_DEFAULTS: err(f, f'{ctx}: url setting {st["id"]} default {d!r} not allowed')
        if t == 'richtext' and isinstance(d, str) and d and not d.startswith('<'): err(f, f'{ctx}: richtext {st["id"]} default must be wrapped in a block tag')
        if t == 'range':
            mn, mx, step = st.get('min', 0), st.get('max', 100), st.get('step', 1)
            if step <= 0 or mn >= mx: err(f, f'{ctx}: range {st["id"]} bad min/max/step')
            if d is not None and (d < mn or d > mx or abs((d - mn) / step - round((d - mn) / step)) > 1e-9): err(f, f'{ctx}: range {st["id"]} default {d} not a step')
            if (mx - mn) / step > 101: err(f, f'{ctx}: range {st["id"]} has more than 101 steps')
        if t == 'select':
            opts = [o.get('value') for o in st.get('options', [])]
            if d is not None and d not in opts: err(f, f'{ctx}: select {st["id"]} default {d!r} not in options')
        if t == 'checkbox' and d is not None and not isinstance(d, bool): err(f, f'{ctx}: checkbox {st["id"]} default not boolean')
        if t in ('image_picker', 'video', 'product', 'collection', 'page', 'blog', 'article', 'font_picker') and 'default' in st and t != 'font_picker': err(f, f'{ctx}: {t} setting {st["id"]} must not have a default')
for name, sc in sections.items():
    if sc:
        check_schema_settings(f'sections/{name}.liquid', 'settings', sc.get('settings', []))
        for b in sc.get('blocks', []):
            if 'settings' in b: check_schema_settings(f'sections/{name}.liquid', f'block {b.get("type")}', b['settings'])
        if len(sc.get('name', '')) > 25 and not sc.get('name', '').startswith('t:'): err(f'sections/{name}.liquid', 'name longer than 25 chars')
for name, sc in blocks.items():
    if sc: check_schema_settings(f'blocks/{name}.liquid', 'settings', sc.get('settings', []))
check_schema_settings('config/settings_schema.json', 'settings', list(theme_settings.values()))
def check_values(f, ctx, schema_settings, values):
    byid = {s['id']: s for s in schema_settings if 'id' in s}
    for k, v in list(values.items()):
        st = byid.get(k)
        if not st: warn(f, f'{ctx}: unknown setting "{k}"'); continue
        t = st.get('type')
        if isinstance(v, str) and v.strip().startswith('{{'):
            m = re.match(r'{{\s*settings\.([a-zA-Z0-9_]+)', v.strip())
            if m and m.group(1) not in theme_settings: err(f, f'{ctx}.{k}: dynamic source uses missing theme setting {m.group(1)}')
            continue
        if t == 'range':
            if not isinstance(v, (int, float)) or isinstance(v, bool): err(f, f'{ctx}.{k}: range value not numeric {v!r}'); continue
            mn, mx, step = st.get('min', 0), st.get('max', 100), st.get('step', 1)
            if v < mn or v > mx: err(f, f'{ctx}.{k}: {v} outside {mn}..{mx}')
            elif abs((v - mn) / step - round((v - mn) / step)) > 1e-9: err(f, f'{ctx}.{k}: {v} not a step of {step} from {mn}')
        elif t == 'select':
            opts = [o.get('value') for o in st.get('options', [])]
            if opts and v not in opts: err(f, f'{ctx}.{k}: {v!r} not in options {opts}')
        elif t == 'checkbox':
            if not isinstance(v, bool): err(f, f'{ctx}.{k}: checkbox value not boolean {v!r}')
        elif t == 'number':
            if v != '' and (not isinstance(v, (int, float)) or isinstance(v, bool)): err(f, f'{ctx}.{k}: number value not numeric {v!r}')
        elif t == 'url':
            if v and not (v.startswith('/') or v.startswith('shopify://') or v.startswith('http') or v.startswith('#') or v.startswith('mailto:') or v.startswith('tel:')): warn(f, f'{ctx}.{k}: url value {v!r}')
        elif t == 'color':
            if v and not re.match(r'^(#[0-9a-fA-F]{3,8}|rgba?\(.*\)|transparent)$', str(v)): err(f, f'{ctx}.{k}: colour value {v!r}')
        if STRIP and 'default' in st and st['default'] == v: del values[k]
def block_schema(container, btype, container_is_section):
    if container_is_section:
        for b in (container or {}).get('blocks', []):
            if b.get('type') == btype and 'settings' in b: return b, 'local'
    if btype in blocks: return blocks[btype], 'theme'
    return None, None
def check_blocks(f, ctx, container, bdict, border, container_is_section):
    allowed = [x.get('type') for x in (container or {}).get('blocks', [])]
    n = 0
    for bid, b in bdict.items():
        bt = b.get('type')
        if bt == '@app': continue
        n += 1
        sc, kind = block_schema(container, bt, container_is_section)
        if sc is None: err(f, f'{ctx}.{bid}: unknown block type {bt!r}'); continue
        if kind == 'theme' and '@theme' not in allowed and bt not in allowed and not b.get('static'): warn(f, f'{ctx}.{bid}: theme block {bt!r} not accepted by container (accepts {allowed})')
        check_values(f, f'{ctx}.{bid}({bt})', sc.get('settings', []), b.get('settings', {}))
        if 'blocks' in b: check_blocks(f, f'{ctx}.{bid}', sc, b['blocks'], b.get('block_order', []), False)
    for bid in border:
        if bid not in bdict: err(f, f'{ctx}: block_order has missing block {bid!r}')
    mb = (container or {}).get('max_blocks')
    if mb and len(border) > mb: err(f, f'{ctx}: {len(border)} blocks exceeds max_blocks {mb}')
def check_template(path, data, kind):
    f = os.path.relpath(path, ROOT)
    tmpl_type = os.path.basename(path).split('.')[0]
    for sid, sec in data.get('sections', {}).items():
        st = sec.get('type')
        sc = sections.get(st)
        if sc is None: err(f, f'{sid}: unknown section type {st!r}'); continue
        en, dis = sc.get('enabled_on'), sc.get('disabled_on')
        if kind == 'template':
            if en and 'templates' in en and tmpl_type not in en['templates'] and '*' not in en['templates']: err(f, f'{sid}: section {st} not enabled on template {tmpl_type}')
            if dis and 'templates' in dis and (tmpl_type in dis['templates'] or '*' in dis['templates']): err(f, f'{sid}: section {st} disabled on template {tmpl_type}')
        else:
            if en and 'groups' in en and kind not in en['groups'] and '*' not in en['groups']: err(f, f'{sid}: section {st} not enabled on group {kind}')
            if dis and 'groups' in dis and (kind in dis['groups'] or '*' in dis['groups']): err(f, f'{sid}: section {st} disabled on group {kind}')
        check_values(f, sid, sc.get('settings', []), sec.get('settings', {}))
        check_blocks(f, sid, sc, sec.get('blocks', {}), sec.get('block_order', []), True)
    for sid in data.get('order', []):
        if sid not in data.get('sections', {}): err(f, f'order has missing section {sid!r}')
    for sid in data.get('sections', {}):
        if sid not in data.get('order', []): warn(f, f'section {sid!r} not in order')
for p in sorted(glob.glob(f'{ROOT}/templates/*.json')):
    d = jload(p); check_template(p, d, 'template')
    if STRIP: open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, separators=(',', ':')))
for p in sorted(glob.glob(f'{ROOT}/sections/*.json')):
    d = jload(p); check_template(p, d, d.get('type', 'header'))
    if STRIP: open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, separators=(',', ':')))
sd = jload(f'{ROOT}/config/settings_data.json')
check_values('config/settings_data.json', 'current', list(theme_settings.values()), sd.get('current', {}))
for e in errors: print('ERROR', e)
for w in warns: print('WARN ', w)
print(f'{len(errors)} errors, {len(warns)} warnings')
sys.exit(1 if errors else 0)
