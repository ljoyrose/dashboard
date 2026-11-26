#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const TODAY = '2026-03-10';
const T = 'ten-sample';
const SRC = 'invented';
const OUT = __dirname;
const pad = (n) => String(n).padStart(2, '0');
const A = (n) => 'sub-a' + pad(n);
const P = (n) => 'sub-p' + pad(n);
const day = (iso, plus) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + plus); return d.toISOString().slice(0, 10); };

const files = {};
const table = (name, head, rows) => { files['BLD-' + name + '.csv'] = { head, rows }; };

// ---------- lookups ----------
table('tenant', 'id,name', [[T, 'Sample Kennel']]);
table('coat_colour', 'id,name,base_family,swatch_hex,nose_pigment_applies', [
  ['col-1', 'Cream', 'Cream', '#EFE3C8', 'true'], ['col-2', 'Gold', 'Gold', '#D9A441', 'true'],
  ['col-3', 'Chocolate', 'Chocolate', '#5B3A29', 'false'], ['col-4', 'Black', 'Black', '#2C2C2A', 'false'],
]);
table('coat_pattern', 'id,name', [['pat-1', 'Solid'], ['pat-2', 'Parti'], ['pat-3', 'Merle']]);
table('nose_pigment', 'id,name,code,swatch_hex', [['pig-1', 'Black nose', '(b)', '#2C2C2A'], ['pig-2', 'Rose nose', '(r)', '#B5766B']]);

