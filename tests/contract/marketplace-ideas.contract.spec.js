// MARKETPLACE PRODUCT IDEAS CONTRACT (MKT-IDEAS stage 1). No browser, no Google. Invented fixtures only.
// Each failure case proves itself: CONTRACT_PROVE_RED=1 flips it to expect "no problem", so it must go red.
const { test, expect } = require('@playwright/test');
const fs = require('fs'), path = require('path');
const { fixture, checkColumns, checkState, codes } = require('./shape');
const I = require('../../marketplace/ideas.js');

const RED = !!process.env.CONTRACT_PROVE_RED;
const caught = (problems, code) => (RED ? expect(problems).toEqual([]) : expect(codes(problems)).toEqual([code]));
const EXP = JSON.parse(fs.readFileSync(path.join(__dirname, 'expected-ideas.json'), 'utf8')), DET = EXP['MKT-IDEA-DETAIL.json'], REQ = EXP['MKT-IDEA-REQ.json'];
const detail = () => JSON.parse(fixture('marketplace/MKT-IDEA-DETAIL.json'));
const request = () => JSON.parse(fixture('marketplace/MKT-IDEA-REQ.json'));
const tab = () => JSON.parse(fixture('marketplace/ideas-open-work.json')).rows;
const edit = (fn) => { const d = detail(); fn(d); return d; };
const shape = (d) => checkState('MKT-IDEA-DETAIL.json', DET, d);
const values = (d) => I.checkDetail(d);

test.describe('Ideas contract: the invented files match the list @contract', () => {
  test('detail JSON: names and types are clean', () => { expect(shape(detail())).toEqual([]); });
  test('detail JSON: every value is allowed', () => { expect(values(detail())).toEqual([]); });
  test('request file: names and types are clean', () => { expect(checkState('MKT-IDEA-REQ.json', REQ, request())).toEqual([]); });
  test('idea rows use the Open work columns and the detail of every row is clean', () => {
    const rows = tab();
    expect(checkColumns('Open work tab', { columns: rows[0], by: 'position' }, rows[0])).toEqual([]);
    rows.slice(1).forEach((r) => { expect(r[1]).toBe('idea'); expect(r[0]).toBe(I.cardKey(r[0].split('|')[1])); expect(values(JSON.parse(r[4]))).toEqual([]); });
  });
  test('a fresh card from a request is valid, in the idea section, and carries the intake', () => {
    const row = I.cardRow(request());
    expect(row).toHaveLength(12); expect(row[1]).toBe('idea'); expect(row[0]).toBe('IDEA|IDEA-20261102-1530-sam1');
    const d = JSON.parse(row[4]);
    expect(values(d)).toEqual([]); expect(d.intake.barcode).toBe('4006381333931'); expect(d.gate).toBe(0); expect(d.verdict).toBe('');
  });
  test('fixtures hold only invented ids (SAMPLE or FAKE)', () => {
    const all = [fixture('marketplace/MKT-IDEA-DETAIL.json'), fixture('marketplace/MKT-IDEA-REQ.json'), fixture('marketplace/ideas-open-work.json')].join('\n');
    expect(all).toMatch(/SAMPLE/); expect(all).not.toMatch(/drive\.google\.com\/file\/d\/(?!SAMPLE|FAKE)/);
  });
});

test.describe('Ideas contract: each kind of change gives a named failure @contract', () => {
  test('missing: detail loses "gate"', () => { caught(shape(edit((d) => { delete d.gate; })), 'MISSING'); });
  test('renamed: detail "verdict" becomes "decision"', () => { caught(shape(edit((d) => { d.decision = d.verdict; delete d.verdict; })), 'RENAMED'); });
  test('extra: detail gains "colour"', () => { caught(shape(edit((d) => { d.colour = 'blue'; })), 'EXTRA'); });
  test('wrong type: "gate" is words', () => { caught(shape(edit((d) => { d.gate = 'one'; })), 'WRONG_TYPE'); });
  test('wrong type: "unit_inc_p" is a £ string (the New stock card needs pence)', () => { caught(shape(edit((d) => { d.unit_inc_p = '£3.00'; })), 'WRONG_TYPE'); });
  test('wrong type: an intake field is a number', () => { caught(shape(edit((d) => { d.intake.barcode = 4006381333931; })), 'WRONG_TYPE'); });
  test('empty: detail is {}', () => { caught(shape({}), 'EMPTY'); });
  test('empty: request is {}', () => { caught(checkState('MKT-IDEA-REQ.json', REQ, {}), 'EMPTY'); });
  test('missing: request loses "name"', () => { const r = request(); delete r.name; caught(checkState('MKT-IDEA-REQ.json', REQ, r), 'MISSING'); });
  test('value: gate 4 is refused', () => { caught(values(edit((d) => { d.gate = 4; })), 'BAD_VALUE'); });
  test('value: unknown branding is refused', () => { caught(values(edit((d) => { d.classification.branding = 'knockoff'; })), 'BAD_VALUE'); });
  test('value: 4 risks is refused (top 3 only)', () => { caught(values(edit((d) => { d.top3_risks = ['a', 'b', 'c', 'd']; })), 'BAD_VALUE'); });
  test('value: a verified claim with no source is refused', () => { caught(values(edit((d) => { d.evidence[0].source = ''; })), 'BAD_VALUE'); });
  test('value: dropped with no reason is refused', () => { caught(values(edit((d) => { d.status = 'dropped'; d.verdict = 'no'; d.dropped_reason = ''; })), 'MISSING'); });
  test('value: verdict no but not dropped is refused', () => { caught(values(edit((d) => { d.verdict = 'no'; })), 'BAD_VALUE'); });
  test('wrong type: margin is not a number', () => { caught(values(edit((d) => { d.margin_est.worst = 'low'; })), 'WRONG_TYPE'); });
});

