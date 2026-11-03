# Options for each choice (Job 4)

15 Oct 2026, updated 16 Oct (v2: D1, D3 and sections O12 to O17). Each choice: options, what each means, my recommendation, and what was built. **The four decisions that are Lisa's alone are D1 to D4.** The rest I settled with a default and flagged.

## D1. Approve the append-only write, and which files it may touch (LISA)

| | Meaning |
|---|---|
| A | Approve for `BLD-area_reading.csv` and the approvals queue `BLD-_pending.csv` only. |
| B | A, plus `BLD-round_event.csv` (cabin placement and flap log). |
| C | A and B, plus `BLD-staff.csv` (roster). |
| D | Keep saving off. |

**Recommend A** (the smallest useful step, and the temperature log is the thing the council asks for). **Built (v2):** the allow-list is **A plus `BLD-occupancy.csv`** (Lisa's 16 Oct follow-up: the daily location check appends occupancy rows), the occupancy file behind its own switch, off by default. `occupancy_check` and `staff` are kept in the code on a separate PROPOSED list; `round_event` is retired (kept, refused). All are refused whatever switches are set. Agreeing one later is a one-line code change (move the entry into the main list) plus its own `TABLE_ON_<table>` switch.

## D2. Create the files on Drive (LISA)

Files to create: `BLD-area_reading.csv`, `BLD-_pending.csv` (and later `BLD-round_event.csv`, `BLD-staff.csv`).

| | Meaning |
|---|---|
| A | Lisa runs `adminCreateEmptyTables` (header line only, refuses existing files). |
| B | Lisa makes the files by hand with the header line in SETUP step 7. |
| C | Wait. |

**Recommend A, in the practice folder first.** The script never creates files while saving.

## D3. New readings: straight in, or wait for approval (LISA)

| | Meaning | Consequence |
|---|---|---|
| A | **Pending** (`MODE_area_reading=pending`) | Every reading waits for Lisa. Safest. But a reading sits unrecorded until approved, and an inspector asking "was it read at 08:00?" sees the approval time unless the app reads `taken_at` (it does: `taken_at` is stamped on receipt, not approval). Lisa must open the approval page daily |
| B | **Direct** (the default now: `MODE_area_reading` unset, or `=direct`) | Readings land immediately, append-only. A mistake needs a correction, which still waits for Lisa |
| C | Direct for staff, pending for trainees | Not built: needs a per-role rule. Say if wanted |

**Recommend A for the first two weeks, then B** once the screen has been trusted. **Built:** both. Corrections and roster entries are always pending. **v2 (Lisa, 16 Oct): temperature readings go straight in** (the table's own default is now direct; set `MODE_area_reading=pending` to hold them). Occupancy moves default to pending (see O14).

## D4. `occupancy.area_id` blank: fill it, or show "room unknown" (LISA)

| | Meaning |
|---|---|
| A | Fill `area_id` for the 134 blank rows (a data job; not done here). Bands then work for every room. |
| B | Show "room unknown" until filled. |

**Built: B** (screens say "No band: room unknown" and still let the reading be saved). **Recommend A, soon**, because without it no band, no out-of-band note prompt, and no capacity check can work.

## O1. How a correction points at the row it corrects (settled by default; flagged)

The design has no pointer column. `area_reading` does not exist yet, so its header is still free.

| | Meaning |
|---|---|
| A | Add a column `corrects_id` to the new file's header. Simple, readable. |
| B | Keep the design header exactly; record the link in a separate append-only `BLD-_corrections.csv`. |
| C | Encode it in the id (`rdg-...-c1`). No new column, but readers must parse text. |

**Built: A** (and on `round_event` and `staff` the same). **Recommend A.** If you prefer B, the sink changes in one place (`buildRow_` plus the correction check).

## O2. Where the "what was done about it" note goes (flagged)

The design says the app should ask for it when a reading is outside the band, but has no column.

| | Meaning |
|---|---|
| A | Add `mitigation_note` to the header (built). |
| B | Write it to the existing `BLD-note.csv` and link (I do not know its columns; not built). |
| C | No note. |

**Recommend A.** (C would make an out-of-band reading look like a finding with no explanation, which the design's own notes say is the thing to avoid.)

## O3. Computed columns

`applied_limit_id`, `in_range`, `compliant`, `mitigation_required`.

| | Meaning |
|---|---|
| A | Keep in the header, write blank; the app computes on read (built). |
| B | Drop them from the file. |
| C | Script computes and stamps at save time. Needs occupancy, which is blank for most dogs today. |

**Recommend A now, C once `area_id` is filled** (the design says to stamp *which* band applied, because occupancy is corrected later).

## O4. Who saved it (`taken_by`)

| | Meaning |
|---|---|
| A | The staff member's label from the code list, e.g. "Sam" (built). |
| B | A person id from `BLD-person.csv`. Needs `BLD-staff.csv` and a link between code and person. |

**Recommend A until the roster exists, then B.**

## O5. Time of the reading (`taken_at`)

| | Meaning |
|---|---|
| A | Time the script received it (built). Cannot be faked from a phone. |
| B | Time typed by staff. Lets a late entry carry the real time. |

**Recommend A**, with the thermometer window in `period_start` (staff-typed, optional, up to 7 days back).

## O6. Name and place of the approvals queue

`BLD-_pending.csv` in the main folder (built; the `BLD-_` prefix is how the folder already names non-data files such as `BLD-_MANIFEST.csv`, `BLD-_README.md`), or in the empty `BLD-DROP` subfolder. **Recommend main folder**: it makes it visible to the data-health check later. The name uses the existing `BLD-_` convention; I did not check it against the naming ledger.

## O7. How staff identify themselves

| | Meaning |
|---|---|
| A | Personal code (built). Works on any phone, no Google account needed. |
| B | Google sign-in for staff. Stronger, but staff need Google accounts and the script runs as Lisa, so the script would need to verify a Google token. Not built. |

**Recommend A now.**

## O8. How the screens learn the Script URL

Paste on each device, or a Drive config file (both built). **Recommend the Drive file** once it is working, so no one pastes anything.

## O9. Looks: Bloodline or The Board

**Settled by Lisa (review, 15 Oct night): CD Hub is Bloodline.** Only the Bloodline wiring is in use. The Board drop-in is parked (kept, not used). The Bloodline wiring is a patch, not a copy of the page, so the page stays Lisa's.

## O10. Does Drive-as-database make sense for this?

CSV append over Drive works for tens of readings a day. It does not suit hundreds a minute (each save rewrites the file). **For a kennel it is fine.** If it ever grows, the same screens can point at a database.

## O11. Safety of the whole-file rewrite (added in the fix-up)

| | Meaning |
|---|---|
| A | Compare a hash of the text (not just the size) before and after, and put the exact old text back if the check fails, logging it in the approvals queue (built). |
| B | Also keep an optional daily backup copy (built, off by default). |
| C | Stop using Drive CSV append and use a database. Not recommended at this size (see O10). |

**Recommend A and B.** Backups are never deleted by the script; the naming protocol's "keep the last 2" tidy-up is Lisa's call.

## O12. Where the daily "Same / Moved" confirmation is recorded (16 Oct)

| | Meaning | Consequence |
|---|---|---|
| A | **New proposed list `BLD-occupancy_check.csv`** (`id, tenant_id, check_date, subject_id, area_id, result, recorded_by, recorded_at, corrects_id`). Built, on the proposed list (refused until agreed). | One row per dog per day: a per-dog record of who confirmed what and when. A new table: Lisa must agree it and create the file. Until then a **Same** tap is kept on the screen only and says so. |
| B | **The existing checklist tables:** a `BLD-checklist_instance.csv` row per round (template `clt-round`) and a `BLD-checklist_item.csv` tick for template item `cti-round-02` "Check every dog is in its recorded cabin" (evidence: tick, role `rol-staff`). No new table. | One tick per round for the whole kennel, not per dog, so it cannot show which dog was checked or where; `done_by_person_id` needs a person id (staff are known by label); both files are empty header-only files today and would need adding to the allow-list. Not built. |
| C | No confirmation log: only moves are written (to the occupancy file). | Simplest. Nothing proves a "Same" check happened, which is what an inspection asks. |

**Recommend A**, and agree it before the screen goes live so "Same" is not screen-only. B is the better fit if you want the round to stay one checklist. **Built:** A (proposed) with C behaviour until it is agreed.

## O13. How to hold what staff may read (16 Oct)

| | Meaning |
|---|---|
| A | **Existing `BLD-field_visibility.csv`**: rows for `aud-staff` / `aud-admin` per table and column; a row whose `field_name` is `*` sets which rows (all / last N days / my own last N days). Built; proposed rows supplied. Uses existing columns, new row values. |
| B | A new small table of read rights (not built). More expressive (per person), another file to keep. |
| C | Fixed rules in the code (not built). Nothing for Lisa to edit; every change needs a code change. |

**Recommend A** (permissions stay in one place Lisa already owns, default deny with no change). `BLD-table_policy.csv` is not used: it is free text per table (see the MAP note). Limit of A: audience level only, so all staff see the same, not person by person.

## O14. Do occupancy moves go straight in or into the approvals queue?

| | Meaning | Consequence |
|---|---|---|
| A | **Approvals queue** (default, `MODE_occupancy` unset) | Lisa sees every move before it lands. The legal record of where a dog is stays checked. A move shows only after approval, so the next day's list can be stale if she is away. |
| B | **Straight in** (`MODE_occupancy=direct`) | Current for everyone at once. A wrong move is fixed by moving again or by Lisa's owner edit. |

**Recommend A for two weeks, then B** (most dogs are "Same"; moves are few).

## O15. Lisa's owner edit (in place, no record kept) - her decision of 16 Oct, recorded with its consequences

| | Meaning | Consequence |
|---|---|---|
| A | **Overwrite in place, nothing kept** (built, off by default). Owner page only. | Fast and tidy. The old value is gone from the log: no trail for an inspector; only Drive's file history and any nightly backup copies keep an earlier whole-file version. |
| B | Edit, but keep a log line "edited by, when, old value" (not built). | Trail kept; the log grows; the old value is in a file again. |
| C | Corrections only (staff and Lisa). | Full trail; slower for a typo. This is how staff already work. |

**Built A as asked.** My advice: use C (a correction) for anything an inspector might look at, and A for typos on the same day. If the nightly backup is on, an edit leaves the old value in yesterday's `.bak` copy.

## O16. What "Same" does before the daily check log is agreed

Built: the tap is kept on the screen only, the card turns amber ("this screen only, not saved yet") and counts toward "n of N confirmed". Alternative (not built): refuse the tap until the log exists. **Recommend agreeing O12 first** so this never shows.

## O17. Who may use the daily check

Any staff code (`STAFF`) or owner code (`OWNER`); vet and trainer codes get nothing. Reading what the screen needs needs the permission rows in O13, so a code with no rows sees "no dogs".


---

# v3 (16 Oct 2026): decisions Lisa made on slip 02, with what each one means

O12 to O17 above are the v2 options. Lisa's answers (AA_JOB4_SLIP_02_ANSWERS.md) settled several; the rest of this section records each decision, what else was possible, and the consequence of the choice made.

## O18. Daily confirmation: one tap for the whole kennel (S02-1, Lisa's own option, replaces O12 A and C)
| | Meaning | Consequence |
|---|---|---|
| **Built** | Staff change only the dogs that moved, then press **All the rest unmoved** once. ONE row in `BLD-occupancy_check.csv`: code id, time, list of dog ids, moved count. | Fast for 150+ dogs. A dog's own history is "was it in the list on that day", not a row per dog; the screen cannot confirm a dog whose room is not recorded (it is left out and the screen says so). `moved_count` is sent by the screen and not checked by the script. |
| Other | One row per dog per day (the v2 proposal) | Per-dog rows, 150+ writes a day, each a whole-file rewrite: slow and heavy on Drive. Not chosen. |

## O19. Moves: queue for 14 days then straight in (S02-2 A)
Built: `MOVES_QUEUE_UNTIL` (a date), set by `adminStartMovesQueue` on go-live day to today + 13 days. If it is never run, moves queue for ever (the safe side). `MODE_occupancy` beats the date. **Consequence:** after the date a wrong move lands at once; it is fixed by moving the dog again or by the owner edit (O15). Staff on other days see the new room as soon as the owner approves (inside the 14 days).

## O20. Staff see NO past temperature entries (S02-3 A with S02-4 D)
Built as decided. **Consequences:** a member of staff cannot check what they typed; the "duplicate" refusal still tells them an entry exists for that room in the last 30 minutes (and its id), and now says "tell the owner"; the owner becomes the one place wrong entries are fixed (O15 owner edit, no record kept; or an owner correction row). Staff still add entries; the owner reads the whole log.

## O21. Per-person permission rows (Lisa's extra)
| | Meaning | Consequence |
|---|---|---|
| **A (built)** | Rows in the existing `BLD-field_visibility.csv` with `audience_id` = `person:<code id>`; person beats role. | Permissions stay as rows, one place. **UNVERIFIED:** anything else that reads the file and expects `audience_id` to exist in `BLD-audience.csv` may reject these rows. |
| B | Add one row per person to `BLD-audience.csv` first (id `person:<code id>`), then A. | Keeps the audience list complete; needs rows added to a live table (a human decision). |
| C | A new table of per-person rights. | Not built; another file. |
**Recommend A, and the bot checks what else reads the permissions file before go-live; if anything complains, add B.**

## O22. Switching a staff code off (Lisa's extra 2b)
Built: owner page, **Staff codes**. The code entry is kept (marked `revoked_at`, `revoked_by`, `active` false) and a `code_revoke` line is appended to `BLD-_pending.csv`. **Deviation from the brief, stated plainly:** the brief says "append a row to the codes table"; there is no codes table. The codes live (as one-way hashes) in a Script Property, because a Drive file that held code hashes could be read by anyone with access to the folder. A codes table would be a new table (proposal only). **Consequence:** the permanent record of a switch-off is the appended line in `BLD-_pending.csv`; the entry itself is only in the script's private settings.

## O23. Away dogs and gone dogs (S02-7 B)
Built: sold, owned_by_family, Collected, deceased are left off the daily check and cannot be moved; status `off_site_temp` shows as **Away**, keeps its room, is not asked to move, is not in the confirmation list. **Consequence:** `off_site_temp` is a new status value in `BLD-subject_status.csv` (existing column `state`); someone has to set and clear it. A dog left Away for ever is never asked about.

## O24. Missing rooms (S02-6 B)
Built: `tools/backfill-rooms.js`, new rows only, never overwriting a different room, run on a copy first. **Consequence:** the new rows carry `moved_in` = the back-fill date, so they become each dog's current room; a dog whose latest dated row is later than that date is skipped and reported.