// ---------- rooms ----------
table('area', 'id,tenant_id,code,grouping,group_sort,area_value,area_unit_id,m2_confirmed,m2_note,use,source', [
  ['ar-1', T, 'Room 1', 'Block A', 1, 12, 'u-m2', 'yes', '', 'Housing', SRC],
  ['ar-2', T, 'Room 2', 'Block A', 1, 12, 'u-m2', 'yes', '', 'Housing', SRC],
  ['ar-3', T, 'Room 3', 'Block A', 1, 10, 'u-m2', 'yes', '', 'Housing', SRC],
  ['ar-4', T, 'Room 4', 'Block B', 2, 10, 'u-m2', 'no', 'not measured yet', 'Housing', SRC],
  ['ar-5', T, 'Room 5', 'Block B', 2, 8, 'u-m2', 'yes', '', 'Whelping', SRC],
  ['ar-6', T, 'Room 6', 'Block B', 2, 8, 'u-m2', 'yes', '', 'Whelping', SRC],
  ['ar-7', T, 'Field 1', 'Fields', 9, 0, 'u-m2', 'yes', '', 'Fields', SRC],
  ['ar-8', T, 'Room 8', 'Block B', 2, 6, 'u-m2', 'yes', '', 'Housing', SRC],
]);
const SLEEP = ['ar-1', 'ar-2', 'ar-3', 'ar-4', 'ar-5', 'ar-6'];
const cap = [];
SLEEP.forEach((a) => {
  [['free', 4, 3, 2], ['limited', 3, 2, 1]].forEach(([mode, s, m, l]) => {
    cap.push([`cap-${a}-${mode}-s`, a, mode, 'small', s, SRC, '2020-01-01', '']);
    cap.push([`cap-${a}-${mode}-m`, a, mode, 'medium', m, SRC, '2020-01-01', '']);
    cap.push([`cap-${a}-${mode}-l`, a, mode, 'large', l, SRC, '2020-01-01', '']);
    if (a === 'ar-5' || a === 'ar-6') cap.push([`cap-${a}-${mode}-mp`, a, mode, 'medium + pups', 1, SRC, '2020-01-01', '']);
  });
});
table('area_capacity', 'id,area_id,access_type,size_band,max_dogs,basis,from_date,to_date', cap);
table('area_access', 'id,area_id,access_type,reason', SLEEP.map((a) => ['aa-' + a, a, a === 'ar-3' ? 'limited' : 'free', SRC]));
table('area_link', 'id,tenant_id,from_area_id,to_area_id,from_date,to_date', []);
table('requirement', 'id,tenant_id,need_type,target_table,target_id,from_date,to_date,source,set_by,set_on', [
  ['req-1', T, 'room.in_use', 'area', 'ar-8', '2020-01-01', '2025-12-31', SRC, '', ''],
  ['req-2', T, 'reading.temperature', 'thermometer', 'thm-8', '2020-01-01', '2025-12-31', SRC, '', ''],
]);
table('thermometer', 'id,tenant_id,name,area_id,made_at,made_by', [
  ['thm-1a', T, 'Room 1 door', 'ar-1', '', ''], ['thm-1b', T, 'Room 1 window', 'ar-1', '', ''],
  ['thm-2', T, 'Room 2', 'ar-2', '', ''], ['thm-3', T, 'Room 3', 'ar-3', '', ''], ['thm-4', T, 'Room 4', 'ar-4', '', ''],
  ['thm-5', T, 'Room 5', 'ar-5', '', ''], ['thm-6', T, 'Room 6', 'ar-6', '', ''], ['thm-8', T, 'Room 8', 'ar-8', '', ''],
]);
table('temperature_band', 'id,tenant_id,band,age_from_days,age_to_days,min_temp,temp_unit_id,max_temp,basis,ruling_needed,note,from_date,to_date', [
  ['tb-a', T, 'under four weeks', 0, 28, '26.0', 'u-c', '28.0', SRC, '', '', '', ''],
  ['tb-b', T, 'four weeks and over', 29, '', '10.0', 'u-c', '26.0', SRC, '', '', '', ''],
]);
table('temperature_action', 'id,direction,threshold_c,action,source', [
  ['ta-1', 'below', 10, 'Add bedding and switch the heater on', SRC], ['ta-2', 'above', 26, 'Open the vents and add a fan', SRC],
]);
const rd = [];
let rn = 0;
const reading = (area, thm, start, taken, min, max, extra) => rd.push(['rdg-' + pad(++rn), T, area, thm, 'temperature', min, max, start, taken, 'sample staff', (extra && extra.empty) || '', '', (extra && extra.method) || 'typed', '']);
['2026-01-15', '2026-02-10', '2026-03-09'].forEach((d) => {
  [['ar-1', 'thm-1a'], ['ar-2', 'thm-2'], ['ar-3', 'thm-3'], ['ar-4', 'thm-4'], ['ar-5', 'thm-5'], ['ar-6', 'thm-6']].forEach(([a, t], i) => {
    reading(a, t, d + 'T00:00:00+00:00', d + 'T08:0' + i + ':00Z', (12 + i).toFixed(1), (18 + i).toFixed(1));
    reading(a, t, d + 'T12:00:00+00:00', d + 'T16:0' + i + ':00Z', (13 + i).toFixed(1), (19 + i).toFixed(1));
  });
});
reading('ar-2', 'thm-2', TODAY + 'T00:00:00+00:00', TODAY + 'T08:05:00Z', '12.5', '18.0');
reading('ar-3', 'thm-3', TODAY + 'T00:00:00+00:00', TODAY + 'T08:10:00Z', '15.0', '28.5');
reading('ar-4', 'thm-4', TODAY + 'T00:00:00+00:00', TODAY + 'T08:15:00Z', '', '', { empty: 'yes' });
table('area_reading', 'id,tenant_id,area_id,thermometer_id,reading_type,min_c,max_c,period_start,taken_at,taken_by,room_empty,corrects_id,read_method,camera_value_changed', rd);
table('outdoor_temp', 'on_date,reading_kind,min_temp,max_temp,phrase,captured_at,source,rain_value,wind_kmh',
  [0, 1, 2, 3, 4, 5].map((i) => [day(TODAY, i), i ? 'forecast' : 'observed', 3 + i, 11 + i, i === 2 ? 'Cold and wet' : 'Mild', TODAY + 'T06:00:00Z', SRC, i === 2 ? 6 : 0, i === 3 ? 45 : 12]));

