# MAP note: design names, Drive names, columns (Job 4)

15 Oct 2026, updated 16 Oct (v2: occupancy writes, round_event retired, staff reading, owner edit; sections 6 and 7; v3: section 8 - Lisa's answers: daily check log built, staff see no past temperatures, per-person rows, code revoke). **Nothing was renamed.** Where the design (Bloodline `bld-schema.js`, 23 Sep) and Drive differ, the Drive name wins and this note links them.

## 1. Table names

| Design table | Drive file | Status | Used by this job |
|---|---|---|---|
| `area` | `BLD-area.csv` | live, 23 rows | read (room list, id check) |
| `area_access` | `BLD-area_access.csv` | live | not used (flap mode is in the proposed round log) |
| `area_capacity` | `BLD-area_capacity.csv` | live | not used |
| `occupancy` | `BLD-occupancy.csv` | live, 137 rows, **134 with blank `area_id`** | read (dogs per room for bands) **and (v2) write target: a move appends a new row; own switch, off** |
| `subject` | `BLD-subject.csv` | live | read (id check, `dob`) |
| `person` | `BLD-person.csv` | live | read (roster person list) |
| `role` | `BLD-role.csv` | live (OWNER, STAFF, VET, TRAINER) | roles for staff codes mirror these |
| `environment_limit` | **`BLD-temperature_band.csv` + `BLD-temperature_action.csv`** | live (2 + 5 rows) | read (band by youngest dog's age; SOP action ladder) |
| `reading_requirement` | none | design only | not built |
| `area_reading` | `BLD-area_reading.csv` | **ABSENT** | **write target** |
| (placement log) | `BLD-round_event.csv` | **RETIRED 16 Oct** (never on Drive) | replaced by `occupancy_check` + the live occupancy table; kept in the code, refused |
| (daily check log) | `BLD-occupancy_check.csv` | **ABSENT, new table made here (v3)** | on the allow-list behind its own OFF switch; Lisa creates the file. Columns in section 8 |
| `staff` | `BLD-staff.csv` | **ABSENT** | **PROPOSED, not on the allow-list**: refused until agreed |
| `staff_training`, `staff_duty`, `staff_competency` | none | design only | not built |
| (approvals queue, was "waiting list") | `BLD-_pending.csv` | **ABSENT, proposed here** | **write target (queue), on the allow-list** |
| `field_visibility` | `BLD-field_visibility.csv` | live, 65 rows, none for staff on the lists below | **read only by the script** (decides what a staff code may read) |
| `table_policy` | `BLD-table_policy.csv` | live, 73 rows | **not used by the script** (see section 7) |
| `subject_status` | `BLD-subject_status.csv` | live | read (a dog whose state is Sold or Collected is not listed) |

## 2. `area_reading` columns

`id` and `tenant_id` are the standard first two columns of every live table (checked on `BLD-occupancy.csv`, `BLD-area.csv`, `BLD-area_access.csv`, `BLD-temperature_band.csv`).

| Column | In design? | Written by | Notes |
|---|---|---|---|
| `id` | standard | script | `rdg-YYYYMMDD-HHMMSS-xxxx` (London time) |
| `tenant_id` | standard | script | from `TENANT_ID` property |
| `area_id` | yes (ref) | staff | must exist in `BLD-area.csv` |
| `reading_type` | yes (enum) | staff | only `temperature` accepted |
| `min_c`, `max_c` | yes decimal(5,2) | staff | kept to 2 dp **exactly as typed** (design: "precision cannot be recovered") |
| `spot_c` | yes | staff (optional) | |
| `precision_dp` | yes | script | always `2` |
| `period_start` | yes | staff (optional) | window the min/max cover; ISO with time zone |
| `taken_at` | yes | script | time the script received it (see Options 6) |
| `taken_by` | yes (ref) | script | staff label; no staff table yet (Options 5) |
| `device_id` | yes | blank | no `device` table on Drive |
| `reset_after_reading` | yes | staff (optional) | |
| `applied_limit_id`, `in_range`, `compliant`, `mitigation_required` | yes (computed) | **blank** | the app computes these when reading |
| `corrects_id` | **PROPOSED** | script | points at the row this one corrects |
| `mitigation_note` | **PROPOSED** | staff | needed by the screen when a reading is outside the band (design: "the app asks for the note then") |

## 3. Old CD Hub "round" to new tables

| Old hub (saving off) | New |
|---|---|
| `ROUND['date__area'].t_am / t_pm {min,max,at}` | one `area_reading` row per reading. **No AM/PM column in the design**: morning or evening is read from `taken_at` |
| `.access` free / limited | **not built** (the round_event idea is retired; flap setting stays in `BLD-area_access.csv`, untouched) |
| `.subjects[]` (who is in the cabin) | (v2) the live `BLD-occupancy.csv`: a move **appends** a row; the daily check log is `BLD-occupancy_check.csv` (v3: one row per "All the rest unmoved" tap) |
| `temp2dp()` rule: `-?\d{1,2}(\.\d{1,2})?`, -30 to 60, kept to 2 dp | same rule, now enforced on the page **and** in the script |
| `bandFor()`: band by the youngest dog's age in days | ported to `bands.js` unchanged |
| `actionFor()`: returns the **first** matching rung | **changed**: returns the **highest** rung reached (a reading of 28.5 shows the 28 action, not the 25 one). Old behaviour was probably unintended; tell me if not |
| `tempVerdict()` low/high | ported unchanged. Note the band file says a reading over 26 "triggers the cooling ladder, it is not automatically a breach"; the screen asks for a note rather than calling it a failure |

## 4. Gaps and honest empty states

- **`occupancy.area_id` blank for 134 of 137 rows:** the screen shows "No band: room unknown" for those rooms and still lets the reading be saved. It does not guess a room.
- **No `BLD-area_reading.csv`:** the script says "does not exist yet, Lisa needs to create it". It never creates it.
- **No `BLD-staff.csv`:** the staff screen says "only a proposal so far" and cannot save.

## 5. Report only, not fixed (as instructed)

- **Two files called `BLD-MAP-animana.csv`** (one 24 Sep 10:22 UTC, one 24 Sep 01:31 UTC; their ids are in the inventory, Addendum A, kept out of this public copy). CD Hub's duplicate-title guard may refuse to load. This job's script uses the same rule for the tables it reads: two files with one name = refuse. Neither of these two is read or written by this job.
- **Google Sheet `BLD-area`** sits beside `BLD-area.csv` (id in the inventory, Addendum A). Different title (no `.csv`), so the script reads the CSV only. If a tool ever matches by prefix it could clash.
- **Retrieved facts not in the inventory:** `BLD-temperature_band.csv` has only two bands (under four weeks 26 to 28 C; four weeks and over 10 to 26 C). Its note says the older 0-10 day / 2-4 week / 5-8 / 9-10 week split was deleted as invented.

## 6. v2: how occupancy is used (existing BLD column names only)

| Column | Meaning here | Written by |
|---|---|---|
| `id` | `occ-YYYYMMDD-HHMMSS-xxxx` | script |
| `tenant_id` | from `TENANT_ID` | script |
| `subject_id` | the dog | staff (checked against `BLD-subject.csv`) |
| `area_id` | the new room | staff (checked against `BLD-area.csv`) |
| `moved_in` | today's date (London) | script |
| `off_site_kind`, `moved_out`, `classification`, `classification_note` | **left blank, never written** | nobody (old rows untouched) |

- **Current room** = the row with the latest `moved_in` (an undated legacy row ranks lowest; a tie goes to the later row). Anything that reads occupancy must use that rule, not "the row with no `moved_out`": new rows leave the old row's `moved_out` blank.
- **On site** = not (`off_site_kind` sold / owned_by_family / deceased, or `classification` Collected / Deceased, or status Sold / Collected / Deceased). A dog with status `off_site_temp` is on site but **Away** (v3). The three legacy values were seen in the live file on 24 Sep (`sold`, `owned_by_family`; `Collected`); other values are treated as on site.
- 134 of 137 live rows have a blank `area_id`: the daily check shows those dogs as **"Room not recorded yet"** (no Same button) and the first confirmation fills the gap by adding a row. This is Lisa's D4, now worked by the screen itself.
- `occupancy_check` (v3, replaces the v2 proposal): `id, tenant_id, confirmed_at, confirmed_by, dog_ids, moved_count, note`. All new names; nothing in the design or on Drive yet.

## 7. v2: can the existing permission files hold staff read rights? (checked 16 Oct against the live files)

**`BLD-field_visibility.csv`** (columns `id, tenant_id, table_name, field_name, audience_id, visible, condition, redaction, set_by, set_on, reason`; 65 rows):
- **Columns: yes, as is.** One row per table, field and audience, `visible` yes/no. The audience `aud-staff` already exists in `BLD-audience.csv` (rank 60, `aud-admin` 70). Today it has rows only for `person` fields; **none** for subject, area, occupancy, subject_status or area_reading, so today staff can read nothing (the default deny holds with no change).
- **Rows (which records): only partly.** The `condition` column is free text ("person is the recorded owner of THIS subject") that nothing can run. The script therefore understands **three** forms, put on a row whose `field_name` is `*`: empty (every row), `rows_days<=N`, `own_rows_days<=N` (my own entries from the last N days). Anything else is refused, not guessed. This uses the existing columns with new values, so it is a proposal for Lisa to agree, not a schema change.
- **Redaction:** not applied; a column with a redaction or an unreadable condition simply stays hidden.
- **Per person (v3):** possible with extra rows whose `audience_id` is `person:<code id>`; see section 8. Without such a row every `STAFF` code is `aud-staff` and every `OWNER` code is `aud-admin`; other roles (vet, trainer) get nothing.

**`BLD-table_policy.csv`** (73 rows): one coarse row per table with free-text "who may read/write by default" (for example `occupancy`: staff / staff). It cannot say which columns or which rows, and nothing can run it, so the script **does not use it**. It has no row for `area_reading` or `occupancy_check`.

**Proposed rows (in this folder, never written to Drive by this job):**
- `AA_2026-10-16_JOB4-PROPOSED-visibility-rows__claude-job4.csv` - **42 rows** for `BLD-field_visibility.csv` (v3: was 49; Lisa removed the 7 staff temperature rows fv-p018 to fv-p024). Staff: the four lists the daily check needs, no dob, chip, sex or notes, and **no temperature entries**. Owner: the same lists and the whole temperature log. Replace `ten-REPLACE-ME` with the tenant id.
- `AA_2026-10-16_JOB4-PROPOSED-table_policy-rows__claude-job4.csv` - 2 rows (`area_reading`, `occupancy_check`), documentation only. v3: `tp-p01` read = "owner (all)"; `tp-p02` read = "owner (all)" too (staff have no read rows for the check log).


## 8. v3: what Lisa's answers changed (16 Oct, slip 02 answers)

- **Staff see no past temperature entries, not even their own (S02-4 D).** Rows fv-p018 to fv-p024 are removed from the proposed visibility rows (42 of 49 remain, the rest exactly as written). `tp-p01` read is "owner (all)". The staff screen no longer offers "pick an old entry to correct"; it says "Wrong entry? Tell the owner - she can fix it." Server side, a staff code can no longer send a `correct` request (only an `OWNER` code can).
- **Per-person rows.** In `BLD-field_visibility.csv`, a row whose `audience_id` is `person:<code id>` (for example `person:sc-k3f9ab`) is read on top of the role rows: the person row beats the role row for the same column and for the row rule; no person row means the role rows apply; no row anywhere means nothing (default deny). A `no` takes away. **UNVERIFIED / risk:** the live `BLD-audience.csv` lists the audiences; nothing here checks that other readers of `BLD-field_visibility.csv` accept an audience that is not in `BLD-audience.csv`. See slip 03.
- **Code ids.** Each staff code has a public id `sc-xxxxxx` (not secret, cannot sign in). The registry of codes is a Script Property (hashed), **not** a Drive table, so switching a code off keeps its registry entry (`revoked_at`, `revoked_by` added, `active` false) and appends one `code_revoke` line to `BLD-_pending.csv` (no code, no hash).
- **`BLD-occupancy_check.csv` (new table, built):** `id` (chk-...), `tenant_id`, `confirmed_at` (ISO with offset, set by the script), `confirmed_by` (the staff **code id**), `dog_ids` (pipe-separated, sorted, at most 500), `moved_count` (whole number, sent by the screen, not verified), `note`. One row per tap of "All the rest unmoved". The same list within 30 minutes is a repeat. Readable only by rows Lisa adds (none proposed for staff).
- **Moves queue for 14 days then go straight in:** Script Property `MOVES_QUEUE_UNTIL` (a date); `adminStartMovesQueue` sets it to today + 13 days, so the queue covers 14 days counting go-live day.
- **Not on site:** sold, owned_by_family, Collected, deceased (permanent: left off the daily check and never moved by the script); status `off_site_temp` shows as **Away**, keeps its room, is not asked to move and is not in `dog_ids`.
- **Missing rooms:** `tools/backfill-rooms.js` outputs NEW occupancy rows only, from a register (`dog_id`, `room_code`); never edits.
