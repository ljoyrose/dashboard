# AF-ENGINE weeklyBackup — read-only review, 23 Oct 2026 02:58 UK

Read from the AF-ENGINE code on Drive (the weeklyBackup function, about 30 lines; code last changed 21 Oct). Nothing was changed or pushed. File names and ids are left out of this public copy; the run log on Drive has them.

## What it does on Mon 26 Oct 05:20 UK
1. Makes 3 files in the backup folder: a copy of the control sheet, a task-state export and a full task export.
2. Lists every file in that folder whose name has the backup prefix, newest first, and moves everything after the first 24 to Trash (`list.slice(24)`).

## What it would remove on 26 Oct: nothing
The backup folder (beside AF-ENGINE; the FOLDER_BACKUP setting itself was not read) holds 8 backup-prefixed files today, all from 20 Oct (three runs that day, 12:58-13:35 UTC), plus 1 test-restore copy (not matched, never trimmed).

8 + 3 = 11, under 24, so the trim moves nothing to Trash on 26 Oct. The first trim comes when the count passes 24: 11 after 26 Oct, then +3 a week, so Mon 30 Nov 2026 (26 files: the 2 oldest 20 Oct files go to Trash), or sooner if backups are run by hand.

## Risks in the rule as written
1. It counts files, not weeks. The comment says "3 files a week × 8 weeks", but hand runs (three on 20 Oct) use up slots, so real weekly copies get trimmed before they are 8 weeks old.
2. It trims before checking the new set is complete. If one of the three new files fails, a run still trims on the old count.
3. "never hard-deleted" holds only until Trash is emptied: Drive empties Trash after 30 days.
4. No record of what it trashed: the BACKUP sheet logs what was made, not what was removed.

## Safe change proposal (keeps everything until reviewed) — NOT applied
Default is keep. Trimming happens only when Lisa sets SETTINGS `BACKUP_TRIM` = `YES`; until then the run only writes what it *would* trash to the BACKUP sheet.

```js
  // keep everything unless BACKUP_TRIM = YES; never trash while this run's 3 files are missing
  var files = backup.getFiles(), list = [];
  while (files.hasNext()) { var x = files.next(); if (BACKUP_PREFIX.test(x.getName())) list.push(x); }
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

Before turning trimming on: confirm FOLDER_BACKUP is this folder, and copy anything older than 8 weeks to a long-term folder first.

---

## Refresh, 30 Oct 2026 00:30 UK (CJ5, read-only)

Read live from the AF-ENGINE code folder, the backup folder and the engine log. Nothing was changed.

### The code now
- CONFIRMED: the newest engine code (dated 22 Oct) still has the same keep rule. It keeps the 24 newest backup-prefixed files, sorted by creation date (not name), and moves the rest to Trash. It does not delete outright, count by weeks or check that the run finished cleanly.
- CONFIRMED: there is a weekly trigger on Monday about 05:20 UK. It runs through the engine wrapper, which checks a lock and the factory on/off switch. Backup is a safety job, so it can run while the factory is OFF if a setting allows it. It did run on 26 Oct with the factory OFF.
- UNVERIFIED: that this exact code version was the live one at 05:20 on 26 Oct. The deployed version can't be read from Drive.

### Mon 26 Oct outcome: CONFIRMED, nothing trimmed
- The 26 Oct run is logged OK and made 3 files at 05:25 UK.
- The backup count went from 8 to 11. Every file the backup log lists is still in the folder, so nothing was trimmed. This matches the 23 Oct prediction.
- The engine log has no trim line for 26 Oct. That is expected, because trims are not logged (risk 4).
- Trash itself can't be read. The CONFIRMED rests on the count and the log matching.

### Count against keep-24
- Now: 11 backup-prefixed files (8 from 20 Oct, 3 from 26 Oct), plus 1 test-restore copy that is never counted.
- Oldest 20 Oct 2026, newest 26 Oct 2026.

### Next trim date
- The count goes 14 on 2 Nov, 17 on 9 Nov, 20 on 16 Nov, 23 on 23 Nov, and 26 on **Mon 30 Nov 2026**. That run moves the 2 oldest 20 Oct files to Trash.
- It comes sooner if anyone runs a backup by hand, because each hand run adds 3 files.

### Risk (unchanged, plus one)
- Risks 1-4 above still hold. The safe change proposal is still NOT applied.
- New: any file someone adds by hand with the backup prefix counts toward the 24 and pushes real copies out sooner.
- Not a backup risk: the same morning's log shows one unrelated page-watch read failure (HTTP 403).
