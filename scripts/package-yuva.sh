#!/usr/bin/env bash
# Package the Yuva (Horizon) theme as a zip Shopify accepts in
# Online Store > Themes > Add theme > Upload zip file.
#
# Usage: scripts/package-yuva.sh [output.zip]
# Default output: dist/yuva-horizon-<version>.zip (dist/ is gitignored).
#
# Only Shopify's theme folders go into the zip; the repository's notes,
# LICENSE.md and release notes stay out of the upload.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
theme="$root/yuva"
version="$(python3 -c "import json,re,sys; s=open('$theme/config/settings_schema.json').read(); d=json.loads(s); print(next((g.get('theme_version','') for g in d if g.get('name')=='theme_info'),'0'))")"
out="${1:-$root/dist/yuva-horizon-$version.zip}"

mkdir -p "$(dirname "$out")"
rm -f "$out"
(
  cd "$theme"
  zip -qr -X "$out" assets blocks config layout locales sections snippets templates
)
echo "Packaged $(unzip -Z1 "$out" | wc -l) files into $out ($(du -h "$out" | cut -f1))"
