# Design note: CD Hub write path (Job 4)

Written 15 Oct 2026 (Europe/London) by claude-job4; fix-up applied the same night after Lisa's review. UK English. Status: built and tested on FAKE data; **nothing live, nothing on**.

**Fix-up changes (Lisa's review):** CD Hub is Bloodline, so the Bloodline wiring is the one that matters and The Board drop-in is parked (kept, not used). The default allow-list is now only two files. The whole-file rewrite is checked by hash and restored if it fails. An optional daily backup was added.

## 1. What was built

| Piece | Where | State |
|---|---|---|
| Append-only write sink (Google Apps Script web app) | `apps-script/` | Built, tested. **OFF** (needs `SAVE_ENABLED=true`) |
| Owner approval page (pending to approved) | `ApprovePage.html`, `Web.gs` | Built. Only works once Lisa deploys it |
| Browser save module (`BLDSave`) | `code/client/bld-save.js` | Built. **OFF** with no Script URL |
| Room temperature screen; staff roster screen (proposal, refused until agreed) | `screens/` | Built, honest empty states |
| Band and action logic (ported from the live hub's round) | `code/client/bands.js` | Built, tested |
| Standalone test page | `code/client/index.html` | Built, checked in a headless browser |
| Bloodline wiring (patch + script): two new stages, "Enter temperatures" and "Staff input" | `wired/bloodline-*` | Built, tested, checked in a headless browser |
| Board drop-in | `wired/board-dropin.js` | **Parked** (kept, not used, not part of this PR's aim) |
| Optional daily backup copy | `Admin.gs` | Built, tested, **OFF** |

The write path does not depend on the look: the screens only call `BLDSave.submit`. Bloodline is wired; see section 8.

## 2. How one save travels

1. Staff open a screen. The banner says whether saving is on (the page asks the script, which answers with switches only, no data).
2. Staff type a code and two numbers and press Save. The page checks the numbers instantly (for speed only).
3. The page sends **one** POST to the Script URL. The body holds the table key, the numbers and the staff code. The page never sends a file name.
4. The script checks, in this order: saving on, request shape, staff code, table is on the allow-list, table switched on, role allowed, repeat of an earlier request, then (under a lock) file exists, header matches, ids exist in the lookup tables, field rules, duplicate guard.
5. It then either appends one line (direct) or appends one "queued" line to `BLD-_pending.csv` (pending). **Corrections are always pending.**
6. Lisa opens the approval page. Approve adds one line to the real table and logs it. Reject adds nothing and logs it.

## 3. What "append-only" really means on Drive (and the consequence)

Drive has no true "add a line". The script reads the whole file, adds one line, writes the whole file back. So the file *is* rewritten in the technical sense; the **content** only ever grows. Safeguards, all tested:

- Refuses unless the header line is exactly what it expects.
- Just before writing it reads the file again and compares a **hash** (a fingerprint of the whole text) with the one from its first read, so an edit of the **same length** is caught too, not only a size change.
- After writing it reads back and checks the fingerprint of the result and that every old byte is still there.
- **If that check fails**, it writes the **exact old text back**, checks the old fingerprint again, and tells the person whether the restore worked. It also adds a `write_check_failed` line to `BLD-_pending.csv` (or `apply_failed` if it happened while approving). If the restore cannot be confirmed the message says "Tell Lisa now".
- Every write is covered by a test that proves the new text starts with the old text. Drive also keeps the previous version in the file history.

**Consequence:** the checks cover almost everything but not a hand edit that lands in the few milliseconds between the script's last read and its write. **Staff (and Lisa) must not hand-edit `BLD-area_reading.csv` or `BLD-_pending.csv` in Drive**; corrections go through the screen. An **optional daily backup copy** (`adminInstallDailyBackup`, off unless `BACKUP_ON=true`) puts a dated `.bak` copy in a `BLD-backups` sub-folder each night; it never deletes anything, so tidying old copies is Lisa's call.

The pending list is itself append-only: it is an event log (`queued`, `approved`, `applied`, `rejected`, `apply_failed`). The state of an item is the last event for it. Nothing in it is ever edited.

## 4. Safety rails

- **Allow-list:** two file names only (`BLD-area_reading.csv` and `BLD-_pending.csv`). The low-level writer checks the list again on its own. Lookup tables (`BLD-area`, `BLD-subject`, `BLD-person`) are only ever read. `round_event` (cabin placement) and `staff` (roster) are kept in the code in a separate **PROPOSED** list; they are not on the allow-list, so the script refuses them whatever switches are set. Agreeing one later is a one-line code change (move it into the main list) plus its own switch.
- **Three switches:** `SAVE_ENABLED` (everything), `TABLE_ON_area_reading` (the log), `MODE_area_reading` (direct or pending, default pending).
- **Never creates files** while saving. Creating the two new files is a separate action Lisa runs from the editor (`adminCreateEmptyTables`), guarded by `ALLOW_CREATE`.
- **Duplicate guard:** same room within 30 minutes is refused ("send a correction instead"). A repeated request id returns the first answer (a retry on a flaky phone cannot double-save).
- **Text safety:** text fields cannot start with `= + - @` (spreadsheet formula injection). Unknown fields are refused, so a browser cannot set `taken_by`, `id` or `tenant_id`.
- **Honest failure:** every refusal is a plain sentence. An unexpected crash says "it may or may not have saved, check before trying again".

## 5. Who is saving: staff code

Each person gets a code. The script stores only a salted one-way hash, never the code. `taken_by` holds the person's label (for example "Sam"). Wrong codes are counted: 25 in 10 minutes pauses saving for **everyone** for the rest of that window.

- **Consequence 1:** an attacker who spams wrong codes can pause saving for ten minutes (a nuisance, not a breach). Chosen deliberately: pausing beats guessing. Codes are 10 characters from a 31-letter alphabet, about 50 bits.
- **Consequence 2:** the code travels in the request body over HTTPS, not in the web address, so it does not appear in logs.
- **Consequence 3:** codes are not tied to a Google login. A shared or leaked code looks like that person. Revoke with `adminRevokeStaff`.
- The owner's approvals use a real Google sign-in (second deployment, "Only myself") and are recorded with the Google address.

## 6. Where the Script URL lives

The repo is public, so the URL is never in it. Two ways, both built:

- **Paste on the device** ("Turn saving on" box): kept on that device only.
- **Drive config file** `BLD-_save-config.json` in the BLD folder (`{"saving":"on","scriptUrl":"..."}`): every signed-in device picks it up using the read-only sign-in it already has. The page accepts only addresses that start `https://script.google.com/macros/s/` and end `/exec`, so a tampered file cannot send staff codes to another site.

## 7. Limits and things not checked (UNVERIFIED)

1. **Not run against real Google.** The Apps Script runs here only in a faithful fake of Drive, properties, cache and lock. The first real run is Lisa's practice folder (SETUP step 8). **UNVERIFIED on live Drive.**
2. **Browser to Apps Script (CORS).** The module sends `text/plain` and follows the redirect, which is the usual way a static page talks to an Apps Script web app. I did not test this against a real deployment. **UNVERIFIED.**
3. `taken_at` is the time the **script** received the save, not the time on the thermometer (see Options 6).
4. `subject.dob` is used for bands because the live hub reads `d.dob`; I did not open `BLD-subject.csv`'s header myself.
5. `reading_type` accepts only `temperature` (humidity, clean and check have different meanings for min and max; not wired).
6. The three computed columns (`in_range`, `compliant`, `mitigation_required`) and `applied_limit_id` are written blank. The app must work them out when reading.
7. **The Board mock's colours** were copied by eye from the mock; not diffed.
8. The live `Live feed` claim (40 here / 7 under 6 months) and the 105 unresolved references were not touched by this job.

## 8. Wiring

- **Bloodline** (`wired/bloodline-wiring.patch` + `bloodline-wire.js`): adds two stages, "Enter temperatures" and "Staff input". The patch only adds lines (plus one existing line re-written to add two entries) and a test checks that. Bloodline has no Drive link yet, so both start with "No rooms are loaded". When the redesign lifts the CD Hub sign-in and CSV reading, call `BLDWire.provide(BLDLookups.fromTables(T, todayIso))` and they fill in. "Staff input" shows "only a proposal" until the roster table is agreed.
- **The Board:** parked. `wired/board-dropin.js` is kept but not used and not part of this fix-up.
- **Old `/cdhub/`:** untouched. The PR adds a new path (`cdhub-write/`).

## 9. Not built (on purpose)

Occupancy writes, outdoor temperature (Open-Meteo), the data-health script, humidity/clean/check readings, hours for part-time staff (not in the `staff` design table), a Google Forms front end, saving to the placement log or roster (proposed only), and any change to a live CSV.
