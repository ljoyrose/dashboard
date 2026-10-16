# HANDOVER - Job 4, CD Hub write path, v2 (follow-up of 16 Oct 2026)

Written 16 Oct 2026 by claude-job4. Replaces the v1 handover (kept in `JOB4_CDHUB-WRITEPATH_v1`).

## State

- **Built and tested on FAKE data: 105 tests pass, 0 skipped** (`npm install && npm test`).
- **Nothing is on.** No Script URL, no switches, no file created on Drive, no live CSV touched. Saving, staff reading and owner edit are all OFF.
- **Not run on real Google.** First real run = Lisa's practice folder (SETUP step 8). Browser-to-Apps-Script (CORS), the Board fonts loading inside Bloodline, the read action and the owner edit were only tried against a fake Drive. All **UNVERIFIED**.
- PR #10 (open, not merged): https://github.com/ljoyrose/dashboard/pull/10 (branch `claude/job4-cdhub-write-path`, path `cdhub-write/`, see the PR for the latest commit).

## What v2 added (Lisa's follow-up brief)

1. **Daily location check, "Where is everyone?"**, in Bloodline, in The Board's look. Lists each dog on site, pre-filled with its last recorded room. Staff tap **Same** or **Moved** and pick a room.
2. **Occupancy is append-only.** A move adds a new `BLD-occupancy.csv` row (`subject_id`, `area_id`, `moved_in` = today). Never edits `moved_out`. Current room = latest `moved_in`. `BLD-occupancy.csv` is on the allow-list behind `TABLE_ON_occupancy`, off.
3. **`BLD-occupancy_check.csv` proposed** (on the proposed list, refused). `round_event` retired (kept, refused). Alternative (existing checklist item `cti-round-02`) is in the options note.
4. **Staff read by personal code**, no Google sign-in: a code-gated read action, default deny, driven by `BLD-field_visibility.csv`. Checked against the live files: **columns fit the existing file as is; row limits need three small row-rule words** (see MAP note section 7). `BLD-table_policy.csv` is free text, not used. Proposed rows supplied (49 + 2).
5. **Corrections** stay as new rows with `corrects_id`. **Temperatures go straight in**; corrections wait in the **approvals queue** (renamed from "waiting list" everywhere).
6. **Owner edit (Lisa's change to item 5):** her Google account only, owner page only, overwrites an entry in place, **no record kept**, off by default, same lock and hash check as staff saves. Consequences are in SETUP section G and the options note O15.
7. SETUP, MAP note, options note, design note (section 10), README, PROGRESS updated; slip `AA_JOB4_SLIP_02.md` written.

## Links and where the files are

- **This folder (`JOB4_CDHUB-WRITEPATH_v2`, inside Drive folder 1tsjx6AZsXVLP7XUx_N6jwV7LoIIhvaT5)** holds the package unzipped: `docs/`, `code/` (`apps-script/`, `client/`, `screens/`, `wired/`), `tests/` (with `tests/fixtures/`), `README.md`, `HANDOVER.md`, `PROGRESS.md`, plus `AA_JOB4_SLIP_02.md` (Lisa's questions).
- **In PR #10 only (not uploaded here):** `tests/sink.test.js` (63 KB) and `tests/client.test.js` (43 KB) - too big to paste reliably, handed to the Grok bot (upload by id and verify by size against the PR copy); `package-lock.json` (29 KB of machine-generated checksums; `npm install` recreates it). The `.gitignore` is uploaded as `gitignore.txt`; rename it `.gitignore` when copying out. A screenshot of the new screen is not uploaded (the connector manages text only); the Grok bot can render one: open `code/client/index.html` and press "Use FAKE demo rooms".
- **Known differences from the PR copy (Drive upload limits):** `code/screens/screens.js` is 10 bytes smaller on Drive (the connector converts `\u` escapes; same behaviour), and `code/wired/bloodline-wiring.patch` on Drive may have lost whitespace-only lines and tabs (use the PR copy, or apply with `patch -l`; the patch test needs the PR copy). Fixture CSVs in `tests/fixtures/` are LF-only here; `npm run fixtures` regenerates them.
- To run the tests from these files: copy the folder out of Drive, keep the layout, add `package-lock.json` if wanted, `npm install && npm test`.

## For the Grok bot (suggested hand-offs, nothing here is blocked on them)

- Upload `tests/sink.test.js` and `tests/client.test.js` from the PR into `tests/` of this folder (parent id 1Q6MOofW4WNNidYalU6L3tZBtrwx2EU-K) and verify sizes (63488 and about 43 KB).
- Verify every uploaded file by size against the PR copy (`gh api` or the zip), and upload `package-lock.json`.
- Run `npm install && npm test` from the Drive copy and report.
- Run the practice run (SETUP section D) in a copied folder if Lisa answers `S02-8 A`.
- If Lisa answers `S02-6 B`: back-fill the 134 blank `area_id` rows from her register (one-off, to a copy first).

## Lisa's questions

`AA_JOB4_SLIP_02.md` (8 rows, exact reply words, one blocking: S02-3, staff reading permissions). Earlier rows are in `TT_BLD-QA_job4-rows.md` in the v1 folder; they are not repeated.

## Ids used

Inventory 1YvjtzRCfj0icgZEekCM6-imwKRKiFlZNKNW4Nyu7AvY; slip (v1) 1AvF3D4GuWOdaGiIel52LMf_g9YtEOgPP; protocol 1rr-gvb17U8tfBMePnWRTMJYI_n2NjvXo; tables folder 10m8HauOLAdj2QStgNJ2T3b3W599VXWro; output folder 1tsjx6AZsXVLP7XUx_N6jwV7LoIIhvaT5; The Board 15pawTZjvkpHfN-O-P-cRJYlYCj-rNYtP; Board vision 1A9hgBD3S7pvLWoYTHqwx-QBdc96bsWUKbXcd-IPOIMU.

## Facts found this time (not in the v1 handover)

- `BLD-occupancy.csv` columns: `id,tenant_id,subject_id,area_id,off_site_kind,moved_in,moved_out,classification,classification_note`. `off_site_kind` values seen: `sold`, `owned_by_family`; `classification` `Collected` marks collected dogs. Most rows have no `area_id` or `moved_in`.
- `BLD-field_visibility.csv` has audience `aud-staff` rows only for `person` fields; nothing for subject, area, occupancy, subject_status, area_reading.
- `BLD-table_policy.csv` has area, occupancy, subject, subject_status as "staff" read/write (free text); no rows for `area_reading` or `occupancy_check`.
- `BLD-checklist_template_item.csv` item `cti-round-02` = "Check every dog is in its recorded cabin" (tick, staff). `BLD-checklist_item.csv` and `BLD-checklist_instance.csv` are header-only.
- Fixed this time: the temperature-band lookup counted a dog in two rooms after a move (now uses the latest row only; test added).
- A v1 QA file was renamed with an `SS_` prefix in the v1 folder (superseded, not deleted).
- Bloodline is still not connected to Drive: staff load the lists through the script with their code; Lisa's Drive route still works through `BLDWire.provide(BLDLookups.fromTables(...))`.

## Not done

Open-Meteo outdoor temperature, data-health script, humidity/clean/check readings, staff hours, saving to the daily check log or roster (proposed only), any live CSV change, back-filling the blank `area_id`s.

## Next

1. Lisa answers `AA_JOB4_SLIP_02.md`.
2. Practice run in a copied folder; fix anything real Google shows.
3. Merge PR #10 when happy.

## Naming

Docs follow `AA_<date>_<stem>__<author>`; SETUP, README, HANDOVER, PROGRESS keep their asked-for names; the slip is `AA_JOB4_SLIP_02.md` as asked. Superseded Drive copies are renamed `SS_`, never deleted.
