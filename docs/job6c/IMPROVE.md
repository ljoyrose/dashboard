# IMPROVE: ranked list (Job 6 + 6b + the RR_ decision, as one system)

*Reviewed 16 Oct 2026 (UK). Everything marked checked was checked against GitHub or the live site this session. Anything not checked says UNVERIFIED.*
*Owner tags: **DO NOW** (in this PR) · **BOT CAN DO** (AF6, handoff line given) · **SCHEDULE** (later job, with agent and trigger).*
*Credits: this review used none. `credits_estimated 0 · credits_actual 0 · credits_variance 0`.*

## The ranked list

### 1. A bad merge still goes live; the tests only tell you afterwards
1. **WHAT:** GitHub Pages publishes whatever lands on `main` without waiting for the tests.
2. **WHY:** Branch protection stops a *red* branch being merged, but the check only covers the branch as it was. If a merge changes the result (two branches that are each fine but break together), the broken page is live within minutes and the red tick arrives after. Checked: the last two publishes (`pages build and deployment`) ran in parallel with `Dashboard tests`, not after.
3. **OWNER:** SCHEDULE
6. **SCHEDULE:** Claude Code, new job "6d gate the publish", triggered by Lisa saying `gate pages on tests`. Why not now: it is a Settings change (Pages source to "GitHub Actions") plus a new deploy workflow, and the brief says do not change Settings. Until then items 2 and 3 below catch a bad publish in about 90 seconds.
7. UNVERIFIED: the Pages source setting itself (the Pages settings API is blocked for this session). The run name `pages build and deployment` (dynamic) says "build from branch".

### 2. Prove that what is live is exactly what was merged
1. **WHAT:** the live check now compares the four live files (`index.html`, `cdhub/index.html`, `money/index.html`, `money/core.js`) byte for byte with the merged files.
2. **WHY:** the old live check only looked for a title and a button, so it would pass on an old, stale or wrong version. Checked just now: all four live files equal the repo files (same sha256).
3. **OWNER:** DO NOW
4. **Files:** `tests/live/live-smoke.spec.js` (new `Live files match the repo` tests, off unless `LIVE_MATCH_REPO=1`), `.github/workflows/live-after-deploy.yml` and `tests.yml` (turn it on only on `main`). Waits up to 90 s for Pages. Proved locally: 7 live checks passed against the real site.

