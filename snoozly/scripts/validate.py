#!/usr/bin/env python3
"""Strict checks Shopify's own theme-check does not make.

Shopify rejects (sometimes silently) a section whose schema breaks a rule, or
a template whose values do not fit the schema. This walks every section
schema and every JSON template / section group and fails on:

  schema   duplicate setting ids, range defaults off-step or out of bounds,
           more than 101 steps in a range, select defaults not among options,
           block types without names, presets naming unknown blocks
  template unknown section types, unknown setting ids, unknown block types,
           select values not among options, range values out of bounds or
           off-step, colour schemes that do not exist, block_order/blocks
           mismatches, order/sections mismatches
  settings settings_data keys that settings_schema does not define
"""
import json
import pathlib
import re
import sys

THEME = pathlib.Path(__file__).resolve().parent.parent / 'theme'
errors: list[str] = []


def err(where: str, msg: str) -> None:
    errors.append(f'{where}: {msg}')


def load_schema(path: pathlib.Path):
    src = path.read_text(encoding='utf-8')
    m = re.search(r'{%-?\s*schema\s*-?%}(.*?){%-?\s*endschema\s*-?%}', src, re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError as e:
        err(path.name, f'schema JSON invalid: {e}')
        return None


def check_range(where, s, value, label):
    lo, hi, step = s['min'], s['max'], s.get('step', 1)
    if not (lo <= value <= hi):
        err(where, f'{label} {value} outside {lo}–{hi}')
    if abs(((value - lo) / step) - round((value - lo) / step)) > 1e-9:
        err(where, f'{label} {value} not on step {step} from {lo}')


def check_setting_defs(where, settings):
    seen = set()
    for s in settings:
        sid = s.get('id')
        if s['type'] in ('header', 'paragraph'):
            continue
        if not sid:
            err(where, f'setting of type {s["type"]} has no id')
            continue
        if sid in seen:
            err(where, f'duplicate setting id {sid}')
        seen.add(sid)
        if s['type'] == 'range':
            steps = (s['max'] - s['min']) / s.get('step', 1)
            if steps > 101:
                err(where, f'range {sid} has {steps:.0f} steps (max 101)')
            if 'default' in s:
                check_range(where, s, s['default'], f'range {sid} default')
        if s['type'] in ('select', 'radio') and 'default' in s:
            opts = [o['value'] for o in s['options']]
            if s['default'] not in opts:
                err(where, f'select {sid} default {s["default"]!r} not in options')


def check_values(where, defs, values, schemes):
    by_id = {s['id']: s for s in defs if s.get('id')}
    for k, v in values.items():
        if k not in by_id:
            err(where, f'unknown setting {k!r}')
            continue
        s = by_id[k]
        t = s['type']
        if t in ('select', 'radio'):
            if v not in [o['value'] for o in s['options']]:
                err(where, f'{k}={v!r} not among options')
        elif t == 'range':
            if not isinstance(v, (int, float)):
                err(where, f'{k} must be a number')
            else:
                check_range(where, s, v, k)
        elif t == 'color_scheme':
            if v not in schemes:
                err(where, f'{k}={v!r} is not a colour scheme')
        elif t == 'checkbox' and not isinstance(v, bool):
            err(where, f'{k} must be true/false')


def main() -> None:
    data = json.loads((THEME / 'config/settings_data.json').read_text())
    schemes = set(data['current']['color_schemes'].keys())
    gschema = json.loads((THEME / 'config/settings_schema.json').read_text())
    gdefs = [s for grp in gschema[1:] for s in grp.get('settings', [])]
    check_setting_defs('settings_schema', gdefs)
    for k, v in data['current'].items():
        if k in ('color_schemes', 'sections', 'content_for_index', 'blocks'):
            continue
        if k not in {s.get('id') for s in gdefs}:
            err('settings_data', f'unknown global setting {k!r}')

    sections = {}
    for p in sorted((THEME / 'sections').glob('*.liquid')):
        sch = load_schema(p)
        if sch is None:
            err(p.name, 'no schema')
            continue
        sections[p.stem] = sch
        check_setting_defs(p.name, sch.get('settings', []))
        btypes = {}
        for b in sch.get('blocks', []):
            if b['type'].startswith('@'):
                continue
            if 'name' not in b:
                err(p.name, f'block {b["type"]} has no name')
            check_setting_defs(f'{p.name} block {b["type"]}', b.get('settings', []))
            btypes[b['type']] = b
        for pr in sch.get('presets', []):
            for b in pr.get('blocks', []):
                if b['type'] not in btypes:
                    err(p.name, f'preset uses unknown block {b["type"]}')
                else:
                    check_values(f'{p.name} preset block', btypes[b['type']].get('settings', []), b.get('settings', {}), schemes)
        for s in sch.get('settings', []):
            if s['type'] == 'color_scheme' and s.get('default') not in schemes:
                err(p.name, f'color_scheme default {s.get("default")!r} missing')

    json_files = list((THEME / 'templates').rglob('*.json')) + list((THEME / 'sections').glob('*.json'))
    for p in sorted(json_files):
        where = p.relative_to(THEME).as_posix()
        t = json.loads(p.read_text())
        secs = t.get('sections', {})
        if set(t.get('order', [])) != set(secs.keys()):
            err(where, 'order does not match sections')
        for sid, sec in secs.items():
            typ = sec['type']
            if typ not in sections:
                err(where, f'{sid}: unknown section type {typ}')
                continue
            sch = sections[typ]
            check_values(f'{where} {sid}', sch.get('settings', []), sec.get('settings', {}), schemes)
            btypes = {b['type']: b for b in sch.get('blocks', [])}
            blocks = sec.get('blocks', {})
            if set(sec.get('block_order', [])) != set(blocks.keys()):
                err(where, f'{sid}: block_order does not match blocks')
            for bid, b in blocks.items():
                if b['type'] not in btypes:
                    err(where, f'{sid}.{bid}: unknown block type {b["type"]}')
                    continue
                check_values(f'{where} {sid}.{bid}', btypes[b['type']].get('settings', []), b.get('settings', {}), schemes)
                lim = btypes[b['type']].get('limit')
                if lim and sum(1 for x in blocks.values() if x['type'] == b['type']) > lim:
                    err(where, f'{sid}: more than {lim} {b["type"]} blocks')
            mx = sch.get('max_blocks')
            if mx and len(blocks) > mx:
                err(where, f'{sid}: {len(blocks)} blocks, max {mx}')

    if errors:
        print('\n'.join(errors))
        print(f'FAIL — {len(errors)} problem(s)')
        sys.exit(1)
    print(f'PASS — {len(sections)} sections, {len(json_files)} templates/groups, settings_data clean')


if __name__ == '__main__':
    main()
