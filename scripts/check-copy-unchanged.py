#!/usr/bin/env python3
"""Prove a template's copy did not change.

The homepage redesign was asked for on one condition: change the design, not a
word of the text. Asserting that in a commit message is worth nothing. This
diffs a template against the version in git and fails if any value that existed
before has a different value now, or has gone missing. New keys are allowed —
a key this round introduced is a design setting by construction — and `order`
is allowed to differ, because reordering sections is a layout change.

Usage:
  python3 scripts/check-copy-unchanged.py [--ref HEAD] [template ...]

Defaults to shopify/templates/index.json against HEAD. Run it before pushing
any change that is meant to be design-only.
"""
import argparse
import json
import re
import subprocess
import sys


def load(text):
    """Shopify's theme editor writes a /* ... */ banner above the JSON in every
    template it saves, so anything round-tripped through the admin carries one.
    It is valid to Shopify and invalid to json.loads."""
    return json.loads(re.sub(r'\A\s*/\*.*?\*/\s*', '', text, flags=re.S))


def flatten(obj, path=''):
    """Every leaf keyed by its path. Lists key by index, which is why the
    caller drops `order` before comparing rather than trying to match it up."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from flatten(v, '%s.%s' % (path, k))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from flatten(v, '%s[%d]' % (path, i))
    else:
        yield path, obj


def check(rel, ref):
    try:
        raw = subprocess.check_output(['git', 'show', '%s:%s' % (ref, rel)],
                                      stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError:
        print('%s: not in %s, nothing to compare' % (rel, ref))
        return 0

    old = load(raw.decode('utf-8'))
    new = load(open(rel, encoding='utf-8').read())

    old.pop('order', None)
    new.pop('order', None)

    a = dict(flatten(old))
    b = dict(flatten(new))

    changed = [(k, a[k], b.get(k, '<<MISSING>>'))
               for k in a if k not in b or a[k] != b[k]]
    if changed:
        print('FAIL %s — %d existing value(s) changed:' % (rel, len(changed)))
        for k, was, now in changed:
            print('  %s\n    was: %r\n    now: %r' % (k, was, now))
        return 1

    added = sorted(set(b) - set(a))

    # Narrower second pass on the strings a customer reads, scoped to keys that
    # existed before. A heuristic over all values cannot work: "5 / 6" contains
    # a space and is an aspect ratio, not copy.
    before = sorted(v for v in a.values() if isinstance(v, str) and ' ' in v)
    after = sorted(b[k] for k in a if isinstance(b.get(k), str) and ' ' in b[k])
    if before != after:
        print('FAIL %s — the copy set differs.' % rel)
        return 1

    print('PASS %s' % rel)
    print('  %d values carried through unchanged, %d copy strings intact, '
          '%d new keys.' % (len(a), len(before), len(added)))
    if added:
        vals = sorted({repr(b[k]) for k in added if isinstance(b[k], str)})
        if vals:
            print('  new string values (design settings): ' + ', '.join(vals))
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ref', default='HEAD')
    ap.add_argument('templates', nargs='*',
                    default=['shopify/templates/index.json'])
    args = ap.parse_args()
    return max(check(t, args.ref) for t in args.templates)


if __name__ == '__main__':
    sys.exit(main())
