# TESTS: how we know the dashboard still works

*For Lisa. Plain English. Last updated 15 Oct 2026 (Job 6b).*

## The short version

- A robot opens each dashboard page in a real browser and clicks around.
- It checks the page loads, the buttons and links work, and nothing is broken.
- **It never signs in to your real Google. It never reads your real Drive.** Both are pretend.
- It runs by itself on GitHub every time a change is saved, and every Monday morning.
- **Green tick = good. Red cross = something needs a look.**
- **A change cannot be merged into `main` unless the tick is green** (once you switch that on: see "Make the tick compulsory").
- If the Monday run is red, **GitHub opens one Issue and emails you.** It closes itself when things are green again.

You do not need to do anything day to day. This page just explains what the robot checks.

## What "green" means

Green means all of these are true on all three pages:

1. The page opens (no "page not found").
2. The page shows the right first screen (a sign-in button, nothing private).
3. After a pretend sign-in, the page shows its sections.
4. Every menu link goes where it should.
5. The sample spreadsheets (CSV files) are read and shown correctly.
6. The browser shows **no unexpected errors** in its hidden error log.
7. The page never tries to contact any address we did not plan for.
8. Only the shared sign-in for this browser tab is saved. Sign-out clears it.
9. On a phone-sized screen, each page opens, the menu works and nothing scrolls sideways.
10. The column names the pages expect in your Drive files are still the ones on our list.
11. Dark mode still works, and accessibility and the smallest text size have not got worse.

If any of these breaks, the tick turns red and says which page.

## What is checked, page by page

| Page | Address | Checks |
|---|---|---|
| Main dashboard | `/dashboard/` | 46 |
| CD Hub | `/dashboard/cdhub/` | 30 |
| Money Hub | `/dashboard/money/` | 41 |
| Reading CSV files | both readers | 17 |
| Safety checks | the whole repo | 4 |
| Bin safety (`RR_` archives never taken) | `#/bin` | 10 |
| Never empty the bin | all three pages | 2 |
| PC-Personal and Drive check (rename, then bin) | `#/personal`, `#/usb` | 14 |
| Header contract (column names) | list of expected columns | 12 |
| Dark mode, accessibility, smallest text | all three pages | 18 |
| Phone-sized screen (390 × 844) | all three pages | 3 |
| Learning loop and alarm wiring (the safety net checks itself) | this file, `.github`, `tests/` | 10 |

That is 207 checks that must pass.

**Main dashboard**
- Opens and shows a sign-in button until you sign in. The home screen also shows Key projects & docs (MOVE, Money Hub, CD Hub and the other sections).
- Every menu tab works: Map, Read first, Drive, PC-Personal, Drive check, Bin, Changes.
- Links straight to a section work, like `#/changes/24h`, `#/bin` and `#/personal`.
- The Back button works.
- Drive lists the shared drives, opens a folder and has an "Up one level" link.
- The Bin lists other `ZZ_` names under Rename needed. Only a ticked `ZZ_DELETE_` file with a ledger row can be moved, and only after you confirm. An `RR_` file is never listed as movable.
- Nothing permanently deletes a shared-drive bin. There is no button for that, and no page calls Drive to empty one.
- The Dropbox line shows counts only.
- The Money tile shows each entity on its own, never added together.
- The Money tile links open `/money/`, a single entity, and a single to-do.
- Sign-in problems show a clear message (permission refused, window closed, window blocked).

**CD Hub**
- Opens, asks for sign-in, then reads the sample `BLD-*` tables.
- All ten sections open (Live feed, Outstanding, Table map, Today, The round, Dogs, Areas, Litters, Vet link, Buyers).
- Dogs, cabins, litters and weights from the sample files join up correctly.
- Two files with the same name are refused, not guessed.
- Missing files are reported, not hidden.
- Saving stays switched off.
- Sign out forgets everything.

**Money Hub**
- Opens, then needs a sign-in.
- Only Lisa's account gets in. Any other account is turned away and **no figures are read**.
- All six sections open (Now, Money, Dates, To-do, Accountant, Control).
- "← Dashboard" goes back to the main dashboard.
- Sample ledgers show the right cash, overdue items, dates and to-dos.
- A missing, doubled or wrongly-shaped file shows as an error. It never quietly uses an old one.

