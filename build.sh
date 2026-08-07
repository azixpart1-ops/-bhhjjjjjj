#!/usr/bin/env bash
# Package the theme for upload to Shopify.
#
# Shopify expects the theme directories at the root of the archive, so the
# repo's own files (README, this script, .git) are deliberately left out.
set -euo pipefail

cd "$(dirname "$0")"

OUT="dist/comfortcrest-horizon-conversion.zip"
mkdir -p dist
rm -f "$OUT"

zip -rq "$OUT" \
  assets blocks config layout locales sections snippets templates \
  -x '*.DS_Store' -x '__MACOSX/*'

echo "$OUT — $(du -h "$OUT" | cut -f1), $(unzip -l "$OUT" | tail -1 | awk '{print $2}') files"
