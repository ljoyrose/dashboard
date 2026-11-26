#!/usr/bin/env node
'use strict';
/**
 * backfill-qr-tags.js - give existing items the QR code their type's rule says they should have (the owner 15 Nov 2026,
 * print-any-item job, Addendum 2 h). DRY RUN BY DEFAULT: it prints COUNTS ONLY (no names, no ids, no tags).
 *
 * It never writes to BLD-qr_tag or any other file it reads. With --out it writes the NEW tag rows to a NEW file
 * (refused if that file exists). A real run is: back up BLD-qr_tag (copy it, e.g. BLD-qr_tag.csv.pre-backfill-<date>.bak),
 * append the --out rows to a COPY, check the counts, and only then, with the owner's yes, append them to the live file.
 * Running it again after that adds 0: an item that already has an active tag of its kind is never given a second one.
 *
 * Inputs (CSV, read-only):
 *   --rules         BLD-breeding_rule.csv   the qr.on_add.<kind>(.<kind_key>) rows decide which items get a code
 *   --qr            BLD-qr_tag.csv          the tags that already exist
 *   --subjects      BLD-subject.csv         optional (kind subject)
 *   --status        BLD-subject_status.csv  optional: only dogs whose latest status is Active count
 *   --areas         BLD-area.csv            optional (kind area)
 *   --litters       BLD-litter.csv          optional (kind litter)
 *   --thermometers  BLD-thermometer.csv     optional (kind thermometer)
 *   --items         BLD-items.csv           optional (kind item; a correction row, corrects_id, is not a new item)
 *   --tenant        the tenant id
 *   --date          YYYY-MM-DD: the day the rules are read for, and made_at on new rows
 *   --out           optional NEW file for the rows (without it: counts only)
 * The site code is not back-filled here: the print page's premises button makes it.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const Lookups = require(path.join(__dirname, '..', 'client', 'drive-lookups.js'));
const Rules = require(path.join(__dirname, '..', '..', 'cdhub', 'staff', 'lib', 'qr-rules.js'));

const HEADER = ['id', 'tenant_id', 'tag', 'kind', 'ref_id', 'active', 'made_at', 'made_by'];
const SOURCES = [['subject', 'subjects'], ['area', 'areas'], ['litter', 'litters'], ['thermometer', 'thermometers'], ['item', 'items']];

/** Latest status row per dog (latest from_date, ties to the later row). */
function activeDogs(status) {
  const latest = {};
  (status || []).forEach((r) => { const c = latest[r.subject_id]; if (!c || String(r.from_date || '') >= String(c.from_date || '')) latest[r.subject_id] = r; });
  const out = {};
  Object.keys(latest).forEach((id) => { if (String(latest[id].state || '').trim().toLowerCase() === 'active') out[id] = 1; });
  return out;
}

/**
 * The pure back-fill. lists = { subjects, areas, litters, thermometers, items, status } (arrays of row objects).
 * Returns { rows: new BLD-qr_tag rows, report: { <kind>: { checked, rule_no, already, add } } }. Never changes its inputs.
 */
function backfill(lists, rules, tags, opts) {
  const o = opts || {}, tenant = o.tenant || '', day = o.date || '';
  const bytes = o.bytes || ((n) => crypto.randomBytes(n));
  const taken = {}; (tags || []).forEach((t) => { taken[t.tag] = 1; });
  const have = {}; (tags || []).forEach((t) => { if (String(t.active).toLowerCase() !== 'false') have[t.kind + '|' + t.ref_id] = 1; });
  const live = lists.status ? activeDogs(lists.status) : null;
  const rows = [], report = {};
  let n = 0;
  SOURCES.forEach(([kind, key]) => {
    const list = lists[key];
    if (!list) return;
    const rep = report[kind] = { checked: 0, rule_no: 0, already: 0, add: 0 };
    const seen = {};
    list.forEach((r) => {
      if (!r.id || seen[r.id] || (tenant && r.tenant_id && r.tenant_id !== tenant)) return;
      if (kind === 'item' && r.corrects_id) return;
      if (kind === 'subject' && live && !live[r.id]) return;
      seen[r.id] = 1; rep.checked += 1;
      if (!Rules.ruleOn(rules, kind, kind === 'item' ? String(r.kind_key || '') : '', day, tenant)) { rep.rule_no += 1; return; }
      if (have[kind + '|' + r.id]) { rep.already += 1; return; }
      const tag = Rules.newTag(taken, bytes); taken[tag] = 1; have[kind + '|' + r.id] = 1;
      n += 1;
      rows.push({ id: 'qrt-bf-' + day.replace(/-/g, '') + '-' + String(n).padStart(4, '0'), tenant_id: tenant, tag, kind, ref_id: r.id,
        active: 'true', made_at: day, made_by: 'back-fill ' + day });
      rep.add += 1;
    });
  });
  return { rows, report };
}

function csvCell(v) {
  v = v === undefined || v === null ? '' : String(v);
  return /[",\r\n]/.test(v) || v !== v.trim() ? '"' + v.replace(/"/g, '""') + '"' : v;
}
const toCsv = (rows) => [HEADER.join(',')].concat(rows.map((r) => HEADER.map((c) => csvCell(r[c])).join(','))).join('\r\n') + '\r\n';

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
  ['rules', 'qr', 'tenant', 'date'].forEach((k) => { if (!a[k]) throw new Error('--' + k + ' is needed.'); });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date)) throw new Error('--date must be YYYY-MM-DD.');
  const lists = {};
  ['subjects', 'status', 'areas', 'litters', 'thermometers', 'items'].forEach((k) => { if (a[k]) lists[k] = readCsv(a[k]); });
  const { rows, report } = backfill(lists, readCsv(a.rules), readCsv(a.qr), { tenant: a.tenant, date: a.date });
  if (a.out) {
    const inputs = ['rules', 'qr', 'subjects', 'status', 'areas', 'litters', 'thermometers', 'items'].map((k) => a[k]).filter(Boolean);
    if (inputs.some((f) => path.resolve(f) === path.resolve(a.out))) throw new Error('--out must be a NEW file, not one of the input files.');
    if (fs.existsSync(a.out)) throw new Error('--out already exists. Choose a new file name; this tool never overwrites anything.');
    fs.writeFileSync(a.out, toCsv(rows), { flag: 'wx' });
    err('QR back-fill: ' + rows.length + ' new rows written to the new file. Nothing else was changed.\n');
  } else err('QR back-fill DRY RUN (nothing written).\n');
  out(JSON.stringify(report) + '\n');
  return { rows, report };
}

if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (e) { process.stderr.write('Stopped: ' + e.message + '\n'); process.exit(1); }
}

module.exports = { backfill, toCsv, main, HEADER };
