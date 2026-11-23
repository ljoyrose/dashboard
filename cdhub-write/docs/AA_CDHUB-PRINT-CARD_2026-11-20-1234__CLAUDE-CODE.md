# CD Hub print any item, QR on add: seed rule rows and practice run

20 Nov 2026, 12:34 UK. Print-any-item job (Lisa 15 Nov 2026), Addenda 1 to 4. **Practice only.** Nothing here has been written to a live BLD sheet. Live seeding, switching `TABLE_ON_qr_tag` on and a real back-fill all need Lisa's yes.

## 1. Seed rule rows (BLD-breeding_rule)

One dated row per item type says whether that type gets a QR code when it is added. The rows use the existing rule-row pattern (rule_key, value, effective_from, source). No new column is needed.

`tenant_id`, `set_at` and `set_by` are filled in when the rows are pasted. The values below are the starting defaults. Lisa changes them by adding a newer dated row, never by editing an old one.

```csv
rule_key,value,effective_from,source,note
qr.on_add.subject,yes,2026-11-15,Lisa 15 Nov 2026 (print job Addendum 3 l),A dog gets its QR code when it is added.
qr.on_add.area,yes,2026-11-15,Lisa 15 Nov 2026 (print job Addendum 3 l),A room gets its QR code when it is added.
qr.on_add.litter,yes,2026-11-15,Lisa 15 Nov 2026 (print job Addendum 3 l),A litter gets its QR code when it is added.
qr.on_add.site,yes,2026-11-15,Lisa 15 Nov 2026 (print job Addendum 3 l),The one premises code.
qr.on_add.thermometer,yes,2026-11-15,Lisa 15 Nov 2026 (print job Addendum 3 l),A thermometer gets its QR code when it is added.
```

Not seeded, and Lisa's decision:
- `qr.on_add.item`: Lisa's seed list did not name items.
- `qr.on_add.item.<kind_key>`: one item type only, for example `qr.on_add.item.extinguisher`.

Without a row, an item gets no code when it is added. Print still makes one when its card is printed.

### Puppy colour on dog cards (Lisa 21 Nov 2026)

A dog under `puppy.under_weeks` weeks old on the print day prints in the `size_colour.puppy` colour (frame and Size tile) instead of its size colour. With no date of birth, or without these rows, the size colour is used. A dog with no known size prints a plain frame. The newest row in force wins.

```csv
rule_key,value,effective_from,source,note
size_colour.puppy,purple,2026-11-21,Lisa 21 Nov 2026,A pup under the puppy age prints purple instead of its size colour.
puppy.under_weeks,12,2026-11-21,Lisa 21 Nov 2026,Under 12 weeks old on the print day counts as a pup.
puppy.size_tile,size,2026-11-21,Default until Lisa decides,What a pup's Size tile says: size = Small/Medium/Large; puppy = "Puppy".
```

- **A pup's Size tile** follows `puppy.size_tile`. With `size`, or no row, it says Small/Medium/Large as today. With `puppy`, it says "Puppy". Lisa's answer is a newer dated row, with no code change.
- A dog with no date of birth is never a pup.
- **Still Lisa's to decide:** should the hub's on-screen dog card and the litter card also turn purple for pups?

### Fields on item cards (optional rows)

| rule_key | value | meaning |
|---|---|---|
| `print.fields.item` | column names joined by `\|`, e.g. `item_no\|kind_key\|serial_no\|expires_on` | the fields every item card prints |
| `print.fields.item.<kind_key>` | the same | one item type's fields; this beats `print.fields.item` |
| `print.label.<column>` | a word, 30 characters or fewer, e.g. `print.label.size` = `Weight` | the label printed above that value |

Allowed columns: `item_no`, `kind_key`, `make`, `model`, `serial_no`, `size`, `made_on`, `expires_on`, `note`.

Without a row, cards print: Item number, Type, Make, Model, Serial number, Expires on. The print page's **Save as the usual fields** button adds a new `print.fields.item` row dated today.

## 2. Practice run (copied folder only, never the live one)

Follow `cdhub-write/docs/PRACTICE-RUN.md` for the copied folder and the test deployment. Then:

1. Paste the seed rows above into the copy's `BLD-breeding_rule.csv`.
2. Set `SAVE_ENABLED`, `TABLE_ON_qr_tag` and `TABLE_ON_subject_create` to `true` on the **test** deployment only.
3. Add a pretend dog from the hub. The answer says `qr: made`, and the copy's `BLD-qr_tag.csv` has one new row (kind `subject`, ref_id = the new dog).
4. Add a pretend thermometer on the print page. The answer says `qr: made` (kind `thermometer`).
5. Set `qr.on_add.subject` to `no` with a newer effective_from, then add another pretend dog. The answer says `qr: no`, and no new tag row is added.
6. Open the print page, press **Item cards** and then **Dog cards**. Cards with a tag reuse it. Anything without a tag gets one, saved before printing.

### Back-fill (dry run by default)

```bash
node cdhub-write/tools/backfill-qr-tags.js --rules BLD-breeding_rule.csv --qr BLD-qr_tag.csv --subjects BLD-subject.csv --status BLD-subject_status.csv --areas BLD-area.csv --litters BLD-litter.csv --thermometers BLD-thermometer.csv --items BLD-items.csv --tenant <tenant id> --date 2026-11-20
```

- It prints counts only for each kind (`checked`, `rule_no`, `already`, `add`). It shows no names, ids or tags, and writes nothing.
- With `--out <new file>` it writes the new tag rows to that NEW file. It refuses an existing file or any input file.
- Run against the copy:
  1. Back up the copy's `BLD-qr_tag.csv` (for example `BLD-qr_tag.csv.pre-backfill-<date>.bak`).
  2. Append the `--out` rows to it.
  3. Run the tool again. The `add` counts must all be 0.
- **A real run on the live file needs Lisa's yes.** Make the backup first, every time.

## 3. What is not done here

- **Rooms, litters and the premises code have no "add" action in the save script yet.** They are added in the Sheet. Their QR codes come from the back-fill, or from Print. When an add action is built, it calls `qrOnAdd_` the same way `subject_create` does.
- **Tag length stays 8 characters.** The schema master's 20.4 note says `qr.tag_length` starts at 10. Nothing reads that row yet, because every existing tag, the print page and the scan page use 8. Changing the length is Lisa's decision.
- **The clone base schema master on Drive was not changed.** It is a live file, and the schema catch-up is the overseer's job (Lisa's 15 Nov 05:08 hold). The repo schema doc has the additions (BLD-SCHEMA.md, section 20.4 addendum).