// ---------- animals ----------
const ADULTS = [
  [1, 'Female', '2021-04-12', 'Breeding Female', 'entire', 'medium', 'col-1', 'pat-1', 'ar-5', 'Breeding Bitch', 'Active', ''],
  [2, 'Female', '2020-09-03', 'Breeding Female', 'entire', 'medium', 'col-2', 'pat-1', 'ar-6', 'Breeding Bitch', 'Active', ''],
  [3, 'Female', '2022-01-15', 'Breeding Female', 'entire', 'medium', 'col-3', 'pat-1', 'ar-1', 'Breeding Bitch', 'Active', ''],
  [4, 'Female', '2021-11-30', 'Breeding Female', 'entire', 'small', 'col-1', 'pat-2', 'ar-1', 'Breeding Bitch', 'Active', ''],
  [5, 'Female', '2023-02-08', 'Breeding Female', 'entire', 'medium', 'col-2', 'pat-1', 'ar-2', 'Breeding Bitch', 'Active', ''],
  [6, 'Female', '2022-06-21', 'Breeding Female', 'entire', 'small', 'col-4', 'pat-1', 'ar-2', 'Breeding Bitch', 'Active', ''],
  [7, 'Female', '2019-02-01', 'Breeding Female', 'entire', 'medium', 'col-3', 'pat-3', 'ar-3', 'Breeding Bitch', 'Active', ''],
  [8, 'Female', '2023-08-19', 'Breeding Female', 'entire', 'medium', 'col-1', 'pat-1', 'ar-3', 'Breeding Bitch', 'Active', ''],
  [9, 'Male', '2020-03-14', 'Stud', 'entire', 'large', 'col-2', 'pat-1', 'ar-4', 'Stud Boy', 'Active', ''],
  [10, 'Male', '2022-10-02', 'Stud', 'entire', 'medium', 'col-4', 'pat-1', 'ar-4', 'Stud Boy', 'Active', ''],
  [11, 'Female', '2018-07-07', 'Adult', 'neutered', 'medium', 'col-1', 'pat-1', 'ar-3', 'Resident', 'Active', ''],
  [12, 'Male', '2019-12-25', 'Adult', 'neutered', 'small', 'col-3', 'pat-1', 'ar-2', 'Resident', 'Active', ''],
  [13, 'Female', '2025-07-20', 'Adult', 'entire', 'small', 'col-2', 'pat-2', 'ar-1', 'Resident', 'Active', ''],
  [14, 'Male', '2025-08-11', 'Adult', 'entire', 'small', 'col-1', 'pat-1', '', 'Training', 'In training', ''],
  [15, 'Female', '2024-03-03', 'Adult', 'entire', '', '', '', '', 'Resident', 'Active', ''],
  [16, 'Female', '2021-02-02', 'Breeding Female', 'entire', 'medium', 'col-2', 'pat-1', '', 'Owned by family', 'Active', 'owned_by_family'],
  [17, 'Male', '2022-05-17', 'Stud', 'entire', 'medium', 'col-4', 'pat-1', '', 'Owned by family', 'Active', 'owned_by_family'],
  [18, 'Female', '2017-01-09', 'Adult', 'neutered', 'medium', 'col-1', 'pat-1', '', 'Collected', 'Collected', ''],
  [19, 'Male', '2015-06-30', 'Adult', 'neutered', 'large', 'col-3', 'pat-1', '', 'Collected', 'Deceased', ''],
  [20, 'Male', '2024-11-11', 'Adult', 'entire', 'small', 'col-2', 'pat-1', '', 'Collected', 'Rehomed', ''],
];
const PUPS = [
  [1, 'Female', 'lit-1'], [2, 'Male', 'lit-1'], [3, 'Male', 'lit-1'], [4, 'Female', 'lit-1'],
  [5, 'Female', 'lit-2'], [6, 'Male', 'lit-2'], [7, 'Female', 'lit-2'],
];
const LITTER_DOB = { 'lit-1': '2026-01-20', 'lit-2': '2026-02-17' };
const LITTER_ROOM = { 'lit-1': 'ar-5', 'lit-2': 'ar-6' };
const subj = [], status = [], occ = [];
ADULTS.forEach(([n, sex, dob, kind, neuter, size, col, pat, room, cls, state, off]) => {
  subj.push([A(n), T, 'Dog A' + pad(n), sex, dob, size, n % 2 ? 'fleece' : 'wool', kind, neuter, SRC, 'dog', 'Sample Breed', col, pat, col ? 'pig-1' : '', '', '', n === 9 ? '2026-09-30' : '', '', '']);
  status.push(['st-a' + pad(n), T, A(n), state]);
  occ.push(['occ-a' + pad(n), T, A(n), room, off, room ? '2025-10-01' : '', '', cls, '']);
});
PUPS.forEach(([n, sex, lit]) => {
  subj.push([P(n), T, 'Pup P' + pad(n), sex, LITTER_DOB[lit], 'small', 'fleece', 'Pup', 'entire', SRC, 'dog', 'Sample Breed', n % 2 ? 'col-1' : 'col-2', 'pat-1', 'pig-1', lit, '', '', '', '']);
  status.push(['st-p' + pad(n), T, P(n), 'Active']);
  occ.push(['occ-p' + pad(n), T, P(n), LITTER_ROOM[lit], '', LITTER_DOB[lit], '', 'Litters', '']);
});
occ.push(['occ-a12-old', T, A(12), 'ar-3', '', '2025-06-01', '2025-09-30', '', '']);
table('subject', 'id,tenant_id,name,sex,dob,size_band,coat_type,kind,neuter_status,source,species,breed,coat_colour_id,coat_pattern_id,nose_pigment_id,birth_litter_id,rx_moxi_date,rx_moxi_expiry,rx_moxi_file_url,photo', subj);
table('subject_status', 'id,tenant_id,subject_id,state', status);
table('occupancy', 'id,tenant_id,subject_id,area_id,off_site_kind,moved_in,moved_out,classification,classification_note', occ);
table('status_label', 'code,label,match,source', []);

