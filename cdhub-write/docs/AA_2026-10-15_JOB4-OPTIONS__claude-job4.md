# Options for each choice (Job 4)

15 Oct 2026. Each choice: options, what each means, my recommendation, and what was built. **The four decisions that are Lisa's alone are D1 to D4.** The rest I settled with a default and flagged.

## D1. Approve the append-only write, and which files it may touch (LISA)

| | Meaning |
|---|---|
| A | Approve for `BLD-area_reading.csv` and the waiting list `BLD-_pending.csv` only. |
| B | A, plus `BLD-round_event.csv` (cabin placement and flap log). |
| C | A and B, plus `BLD-staff.csv` (roster). |
| D | Keep saving off. |

**Recommend A** (the smallest useful step, and the temperature log is the thing the council asks for). **Built:** the default allow-list is **A only**. `round_event` and `staff` are kept in the code on a separate PROPOSED list and are refused whatever switches are set. Choosing B or C later is a one-line code change (move the entry into the main list) plus its own `TABLE_ON_<table>` switch.

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
| A | **Pending** (`MODE_area_reading` unset) | Every reading waits for Lisa. Safest. But a reading sits unrecorded until approved, and an inspector asking "was it read at 08:00?" sees the approval time unless the app reads `taken_at` (it does: `taken_at` is stamped on receipt, not approval). Lisa must open the approval page daily |
| B | **Direct** (`MODE_area_reading=direct`) | Readings land immediately, append-only. A mistake needs a correction, which still waits for Lisa |
| C | Direct for staff, pending for trainees | Not built: needs a per-role rule. Say if wanted |

**Recommend A for the first two weeks, then B** once the screen has been trusted. **Built:** both. Corrections and roster entries are always pending.

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

## O6. Name and place of the waiting list

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
| A | Compare a hash of the text (not just the size) before and after, and put the exact old text back if the check fails, logging it in the waiting list (built). |
| B | Also keep an optional daily backup copy (built, off by default). |
| C | Stop using Drive CSV append and use a database. Not recommended at this size (see O10). |

**Recommend A and B.** Backups are never deleted by the script; the naming protocol's "keep the last 2" tidy-up is Lisa's call.
