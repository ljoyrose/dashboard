# Save inventory: every save the script can make, and how to switch each one on

*15 Nov 2026. For Lisa: "ascertain everything which is saving off and get all saving on". Nothing here changes a live switch. The table below is made from the code (`node tools/save-inventory.js --write <this file>`), and a test fails if it goes out of date.*

## In short

| Item | Status | Your action |
|---|---|---|
| Saves that are ON live | 19 tables (temperatures, checks, rooms, rules) | None |
| Saves that are OFF live | readings, items, item kinds, dog details, the 5 puppy-enquiry tables | Switch on in the order below |
| Saves not shown in the live status | weighing, vaccination, new dog, dog links, files, links, dog photo, code list | Read them with the new status (Deploy steps, step 2) |
| Waiting rows | about 42 expected | Run `adminCountQueued` (it changes nothing) |
| Save address on a new phone | `BLD-save-webapp.json` missing from BLD-app-tables | Create it (see "Save address on a new phone") |
| Risks found | 5 (R1 to R5) | Read before switching on dog photo and before relying on approving a dog leaving |

## The inventory

LIVE is what the deployed script's status said on 15 Nov 2026 (version 1.2.0, SAVE_ENABLED true, READ_ENABLED true, proposed: staff). An earlier audit (repo at 97331d7) listed check_log and some other tables as off; live says ON, as below. "unknown (not in status)" means the old status did not report that switch; the new `?status=1` does.

Every save also needs `SAVE_ENABLED` = `true`. Each switch is a Script Property set to the word `true`; anything else is off.

