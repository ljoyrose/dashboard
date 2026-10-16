'use strict';
/**
 * FAKE sample data for tests. None of this is real: the tenant, rooms, dogs and people are made up.
 * Built in code (not stored as .csv in the repo). `node tests/write-fixtures.js` writes copies
 * to tests/fixtures/ so a person can open them.
 */
const TENANT = 'ten-test';

const crlf = (lines) => lines.join('\r\n') + '\r\n';

const OCCUPANCY_HEADER = ['id', 'tenant_id', 'subject_id', 'area_id', 'off_site_kind', 'moved_in', 'moved_out', 'classification', 'classification_note'];
const VIS_HEADER = 'id,tenant_id,table_name,field_name,audience_id,visible,condition,redaction,set_by,set_on,reason';
let visN = 0;
const vis = (table, field, aud, visible, cond = '', red = '') => `fv-t${String(++visN).padStart(3, '0')},${TENANT},${table},${field},${aud},${visible},${cond},${red},fixture,2026-10-16,fake row`;
const VISIBILITY_ROWS = [VIS_HEADER]
  .concat(['id', 'code', 'grouping', 'group_sort'].map((f) => vis('area', f, 'aud-staff', 'yes')), [vis('area', '*', 'aud-staff', 'yes')])
  .concat(['id', 'name', 'dob'].map((f) => vis('subject', f, 'aud-staff', 'yes')), [vis('subject', '*', 'aud-staff', 'yes')])
  .concat(['subject_id', 'state'].map((f) => vis('subject_status', f, 'aud-staff', 'yes')), [vis('subject_status', '*', 'aud-staff', 'yes')])
  .concat(['subject_id', 'area_id', 'off_site_kind', 'moved_in', 'classification'].map((f) => vis('occupancy', f, 'aud-staff', 'yes')), [vis('occupancy', '*', 'aud-staff', 'yes')])
  // earlier temperature entries: a member of staff sees only their OWN, from the last 14 days, and never the mitigation note
  .concat(['id', 'area_id', 'min_c', 'max_c', 'taken_at', 'taken_by', 'mitigation_note'].map((f) => vis('area_reading', f, 'aud-staff', 'yes')),
    [vis('area_reading', 'mitigation_note', 'aud-staff', 'no'), vis('area_reading', '*', 'aud-staff', 'yes', 'own_rows_days<=14')])
  // the owner (aud-admin) sees every row and column of the temperature log
  .concat(['id', 'area_id', 'min_c', 'max_c', 'taken_at', 'taken_by', 'mitigation_note'].map((f) => vis('area_reading', f, 'aud-admin', 'yes')), [vis('area_reading', '*', 'aud-admin', 'yes')])
  // a staff column whose condition we cannot apply stays hidden; a redaction too
  .concat([vis('subject', 'chip_number', 'aud-staff', 'yes', 'person is the recorded owner of THIS subject'), vis('subject', 'sex', 'aud-staff', 'yes', '', 'first letter only')]);

function csvFiles() {
  return {
    'BLD-area.csv': crlf([
      'id,tenant_id,code,grouping,group_sort,area_value,area_unit_id,m2_confirmed,m2_note',
      `area-t1,${TENANT},T1,T - Test house,1,10.00,u-m2,yes,`,
      `area-t2,${TENANT},T2,T - Test house,1,9,u-m2,yes,"fake note, with a comma"`,
      `area-t3-1,${TENANT},T3.1,T - Test cabins,2,4.5,u-m2,NO,`
    ]),
    'BLD-subject.csv': crlf([
      'id,tenant_id,name,dob,sex,chip_number',
      `sub-test-a,${TENANT},Test A,2020-01-01,Female,999000000000001`,
      `sub-test-b,${TENANT},Test B,2023-05-05,Male,999000000000002`,
      `sub-test-c,${TENANT},Test C,2022-02-02,Female,999000000000003`,
      `sub-test-d,${TENANT},Test D,2021-03-03,Male,999000000000004`,
      `sub-test-e,${TENANT},Test E,2019-04-04,Female,999000000000005`
    ]),
    // same header as the live BLD-occupancy.csv. Dog A moved room once; B has only an old undated row;
    // C is sold; D is owned by a family; E has no row at all.
    'BLD-occupancy.csv': crlf([
      OCCUPANCY_HEADER.join(','),
      `occ-a1,${TENANT},sub-test-a,area-t1,,2026-10-01,,,`,
      `occ-a2,${TENANT},sub-test-a,area-t2,,2026-10-10,,,`,
      `occ-b1,${TENANT},sub-test-b,area-t1,,,,"SLA label, not a place",`,
      `occ-c1,${TENANT},sub-test-c,,sold,,,Collected,`,
      `occ-d1,${TENANT},sub-test-d,,owned_by_family,,,,`
    ]),
    'BLD-subject_status.csv': crlf([
      'id,tenant_id,subject_id,state,from_date,to_date,reason',
      `sst-a,${TENANT},sub-test-a,Active,,,`,
      `sst-b,${TENANT},sub-test-b,In Training,,,`,
      `sst-c,${TENANT},sub-test-c,Sold,,,`
    ]),
    // same columns as the live BLD-field_visibility.csv. These FAKE rows are the PROPOSED staff rows
    // (docs: AA_2026-10-16_JOB4-PROPOSED-field_visibility-rows). Row rules use field_name *.
    'BLD-field_visibility.csv': crlf(VISIBILITY_ROWS),
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

const OCCUPANCY_CHECK_HEADER = ['id', 'tenant_id', 'confirmed_at', 'confirmed_by', 'dog_ids', 'moved_count', 'note'];

module.exports = { TENANT, csvFiles, AREA_READING_HEADER, PENDING_HEADER, STAFF_HEADER, OCCUPANCY_HEADER, OCCUPANCY_CHECK_HEADER, VIS_HEADER, headerOnly };
