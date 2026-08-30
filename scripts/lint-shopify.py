#!/usr/bin/env python3
"""Pre-deploy checks for the PawLunova theme files.

Shopify reports most section failures asynchronously and silently: a section
with a bad schema simply stops existing, and any template referencing it then
fails validation with a message that points at the template, not the cause.
Everything here exists because one of those failures cost a deploy.

Usage: python3 scripts/lint-shopify.py [--root shopify]
"""
import argparse
import json
import os
import re
import sys

BLOCK_TAGS = {
    'if': 'endif', 'unless': 'endunless', 'for': 'endfor', 'case': 'endcase',
    'capture': 'endcapture', 'form': 'endform', 'paginate': 'endpaginate',
    'tablerow': 'endtablerow', 'comment': 'endcomment', 'raw': 'endraw',
    'schema': 'endschema', 'javascript': 'endjavascript',
    'stylesheet': 'endstylesheet', 'style': 'endstyle', 'liquid': None,
    # Shopify's snippet documentation block. Theme-supplied snippets use it,
    # so a snippet overriding one has to be allowed to keep its docs.
    'doc': 'enddoc',
}
IDENT = re.compile(r'^[a-z_][a-z0-9_]*$', re.I)

errors = []
warnings = []


def err(path, msg):
    errors.append('%s: %s' % (path, msg))


def warn(path, msg):
    warnings.append('%s: %s' % (path, msg))


def check_tag_balance(path, src):
    """Liquid block tags must nest and close. `{% liquid %}` bodies are skipped
    because their `if`/`endif` live on bare lines, not in `{% %}` delimiters."""
    stack = []
    for m in re.finditer(r'{%-?\s*(\w+)', src):
        tag = m.group(1)
        if tag == 'liquid':
            continue
        if tag in BLOCK_TAGS and BLOCK_TAGS[tag]:
            stack.append((tag, m.start()))
        elif tag.startswith('end'):
            want = tag[3:]
            if not stack:
                err(path, 'stray {%% %s %%} at offset %d' % (tag, m.start()))
            elif stack[-1][0] != want:
                err(path, 'expected {%% end%s %%} but found {%% %s %%} at offset %d'
                    % (stack[-1][0], tag, m.start()))
                stack.pop()
            else:
                stack.pop()
    for tag, pos in stack:
        err(path, 'unclosed {%% %s %%} at offset %d' % (tag, pos))


def walk_settings(path, settings, where):
    seen_ids = {}
    for s in settings:
        if not isinstance(s, dict):
            err(path, '%s: setting is not an object' % where)
            continue
        stype = s.get('type')
        if stype in ('header', 'paragraph'):
            continue
        sid = s.get('id')
        if not sid:
            err(path, '%s: setting of type %r has no id' % (where, stype))
            continue
        # Liquid resolves settings as `section.settings.<id>` — a hyphen there
        # parses as subtraction, so the value silently reads as nil.
        if not IDENT.match(sid):
            err(path, '%s: setting id %r is not a valid Liquid identifier' % (where, sid))
        # Two settings sharing an id is not a merge Shopify performs — it is a
        # schema it rejects, dropping the file with no error. It happens when
        # two rounds of work add a control with the same name to one section,
        # which is exactly how it reached pl-pdp-main: a checkbox and a range
        # both called eyebrow_rule. Liquid could only ever read one of them.
        if sid in seen_ids:
            err(path, '%s: duplicate setting id %r (as %s and %s)'
                % (where, sid, seen_ids[sid], stype))
        seen_ids[sid] = stype
        # Shopify rejects an empty string default outright and drops the section.
        if 'default' in s and s['default'] == '':
            err(path, '%s: setting %r has an empty string default' % (where, sid))
        # `unit` has to be absent or say something. Present-and-empty is the
        # same silent drop as the rules above: the upload reports success, no
        # userErrors, and the previous version of the file stays on the store.
        # Omit the key when a slider counts bare numbers.
        if s.get('unit') == '':
            err(path, '%s: setting %r has an empty unit — omit the key instead'
                % (where, sid))
        for key in ('label', 'info', 'placeholder'):
            if s.get(key) == '':
                warn(path, '%s: setting %r has an empty %s' % (where, sid, key))
        # A range slider may have at most 101 positions, and its default has to
        # land on one of them. Break either rule and Shopify drops the whole
        # section on upload without saying so: the file uploads, reports no
        # error, and the previous version of the section stays in place.
        if stype == 'range':
            try:
                lo, hi, step = s['min'], s['max'], s['step']
            except KeyError as e:
                err(path, '%s: range %r is missing %s' % (where, sid, e))
                continue
            if step <= 0:
                err(path, '%s: range %r has a step of %r' % (where, sid, step))
                continue
            steps = (hi - lo) / step
            if steps > 101:
                err(path, '%s: range %r spans %.0f steps, max is 101 '
                          '(min %s, max %s, step %s)' % (where, sid, steps, lo, hi, step))
            dflt = s.get('default')
            if dflt is not None:
                if dflt < lo or dflt > hi:
                    err(path, '%s: range %r default %r is outside %s-%s'
                        % (where, sid, dflt, lo, hi))
                elif (dflt - lo) % step:
                    err(path, '%s: range %r default %r is not a step from %s'
                        % (where, sid, dflt, lo))


