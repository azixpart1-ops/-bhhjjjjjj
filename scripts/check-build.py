#!/usr/bin/env python3
"""Static checks for a full theme folder against a baseline copy of the same theme.

    python3 scripts/check-build.py <build_dir> <baseline_dir> [--theme-check]

Checks only what changed or is new versus the baseline (by md5), plus every
JSON template and section group (they reference everything):

  json        every templates/*.json, sections/*.json, config/*.json, locales/*.json parses
  refs        every section type in templates/groups exists; every block type is either
              a theme block (blocks/<type>.liquid), an @app/app block, or a local block
              declared in the parent schema; theme blocks are allowed where the parent
              schema lists "@theme" or the type
  settings    every settings.pln_* used in a changed liquid/js file is defined in
              config/settings_schema.json; settings_data current pln_* keys are defined
  schema      changed sections/blocks: valid {% schema %} JSON, names/presets/block names
              <= 25 chars, no text/textarea default "", range <= 101 steps, unique ids
  liquid      changed liquid: balanced block tags; no '{' or '}' inside a quoted string
              inside {{ }} (Shopify rejects it); render targets exist
  theme-check (optional) runs scripts/theme-dev/theme-check-dir.mjs on build and baseline
              and reports offenses that are new in the build (errors fail)

Prints ERROR/WARN lines and a SUMMARY line; exit 1 on any ERROR.
"""
import hashlib
import json
import os
import re
import subprocess
import sys

BUILD = os.path.abspath(sys.argv[1])
BASE = os.path.abspath(sys.argv[2])
RUN_TC = '--theme-check' in sys.argv

errors, warns = [], []


def err(f, m):
    errors.append(f'ERROR [{f}] {m}')


def warn(f, m):
    warns.append(f'WARN  [{f}] {m}')


def md5(p):
    return hashlib.md5(open(p, 'rb').read()).hexdigest() if os.path.exists(p) else None


def files(root):
    out = []
    for d, _, fs in os.walk(root):
        for f in fs:
            out.append(os.path.relpath(os.path.join(d, f), root))
    return sorted(out)


def strip_comment(raw):
    """Remove // and /* */ comments outside strings (Shopify JSON templates and locales are JSONC)."""
    out, i, n, in_str = [], 0, len(raw), False
    while i < n:
        c = raw[i]
        if in_str:
            out.append(c)
            if c == '\\' and i + 1 < n:
                out.append(raw[i + 1])
                i += 2
                continue
            if c == '"':
                in_str = False
            i += 1
            continue
        if c == '"':
            in_str = True
            out.append(c)
            i += 1
        elif raw.startswith('//', i):
            j = raw.find('\n', i)
            i = n if j < 0 else j
        elif raw.startswith('/*', i):
            j = raw.find('*/', i + 2)
            i = n if j < 0 else j + 2
        else:
            out.append(c)
            i += 1
    return ''.join(out)


def load_json(rel):
    return json.loads(strip_comment(open(os.path.join(BUILD, rel), encoding='utf-8').read()))


ALL = files(BUILD)
CHANGED = [f for f in ALL if md5(os.path.join(BUILD, f)) != md5(os.path.join(BASE, f))]
DELETED = [f for f in files(BASE) if not os.path.exists(os.path.join(BUILD, f))]

# ---------------- json
JSON_FILES = [f for f in ALL if f.endswith('.json') and f.split('/')[0] in ('templates', 'sections', 'config', 'locales')]
parsed = {}
for f in JSON_FILES:
    try:
        parsed[f] = load_json(f)
    except Exception as e:
        err(f, f'json: does not parse: {e}')

# ---------------- schemas of sections and blocks
SCHEMA_RE = re.compile(r'{%-?\s*schema\s*-?%}(.*?){%-?\s*endschema\s*-?%}', re.S)
schemas = {}
for f in ALL:
    if f.endswith('.liquid') and f.split('/')[0] in ('sections', 'blocks'):
        m = SCHEMA_RE.search(open(os.path.join(BUILD, f), encoding='utf-8').read())
        if not m:
            continue
        try:
            schemas[f] = json.loads(m.group(1))
        except Exception as e:
            schemas[f] = None
            if f in CHANGED:
                err(f, f'schema: invalid JSON: {e}')


