# HANDOVER: JOB BB-FIN.1 -> successor "JOB BB-FIN.1 2"

Rewritten at the split (12 Nov 2026, about 20:50 UK). Context split mark reached; no big stage started after it.

## Open PRs (none merged by this job; Lisa merges)
- dashboard #491 branch claude/youthful-gates-6b4jct: calculator fixes, property tests, mutation tool, spec runs every test file.
- dashboard #492 branch claude/bb-fin-inspector: inspector tests S10.1-S10.6 on.
- dashboard #493 branch claude/bb-fin-contract: schema contract test (runs in CI once #491 merges).
- breed-better #1 branch claude/bb-fin-1: contract report + go-live kit (files only).

## Next (see CONTINUE_PROMPT.md)
Seven small Breed Better page/test fixes from the gap audit, one PR per theme, line edits only.

## How to run the checks
`node --test tests/breed-better/*.test.js` · `node tools/bb-mutate/run.mjs` ·
`npx playwright test --project=mocked breed-better bb-inspect` (cloud session: point launchOptions.executablePath at /opt/pw-browsers/chromium
via a local, uncommitted wrapper config) · `bash tools/ci-local/run-all.sh --quick`.