def check_schema(path, src):
    m = re.search(r'{%-?\s*schema\s*-?%}(.*?){%-?\s*endschema\s*-?%}', src, re.S)
    if not m:
        return None
    try:
        schema = json.loads(m.group(1))
    except ValueError as e:
        err(path, 'schema is not valid JSON: %s' % e)
        return None

    if 'name' not in schema:
        err(path, 'schema has no name')
    # Shopify caps section and preset names at 25 characters and rejects the
    # whole file if either is longer — silently, when uploaded by URL.
    for kind, name in ([('schema name', schema.get('name'))] +
                       [('preset name', p.get('name')) for p in schema.get('presets', [])]):
        if name and len(name) > 25:
            err(path, '%s is %d characters, max is 25: %r' % (kind, len(name), name))
    tag = schema.get('tag')
    if tag is not None and tag not in ('article', 'aside', 'div', 'footer',
                                       'header', 'section'):
        err(path, 'schema tag %r is not one of Shopify\'s allowed wrappers' % tag)

    walk_settings(path, schema.get('settings', []), 'settings')

    seen = set()
    for b in schema.get('blocks', []):
        btype = b.get('type')
        if not btype:
            err(path, 'block has no type')
            continue
        # @app and @theme are Shopify's own reserved block types, not merchant
        # identifiers. @app is what lets an app put a block inside a section at
        # all; without it the app has nowhere to render and no error says so.
        if btype in ('@app', '@theme'):
            if b.get('settings'):
                err(path, 'block %r cannot declare settings' % btype)
            if btype in seen:
                err(path, 'duplicate block type %r' % btype)
            seen.add(btype)
            continue
        if not IDENT.match(btype):
            err(path, 'block type %r is not a valid identifier' % btype)
        if btype in seen:
            err(path, 'duplicate block type %r' % btype)
        seen.add(btype)
        walk_settings(path, b.get('settings', []), 'block %r' % btype)

    return schema


def load_store_only(root):
    """Files that live on the store but not in this repo — see shopify/.store-only.

    Without this the linter reports six broken references on a product page
    that renders perfectly well on the store, which trains you to ignore its
    errors. That is worse than not checking at all."""
    path = os.path.join(root, '.store-only')
    names = set()
    if os.path.exists(path):
        for line in open(path, encoding='utf-8'):
            line = line.split('#', 1)[0].strip()
            if line:
                names.add(line)
    return names


