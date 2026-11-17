'use strict';
/**
 * BLD schema v2 (15 Nov 2026, Lisa Q5, Q6, Q8): parties, products, lots, stock_movements, courses, doses, prescriptions,
 * product_dose_bands, certificate_kinds, certificates. Designed only: refused today whatever the switches say. These tests
 * pin that, and check each spec does what the master says once a later decision promotes it (simulated here only).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv, req, save } = require('./harness');
const fx = require('./fixtures');

const KEYS = ['parties', 'products', 'lots', 'stock_movements', 'courses', 'doses', 'prescriptions', 'product_dose_bands', 'certificate_kinds', 'certificates'];
const NOW = Date.UTC(2026, 10, 15, 10, 0, 0);
const allOn = () => Object.fromEntries(KEYS.map((k) => ['TABLE_ON_' + k, 'true']));

function promoted() {
  const env = standardEnv({ nowMs: NOW, props: allOn() });
  KEYS.forEach((k) => { const s = env.ctx.PROPOSED_TABLES[k]; env.addFile(s.file, fx.headerOnly(s.columns)); env.ctx.TABLES[k] = s; });
  return env;
}
const owner = (env, table, fields) => save(env, req(env, { code: env.codes.owner, table, fields }));
const staff = (env, table, fields) => save(env, req(env, { code: env.codes.staff, table, fields }));
const ok = (r) => { assert.equal(r.ok, true, JSON.stringify(r)); return r.result.id; };
const why = (r, col) => { assert.equal(r.ok, false, JSON.stringify(r)); return JSON.stringify(r).includes(col) ? r : assert.fail(col + ' not named: ' + JSON.stringify(r)); };

test('schema v2: every new table is refused today, even with its switch on and its file present', () => {
  const env = standardEnv({ nowMs: NOW, props: allOn() });
  KEYS.forEach((k) => { const s = env.ctx.PROPOSED_TABLES[k]; env.addFile(s.file, fx.headerOnly(s.columns)); });
  const w0 = env.writes.length;
  KEYS.forEach((k) => assert.equal(owner(env, k, { name: 'x' }).code, 'FILE_NOT_ALLOWED', k));
  assert.equal(env.writes.length, w0);
});

test('schema v2: neutral plural names, id and tenant_id first, S4.3 reserved names never typed in, no industry words', () => {
  const env = standardEnv();
  KEYS.forEach((k) => {
    const s = env.ctx.PROPOSED_TABLES[k];
    assert.equal(s.key, k); assert.equal(s.file, 'BLD-' + k + '.csv'); assert.match(k, /s$/, 'plural');
    assert.deepEqual(Array.from(s.columns.slice(0, 2)), ['id', 'tenant_id'], k);
    ['id', 'tenant_id', 'created_at', 'updated_at', 'set_by', 'set_on', 'given_by', 'at', 'by'].forEach((c) => assert.ok(!(c in s.input), k + '.' + c + ' is filled by the system'));
    s.columns.forEach((c) => assert.doesNotMatch(c, /dog|puppy|litter|kennel|vet_|animal|ofa/i, k + '.' + c));
    assert.equal(new Set(s.columns).size, s.columns.length, k + ' duplicate column');
  });
});

test('parties (Q6): the owner adds a practice or a maker with a permanent id; staff cannot; kind is person or organisation', () => {
  const env = promoted();
  const id = ok(owner(env, 'parties', { kind: 'organisation', name: 'Pretend Practice', country_iso: 'GB' }));
  assert.match(id, /^pty-/);
  assert.equal(staff(env, 'parties', { kind: 'organisation', name: 'Another' }).code, 'NOT_ALLOWED');
  why(owner(env, 'parties', { kind: 'company', name: 'X' }), 'kind');
  why(owner(env, 'parties', { kind: 'person', name: 'X', country_iso: 'gbr' }), 'country_iso');
});

test('doses (Q5): one table for every dose type, linked to its lot and course; the lot must be of the same product', () => {
  const env = promoted();
  const maker = ok(owner(env, 'parties', { kind: 'organisation', name: 'Pretend Maker' }));
  const vac = ok(owner(env, 'products', { name: 'Pretend Vaccine', dose_type: 'vaccine', maker_party_id: maker }));
  const worm = ok(owner(env, 'products', { name: 'Pretend Wormer', dose_type: 'wormer' }));
  why(owner(env, 'products', { name: 'Bad', dose_type: 'Vaccine shot' }), 'dose_type');
  const lot = ok(owner(env, 'lots', { product_id: vac, batch: 'B123', expires_on: '2027-06-30', quantity: '10' }));
  why(owner(env, 'lots', { product_id: vac, batch: 'B0', quantity: '0' }), 'quantity');
  const course = ok(owner(env, 'courses', { subject_id: 'sub-test-1', product_id: vac, dose_type: 'vaccine', steps: '2', from_date: '2026-11-01' }));
  // a two-shot course: step 1 by a staff code, with its lot
  const d1 = ok(staff(env, 'doses', { subject_id: 'sub-test-1', dose_type: 'vaccine', product_id: vac, lot_id: lot, course_id: course, course_step: '1', given_at: '2026-11-15T09:00:00Z', next_due_on: '2026-12-06' }));
  assert.match(d1, /^dos-/);
  why(staff(env, 'doses', { subject_id: 'sub-test-1', dose_type: 'vaccine', product_id: vac, course_id: course, course_step: '3', given_at: '2026-11-15T09:05:00Z' }), 'course_step');
  why(staff(env, 'doses', { subject_id: 'sub-test-1', dose_type: 'wormer', product_id: worm, lot_id: lot, given_at: '2026-11-15T09:10:00Z' }), 'lot_id');
  why(staff(env, 'doses', { subject_id: 'sub-test-1', dose_type: 'vaccine', product_id: vac, given_at: '2026-11-15T09:00:00Z', next_due_on: '2026-11-01' }), 'next_due_on');
  // the stock movement for that dose
  ok(staff(env, 'stock_movements', { lot_id: lot, quantity: '-1', reason: 'given', dose_id: d1 }));
  why(staff(env, 'stock_movements', { lot_id: lot, quantity: '0', reason: 'counted' }), 'quantity');
});

test('prescriptions and dose bands (Q5): dated rows with a source; a band top above its bottom', () => {
  const env = promoted();
  const p = ok(owner(env, 'products', { name: 'Pretend Tablet', dose_type: 'medicine' }));
  ok(owner(env, 'prescriptions', { subject_id: 'sub-test-1', product_id: p, from_date: '2026-11-15', to_date: '2026-11-22' }));
  why(owner(env, 'prescriptions', { subject_id: 'sub-test-1', product_id: p, from_date: '2026-11-15', to_date: '2026-11-01' }), 'to_date');
  ok(owner(env, 'product_dose_bands', { product_id: p, weight_from: '10', weight_to: '25', weight_unit_id: 'kg', amount: '1', unit_id: 'tablet', from_date: '2026-01-01', source: 'Pretend leaflet' }));
  why(owner(env, 'product_dose_bands', { product_id: p, weight_from: '25', weight_to: '10', amount: '1', unit_id: 'tablet', from_date: '2026-01-01', source: 'x' }), 'weight_to');
  why(owner(env, 'product_dose_bands', { product_id: p, amount: '1', unit_id: 'tablet', from_date: '2026-01-01' }), 'source');
});

test('certificates (Q8): one table for any record and any industry; the kind is an owner row; expiry after issue', () => {
  const env = promoted();
  ok(owner(env, 'certificate_kinds', { kind_key: 'hips', label: 'Hip score', grades_shape: 'pair' }));
  ok(owner(env, 'certificate_kinds', { kind_key: 'gas_safety', label: 'Gas safety check', grades_shape: 'pass_fail' }));
  const issuer = ok(owner(env, 'parties', { kind: 'organisation', name: 'Pretend Scheme' }));
  const c = ok(owner(env, 'certificates', { subject_table: 'subjects', subject_id: 'sub-test-1', cert_kind_key: 'hips', issuer_party_id: issuer, issued_on: '2026-05-01', grades: '4/5' }));
  assert.match(c, /^crt-/);
  ok(owner(env, 'certificates', { subject_table: 'areas', subject_id: 'area-1', cert_kind_key: 'gas_safety', issued_on: '2026-03-02', expires_on: '2027-03-01', result: 'pass' }));
  why(owner(env, 'certificates', { subject_table: 'subjects', subject_id: 'sub-test-1', cert_kind_key: 'nope', issued_on: '2026-05-01' }), 'cert_kind_key');
  why(owner(env, 'certificates', { subject_table: 'areas', subject_id: 'area-1', cert_kind_key: 'gas_safety', issued_on: '2026-03-02', expires_on: '2026-01-01' }), 'expires_on');
  assert.equal(staff(env, 'certificates', { subject_table: 'areas', subject_id: 'area-1', cert_kind_key: 'gas_safety', issued_on: '2026-03-02' }).code, 'NOT_ALLOWED');
});
