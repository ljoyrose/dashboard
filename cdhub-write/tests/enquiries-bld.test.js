// Enquiry rows queued for the BLD tables. Invented names only. Nothing is written straight into a table.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv, req, save } = require('./harness');

const HEAD = {
  'BLD-household.csv': 'id,tenant_id,household_name,primary_person_id,address_line,postcode,country,home_type,garden,other_pets,children_at_home,hours_alone_typical,work_pattern,stage,first_enquiry_on,source,notes,visibility,visible_from,visible_to,visibility_set_by',
  'BLD-household_member.csv': 'id,tenant_id,household_id,person_id,role,is_decision_maker,is_primary_handler,relationship_note,from_date,to_date,visibility,visible_from,visible_to,visibility_set_by',
  'BLD-subject_owner.csv': 'id,tenant_id,subject_id,person_id,household_id,role,from_date,to_date,transfer_document_id,microchip_transferred_on,registry_transferred_on,notes,visibility,visible_from,visible_to,visibility_set_by',
  'BLD-sale.csv': 'id,tenant_id,subject_id,person_id,household_id,sold_on,age_at_sale_days,microchip_number_at_sale,seen_with_dam,vet_record_given,price,deposit,deposit_date,contract_document_id,notes,visibility,visible_from,visible_to,visibility_set_by'
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

// 15 Nov 2026: the five tables carry the live headers (many owner columns). The page still sends `name` for a household;
// it lands in the live household_name column, and every other live column is written blank.
test('live headers: a queued household keeps its name in household_name, and the queue row lines up with the live header', () => {
  const e = env();
  const r = save(e, req(e, { table: 'household', code: e.codes.owner, fields: { name: 'Invented Home', primary_person_id: 'per-test-1', stage: 'enquiry' } }));
  assert.equal(r.ok, true, r.message);
  assert.equal(r.result.status, 'queued');
  const pend = e.text('BLD-_pending.csv');
  assert.match(pend, /household_name/);
  assert.match(pend, /Invented Home/);
  assert.deepEqual(Array.from(e.ctx.TABLES.household.columns), HEAD['BLD-household.csv'].split(','));
  ['household_member', 'subject_owner', 'sale'].forEach((k) => assert.deepEqual(Array.from(e.ctx.TABLES[k].columns), HEAD['BLD-' + k + '.csv'].split(',')));
});
