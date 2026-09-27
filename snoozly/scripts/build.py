#!/usr/bin/env python3
"""Build the Snoozly theme assets.

Concatenates snoozly/src/css/*.css -> theme/assets/snoozly.css and
snoozly/src/js/*.js -> theme/assets/snoozly.js, in filename order, and writes
a zip of the theme ready for Shopify (themeCreate or Online Store → Themes →
Upload).

    python3 snoozly/scripts/build.py          # assets only
    python3 snoozly/scripts/build.py --zip    # assets + dist/snoozly-theme.zip
"""
import pathlib
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'src'
THEME = ROOT / 'theme'
DIST = ROOT / 'dist'


def concat(kind: str, out: pathlib.Path) -> int:
    parts = sorted((SRC / kind).glob(f'*.{kind}'))
    body = '\n'.join(p.read_text(encoding='utf-8').rstrip() + '\n' for p in parts)
    out.write_text(body, encoding='utf-8')
    return len(body.encode('utf-8'))


def main() -> None:
    css = concat('css', THEME / 'assets' / 'snoozly.css')
    js = concat('js', THEME / 'assets' / 'snoozly.js')
    print(f'snoozly.css {css / 1024:.1f} KB   snoozly.js {js / 1024:.1f} KB')
    if '--zip' in sys.argv:
        DIST.mkdir(exist_ok=True)
        z = DIST / 'snoozly-theme.zip'
        with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as zf:
            for f in sorted(THEME.rglob('*')):
                if f.is_file() and not f.name.startswith('.'):
                    zf.write(f, f.relative_to(THEME).as_posix())
        print(f'{z.relative_to(ROOT.parent)} {z.stat().st_size / 1024:.1f} KB')


if __name__ == '__main__':
    main()
