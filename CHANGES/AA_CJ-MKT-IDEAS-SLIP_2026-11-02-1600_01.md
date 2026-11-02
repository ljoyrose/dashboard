# AA_CJ-MKT-IDEAS-SLIP 2026-11-02 1600 (v2 job, stage 1 of 4)

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
