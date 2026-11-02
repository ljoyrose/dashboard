#!/usr/bin/env node
'use strict';
/**
 * backfill-rooms.js - one-off helper (Lisa 16 Oct, S02-6 B): give dogs whose room is missing a room, from Lisa's register.
 *
 * It ONLY OUTPUTS NEW occupancy rows. It never edits, closes or removes an existing row, and it never writes to the
 * occupancy file it reads (it refuses --out when that is the same file or already exists). The new rows are for the bot to
 * append to a COPY first (docs/PRACTICE-RUN.md), and to the real file only after Lisa has looked at the report.
 *
 * Inputs (all CSV, read-only):
 *   --register  Lisa's register: columns dog_id, room_code      (room_code is the code shown on screen, e.g. T3.1)
 *   --occupancy BLD-occupancy.csv (live header: id,tenant_id,subject_id,area_id,off_site_kind,moved_in,moved_out,classification,classification_note)
 *   --areas     BLD-area.csv (to turn a room code into an area id; needs columns id, code)
 *   --tenant    the tenant id to write on every new row
 *   --date      YYYY-MM-DD written as moved_in on every new row (the day of the back-fill)
 *   --out       optional: a NEW file to write the rows to (default: print to the screen)
 *
 * A dog gets a new row ONLY when its current row (latest moved_in, undated lowest, ties to the later row - the same rule as
 * the script and the screens) has NO room, or it has no row at all. Everything else is left alone and reported:
 *   already_there  the register agrees with the room already recorded
 *   conflict       a DIFFERENT room is already recorded: never overwritten (staff move the dog, or Lisa uses the owner edit)
 *   gone           sold / owned_by_family / Collected / deceased: not on site
 *   unknown_room   the register's room code is not in the area list
 *   ambiguous      the register lists the dog twice with different rooms
 *   too_early      --date is earlier than the dog's latest moved_in, so a new row would not become its current room
 *   duplicate      the register lists the dog twice with the same room (one row is made)
 */
const fs = require('node:fs');
const path = require('node:path');

const Lookups = require(path.join(__dirname, '..', 'client', 'drive-lookups.js'));
const Occ = require(path.join(__dirname, '..', 'client', 'occupancy.js'));

const HEADER = ['id', 'tenant_id', 'subject_id', 'area_id', 'off_site_kind', 'moved_in', 'moved_out', 'classification', 'classification_note'];

