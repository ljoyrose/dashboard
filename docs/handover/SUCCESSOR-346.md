# Successor job: #346 compliance display on the new history page

One PR. Left open, clean and green. No merge. The merge, #378 and the org-chart questions stay with Lisa.

## Goal
Rebuild the indoor compliance display (the intent of closed #304) on the rebuilt history page `cdhub/history.html`, as PR #346's replacement work.

## Do first
1. Read `docs/handover/HANDOVER.md` and `merge-policy.json`.
2. Check out `feat/indoor-compliance-display-v2` (PR #346). Merge `origin/main` into it (normal merge commit, no force-push, no rebase). Where `cdhub/history.html` conflicts, take main's version, then re-implement the display on it.
3. Read the new page's room model (`SPAN`, `FIRST_DAY`, `REQ`, `LINKS`, `THERMOS`, `roomLine`, `dayRooms`) before editing.

## Build
1. Red corner dot = data error (min greater than max).
2. Amber dot = out of range (default 15 to 25 C, or per-area `min_c` / `max_c`).
3. Outdoor / Compliance toggle above the legend, shown only when indoor data exists.
4. Compact drill table: Area, AM, PM, Status pill.

## House look
Tokens from `tokens.css` only (no raw colours), 1px inside focus (`--house-focus`), no fills, nothing moves on hover, focus or selected. Use `toolkit.js` `DashKit` helpers. Accessible names must start with the visible words (axe `label-content-name-mismatch`), and adjacent visible spans need a space between them.

## Checks before pushing
1. Add or update Playwright tests (projects `mocked` and `phone`); every `@regression` title needs its `TESTS.md` row.
2. `node tools/lint/lint.mjs`.
3. Privacy guard on every diff, `--staged` and `--range origin/main..HEAD` (dashboard is public: no ids, emails, client names or licence numbers).
4. Page-size growth only via `tests/budget-growth/<name>.json`.
5. Push with plain `git push` (never force). Commit trailers: the standard two-line Co-Authored-By and Claude-Session pair. No model name in commit or PR text.
6. Update PR #346's description. Leave it open and confirm CI is green. Report PR link and head SHA to Lisa in short numbered lines.

## Not yours
Merges, #378, #377, #454, the org-chart units question, live Apps Script or sheet changes.
