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
| next | Lisa answers AA_JOB4_SLIP_02; practice run on real Google; merge when happy | waiting on Lisa |
