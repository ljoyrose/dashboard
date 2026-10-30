#!/usr/bin/env bash
# run-all.sh - run the same checks CI runs, inside a session, with no GitHub Actions minutes. JOB 38.
# Pattern for repos whose Actions minutes are used up (see docs/job38/PRIVATE-REPOS.md).
#
#   bash tools/ci-local/run-all.sh            every check (browser suite about 10 min)
#   bash tools/ci-local/run-all.sh --quick    skip the browser suite
#
# Runs on a clean copy of HEAD in a temp folder OUTSIDE the repo (uncommitted files are not tested, as in CI).
# Privacy guard: the real denylist never lives here. Set PRIVACY_DENYLIST_FILE to a file outside the repo;
# if unset, a placeholder holding one invented term is made in the temp folder (DENY is then a placeholder,
# the EMAIL, DRIVE, PHONE, PATH and AUTHOR rules run for real). CI's "Privacy guard" runs the real DENY rule.
# Browser: if Playwright's own pinned browser is missing, a wrapper config (in the temp folder) points it at
# $PW_EXECUTABLE (default /opt/pw-browsers/chromium). Nothing is pushed, sent or written inside the repo.
set -u
QUICK=0; [ "${1:-}" = "--quick" ] && QUICK=1
REPO=$(git rev-parse --show-toplevel) || exit 2
SHA=$(git -C "$REPO" rev-parse HEAD)
BASE=${BASE_REF:-origin/main}
TMP=$(mktemp -d "${TMPDIR:-/tmp}/run-all.XXXXXX")
WT="$TMP/wt"
cleanup() { git -C "$REPO" worktree remove --force "$WT" >/dev/null 2>&1; rm -rf "$TMP"; }
trap cleanup EXIT
git -C "$REPO" worktree add -q --detach "$WT" "$SHA" || exit 2
cd "$WT" || exit 2

if [ -d "$REPO/node_modules" ]; then ln -s "$REPO/node_modules" node_modules
else npm ci --no-audit --no-fund >"$TMP/npm.log" 2>&1 || { echo "npm ci failed (see $TMP/npm.log)"; exit 2; }; fi

DENY_NOTE="real"
if [ -z "${PRIVACY_DENYLIST_FILE:-}" ]; then
  printf 'zzinventedplaceholderterm\n' > "$TMP/denylist.txt"
  export PRIVACY_DENYLIST_FILE="$TMP/denylist.txt"; DENY_NOTE="placeholder"
fi

PW_CONFIG=""
PIN=$(node -e "try{console.log(require('playwright-core').chromium.executablePath())}catch(e){console.log('')}" 2>/dev/null)
if [ -z "$PIN" ] || [ ! -x "$PIN" ]; then
  export PW_EXECUTABLE="${PW_EXECUTABLE:-/opt/pw-browsers/chromium}"
  cat > "$TMP/pw-wrap.config.js" <<JS
const path = require('path');
const REPO = process.env.RUN_ALL_WT;
const base = require(path.join(REPO, 'playwright.config.js'));
const abs = (p) => (p && !path.isAbsolute(p) ? path.join(REPO, p) : p);
module.exports = { ...base, testDir: abs(base.testDir), outputDir: path.join(REPO, 'test-results'),
  projects: base.projects.map((p) => ({ ...p, testDir: abs(p.testDir), use: { ...p.use, launchOptions: { ...((p.use || {}).launchOptions), executablePath: process.env.PW_EXECUTABLE } } })),
  webServer: { ...base.webServer, cwd: REPO } };
JS
  PW_CONFIG="-c $TMP/pw-wrap.config.js"; export RUN_ALL_WT="$WT"
fi
PORT=${PORT:-$((4300 + RANDOM % 500))}; export PORT

ROWS=(); FAIL=0
run() { # name, command...
  local name=$1; shift; local t0=$SECONDS out="$TMP/$(echo "$name" | tr -c 'A-Za-z0-9' '_').log"
  if "$@" >"$out" 2>&1; then ROWS+=("PASS|$name|$((SECONDS - t0))s|$(grep -Eo '^Ran [0-9]+ tests|^# pass [0-9]+|[0-9]+ passed|CLEAN.*|[0-9]+/[0-9]+ control cases passed|[0-9]+ findings, [0-9]+ known, [0-9]+ new|^[^ ]*selftest.*' "$out" | tail -1 | cut -c1-70)")
  else FAIL=1; ROWS+=("FAIL|$name|$((SECONDS - t0))s|see $out"); KEEP=1; fi
}
KEEP=0

run "Privacy guard self-test"          python3 tools/privacy-guard/test_privacy_guard.py
run "Privacy guard $BASE..HEAD (DENY $DENY_NOTE)" python3 tools/privacy-guard/privacy_guard.py --range "$BASE..HEAD"
run "Gate checker control cases"      node tools/gate/gate.mjs --selftest
run "Gate checker tests"              node --test tests/gate/gate.test.mjs
if [ -f tools/lint/lint.mjs ]; then
  run "Lint control cases"            node tools/lint/lint.mjs --selftest
  run "Lint (new findings only)"      node tools/lint/lint.mjs
fi
if [ $QUICK = 0 ]; then
  run "Browser tests (mocked + phone)" env CI=true npx playwright test $PW_CONFIG --project=mocked --project=phone --reporter=dot
  if grep -q "name: 'contract'" playwright.config.js; then
    run "Contract tests"              env CI=true npx playwright test $PW_CONFIG --project=contract --reporter=dot
  else ROWS+=("SKIP|Contract tests|0s|no 'contract' project in playwright.config.js on this commit"); fi
else ROWS+=("SKIP|Browser tests (mocked + phone)|0s|--quick"); fi

echo
echo "run-all  commit $SHA  $(TZ=Europe/London date '+%d %b %Y %H:%M') UK"
printf '%-6s %-52s %-7s %s\n' RESULT CHECK TIME DETAIL
for r in "${ROWS[@]}"; do IFS='|' read -r a b c d <<<"$r"; printf '%-6s %-52s %-7s %s\n' "$a" "$b" "$c" "$d"; done
if [ $KEEP = 1 ]; then trap - EXIT; git -C "$REPO" worktree remove --force "$WT" >/dev/null 2>&1; echo "Logs kept in $TMP"; fi
[ $FAIL = 0 ] && echo "ALL GREEN" || echo "RED"
exit $FAIL
