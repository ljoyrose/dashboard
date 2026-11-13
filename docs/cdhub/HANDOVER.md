# JOB CDH-HT.1 · handover

For whoever picks this up next. Rewritten after each stage. Last rewrite: 13 Nov 2026.

## In one line

The crawl kit is built and green; five PRs are open for Lisa's merge card; nothing is merged, nothing live was touched.

## Open PRs (none merged by this job; all on `ljoyrose/dashboard`, base `main`)

| PR | Branch | What |
|---|---|---|
| 506 | `claude/cdhub-ht-medicine` | a row in the medicine list opens that dog's medicines (February click loop) |
| 512 | `claude/cdhub-ht-round` | staff page: Sensor CSV opens again |
| 515 | `claude/cdhub-ht-history` | Temperatures heat map: a day with nothing to open is not a dead button |
| 516 | `claude/cdhub-ht-nav` | small controls answer a tap; 360px; switched-off screens not offered |
| see slip | `claude/epic-meitner-aekgul` | the crawl kit: fixtures, crawler, The Round spec, hover test, click map, and the flap-button fix. It **contains** the four fix branches, so it can be merged alone, or after them |

The four fix branches merge with each other in any order (checked pair by pair). Each hub fix carries its own `tests/budget-growth/*.json` file: the hub was 106 bytes under its page-size budget on main.

## How to run things

```bash
npx playwright test --project=mocked cdhub-crawl cdhub-round.spec cdhub-hover cdhub-taps
```

```bash
node tools/cdhub-click-map/make.js
```

```bash
node tests/fixtures/cdhub-27/make.js --check
```

In a cloud session the pinned Playwright browser is not installed: use a wrapper config that sets `launchOptions.executablePath` to `/opt/pw-browsers/chromium` (the same trick `tools/ci-local/run-all.sh` uses).

Working on the crawler itself: `CRAWL_LOG=<file>` writes one line per tap; `CRAWL_ROOTS=dogs,today` keeps only those start screens; `CRAWL_MAX=<n>` stops after n taps.

## Things that will bite

1. Other sessions merge CD Hub changes all day. Merge `origin/main` into the branch (never rebase a pushed branch), rerun the crawl, then remake the click map.
2. A new control that does nothing, a new raw word, or a new sideways scroll at 360px turns the crawl red on whoever's PR adds it. The line it prints names the screen and the control.
3. When PR 472 lands, nothing here needs changing: the hidden screens are never walked, and their old addresses are then checked to open Main.
4. If a hub PR fails "load within 10%", add one file under `tests/budget-growth/` (see `tests/support/budgets.js`); never edit the base number.
5. The fixture set's "today" is 10 Mar 2026 (`tests/support/cdhub27.js`). Tests pin the clock to it.

## Next steps, in order

1. Lisa's merge card: the five PRs.
2. After merges: merge main into any PR still open, rerun, remake the click map if the hub changed.
3. The open rows in the slip (LIVE-CSV rows).
