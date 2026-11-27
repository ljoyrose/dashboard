#!/usr/bin/env node
'use strict';
/**
 * save-inventory.js (15 Nov 2026): every write path of the save script, built from the code so it stays true.
 *
 * It loads the real apps-script/*.gs files through the test harness (a fake Drive, nothing live) and walks
 * TABLES, PROPOSED_TABLES, DOGCARD_, LINKS_, CODE_REG and the other writers (dog photo, owner page, admin functions).
 * Only the LIVE column and the risk notes are typed here: LIVE is what the deployed script's status said on
 * 15 Nov 2026, because a property value cannot be read from the repository.
 *
 *   node tools/save-inventory.js                 print the table
 *   node tools/save-inventory.js --write <doc>   replace the table between the inventory markers in <doc>
 *   node tools/save-inventory.js --check <doc>   exit 1 if the table in <doc> is not what the code says now
 */
const fs = require('node:fs');
const path = require('node:path');
const { makeEnv } = require('../tests/harness');

const START = '<!-- inventory:start (made by tools/save-inventory.js; do not edit by hand) -->';
const END = '<!-- inventory:end -->';

// What the deployed script's status said on 15 Nov 2026 (version 1.2.0, SAVE_ENABLED true, READ_ENABLED true).
// dog_details: a POST was refused TABLE_OFF. Anything not here was not in that status.
const LIVE = {
  area_reading: 'ON', guest_reading: 'ON', sensor_reading: 'ON', thermometer: 'ON', requirement: 'ON', area_link: 'ON',
  check_type: 'ON', check_field: 'ON', check_value: 'ON', check_log: 'ON', readings: 'off', items: 'off', item_kinds: 'off',
  occupancy: 'ON', occupancy_out: 'ON', area_access: 'ON', qr_tag: 'ON', occupancy_check: 'ON', breeding_rule: 'ON',
  person: 'off', household: 'off', household_member: 'off', subject_owner: 'off', sale: 'off',
  dog_details: 'off (POST got TABLE_OFF)', staff: 'off (proposed: refused)'
};
const UNKNOWN = 'unknown (not in status)';

// Master data: a wrong row changes who or what a record is about, not just adds a log line.
const MASTER = { dog_details: 1, subject_create: 1, dog_photo: 1, files: 1, links: 1, subject_link: 1, staff: 1, code_register: 1 };
const ENQUIRIES = { person: 1, household: 1, household_member: 1, subject_owner: 1, sale: 1 };

const RISK = {
  area_reading: 'Append-only log; corrections always queue.',
  guest_reading: 'Visitor codes only; never touches the staff log.',
  sensor_reading: 'Owner import of sensor days.',
  thermometer: 'Owner list; owner edit can change a row in place.',
  requirement: 'Owner rows with dates.',
  area_link: 'Owner rows with dates; changes which readings count for a room.',
  check_type: 'Owner rule rows; changes what staff see as jobs.',
  check_field: 'Owner rule rows; changes the questions on a job.',
  check_value: 'Only written inside a check_log save (its own perms are empty); needs check_log on too.',
  check_log: 'Append-only log; a whole-site tap writes one line per dog, or one session row when that check\'s setting says so.',
  check_setting: 'Owner settings for how each check is recorded. Dated. Off until the table exists.',
  retention_setting: 'How long a section is kept. Check records cannot be under 6 years.',
  readings: 'Append-only; needs reading_kinds and reading_limits rows.',
  items: 'Owner list of items.',
  item_kinds: 'Owner list of item kinds.',
  occupancy: 'Room moves; always direct (MODE_occupancy and MOVES_QUEUE_UNTIL are ignored).',
  occupancy_out: 'Queued until the owner approves; never applied by a plain GET or a save (Risks found, R2, fixed).',
  area_access: 'Flap free/limited.',
  qr_tag: 'Owner list of QR tags.',
  occupancy_check: 'Append-only daily check.',
  breeding_rule: 'The one rule list: link kinds, file types and who-may rows live here, so a bad row widens or narrows other saves.',
  person: 'Puppy enquiries. The hub button also needs config cdhub.enquiriesWrites (false in repo).',
  household: 'Puppy enquiries. The hub button also needs config cdhub.enquiriesWrites (false in repo).',
  household_member: 'Puppy enquiries. The hub button also needs config cdhub.enquiriesWrites (false in repo).',
  subject_owner: 'Puppy enquiries. The hub button also needs config cdhub.enquiriesWrites (false in repo).',
  sale: 'Puppy enquiries. The hub button also needs config cdhub.enquiriesWrites (false in repo).',
  weighing: 'Append-only.',
  vaccination: 'Append; vaccination_void fills voided_on/voided_by on the newest row (never deletes).',
  dog_details: 'Overwrites the dog row (name, sex, DOB, colour, neuter) and the microchip row IN PLACE; no old value kept.',
  subject_create: 'Adds a dog: subject + subject_status (+ microchip). Same name + DOB of an active dog refused.',
  subject_link: 'BFFs / Fren.; subject_link_end fills to_date only.',
  subject_video: 'RoseQuest share links only. A change is a new row with corrects_id. Nothing is copied to Drive.',
  files: 'Stores bytes in the FILES_FOLDER_ID folder plus one row; link rows need no folder.',
  links: 'max_per_from can end older open rows in the same save.',
  dog_photo: 'No TABLE_ON switch (Risks found, R1). Overwrites the photo cell of the dog row.',
  code_register: 'Owner page only (Google sign-in). Codes still work while off; the reply says mirrored:false.',
  staff: 'Proposed: refused whatever its switch says. Behind TABLE_ON_staff (off) once moved into TABLES.'
};