function csvCell(v) {
  v = v === undefined || v === null ? '' : String(v);
  return /[",\r\n]/.test(v) || v !== v.trim() ? '"' + v.replace(/"/g, '""') + '"' : v;
}
const csvLine = (cols) => cols.map(csvCell).join(',');

function gone(row) {
  if (!row) return false;
  const kind = String(row.off_site_kind || '').toLowerCase(), cls = String(row.classification || '').toLowerCase();
  return kind === 'sold' || kind === 'owned_by_family' || kind === 'deceased' || cls === 'collected' || cls === 'deceased';
}

/**
 * @param {Array<Object>} register  [{dog_id, room_code}]
 * @param {Array<Object>} occupancy existing occupancy records
 * @param {Array<Object>} areas     area records (id, code)
 * @param {{tenant:string, date:string}} opts
 * @return {{rows:Array<Object>, report:Object, details:Array<{dog_id,result,note}>}}
 */
function backfill(register, occupancy, areas, opts) {
  if (!opts || !/^ten-[A-Za-z0-9_.\-]+$/.test(opts.tenant || '')) throw new Error('--tenant is needed (e.g. ten-xxxx).');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.date || '') || isNaN(Date.parse(opts.date))) throw new Error('--date must be a real date as YYYY-MM-DD.');
  const byCode = {};
  (areas || []).forEach((a) => { if (!a.tenant_id || a.tenant_id === opts.tenant) byCode[String(a.code || '').trim().toLowerCase()] = a.id; });
  const used = {};
  (occupancy || []).forEach((r) => { used[r.id] = true; });

  // group the register by dog so a dog listed twice can be judged as a whole
  const wanted = {}, order = [];
  (register || []).forEach((r) => {
    const dog = String(r.dog_id || '').trim(), room = String(r.room_code || '').trim();
    if (!dog || !room) return;
    if (!wanted[dog]) { wanted[dog] = []; order.push(dog); }
    wanted[dog].push(room);
  });

  const report = { filled: 0, already_there: 0, conflict: 0, gone: 0, unknown_room: 0, ambiguous: 0, too_early: 0, duplicate: 0, register_dogs: order.length };
  const details = [], rows = [];
  let seq = 0;
  order.forEach((dog) => {
    const rooms = wanted[dog];
    const distinct = rooms.filter((x, i) => rooms.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === i);
    if (distinct.length > 1) { report.ambiguous++; details.push({ dog_id: dog, result: 'ambiguous', note: 'register lists ' + distinct.join(' and ') }); return; }
    if (rooms.length > 1) report.duplicate++;
    const code = distinct[0], areaId = byCode[code.toLowerCase()];
    if (!areaId) { report.unknown_room++; details.push({ dog_id: dog, result: 'unknown_room', note: 'no room with code ' + code }); return; }
    const cur = Occ.latestRow((occupancy || []).filter((r) => !r.tenant_id || r.tenant_id === opts.tenant), dog);
    if (gone(cur)) { report.gone++; details.push({ dog_id: dog, result: 'gone', note: 'recorded as not on site' }); return; }
    if (cur && cur.area_id) {
      if (cur.area_id === areaId) { report.already_there++; details.push({ dog_id: dog, result: 'already_there', note: code }); }
      else { report.conflict++; details.push({ dog_id: dog, result: 'conflict', note: 'already recorded in ' + cur.area_id + ', register says ' + code + ' - not changed' }); }
      return;
    }
    if (cur && cur.moved_in && cur.moved_in > opts.date) {
      report.too_early++; details.push({ dog_id: dog, result: 'too_early', note: 'latest row is dated ' + cur.moved_in + ', later than --date' }); return;
    }
    let id;
    do { id = 'occ-bf-' + opts.date.replace(/-/g, '') + '-' + String(++seq).padStart(4, '0'); } while (used[id]);
    used[id] = true;
    rows.push({ id, tenant_id: opts.tenant, subject_id: dog, area_id: areaId, off_site_kind: '', moved_in: opts.date, moved_out: '', classification: '', classification_note: '' });
    report.filled++; details.push({ dog_id: dog, result: 'filled', note: code });
  });
  return { rows, report, details };
}

function toCsv(rows) {
  return [csvLine(HEADER)].concat(rows.map((r) => csvLine(HEADER.map((c) => r[c])))).join('\r\n') + '\r\n';
}

function readCsv(file) {
  if (!file || !fs.existsSync(file)) throw new Error('File not found: ' + file);
  return Lookups.parseCsv(fs.readFileSync(file, 'utf8'));
}

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!/^--[a-z]+$/.test(a)) throw new Error('Unknown argument: ' + a);
    o[a.slice(2)] = argv[++i];
  }
  return o;
}

function main(argv, out, err) {
  out = out || ((s) => process.stdout.write(s)); err = err || ((s) => process.stderr.write(s));
  const a = parseArgs(argv);
  ['register', 'occupancy', 'areas', 'tenant', 'date'].forEach((k) => { if (!a[k]) throw new Error('--' + k + ' is needed.'); });
  const occ = readCsv(a.occupancy);
  const { rows, report, details } = backfill(readCsv(a.register), occ, readCsv(a.areas), { tenant: a.tenant, date: a.date });
  const csv = toCsv(rows);
  if (a.out) {
    const same = [a.register, a.occupancy, a.areas].some((f) => path.resolve(f) === path.resolve(a.out));
    if (same) throw new Error('--out must be a NEW file, not one of the input files.');
    if (fs.existsSync(a.out)) throw new Error('--out already exists. Choose a new file name; this tool never overwrites anything.');
    fs.writeFileSync(a.out, csv, { flag: 'wx' });
  } else out(csv);
  err('Back-fill report: ' + JSON.stringify(report) + '\n');
  details.filter((d) => d.result !== 'filled' && d.result !== 'already_there').forEach((d) => err('  ' + d.result + ': ' + d.dog_id + ' - ' + d.note + '\n'));
  err('NEW rows only (' + rows.length + '). Nothing in the occupancy file was changed. Append these rows to a COPY first.\n');
  return { rows, report, details };
}

if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (e) { process.stderr.write('Stopped: ' + e.message + '\n'); process.exit(1); }
}

module.exports = { backfill, toCsv, main, HEADER };