const chip = [];
ADULTS.forEach(([n]) => { if (n !== 15) chip.push(['mc-a' + pad(n), T, A(n), '9000000000001' + pad(n)]); });
[1, 2, 3, 4].forEach((n) => chip.push(['mc-p' + pad(n), T, P(n), '9000000000002' + pad(n)]));
table('microchip', 'id,tenant_id,subject_id,chip_number', chip);
table('microchip_registration', 'id,tenant_id,microchip_id,registry,registered_on', [['mr-1', T, 'mc-a01', 'Sample registry', '2021-06-12']]);

const wt = [];
ADULTS.forEach(([n, , , , , size]) => {
  if (n === 15 || n >= 18) return;
  const base = size === 'large' ? 27 : size === 'small' ? 8 : 14;
  ['2026-01-05', '2026-02-02', '2026-03-02'].forEach((d, i) => wt.push([A(n), d, (base + n / 10 + i * 0.2).toFixed(1), 'kg', i === 2 ? '5' : '', i === 2 ? '9' : '', SRC]));
});
PUPS.forEach(([n, , lit]) => {
  const weeks = lit === 'lit-1' ? 7 : 3;
  for (let w = 0; w <= weeks; w++) wt.push([P(n), day(LITTER_DOB[lit], w * 7), (0.3 + w * 0.45 + n / 100).toFixed(2), 'kg', '', '', SRC]);
});
table('weight', 'subject_id,performed_on,weight_kg,unit,body_condition_score,bcs_scale,source', wt);