def section_exists(t):
    return os.path.exists(os.path.join(BUILD, 'sections', t + '.liquid'))


def theme_block_exists(t):
    return os.path.exists(os.path.join(BUILD, 'blocks', t + '.liquid'))


def allowed(parent_schema, btype):
    """parent_schema: schema dict of the parent section/block. Returns 'local', 'theme', 'app' or None."""
    if btype.startswith('shopify://apps/') or btype == '@app':
        return 'app'
    blocks = (parent_schema or {}).get('blocks', [])
    types = {b.get('type') for b in blocks}
    if btype in types and not theme_block_exists(btype):
        return 'local'
    if theme_block_exists(btype) and ('@theme' in types or btype in types):
        return 'theme'
    if theme_block_exists(btype) and btype.startswith('_'):
        return 'theme'  # private blocks are referenced by their parents explicitly
    if theme_block_exists(btype):
        return 'theme-not-listed'
    return None


def walk_blocks(rel, owner, parent_schema, blocks):
    for bid, b in (blocks or {}).items():
        bt = b.get('type', '')
        kind = allowed(parent_schema, bt)
        if kind == 'theme-not-listed' and b.get('static'):
            kind = 'theme'  # static blocks are rendered by their parent with {% content_for 'block' %}
        if kind is None:
            err(rel, f'refs: {owner} > block "{bid}" type "{bt}" does not exist (no blocks/{bt}.liquid and not a local block of the parent)')
            continue
        if kind == 'theme-not-listed':
            warn(rel, f'refs: {owner} > block "{bid}" type "{bt}" is a theme block the parent schema does not list (needs "@theme" or the type)')
        if b.get('blocks'):
            child_schema = schemas.get(f'blocks/{bt}.liquid') if kind.startswith('theme') else None
            if kind == 'local':
                child_schema = next((x for x in (parent_schema or {}).get('blocks', []) if x.get('type') == bt), None)
            walk_blocks(rel, f'{owner} > {bid}', child_schema, b.get('blocks'))
        order = b.get('block_order')
        if order:
            for k in order:
                if k not in (b.get('blocks') or {}):
                    err(rel, f'refs: {owner} > {bid} block_order names missing block "{k}"')


for f, d in parsed.items():
    if not (f.startswith('templates/') or (f.startswith('sections/') and f.endswith('.json'))):
        continue
    secs = d.get('sections', {}) if isinstance(d, dict) else {}
    order = d.get('order', [])
    for k in order:
        if k not in secs:
            err(f, f'refs: order names missing section "{k}"')
    for sid, s in secs.items():
        st = s.get('type', '')
        if st.startswith('shopify://apps/') or st == 'apps':
            continue
        if not section_exists(st):
            err(f, f'refs: section "{sid}" type "{st}" has no sections/{st}.liquid')
            continue
        sch = schemas.get(f'sections/{st}.liquid')
        walk_blocks(f, sid, sch, s.get('blocks'))
        for k in s.get('block_order') or []:
            if k not in (s.get('blocks') or {}):
                err(f, f'refs: section "{sid}" block_order names missing block "{k}"')

# ---------------- settings
try:
    sschema = parsed['config/settings_schema.json']
    defined = {s.get('id') for g in sschema for s in g.get('settings', []) if s.get('id')}
except Exception:
    defined = set()
    err('config/settings_schema.json', 'settings: cannot read')
for f in CHANGED:
    if f.endswith(('.liquid', '.js', '.json')) and os.path.exists(os.path.join(BUILD, f)) and f != 'config/settings_data.json':
        txt = open(os.path.join(BUILD, f), encoding='utf-8', errors='ignore').read()
        for sid in sorted(set(re.findall(r'settings\.(pln_[a-z0-9_]+)', txt))):
            if sid not in defined:
                err(f, f'settings: settings.{sid} is not defined in config/settings_schema.json')
try:
    cur = parsed['config/settings_data.json'].get('current', {})
    for k in cur:
        if k.startswith('pln_') and k not in defined:
            err('config/settings_data.json', f'settings: current.{k} has no definition in settings_schema')