**Bin safety**
- A folder with an `RR_` item anywhere inside is **left alone**, with a note saying why.
- A file inside an `RR_` folder is **left alone**.
- A name containing `RR_`, a `ZZ_DELETE_` file with no ledger row, and a retired `ZZ_SUPERSEDED_` name cannot be ticked.
- A name that merely contains `ZZ_DELETE_` in the middle is not listed.
- If the delete ledger or a pending slip cannot be read, nothing is binned.
- Move selected acts only on ticked rows that are on screen. On a list of 52 with 50 shown, Select all moves 50. Show all, then Select all, can reach all 52.
- A personal `ZZ_DELETE_DRIVE_` file is binned only when it is ticked and has a ledger row. `RR_` in the name is left out.
- A money rollback file is labelled "Held: money rollback (E02), do not touch until FIX 6 is confirmed" and is not ticked or binned, even with a ledger row and Select all. The two filename patterns are held anywhere. Files in 0.1 - Index or the CHECK-LOG 4 - Ops folder are held by those folder ids only. A ledger-backed `ZZ_DELETE_` file in another folder named 4 - Ops, or in a differently id'd folder named 0.1 - Index, is still binned.

**Never empty the bin**
- Each page is opened (main dashboard, CD Hub, Money Hub, and their sections).
- The check fails if any request permanently deletes a bin (a DELETE to a trash address).
- The check fails if a page's source contains the old empty-bin wording.
- The same wording is also searched for in the page files themselves, without opening a browser.

**PC-Personal and Drive check (these rename and bin real files, so they matter most)**
- Every write goes to a pretend Drive or a pretend plugged-in drive that only exists in memory. Nothing real can be renamed or binned.
- PC-Personal "Rename selected": with nothing ticked, nothing happens. It asks for the extra permission, then asks you to confirm. Cancel changes nothing. Confirm renames **only** the ticked files that match a shared-drive copy, adds `ZZ_DELETE_DRIVE_`, and never touches the shared copy, a file with no match, or a name containing `RR_`.
- PC-Personal "Move selected": finds files starting `ZZ_DELETE_DRIVE_`, and moves only the ticked ones that have a ledger row (never deletes). A name containing `RR_` cannot be ticked.
- Drive check: finds the files already in a shared drive, ignores tiny and system files, and renames only the ticked matches (`ZZ_DELETE_LOCAL_`). A name containing `RR_` cannot be ticked. Deletes nothing.

**Header contract**
- The file `tests/contract/expected-headers.json` lists the **column names** (names only, no figures) each Drive file should have.
- The robot checks that the sample files, the page code and that list all agree, and that the pages still read the columns they read before. A column renamed in the page or in the samples turns the tick red.
- This is how a renamed column gets noticed even though the pretend Drive can never rename one. To check your **real** files, see "Check your real column names".

**Reading CSV files**
- Commas inside quotes, quotes inside quotes, line breaks inside quotes.
- Windows line endings, a blank last line, short rows, empty files.
- A hidden marker at the start of a file (a "BOM"), including in front of the "CURRENT: 3 rows held" line.
- The first line the Money files carry ("CURRENT: 3 rows held"), and a warning when the count is wrong.

**Safety checks**
- No passwords, keys or tokens in the files.
- The sample CSVs are invented (only `example.test` email addresses).
- The pages only load Google sign-in and Google Fonts by themselves.

## What is pretend and what is real

| Thing | In the tests |
|---|---|
| Google sign-in | **Pretend.** A stand-in answers "signed in" instantly. No Google window opens. |
| Google Drive | **Pretend.** A small fake Drive lives in memory and answers the same questions. |
| Spreadsheets (CSV) | **Invented samples** in `tests/fixtures/`. Fake names, fake figures. |
| Your Google account | **Never used.** No password or key is needed. |
| The web pages themselves | **Real.** The actual files in this repo, served on the test machine. |
| The browser | **Real.** A genuine Chrome-type browser. |
| Google Fonts (the look) | Answered empty, so the tests need no internet. |

Because Drive is pretend, a green tick does **not** prove your real Drive folders are in order. It proves the pages behave correctly when Drive gives them the right kind of answer.

