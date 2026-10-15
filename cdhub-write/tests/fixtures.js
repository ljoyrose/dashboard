'use strict';
/**
 * FAKE sample data for tests. None of this is real: the tenant, rooms, dogs and people are made up.
 * Built in code (not stored as .csv in the repo). `node tests/write-fixtures.js` writes copies
 * to tests/fixtures/ so a person can open them.
 */
const TENANT = 'ten-test';

const crlf = (lines) => lines.join('\r\n') + '\r\n';

function csvFiles() {
  return {
    'BLD-area.csv': crlf([
      'id,tenant_id,code,grouping,group_sort,area_value,area_unit_id,m2_confirmed,m2_note',
      `area-t1,${TENANT},T1,T - Test house,1,10.00,u-m2,yes,`,
      `area-t2,${TENANT},T2,T - Test house,1,9,u-m2,yes,"fake note, with a comma"`,
      `area-t3-1,${TENANT},T3.1,T - Test cabins,2,4.5,u-m2,NO,`
    ]),
    'BLD-subject.csv': crlf([
      'id,tenant_id,name',
      `sub-test-a,${TENANT},Test A`,
      `sub-test-b,${TENANT},Test B`
    ]),
    'BLD-person.csv': crlf([
      'id,tenant_id,full_name',
      `per-test-1,${TENANT},Pat Tester`
    ]),
    'BLD-role.csv': crlf([
      'id,tenant_id,code,name,can_sign_off,notes',
      `rol-owner,${TENANT},OWNER,Licence holder,yes,`,
      `rol-staff,${TENANT},STAFF,Kennel staff,no,`
    ])
  };
}

const AREA_READING_HEADER = [
  'id', 'tenant_id', 'area_id', 'reading_type', 'min_c', 'max_c', 'spot_c', 'precision_dp',
  'period_start', 'taken_at', 'taken_by', 'device_id', 'reset_after_reading',
  'applied_limit_id', 'in_range', 'compliant', 'mitigation_required', 'corrects_id', 'mitigation_note'
];
const PENDING_HEADER = [
  'event_id', 'pending_id', 'event', 'at', 'by', 'role', 'target_file',
  'kind', 'row_id', 'corrects_id', 'note', 'payload_json', 'result'
];
const STAFF_HEADER = ['id', 'tenant_id', 'person_id', 'role', 'employment', 'started_on', 'ended_on', 'corrects_id'];

const headerOnly = (cols) => cols.join(',') + '\r\n';

module.exports = { TENANT, csvFiles, AREA_READING_HEADER, PENDING_HEADER, STAFF_HEADER, headerOnly };
