# Room temperatures (staff page module)

Twice a day, per room: scan the room's QR, open **Room temperatures** (the scanned room comes first and opens by itself), **Read with camera**, fit the thermometer screen in the frame, check MAX and MIN, Save, press CLR. **Type it** always works instead.

- Morning before 12:00, afternoon after. `period_start` is the same slot value the CD Hub round saves, into the same `BLD-area_reading` list, so the hub's round shows these readings.
- How a reading was taken (`read_method`, `camera_value_changed`) is saved only and never shown on any screen or print (Lisa, 11 Nov 2026).
- Saved per reading: `min_c`, `max_c` (1 decimal place), optional `spot_c` (bed spot), `read_method` (`camera` or `typed`), `camera_value_changed` (`true` if the person changed what the camera read), and `mitigation_note` when a reading is outside the room's limit.
- The round is the thermometer rows in `BLD-thermometer` (name, area_id, active): one thermometer per place, corridors are their own place, a field with no thermometer is not on the round. With no rows yet, every room is listed. A thermometer's QR opens its place (the staff page stores `bld.temp.thermometer`).
- Room limits are rows in `BLD-temperature_band` (band, age_from_days, age_to_days, min_temp, max_temp; optional `area_id` for one room). The youngest dog in the room picks the band. Nothing is coded here.

## No picture is kept by the reader

The camera is read live in the page (`getUserMedia`). Each frame is copied into memory, read as grey numbers by `reader.js` on the phone, and blanked; the camera turns off as soon as the two numbers are read. No photo is taken, nothing goes to the camera roll, the page's storage or anywhere online. Only the numbers are sent, through the save script. No AI and no outside service. `test/no-image.test.mjs` fails if the code ever gains a way to make, keep or send a picture.

## Keep a photo (owner setting, off by default)

Lisa, 16 Nov 2026: photos cost storage and carry privacy risk, so none are kept unless the owner switches it on, for example for an inspection. One dated rule row in `BLD-breeding_rule`:

| rule_key | value | effective_from | to_date |
|---|---|---|---|
| `job.temps_keep_photo` | `yes` | first day on | last day on (blank = until changed) |

The latest row in force wins, so a later row with value `no` switches it off. The `job.` prefix is what staff phones may read.

While it is on, after a reading is saved the person is offered **Take photo** (live camera, one still), **Choose photo** (a picture on the phone; the only choice for an Earlier reading) or **Skip**. The reading is saved either way. The photo goes only through the save script: `file_add` (stored in the private Shared Drive folder `FILES_FOLDER_ID`, one `BLD-files` row), then `link_add` from `area_reading/<reading id>` to `files/<file id>`, role `evidence`. Nothing goes to the camera roll or the page's storage; the picture is shrunk to 1600 px. All of this is in `evidence.js`, which is only loaded when the row exists; `module.js` and `reader.js` still never make, keep or send a picture (`test/no-image.test.mjs`, `test/evidence.test.mjs`).

Needed before switching on (otherwise the person is told the photo was not kept): Script Properties `FILES_FOLDER_ID`, `TABLE_ON_files` = true, `TABLE_ON_links` = true; rule rows `file.types` including `image/jpeg`, `file.who_may` including `STAFF`, `link_kind.evidence` (the word shown), `link_kind.evidence.who_may` including `STAFF`, and `link_kind.evidence.from_tables` including `area_reading` (or no row = any). A reading waiting in the approvals queue has no record id yet, so no photo is offered for it.

## Reader

`reader.js`: seven-segment reader for the kennel's units (MAX top right, MIN bottom right, the tenths digit half height under the C sign). A number is only accepted when 3 frames in a row agree, every segment is clearly on or off, no digit is cut by the frame's edge, and MIN is not above MAX. Anything else is left for the person to type. Never a guess.

## Report and Import (owner) · Earlier (everyone)

- **Earlier** (plus icon; was Add earlier reading): a reading for a past morning or afternoon, from paper, a photo or an app such as Govee.
- **Report** (was Year report; page icon): pick a room and year. Every reading (staff, guest and sensor back-up; who or how a reading was taken is not shown), the lowest and highest by month, and each reading outside the limit with what was done. Print from the browser. Reads one room and one year at a time (the save script's `{area_id, from, to}` filter), so a year of twice-daily readings stays under the read limit.
- **Import** (was Sensor CSV; upload icon; owner only): a Govee export becomes one back-up row per day (lowest, highest) for the chosen room in `BLD-sensor_reading`. CSV only. Back-up rows are shown beside the thermometer readings, never instead of them.

## Guest (inspector)

`BLDTemperature.rooms(host, {save, areas, guest: true})` is the same entry for the guest page. Guest readings save to `guest_reading`, so they never count as, or overwrite, a staff reading.

## Tests

```
node --test cdhub/staff/modules/temperature/test/*.test.mjs
```