<!-- inventory:start (made by tools/save-inventory.js; do not edit by hand) -->
| Action / table key | Kind | Switch | Default in repo | LIVE 15 Nov 2026 | Writes to | Master table? | Needs | Mode | Who may | Risk note |
|---|---|---|---|---|---|---|---|---|---|---|
| area_reading | table (action add) | TABLE_ON_area_reading; MODE_area_reading | off | ON | BLD-area_reading.csv; corrections to BLD-_pending.csv | no | header 23 cols; reads BLD-area.csv, BLD-thermometer.csv | direct | OWNER, STAFF, VET, TRAINER | Append-only log; corrections always queue. |
| guest_reading | table (action add) | TABLE_ON_guest_reading; MODE_guest_reading | off | ON | BLD-guest_reading.csv | no | header 14 cols; reads BLD-area.csv | direct | GUEST | Visitor codes only; never touches the staff log. |
| sensor_reading | table (action add) | TABLE_ON_sensor_reading; MODE_sensor_reading | off | ON | BLD-sensor_reading.csv | no | header 11 cols; reads BLD-area.csv | direct | OWNER | Owner import of sensor days. |
| thermometer | table (action add) | TABLE_ON_thermometer; MODE_thermometer | off | ON | BLD-thermometer.csv | no | header 6 cols; reads BLD-area.csv | direct | OWNER | Owner list; owner edit can change a row in place. |
| requirement | table (action add) | TABLE_ON_requirement; MODE_requirement | off | ON | BLD-requirement.csv | no | header 10 cols | direct | OWNER | Owner rows with dates. |
| area_link | table (action add) | TABLE_ON_area_link; MODE_area_link | off | ON | BLD-area_link.csv | no | header 9 cols; reads BLD-area.csv | direct | OWNER | Owner rows with dates; changes which readings count for a room. |
| check_type | table (action add) | TABLE_ON_check_type; MODE_check_type | off | ON | BLD-check_type.csv | no | header 29 cols | direct | OWNER | Owner rule rows; changes what staff see as jobs. |
| check_field | table (action add) | TABLE_ON_check_field; MODE_check_field | off | ON | BLD-check_field.csv | no | header 17 cols; reads BLD-check_type.csv | direct | OWNER | Owner rule rows; changes the questions on a job. |
| check_value | table (action add) | TABLE_ON_check_value; MODE_check_value | off | ON | BLD-check_value.csv | no | header 6 cols; check_field rows; TABLE_ON_check_log | direct | (none: written by check_log) | Only written inside a check_log save (its own perms are empty); needs check_log on too. |
| check_log | table (action add) | TABLE_ON_check_log; MODE_check_log | off | ON | BLD-check_log.csv; corrections to BLD-_pending.csv | no | header 19 cols; reads BLD-check_type.csv, BLD-area.csv, BLD-subject.csv, BLD-litter.csv, BLD-check_log.csv, BLD-items.csv; check_type rows | direct | OWNER, STAFF | Append-only log; a whole-site tap writes one line per dog in one append. |
| readings | table (action add) | TABLE_ON_readings; MODE_readings | off | off | BLD-readings.csv | no | header 33 cols; reads BLD-reading_kinds.csv, BLD-reading_limits.csv, BLD-check_log.csv, BLD-items.csv, BLD-area.csv, BLD-subject.csv; reading_kinds + reading_limits rows | direct | OWNER, STAFF | Append-only; needs reading_kinds and reading_limits rows. |
| items | table (action add) | TABLE_ON_items; MODE_items | off | off | BLD-items.csv | no | header 16 cols; reads BLD-item_kinds.csv, BLD-items.csv | direct | OWNER | Owner list of items. |
| item_kinds | table (action add) | TABLE_ON_item_kinds; MODE_item_kinds | off | off | BLD-item_kinds.csv | no | header 7 cols | direct | OWNER | Owner list of item kinds. |
| occupancy | table (action add) | TABLE_ON_occupancy | off | ON | BLD-occupancy.csv | no | header 9 cols; reads BLD-area.csv, BLD-subject.csv | direct (forced) | OWNER, STAFF | Room moves; always direct (MODE_occupancy and MOVES_QUEUE_UNTIL are ignored). |
| occupancy_out | table (action add) | TABLE_ON_occupancy_out; MODE_occupancy_out | off | ON | BLD-_pending.csv (queue), then BLD-occupancy.csv on approve | no | header 9 cols; reads BLD-subject.csv | pending | OWNER, STAFF | Queued until the owner approves; never applied by a plain GET or a save (Risks found, R2, fixed). |
| area_access | table (action add) | TABLE_ON_area_access; MODE_area_access | off | ON | BLD-area_access.csv | no | header 8 cols; reads BLD-area.csv | direct | OWNER, STAFF | Flap free/limited. |
| qr_tag | table (action add) | TABLE_ON_qr_tag; MODE_qr_tag | off | ON | BLD-qr_tag.csv | no | header 8 cols | direct | OWNER | Owner list of QR tags. |
| occupancy_check | table (action add) | TABLE_ON_occupancy_check; MODE_occupancy_check | off | ON | BLD-occupancy_check.csv | no | header 7 cols; reads BLD-subject.csv | direct | OWNER, STAFF | Append-only daily check. |
| breeding_rule | table (action add) | TABLE_ON_breeding_rule; MODE_breeding_rule | off | ON | BLD-breeding_rule.csv | no | header 10 cols | direct | OWNER | The one rule list: link kinds, file types and who-may rows live here, so a bad row widens or narrows other saves. |
| person | table (action add) | TABLE_ON_person; MODE_person | off | off | BLD-_pending.csv (queue), then BLD-person.csv on approve | yes (enquiries) | header 4 cols | pending | OWNER | Puppy enquiries. The hub button also needs config cdhub.enquiriesWrites (false in repo). |
| household | table (action add) | TABLE_ON_household; MODE_household | off | off | BLD-_pending.csv (queue), then BLD-household.csv on approve | yes (enquiries) | header 5 cols; reads BLD-person.csv | pending | OWNER | Puppy enquiries. The hub button also needs config cdhub.enquiriesWrites (false in repo). |
| household_member | table (action add) | TABLE_ON_household_member; MODE_household_member | off | off | BLD-_pending.csv (queue), then BLD-household_member.csv on approve | yes (enquiries) | header 4 cols; reads BLD-household.csv, BLD-person.csv | pending | OWNER | Puppy enquiries. The hub button also needs config cdhub.enquiriesWrites (false in repo). |
| subject_owner | table (action add) | TABLE_ON_subject_owner; MODE_subject_owner | off | off | BLD-_pending.csv (queue), then BLD-subject_owner.csv on approve | yes (enquiries) | header 6 cols; reads BLD-subject.csv, BLD-person.csv, BLD-household.csv | pending | OWNER | Puppy enquiries. The hub button also needs config cdhub.enquiriesWrites (false in repo). |
| sale | table (action add) | TABLE_ON_sale; MODE_sale | off | off | BLD-_pending.csv (queue), then BLD-sale.csv on approve | yes (enquiries) | header 9 cols; reads BLD-subject.csv, BLD-person.csv, BLD-household.csv | pending | OWNER | Puppy enquiries. The hub button also needs config cdhub.enquiriesWrites (false in repo). |
| weighing | action weighing | TABLE_ON_weighing | off | unknown (not in status) | BLD-weight.csv | no | header id, subject_id, performed_on, weight_kg; reads BLD-subject | direct | OWNER, STAFF | Append-only. |
| vaccination | action vaccination, vaccination_void | TABLE_ON_vaccination | off | unknown (not in status) | BLD-vaccination.csv | no | header id, subject_id, given_on, product (+ voided_on, voided_by for void) | direct | OWNER, STAFF | Append; vaccination_void fills voided_on/voided_by on the newest row (never deletes). |
| dog_details | action dog_details | TABLE_ON_dog_details | off | off (POST got TABLE_OFF) | BLD-subject.csv (row in place), BLD-microchip.csv | yes | header id, name, sex, dob; BLD-microchip (id, subject_id, chip_number); BLD-coat_colour | direct | OWNER | Overwrites the dog row (name, sex, DOB, colour, neuter) and the microchip row IN PLACE; no old value kept. |
| subject_create | action subject_create | TABLE_ON_subject_create | off | unknown (not in status) | BLD-subject.csv, BLD-subject_status.csv, BLD-microchip.csv (if chip) | yes | header id, name, sex, dob, species, kind, source; BLD-species rows; BLD-subject_status file; BLD-microchip if a chip | direct | OWNER | Adds a dog: subject + subject_status (+ microchip). Same name + DOB of an active dog refused. |
| subject_link | action subject_link, subject_link_end | TABLE_ON_subject_link | off | unknown (not in status) | BLD-subject_link.csv | yes | link_kind.<kind> rows in BLD-breeding_rule; header 11 cols | direct | OWNER | BFFs / Fren.; subject_link_end fills to_date only. |
| files | action file_add | TABLE_ON_files | off | unknown (not in status) | BLD-files.csv + bytes in the FILES_FOLDER_ID folder | yes | FILES_FOLDER_ID (photo/upload); file.types + file.max_bytes rows; header 15 cols | direct | OWNER; a file.who_may row widens | Stores bytes in the FILES_FOLDER_ID folder plus one row; link rows need no folder. |
| links | action link_add, link_end | TABLE_ON_links | off | unknown (not in status) | BLD-links.csv | yes | link_kind.<role> rows (+ .from_tables/.to_tables/.max_per_from/.who_may); header 16 cols | direct | OWNER; link_kind.<role>.who_may widens | max_per_from can end older open rows in the same save. |
| dog_photo | action dog_photo | none (SAVE_ENABLED + DOG_PHOTOS_FOLDER_ID) | off (folder id missing) | unknown (not in status) | BLD-subject.csv photo cell + picture in the DOG_PHOTOS_FOLDER_ID folder | yes | DOG_PHOTOS_FOLDER_ID; photo column in BLD-subject | direct | OWNER, STAFF | No TABLE_ON switch (Risks found, R1). Overwrites the photo cell of the dog row. |
| code_register | owner page: issue / rename / reset / revoke code | TABLE_ON_code_register | off | unknown (not in status) | BLD-code_register.csv; note in BLD-_pending.csv; STAFF_REGISTRY property | yes | header id, tenant_id, code_id, who, role, from_date, to_date, ended_by | direct | owner (Google account in ADMIN_EMAILS) | Owner page only (Google sign-in). Codes still work while off; the reply says mirrored:false. |
| staff | proposed table | TABLE_ON_staff (no effect until moved into TABLES) | off | off (proposed: refused) | BLD-staff.csv (refused today) | yes | file absent on Drive; header 8 cols | pending (always) | OWNER | Proposed: refused whatever its switch says. Behind TABLE_ON_staff (off) once moved into TABLES. |
| owner_edit | owner page: edit in place | OWNER_EDIT_ENABLED | off | unknown (not in status) | tables marked ownerEditable: area_reading, thermometer, requirement, area_link, occupancy | yes | owner signed in | in place | owner (Google account) | Overwrites in place; no old value kept by the script. |
| approve | owner page: approve / reject | SAVE_ENABLED and the target table TABLE_ON switch, checked on approve | n/a | n/a | BLD-_pending.csv event + the queued row's file | depends | owner signed in | from queue | owner (Google account) | Refused while saving or the table switch is off (Risks found, R5, fixed). |
| inspector | owner page: inspector links; inspector reads | none (owner page; READ_ENABLED for the reads) | n/a | n/a | BLD-inspect_link.csv, BLD-inspect_link_subject.csv, BLD-inspect_link_field.csv, BLD-inspect_access.csv; STAFF_REGISTRY property | no | INSPECT_PAGE_URL, INSPECT_SCRIPT_ID (not secret) | direct | owner; each inspector read appends to BLD-inspect_access | No TABLE_ON switch (Risks found, R5). A read is refused if its log row cannot be written. |
| backup | adminDailyBackup (timer) | BACKUP_ON | off | unknown (not in status) | copies into BLD-backups/ (never the live files) | no | adminInstallDailyBackup trigger | copy | timer, as the script owner | Copies pile up; never deletes. |
| create_empty | adminCreateEmptyTables (editor Run) | ALLOW_CREATE | off | unknown (not in status) | new header-only files, only if absent | no | edit the TO_CREATE list | create | editor | Set ALLOW_CREATE back afterwards. |
<!-- inventory:end -->

