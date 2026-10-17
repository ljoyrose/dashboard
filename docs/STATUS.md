# STATUS: dashboard tests (one place for the current facts)

*Newest facts only. Every job updates THIS file instead of leaving "still off / still open" lines in old slips. Last checked: 17 Oct 2026, 00:55 UK.*

| Thing | State | How it was checked |
|---|---|---|
| Suite | 201 checks must pass, 0 skipped | `CI=true npx playwright test --project=mocked --project=phone` |
| Branch protection on `main` | ON: pull request + check "Browser tests (pretend Google and Drive)" + admins included + no force-push | GitHub `GET /branches/main` (also re-checked every Monday by "Protection watch") |
| Live site matches repo | Yes, byte for byte (4 files) | curl + sha256, 16 Oct; now a weekly and post-deploy test |
| Live check after deploy | Ran and passed after the last two publishes, including the 4-file byte match (14:19Z run: 7 passed) | Actions run log |
| Weekly teeth check | Not run on GitHub yet (first scheduled run Tue 20 Oct) | Press "Teeth check (weekly)" > Run workflow to run it now |
| Alarm (GitHub Issue on red) | **DEAD: GitHub Issues are switched OFF on the repo** (`has_issues: false`). Raising an Issue fails silently (seen in the live-check run log). Lisa: Settings > General > Features > Issues | `gh api repos/ljoyrose/dashboard --jq .has_issues`; protection watch now fails while off |
| PC-Personal and `RR_` | Decided 15 Oct: keep renaming matches (shared is the home). A test pins it | PR #15 |
| Dependabot | #13 (test tools) and #14 (actions) MERGED by ljoyrose on 16 Oct (14:05Z, 14:18Z); main stayed green. Playwright is now 1.64.0, axe 4.13.0, actions at v7/v6 | PR list, run history |
| Pages publishing | **Gate built, not switched on.** `Publish site (after tests)` waits for the tests, then publishes only index.html, cdhub/, money/. Needs Lisa's one click: Settings > Pages > Source = GitHub Actions, then run the workflow once. Until then Pages still publishes straight from the branch (ungated) | `pages.yml`; the Monday watch prints the Pages build type |
| Page problems known | Colour contrast, 10.5 px text on CD Hub, heading order (ratchet stops them getting worse) | `look-and-access.spec.js` |

## Open handoffs (grep-able)
Open lines start `BOT:`; when done, change to `BOT-DONE:` and add the date. Find them all: `grep -rn "^BOT:" docs/`

BOT: AFTER Lisa turns Issues on: press "Alarm fire drill" and "Teeth check (weekly)" (Actions > Run workflow), confirm both green, then mark these lines BOT-DONE. Success: both runs green; fire drill leaves 0 open issues.
BOT: AFTER Lisa's Pages click: press "Publish site (after tests)" (Actions > Run workflow) once; success = run green, publish job ran, `curl` of the 4 live files matches the repo; then confirm the next merge publishes only after the gate. Rollback: Settings > Pages > Source = Deploy from a branch > main > /.
BOT: RULES & SYSTEM merges the 5 register rows in AA_AUTOMATIONS_2026-10-17-0058_01.md (RR_OUTBOX_APPFACT 1L3HiTGMjKRrewf3RJX6RSJSAbtiuYJrY) into RR_AUTOMATIONS-REGISTER; success = rows present, Pages row status updated after Lisa's click.
