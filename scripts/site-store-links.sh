#!/usr/bin/env bash
# Fills the store links of the landing and the invitation page at deploy time (pages.yml):
#   APP_STORE_ID=123 PLAY_URL='https://play.google.com/…?id=x&hl=es' bash scripts/site-store-links.sh site
# Empty variables leave the attributes empty, and the pages say the app is not in that store yet.
# Perl instead of sed: a `&` or a `/` in the URL must land as is (bloque 15.5, revisión).
set -euo pipefail

dir="${1:-site}"
export APP_STORE_ID="${APP_STORE_ID:-}" PLAY_URL="${PLAY_URL:-}"
for page in "$dir/index.html" "$dir/invite/index.html"; do
  perl -pi -e 's/data-app-store-id=""/data-app-store-id="$ENV{APP_STORE_ID}"/; s/data-play-url=""/data-play-url="$ENV{PLAY_URL}"/' "$page"
  grep -o 'data-[a-z-]*="[^"]*"' "$page" | sed "s#^#$page: #"
done
