'use strict';
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

test('t-site-import-age-test-1', () => {
  const env = env0();
  const made = save(env, req(env, { code: env.codes.user, table: 'check_type', fields: { type_key: 'exercise_all', label: 'Exercise', target: 'none', site_scope: 'one_line', effective_from: '2026-01-01' } }));
  assert.equal(made.ok, true, JSON.stringify(made));
  const id = made.result.id;
  const old = '2026-10-01T12:00:00Z';
  const refused = save(env, req(env, { code: env.codes.user, table: 'check_log', action: 'add_site', fields: { check_type_id: id, outcome: 'ok', how_recorded: 'import', happened_at: old } }));
  assert.equal(refused.code, 'INVALID');
  assert.match(JSON.stringify(refused.fields || {}), /happened_at|7 days|save anyway/i);
  const kept = save(env, req(env, { code: env.codes.user, table: 'check_log', action: 'add_site', fields: { check_type_id: id, outcome: 'ok', how_recorded: 'import', happened_at: old, confirm_unusual: 'yes' } }));
  assert.equal(kept.ok, true, JSON.stringify(kept));
  const rows = recs(env, 'BLD-check_log.csv');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].happened_at, old);
  assert.equal(rows[0].how_recorded, 'import');
  assert.equal(Object.prototype.hasOwnProperty.call(rows[0], 'confirm_unusual'), false);
});

