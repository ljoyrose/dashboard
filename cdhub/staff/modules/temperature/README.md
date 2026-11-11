# Room temperatures (staff page module)

Twice a day, per room: scan the room's QR, open **Room temperatures** (the scanned room comes first and opens by itself), **Read with camera**, fit the thermometer screen in the frame, check MAX and MIN, Save, press CLR. **Type it** always works instead.

- Morning before 12:00, afternoon after. `period_start` is the same slot value the CD Hub round saves, into the same `BLD-area_reading` list, so the hub's round shows these readings.
- Saved per reading: `min_c`, `max_c` (1 decimal place), optional `spot_c` (bed spot), `read_method` (`camera` or `typed`), `camera_value_changed` (`true` if the person changed what the camera read), and `mitigation_note` when a reading is outside the room's limit.
- Room limits are rows in `BLD-temperature_band` (band, age_from_days, age_to_days, min_temp, max_temp; optional `area_id` for one room). The youngest dog in the room picks the band. Nothing is coded here.

## No picture is ever kept

The camera is read live in the page (`getUserMedia`). Each frame is copied into memory, read as grey numbers by `reader.js` on the phone, and blanked; the camera turns off as soon as the two numbers are read. No photo is taken, nothing goes to the camera roll, the page's storage or anywhere online. Only the numbers are sent, through the save script. No AI and no outside service. `test/no-image.test.mjs` fails if the code ever gains a way to make, keep or send a picture.

## Reader

`reader.js`: seven-segment reader for the kennel's units (MAX top right, MIN bottom right, the tenths digit half height under the C sign). A number is only accepted when 3 frames in a row agree, every segment is clearly on or off, no digit is cut by the frame's edge, and MIN is not above MAX. Anything else is left for the person to type. Never a guess.

## Year report and sensor back-up

- **Year report**: pick a room and year. Every reading (staff, guest and sensor back-up, each labelled), the lowest and highest by month, and each reading outside the limit with what was done. Print from the browser. Reads one room and one year at a time (the save script's `{area_id, from, to}` filter), so a year of twice-daily readings stays under the read limit.
- **Sensor CSV**: a Govee export becomes one back-up row per day (lowest, highest) for the chosen room in `BLD-sensor_reading`. CSV only. Back-up rows are shown beside the thermometer readings, never instead of them.

## Guest (inspector)

`BLDTemperature.rooms(host, {save, areas, guest: true})` is the same entry for the guest page. Guest readings save to `guest_reading`, so they never count as, or overwrite, a staff reading.

## Tests

```
node --test cdhub/staff/modules/temperature/test/*.test.mjs
```
