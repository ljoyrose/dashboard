'use strict';
/** BLDNeeds.coversDay (both copies): a target with no rows is open by default; opts.absentIs false makes it closed. */
const test = require('node:test');
const assert = require('node:assert/strict');

const R = (id, from, to) => ({ need_type: 'litter.jobs', target_table: 'litter', target_id: id, from_date: from, to_date: to || '' });

['../client/needs.js', '../../cdhub/staff/lib/needs.js'].forEach((p) => {
  const N = require(p);
  test(`coversDay ${p}: no rows = open by default, closed with absentIs false; rows decide either way`, () => {
    const rows = [R('ltr-1', '2026-10-01', '2026-12-01')];
    assert.equal(N.coversDay(rows, 'litter.jobs', 'litter', 'ltr-old', '2026-11-12'), true);
    assert.equal(N.coversDay(rows, 'litter.jobs', 'litter', 'ltr-old', '2026-11-12', { absentIs: false }), false);
    assert.equal(N.coversDay(rows, 'litter.jobs', 'litter', 'ltr-1', '2026-11-12', { absentIs: false }), true);
    assert.equal(N.coversDay(rows, 'litter.jobs', 'litter', 'ltr-1', '2026-12-02', { absentIs: false }), false);
    assert.equal(N.coversDay(rows, 'litter.jobs', 'litter', 'ltr-1', '2026-12-02'), false);
    assert.equal(N.coversDay(rows, 'litter.jobs', 'litter', 'ltr-old', '2026-11-12', { absentIs: true }), true);
  });
});