except Exception:
    pass
# pln settings group rules
for g in (sschema if isinstance(defined, set) and 'config/settings_schema.json' in parsed else []):
    for s in g.get('settings', []):
        sid = s.get('id', '')
        if not sid.startswith('pln_'):
            continue
        if s.get('type') in ('text', 'textarea', 'richtext', 'inline_richtext', 'html', 'url') and s.get('default', None) == '':
            err('config/settings_schema.json', f'settings: {sid} has a blank default')
        if s.get('type') == 'range':
            try:
                steps = (s['max'] - s['min']) / s['step']
                if steps > 101:
                    err('config/settings_schema.json', f'settings: range {sid} has {steps:.0f} steps (max 101)')
            except Exception:
                err('config/settings_schema.json', f'settings: range {sid} lacks min/max/step')
ids = [s.get('id') for g in (parsed.get('config/settings_schema.json') or []) for s in g.get('settings', []) if s.get('id')]
dups = {i for i in ids if ids.count(i) > 1}
for i in sorted(dups):
    err('config/settings_schema.json', f'settings: duplicate id {i}')

# ---------------- changed schema rules
TEXTY = ('text', 'textarea', 'richtext', 'inline_richtext', 'html', 'url', 'liquid')


def check_settings_list(f, where, lst):
    seen = set()
    for s in lst or []:
        sid = s.get('id')
        if sid:
            if sid in seen:
                err(f, f'schema: {where} duplicate setting id {sid}')
            seen.add(sid)
        if s.get('type') in TEXTY and 'default' in s and s['default'] == '':
            err(f, f'schema: {where} setting {sid} has "default": "" (Shopify rejects it)')
        if s.get('type') == 'range':
            try:
                st = (s['max'] - s['min']) / s['step']
                if st > 101:
                    err(f, f'schema: {where} range {sid} has {st:.0f} steps (max 101)')
                d = s.get('default')
                if d is not None and (d < s['min'] or d > s['max'] or (d - s['min']) % s['step']):
                    err(f, f'schema: {where} range {sid} default {d} is off the min/max/step grid')
            except Exception:
                err(f, f'schema: {where} range {sid} lacks numeric min/max/step')
        if s.get('type') == 'select':
            opts = [o.get('value') for o in s.get('options', [])]
            if 'default' in s and s['default'] not in opts:
                err(f, f'schema: {where} select {sid} default {s["default"]!r} is not an option')


for f in CHANGED:
    sch = schemas.get(f)
    if not sch:
        continue
    for kind, name in ([('name', sch.get('name'))] + [('preset', p.get('name')) for p in sch.get('presets', [])] +
                       [('block name', b.get('name')) for b in sch.get('blocks', [])]):
        if name and not str(name).startswith('t:') and len(name) > 25:
            err(f, f'schema: {kind} "{name}" is {len(name)} chars (max 25)')
    check_settings_list(f, 'settings', sch.get('settings'))
    for b in sch.get('blocks', []):
        check_settings_list(f, f'block {b.get("type")}', b.get('settings'))

# ---------------- liquid
OPEN_CLOSE = {'if': 'endif', 'unless': 'endunless', 'for': 'endfor', 'case': 'endcase', 'capture': 'endcapture',
              'form': 'endform', 'paginate': 'endpaginate', 'comment': 'endcomment', 'raw': 'endraw',
              'schema': 'endschema', 'javascript': 'endjavascript', 'stylesheet': 'endstylesheet', 'style': 'endstyle',
              'tablerow': 'endtablerow', 'doc': 'enddoc'}
