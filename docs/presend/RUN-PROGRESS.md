# RUN-PROGRESS · Presend Checker Landing (JOB 23)

Resume from this file plus the newest AA_CJ-PRESEND-LANDING slip in 00 AI Commons > CHANGES. Counts only.

| Stage | Branch | PR | Tests | Guard | ACCEPT |
|---|---|---|---|---|---|
| 0 Read and report | none | none | n/a | n/a | PASS (10 files: 7 NEW, 2 CLEAN-APPLY, 1 CONFLICT) |
| 1 Checker tools | claude/presend-land-1-tools | #140 | 2 self-tests pass; guard unittest 34 pass | local range CLEAN; CI on the PR | PASS locally, CI pending |
| 2 Factory Send gate (stacked on 1) | claude/presend-land-2-factory | #143 | factory 56 pass; mocked 665 pass; phone 12 pass; 360 px: 4 views, no sideways scroll | local range CLEAN; CI on the PR | PASS locally, CI pending |
| 3 weeklyBackup review refresh (stacked on 2, for this file only) | claude/presend-land-3-review | #144 | docs only | local range CLEAN; CI on the PR | PASS: 26 Oct CONFIRMED nothing trimmed (8 to 11 of 24); next trim Mon 30 Nov 2026 |
| 4 Box run kit (stacked on 3) | claude/presend-land-4-runbook | #145 | invented flow: NOT READY case 3 FAIL no READY stamp; READY case stamp written; verify 0, after 1-char edit 1; empty data 5 NOT RUN blocks READY; selftests 0 silent with and without data | local range CLEAN; CI on the PR | PASS |
| 5 Hash the trimmed text (stacked on 4; default A) | claude/presend-land-5-hash-trimmed | #167 | selftest 0 silent (new control: end newlines ignored, inside edit caught); send gate specs 13 pass | local range CLEAN | PASS |
| 6 Engine stamp handler, ready to paste (stacked on 5; default A) | claude/presend-land-6-stamp-handler | #170 | stamp handler specs 14 pass | local range CLEAN | PASS (not deployed: Mac route) |
| 7 Full tests: every tools/presend path + every Send gate state (stacked on 6) | claude/presend-land-7-tests | #181 | Python 94 pass (all lines run except CLI blocks, run by subprocess); gate specs 18 new; full mocked 727 pass | local range CLEAN | PASS |
| 8 Copy takes the prompt doc, never the Prediction doc (stacked on 7; parked P1, recommended) | claude/presend-land-8-prompt-link | #184 | 2 new tests fail on old code, pass now; factory specs pass | local range CLEAN | PASS |

Parked: 2 (retire the old branch, Lisa only; build --to-outbox only after the stamp handler is deployed).
Overlap: 1 open PR (Studio Stage 6) also edits factory/index.html, other lines.
Main merged into stages 1-4 on 30 Oct (no rebase).
Resume check 30 Oct: 8 PRs open, stacked 140 > 143 > 144 > 145 > 167 > 170 > 181 > 184; CI green on each; each merges clean into today's main (31 commits newer), so main was not merged in again. None merged.
Next: nothing to build. Waiting on Lisa: merges in stack order, the old branch, the Mac-route deploy of the stamp handler.

Merge of main (31 Oct, JOB 23.3 merge-main): main 36c61aa merged into #143, #144, #145, #167, #170, #181 and #184 (merge commits, no rebase, no force-push). One conflict each, in factory/index.html (two adjacent CSS rule groups); both sides kept. Privacy guard CLEAN on all 7. `node --test` on each: 150 pass, 1 fail.
Open (not caused by the merge): `node --test` also lists tests/support/test.js, a Playwright helper, not a test. It fails at line 6 with "Cannot find module '@playwright/test'" (dependencies not installed in the box). Main fails it identically (150 pass, 1 fail). Fix is outside this job: exclude tests/support from the node --test glob, or run `npm ci` first. #140 untouched.
