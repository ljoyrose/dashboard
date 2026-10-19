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
8. Only the shared sign-in is saved (one key, this browser, every tab). Sign-out clears it in every tab.
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

## Publishing waits for the tests

**The problem it fixes:** GitHub Pages publishes every merge to `main` straight away, at the same time as the tests run, and it publishes the whole repo (`docs/`, zips, `TESTS.md`, test fixtures, gate rules), so they can all be read on the web.

**What was built** (finishing the Job 6d branch): a workflow called "Publish site (after tests)". On every merge to `main` it runs the same tests as the required check first. It publishes only if they all pass, and it publishes only `index.html`, `auth.js`, `config.js`, `toolkit.js`, `tokens.css`, `cdhub/` and `money/`. Tests check this, including deliberate breaks that prove they would catch a publish that skips the tests or includes too much. A test also fails if a page refers to a file that would not be published.

**Lisa: one click, once.** GitHub > **dashboard** > **Settings** > **Pages** > **Build and deployment** > **Source** = **GitHub Actions**. Then press **Actions > Publish site (after tests) > Run workflow** once. Until you click, the workflow does nothing harmful: its summary says "Waiting for Lisa's one click", and the old branch publishing carries on.

**To undo it:** Settings > Pages > Source > **Deploy from a branch** > `main` > `/ (root)` > Save.

**Also needs one click:** GitHub Issues are switched off on this repo (checked 18 Oct 2026), so the alarm can't open an Issue. Settings > General > Features > tick **Issues**. The Monday protection watch reports it until then.

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
| 18 Oct 2026 | (found in review) CD Hub did not clean quote marks and let any link through, so a table cell could run code in the signed-in page | "CD Hub cleans quote marks and refuses javascript: links from the tables" |
| 18 Oct 2026 | (found in review) Signing out while on the Bin and signing back in broke the Bin (the Dropbox slot was forgotten) | "signing out on the Bin and back in draws the Bin with no errors" |
| 18 Oct 2026 | (found in review) The 5-minute refresh silently unticked everything you had ticked | "the 5-minute refresh keeps your ticks and waits while you have any" |
| 18 Oct 2026 | Live Bin said "The delete ledger could not be read" because the ledger now starts with a "COUNT: n rows" note line above the header | "a ledger that starts with a COUNT note line above the header is still read" |
| 18 Oct 2026 | A Google "too many requests" (429) answer failed the read straight away instead of trying again | "home: two 429 answers in a row are retried and the page still reads normally" |
| 18 Oct 2026 | Every Money reread downloaded every file again (27 Drive calls each time), even when nothing had changed | "Reread with nothing changed downloads no file at all, and stays inside the Drive call budget" |
| 18 Oct 2026 | The teeth check showed the "RR_ item inside a ZZ_ folder" guard could be removed without any test noticing (a second, wider check hid it) | "an RR_ item deep inside a ZZ_DELETE_ folder keeps the whole folder out of the bin, even with Select all" |
| 18 Oct 2026 | Same for the "ZZ_ item inside an RR_ folder" guard | "a ZZ_DELETE_ item anywhere below an RR_ folder is left alone, even with a ledger row" |
| 18 Oct 2026 | Changing screen left keyboard focus on the old menu item, so screen readers did not say where you were | "home: clicking a menu item puts focus on the screen title" |
| 18 Oct 2026 | The Map led with links and counts, so what needed Lisa today was spread over several cards | "shows at most 7 rows, overdue (red) first, each row a link, and the tab title carries the count" |
| 18 Oct 2026 | Money only said "runs dry on X" in words, so a forecast dip was easy to miss | "a forecast that goes below zero marks the runs-dry date in red" |
| 18 Oct 2026 | Phone install needs a kept copy of the site, and it must never hold Drive data or the sign-in | "after signing in and reading, the kept copy holds only the page files" |
| 18 Oct 2026 | There was no way to find a file, to-do or dog without opening each page and scrolling | "home: / opens search; it finds Drive file names per shared drive and Money to-dos, each a link" |
| 19 Oct 2026 | Lisa still signed in twice: the sign-in lived in one tab only, so Money in a new tab or window, or the installed app, asked again | "sign in on home, open Money Hub and CD Hub: each opens in a new tab already signed in, no prompt" |
| 19 Oct 2026 | CD Hub Today: "0 of 23 cabins with a temperature" did nothing when clicked (a button with no action) | "CD Hub Today: the temperature tile opens The round, where temperatures are entered" |

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

## Settings file and Google retries

All ids and addresses (the public sign-in id, the Drive folder and file ids, the Google addresses) are written once, in `config.js`. The three pages and the tests read them from there. A test fails if the sign-in id is copied anywhere else.

`toolkit.js` holds the shared Google reader. When Google says "too many requests" (429 or a rate-limit 403) or has a hiccup (5xx), a read tries again by itself: up to 4 tries, about 1, 2 and 4 seconds apart, plus a little random extra. A plain refusal (no access, folder not found) is not retried, and a change to Drive (the Bin buttons) is never retried. If all 4 tries fail, each page says: "Google is busy right now (too many requests). The dashboard tried 4 times. Wait a minute, then try again." Tests: `tests/mocked/google-retries.spec.js`.

