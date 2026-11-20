# JOB CDH-HT.1 CD Hub human click test and fix 2 · continue prompt

Paste this as the first message of a new Code session on `ljoyrose/dashboard`. Written 17 Nov 2026 by the first session.

## Goal

The hub click-crawl and the hover test run steady on the hub as it is today, on desktop and on a 360px phone, with the two `test.fixme` lines removed, and the click map remade.

## Read first

1. `docs/cdhub/HANDOVER.md` (what is switched off and what is known).
2. `docs/cdhub/RUN-PROGRESS.md` (what was found and fixed).
3. `tests/support/click-crawl.js` (the crawler) and `tests/mocked/cdhub-crawl.spec.js` (how the hub is walked).

## Rules that carry over

1. This repo is public: code only, invented data only. Run `tools/privacy-guard` over the staged diff before every commit and over `origin/main..HEAD` at the end.
2. Work on a branch off `main`. Merge `main` in; never rebase a pushed branch, never force-push, never merge a PR yourself.
3. Line edits only. Do not touch other sessions' PRs.
4. A fix that needs a save-script change, or that would un-hide a switched-off screen, is not yours: write it up as a decision for Lisa.

## Stages

1. S0: merge `origin/main`; run `CRAWL_HUB=1 CRAWL_ROOTS=work CRAWL_LOG=<file> … cdhub-crawl --workers=1`; read the `LOST` and `WAIT` lines.
2. S1: make a one-tap-deep screen with its own address open by address, not by replaying taps. Cap every wait in `crawl()`.
3. S2: run each start screen alone, then both halves, desktop then phone. One Playwright job at a time.
4. S3: find why the hover test runs past four minutes (time each screen, one worker).
5. S4: fix whatever the walk now finds on the new screens (Staff, Items, Enquiries, Admin), one small PR per area, each with its own test.
6. S5: take off both `fixme` lines; `node tools/cdhub-click-map/make.js`; rewrite `HANDOVER.md` and `RUN-PROGRESS.md`.

## Done test

1. Hub walk: at least 95% of reachable controls on desktop and on phone, the number printed, LOOP 0 · DEAD 0 · ERROR 0 · ESCAPE 0 · WORDING 0, three runs in a row.
2. Hover test green.
3. No `fixme` left in `cdhub-crawl.spec.js` or `cdhub-hover.spec.js`.
4. The CI "Browser tests" job green on the head commit, and how long the crawl adds to it written down.
