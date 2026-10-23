# AF-ENGINE weeklyBackup — read-only review, 23 Oct 2026 02:58 UK

Read from Drive (AF-ENGINE script 1mLKPX0sa9E6abWALtRdvtUDgxG4mjmM8ilR7PwClwtTSaqrR7fuIROlp, Code.gs lines 1193-1220, last modified 21 Oct 10:59 UTC). Nothing was changed or pushed.

## What it does on Mon 26 Oct 05:20 UK
1. Makes 3 files in the backup folder: `AA_BACKUP_AF-CONTROL_2026-10-26` (sheet copy), `AA_BACKUP_CLICKUP_2026-10-26.json`, `AA_BACKUP_CLICKUP-FULL_2026-10-26.json`.
2. Lists every file in that folder whose name starts `AA_BACKUP_`, newest first, and moves everything after the first 24 to Trash (`list.slice(24)`).

## What it would remove on 26 Oct: nothing
Folder `backup` (1P08oJrSnsIqYAb9JSDqVHrKEyWE94JO1, beside AF-ENGINE; every AA_BACKUP_ file found on Drive is in it — the SETTINGS value FOLDER_BACKUP itself was not read) holds 8 `AA_BACKUP_` files today, all from 20 Oct (three runs that day, 12:58-13:35 UTC), plus `TEST-RESTORE_AF-CONTROL_2026-10-20` (not matched, never trimmed):

| Created (UTC) | File |
|---|---|
| 20 Oct 12:58 | AA_BACKUP_AF-CONTROL_2026-10-20 (1SCARwrCY…) |
| 20 Oct 12:59 | AA_BACKUP_CLICKUP_2026-10-20.json (1HGUcVH_…) |
| 20 Oct 13:32 | AA_BACKUP_AF-CONTROL_2026-10-20 (1SlZ0ZDg…) |
| 20 Oct 13:34 | AA_BACKUP_CLICKUP_2026-10-20.json (1DQAegMr…) |
| 20 Oct 13:34 | AA_BACKUP_CLICKUP-FULL_2026-10-20.json (1TnXnBWD…) |
| 20 Oct 13:35 | AA_BACKUP_CLICKUP_2026-10-20.json (1l6LvHXV…) |
| 20 Oct 13:35 | AA_BACKUP_AF-CONTROL_2026-10-20 (1PJEYqX-…) |
| 20 Oct 13:35 | AA_BACKUP_CLICKUP-FULL_2026-10-20.json (1CUxtmu9…) |

8 + 3 = 11, under 24, so the trim moves nothing to Trash on 26 Oct. The first trim comes when the count passes 24: 11 after 26 Oct, then +3 a week, so Mon 30 Nov 2026 (26 files: the 2 oldest 20 Oct files go to Trash), or sooner if backups are run by hand.

## Risks in the rule as written
1. It counts files, not weeks. The comment says "3 files a week × 8 weeks", but hand runs (three on 20 Oct) use up slots, so real weekly copies get trimmed before they are 8 weeks old.
2. It trims before checking the new set is complete. If one of the three new files fails, a run still trims on the old count.
3. "never hard-deleted" holds only in My Drive. If the folder is on a shared drive, Trash is emptied by Google after 30 days.
4. No record of what it trashed: the BACKUP sheet logs what was made, not what was removed.

## Safe change proposal (keeps everything until reviewed) — NOT applied
Default is keep. Trimming happens only when Lisa sets SETTINGS `BACKUP_TRIM` = `YES`; until then the run only writes what it *would* trash to the BACKUP sheet.

```js
  // keep everything unless BACKUP_TRIM = YES; never trash while this run's 3 files are missing
  var files = backup.getFiles(), list = [];
  while (files.hasNext()) { var x = files.next(); if (/^AA_BACKUP_/.test(x.getName())) list.push(x); }
  var made = [copy, f, ff].every(function (x) { return x && x.getSize() > 0 || x === copy; });
  var byKind = {};
  list.forEach(function (x) { var k = x.getName().replace(/_\d{4}-\d{2}-\d{2}.*$/, ''); (byKind[k] = byKind[k] || []).push(x); });
  var old = [];
  Object.keys(byKind).forEach(function (k) {
    var days = {}; byKind[k].sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); })
      .forEach(function (x) { var d = Utilities.formatDate(x.getDateCreated(), 'Europe/London', 'yyyy-ww'); (days[d] = days[d] || []).push(x); });
    Object.keys(days).sort().reverse().slice(8).forEach(function (w) { old = old.concat(days[w]); }); // 8 newest WEEKS per kind
  });
  var trim = String(s.BACKUP_TRIM || '').toUpperCase() === 'YES' && made;
  old.forEach(function (x) { sh.appendRow([new Date(), 'trim', x.getName(), x.getUrl(), x.getSize(), trim ? 'moved to Trash' : 'WOULD trash (BACKUP_TRIM not YES)']); if (trim) x.setTrashed(true); });
```

Before turning trimming on: confirm FOLDER_BACKUP is this folder, whether it sits on a shared drive (30-day Trash), and copy anything older than 8 weeks to a long-term folder first.