const med = [];
let mn = 0;
const give = (sub, on, product, dose, route, need) => med.push(['dsp-' + pad(++mn), T, sub, on, product, '', dose, '', '', '', route, 'routine', SRC, need || '', '']);
[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach((n) => give(A(n), '2026-01-10', 'Med C', '1 tablet', 'Oral'));
[1, 2, 3, 4, 5, 6].forEach((n) => give(A(n), '2026-02-07', 'Med B', '1 pipette', 'Topical'));
give(A(4), '2026-02-12', 'NOT STATED', '1 tablet', 'Oral');
give(A(7), '2026-02-14', 'NOT STATED', '2 ml', 'Oral');
[1, 2, 3, 4].forEach((n) => give(P(n), '2026-03-03', 'Med A', '1 ml', 'Oral'));
give(A(9), '2026-03-04', 'Med C', '2 tablets', 'Oral');
table('dispense', 'id,tenant_id,subject_id,given_on,product,presentation,dose_volume,weight_band,weight_kg_used,dosage_basis,route,reason,source,ruling_needed,note', med);
table('medicinal_product', 'id,tenant_id,name,form,source', [['mp-1', T, 'Med C', 'tablet', SRC], ['mp-2', T, 'Med B', 'pipette', SRC], ['mp-3', T, 'Med A', 'liquid', SRC]]);
table('stock_level', 'id,tenant_id,product_id,counted_on,quantity', [['sl-1', T, 'mp-1', '2026-03-01', 24]]);

table('vaccination', 'id,tenant_id,subject_id,event_kind,product,product_shorthand,diseases_covered,batch,batch_use_by,given_on,route,administered_by,practice,titre_result,titre_lab,titre_protective,next_due_on_card,next_due_source,certificate_media_id,source,ruling_needed,note',
  [1, 2, 3, 4, 5, 6, 9].map((n) => ['vac-a' + pad(n), T, A(n), 'booster', 'Sample Vaccine', 'SV', 'sample diseases', 'B-SAMPLE', '2027-01-01', '2025-04-0' + (n % 9 + 1), 'injection', 'sample vet', 'Sample Practice', '', '', '', n === 9 ? '2026-02-01' : '2026-04-0' + (n % 9 + 1), 'card', '', SRC, '', ''])
    .concat([1, 2, 3, 4].map((n) => ['vac-p' + pad(n), T, P(n), 'primary', 'Sample Vaccine', 'SV', 'sample diseases', 'B-SAMPLE', '2027-01-01', '2026-03-05', 'injection', 'sample vet', 'Sample Practice', '', '', '', '2026-04-02', 'card', '', SRC, '', ''])));
table('dna_marker', 'id,code,name,note', [['dm-1', 'PRA', 'Sample marker one', ''], ['dm-2', 'VWD', 'Sample marker two', '']]);
table('dna_result', 'id,subject_id,marker_code,genotype,copies,interpretation,ruling_needed,lab,tested_on', [
  ['dna-1', A(1), 'PRA', 'N/N', 0, 'Clear', '', 'Sample Lab', '2025-03-01'], ['dna-2', A(1), 'VWD', 'N/M', 1, 'Carrier', '', 'Sample Lab', '2025-03-01'],
  ['dna-3', A(3), 'PRA', 'N/N', 0, 'Clear', '', 'Sample Lab', '2025-05-01'], ['dna-4', A(9), 'PRA', 'M/M', 2, 'Affected', '', 'Sample Lab', '2025-05-01'],
]);
table('health_screen', 'id,subject_id,test,grade,tested_on,certainty,attributed_to,source_text', [
  ['hs-1', A(1), 'hips', 'Good', '2025-06-01', 'clear', 'sample vet', 'sample hip score'], ['hs-2', A(9), 'hips', 'Excellent', '2025-06-01', 'clear', 'sample vet', 'sample hip score'],
  ['hs-3', A(7), 'elbows', '', '2024-06-01', 'possible', 'sample vet', 'sample elbow note'],
]);

table('litter', 'id,tenant_id,dam_subject_id,sire_subject_id,born_on,dob,pairing,status,raw_name,notes', [
  ['lit-0', T, A(7), A(9), '2024-07-03', '2024-07-03', 'Dog A07 x Dog A09', 'homed', 'Sample litter 0', SRC],
  ['lit-1', T, A(1), A(9), '2026-01-20', '2026-01-20', 'Dog A01 x Dog A09', 'on site', 'Sample litter 1', SRC],
  ['lit-2', T, A(2), A(9), '2026-02-17', '2026-02-17', 'Dog A02 x Dog A09', 'on site', 'Sample litter 2', SRC],
]);
table('mating', 'id,dam_subject_id,sire_subject_id,mated_on,mating_no,method,is_first_of_season,due_from_this_mating,litter_id,produced_litter,notes', [
  ['mat-0', A(7), A(9), '2024-05-01', 1, 'natural', 'yes', '2024-07-03', 'lit-0', 'yes', SRC],
  ['mat-1', A(1), A(9), '2025-11-18', 1, 'natural', 'yes', '2026-01-20', 'lit-1', 'yes', SRC],
  ['mat-2', A(2), A(9), '2025-12-16', 1, 'natural', 'yes', '2026-02-17', 'lit-2', 'yes', SRC],
  ['mat-3', A(3), A(10), '2026-01-12', 1, 'natural', 'yes', '2026-03-16', '', '', SRC],
]);

// ---------- rules, jobs, compliance ----------
const RULE = (id, k, v, from) => [id, T, k, v, from || '2020-01-01', SRC, '', '', '', ''];
table('breeding_rule', 'id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by,to_date', [
  RULE('br-1', 'size_colour.small', 'orange'), RULE('br-2', 'size_colour.medium', 'green'), RULE('br-3', 'size_colour.large', 'blue'),
  RULE('br-4', 'size_from_kg.medium', '10'), RULE('br-5', 'size_from_kg.large', '25'),
  RULE('br-6', 'compliance.due_soon_days', '30'), RULE('br-7', 'compliance.look_back_days', '7'), RULE('br-8', 'dog.adult_from_months', '6'),
  RULE('br-9', 'staffing.adults_per_full_time', '10'), RULE('br-10', 'staffing.adults_per_part_time', '20'),
  RULE('br-11', 'max_litters_per_dam', '6'), RULE('br-12', 'min_dam_age_months', '12'), RULE('br-13', 'min_months_between_litters', '12'),
]);
table('check_type', 'id,tenant_id,type_key,label,target,active,effective_from,source,every_days,group,includes,sop', [
  ['ct-1', T, 'nails', 'Nails', 'dog', 'true', '2026-01-01', SRC, 28, 'Grooming', '', 'Care Check'],
  ['ct-2', T, 'clean', 'Clean the room', 'area', 'true', '2026-01-01', SRC, 1, '', '', 'Cleaning'],
  ['ct-3', T, 'bowls', 'Wash the bowls', 'none', 'true', '2026-01-01', SRC, 1, '', '', 'Cleaning'],
  ['ct-4', T, 'report', 'Report', 'optional', 'true', '2026-01-01', SRC, '', '', '', ''],
]);
const log = [];
let ln = 0;
const done = (type, area, sub, at) => log.push(['cl-' + pad(++ln), T, type, area, sub, '', '', 'done', at, '', at, 'sample staff', '', '', 'typed']);
[1, 2, 3, 4, 5].forEach((n) => done('ct-1', '', A(n), '2026-02-20T10:00:00Z'));
SLEEP.forEach((a) => { done('ct-2', a, '', '2026-03-09T09:00:00Z'); });
['ar-1', 'ar-2'].forEach((a) => done('ct-2', a, '', TODAY + 'T08:30:00Z'));
done('ct-3', '', '', '2026-03-09T09:30:00Z');
table('check_log', 'id,tenant_id,check_type_id,area_id,subject_id,item,amount,outcome,happened_at,note,taken_at,taken_by,corrects_id,photo,how_recorded', log);
table('credential', 'id,tenant_id,label,area_id,sop,crucial,issuer,source', [
  ['cr-1', T, 'Sample licence', '', '', 'yes', 'Sample council', SRC], ['cr-2', T, 'Sample fire check', '', '', 'no', 'Sample service', SRC],
]);
table('credential_version', 'id,tenant_id,credential_id,from_date,to_date,source,set_by,set_on', [
  ['cv-1', T, 'cr-1', '2025-06-01', '2026-05-31', SRC, '', ''], ['cv-2', T, 'cr-2', '2025-03-20', '2026-03-20', SRC, '', ''],
]);
table('inspection', 'id,tenant_id,kind,authority,inspection_date,outcome_summary,visibility,source', [
  ['in-1', T, 'external', 'Sample council', '2025-06-01', 'Sample pass', 'disclosable', SRC], ['in-2', T, 'internal', '', '2026-02-01', '', 'private', SRC],
]);
table('outcome', 'id,tenant_id,species_id,code,text,domain,origin,is_law,source_hint,active,notes', [
  ['out-a', T, '', 'A', 'Sample requirement A', '', '', '', '', 'yes', ''], ['out-b', T, '', 'B', 'Sample requirement B', '', '', '', '', 'yes', ''],
]);
table('finding', 'id,tenant_id,inspection_id,declaration_id,outcome_id,authority,raised_on,wording_as_given,finding_kind,tenant_response,action_agreed,due_on,closed_on,evidence_document_id,notes', [
  ['fd-1', T, 'in-1', '', 'out-a', 'Sample council', '2025-06-01', 'Sample wording for an open finding', 'advisory', '', 'Sample action', '2026-04-01', '', '', ''],
  ['fd-2', T, 'in-1', '', 'out-b', 'Sample council', '2025-06-01', 'Sample wording for a closed finding', 'advisory', '', '', '2025-09-01', '2025-08-15', '', ''],
]);
table('declaration', 'id,tenant_id,declaration_key,text,source', [['dec-1', T, 'sample.declaration', 'Sample declaration', SRC]]);

// ---------- work list ----------
table('WORK', 'id,area,item,status,user,blocked_on,evidence,note', [
  ['W001', 'medicine', 'Identify the medicine given in February', 'BLOCKED', 'User', 'the name on the packet', '', ''],
  ['W002', 'medicine', 'Check the medicine given to Dog A09 in March', 'BLOCKED', 'User', '', '', ''],
  ['W003', 'rooms', 'Confirm the floor area of Room 4', 'BLOCKED', 'User', 'a tape measure reading', '', 'sample note'],
  ['W004', 'records', 'Sample item waiting on the helper', 'OPEN', 'Claude', '', '', ''],
  ['W005', 'records', 'Sample finished item', 'DONE', 'Claude', '', 'sample evidence', ''],
]);

table('association', 'id,name,acronym,country,country_iso,is_registry,recognises_cobberdog,status,listed_breeders,directory_url,note', [
  ['as-1', 'Sample Breed Club', 'SBC', 'Sampleland', 'ZZ', 'yes', 'yes', 'active', 3, '', SRC],
]);
table('prospect', 'id,kennel_name,contact_name,country,country_iso,region,categories,email,phone,whatsapp,website,facebook,instagram,linkedin,mdba_number,buyer_signal,upgrade_appetite,notes', [
  ['pr-1', 'Sample Kennel Two', 'Sample Person', 'Sampleland', 'ZZ', 'North', 'CAT-A', 'person@example.test', '', '', '', '', '', '', '', 'warm', 'medium', SRC],
]);
table('export_route', 'id,country,country_iso,difficulty,lead_time,requirement,conflict', [['er-1', 'Sampleland', 'ZZ', 'easy', '4 weeks', 'Sample paperwork', '']]);
table('breeder_category', 'id,code,name', [['bc-1', 'CAT-A', 'Sample category']]);
table('prospect_set', 'id,name', [['ps-1', 'Sample set']]);

table('qr_tag', 'tag,kind,ref_id,active', [
  ['ROOMAAAA', 'area', 'ar-1', 'true'], ['ROOMAAAB', 'area', 'ar-2', 'true'], ['ROOMAAAF', 'area', 'ar-6', 'true'],
  ['DOGAAAAD', 'subject', A(4), 'true'], ['DOGAAAAF', 'subject', A(6), 'true'], ['DOGAAAAK', 'subject', A(10), 'true'],
  ['LITAAAAB', 'litter', 'lit-2', 'true'], ['THMAAAAE', 'thermometer', 'thm-5', 'true'], ['SITEAAAA', 'site', 'site', 'true'],
]);

const plain = (name, n) => table(name, 'id,tenant_id,name,note', Array.from({ length: n || 1 }, (_, i) => [name.slice(0, 3) + '-' + (i + 1), T, 'Sample ' + name.replace(/_/g, ' ') + ' ' + (i + 1), SRC]));
['doc_type', 'jurisdiction', 'authority', 'unit', 'locale', 'species', 'frequency', 'checklist_template', 'checklist_template_item', 'checklist_instance',
  'deviation', 'verification', 'governed_by', 'sop', 'sop_version', 'role', 'visit', 'reminder', 'clinical_note'].forEach((n) => plain(n, 2));

const BB = path.join(__dirname, '..', 'breed-better');
['score_scheme', 'score_band', 'score_criterion', 'score_point', 'fit_to_breed', 'score_judgement'].forEach((n) => {
  const lines = fs.readFileSync(path.join(BB, 'BLD-' + n + '.csv'), 'utf8').trim().split(/\r?\n/);
  table(n, lines[0], lines.slice(1).map((l) => l.split(',')));
});
table('score_enrolment', 'id,tenant_id,scheme_id,subject_id,valid_from,is_active,source', [1, 3, 9].map((n, i) => ['en-' + (i + 1), T, 's-test', A(n), '2026-01-01', 'TRUE', SRC]));

table('_MANIFEST', 'file,table,rows,note', Object.keys(files).sort().map((f) => [f, f.replace(/^BLD-|\.csv$/g, ''), files[f].rows.length, 'invented sample']));

const cell = (v) => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const text = (f) => [files[f].head].concat(files[f].rows.map((r) => r.map(cell).join(','))).join('\n') + '\n';

if (require.main === module) {
  const check = process.argv.includes('--check');
  let diff = 0;
  Object.keys(files).sort().forEach((f) => {
    const p = path.join(OUT, f), want = text(f);
    if (check) { if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== want) { diff++; console.log('differs: ' + f); } } else fs.writeFileSync(p, want);
  });
  const animals = ADULTS.length + PUPS.length;
  console.log((check ? 'checked ' : 'wrote ') + Object.keys(files).length + ' files, ' + animals + ' animals' + (check ? ', ' + diff + ' differ' : ''));
  process.exit(diff ? 1 : 0);
}
module.exports = { TODAY, files: Object.keys(files).sort(), text, animals: ADULTS.length + PUPS.length };

