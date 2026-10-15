# MAP note: design names, Drive names, columns (Job 4)

15 Oct 2026. **Nothing was renamed.** Where the design (Bloodline `bld-schema.js`, 23 Sep) and Drive differ, the Drive name wins and this note links them.

## 1. Table names

| Design table | Drive file | Status | Used by this job |
|---|---|---|---|
| `area` | `BLD-area.csv` | live, 23 rows | read (room list, id check) |
| `area_access` | `BLD-area_access.csv` | live | not used (flap mode is in the proposed round log) |
| `area_capacity` | `BLD-area_capacity.csv` | live | not used |
| `occupancy` | `BLD-occupancy.csv` | live, 137 rows, **134 with blank `area_id`** | read (dogs per room for bands) |
| `subject` | `BLD-subject.csv` | live | read (id check, `dob`) |
| `person` | `BLD-person.csv` | live | read (roster person list) |
| `role` | `BLD-role.csv` | live (OWNER, STAFF, VET, TRAINER) | roles for staff codes mirror these |
| `environment_limit` | **`BLD-temperature_band.csv` + `BLD-temperature_action.csv`** | live (2 + 5 rows) | read (band by youngest dog's age; SOP action ladder) |
| `reading_requirement` | none | design only | not built |
| `area_reading` | `BLD-area_reading.csv` | **ABSENT** | **write target** |
| (placement log) | `BLD-round_event.csv` | **ABSENT, proposed here** | **PROPOSED, not on the allow-list**: refused until agreed |
| `staff` | `BLD-staff.csv` | **ABSENT** | **PROPOSED, not on the allow-list**: refused until agreed |
| `staff_training`, `staff_duty`, `staff_competency` | none | design only | not built |
| (waiting list) | `BLD-_pending.csv` | **ABSENT, proposed here** | **write target (queue), on the allow-list** |

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
| `.access` free / limited | `BLD-round_event.csv` `event_type=access_set`, `access_type` (proposed) |
| `.subjects[]` (who is in the cabin) | `BLD-round_event.csv` `event_type=placed/removed` (proposed). Writing to `BLD-occupancy.csv` itself is **not** done |
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
