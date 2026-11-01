# JOB 34 coverage (hub x check)

Counts only. No private values. Built 30 Oct 2026 by JOB 34.2 from the JOB 34, 34b and 34c specs as pushed.
Run them all with `npm run test:job34` (the mocked project, every `tests/mocked/job34*.spec.js` file).

Every JOB 34 test uses the shared `guard` fixture (tests/support/test.js), which fails the test on any
uncaught page error, unexpected console error or warning, or unmocked outside call. So "Console" is covered
for every hub that has any JOB 34 test.

Key: a spec name means COVERED there. `Fnn` = a real page bug found, test kept as `test.fixme` (FIX-REQUEST
for the hub owner). "existing" = an older spec already proved it, so JOB 34 did not repeat it.

| Hub | Views and clicks | Empty | Error | Signed out | Slow 3 s | Phone 390 | Keyboard | Console |
|---|---|---|---|---|---|---|---|---|
| Home | home-views | states-empty | states-sheet-error | states-signed-out | states-slow | home-views, states-phone | home-views, states-keyboard | guard |
| Money | money-views, 34b money-gaps | 34b money-gaps, states-empty | states-sheet-error, J34-F80 | states-signed-out, 34b money-gaps | states-slow | 34b money-gaps, J34b-F20 | money-views, 34b money-gaps, J34-F85 | guard |
| CD Hub | cdhub-views, J34-F20 | states-empty | states-sheet-error | states-signed-out | states-slow | cdhub-views | cdhub-views, states-keyboard | guard |
| Factory | factory-flows | states-empty | states-sheet-error | states-signed-out | J34-F83 | factory-flows, states-phone | factory-flows, states-keyboard | guard |
| Studio | studio-flows | states-empty | states-sheet-error | states-signed-out | J34-F84 | studio-flows, states-phone | studio-flows, states-keyboard | guard |
| Food | food-states | food-states, J34-F62 | food-states, J34-F60 | states-signed-out | J34-F61 = J34-F81 | existing (phone/phone.spec.js) | food-states, states-keyboard | guard |
| Marketplace | marketplace-states, 34b marketplace-clicks, J34b-F40, J34b-F42 | 34b marketplace-states | 34b marketplace-states, states-sheet-error | states-signed-out | J34-F70 = J34-F82 | marketplace-states, 34b phone-keys | 34b phone-keys, J34b-F41 | guard |
| Bin | bin-index, J34-F01 | existing (bin-guard, bin-safety) | bin-index | signin-flow | not applicable (no data read before a click) | existing (phone/phone.spec.js) | existing (focus-and-headings.spec.js) | guard |
| Drives and structure | drives-pages | drives-pages | drives-pages | signin-flow | not applicable | existing (phone/phone.spec.js) | existing (focus-and-headings.spec.js) | guard |
| Cross-page (34c) | 34c navigation, J34c-F01, J34c-F02 | | | 34c navigation (deep link survives sign-in) | | | 34c navigation | guard |

## Counts

| Item | Count |
|---|---|
| JOB 34 spec files (34 + 34b + 34c) | 22 |
| Tests listed | 213 |
| Passed in session | 195 |
| `test.fixme` (findings) | 18 |
| Distinct finding ids | 18 (J34-F01 F20 F60 F61 F62 F70 F80-F85, J34b-F20 F40 F41 F42, J34c-F01 F02) |
| Same bug, two ids | 2 pairs (F61 = F81 Food loading, F70 = F82 Marketplace loading) |

Specs by file: bin-index 5, cdhub-views 14, drives-pages 7, factory-flows 14, fixtures-invented 2,
food-states 17, home-views 9, marketplace-states 15, money-views 11, signin-flow 7, states-empty 7,
states-keyboard 8, states-phone 3, states-sheet-error 8, states-signed-out 7, states-slow 11, studio-flows 9,
34b marketplace-clicks 10, 34b marketplace-phone-keys 7, 34b marketplace-states 7, 34b money-gaps 22,
34c navigation 13.

## How this was run

All JOB 34 branches (job34-1 to job34-6, job34b-2, job34c-1) merged in a throwaway local copy outside the repo,
then `npx playwright test --project=mocked job34` with a wrapper config pointing at /opt/pw-browsers/chromium.
