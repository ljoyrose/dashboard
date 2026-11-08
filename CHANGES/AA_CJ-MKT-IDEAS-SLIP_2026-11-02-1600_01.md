# AA_CJ-MKT-IDEAS-SLIP 2026-11-02 1600 (v2 job, stages 1 to 4)

Every step labelled. No AI credits used for mechanical steps.

## Steps
1. SCRIPT: read marketplace/index.html (COLS, TABS, answer()), factory putRequest/sendIdea, tests/contract pattern.
2. SCRIPT: add_repo ljoyrose/marketplace-engine DENIED by the session's permission check. Not worked around. Engine behaviour is therefore UNVERIFIED.
3. AI (design): contract (request file, card detail JSON, intake rules) in docs/marketplace-ideas/CONTRACT.md.
4. SCRIPT: marketplace/ideas.js, invented fixtures (SAMPLE ids), tests/contract/marketplace-ideas.contract.spec.js, expected-ideas.json, registered in tests/mocked/hub-contracts.spec.js, TESTS.md line.
5. SCRIPT: tests: `playwright --project=mocked hub-contracts` 111 pass; CONTRACT_PROVE_RED=1 makes the failure cases fail as intended; `node --test tests/gate/gate.test.mjs` 70 pass; privacy guard run with placeholder DENY term (the DENY rule was a placeholder).
6. SCRIPT: git branch claude/mkt-ideas-1-contract, PR. Not merged.

## Decisions taken (recommended A, no stop)
- D1 Route = one request file (Drive folder), not a hub-side sheet append. Reason: engine owns the tab.
- D2 Field lists live in expected-ideas.json, not headers.js/expected-headers.json: those are column-name files, the idea contract is JSON (same reason Studio/wake use expected-state.json), and make-expected.js regenerates expected-state.json and would drop my entries.
- D3 `ideasRequestsFolderId` goes in config.js (empty). Not added yet (stage 2).

## Open questions (ready-to-paste rows for RR_HO-STEWARD-LIVE.csv)
OQ1,Engine addition A: turn MKT-IDEA-REQ-*.json into an idea card row (tested PR in marketplace-engine),Steward
OQ2,Engine: handle answers Investigate/Go/Maybe/No on section idea (applied_at stamp) and addition B (Go makes NEWPROD card),Steward
OQ3,Create the Drive folder for idea request files and put its id in config.js marketplace.ideasRequestsFolderId,Lisa
OQ4,Sign-in needs the Drive write scope for the Add idea form (same ask as the Factory hub): OK?,Lisa
OQ5,Allow the session to read ljoyrose/marketplace-engine (add_repo was denied) if engine PRs are wanted from a session,Lisa
NEXT,Stage 2 page build (Ideas view under New stock; add form; card page; Go hand-off),SYS-CD

## Update after Lisa's change (Infinity board, not ClickUp)
7. AI (design): ideas follow the Factory PATTERN only (one request file, engine makes the card). Hub card = master; one Infinity item per idea mirrors it, one way. Added `infinity_item` (link, empty until the engine fills it). Factory hub, AF-ENGINE and ClickUp NOT touched; tests check the contract code and the page make no such calls.
8. SCRIPT: amended stage 1 (#246) and stage 2 (#248) with small extra commits (merge, no force-push).
9. GOOGLE/SCRIPT: ONE read-only look at Infinity (GET workspaces, the board, its columns, 3 items). Board exists, 0 items, only column is Name. Nothing written.
10. AI (wording) + SCRIPT: stage 3 PR #252: verbatim prompt, README, worked example (invented), `mergeResult()`; proposal only for waking the investigator (A daily pass recommended, B Infinity automation). Nothing built.
11. SCRIPT: stage 4 tests: empty/error/edge states, undo, keyboard, double send, phone 390px; shared helper tests/support/mkt-ideas-world.js. The Factory idea-form tasks A3/C2 were NOT relied on: every test here is self-contained.
12. SCRIPT: Playwright browser in this container was the wrong version (1243 vs 1248); worked around with a scratch folder of links outside the repo. CI runs the real one.

## Added open questions (rows for RR_HO-STEWARD-LIVE.csv)
OQ6,Infinity board "Marketplace - Product ideas" has only the Name column: add columns Status / Gate / Verdict / Next step / Hub card (Lisa decides; not done by this job),Lisa
OQ7,Engine addition A also creates the Infinity item and writes infinity_item; A2 mirrors changes one way; board id kept in engine Settings only,Steward
OQ8,Engine addition C: read MKT-IDEA-RESULT-*.json and merge the patch (rules in mergeResult()),Steward
OQ9,Confirm the Infinity plan allows an Item created automation (only needed if option B is ever wanted),Lisa
OQ10,Pick how the investigator wakes: A daily pass (recommended) or B Infinity web address,Lisa
OQ11,Merge order: #246 then #248 then #252 then stage 4 PR; each says Do not merge until Lisa OKs it,Lisa

## Final state (2 Nov 2026, evening)
13. All four PRs are MERGED to main by Lisa's side (auto-merge): #246 contract, #248 page, #252 investigator brief, #253 tests. Items 6, 8 and OQ11 above describe them as open; read that as history.
14. What is live on main: the Product ideas page in TEST mode (marketplace.live is false, so every request is marked dry_run), the contract, the investigator prompt/README/example, and the tests. Nothing real is created until the engine side exists and the Drive folder id is set.
15. Page-weight budget for the Marketplace hub was re-baselined twice (221300, then 247600 after main's own change). Lazy-loading the form and card code would shrink it; not done.
16. Still open, unchanged (rows above): OQ1 and OQ7 engine card + board item, OQ2 answers/Go hand-off, OQ3 Drive folder id, OQ4 Drive write scope, OQ6 board columns (Lisa), OQ8 result-file merge, OQ9 Infinity plan check, OQ10 how the investigator wakes (A recommended).

## Update 7 Nov 2026 (after Lisa's pre-approval for Drive and PRs)
17. GOOGLE: made the Drive folder RR_MKT-IDEA-REQUESTS in 00 AI Commons (next to RR_OPEN-WORK). Checked it exists. Its id is in config.js (marketplace.ideasRequestsFolderId). OQ3 is done.
18. SCRIPT (Infinity API, Lisa said yes): added columns to the board "Marketplace - Product ideas": Status, Gate (number), Verdict, Next step, Hub card link (text: Infinity refused a link type), Idea ID (text, added so each item can point back to its hub card). Checked by listing the columns. The board still has 0 items. OQ6 is done.
19. SCRIPT: PR #327 merged: the Product ideas code (list, form, card) now loads only when Ideas is opened. Marketplace first load about 290.6 KB down to 266.6 KB; base budget lowered 247600 to 226000. New tests prove nothing from Ideas loads on the first screen. 545 local tests passed, 0 failed; all CI checks green before merge.
20. Requests are still marked dry_run (marketplace.live is false), so the form can now write its test file into the folder but no card is made until the engine side exists.

## Still open
OQ1/OQ7 engine: make the card plus Infinity item and write infinity_item (Steward; engine repo was not readable to this session, Lisa asked 7 Nov whether to try access again).
OQ2 engine: Go / Maybe / No answers on idea cards and the Go hand-off (Steward).
OQ8 engine: merge the investigator result file (Steward).
OQ9 Infinity plan: does it allow an Item created automation (only needed for wake option B).
OQ10 how the investigator wakes: A daily pass (recommended), B Infinity web address, or C an email like the one Lisa mentioned for Grok (Lisa to say if that exists).
New board column ids are not recorded here; the engine reads them from the board by name.
