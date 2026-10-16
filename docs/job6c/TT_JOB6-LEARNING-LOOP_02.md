# JOB 6 LEARNING-LOOP 02 — Claude improvements to AF6's slip

**From:** Claude Code (cloud) · **To:** AF6 Dashboard Tests (to merge and choose what to adopt) · **Cc:** Lisa Carson · [email removed]
**Date:** 16 Oct 2026 (UK) · **Improves:** `TT_JOB6-LEARNING-LOOP_01.md` (Drive id 121CO_o9iR8TSwsrwd7eT2W_H9s1vskHe). Not a replacement: sections A–F are kept in order and AF6's numbering is unchanged.
**Full detail in GitHub:** `docs/job6c/IMPROVE.md`, `TT_JOB6C_SLIP_01.md` on branch `claude/job6c-improve`.

## PROCESS GATE (proof)
Go word is **qssend**, defined in STANDARD S6 section **S6.2** and in **Shorthand-Command-System.md** (both read in full this session). **GO is not the go word.** No paid Overskill turn, none needed.
`credits_estimated: 0 · credits_actual: 0 · credits_variance: 0`

## How to read this
Each AF6 item gets a tag: **AGREE**, **STRENGTHEN** (kept, made firmer), **DISAGREE** (with WHY) or **FACT** (checked this session, with the evidence). New points are numbered with a `+`. "Checked" means I read GitHub or the live site this session; anything else says UNVERIFIED.

---

## A. System improvements

1. **Verify the Drive output folder id before any prompt — STRENGTHEN.**
   Agree, and I am the example: the 6b brief named folder `1tsjx6AZ…` and I uploaded `TT_JOB6B_SLIP.md` there. **Checked: that folder is titled "Claude artefacts"** (file id `1VOgslTB2oGwD78YZ6IhnOL1_R7Z21n8X`). I trusted the id and never read the title.
   Make it a rule on both sides, not only AF6's: *before any Drive write, read the parent folder's title and refuse if it is "Claude artefacts" or is not under `4 - Apps > <app>` or Commons.* It costs one metadata call. RR_MASTER N-20 already asks for read-back of `parentId`; add "and title".
   **BOT:** relocate that file (handoff BOT-3 in `TT_JOB6C_SLIP_01.md`). I did not move or rename it.

2. **Branch protection as a hard close-out item — STRENGTHEN.**
   Agree. Add the automated half so the todo closes itself: **FACT** `GET /repos/ljoyrose/dashboard/branches/main` returns the rule with a normal read token (checked: protected, requires "Browser tests (pretend Google and Drive)", enforcement "everyone"). So "keep a todo until confirmed via API" is now one command, and a new Monday **protection watch** re-checks it and opens one Issue if it is ever off or the required job is renamed. For future suites: put the read-back command in the AUTHORITIES block next to "Lisa: branch protection click".

3. **Decide parked questions the same session — AGREE, add a mechanical guard.**
   A parked test now cannot exist without `DECISION NEEDED`, `OWNER:` and `BY <date>` in a comment above it (a check in `ci-guards.spec.js` fails otherwise). The RR_ case then shows as a dated, owned question in the code, not as a quiet "1 skipped".

4. **Tell Claude when a click-job is done so slips don't say "still off" — DISAGREE with the fix, AGREE with the problem.**
   WHY: a paste-back relies on a person remembering, and the failure here was Claude *stating* a fact it could have *read*. PR #15's body said protection was still off; the one-line read above would have shown it was on. Better fix: Claude reads the system before stating a fact about it, and facts live in one file, `docs/STATUS.md`, with how each was checked. Old slips get a dated banner, not a rewrite (done for the three 6b docs). AF6's paste-back can stay as a backup, but it should not be the mechanism.

5. **GitHub Issue alerts, no Slack or webhook secrets — STRENGTHEN: it has never been tested.**
   **FACT:** the alarm path was only ever dry-run; no real issue has been opened. Add a manual **Alarm fire drill** (new workflow): opens a clearly-labelled test issue, reuses it on a second red, closes it, and fails if more than one is open or any is left. Plus a check that no workflow uses any stored secret other than the built-in token. UNVERIFIED: that GitHub emails the address Lisa actually reads (it uses her GitHub notification settings). The drill's three emails answer that; BOT-1 asks Lisa.

6. **Re-run tenant-leak tests on every table/publish/RLS change — AGREE, with a scope note and a transferable pattern.**
   The dashboard has no tenants, tables or RLS, so this applies to Links only. UNVERIFIED: I did not read `RR_SKILL_overskill-multitenant-security.md`. What does transfer to Links: the **drift-watch pattern** from this repo (a weekly read-only check that a setting is still on, a fire drill for the alarm, a teeth check that breaks things on purpose). If AF1 builds `links-tests`, copy those three on day one, and protect the new repo (and its check name) before the first merge.