const esc = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

function rows() {
  const env = makeEnv();
  const c = env.ctx;
  const out = [];
  const pend = c.BLD.PENDING_FILE;

  Object.keys(c.TABLES).forEach((k) => {
    const s = c.TABLES[k];
    const mode = k === 'occupancy' ? 'direct (forced)' : (s.defaultMode === 'direct' ? 'direct' : 'pending');
    const lookups = (s.lookups || []).map((l) => l.file).filter((f, i, a) => a.indexOf(f) === i);
    const needs = ['header ' + s.columns.filter(Boolean).length + ' cols'].concat(lookups.length ? ['reads ' + lookups.join(', ')] : []);
    if (k === 'readings') needs.push('reading_kinds + reading_limits rows');
    if (k === 'check_log') needs.push('check_type rows');
    if (k === 'check_value') needs.push('check_field rows; TABLE_ON_check_log');
    out.push({
      id: k, kind: 'table (action add)', sw: 'TABLE_ON_' + k + (k === 'occupancy' ? '' : '; MODE_' + k),
      dflt: 'off', live: LIVE[k] || UNKNOWN,
      writes: (mode === 'pending' ? pend + ' (queue), then ' + s.file + ' on approve' : s.file) + (s.perms.correct.length ? '; corrections to ' + pend : ''),
      master: ENQUIRIES[k] ? 'yes (enquiries)' : (MASTER[k] ? 'yes' : 'no'),
      needs: needs.join('; '), mode, who: s.perms.add.join(', ') || '(none: written by check_log)', risk: RISK[k] || ''
    });
  });

  const dc = c.DOGCARD_;
  const dcRows = [
    ['weighing', 'weighing', 'OWNER, STAFF', 'header ' + dc.weighing.need.join(', ') + '; reads BLD-subject'],
    ['vaccination', 'vaccination, vaccination_void', 'OWNER, STAFF', 'header ' + dc.vaccination.need.join(', ') + ' (+ voided_on, voided_by for void)'],
    ['dog_details', 'dog_details', 'OWNER', 'header ' + dc.dog_details.need.join(', ') + '; BLD-microchip (id, subject_id, chip_number); BLD-coat_colour'],
    ['subject_create', 'subject_create', 'OWNER', 'header ' + dc.subject_create.need.join(', ') + '; BLD-species rows; BLD-subject_status file; BLD-microchip if a chip'],
    ['subject_link', 'subject_link, subject_link_end', 'OWNER', 'link_kind.<kind> rows in BLD-breeding_rule; header ' + dc.subject_link.need.length + ' cols'],
    ['subject_video', 'subject_video', 'OWNER, STAFF', 'header ' + dc.subject_video.need.join(', ') + '; RoseQuest share link only'],
    ['files', 'file_add', 'OWNER; a file.who_may row widens', 'FILES_FOLDER_ID (photo/upload); file.types + file.max_bytes rows; header ' + dc.files.need.length + ' cols']
  ];
  dcRows.forEach(([k, action, who, needs]) => {
    const s = dc[k];
    let writes = s.file;
    if (k === 'dog_details') writes = s.file + ' (row in place), ' + c.CHIP_FILE_;
    if (k === 'subject_create') writes = s.file + ', ' + c.STATUS_FILE_ + ', ' + c.CHIP_FILE_ + ' (if chip)';
    if (k === 'files') writes = s.file + ' + bytes in the FILES_FOLDER_ID folder';
    out.push({ id: k, kind: 'action ' + action, sw: 'TABLE_ON_' + s.on, dflt: 'off', live: LIVE[k] || UNKNOWN, writes,
      master: MASTER[k] ? 'yes' : 'no', needs, mode: 'direct', who, risk: RISK[k] || '' });
  });

  out.push({ id: 'links', kind: 'action link_add, link_end', sw: 'TABLE_ON_' + c.LINKS_.on, dflt: 'off', live: UNKNOWN, writes: c.LINKS_.file,
    master: 'yes', needs: 'link_kind.<role> rows (+ .from_tables/.to_tables/.max_per_from/.who_may); header ' + c.LINKS_.need.length + ' cols',
    mode: 'direct', who: 'OWNER; link_kind.<role>.who_may widens', risk: RISK.links });
  out.push({ id: 'dog_photo', kind: 'action dog_photo', sw: 'none (SAVE_ENABLED + DOG_PHOTOS_FOLDER_ID)', dflt: 'off (folder id missing)', live: UNKNOWN,
    writes: c.SUBJECT_FILE_ + ' photo cell + picture in the DOG_PHOTOS_FOLDER_ID folder', master: 'yes', needs: 'DOG_PHOTOS_FOLDER_ID; photo column in BLD-subject',
    mode: 'direct', who: 'OWNER, STAFF', risk: RISK.dog_photo });
  out.push({ id: 'code_register', kind: 'owner page: issue / rename / reset / revoke code', sw: 'TABLE_ON_' + c.CODE_REG.ON, dflt: 'off', live: UNKNOWN,
    writes: c.CODE_REG.FILE + '; note in ' + pend + '; STAFF_REGISTRY property', master: 'yes', needs: 'header ' + c.CODE_REG.COLUMNS.join(', '),
    mode: 'direct', who: 'owner (Google account in ADMIN_EMAILS)', risk: RISK.code_register });
  Object.keys(c.PROPOSED_TABLES).forEach((k) => {
    const s = c.PROPOSED_TABLES[k];
    out.push({ id: k, kind: 'proposed table', sw: 'TABLE_ON_' + k + ' (no effect until moved into TABLES)', dflt: 'off', live: LIVE[k] || UNKNOWN,
      writes: s.file + ' (refused today)', master: 'yes', needs: 'file absent on Drive; header ' + s.columns.length + ' cols',
      mode: 'pending (always)', who: s.perms.add.join(', '), risk: RISK[k] || '' });
  });

  // Other writers. None of these is reachable with a staff code alone.
  out.push({ id: 'owner_edit', kind: 'owner page: edit in place', sw: 'OWNER_EDIT_ENABLED', dflt: 'off', live: UNKNOWN,
    writes: 'tables marked ownerEditable: ' + Object.keys(c.TABLES).filter((k) => c.TABLES[k].ownerEditable === true).join(', '), master: 'yes', needs: 'owner signed in',
    mode: 'in place', who: 'owner (Google account)', risk: 'Overwrites in place; no old value kept by the script.' });
  out.push({ id: 'record_edit', kind: 'code: record_edit / record_archive / record_delete (Edit.gs, Q1/Q2)', sw: 'RECORD_EDIT_ON', dflt: 'off', live: UNKNOWN,
    writes: 'tables marked ownerEditable, in place or one row removed; BLD-audit_log.csv (append)', master: 'yes', needs: 'BLD-permission rows (defaults: owner edits and archives, nobody deletes)',
    mode: 'in place', who: 'per permission rows', risk: 'Every change logged with old and new values unless edit.log is no or the person may edit_unlogged; a delete is logged before the row goes.' });
  out.push({ id: 'approve', kind: 'owner page: approve / reject', sw: 'SAVE_ENABLED and the target table TABLE_ON switch, checked on approve', dflt: 'n/a', live: 'n/a',
    writes: pend + ' event + the queued row\'s file', master: 'depends', needs: 'owner signed in', mode: 'from queue', who: 'owner (Google account)',
    risk: 'Refused while saving or the table switch is off (Risks found, R5, fixed).' });
  out.push({ id: 'score_save', kind: 'action score_save', sw: 'TABLE_ON_' + c.SCORES_.on, dflt: 'off', live: UNKNOWN, writes: c.SCORES_.file + ' + ' + c.SCORES_.lineFile,
    master: 'no', needs: 'headers ' + c.SCORES_.need.length + ' + ' + c.SCORES_.lineNeed.length + ' cols (draft Stage 4 names)',
    mode: 'direct', who: 'OWNER', risk: 'Append only: a new save adds a row that replaces_id the one before; lines written before the assessment.' });
  out.push({ id: 'inspector', kind: 'owner page: inspector links; inspector reads', sw: 'none (owner page; READ_ENABLED for the reads)', dflt: 'n/a', live: 'n/a',
    writes: c.inspectFiles_().join(', ') + '; STAFF_REGISTRY property', master: 'no', needs: 'INSPECT_PAGE_URL, INSPECT_SCRIPT_ID (not secret)', mode: 'direct',
    who: 'owner; each inspector read appends to BLD-inspect_access', risk: 'No TABLE_ON switch (Risks found, R5). A read is refused if its log row cannot be written.' });
  out.push({ id: 'backup', kind: 'adminDailyBackup (timer)', sw: 'BACKUP_ON', dflt: 'off', live: UNKNOWN, writes: 'copies into BLD-backups/ (never the live files)',
    master: 'no', needs: 'adminInstallDailyBackup trigger', mode: 'copy', who: 'timer, as the script owner', risk: 'Copies pile up; never deletes.' });
  out.push({ id: 'create_empty', kind: 'adminCreateEmptyTables (editor Run)', sw: 'ALLOW_CREATE', dflt: 'off', live: UNKNOWN, writes: 'new header-only files, only if absent',
    master: 'no', needs: 'edit the TO_CREATE list', mode: 'create', who: 'editor', risk: 'Set ALLOW_CREATE back afterwards.' });
  return out;
}

