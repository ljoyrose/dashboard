'use strict';
/**
 * 8 Nov 2026: the breeder's own breeding rules (Lisa: entered by the user at setup, never hard-coded).
 * One row per rule version; a change is a new row from a later date; only an OWNER code may add one.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv, req, save } = require('./harness');
const fx = require('./fixtures');

const env0 = (props) => {
  const env = standardEnv({ props: Object.assign({ TABLE_ON_breeding_rule: 'true' }, props || {}) });
  env.addFile('BLD-breeding_rule.csv', fx.headerOnly(fx.BREEDING_RULE_HEADER));
  return env;
};
const rule = (env, fields, code) => save(env, req(env, { code: code || env.codes.owner, table: 'breeding_rule', fields }));
const recs = (env) => { const f = env.file('BLD-breeding_rule.csv')[0];
  const [h, ...rows] = env.ctx.csvParse_(f.content).filter((r) => !(r.length === 1 && r[0] === '')); return rows.map((r) => Object.fromEntries(h.map((c, i) => [c, r[i] || '']))); };

test('breeding rules: the owner adds the three rules, each one row, stamped with who and when', () => {
  const env = env0();
  for (const [k, v] of [['min_dam_age_months', '12'], ['max_litters_per_dam', '6'], ['min_months_between_litters', '12']]) {
    const r = rule(env, { rule_key: k, value: v, effective_from: '2020-01-01', source: 'licence conditions' });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.result.status, 'saved');
  }
  const rows = recs(env);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => r.value), ['12', '6', '12']);
  assert.ok(rows.every((r) => r.set_at && r.set_by && r.tenant_id === fx.TENANT && /^brl-/.test(r.id)));
});

test('breeding rules: a staff code cannot set them', () => {
  const env = env0();
  const r = rule(env, { rule_key: 'max_litters_per_dam', value: '6', effective_from: '2020-01-01' }, env.codes.staff);
  assert.equal(r.ok, false);
  assert.equal(recs(env).length, 0);
});

test('breeding rules: an unknown rule, a silly number or a missing date is refused', () => {
  const env = env0();
  assert.equal(rule(env, { rule_key: 'max_pups', value: '6', effective_from: '2020-01-01' }).code, 'INVALID');
  const big = rule(env, { rule_key: 'min_dam_age_months', value: '120', effective_from: '2020-01-01' });
  assert.equal(big.code, 'INVALID'); assert.match(big.fields.value, /6 to 48 months/);
  assert.equal(big.fields.confirm_unusual, 'Save anyway?');
  assert.equal(rule(env, { rule_key: 'max_litters_per_dam', value: '6' }).code, 'INVALID');
  assert.equal(recs(env).length, 0);
});

test('breeding rules: a value outside the usual range is a warning; "save anyway" keeps it (a council may allow it)', () => {
  const env = env0();
  const r = rule(env, { rule_key: 'min_months_between_litters', value: '40', effective_from: '2020-01-01', confirm_unusual: 'yes' });
  assert.equal(r.ok, true);
  assert.equal(recs(env).length, 1);
  assert.equal(recs(env)[0].value, '40');
  assert.equal('confirm_unusual' in recs(env)[0], false);          // not a column: nothing extra in the file
  assert.equal(rule(env, { rule_key: 'max_litters_per_dam', value: '4', effective_from: '2020-01-01', confirm_unusual: 'maybe' }).code, 'INVALID');
});

test('breeding rules: a change is a new row from a later date; an earlier or same date is refused (history is never rewritten)', () => {
  const env = env0();
  assert.equal(rule(env, { rule_key: 'max_litters_per_dam', value: '6', effective_from: '2020-01-01' }).ok, true);
  assert.equal(rule(env, { rule_key: 'max_litters_per_dam', value: '4', effective_from: '2026-01-01' }).ok, true);
  const back = rule(env, { rule_key: 'max_litters_per_dam', value: '5', effective_from: '2024-01-01' });
  assert.equal(back.code, 'INVALID'); assert.match(back.fields.effective_from, /already has a version from 2026-01-01/);
  assert.deepEqual(recs(env).map((r) => r.value), ['6', '4']);
});

test('breeding rules: the table has its own switch and is off by default', () => {
  const env = standardEnv();
  env.addFile('BLD-breeding_rule.csv', fx.headerOnly(fx.BREEDING_RULE_HEADER));
  const r = rule(env, { rule_key: 'max_litters_per_dam', value: '6', effective_from: '2020-01-01' });
  assert.equal(r.ok, false);
  assert.equal(recs(env).length, 0);
});

test('breeding rules: to_date is the last day a rule applies; blank = no end; an end before the start is refused', () => {
  const env = env0();
  assert.equal(rule(env, { rule_key: 'max_litters_per_dam', value: '4', effective_from: '2020-01-01', to_date: '2019-12-31' }).code, 'INVALID');
  assert.equal(rule(env, { rule_key: 'max_litters_per_dam', value: '4', effective_from: '2020-01-01', to_date: '2025-12-31' }).ok, true);
  assert.equal(rule(env, { rule_key: 'max_litters_per_dam', value: '6', effective_from: '2026-01-01' }).ok, true);
  const rows = recs(env);
  assert.deepEqual(rows.map(r => r.to_date), ['2025-12-31', '']);
  assert.equal(env.ctx.latestInForce_(rows, '2024-06-01', 'effective_from').value, '4');
  assert.equal(env.ctx.latestInForce_(rows, '2026-06-01', 'effective_from').value, '6');
});

test('breeding rules: a file without the to_date column is refused with nothing saved (header must change in the same sitting)', () => {
  const env = standardEnv({ props: { TABLE_ON_breeding_rule: 'true' } });
  env.addFile('BLD-breeding_rule.csv', fx.headerOnly(fx.BREEDING_RULE_HEADER.slice(0, -1)));
  assert.equal(rule(env, { rule_key: 'max_litters_per_dam', value: '4', effective_from: '2020-01-01' }).code, 'HEADER_MISMATCH');
});
