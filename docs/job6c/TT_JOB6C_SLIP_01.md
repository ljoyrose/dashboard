JOB 6c IMPROVE — review delivered, awaiting Lisa

**From:** Claude Code (cloud) · **To:** Lisa Carson, AF6 Dashboard Tests · **Date:** 16 Oct 2026 (UK)
**PR:** https://github.com/ljoyrose/dashboard/pull/16 · **Branch:** `claude/job6c-improve` · **Not merged. Not pushed to `main`.**
`credits_estimated: 0 · credits_actual: 0 · credits_variance: 0`

## PROCESS GATE (proof)
- Read in full this session from Drive: `RR_MASTER-NAMING-AND-FILING-PROTOCOL.md` (v0.7, 14 Oct 2026), `STANDARD S6` (amended 16 Oct 2026) and `Shorthand-Command-System.md`.
- The go word is **`qssend`**. It is defined in STANDARD S6 section **S6.2** and in **Shorthand-Command-System.md**. **`GO` is NOT the go word.** No Overskill prompt and no paid turn was used; nothing in this job needs one.
- No secrets. No real Drive data. No Settings changed. Naming note: RR_MASTER gives `TT_` files an ISO date; Lisa's brief named `TT_JOB6C_SLIP_01.md` exactly, so the brief wins and the file has no date.

## The short answer (5 lines)
1. Biggest hole: **GitHub Pages publishes `main` without waiting for the tests**, so a bad merge is live before the red tick. Fixing it is a Settings change, so it is a question for Lisa (Q1).
2. Built now: live files are checked **byte for byte against the merged files**; a weekly **protection watch**; an **alarm fire drill**; the **learning loop made mechanical** (10 new checks); a one-page `docs/STATUS.md`.
3. Verified this session: protection on, live == repo (4 files), live-after-deploy ran and passed twice, 2 Dependabot PRs green.
4. One mistake of mine to fix: the Job 6b slip was uploaded to a folder titled **"Claude artefacts"** (forbidden). I moved nothing; handoff BOT-3.
5. Full ranked list: `docs/job6c/IMPROVE.md` (14 items, each with WHAT / WHY / OWNER). Learning-loop comparison with AF6's slip: `TT_JOB6-LEARNING-LOOP_02.md`.

## DO NOW items delivered in this PR (all tests/docs/workflows; no page changed)
| Item | Files |
|---|---|
| Live files must equal merged files | `tests/live/live-smoke.spec.js`, `live-after-deploy.yml`, `tests.yml` |
| Weekly protection watch | `tests/support/check-protection.js`, `.github/workflows/protection-watch.yml` |
| Alarm fire drill (manual) | `.github/workflows/issue-fire-drill.yml` |
| Learning loop made mechanical + teeth list freshness + parked-test rule | `tests/mocked/ci-guards.spec.js` (10 checks), `tests/teeth/breaks.js` (split out of `run-teeth.js`) |
| Plain "What to do" line in alarm Issues | `tests/support/report-issue.js` |
| Docs total check (warning only) | `tests/support/summary.js`, `results.js` |
| One place for current facts + stale-status banners | `docs/STATUS.md`, banners on `docs/job6b/` PROGRESS, CONTINUE_PROMPT, slip; `TESTS.md` (status, new rows, total 183 to 193) |

## Questions for Lisa (not blocked; the work above does not depend on them)
**Q1. WHAT:** Make GitHub Pages wait for the tests before publishing (new job "6d")?
**OPTIONS:** Yes, do it soon · Not now
**RECOMMENDATION:** Yes. It is the one place the tests still cannot stop a bad page going live. It needs a Pages Settings change by you.
**Reply words:** `gate pages on tests` / `not now pages`

**Q2. WHAT:** The two weekly Dependabot PRs (#13 test tools, #14 actions), both green. How should they be handled?
**OPTIONS:** AF6 reads each PR's notes and gives you 2 lines, you reply to merge · Leave them to you · Ignore them
**RECOMMENDATION:** The first. One short reply from you, no reading.
**Reply words:** `merge 13 14` / `leave bot PRs`

(AF6's own questions E1–E4 in `TT_JOB6-LEARNING-LOOP_01.md` still stand; my recommendations on them are in `_02`.)

## Handoffs for AF6 (grep-able: lines starting `BOT:`)
BOT: **BOT-1 (after this PR is merged)** In GitHub, Actions tab, press **Run workflow** on: "Alarm fire drill (manual)", "Teeth check (weekly)", "Protection watch (weekly)". Success: all three runs green; `gh issue list --label fire-drill --state open` is empty; the teeth summary shows 8 of 8 caught; the watch summary says protection is on (note which of "details visible" or "only is-on checked" it printed). Then ask Lisa one question: "Did about 3 emails headed FIRE DRILL reach Lisa's email inbox?" Record the answer in `docs/STATUS.md` and change these lines to BOT-DONE.
BOT: **BOT-2** Header check on real files without moving data: for each file in the Money index and `BLD-app-tables` folders, read only the first 8 KB (Drive API `Range: bytes=0-8191`) into a temp folder, run `node tests/contract/check-real-headers.js <temp folder>`, paste only the `ok` / `PROBLEM` lines (no values), delete the temp folder. Success: every file `ok`, or the exact renamed column named. Only when Lisa says `run headers later` has become `run headers now`.
BOT: **BOT-3** Relocate `TT_JOB6B_SLIP.md` (file id `1VOgslTB2oGwD78YZ6IhnOL1_R7Z21n8X`) out of "Claude artefacts" (`1tsjx6AZsXVLP7XUx_N6jwV7LoIIhvaT5`): upload the same text to 00 AI Commons (`1gNHYWXObTrioLv6gbDhvMqqin1nfIrTh`) as `TT_JOB6B_SLIP.md`, verify size and checksum, write the ledger row, then apply the `ZZ_DELETE_` marker to the old copy per RR_MASTER K-01. Claude did not move or rename it.
BOT: **BOT-4** Upload `docs/job6c/TT_JOB6-LEARNING-LOOP_02.md` (download from the PR branch) to 00 AI Commons (`1gNHYWXObTrioLv6gbDhvMqqin1nfIrTh`), verify size and checksum against the sha256 in the PR comment, and confirm in chat.
BOT: **BOT-5 (skill)** Add to `claude-code-job-prompt`: the six environment quirks in IMPROVE item 13; the pre-send Drive folder title check; "state the read-back command that proves any Settings click".

## Could NOT check (UNVERIFIED)
Pages source and whether Pages is gated · whether the workflow's own token can read the protection details · whether Issue emails reach Lisa's email inbox · real Drive column names · teeth and fire drill on GitHub (they only run from `main`) · Lisa's exact readable-text rules · the multitenant skill and the `links-tests` plan (not read).

## Job 6c stubs from `docs/job6b/PROGRESS.md`
Real-Drive headers in CI: **DROP** (needs a stored credential; BOT-2 does it locally). Fork-PR trigger: **DROP**. Fix contrast and small text: **PROMOTE** to a later "page polish" job, only on Lisa's `start a11y job`.

## Archive line
JOB 6c IMPROVE — Claude slip filed in GitHub `docs/job6c/`; answers live here, not only in chat.
