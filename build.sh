#!/bin/sh
# Builds dist/highlights.zip for the Chrome Web Store: the same files minus the
# dev-only manifest "key" (the store rejects it and assigns its own ID).
set -e
cd "$(dirname "$0")"
rm -rf dist && mkdir -p dist/highlights
cp *.js *.html *.css dist/highlights/
cp -r icons dist/highlights/
rm dist/highlights/shared.test.js
python3 -c "import json; m = json.load(open('manifest.json')); m.pop('key'); json.dump(m, open('dist/highlights/manifest.json', 'w'), indent=2)"
(cd dist/highlights && zip -qr ../highlights.zip .)
echo "dist/highlights.zip"