const COLS = [
  ['Action / table key', 'id'], ['Kind', 'kind'], ['Switch', 'sw'], ['Default in repo', 'dflt'], ['LIVE 15 Nov 2026', 'live'],
  ['Writes to', 'writes'], ['Master table?', 'master'], ['Needs', 'needs'], ['Mode', 'mode'], ['Who may', 'who'], ['Risk note', 'risk']
];

function table() {
  const lines = ['| ' + COLS.map((c) => c[0]).join(' | ') + ' |', '|' + COLS.map(() => '---').join('|') + '|'];
  rows().forEach((r) => lines.push('| ' + COLS.map((c) => esc(r[c[1]])).join(' | ') + ' |'));
  return lines.join('\n') + '\n';
}

function block() { return START + '\n' + table() + END; }

function splice(doc) {
  const a = doc.indexOf(START), b = doc.indexOf(END);
  if (a < 0 || b < a) throw new Error('inventory markers not found');
  return doc.slice(0, a) + block() + doc.slice(b + END.length);
}

if (require.main === module) {
  const [flag, file] = process.argv.slice(2);
  if (!flag) { process.stdout.write(table()); }
  else if (flag === '--write' || flag === '--check') {
    const p = path.resolve(file || '');
    const doc = fs.readFileSync(p, 'utf8'), next = splice(doc);
    if (flag === '--write') { fs.writeFileSync(p, next); process.stdout.write('updated ' + path.basename(p) + '\n'); }
    else if (next !== doc) { process.stderr.write('inventory table is out of date: run node tools/save-inventory.js --write ' + file + '\n'); process.exit(1); }
    else process.stdout.write('inventory table matches the code\n');
  } else { process.stderr.write('usage: save-inventory.js [--write|--check <doc>]\n'); process.exit(2); }
}

module.exports = { rows, table, block, splice, START, END, LIVE };