## Risks found

| # | What | Where | Effect | Suggested fix (not in this PR) |
|---|---|---|---|---|
| R1 | Dog photo has no switch of its own | `Photo.gs` `sinkDogPhoto_` checks only `SAVE_ENABLED` and `DOG_PHOTOS_FOLDER_ID` | Photo saves start the moment the folder id is set, and overwrite the photo cell of the dog row | Add `TABLE_ON_dog_photo` (off by default) before setting the folder id |
| R2 | A waiting "dog left" row is applied without approval | `Sink.gs` `applyWaitingOccupancyMoves_` picks waiting rows by `target_file` only; occupancy_out writes the same file as occupancy | While `TABLE_ON_occupancy` is on (it is, live), the next plain GET or any save approves a queued sold / deceased / off-site row as `script:apply-direct-occupancy`. Test: `R2:` in `tests/practice-run.test.js` asserts this current behaviour | Fixed in PR 607: room moves only; a "dog left" row waits for the owner. Test: `R2:` in `tests/practice-run.test.js` |
| R3 | A dog card comment is out of date | `Dogcard.gs` header says every dog card save needs `TABLE_ON_weighing` or `TABLE_ON_vaccination` | Misleading only: each action has its own switch (dog_details, subject_create, subject_link, files) | Correct the comment |
| R4 | Two test files never ran | `tests/enquiries-bld.test.js`, `tests/files.test.js` were missing from `npm test` | Their checks were not run on each change | Fixed in this PR (added to the list) |
| R5 | Some writers have no TABLE_ON switch | Inspector link files (`BLD-inspect_link*`, `BLD-inspect_access`): owner page and inspector reads only. Approve (`sinkDecide_`): does not re-check `SAVE_ENABLED` or the table switch | An approved queue row lands even if its table was switched off after it was queued | Approve fixed in PR 607 (refused while saving or the table switch is off); inspector files left as they are (owner-only) |

