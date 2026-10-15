#!/usr/bin/env node
// LOCAL / MANUAL check: are the column names in your REAL files the ones the dashboard pages expect?
//
//   node tests/contract/check-real-headers.js <folder-of-downloaded-CSV-files>
//
// How to use it (plain English): in Google Drive, download the files you want to check (or a copy of the BLD-app-tables
// and Money folders) into one folder on your computer, then run the line above with that folder.
// - It reads ONLY the first few lines of each file, to get the column names.
// - It prints column names and file names only. It never prints, stores or sends a cell value.
// - It needs no Google sign-in, no key and no internet. It is not run by GitHub, on purpose.
// Exit code: 0 = all good, 1 = a column is missing, renamed or a header was not found.
const fs = require('fs');
const path = require('path');
const { headerOf, compareHeader, entryFor } = require('./headers');

const dir = process.argv[2];
if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
  console.error('Usage: node tests/contract/check-real-headers.js <folder-with-downloaded-CSV-files>');
  process.exit(2);
}
const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.csv')).sort();
let checked = 0, bad = 0, skipped = 0;
for (const f of files) {
  const hit = entryFor(f);
  if (!hit) { skipped++; continue; }
  const fd = fs.openSync(path.join(dir, f), 'r');
  const buf = Buffer.alloc(8192); // top of the file only
  const n = fs.readSync(fd, buf, 0, buf.length, 0);
  fs.closeSync(fd);
  const found = headerOf(buf.slice(0, n).toString('utf8'), hit.group === 'money' ? hit.entry.key : null);
  const problems = compareHeader(f, hit.entry, found).filter((p) => !/harmless/.test(p) || process.argv.includes('--all'));
  checked++;
  if (problems.length) { bad++; problems.forEach((p) => console.log('PROBLEM  ' + p)); } else console.log('ok       ' + f);
}
console.log(`\nChecked ${checked} file(s); ${bad} with a problem; ${skipped} not on the list (ignored).`);
if (!checked) console.log('Nothing matched. Check the folder has files such as MON-REGISTER.csv or BLD-subject.csv.');
process.exit(bad || !checked ? 1 : 0);
