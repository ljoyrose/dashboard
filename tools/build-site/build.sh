#!/bin/sh
# Builds _site/ for Cloudflare Pages: the same files the GitHub Pages publish copies, nothing else
# (no tests, docs, fixtures, tools or .github). The file list is read from pages.yml so there is one list.
# Cloudflare Pages settings: Build command "sh tools/build-site/build.sh", Build output directory "_site".
set -eu
cd "$(dirname "$0")/../.."
files=$(sed -n 's/^ *cp -r \(.*\) _site\/$/\1/p' .github/workflows/pages.yml | head -n 1)
[ -n "$files" ] || { echo "No cp line found in pages.yml" >&2; exit 1; }
rm -rf _site && mkdir _site
# shellcheck disable=SC2086 # the list is meant to split on spaces
cp -r $files _site/
for f in index.html auth.js config.js toolkit.js sw.js manifest.webmanifest money/core.js; do
  test -f "_site/$f" || { echo "Missing _site/$f" >&2; exit 1; }
done
echo "Built _site/ from: $files"