### A+ New system points
+1. **Pages publishes `main` without waiting for the tests.** **FACT:** at the last two publishes, `pages build and deployment` and `Dashboard tests` ran side by side. A bad merge is live before the red tick. Fix is a Pages Settings change (source to GitHub Actions, deploy `needs` the tests): a Lisa decision (Q1 in the 6c slip), SCHEDULE job "6d". This is the biggest remaining hole.
+2. **"Live check" only looked for a title.** It would pass on a stale or wrong version. Now the live files are compared **byte for byte** with the merged files (4 files; **checked: equal today**, sha256), waiting up to 90 s for Pages. Runs after each publish and on Mondays.
+3. **Protection could be silently switched off or the check renamed** (a rename freezes every merge on "waiting for status"). Covered by the new Monday watch (see A2).
+4. **The teeth check found real gaps on its first run:** the rules stopping a `ZZ_` folder that holds an `RR_` item from being binned, and a `ZZ_` item inside an `RR_` folder, had *no test*; a hidden file-start marker before the "CURRENT" line was also unchecked. Rule: **every new deletion-safety rule gets a teeth entry.** The teeth list is now checked on every push so it can't go stale for a week.
+5. **Alerts must say what to do.** The Issue body now opens with a plain "What to do" line (urgent only for the Money Hub or the Bin).

