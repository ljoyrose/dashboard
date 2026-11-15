// Enquiry rows queued for the BLD tables. Invented names only. Nothing is written straight into a table.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv, req, save } = require('./harness');

const HEAD = {
  'BLD-household.csv': 'id,tenant_id,name,primary_person_id,stage',
  'BLD-household_member.csv': 'id,tenant_id,household_id,person_id',
  'BLD-subject_owner.csv': 'id,tenant_id,subject_id,person_id,household_id,role',
  'BLD-sale.csv': 'id,tenant_id,subject_id,person_id,household_id,deposit,deposit_date,sold_on,price'
};

function env() {
  const e = standardEnv({ props: {
    TABLE_ON_person: 'true', TABLE_ON_household: 'true', TABLE_ON_household_member: 'true',
    TABLE_ON_subject_owner: 'true', TABLE_ON_sale: 'true', MODE_person: 'direct'
  } });
  Object.keys(HEAD).forEach((name) => e.addFile(name, HEAD[name] + '\r\n'));
  return e;
}

test('a buyer row waits for the owner even when the mode says direct, and staff cannot add one', () => {
  const e = env();
  const before = e.text('BLD-person.csv');
  const staff = save(e, req(e, { table: 'person', fields: { full_name: 'Sample Buyer A' } }));
  assert.equal(staff.code, 'NOT_ALLOWED');
  const off = standardEnv();
  assert.equal(save(off, req(off, { table: 'person', code: off.codes.owner, fields: { full_name: 'Sample Buyer A' } })).code, 'TABLE_OFF');
  const queued = save(e, req(e, { table: 'person', code: e.codes.owner, fields: { full_name: 'Sample Buyer A' } }));
  assert.equal(queued.ok, true, queued.message);
  assert.equal(queued.result.status, 'queued');
  assert.equal(e.text('BLD-person.csv'), before);
  assert.equal(save(e, req(e, { table: 'BLD-prospect.csv', code: e.codes.owner, fields: {} })).code, 'FILE_NOT_ALLOWED');
});

test('a subject owner row needs a dog that is already in the list', () => {
  const e = env();
  const bad = save(e, req(e, { table: 'subject_owner', code: e.codes.owner, fields: { subject_id: 'sub-missing', person_id: 'per-test-1', household_id: 'hhd-missing', role: 'assigned' } }));
  assert.equal(bad.ok, false);
  assert.match(JSON.stringify(bad.fields || {}), /Not found|Cannot check/);
});