def check_render_targets(path, src, snippets, store_only):
    for m in re.finditer(r"{%-?\s*render\s+'([^']+)'", src):
        name = m.group(1)
        if name in snippets:
            continue
        if 'snippets/%s.liquid' % name in store_only:
            warn(path, 'renders %r, which lives on the store only (.store-only)'
                 % name)
        else:
            err(path, 'renders missing snippet %r' % name)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', default='shopify')
    args = ap.parse_args()
    root = args.root

    sec_dir = os.path.join(root, 'sections')
    tpl_dir = os.path.join(root, 'templates')
    snip_dir = os.path.join(root, 'snippets')

    snippets = {f[:-7] for f in os.listdir(snip_dir) if f.endswith('.liquid')}
    store_only = load_store_only(root)

    schemas = {}
    for f in sorted(os.listdir(sec_dir)):
        if not f.endswith('.liquid'):
            continue
        p = os.path.join(sec_dir, f)
        src = open(p, encoding='utf-8').read()
        check_tag_balance(p, src)
        check_render_targets(p, src, snippets, store_only)
        s = check_schema(p, src)
        if s is None:
            err(p, 'no {% schema %} block')
        else:
            schemas[f[:-7]] = s

    for f in sorted(os.listdir(snip_dir)):
        if f.endswith('.liquid'):
            p = os.path.join(snip_dir, f)
            src = open(p, encoding='utf-8').read()
            check_tag_balance(p, src)
            check_render_targets(p, src, snippets, store_only)

    for f in sorted(os.listdir(tpl_dir)):
        if not f.endswith('.json'):
            continue
        p = os.path.join(tpl_dir, f)
        raw = open(p, encoding='utf-8').read()
        # Shopify's theme editor writes a /* ... */ banner above the JSON in
        # every template it saves. It is valid for Shopify and invalid for
        # json.load, so a template round-tripped through the editor would
        # otherwise fail this check for no reason.
        body = re.sub(r'\A\s*/\*.*?\*/\s*', '', raw, flags=re.S)
        try:
            tpl = json.loads(body)
        except ValueError as e:
            err(p, 'not valid JSON: %s' % e)
            continue

        secs = tpl.get('sections', {})
        order = tpl.get('order', [])
        for key in order:
            if key not in secs:
                err(p, 'order lists %r which has no section entry' % key)
        for key in secs:
            if key not in order:
                warn(p, 'section %r is defined but not in order — it will not render' % key)

        for key, sec in secs.items():
            stype = sec.get('type')
            if stype is None:
                err(p, 'section %r has no type' % key)
                continue
            if stype.startswith('pl-') and stype not in schemas:
                err(p, 'section %r references missing section file %r' % (key, stype))
                continue
            if stype not in schemas:
                continue  # a theme section we don't own
            schema = schemas[stype]

            valid_settings = set()
            for s in schema.get('settings', []):
                if s.get('id'):
                    valid_settings.add(s['id'])
            for sid in sec.get('settings', {}):
                if sid not in valid_settings:
                    warn(p, 'section %r sets %r which %s does not declare'
                         % (key, sid, stype))

            block_defs = {b['type']: b for b in schema.get('blocks', []) if b.get('type')}
            if sec.get('blocks') and not block_defs:
                err(p, 'section %r has blocks but %s declares none' % (key, stype))
            # A template carrying more blocks of a type than the section allows
            # is rejected whole, and silently: the upload succeeds, reports no
            # error, and the store keeps the template it already had. Growing a
            # section's content without raising its limit is the easy way in —
            # the bed finder went from 11 recommendations to 24 against a limit
            # that still read 11.
            used = {}
            for b in sec.get('blocks', {}).values():
                if b.get('type'):
                    used[b['type']] = used.get(b['type'], 0) + 1
            for btype, count in sorted(used.items()):
                limit = block_defs.get(btype, {}).get('limit')
                if limit and count > limit:
                    err(p, 'section %r has %d %r blocks but %s allows %d'
                        % (key, count, btype, stype, limit))
            if sum(used.values()) > 50:
                err(p, 'section %r has %d blocks, Shopify allows 50'
                    % (key, sum(used.values())))
            for bkey, b in sec.get('blocks', {}).items():
                btype = b.get('type')
                if btype not in block_defs:
                    err(p, 'section %r block %r has type %r which %s does not declare'
                        % (key, bkey, btype, stype))
                    continue
                valid = {s['id'] for s in block_defs[btype].get('settings', []) if s.get('id')}
                for sid in b.get('settings', {}):
                    if sid not in valid:
                        warn(p, 'section %r block %r sets %r which block %r does not declare'
                             % (key, bkey, sid, btype))
            border = sec.get('block_order', [])
            for bkey in border:
                if bkey not in sec.get('blocks', {}):
                    err(p, 'section %r block_order lists %r with no block' % (key, bkey))
            for bkey in sec.get('blocks', {}):
                if border and bkey not in border:
                    warn(p, 'section %r block %r is not in block_order' % (key, bkey))

    for w in warnings:
        print('WARN  ' + w)
    for e in errors:
        print('ERROR ' + e)
    print('\n%d section(s), %d error(s), %d warning(s)'
          % (len(schemas), len(errors), len(warnings)))
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
