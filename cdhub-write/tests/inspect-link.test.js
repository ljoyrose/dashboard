'use strict';
/** 12 Nov 2026 (BB): inspector links. Read-only, time-boxed, and they show only the dogs and fields Lisa ticked on that link. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv, req, save } = require('./harness');
const fx = require('./fixtures');

const H = {
  link: 'id,tenant_id,code_id,label,ends,made_at,made_by,starts_at,ends_at,data_from_date,data_to_date',
  linkV1: 'id,tenant_id,code_id,label,ends,made_at,made_by',
  subj: 'id,tenant_id,link_id,subject_id,from_date,to_date',
  field: 'id,tenant_id,link_id,table_name,field_name,redaction',
  access: 'id,tenant_id,link_id,code_id,table_name,rows,at'
};
const crlf = (lines) => lines.join('\r\n') + '\r\n';

function setup(opts = {}) {
  const env = standardEnv({ props: Object.assign({ READ_ENABLED: 'true' }, opts.props || {}) });
  env.email = 'owner@example.test';
  if (opts.files !== false) {
    env.addFile('BLD-inspect_link.csv', crlf([H.link]));
    env.addFile('BLD-inspect_link_subject.csv', crlf([H.subj]));
    env.addFile('BLD-inspect_link_field.csv', crlf([H.field]));
    env.addFile('BLD-inspect_access.csv', crlf([H.access]));
  }
  env.addFile('BLD-health_screen.csv', crlf([
    'id,tenant_id,subject_id,test,grade,tested_on',
    `hs-a,${fx.TENANT},sub-test-a,Hips,4/5,2025-06-01`,
    `hs-b,${fx.TENANT},sub-test-b,Hips,30/32,2025-07-01`,
    `hs-x,other-tenant,sub-test-a,Hips,99/99,2025-07-01`
  ]));
  // V9: how long a link lasts comes from rule rows (were the fixed 7 and 30 days)
  const rules = crlf(['id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by,to_date',
    `brl-x1,${fx.TENANT},external.default_hours.inspector,168,2026-01-01,test,,,,`, `brl-x2,${fx.TENANT},external.max_hours.inspector,720,2026-01-01,test,,,,`]);
  if (opts.rules !== false) { const rf = env.file('BLD-breeding_rule.csv'); if (rf.length) { rf[0].content = rules; rf[0].sheet = undefined; } else env.addFile('BLD-breeding_rule.csv', rules); }
  env.addFile('BLD-litter.csv', crlf(['id,tenant_id,dam_subject_id,dob', `lit-a,${fx.TENANT},sub-test-a,2024-03-03`, `lit-c,${fx.TENANT},sub-test-c,2024-04-04`]));
  return env;
}
const ok = (fn) => { try { return { ok: true, result: fn() }; } catch (e) { return { ok: false, code: e.code, fields: e.fields, message: e.userMessage || e.message }; } };
function read(env, code, table, over) {
  try { return { ok: true, result: env.ctx.sinkRead_(Object.assign({ v: 1, action: 'read', code, table }, over || {})) }; }
  catch (e) { return env.ctx.errorBody_(e); }
}
const make = (env, spec) => ok(() => env.ctx.sinkInspectMake_(Object.assign({
  label: 'Council visit', ends: '2026-10-20', subjects: ['sub-test-a'],
  fields: { subject: ['name', 'sex', { field: 'chip_number', redaction: 'last4' }], health_screen: ['test', 'grade', 'tested_on'], litter: ['dob'] }
}, spec), 'owner@example.test'));

test('a link shows only the ticked dogs and fields; chip as its last 4; other tenants never', () => {
  const env = setup();
  const m = make(env);
  assert.equal(m.ok, true, JSON.stringify(m));
  assert.match(m.result.code, /^[A-Z2-9]{16}$/);
  assert.equal(m.result.ends, '2026-10-20T23:59:59+01:00');
  const code = m.result.code;

  const s = read(env, code, 'subject');
  assert.equal(s.ok, true, JSON.stringify(s));
  assert.deepEqual(Array.from(s.result.fields), ['id', 'name', 'sex', 'chip_number']);   // the dog's id always comes, to join the lists
  assert.deepEqual(JSON.parse(JSON.stringify(s.result.rows)), [{ id: 'sub-test-a', name: 'Test A', sex: 'Female', chip_number: '0001' }]);
  assert.equal(s.result.ends, '2026-10-20T23:59:59+01:00');
  assert.equal(s.result.redacted.chip_number, 'last4');

  const h = read(env, code, 'health_screen');
  assert.deepEqual(JSON.parse(JSON.stringify(h.result.rows)), [{ subject_id: 'sub-test-a', test: 'Hips', grade: '4/5', tested_on: '2025-06-01' }]);
  const l = read(env, code, 'litter');
  assert.deepEqual(JSON.parse(JSON.stringify(l.result.rows)), [{ dam_subject_id: 'sub-test-a', dob: '2024-03-03' }]);   // keyed on the dam

  // a list with no ticked fields: nothing
  assert.equal(read(env, code, 'subject_status').code, 'NOT_ALLOWED');
  // the code is never written to any file; each read is logged by code id
  env.drive.forEach((f) => assert.equal(String(f.content || '').includes(code), false, f.title));
  const log = env.text('BLD-inspect_access.csv').trim().split(/\r?\n/).slice(1);
  assert.equal(log.length, 3);
  assert.match(log[0], new RegExp(`,${m.result.link_id},${m.result.code_id},subject,1,2026-10-15T23:30:00\\+01:00$`));
});

test('never a score list, never any list outside the inspector set, whatever the rows say; the permissions file is never consulted', () => {
  const env = setup();
  const m = make(env);
  const code = m.result.code;
  env.addFile('BLD-score_point.csv', crlf(['id,tenant_id,subject_id,points', `sp-1,${fx.TENANT},sub-test-a,10`]));
  // even a hand-typed field row and a person:<id> visibility row cannot open them
  const f = env.file('BLD-inspect_link_field.csv')[0];
  f.content += crlf([`x1,${fx.TENANT},${m.result.link_id},score_point,points,`, `x2,${fx.TENANT},${m.result.link_id},area,name,`]);
  const v = env.file('BLD-field_visibility.csv')[0];
  v.content = v.content.replace(/\r?\n?$/, '\r\n') + crlf([`fv-x,${fx.TENANT},score_point,*,person:${m.result.code_id},yes,,,t,2026-10-15,t`, `fv-y,${fx.TENANT},area,*,person:${m.result.code_id},yes,,,t,2026-10-15,t`, `fv-z,${fx.TENANT},area,name,person:${m.result.code_id},yes,,,t,2026-10-15,t`]);
  ['score_point', 'score_criterion', 'score_enrolment', 'area', 'area_reading', 'occupancy', 'check_log', '__proto__', 'constructor'].forEach((t) => {
    assert.equal(read(env, code, t).code, 'NOT_ALLOWED', t);
  });
  // making a link cannot tick a score list either
  assert.equal(make(env, { fields: { score_point: ['points'] } }).code, 'INVALID');
  assert.equal(make(env, { fields: { area: ['name'] } }).code, 'INVALID');
  // an inspector filter is refused, not ignored
  assert.equal(read(env, code, 'subject', { filter: { area_id: 'area-t1' } }).code, 'BAD_FILTER');
});

test('the link ends by itself at the end of its last day; Stop ends it at once; ended and stopped stay listed', () => {
  const env = setup();
  const a = make(env), b = make(env, { label: 'Second visit' });
  assert.equal(read(env, a.result.code, 'subject').ok, true);
  env.nowMs = Date.UTC(2026, 9, 20, 22, 59, 0);   // 23:59 London on the last day: still open
  assert.equal(read(env, a.result.code, 'subject').ok, true);
  env.nowMs = Date.UTC(2026, 9, 20, 23, 0, 0);    // midnight London: ended
  const r = read(env, a.result.code, 'subject');
  assert.equal(r.code, 'BAD_CODE');
  assert.equal(r.message, 'This link has ended.');

  env.nowMs = Date.UTC(2026, 9, 16, 10, 0, 0);
  assert.equal(ok(() => env.ctx.sinkInspectStop_(b.result.link_id, 'owner@example.test')).code, 'INVALID');   // a reason is needed
  assert.equal(ok(() => env.ctx.sinkInspectStop_(b.result.link_id, 'owner@example.test', 'visit finished')).ok, true);
  assert.equal(read(env, b.result.code, 'subject').code, 'BAD_CODE');
  const list = JSON.parse(JSON.stringify(env.ctx.sinkInspectLinks_()));
  assert.deepEqual(list.map((x) => [x.label, x.state, x.dogs, x.fields]), [['Second visit', 'stopped', 1, 7], ['Council visit', 'active', 1, 7]]);
  assert.equal(JSON.stringify(list).includes(a.result.code), false);
});

test('an inspector code can never save, on any list', () => {
  const env = setup({ props: { TABLE_ON_guest_reading: 'true', TABLE_ON_occupancy: 'true' } });
  const code = make(env).result.code;
  ['area_reading', 'guest_reading', 'occupancy', 'check_log'].forEach((t) => {
    const r = save(env, req(env, { code, table: t }));
    assert.equal(r.code, 'NOT_ALLOWED', t);
  });
  assert.equal(save(env, req(env, { code, action: 'add_site', table: 'check_log' })).code, 'NOT_ALLOWED');
});

test('dogs: only rows in force today; no dog rows means no rows; a link row for another code opens nothing', () => {
  const env = setup();
  const m = make(env, { subjects: ['sub-test-a', 'sub-test-b'] });
  assert.equal(read(env, m.result.code, 'subject').result.count, 2);
  const s = env.file('BLD-inspect_link_subject.csv')[0];
  s.content = s.content.replace(`${m.result.link_id},sub-test-b,2026-10-15,2026-10-20`, `${m.result.link_id},sub-test-b,2026-10-15,2026-10-14`);
  assert.equal(read(env, m.result.code, 'subject').result.count, 1);
  s.content = crlf([H.subj]);
  assert.equal(read(env, m.result.code, 'subject').result.count, 0);
  // the link row names a different code: this code finds no link
  const l = env.file('BLD-inspect_link.csv')[0];
  l.content = l.content.replace(`,${m.result.code_id},`, ',sc-zzzzzz,');
  assert.equal(read(env, m.result.code, 'subject').code, 'NOT_ALLOWED');
});

test('making a link: checks every choice, writes nothing on a refusal, and needs the four files', () => {
  const env = setup();
  const before = JSON.stringify(env.drive), reg = env.props.STAFF_REGISTRY;
  const bad = [
    [{ label: '' }, 'label'], [{ label: 'x'.repeat(81) }, 'label'], [{ ends: '2026-10-14' }, 'ends'], [{ ends: '2026-11-15' }, 'ends'], [{ ends: '2026-02-30' }, 'ends'],
    [{ subjects: [] }, 'subjects'], [{ subjects: ['sub-nope'] }, 'subjects'], [{ fields: {} }, 'fields'], [{ fields: { subject: ['tenant_id'] } }, 'fields'],
    [{ fields: { subject: ['nope'] } }, 'fields'], [{ fields: { subject: [{ field: 'name', redaction: 'blur' }] } }, 'fields'], [{ fields: { subject: 'name' } }, 'fields']
  ];
  bad.forEach(([over, field]) => {
    const r = make(env, over);
    assert.equal(r.code, 'INVALID', JSON.stringify(over));
    assert.ok(r.fields && r.fields[field], JSON.stringify(over));
  });
  assert.equal(JSON.stringify(env.drive), before);
  assert.equal(env.props.STAFF_REGISTRY, reg);
  // blank end = the external.default_hours.inspector rule row (168 hours from now)
  assert.equal(make(env, { ends: '' }).result.ends, env.ctx.londonIso_(new Date(env.nowMs + 168 * 3600000)));

  const env2 = setup({ files: false });
  assert.equal(make(env2).code, 'READ_NOT_CONFIGURED');
  assert.equal(env2.props.STAFF_REGISTRY.includes('INSPECTOR'), false);
});

test('owner page: only the signed-in owner can make, list or stop a link', () => {
  const env = setup();
  env.email = 'someone@example.test';
  ['ui_inspectChoices', 'ui_inspectLinks'].forEach((fn) => assert.equal(env.ctx[fn]().code, 'NOT_OWNER', fn));
  assert.equal(env.ctx.ui_inspectMake({ label: 'x', subjects: ['sub-test-a'], fields: { subject: ['name'] } }).code, 'NOT_OWNER');
  assert.equal(env.ctx.ui_inspectStop('ilk-x').code, 'NOT_OWNER');
  env.email = 'owner@example.test';
  const c = env.ctx.ui_inspectChoices();
  assert.equal(c.ok, true);
  assert.deepEqual(Array.from(c.result.lists.subject), ['id', 'name', 'dob', 'sex', 'chip_number']);
  assert.equal(c.result.lists.score_point, undefined);
  assert.equal(c.result.dogs.length, 5);
  assert.equal(c.result.page_url, '');
  env.props.INSPECT_PAGE_URL = 'https://example.test/cdhub/staff/inspect/';
  assert.equal(env.ctx.ui_inspectChoices().result.page_url, 'https://example.test/cdhub/staff/inspect/');
  env.props.INSPECT_PAGE_URL = 'http://example.test/x';
  assert.equal(env.ctx.ui_inspectChoices().result.page_url, '');
  env.props.INSPECT_SCRIPT_ID = 'bad id';
  assert.equal(env.ctx.ui_inspectChoices().result.script_id, '');
  const m = env.ctx.ui_inspectMake({ label: 'Vet visit', subjects: ['sub-test-a'], fields: { subject: ['name'] } });
  assert.equal(m.ok, true);
  assert.equal(env.ctx.ui_inspectLinks().result.links[0].state, 'active');
  // the owner's staff list shows the link as a code that ends, never the code itself
  const staff = JSON.stringify(env.ctx.ui_staffList());
  assert.ok(staff.includes('Inspector - Vet visit (ends ' + env.ctx.londonIso_(new Date(env.nowMs + 168 * 3600000)) + ')'));
  assert.equal(staff.includes(m.result.code), false);
});

test('owner page: Make a link ticks the suggested set, shows the link once with Copy, and Show links lists it with Stop', async () => {
  const { JSDOM } = require('jsdom');
  const fs = require('node:fs'), path = require('node:path');
  const env = setup({ props: { INSPECT_PAGE_URL: 'https://example.test/cdhub/staff/inspect/', INSPECT_SCRIPT_ID: 'AKfyTEST_id-123456' } });
  const html = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'ApprovePage.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://script.example.test/' });
  const w = dom.window;
  // google.script.run backed by the real server functions (in this test's sandbox)
  const run = () => {
    let ok = () => {};
    const p = new Proxy({}, { get: (_, k) => {
      if (k === 'withSuccessHandler') return (f) => { ok = f; return p; };
      if (k === 'withFailureHandler') return () => p;
      return (...a) => setTimeout(() => ok(JSON.parse(JSON.stringify(env.ctx[k](...a)))), 0);
    } });
    return p;
  };
  w.google = { script: { get run() { return run(); } } };
  w.confirm = () => true;
  w.prompt = () => 'visit finished';
  w.eval(html.split('<script>')[1].split('</script>')[0]);
  const tick = () => new Promise((r) => setTimeout(r, 5));
  const $ = (s) => w.document.querySelector(s);

  $('#in-new').click(); await tick();
  const form = $('#in-form');
  const boxes = [...form.querySelectorAll('label.tick')].map((l) => [l.textContent, l.querySelector('input').checked]);
  ['name', 'sex', 'dob', 'test', 'grade', 'tested_on'].forEach((c) => assert.equal(boxes.find(([t]) => t === c)[1], true, c));   // the suggested set starts ticked
  assert.equal(boxes.find(([t]) => t === 'chip_number')[1], false);   // the chip on the dog list is not in the suggested set
  assert.equal(boxes.some(([t]) => t === 'id' || t === 'subject_id' || t === 'dam_subject_id'), false);   // the dog key always comes, never ticked
  form.querySelector('input[type=text]').value = 'Council visit';
  [...form.querySelectorAll('label.tick')].find((l) => l.textContent === 'Test A').querySelector('input').checked = true;
  [...form.querySelectorAll('button')].find((b) => b.textContent === 'Make link').click(); await tick(); await tick();
  const once = $('#in-form .once').textContent;
  assert.match(once, /^https:\/\/example\.test\/cdhub\/staff\/inspect\/#s=AKfyTEST_id-123456&c=[A-Z2-9]{16}$/);
  const code = once.split('&c=')[1];
  assert.equal(read(env, code, 'subject').result.rows[0].name, 'Test A');
  assert.equal(read(env, code, 'subject').result.fields.includes('chip_number'), false);

  $('#in-show').click(); await tick();
  assert.match($('#in-list').textContent, /Council visit.*Working/);
  [...$('#in-list').querySelectorAll('button')].find((b) => b.textContent === 'End now').click(); await tick();
  assert.equal(read(env, code, 'subject').code, 'BAD_CODE');
  assert.equal($('#in-list').textContent.includes(code), false);
});

// V9 (13 Nov 2026, Lisa: "now for specific time or scheduled date time from to"): one window shape, limits from rule rows.
test('window: now for N hours, until HH:MM today, or scheduled from-to; the link says "Opens ..." until then', () => {
  const env = setup();
  const H = 3600000, start = env.nowMs;
  const a = make(env, { ends: undefined, hours: 2 });
  assert.equal(a.ok, true, JSON.stringify(a));
  assert.equal(a.result.ends_at, env.ctx.londonIso_(new Date(start + 2 * H)));
  assert.equal(read(env, a.result.code, 'subject').ok, true);
  env.nowMs = start + 2 * H + 1000;
  assert.equal(read(env, a.result.code, 'subject').code, 'BAD_CODE');
  env.nowMs = start;

  // scheduled: tomorrow 09:00 to 13:30 London
  const day = env.ctx.addDays_(env.ctx.todayLondon_(new Date(start)), 1);
  const s = make(env, { ends: undefined, starts_at: day + 'T09:00', ends_at: day + 'T13:30' });
  assert.equal(s.ok, true, JSON.stringify(s));
  const early = read(env, s.result.code, 'subject');
  assert.equal(early.code, 'NOT_YET');
  assert.match(early.message, /^This link opens \d\d\/\d\d\/\d\d 09:00\.$/);
  assert.equal(env.ctx.sinkInspectLinks_().find((x) => x.id === s.result.link_id).state, 'scheduled');
  env.nowMs = env.ctx.londonLocalMs_(day + 'T09:01');
  assert.equal(read(env, s.result.code, 'subject').ok, true);
  env.nowMs = env.ctx.londonLocalMs_(day + 'T13:31');
  assert.equal(read(env, s.result.code, 'subject').code, 'BAD_CODE');
  // the link row keeps both times
  const row = env.file('BLD-inspect_link.csv')[0].content;
  assert.ok(row.includes(day + 'T09:00:00'));
});

test('window: refused when the end is before the start, too long for the rule row, or a time has passed; no rule row = the owner must say', () => {
  const env = setup();
  const day = env.ctx.addDays_(env.ctx.todayLondon_(new Date(env.nowMs)), 1);
  assert.equal(make(env, { ends: undefined, starts_at: day + 'T13:00', ends_at: day + 'T09:00' }).fields.ends_at, 'The end must be after the start.');
  assert.match(make(env, { ends: undefined, hours: 721 }).fields.hours, /720 hours at most/);
  assert.equal(make(env, { ends: undefined, hours: 0 }).code, 'INVALID');
  assert.equal(make(env, { ends: undefined, until: '25:00' }).code, 'INVALID');
  const none = setup({ rules: false });
  assert.equal(make(none, { ends: undefined }).fields.ends_at, 'Choose when it ends.');
  assert.equal(make(none, { ends: undefined, hours: 2000 }).ok, true);   // no max row: the owner's own choice stands
  // a rule row from a later date is not in force yet
  const later = setup();
  const rf = later.file('BLD-breeding_rule.csv')[0];
  rf.content = rf.content.replace(/,2026-01-01,/g, ',2099-01-01,');
  assert.equal(make(later, { ends: undefined }).fields.ends_at, 'Choose when it ends.');
  assert.equal(env.ctx.sinkInspectChoices_().default_hours, 168);
  assert.equal(env.ctx.sinkInspectChoices_().max_hours, 720);
});

test('window: an old 7-column link file still works for links from now, but cannot hold a later start', () => {
  const env = setup();
  env.file('BLD-inspect_link.csv')[0].content = crlf([H.linkV1]);
  const a = make(env, { ends: undefined, hours: 4 });
  assert.equal(a.ok, true, JSON.stringify(a));
  assert.equal(read(env, a.result.code, 'subject').ok, true);
  const day = env.ctx.addDays_(env.ctx.todayLondon_(new Date(env.nowMs)), 1);
  assert.equal(make(env, { ends: undefined, starts_at: day + 'T09:00', ends_at: day + 'T10:00' }).fields.starts_at.includes('starts_at'), true);
});
