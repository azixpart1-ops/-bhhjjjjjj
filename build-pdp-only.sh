#!/usr/bin/env bash
# Build the minimal-risk theme: the merchant's ORIGINAL export with one file
# changed (templates/product.json) and the ten unused space-named templates
# removed. Requires the original export extracted at $1.
set -euo pipefail
SRC="${1:?usage: build-pdp-only.sh /path/to/original-export}"
OUT="dist/comfortcrest-pdp-only.zip"
WORK="$(mktemp -d)"
cp -r "$SRC"/* "$WORK"/
cp templates/product.json "$WORK/templates/product.json"
cp templates/product.json "$WORK/templates/product.d1.json"
rm -f "$WORK"/templates/product.d1\ copy*.json
mkdir -p dist && rm -f "$OUT"
( cd "$WORK" && zip -rq "$OLDPWD/$OUT" assets blocks config layout locales sections snippets templates -x '*.DS_Store' )
rm -rf "$WORK"
echo "$OUT"
