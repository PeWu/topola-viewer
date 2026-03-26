#!/usr/bin/env bash
# ============================================================
#  build-offline.sh  –  Mac / Linux / GitHub Codespace
#  Produces dist/index.html: a single fully-offline HTML file
#  with the GEDCOM baked in.
#
#  Usage:
#    chmod +x build-offline.sh
#    ./build-offline.sh path/to/your-file.ged
#
#  Requires: Node.js 18+
# ============================================================
set -euo pipefail

GED_FILE="${1:-}"

if [[ -z "$GED_FILE" ]]; then
  echo "Usage: $0 path/to/your-file.ged"
  exit 1
fi

if [[ ! -f "$GED_FILE" ]]; then
  echo "Error: file not found: $GED_FILE"
  exit 1
fi

echo "▶ Step 1/4  Installing dependencies..."
npm install

echo "▶ Step 2/4  Installing vite-plugin-singlefile..."
npm install vite-plugin-singlefile --save-dev

echo "▶ Step 3/4  Encoding GEDCOM and writing .env.local..."

# macOS uses -i, Linux/Codespace uses -w 0
if [[ "$(uname)" == "Darwin" ]]; then
  GEDCOM_B64=$(base64 -i "$GED_FILE")
else
  GEDCOM_B64=$(base64 -w 0 "$GED_FILE")
fi

# Write to .env.local so Vite reads it directly from disk.
# This avoids the Linux shell env-size limit (~2 MB for all env vars
# combined), which causes "Argument list too long" when you try to
# export a large base64 string via `export VAR=...`.
cat > .env.local << ENVEOF
VITE_STATIC_URL=data:text/plain;base64,${GEDCOM_B64}
VITE_GOOGLE_ANALYTICS=false
VITE_CHANGELOG=
VITE_GIT_SHA=local
VITE_GIT_TIME=local
ENVEOF

echo "▶ Step 4/4  Building..."
npx vite build

# Clean up — the .env.local contains the full GEDCOM in base64
rm -f .env.local

echo ""
echo "✅ Done!  dist/index.html  ($(du -sh dist/index.html | cut -f1))"
echo "   Open it in any browser — no internet required."
