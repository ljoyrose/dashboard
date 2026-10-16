# STATUS: dashboard tests (one place for the current facts)

*Newest facts only. Every job updates THIS file instead of leaving "still off / still open" lines in old slips. Last checked: 16 Oct 2026 (UK).*

| Thing | State | How it was checked |
|---|---|---|
| Suite | 193 checks must pass, 0 skipped | `CI=true npx playwright test --project=mocked --project=phone` |
| Branch protection on `main` | ON: pull request + check "Browser tests (pretend Google and Drive)" + admins included + no force-push | GitHub `GET /branches/main` (also re-checked every Monday by "Protection watch") |
| Live site matches repo | Yes, byte for byte (4 files) | curl + sha256, 16 Oct; now a weekly and post-deploy test |
| Live check after deploy | Ran and passed after the last two publishes | Actions run history |
| Weekly teeth check | Not run on GitHub yet (first scheduled run Tue 20 Oct) | Press "Teeth check (weekly)" > Run workflow to run it now |
| Alarm (GitHub Issue on red) | Wired; never yet exercised for real | Press "Alarm fire drill" once |
| PC-Personal and `RR_` | Decided 15 Oct: keep renaming matches (shared is the home). A test pins it | PR #15 |
| Dependabot | 2 grouped PRs open (#13 tests tools, #14 actions), both green; never auto-merged | PR list |
| Page problems known | Colour contrast, 10.5 px text on CD Hub, heading order (ratchet stops them getting worse) | `look-and-access.spec.js` |

## Open handoffs (grep-able)
Open lines start `BOT:`; when done, change to `BOT-DONE:` and add the date. Find them all: `grep -rn "^BOT:" docs/`

BOT: press "Alarm fire drill" and "Teeth check (weekly)" (Actions > Run workflow), confirm both green, then mark these two lines BOT-DONE. Success: both runs green; fire drill leaves 0 open issues.