## Practice run (node harness only, never live)

`tests/practice-run.test.js` runs every code-signed path in the table with only its own switch on, and checks: (a) the save lands, (b) only in the files listed for it (checksums of every other file unchanged), (c) a staff read with no visibility rows gets nothing, (d) a wrong code and a missing code are refused and nothing is written.

| Path | Practice run | Why not the generic run |
|---|---|---|
| All tables, weighing, vaccination, dog_details, subject_create, subject_link, files, links, dog_photo | Generic run, passes | |
| check_value | Generic run with check_log on as well | It has no add permission of its own; it is written inside a check_log save |
| code_register | Own test, passes | Owner page (Google sign-in, not a code): a not-signed-in call is refused and writes nothing |
| staff | Own test, passes | Proposed: refused even with `TABLE_ON_staff`; if moved into TABLES it is off until that switch |
| owner_edit, approve, inspector, backup, create_empty | Manual | Owner page or editor only, not a code-signed save; covered by their own suites (sink, area-link, inspect-link) |

## Switch-on order

Do one at a time. After each: open the status (Deploy steps, step 2), check the line says `on: true`, save one real entry from the hub, and look at the file. **Rollback for every line: set the same property back to `false`.** Nothing already saved is removed by switching off.

**1. Safest: append-only logs, no master data**

| Order | Save | Script Property to set | Check in status | Before you switch on |
|---|---|---|---|---|
| 1 | Item kinds | `TABLE_ON_item_kinds` = `true` | `tables` item_kinds on | `BLD-item_kinds` has its header |
| 2 | Items | `TABLE_ON_items` = `true` | `tables` items on | Item kinds rows exist |
| 3 | Readings (PAT and other tests) | `TABLE_ON_readings` = `true` | `tables` readings on | `BLD-reading_kinds` and `BLD-reading_limits` rows exist |
| 4 | Weighing | `TABLE_ON_weighing` = `true` | `switches` TABLE_ON_weighing on | `BLD-weight` has its header |
| 5 | Vaccination (and remove newest) | `TABLE_ON_vaccination` = `true` | `switches` TABLE_ON_vaccination on | `BLD-vaccination` has voided_on, voided_by |

**2. Master tables (a wrong save changes what a record is). Listed separately: switch on only when you want that screen live.**

