# TESTS: how we know the dashboard still works

*For Lisa. Plain English. Last updated 15 Oct 2026.*

## The short version

- A robot opens each dashboard page in a real browser and clicks around.
- It checks the page loads, the buttons and links work, and nothing is broken.
- **It never signs in to your real Google. It never reads your real Drive.** Both are pretend.
- It runs by itself on GitHub every time a change is saved, and every Monday morning.
- **Green tick = good. Red cross = something needs a look.**

You do not need to do anything. This page just explains what the robot checks.

## What "green" means

Green means all of these are true on all three pages:

1. The page opens (no "page not found").
2. The page shows the right first screen (a sign-in button, nothing private).
3. After a pretend sign-in, the page shows its sections.
4. Every menu link goes where it should.
5. The sample spreadsheets (CSV files) are read and shown correctly.
6. The browser shows **no unexpected errors** in its hidden error log.
7. The page never tries to contact any address we did not plan for.
8. Nothing is saved in the browser.

If any of these breaks, the tick turns red and says which page.

## What is checked, page by page

| Page | Address | Checks |
|---|---|---|
| Main dashboard | `/dashboard/` | 47 |
| CD Hub | `/dashboard/cdhub/` | 30 |
| Money Hub | `/dashboard/money/` | 41 |
| Reading CSV files | both readers | 16 |
| Safety checks | the whole repo | 4 |

**Main dashboard**
- Opens and shows only a sign-in button until you sign in.
- Every menu tab works: Map, Read first, Drive, PC-Personal, Drive check, Bin, Changes.
- Links straight to a section work, like `#/changes/24h`, `#/bin` and `#/personal`.
- The Back button works.
- Drive lists the shared drives, opens a folder and has an "Up one level" link.
- The Bin lists `ZZ_` files, never touches `RR_` files, and asks you to confirm.
- "Empty bin" does nothing unless `EMPTY` is typed.
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

**Reading CSV files**
- Commas inside quotes, quotes inside quotes, line breaks inside quotes.
- Windows line endings, a blank last line, short rows, empty files.
- A hidden marker at the start of a file (a "BOM").
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

There is also a small **optional** check of the three live web addresses. It opens them signed out and confirms they are up. It runs on Mondays and on the button. It never blocks anything, because GitHub Pages can have a slow day.

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

It takes about 40 seconds.

## If something goes red

1. Open the failed run in the Actions tab.
2. Read the table at the top. It names the page.
3. Download **playwright-report** at the bottom. It has a screenshot and a replay of each failure.
4. Send the link to your builder. It is not urgent unless it is the Money Hub or the Bin.

## What is not covered (honest list)

- The real Google consent screen.
- Real Drive speed, limits and permissions.
- Phone-sized screens (the tests use a desktop-sized window).
- Whether the numbers in your real files are right. That is the job of the Control page in the Money Hub.
- The "Rename" and "Move to bin" steps of PC-Personal, and the Drive check page (they use local files).

## Where things live

| What | Where |
|---|---|
| The tests | `tests/mocked/` |
| The pretend Google and Drive | `tests/support/` |
| The invented sample files | `tests/fixtures/` |
| The robot's schedule | `.github/workflows/tests.yml` |
| Settings | `playwright.config.js`, `package.json` |

Nothing in the dashboard pages themselves was changed to add these tests.
