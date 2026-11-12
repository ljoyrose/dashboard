# CONTINUE_PROMPT: JOB BB-FIN.1 2 (Breed Better page polish)

Repo ljoyrose/dashboard (PUBLIC: code and invented test data only). Base your branch on main after #491 merges
(or on claude/youthful-gates-6b4jct if it has not). Line edits only; one PR per theme; never remove the Testing label;
never write to a live table. Run tools/privacy-guard on every staged diff.

Fix these seven gaps from the audit (GAPS.csv rows with fix = "successor BB-FIN.1 2"):

1. Dated score on screen: `breed-better/hub-view.js` never shows the scoring date (score() returns as_of). Show
   "Scored on 12 Nov 2026" (use day()) under the Breed Better heading and on one animal's page. Add a test.
2. Empty filter/search: `hub-view.js` rowsHtml shows only "None." Say what is empty, e.g. "No dogs are Fail." or
   "No dog matches 'xyz'." Add a test.
3. Inspector words: `cdhub/staff/inspect/inspect.js` words() turns column names into labels (e.g. "Result as reported").
   Add a small label map for the columns the save script can share; keep the fallback. Extend tests/breed-better/inspect.test.js.
4. Phone: add a mocked Playwright test that #/breed (list and one dog) has no sideways scroll at 360px.
5. Keyboard: add a test that Tab moves search -> sort -> filters -> first dog row on #/breed in that order.
6. House look: `hub-view.js` CSS around lines 194-210 uses font-weight 500; house is Lexend 400/600 only. Change to 600.
7. House look: `.bb-band summary` (section headers) needs the hover/tap pale grey fill, no outline, 12px corners (PR #408 rule).

Done when: all Breed Better node + Playwright suites green, each fix has a test, PRs open and green, slip numbered from
AA_BB-FINISH_2026-11-12-2015_03.md in the CHANGES folder.
