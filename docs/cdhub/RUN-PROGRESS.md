# JOB CDH-HT.1 · CD Hub human click test and fix · run progress

Rewritten after each stage (not appended). Last rewrite: 20 Nov 2026 (second session).

## Where things are

| Stage | State | Proof |
|---|---|---|
| S0 Reproduce | done | full desktop walk froze for 14 minutes on a screen reached one tap in |
| S1 Open by address, cap waits | done | `tests/support/click-crawl.js` |
| S2 One walk per start screen, both sizes | done | `tests/mocked/cdhub-crawl.spec.js`, 11 start screens today |
| S3 Hover test | done | stall found and fixed; about 25 seconds; no `test.fixme` |
| S4 Fix what the walk finds | done | PRs 718, 725, 726, each with a test that fails without the fix; all merged |
| S5 Three runs in a row, click map, notes | done | below |

## The done test

| What | Result |
|---|---|
| Hub walk, desktop 1280px | 1,354 of 1,361 controls (99.5%) on 39 screens · LOOP 0 · DEAD 0 · ERROR 0 · ESCAPE 0 · WORDING 0 |
| Hub walk, phone 360px | 1,354 of 1,361 controls (99.5%) on 39 screens · LOOP 0 · DEAD 0 · ERROR 0 · ESCAPE 0 · WORDING 0 |
| Temperatures page | 52 of 52, desktop and phone, 0 findings (102 repeated calendar days sampled) |
| Staff page | 102 of 104 (98.1%), desktop and phone, 0 findings |
| Hover | 69 to 71 kinds of control on 11 screens, 0 problems |
| Three runs in a row | 20 Nov 2026, one worker, Cloudflare layout: 29 passed each time (29.2, 29.0 and 27.3 minutes), 0 findings |
| `test.fixme` in the crawl and hover specs | none |
| Click map | remade 20 Nov from the third run: `docs/cdhub/CLICK-MAP.md` |

Every start screen on its own was between 98.4% and 100%. The 7 controls not reached are on Main.

## Time in CI

"Browser tests" on main alone: about 23 minutes. With the hub walk and hover test on: about 38 minutes (2,414 tests). The walk adds about 15 minutes to every run. Whether to move the hub walk to a nightly run is Lisa's decision (it needs a workflow change).

## What was found and fixed this session

1. Compliance: the "choose a rule" list had no grey fill on hover. PR 718.
2. Sign out pressed while the hub was still reading left an error card ("Sign in again") or a blank page: the unfinished read carried on. PR 725.
3. The round on a 360px phone scrolled sideways: the "add a dog" list grew as wide as its longest name. Seen in CI only (wider fallback font). PR 726.

Earlier findings (first session) are in the first session's slip and in PRs 506, 512, 515, 516 and 641.

## Not done here

- Enquiries and Admin are not walked (not offered as start screens for the invented data set).
- Breed Better's own hover look on the dog card: left as is, for Lisa.
- Main's Next card has no hover fill (shared `house.css`): still parked for Lisa from the first session.
- A live check with Lisa's own sign-in: not possible from a cloud session.