## Money reads only what changed

Money keeps a copy of each file **in memory only** (never in the browser's storage), with the "last changed" time Drive gave for it. On Reread, and on the 10-minute timed reread, it still asks Drive for the folder listings, but it downloads a file again only if its "last changed" time is different. Sign-out forgets the copy. A test caps the Drive calls: a first read of the sample drive may use at most 40 (today 27), and a reread with nothing changed at most 8 (today 6) with no downloads. Tests: `tests/mocked/money-cache.spec.js`.

## Money chart and worked-out deadlines

Each entity page draws its `FORECAST.csv` as a line, with a dashed £0 line, the start point and, if the forecast goes below zero, a red dot labelled "Runs dry". The same facts are in the chart's spoken label and in a note under it. The Dates page and each entity page also list **deadlines worked out from the usual UK rules**: Self Assessment (31 January and 31 July) for personal entities; Companies House accounts (9 months), Corporation Tax payment (9 months and 1 day) and CT600 (12 months) for companies with a `year_end`; VAT (1 month and 7 days after each quarter) where `vat_quarter_end` is set. Every row says **check with accountant**; it is not tax advice. A date already in MON-DATES for the same entity (within 5 days) is not repeated. Tests: `tests/mocked/money-forecast-deadlines.spec.js`.

## One sign-in for every tab, and the Dashboard button

- One sign-in covers home, Money Hub and CD Hub in every tab, window and the installed app (one key, `ljr-dash-auth`, in this browser).
- Only the short-lived access token and its expiry. No refresh token, no secret. Expired = not reused.
- Sign out in one tab = signed out in all. Sign in in one tab = the others pick it up.
- Money Hub and CD Hub links on home open in a new tab.
- Every page except home has a **Dashboard** button, top right. Opened from the dashboard: it brings that tab back and closes itself. Otherwise it goes home.
- Home links the MOVE workbook once (the tile).
- Tests: `tests/mocked/one-sign-in-tabs.spec.js`.

## Every click works

- `tests/mocked/every-click.spec.js` opens every screen of home (11), Money Hub (8) and CD Hub (10) with pretend data.
- Every visible button, tile and link: has a label; internal links answer 200; outside links are https and open a new tab.
- Each one is clicked on a fresh copy of the screen. It must go somewhere, open a tab, change the page or ask a question. A dead click fails.
- Not clicked: Sign out and the skip link (own tests). Outside links are checked, not opened.

## Phone install and keyboard keys

`manifest.webmanifest`, the icon in `icons/` and `sw.js` let you add the dashboard to your phone's home screen. It opens full screen. The service worker keeps **only the site's own page files**, so the pages open fast and still open offline (they then say a read failed, because nothing from Drive is kept). It never touches Google addresses, never keeps a request that carries a sign-in, and keeps no Drive data or token. A test signs in, reads, and then checks every kept file is a page file. The rest of the suite runs with service workers switched off, so every test starts clean.

Keyboard keys on all three pages (from `toolkit.js`): `g` then `m` Map, `d` Drive, `b` Bin, `c` Changes, `f` Money Hub, `h` CD Hub; `r` read again; `/` search; `?` shows the list. Keys do nothing while you type in a box. Tests: `tests/mocked/pwa-and-keys.spec.js`.

## Search

Press `/` (or the Search button) on any page. One box, results grouped by where they came from, each group in its colour:
- **Home:** Drive file names in each shared drive (one read-only name search per shared drive, at most 12 drives, never My Drive), plus the Money to-dos and dates the page has already read.
- **Money Hub:** to-dos, dates and accountant questions already read (no extra Drive calls).
- **CD Hub:** dogs (name, chip, id) and litters already read. Picking a dog opens Dogs filtered to it.

A quote in the words is escaped before it reaches Drive. Signed out, nothing is searched. Tests: `tests/mocked/search.spec.js`.

## Bin guard: 00 CHECK on the Bin page

A Google Apps Script owned by lisa@puppyclassroom.com (the "bin guard", code kept in Drive, not in this public repo) looks in the bins every day at about 8am UK. Anything whose name does not start `ZZ_DELETE_` or `ZZ_SUPERSEDED_` is taken back out and put in **LD > *00 Current > 00 CHECK**. It never deletes for good and never empties a bin.

The Bin page shows 00 CHECK with ticks, **Select all**, **Clear**, **ZZ_DELETE** and **Refer to AI**. The page only **reads** 00 CHECK. The two buttons open the guard's own Google page (a web app that only puppyclassroom.com accounts can open, and only Lisa can use) with the ticked ids; nothing changes until Lisa presses the button there. RR_ names are never ticked. The buttons stay off until the web app exists: it writes its address into `BIN-GUARD-WEBAPP.json` in *00 Current the first time Lisa opens it, or you can put the address in `config.js` (`binGuard.webAppUrl`). Only a `https://script.google.com/.../exec` address is accepted. Tests: `tests/mocked/bin-guard.spec.js`.

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
