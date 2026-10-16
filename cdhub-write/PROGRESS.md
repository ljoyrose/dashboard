# PROGRESS - Job 4, CD Hub write path (Bloodline)

UK time, newest last. (This is Job 4's file. Job 2 has its own PROGRESS.md in Drive; it is not touched.)

| Time (UK) | Step | State |
|---|---|---|
| 15 Oct 22:20 | Read inventory, gap doc, slip, naming protocol, brief, manifest, old hub round code | done |
| 15 Oct 22:30 | Confirmed the `area_reading` design in bld-schema.js; read the live headers | done |
| 15 Oct 22:50 | Apps Script write sink (9 files + approval page) | done |
| 15 Oct 23:25 | Browser module, bands, screens, CSS; headless browser checks | done |
| 15 Oct 23:40 | Bloodline patch (checked in a browser); standalone test page | done |
| 15 Oct 23:55 | Docs: SETUP, design note, MAP note, options, Q&A rows | done |
| 15 Oct 23:58 | PR #10 opened (branch claude/job4-cdhub-write-path) | done |
| 16 Oct 00:20 | Fix-up 1: `appsscript.json` and `package.json` were being ignored by the repo's `*.json` rule and were missing from the PR; now committed (`.gitignore` negation) | done |
| 16 Oct 00:25 | Fix-up 2: screen tests can no longer be skipped (jsdom required); 5 new Bloodline-wiring tests; all tests pass, 0 skipped | done |
| 16 Oct 00:30 | Fix-up 3: allow-list narrowed to two files; round_event and staff moved to a PROPOSED list that is refused | done |
| 16 Oct 00:35 | Fix-up 4: whole-file rewrite checked by hash, exact restore on failure, logged in the waiting list; optional daily backup (off) | done |
| 16 Oct 00:45 | Fix-up 5: SETUP.md made identical in repo and Drive (steps fixed); MAP note, options note, this file added; zip rebuilt | done |
| 16 Oct 01:20 | v2 follow-up read: inputs from Drive (BLD-occupancy, subject_status, field_visibility, table_policy, checklist tables, The Board and its spec) | done |
| 16 Oct 01:50 | v2: occupancy on the allow-list behind its own switch; append-only moves; `occupancy_check` proposed; `round_event` retired; temperatures straight in; "approvals queue" rename | done |
| 16 Oct 02:20 | v2: code-gated read action, default deny, from BLD-field_visibility.csv; proposed permission rows | done |
| 16 Oct 02:40 | v2: owner-only edit in place (Lisa's change to item 5), off by default, lock + hash check kept | done |
| 16 Oct 03:10 | v2: "Where is everyone?" screen in The Board's look; Bloodline patch (3 stages); screenshot check | done |
| 16 Oct 03:40 | v2: SETUP, MAP, options, design note, README, HANDOVER, PROGRESS, slip AA_JOB4_SLIP_02; zip rebuilt | done |
| 16 Oct (v3) | Gate passed: go word is `qssend` (S6.2 + Shorthand-Command-System.md); Lisa's answers to slip 02 read (AA_JOB4_SLIP_02_ANSWERS.md) | done |
| 16 Oct (v3) | Step 1: staff read rows fv-p018..p024 removed (42 of 49 kept), tp-p01 read = "owner (all)", staff correction path removed from the screens, CRLF kept; tests added | done |
| 16 Oct (v3) | Steps 2, 2b: per-person override rows (audience person:<code id>), owner revoke of staff codes (appended note in the approvals queue file, never deletes) | done |
| 16 Oct (v3) | Step 3: owner edit stays OFF by default (test) | done |
| 16 Oct (v3) | Step 4: BLD-occupancy_check.csv on the allow-list behind its own OFF switch; screen = Moved per dog + ONE "All the rest unmoved"; tested with 150 dogs | done |
| 16 Oct (v3) | Step 5: moves queue until MOVES_QUEUE_UNTIL (14 days from go-live), then straight in; tested both sides of the date | done |
| 16 Oct (v3) | Step 6: deceased + permanent kinds dropped from the daily check; off_site_temp shown as Away, keeps its room | done |
| 16 Oct (v3) | Step 7: tools/backfill-rooms.js (new rows only, never edits) + tests | done |
| 16 Oct (v3) | Step 9: patch checked with `git apply --check` (test); package.json present | done |
| next | Steps 8 and 10: PRACTICE-RUN.md, docs, slip AA_JOB4_SLIP_03.md, zip, PR description | in progress |