TAG_RE = re.compile(r'{%-?\s*(\w+)')
OUT_RE = re.compile(r'{{-?(.*?)-?}}', re.S)
for f in CHANGED:
    if not f.endswith('.liquid') or not os.path.exists(os.path.join(BUILD, f)):
        continue
    txt = open(os.path.join(BUILD, f), encoding='utf-8').read()
    body = re.sub(r'{%-?\s*(comment|raw|schema|doc)\s*-?%}.*?{%-?\s*end\1\s*-?%}', '', txt, flags=re.S)
    stack = []
    # liquid tag blocks: count opens in {% liquid %} too
    for m in re.finditer(r'{%-?\s*liquid\b(.*?)-?%}', body, re.S):
        for line in m.group(1).splitlines():
            w = line.strip().split(' ')[0] if line.strip() else ''
            if w in OPEN_CLOSE:
                stack.append((w, 'liquid'))
            elif w.startswith('end') and w[3:] in OPEN_CLOSE:
                if stack and stack[-1][0] == w[3:]:
                    stack.pop()
                else:
                    err(f, f'liquid: unexpected {w} inside {{% liquid %}}')
    body2 = re.sub(r'{%-?\s*liquid\b.*?-?%}', '', body, flags=re.S)
    for m in TAG_RE.finditer(body2):
        w = m.group(1)
        if w in OPEN_CLOSE:
            stack.append((w, m.start()))
        elif w.startswith('end') and w[3:] in OPEN_CLOSE:
            if stack and stack[-1][0] == w[3:]:
                stack.pop()
            else:
                line = body2[:m.start()].count('\n') + 1
                err(f, f'liquid: unexpected {{% {w} %}} near line {line} (open: {[s[0] for s in stack][-3:]})')
    for s in stack:
        err(f, f'liquid: unclosed {{% {s[0]} %}}')
    for m in OUT_RE.finditer(body):
        inner = m.group(1)
        for q in re.findall(r"'[^']*'|\"[^\"]*\"", inner):
            if '{' in q or '}' in q:
                line = body[:m.start()].count('\n') + 1
                err(f, f'liquid: a quoted string with a brace inside {{{{ }}}} near line {line}: {q[:60]} (Shopify rejects it; build it with assign first)')
    for t in sorted(set(re.findall(r"{%-?\s*render\s+'([^']+)'", txt)) | set(re.findall(r"render\s+'([^']+)'", txt))):
        if not os.path.exists(os.path.join(BUILD, 'snippets', t + '.liquid')):
            err(f, f'liquid: renders missing snippet "{t}"')
    for a in sorted(set(re.findall(r"'([\w.-]+\.(?:css|js))'\s*\|\s*asset_url", txt))):
        if not os.path.exists(os.path.join(BUILD, 'assets', a)) and a.startswith('pln'):
            err(f, f'liquid: asset_url for missing asset "{a}"')

# ---------------- theme-check diff
if RUN_TC:
    here = os.path.dirname(os.path.abspath(__file__))
    runner = os.path.join(here, 'theme-dev', 'theme-check-dir.mjs')
    ign = '--ignore=MissingAsset,UndefinedObject,UnusedAssign,OrphanedSnippet,RemoteAsset,ValidScopedCSSClass,VariableName,UnusedDocParam'

    def tc(d):
        r = subprocess.run(['node', runner, d, '--json', ign], capture_output=True, text=True, cwd=os.path.dirname(runner), timeout=600)
        try:
            return json.loads(r.stdout)
        except Exception:
            err('theme-check', f'could not run on {d}: {r.stderr[-400:]}')
            return []
    base_rows = tc(BASE)
    build_rows = tc(BUILD)
    key = lambda r: (r['check'], r['file'], re.sub(r'\d+', '#', r['message']))
    base_keys = {}
    for r in base_rows:
        base_keys[key(r)] = base_keys.get(key(r), 0) + 1
    for r in build_rows:
        k = key(r)
        if base_keys.get(k, 0) > 0:
            base_keys[k] -= 1
            continue
        if r['check'] == 'JSONMissingBlock' and 'shopify://apps/' in r['message']:
            continue
        line = f'theme-check {r["check"]} {r["file"]}:{r["line"]} {r["message"]}'
        (errors if r['severity'] == 'error' else warns).append(('ERROR ' if r['severity'] == 'error' else 'WARN  ') + line)

for w in warns:
    print(w)
for e in errors:
    print(e)
print(f'CHANGED {len(CHANGED)} files, DELETED {len(DELETED)}: {", ".join(DELETED) if DELETED else "-"}')
print(f'SUMMARY errors={len(errors)} warnings={len(warns)} -> {"FAIL" if errors else "PASS"}')
sys.exit(1 if errors else 0)
