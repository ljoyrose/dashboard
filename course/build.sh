#!/usr/bin/env bash
# Rebuild the whole course from glossary.json, data/, decks/ and scripts/. Run from course/. First time: npm install
set -euo pipefail
cd "$(dirname "$0")"
python3 build/tokens.py
python3 build/g_road.py && python3 build/g_flow.py && python3 build/g_set.py && python3 build/g_codes_card.py litterline stayproof trimtable
node build/shoot.mjs graphics/*.svg
python3 build/modules.py
for d in decks/keynote.json decks/partner-webinar.json; do python3 build/deck.py "$d"; python3 build/deck.py "$d" --brand ppp; done
python3 build/deck.py --no-png decks/track-f/M*.json
python3 build/export_script.py decks/keynote.json decks/partner-webinar.json
python3 vision2029/pages.py && (cd vision2029/pages && for f in *.html; do node ../../build/shoot.mjs --html "$f" --width 1440 --out "${f%.html}-desktop.png"; node ../../build/shoot.mjs --html "$f" --width 430 --out "${f%.html}-phone.png"; done)
(cd .. && node course/vision2029/shoot-dashboard.cjs)
python3 apps/screens.py && (cd apps/out && for f in *.html; do node ../../build/shoot.mjs --html "$f" --width 1440 --out "${f%.html}.png"; done)
python3 build/workbook.py ljr7 ppp
python3 build/cf_pack.py
python3 build/syllabus.py
python3 build/index.py
echo "Videos: node video/render.mjs   (separate, slower)"
python3 qa/check.py
