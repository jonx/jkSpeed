#!/bin/bash
# Package jkSpeed for Chrome Web Store submission
# Creates a zip file ready to upload at https://chrome.google.com/webstore/devconsole

set -e

VERSION=$(grep '"version"' manifest.json | sed 's/.*: "\(.*\)".*/\1/')
OUTPUT="jkSpeed-v${VERSION}.zip"

# Clean up any previous build
rm -f "$OUTPUT"

# Package only the files Chrome needs (no store assets, scripts, or repo files)
zip -r "$OUTPUT" \
  manifest.json \
  service-worker.js \
  content/content.js \
  popup/popup.html \
  popup/popup.css \
  popup/popup.js \
  icons/icon16.png \
  icons/icon32.png \
  icons/icon48.png \
  icons/icon128.png \
  icons/icon16-inactive.png \
  icons/icon32-inactive.png \
  icons/icon48-inactive.png \
  icons/icon128-inactive.png \
  PRIVACY.md \
  LICENSE

echo ""
echo "Packaged: $OUTPUT ($(du -h "$OUTPUT" | cut -f1))"
echo "Upload at: https://chrome.google.com/webstore/devconsole"
