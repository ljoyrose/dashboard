# JOB CDH-HT.1 · CD Hub human click test and fix · run progress

Rewritten after each stage (not appended). Last rewrite: 17 Nov 2026.

## Where things are

| Stage | State | Proof |
|---|---|---|
| S0 Read | done | repo map below |
| S1 Crawler | built; **hub walk switched off on today's hub** | `tests/mocked/cdhub-crawl.spec.js`, engine `tests/support/click-crawl.js`. 13 Nov: hub 884 of 884 controls on desktop and on a 360px phone, 0 findings. 17 Nov: Temperatures and staff walks pass; the hub walk cannot finish (see `HANDOVER.md`) |
| S2 The Round | done | `tests/mocked/cdhub-round.spec.js`, 19 tests, save OK / out of reach / refused; passes on today's hub |
| S3 Fix | done for what was found by 13 Nov | PRs 512, 515, 516 merged; 506 (medicine) open |
| S4 Style | built; **switched off on today's hub** | `tests/mocked/cdhub-hover.spec.js`. 13 Nov: 67 kinds of control, 0 problems, 1 parked for Lisa. 17 Nov: runs past its time, cause not found |
| S5 Click map | done on 13 Nov, not remade since | `docs/cdhub/CLICK-MAP.md`, written by `tools/cdhub-click-map/make.js` |
| S6 Full suite | not green | PR 641: the two switched-off tests are the gap. A successor is needed: `docs/cdhub/CONTINUE_PROMPT.md` |

## Repo map (CD Hub only)

- `cdhub/index.html` the hub: one page, screens are `#/map` Main, `#/work` Do, `#/today`, `#/dogs`, `#/sops`, and under More `#/compliance`, `#/round`, `#/areas`, `#/breed` (owner only), plus the newer `#/staff`, `#/items`, `#/enquiries` and Admin, and `#/shape`, `#/litters`, `#/buyers`, `#/vet` which are switched off (their addresses open Main). `go(id)` draws a screen; `PAGES` is the wired list.
- `cdhub/history.html` the Temperatures page (The round, Heat map, year chips, day panel).
- `cdhub/staff/` the staff page ("The Board"): `shell.js`, `modules/temperature/module.js` (the temperature round), `modules/moves.js` (scan and move), `modules/where.js`, `modules/jobs/module.js`. It reads and saves through the save script only.
- Shared: `toolkit.js` (tabs, folds, search, Main), `house.css`, `tokens.css`.
- Tests: `tests/mocked/*.spec.js` (pretend Google and Drive), `tests/phone/`, `tests/support/` (pretend Drive, sign-in stand-in), `tools/ci-local/run-all.sh`, `tools/lint`, `tools/privacy-guard`, `tests/support/budgets.js` + `tests/budget-growth/*.json` (page-size rule: one new file per PR).

## What was found and fixed

1. February medicine loop (Lisa's report): with two or more dogs in the medicine list nothing opened and the rows could not be tapped. PR 506 (open).
2. Sensor CSV on the staff temperature round threw an error and stopped at its title. PR 512 (merged).
3. Temperatures heat map: later days and no-reading days were buttons that did nothing. PR 515 (merged).
4. (i) marks showed nothing when tapped; Clear filters did nothing with no filter set; headings stopped folding after Skip to content; Compliance and The round scrolled sideways at 360px; a raw column name in a message; two controls with no hover fill; buttons to switched-off screens. PR 516 (merged).
5. Scan and move: the lit flap button did not follow a save that landed. In the crawler PR 641 (found by The Round spec).
6. Items screen: the empty message named two raw table names. Main has since reworded it; nothing left to do.

## Not done here (each is a row in the slip)

- The hub walk and the hover test on today's hub: switched off with a dated reason, for the successor.
- The new screens (Staff, Items, Enquiries, Admin) have not had a full walk.
- The shared `[tabindex]` rule in `toolkit.js` that made item 4's heading bug possible is still there (fixed at the hub's end only).
- Main's Next card has no hover fill (shared `house.css`, every hub): parked for Lisa.
- Filled-in save forms on the dog card (Add medication, Add weight, Save details) are only pressed empty by the crawl.
- A live check with Lisa's own sign-in: not possible from here; a 6-step phone test is in the slip.