### 3. The alarm has never been tested on GitHub
1. **WHAT:** the "open one Issue when red" path was only ever dry-run.
2. **WHY:** if the built-in token, the label step or the email route fails, the first real red would be silent, which is the exact situation the alarm exists for.
3. **OWNER:** DO NOW (the test) + BOT CAN DO (press it)
4. **Files:** new `.github/workflows/issue-fire-drill.yml` (manual only): opens a clearly-labelled TEST issue, reuses it on a second red, checks exactly one is open, closes it, checks none is left. Only runs from `main`, so it exists after merge.
5. **BOT handoff:** see `TT_JOB6C_SLIP_01.md`, BOT-1. Success: the run is green and `gh issue list --label fire-drill --state open` is empty. Ask Lisa: did about 3 emails headed FIRE DRILL reach lisacarson@me.com? That proves delivery, not only creation.
7. UNVERIFIED: that GitHub emails the address Lisa reads (it uses the GitHub account's notification settings, not necessarily lisacarson@me.com).

### 4. Branch protection could be switched off, or the check renamed, and nobody would know
1. **WHAT:** a weekly "protection watch" reads the rule from GitHub and opens one Issue if protection is off, no longer requires the test check, lets admins bypass, or the required job name no longer exists in `tests.yml`.
2. **WHY:** protection is a setting, not code, so no test can see it go. A renamed job would also freeze every merge on "waiting for status". Checked: a normal read token returns the rule details (`GET /branches/main`), so no admin key is needed.
3. **OWNER:** DO NOW + BOT CAN DO (first run)
4. **Files:** `tests/support/check-protection.js`, `.github/workflows/protection-watch.yml` (Mondays 07:05 UTC + manual), 3 checks in `tests/mocked/ci-guards.spec.js`. Proved locally against the real repo: passes.
5. **BOT handoff:** BOT-1 (same run list). Success: "Protection watch" run is green.
7. UNVERIFIED: whether the *built-in workflow token* (as opposed to Lisa's) sees the rule details. If not, the script falls back to "protection is on" only and says so in the summary. The first run answers it.

### 5. Old documents keep saying things that stopped being true
1. **WHAT:** one short `docs/STATUS.md` holds the current facts (with how each was checked); old slips get a dated banner instead of being rewritten.
2. **WHY:** PR #15 still said protection was "still off" when it was on, and the 6b slip said "RR_ open" after it was decided. Cause: facts were remembered, not read. Fix: read the system before stating a fact about it (`gh api repos/ljoyrose/dashboard/branches/main --jq .protection`).
3. **OWNER:** DO NOW
4. **Files:** `docs/STATUS.md` (new), banners at the top of `docs/job6b/PROGRESS.md`, `CONTINUE_PROMPT.md`, `TT_JOB6B_SLIP.md`, `TESTS.md` ("Status: it is ON, checked 16 Oct").

### 6. The safety net checks itself (the learning loop made mechanical)
1. **WHAT:** 10 new checks in `tests/mocked/ci-guards.spec.js`.
2. **WHY:** prose rules decay. These fail the required check when: a test named in "Caught after merge" no longer exists; an `@regression` test is missing from that table; the PR checklist line or the fix-without-test warning disappears; a parked test (`test.fixme`) has no DECISION NEEDED / OWNER / BY date; a teeth break no longer matches the page; the required job is renamed; the alarm message loses its plain "What to do" line; any workflow uses a stored secret.
3. **OWNER:** DO NOW. Proved: renaming the `@regression` test made 2 of them fail, then restored.
4. **Also:** the Action summary now warns (never fails) if the total in `TESTS.md` is out of date.

### 7. The teeth check finds real gaps, but has never run on GitHub
1. **WHAT:** keep the weekly teeth check, make sure each new deletion-safety rule gets one deliberate break, and run it once now instead of waiting for Tuesday.
2. **WHY:** its first run found two rules protecting `RR_` archives with no test at all. Now the list is checked on every push (item 6) so it cannot rot for a week.
3. **OWNER:** BOT CAN DO. Handoff BOT-1. Success: "Teeth check (weekly)" green, summary table shows 8/8 caught.

### 8. Do the real-column check once, without moving real data
1. **WHAT:** run `tests/contract/check-real-headers.js` on the real Money and BLD file headers.
2. **WHY:** the expected-column list comes from invented samples, so it proves the pages and samples agree, not that Drive does.
3. **OWNER:** BOT CAN DO. Handoff BOT-2: read only the first 8 KB of each file (Drive `Range: bytes=0-8191`), so only the header and the "CURRENT" count line ever leave Drive; never download whole Money files. Success: every file prints `ok`, or names the exact column; no values pasted anywhere; the temp folder deleted.

### 9. Two Dependabot PRs are open and green
1. **WHAT:** #13 (test tools: `@axe-core/playwright` 4.10.2 to 4.13.0 and `@playwright/test`) and #14 (4 actions). Both passed the required check.
2. **WHY:** weekly clicking is Lisa effort for little risk; leaving them grows the gap.
3. **OWNER:** decision for Lisa (question Q2 in the slip); recommended: AF6 reads each PR's notes in two lines, Lisa replies `merge 13 14`.

### 10. Page problems the checks have now written down
1. **WHAT:** colour contrast (main dashboard 7 places, CD Hub up to 8), 10.5 px text on the CD Hub, heading order.
2. **WHY:** a ratchet stops them getting worse; it does not fix them. The 10.5 px text may break Lisa's own readable-text rules, in which case it is a rule breach, not polish.
3. **OWNER:** SCHEDULE: Claude Code, "page polish" job, Lisa's go (`start a11y job`). Not now: page changes, and AF6's recommendation (not now) is right while the ratchet holds. UNVERIFIED: the exact font floor in Lisa's look rules (not read this session).

### 11. A file went into the forbidden Drive folder
1. **WHAT:** the 6b brief named folder `1tsjx6AZ…` as the slip destination. It is titled **"Claude artefacts"**. `TT_JOB6B_SLIP.md` (file id `1VOgslTB2oGwD78YZ6IhnOL1_R7Z21n8X`) was uploaded there in Job 6b.
2. **WHY:** it is the folder this job's brief forbids. Cause: the 6b upload trusted the id and never read the folder's title. Mechanical fix: before any Drive write, read the parent's title and refuse if it is "Claude artefacts" (the protocol already asks for read-back of `parentId`, N-20).
3. **OWNER:** BOT CAN DO (Claude moved nothing: moving or renaming is outside this job). Handoff BOT-3.

### 12. Fewer artefacts, fewer turns
1. **WHAT:** stop making a zip each job; end each job with a 6-line status plus the PR link.
2. **WHY:** every file in the zip is already on GitHub, so the zip is a second copy to build, upload and verify. This job made none. Saves roughly 3 turns per job and one Drive upload.
3. **OWNER:** DO NOW (done here) + SCHEDULE in the job-prompt skill (item 13).

### 13. Put this environment's quirks into the job prompt
1. **WHAT:** tell Claude Code up front: (a) call `add_repo` with push access before using `gh`; (b) GitHub GraphQL is blocked, so `gh pr create` fails, use `gh api` on the REST routes; (c) Settings and rulesets writes are refused (403): Lisa clicks, Claude reads back with `gh api .../branches/main`; (d) `.gitignore` hides `*.json` and `*.csv`, new ones need an allow-line (this lost `branch-protection.json` once); (e) the Drive connector cannot overwrite a file; (f) never trust a folder id, read its title first.
2. **WHY:** each of these cost a turn or a rework this session.
3. **OWNER:** SCHEDULE: AF3 (`claude-code-job-prompt` skill), next time the skill is edited. Also add: "name who may click Settings, and what read-back command proves it".

### 14. Alert emails first line says what to do
1. **WHAT:** the Issue body now opens with a plain "What to do" line (open the run, send to your builder, urgent only for the Money Hub or the Bin).
2. **WHY:** a red tick means nothing to a non-technical reader at 7 a.m.
3. **OWNER:** DO NOW. File: `tests/support/report-issue.js`, checked by a test.

## Learning-loop points that should be mechanical (status)
| Point | Now |
|---|---|
| Bug fix needs a regression test | PR checklist line (checked by a test) + warning workflow (checked by a test) |
| Regression tests are listed and real | Mechanical: `ci-guards` both directions |
| Parked tests have a question, an owner and a date | Mechanical: `ci-guards` |
| The teeth list matches the pages | Mechanical: `ci-guards`, every push |
| Docs quote the right test total | Mechanical warning in the Action summary |
| Settings (protection) still on | Mechanical: Monday watch |
| Alarm works | Manual once: fire drill (then re-press after any alarm change) |
| A new deletion-safety rule gets a teeth entry | Not mechanical yet. Rule in `HANDOVER.md`; promote to a test when a second rule is added |
| Process lessons from slips become rule rows | Not mechanical: AF6 writes them to `LEARNINGS.csv` (BOT) |

## What I could NOT check
- Pages source setting, and whether Pages is gated: API blocked.
- Whether the built-in token can read the protection details; the first watch run shows it.
- Whether Issue emails reach lisacarson@me.com.
- Real Drive column names; teeth and fire-drill on GitHub (they only run from `main`).
- Lisa's exact readable-text rules; the multitenant skill (`RR_SKILL_overskill-multitenant-security.md`); the `links-tests` plan.

## Job 6c stubs from `docs/job6b/PROGRESS.md`
| Stub | Decision | Why |
|---|---|---|
| Real-Drive header fetch in CI | **DROP** | Needs a stored Google credential. The local ranged read (item 8) gives the answer with no secret. Reopen only if Lisa wants it unattended. |
| Pull-request trigger for fork PRs | **DROP** | Solo repo; Dependabot uses same-repo branches. Revisit if a collaborator is ever invited. |
| Fix contrast and small text, then lower the ratchet numbers | **PROMOTE** to item 10 | Real, but page changes and Lisa's go. |

## Anything needing `qssend` or Overskill credits
None. This repo is hand-built static pages on GitHub Pages, not an Overskill app, so no paid prompt exists here and no estimate applies. Go word if one is ever needed: **qssend** (STANDARD S6, section S6.2, and Shorthand-Command-System.md). `GO` is not the go word.
