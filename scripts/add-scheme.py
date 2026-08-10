#!/usr/bin/env python3
"""Give every pl-* section its own colour controls.

Shopify schemas cannot include a shared fragment, so the same settings have to
appear in each section file. Doing that by hand across thirty-odd files is how
they drift, so it is done here instead: the settings and the render call are
generated from one definition, and re-running is a no-op on files that already
have them.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'shopify' / 'sections'

SETTINGS = [
    {"type": "header", "content": "Colour"},
    {"type": "paragraph",
     "content": "Text colour is chosen by measuring contrast against the background you pick, so a section cannot end up unreadable. The editor warns you if a background leaves no readable option."},
    {"type": "select", "id": "scheme", "label": "Colour scheme", "default": "default",
     "options": [
         {"value": "default", "label": "Theme default"},
         {"value": "cream", "label": "Cream, calm"},
         {"value": "oat", "label": "Oat, warm neutral"},
         {"value": "gold", "label": "Gold, warmth"},
         {"value": "forest", "label": "Forest, authority"},
         {"value": "clay", "label": "Deep green, focus"},
         {"value": "custom", "label": "Custom"},
     ]},
    {"type": "color", "id": "bg", "label": "Background", "info": "Custom scheme only."},
    {"type": "color", "id": "accent", "label": "Buttons and links", "info": "Custom scheme only."},
    {"type": "select", "id": "tone", "label": "Text colour", "default": "auto",
     "options": [
         {"value": "auto", "label": "Automatic, recommended"},
         {"value": "dark", "label": "Dark"},
         {"value": "light", "label": "Light"},
     ]},
]

RENDER = ("{% render 'pl-scheme', id: section.id, scheme: section.settings.scheme, "
          "bg: section.settings.bg, accent: section.settings.accent, "
          "tone: section.settings.tone %}\n")

SCHEMA_RE = re.compile(r'({%-?\s*schema\s*-?%})(.*?)({%-?\s*endschema\s*-?%})', re.S)

# Sections with no visual ground of their own: the drawer paints itself, and
# the marquee is a strip that inherits whatever it sits on.
SKIP = {'pl-cart-drawer'}


def main():
    changed, skipped = [], []
    for path in sorted(ROOT.glob('pl-*.liquid')):
        name = path.stem
        src = path.read_text(encoding='utf-8')

        if name in SKIP:
            skipped.append((name, 'not a section with a ground'))
            continue
        if "render 'pl-scheme'" in src:
            skipped.append((name, 'already done'))
            continue

        m = SCHEMA_RE.search(src)
        if not m:
            skipped.append((name, 'no schema block'))
            continue

        schema = json.loads(m.group(2))
        schema.setdefault('settings', []).extend(SETTINGS)
        body = json.dumps(schema, indent=2, ensure_ascii=False)
        src = src[:m.start()] + m.group(1) + '\n' + body + '\n' + m.group(3) + src[m.end():]

        # The style block has to land before the markup it restyles. Every one
        # of these sections opens by pulling in the stylesheet, so it goes
        # straight after that line.
        if src.startswith("{% render 'pl-assets' %}"):
            src = src.replace("{% render 'pl-assets' %}\n",
                              "{% render 'pl-assets' %}\n" + RENDER, 1)
        else:
            src = RENDER + src

        path.write_text(src, encoding='utf-8')
        changed.append(name)

    print('added colour controls to %d section(s):' % len(changed))
    for c in changed:
        print('   ', c)
    if skipped:
        print('\nskipped %d:' % len(skipped))
        for n, why in skipped:
            print('    %-22s %s' % (n, why))
    return 0


if __name__ == '__main__':
    sys.exit(main())