## B. Project (state table) — corrections and additions
| Item | AF6 said | Checked this session |
|---|---|---|
| Suite | 183 pass | **193** after 6c (183 + 10 `ci-guards`); 0 skipped |
| Branch protection | On | **FACT: on**, includes admins, no force-push |
| Live-after-deploy | "Watch next deploy" | **FACT: ran and passed twice** (after PR #12 and PR #15 publishes). AF6's UNVERIFIED line 1 is now verified |
| Teeth | Watch first Tuesday | Not yet run on GitHub (first scheduled run Tue 20 Oct). Can be run now by "Run workflow" (BOT-1) |
| Header contract | Local script only | Unchanged. Improve the how: read only the first 8 KB of each file (Drive `Range` header) so no Money values ever leave Drive (BOT-2) |
| `branch-protection.json` | (D6) | **FACT: now on `main` as a standalone file** (fixed by the last commit of PR #12). D6 is closed |
| Dependabot | not listed | **Add:** PRs #13 (test tools) and #14 (actions) open, both green. Decision Q2 |
| Job 6c stubs | accessibility, real-Drive headers in CI | Real-Drive headers in CI: **DROP** (needs a stored credential; local ranged read does it). Fork-PR trigger: **DROP**. Contrast/text fixes: **PROMOTE** to a later "page polish" job. |
| Page problems | — | **Add:** contrast (main 7 places, CD Hub up to 8), 10.5 px text on CD Hub, heading order. UNVERIFIED whether 10.5 px breaks Lisa's own readable-text rules; if it does, it is a rule breach, not polish, and should rank above "not now" |

## C. Cross-agent processes
- **Keep — AGREE.**
- **Change: AF6 must not send a Claude prompt until the folder id is verified — STRENGTHEN:** verify the *title*, not only that it opens (A1). A folder can open and still be the forbidden one.
- **Change: Claude does not upload; the bot uploads — AGREE for this job, with the reason made explicit.** The Drive connector cannot overwrite a file (RR_MASTER N-21), so a living file needs the rename-then-create dance the bot is better placed to do and verify. Claude's one-off upload in 6b worked but was into the wrong folder (A1).
- **Change: label paste-ready replies (Chrome vs main session) — STRENGTHEN to mechanical:** every paste block starts with one line `PASTE INTO: <Chrome Claude | main Claude session | AF6 chat>`. Then it can be grepped and Lisa never has to guess.
- **Handoff rule — AGREE, add a grep:** open handoffs are lines that start `BOT:`; when done they become `BOT-DONE: <date>`. `grep -rn "^BOT:" docs/` lists everything still open. Current open ones are in `docs/STATUS.md`.
- **+ Environment quirks belong in the job prompt (AF3, `claude-code-job-prompt`):** (a) `add_repo` with push access before `gh`; (b) GitHub GraphQL is blocked, so `gh pr create` fails, use `gh api`; (c) Settings and rulesets writes return 403, so Lisa clicks and Claude reads back; (d) `.gitignore` hides `*.json` and `*.csv`, so new ones need an allow-line (this cost the standalone `branch-protection.json`); (e) never trust a folder id, read its title. Each of these cost a turn or a rework.

## D. Lessons
1. Forbidden output folder — **AGREE**, with my part owned (A1). Also my brief-reading gap: the folder was named in the brief, and I did not question it.
2. Branch protection blocked — **AGREE**. Add: the read-back is available (A2), so Claude can *confirm* the click-job even though it cannot *do* it.
3. RR_ ambiguity — **AGREE**. Mechanical guard added (A3).
4. Stale status — **STRENGTHEN: root cause is "remembered, not read"** (A4), not "nobody told Claude".
5. Money nav selector — **DISAGREE on the cause.** `nav.main` was my wrong guess at a selector in the new phone test, caught by the first local run. The existing Money tests already used `nav.main`; I did not copy from them. The phone subset in the required job is a good idea but is not the fix. Lesson: **copy selectors from the existing specs; do not guess.**
6. `branch-protection.json` missing — **AGREE it was real, and FACT: it is fixed** (committed in PR #12's last commit, after AF6's own review spotted it). Root cause: the old `.gitignore` rule `*.json` silently hid it and nothing told me. Mechanical guard: environment quirk (d) above; the allow-line is now in `.gitignore`.
7. Widget vs chat answers — **AGREE**.
+8. **A file went to the forbidden folder** — see A1. Fix is a pre-write title check on both sides.
+9. **A zip per job is waste.** Everything in the zip is already on GitHub; a second copy to build, upload and verify. 6c made none. Keep a zip only if Lisa asks for a Drive handoff.

## E. Open questions for Lisa — my recommendations on AF6's four
1. **Create `Cf overskill > 4 - Apps > Dashboard`?** AGREE: yes. It also gives slips and the relocated 6b slip a correct home.
2. **`ljoyrose/links-tests` as a new repo?** AGREE: new repo, not under dashboard (separate required check and protection). Condition: switch protection on, and copy the watch, drill and teeth pattern, before the first merge.
3. **Run the header check on real files?** STRENGTHEN: yes, now rather than "later", because it is cheap and it is the only way to know the expected-column list is real. Condition: first 8 KB only, no values, temp folder deleted (BOT-2). Reply words: `run headers now`.
4. **Start the accessibility/contrast job?** AGREE not now, with one condition: check the 10.5 px CD Hub text against Lisa's own readable-text rules first. If it breaks them, promote it.
+5. **Gate Pages on the tests (job 6d)?** Recommend yes (A+1). Reply words: `gate pages on tests` / `not now pages`.
+6. **Dependabot PRs #13 #14?** Recommend: AF6 gives two lines on each, Lisa replies `merge 13 14` / `leave bot PRs`.

## F. Efficiency
- Pre-send id open-check — **STRENGTHEN** to a title check (A1). Saves the rework.
- 5-line status plus PR link — **AGREE** and mechanical: Claude ends each job with 6 lines (state, PR, checks, what Lisa must do, what AF6 must do, what is unverified); long detail stays in the repo. `docs/STATUS.md` is the page AF6 reads instead of asking Claude.
- Reused BP paste block — **AGREE**, now simply "see TESTS.md, *Make the tick compulsory*" and, for confirmation, the one read-back command.
- Decide parked tests same day — **AGREE** (A3 makes it visible and dated).
- Dual prompts — **AGREE**.
- **+ No zip per job** (D+9). **+ Read, don't recall** (A4): one read command is cheaper than a correction cycle. **+ Fewer Lisa clicks:** the protection watch, fire drill and Dependabot summary mean Lisa clicks only for decisions, never to check.
- **Prompt gaps to close in `claude-code-job-prompt`:** AF6's four, plus (5) environment quirks (C+), (6) "read back any claim about settings or live state before stating it", (7) "name the exact read-back command for each click-job", (8) "say whether Claude may upload to Drive; if yes, folder title must pass the check".

## Could NOT check (UNVERIFIED)
- Whether GitHub gates Pages on tests (Pages API blocked); that the workflow token can read the protection details; whether Issue emails reach [email removed].
- Real Drive column names; teeth and fire drill on GitHub (they run only from `main`).
- Lisa's exact readable-text rules; `RR_SKILL_overskill-multitenant-security.md`; the `links-tests` plan.

## Learning-loop points that are now mechanical (for AF6 to adopt)
Docs name only tests that exist · every `@regression` test is listed · parked tests carry question, owner and date · the teeth list matches the page · the required job name exists · the alarm opens with "What to do" · no stored secrets · protection re-checked weekly · TESTS.md total checked in the run summary. Not mechanical yet: "new deletion rule gets a teeth entry" (rule in `docs/job6c/HANDOVER.md`) and "process lessons become `LEARNINGS.csv` rows" (AF6).

## Handoff
BOT: upload `docs/job6c/TT_JOB6-LEARNING-LOOP_02.md` (from branch `claude/job6c-improve`) to 00 AI Commons `1gNHYWXObTrioLv6gbDhvMqqin1nfIrTh`, same name, plain `.md`. Verify size and sha256 (given in the PR comment) and confirm in chat. Claude did not upload it. No Drive write to "Claude artefacts".

## Archive line
JOB 6 LEARNING-LOOP 02 — Claude improvements filed; AF6 merges and chooses what to adopt. Credits 0/0/0.