test.describe('Ideas: the intake rules the Add idea form uses', () => {
  test('only the name is required', () => { const r = I.validateIntake({ name: 'SAMPLE x' }); expect(r.ok).toBe(true); expect(r.clean).toEqual({ name: 'SAMPLE x' }); });
  test('empty name is refused in plain words', () => { expect(I.validateIntake({ name: '  ' }).errors.name).toBe('Add a name'); });
  test('barcode: good check digit passes, spaces and dashes are ignored', () => {
    expect(I.validateIntake({ name: 'a', barcode: '4006381333931' }).ok).toBe(true);
    expect(I.validateIntake({ name: 'a', barcode: '4006 3813-33931' }).clean.barcode).toBe('4006381333931');
    expect(I.validateIntake({ name: 'a', barcode: '96385074' }).ok).toBe(true); // EAN-8
  });
  test('barcode: wrong check digit, letters or wrong length are refused', () => {
    ['4006381333932', '40063813339', 'ABC', '123'].forEach((b) => expect(I.validateIntake({ name: 'a', barcode: b }).errors.barcode).toBeTruthy());
  });
  test('links must be https; a Drive image link is fine; javascript: is refused', () => {
    expect(I.validateIntake({ name: 'a', link: 'https://example.invalid/x', image_link: 'https://drive.google.com/file/d/SAMPLE-IMG-0000/view' }).ok).toBe(true);
    ['javascript:alert(1)', 'http://example.invalid', 'example.invalid', 'https://a b'].forEach((u) => expect(I.validateIntake({ name: 'a', link: u }).errors.link).toBeTruthy());
  });
  test('price is normalised to £ and refused when not an amount', () => {
    expect(I.validateIntake({ name: 'a', price_seen: '4.5' }).clean.price_seen).toBe('£4.50');
    expect(I.validateIntake({ name: 'a', price_seen: '£4,50' }).clean.price_seen).toBe('£4.50');
    ['free', '-3', '0', '4.555'].forEach((p) => expect(I.validateIntake({ name: 'a', price_seen: p }).errors.price_seen).toBeTruthy());
  });
  test('request: ONE object, dry_run flag, id from the clock, only the intake keys', () => {
    const c = I.validateIntake({ name: 'SAMPLE x', note: 'n' }).clean, now = Date.UTC(2026, 10, 2, 15, 30);
    const r = I.buildRequest(c, now, 'SAMPLE-USER', { rand: 'ab12', dryRun: true });
    expect(r.id).toBe('IDEA-20261102-1530-ab12'); expect(I.fileName(r.id)).toBe('MKT-IDEA-REQ-IDEA-20261102-1530-ab12.json'); expect(r.dry_run).toBe(true);
    expect(Object.keys(r).sort()).toEqual(['at', 'barcode', 'by', 'dry_run', 'id', 'image_link', 'kind', 'link', 'name', 'note', 'own_audience_fit', 'price_seen', 'v', 'where_seen'].sort());
    expect(checkState('MKT-IDEA-REQ.json', REQ, r)).toEqual([]);
  });
  test('Go hand-off needs verdict go, a price in pence, a profit and a supplier', () => {
    expect(I.goReady(detail())).toEqual({ ok: false, missing: ['verdict go'] });
    expect(I.goReady(edit((d) => { d.verdict = 'go'; }))).toEqual({ ok: true, missing: [] });
    expect(I.goReady(edit((d) => { d.verdict = 'go'; delete d.supplier; delete d.unit_inc_p; })).missing).toEqual(['unit_inc_p', 'supplier']);
  });
});