## When does it run?

- **Every time a change is saved** (every "push") to GitHub.
- **Every Monday about 06:17 UTC.**
- **Whenever you press the button:** GitHub > the **Actions** tab > **Dashboard tests** > **Run workflow**.

Each run writes a short table at the top of its page in the Actions tab: one line per page, with passed and failed counts.

There is also a small **optional** check of the three live web addresses. It opens them signed out and confirms they are up. It runs **a minute or so after every publish to the live site** (so a bad merge is noticed in minutes), on Mondays, and on the button. It never blocks anything, because GitHub Pages can have a slow day. It also checks that **what is live is exactly the file that was merged** (compared byte for byte, waiting up to 90 seconds for GitHub Pages to finish). It has run after the last two publishes and passed.

Every Tuesday a separate **"teeth check"** breaks things on purpose in a throw-away copy (a wrong link, a lost safety rule, a renamed column, a page too wide for a phone, and so on) and makes sure the tests go red each time. If one slips through, it turns red and opens an Issue. It cannot block a merge.

## How to run it on your own computer (optional)

You need **Node.js** (the free program that runs the tests) version 22.

1. Open a terminal in the `dashboard` folder.
2. Install the tools. Do this once:
   ```
   npm ci
   npx playwright install chromium
   ```
3. Run the tests:
   ```
   npm test
   ```
4. Read the pretty report:
   ```
   npm run report
   ```
5. To watch the browser work, use `npm run test:headed`.
6. To also check the live site, use `npm run test:live`.

It takes about 90 seconds.

## If something goes red

1. Open the failed run in the Actions tab.
2. Read the table at the top. It names the page.
3. Download **playwright-report** at the bottom. It has a screenshot and a replay of each failure.
4. Send the link to your builder. It is not urgent unless it is the Money Hub or the Bin.

**The Issue rule (one short paragraph).** When the Monday run (or any scheduled or hand-started run on `main`) goes red, the robot opens **one** GitHub Issue named "Dashboard tests are red: " plus the failing page, and GitHub emails you. If it is still red next time, it updates that same Issue (no second one). When a run on `main` is green again, it closes the Issue by itself. The branch-protection watch ("Branch protection needs a look") also has its own single Issue. The live-site check has its own single Issue ("Live site check is red") and the teeth check has its own ("Teeth check failed"), so a Pages hiccup never hides a real test failure. To prove the alarm really works, press **Actions > Alarm fire drill > Run workflow** once: it opens, re-uses and closes a clearly-labelled TEST issue (expect about 3 emails headed "FIRE DRILL", all safe to ignore). Nothing here uses Slack, webhooks or any new secret.

## Make the tick compulsory (branch protection)

This is what turns the tests from "advice" into "protection". It needs your admin rights on GitHub, so it is one thing for you to click (the robot that built this was not allowed to change repository settings). **Status: it is ON (checked 16 Oct 2026 against GitHub itself).** If you ever need to redo it, the steps are below. A weekly "protection watch" re-checks it every Monday and opens one Issue if it is ever switched off.

1. GitHub > the **dashboard** repository > **Settings** (top row).
2. Left side: **Branches**. Click **Add branch protection rule** (or **Add classic branch protection rule**).
3. **Branch name pattern:** type `main`.
4. Tick **Require a pull request before merging**. Leave "Required approvals" at **0** (you are the only person, so you could not approve your own).
5. Tick **Require status checks to pass before merging**. In the search box type `Browser tests` and pick **Browser tests (pretend Google and Drive)**. (It only appears in the list because it has run recently. If you cannot find it, open the Actions tab, run "Dashboard tests" once, then try again.)
6. Tick **Do not allow bypassing the above settings** (this makes it apply to you too).
7. Leave **Allow force pushes** and **Allow deletions** **unticked**.
8. Click **Create** (or **Save changes**).

What changes for you: nothing can go straight into `main`; every change comes as a pull request, and the green **Merge** button only lights up when the tests are green. A red tick means "fix it first". If you ever need to bypass it in an emergency, untick step 6 for a moment.