| Order | Save | Script Property / setting | Check in status | Before you switch on |
|---|---|---|---|---|
| 6 | Dog details (edit name, sex, DOB, colour, chip) | `TABLE_ON_dog_details` = `true` | `switches` TABLE_ON_dog_details on | Overwrites in place, no old value kept: take a copy of `BLD-subject` and `BLD-microchip` first |
| 7 | Add a dog | `TABLE_ON_subject_create` = `true` | `switches` TABLE_ON_subject_create on | `BLD-species` rows; `BLD-subject` has species, kind, source columns |
| 8 | Puppy enquiries | `TABLE_ON_person`, `TABLE_ON_household`, `TABLE_ON_household_member`, `TABLE_ON_subject_owner`, `TABLE_ON_sale` = `true`, then `cdhub.enquiriesWrites: true` in `config.js` (a code change) | `tables` each on, mode pending | The five files exist with headers; every row waits for your approval |
| 9 | Dog photo | `DOG_PHOTOS_FOLDER_ID` = the Shared Drive folder id (R1: this is its only switch) | `switches` DOG_PHOTOS_FOLDER_ID set | Fix R1 first if you want a separate on/off |

**3. Need a folder id or rule rows**

| Order | Save | Script Property to set | Check in status | Before you switch on |
|---|---|---|---|---|
| 10 | Dog links (BFFs / Fren.) | `TABLE_ON_subject_link` = `true` | `switches` TABLE_ON_subject_link on | `link_kind.bff` (etc.) rows in `BLD-breeding_rule` |
| 11 | Record links (photos, gallery, main) | `TABLE_ON_links` = `true` | `switches` TABLE_ON_links on | `link_kind.<role>` rows (+ who_may) |
| 12 | Files and photos store | `FILES_FOLDER_ID` = folder id, then `TABLE_ON_files` = `true` | `switches` FILES_FOLDER_ID set, TABLE_ON_files on | `file.types` and `file.max_bytes` rows |
| 13 | Code list mirror | `TABLE_ON_code_register` = `true` | `switches` TABLE_ON_code_register on | `BLD-code_register` has its header |

## Deploy steps

| Step | What | How to check | Rollback |
|---|---|---|---|
| 1 | Load the merged code into the save script, then **Deploy > Manage deployments > edit (pencil) > Version: New version > description "save inventory + status=1" > Deploy**, for each existing deployment. Same web app addresses | The status shows version 1.3.0 and the hub still saves | Manage deployments > edit > pick the previous version |
| 2 | Open the save address with `?status=1` on the end | Shows `sideEffectFree: true` and a `switches` list by name (no values). It applies no waiting move and writes nothing | None needed (read only) |
| 3 | In the editor, Run `adminCountQueued` | Execution log lists waiting rows per file (about 42 expected). Changes nothing | None needed |
| 4 | Keep the practice-run evidence: `npm test` in `cdhub-write` all green, including `practice-run.test.js` | Every path passed in the harness | n/a |
| 5 | Switch on one line from the order above, check it, then the next | `?status=1` line flips to on; one real save lands | Set that property back to `false` |

## Save address on a new phone

`BLD-save-webapp.json` is missing from the live BLD-app-tables folder. The hub reads the save address from it on a phone or browser that has never saved before. PR 604 makes the hub try again after an empty read and keep the address on the device once found, but a brand-new device still needs the file. **Recommendation:** create `BLD-save-webapp.json` in BLD-app-tables containing `{"url": "<the save deployment's /exec address>"}`. Not created by this PR.

## Waiting rows

Waiting rows live in one place the script can see: `BLD-_pending.csv` (an event log; a row waits while its last event is queued, approved or apply_failed). `adminCountQueued` counts them per file and per state without changing anything. Rows still waiting on a phone (saved offline, not yet sent) are on that phone only and cannot be counted from the script.

## BLD schema recommendations

| Item | Why | Your action |
|---|---|---|
| Store the table key on each queue row (or a `kind` value per table) | occupancy and occupancy_out share one file, which caused R2 | Decide when R2 is fixed |
| One switch per write path, named after the action | dog photo has none (R1); vaccination_void shares vaccination's | Agree `TABLE_ON_dog_photo` |
| Create `BLD-staff` only when the staff table is moved out of proposed | It is refused today; no file needed | None now |
| Keep rule-like settings (link kinds, file types, who-may) as dated rows in `BLD-breeding_rule` | Matches "no hard-coded rules"; the status cannot show them, so check the rows before switching links or files on | None |
| `set_by` / `set_on` / `created_at` on every new table | links and files already follow S4.15; older tables vary | Log in the BLD schema file as tables are touched |
