# Handover: PR session retired 13 Nov 2026

Retired after two context compactions. No merges done in this stretch. Nothing force-pushed, deleted or sent.

## Open PRs this session owns (all left open, no merge)
1. #326 Actions minutes: card now waits on an old collector (engine below 0.2) instead of showing a false red. Live collector swap to v0.2 is NOT done (needs Lisa, Chrome steps are in Drive CHANGES).
2. #356 Test-tools bump (Playwright, axe): fixes every `label-content-name-mismatch` finding across all hubs (not only Studio). Old checker NOT pinned. See "How #356 was fixed".
3. #346 Compliance display on the new history page: NOT started. Successor job text is in `docs/handover/SUCCESSOR-346.md` (same folder).

## How #356 was fixed (so nobody re-derives it)
- axe 4.14 joins adjacent spans with no space ("3Stuck"), then checks the accessible name contains that text in order.
- Fix = (a) a real space text node between the visible spans (flex parents ignore it, so no look change), (b) aria-labels that start with the visible words, then add context after.
- Shared builders in `toolkit.js` (`tabHtml`, `nameTabs`, `hubMain` number cards) plus per-hub static markup and a few per-hub labels.
- Tests that pinned old formats were updated: `tests/mocked/tab-dots.spec.js`, `tests/mocked/house-rose-broken.spec.js` (and any other the full run flagged).
- `factory:all` empty table header stays a KNOWN item (unrelated, already listed).

## Needs Lisa (do not do these)
1. Merge go-ahead for open PRs (#482, #473, #326, #356 and others).
2. #326 live collector swap to v0.2.
3. #378 (layout redesign) and #377 (conflicts in 25 files, needs its own agent).
4. Loading #442 and #447 into the live Apps Script.
5. Org chart Q1 (function or brand units), Q2 (Studio scope), Q3 (Sales separate).
6. #454 (adds a column to a live sheet).

## Rules in force
- Public repo: privacy-scan every diff (`PRIVACY_DENYLIST=<local term> python3 tools/privacy-guard/privacy_guard.py --staged` and `--range origin/main..HEAD`). Never write ids, emails, client names or licence numbers.
- Never force-push, never delete branches or files. Merge commits only. Do not break anything.
- House look: tokens only, 1px inside focus, no fills, nothing moves on hover or focus.
- Page-size growth goes in `tests/budget-growth/<name>.json`, never by editing the base budgets.
- Every `@regression` test title needs a row in the "Caught after merge" table in `TESTS.md`.
- Lisa reads on a phone: short numbered lines, one decision at a time, mark anything unverified as UNVERIFIED.

## Local test recipe
- `npm ci --ignore-scripts` in a scratch worktree; wrapper config sets `launchOptions.executablePath` to the pre-installed Chromium plus `--no-sandbox`; run with `PORT=<n>`.
- Projects: `mocked` and `phone`. CI Browser tests take about 20 minutes.
- Local Factory page-size budget fails on plain main in the sandbox but passes in CI (environment only).