Do not rename the job "Browser tests (pretend Google and Drive)" in `tests.yml`. If it is renamed, merges stick on "Expected, waiting for status" and the rule must be edited to the new name.

## Check your real column names (optional, on your computer only)

The pretend Drive cannot tell us if a column was renamed in your real files. This little script can, without any sign-in:

1. In Google Drive, download the files to check (for example the Money index files and the `BLD-app-tables` files) into one folder on your computer.
2. In a terminal in the `dashboard` folder: `node tests/contract/check-real-headers.js /path/to/that/folder`
3. It prints `ok` or `PROBLEM` per file and names any missing or renamed column. It reads only the top of each file, prints column names only, never values, and sends nothing anywhere.

GitHub does not run this one, on purpose: it would need a Google key stored in GitHub, and none is stored.

## Decisions you have made

**PC-Personal leaves `RR_` names alone (decided 17 Oct 2026).** A personal file whose name contains `RR_` is not renamed and is not binned, even when it is an exact copy of a shared-drive file and even when its id is in the delete ledger. The same rule applies on the Bin page and on Drive check. A test pins this, so a later change has to be discussed first.

## Known gaps in looks and reading (not new, now written down)

- **Colour contrast** (text hard to read against its background) is flagged by the accessibility check in some places: main dashboard 7 spots, CD Hub up to 8.
- **Small text:** the CD Hub has text as small as 10.5 px; the other two pages start at 13 px.
- **Heading order** on the main dashboard and CD Hub skips a level.
The check only fails if these get **worse**. When one is fixed, the number in `tests/mocked/look-and-access.spec.js` is lowered so it can never creep back.

## Caught after merge (and how to add to it)

Each line is a bug that got past the tests once, and the test that now stops it. These tests have `@regression` in their name, and every run's summary counts them.

| Date | What went wrong | Test that now guards it |
|---|---|---|
| 8 Oct 2026 | CD Hub: the Litters page crashed, and occupancy was read from the wrong column (commit `2242bac`) | "joined tables work: cabins show their dogs, litters show dam and sire…" (covers Litters and occupancy; the Animana record choice is **not** yet covered) |
| 15 Oct 2026 | (found by the teeth check, not a live bug) a hidden marker in front of the "CURRENT" line made the row-count warning disappear; and the rules that stop a `ZZ_` folder holding an `RR_` item being binned had no test | "a BOM in front of the…" (the "CURRENT: n rows held" line test), and the two Bin safety tests |
| 17 Oct 2026 | A bulk move could still change rows hidden past Showing 50 of 52 | "Select all on a list of 52 with 50 shown" |
| 17 Oct 2026 | Signing in on one page asked again on Money and again on the way back | "one sign-in is shared, and an expired token does ask again" |

**Recipe when a bug is fixed:**
1. Write a test that **fails** on the broken page and **passes** on the fixed one.
2. Put `@regression` at the end of its name.
3. Add a row to the table above (date, what went wrong, test name).
4. Tick "Bug fix? Regression test added?" in the pull request. If the pull request is called a fix and changes nothing under `tests/`, the robot adds a yellow warning (it never blocks).

## What is not covered (honest list)

- The real Google consent screen.
- Real Drive speed, limits and permissions.
- Whether the numbers in your real files are right. That is the job of the Control page in the Money Hub.
- Your real column names in CI (use the local script above).
- Phone sizes beyond one Pixel-sized screen, and only a short list of checks on it.
- A real USB stick or real renaming on a disk (the Drive check is tested against a pretend plugged-in drive).

## Where things live

| What | Where |
|---|---|
| The tests | `tests/mocked/` (desktop), `tests/phone/` (phone) |
| The pretend Google and Drive | `tests/support/` |
| The invented sample files | `tests/fixtures/` |
| Expected column names | `tests/contract/` |
| The "teeth" check | `tests/teeth/` |
| The robot's schedule | `.github/workflows/` (`tests.yml`, `live-after-deploy.yml`, `teeth.yml`, `fix-needs-test.yml`) |
| Weekly update nudges (never auto-merged) | `.github/dependabot.yml` |
| Settings | `playwright.config.js`, `package.json` |

Nothing in the dashboard pages themselves was changed to add these tests (Job 6 or Job 6b).
