#!/usr/bin/env bash
# Fetch a page from the draft theme.
#
# ?preview_theme_id= only works once Shopify has set a session cookie, so the
# first request exists purely to collect one. Anonymous requests without it
# silently return the LIVE theme, which looks like "my changes did not deploy".
#
# Usage: scripts/preview.sh [path] [outfile]
set -euo pipefail
THEME_ID="${CC_THEME_ID:-207020949835}"
SHOP="${CC_SHOP:-https://comfortcrest.co.uk}"
PATH_="${1:-/}"
OUT="${2:-/tmp/cc-preview.html}"
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
CJ="$(mktemp)"
curl -sL --max-time 90 -A "$UA" -c "$CJ" -b "$CJ" \
  "${SHOP}/?preview_theme_id=${THEME_ID}" -o /dev/null
curl -sL --max-time 90 -A "$UA" -c "$CJ" -b "$CJ" \
  "${SHOP}${PATH_}" -o "$OUT" -w "%{http_code} %{size_download}b ${PATH_}\n"
rm -f "$CJ"
echo "--- liquid errors ---"
grep -oiE "Liquid error[^<]{0,160}" "$OUT" | sort -u | head -20 || true
echo "--- (none above means clean) ---"
