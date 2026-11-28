'use strict';
// Import of a daily record older than 7 days sends confirm_unusual = yes (job-calendar.js, PR #770).
// sinkSiteProcess_ rebuilds the fields for add_site. If it drops confirm_unusual, validateInput_ refuses the row.
// This loads the real Apps Script files (harness.js). Invented rows only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv, req, save } = require('./harness');
const fx = require('./fixtures');

function env0() {
  const env = standardEnv({ props: { TABLE_ON_check_type: 'true', TABLE_ON_check_log: 'true' } });
  env.addFile('BLD-check_type.csv', fx.headerOnly(env.ctx.TABLES.check_type.columns));
  env.addFile('BLD-check_log.csv', fx.headerOnly(env.ctx.TABLES.check_log.columns));
  return env;
}
const recs = (env, title) => {
  const f = env.file(title)[0];
  const [h, ...rows] = env.ctx.csvParse_(f.content).filter((r) => !(r.length === 1 && r[0] === ''));
  return rows.map((r) => Object.fromEntries(h.map((c, i) => [c, r[i] || ''])));
};

test('a whole-site import older than 7 days is saved when confirm_unusual is yes, and refused without it @regression', () => {
  const env = env0();
  const made = save(env, req(env, { code: env.codes.owner, table: 'check_type', fields: { type_key: 'water_bowls', label: 'Water bowls', target: 'none', site_scope: 'one_line', effective_from: '2026-01-01' } }));
  assert.equal(made.ok, true, JSON.stringify(made));
  const id = made.result.id;
  // DEFAULT_NOW in the harness is 2026-10-15, so this morning is more than 7 days earlier.
  const old = '2026-10-01T12:00:00Z';
  const refused = save(env, req(env, { code: env.codes.owner, table: 'check_log', action: 'add_site', fields: { check_type_id: id, outcome: 'ok', how_recorded: 'import', happened_at: old } }));
  assert.equal(refused.code, 'INVALID');
  assert.match(JSON.stringify(refused.fields || {}), /happened_at|7 days|save anyway/i);
  const kept = save(env, req(env, { code: env.codes.owner, table: 'check_log', action: 'add_site', fields: { check_type_id: id, outcome: 'ok', how_recorded: 'import', happened_at: old, confirm_unusual: 'yes' } }));
  assert.equal(kept.ok, true, JSON.stringify(kept));
  const rows = recs(env, 'BLD-check_log.csv');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].happened_at, old);
  assert.equal(rows[0].how_recorded, 'import');
  assert.equal(Object.prototype.hasOwnProperty.call(rows[0], 'confirm_unusual'), false);
});
