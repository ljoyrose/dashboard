// CD Hub Admin -> Visits (Lisa 13 Nov 2026): time-boxed visits by card or link. Invented rows only; the save script is pretend.
const { test: base, expect } = require('../support/test');
const { buildWorld, IDS } = require('../support/world');
const { tabClick } = require('../support/tabs');

const sha = (t) => 'sha256:' + require('crypto').createHash('sha256').update(t, 'utf8').digest('hex');
const SINK = 'https://script.google.com/macros/s/PRETEND-visits/exec';
const FV = 'id,tenant_id,table_name,field_name,audience_id,visible,condition,redaction,set_by,set_on,reason\nfv-1,ten-x,area,*,aud-staff,yes,,,test,2026-10-16,x\n';
const LINK_H = 'id,tenant_id,code_id,label,ends,made_at,made_by,usable_from,usable_to,visit_type_id,person_id,sign_in_id,card_tag_id,rights,lists,record_jobs,record_counts,as_of_from,as_of_to,email_code,revoked_at,revoked_by,revoke_reason,id_checked_by,accompanied_by,tz,issued_by,delegation_id,supersedes_id';
const LINK = [LINK_H,
  'il-old,ten-x,ic-1,Old style,2099-12-31,2026-11-01,test,,,,,,,,,,,,,,,,,,,,,,',
  'il-live,ten-x,ic-2,Pretend Inspector,,2026-11-01,test,2020-01-01T09:00:00+00:00,2099-01-01T17:00:00+00:00,vt-1,,,qt-1,view|review,subject,,,,,,,,,,,,,,',
  'il-soon,ten-x,ic-3,Pretend Vet,,2026-11-01,test,2098-05-01T09:00:00+01:00,2098-05-01T11:00:00+01:00,vt-1,,,,view,subject,,,,,,,,,,,,sc-a,dl-1,',
  'il-done,ten-x,ic-4,Pretend Ended,,2026-11-01,test,2020-01-01T09:00:00+00:00,2099-01-01T17:00:00+00:00,vt-1,,,qt-2,view,,,,,,,2021-01-01T10:00:00+00:00,owner,left,,,,,,',
  'il-live2,ten-x,,,,,,,2099-01-02T17:00:00+00:00,,,,,,,,,,,,,,,,,,,,il-live',
  'il-gone,ten-x,ic-5,Pretend Revoked,,2026-11-01,test,2020-01-01T09:00:00+00:00,2099-01-01T17:00:00+00:00,vt-1,,,,view,,,,,,,,,,,,,,,',
  'il-gone2,ten-x,,,,,,,,,,,,,,,,,,,2021-02-02T10:00:00+00:00,owner,left,,,,,,il-gone',
].join('\n') + '\n';
const TYPE_H = 'id,tenant_id,type_key,name,role_code,default_hours,max_hours,rights,lists,fields,data_years,record_jobs,record_counts,email_code,needs_id_check,terms_id,active,effective_from,set_at,set_by,source';
const TYPES = [TYPE_H,
  'vt-1,ten-x,inspector,Pretend Inspector type,,4,12,view|raise_finding,subject|microchip,,3,,,yes,,,yes,2026-01-01,,test,invented',
  'vt-0,ten-x,inspector,Older inspector,,2,6,view,subject,,3,,,,,,yes,2025-01-01,,test,invented',
  'vt-9,ten-x,later,Not yet,,1,2,view,,,,,,,,,yes,2099-01-01,,test,invented',
].join('\n') + '\n';
const TAGS = 'id,tenant_id,tag,kind,ref_id,active,made_at,made_by,fixed_type_id\nqt-1,ten-x,' + sha('VC1') + ',visitor_card,Visitor 1,yes,2026-11-01,test,\nqt-2,ten-x,' + sha('VC2') + ',visitor_card,Visitor 2,yes,2026-11-01,test,\nqt-3,ten-x,R1,area,area-1,yes,2026-11-01,test,\n';

const DELEG = 'id,tenant_id,power,holder_person_id,holder_code_id,holder_sign_in_id,parent_id,depth_left,from_at,to_at,visit_type_ids,max_hours,rights,lists,fields,area_ids,subject_ids,end_others,extend_others,ended_at,ended_by,end_reason,end_issued,conferred_by,conferred_at,source,notes\n'
  + 'dl-1,ten-x,give_visit,,sc-a,,,1,,,vt-1,6,view|raise_finding,,,,,yes,no,,,,,owner,2026-11-13,invented,\n'
  + 'dl-2,ten-x,give_visit,,sc-b,,dl-1,0,,,vt-1,4,view,,,,,no,no,,,,,sc-a,2026-11-13,invented,\n'
  + 'dl-3,ten-x,give_visit,,sc-c,,,0,,,,,,,,,,no,no,2026-11-01T10:00:00+00:00,owner,left,keep,owner,2026-10-01,invented,\n'
  + 'dl-4,ten-x,issue_code,,sc-c,,,0,,,,,,,,,,no,no,,,,,owner,2026-10-01,invented,\n';
const CODES = 'id,tenant_id,code_id,who,role,from_date,to_date,ended_by\ncr-a,ten-x,sc-a,Manny,MANAGER,2026-10-01,,\ncr-b,ten-x,sc-b,Pretend Deputy,STAFF,2026-10-01,,\ncr-c,ten-x,sc-c,Pretend Gone,STAFF,2026-10-01,,\n';

function world({ types = true } = {}) {
  const d = buildWorld();
  const put = (id, name, body) => d.file(id, name, body, { parents: [IDS.bld], driveId: 'drv-alpha1' });
  put('v-fv', 'BLD-field_visibility.csv', FV);
  put('v-link', 'BLD-inspect_link.csv', LINK);
  if (types) put('v-type', 'BLD-visit_type.csv', TYPES);
  put('v-tag', 'BLD-qr_tag.csv', TAGS);
  put('v-deleg', 'BLD-delegation.csv', DELEG);
  put('v-codes', 'BLD-code_register.csv', CODES);
  return d;
}
const test = base.extend({ world: async ({}, use) => use(world()) });
const fresh = base.extend({ world: async ({}, use) => use(world({ types: false })) });

async function open(page) {
  await page.goto('cdhub/');
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
  await page.evaluate((url) => { localStorage.setItem('cdhub.sink.url', url); localStorage.setItem('cdhub.sink.code', 'pretend-code'); }, SINK);
}
async function saves(page, answer) {
  const bodies = [];
  await page.route(SINK, async (route) => {
    const b = JSON.parse(route.request().postData() || '{}'); bodies.push(b);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer ? answer(b) : { ok: true, result: { status: 'saved', id: 'new-1' } }) });
  });
  return bodies;
}
async function visits(page) {
  await tabClick(page, '#nav button[data-go="admin"]');
  await page.locator('[data-adm-open="visits"]').click();
  await expect(page.locator('#adm-visits')).toContainText('Active now');
}

test.describe('CD Hub Visits', () => {
  test('Active now and Coming up come from the rows; ended and old date-only links are judged by their window', async ({ page }) => {
    await open(page);
    await visits(page);
    const live = page.locator('#adm-visits .vis-sec').nth(0), soon = page.locator('#adm-visits .vis-sec').nth(1);
    await expect(live.locator('.vis-row')).toHaveCount(2);
    await expect(live).toContainText('Pretend Inspector');
    await expect(live).toContainText('Visitor 1');
    await expect(live).toContainText('Old style');
    await expect(live).not.toContainText('Pretend Ended');
    await expect(live).not.toContainText('Pretend Revoked');   // a later row revoked it: nothing is edited
    await expect(live.locator('[data-vis-link="il-live"]')).toContainText('02/01/99');   // the extension row's end, sent as the root id
    await expect(soon).toContainText('Pretend Vet');
    await expect(soon).toContainText('01/05/98');
    await expect(page.locator('[data-adm-open="visits"] small')).toHaveText('2 here now');
  });

  test('End now needs a reason, sends visit_end, then ticks and leaves the list', async ({ page }) => {
    await open(page);
    const bodies = await saves(page, () => ({ ok: true, result: { status: 'saved', ended_at: '2026-11-13T12:00:00+00:00' } }));
    await visits(page);
    await page.locator('[data-vis-end="il-live"]').click();
    await page.locator('form[data-vis-form="end"] [name="reason"]').fill('Visit finished');
    await page.locator('form[data-vis-form="end"] button[type="submit"]').click();
    await expect(page.locator('#adm-visits [role="status"]')).toHaveText('Ended ✓');
    expect(bodies[0].action).toBe('visit_end');
    expect(bodies[0].fields).toEqual({ link_id: 'il-live', reason: 'Visit finished' });
    await expect(page.locator('#adm-visits .vis-sec').nth(0)).not.toContainText('Pretend Inspector');
  });

  test('Give a visit by card, now for X hours: type in force today, free cards only, capped by the type', async ({ page }) => {
    await open(page);
    const bodies = await saves(page, () => ({ ok: true, result: { status: 'saved', link_id: 'il-new' } }));
    await visits(page);
    await page.locator('[data-vis-mode="give"]').click();
    const f = page.locator('form[data-vis-form="give"]');
    await expect(f.locator('[name="type"] option')).toHaveText(['Pretend Inspector type']);   // older version and later row hidden
    await expect(f.locator('[name="card"] option')).toHaveText(['Visitor 2']);   // Visitor 1 is in use; Visitor 2's visit ended
    await expect(f.locator('[name="hours"]')).toHaveValue('4');
    await f.locator('[name="name"]').fill('Pretend Person');
    await f.locator('[name="org"]').fill('Pretend Council');
    await f.locator('[name="purpose"]').fill('Annual inspection');
    await f.locator('[name="hours"]').fill('20');
    await f.locator('button[type="submit"]').click();
    await expect(page.locator('#adm-visits [role="status"]')).toContainText('Longest for Pretend Inspector type is 12 hours');
    expect(bodies.length).toBe(0);
    await page.locator('form[data-vis-form="give"] [name="hours"]').fill('3');
    await page.locator('form[data-vis-form="give"] button[type="submit"]').click();
    await expect(page.locator('.vis-row[data-vis-link="il-new"] .adm-ok')).toBeVisible();
    const b = bodies[0];
    expect(b.action).toBe('visit_give');
    expect(b.fields).toMatchObject({ visit_type_id: 'vt-1', card_tag_id: 'qt-2', visitor_name: 'Pretend Person', organisation: 'Pretend Council', usable_from: '', hours: '3', purpose_text: 'Annual inspection', grant_basis: 'voluntary', identity_assurance: 'none', rights: ['view', 'raise_finding'], lists: ['subject', 'microchip'], subject_ids: [] });
  });

  test('Give a visit by link, scheduled: DD/MM/YY HH:MM, email code from the type; the link shows once', async ({ page }) => {
    await open(page);
    const bodies = await saves(page, () => ({ ok: true, result: { status: 'saved', link_id: 'il-l', url: 'https://example.test/inspect/#t=PRETEND' } }));
    await visits(page);
    await page.locator('[data-vis-mode="give"]').click();
    await page.locator('form[data-vis-form="give"] [name="how"][value="link"]').check();
    await page.locator('form[data-vis-form="give"] [name="win"][value="sched"]').check();
    const f = page.locator('form[data-vis-form="give"]');
    await f.locator('[name="name"]').fill('Pretend Remote');
    await f.locator('[name="purpose"]').fill('Records check');
    await f.locator('[name="fd"]').fill('01/05/98'); await f.locator('[name="ft"]').fill('09:00');
    await f.locator('[name="td"]').fill('01/05/98'); await f.locator('[name="tt"]').fill('08:00');
    await f.locator('button[type="submit"]').click();
    await expect(page.locator('#adm-visits [role="status"]')).toContainText('The end is before the start');
    await f.locator('[name="tt"]').fill('11:30');
    await f.locator('button[type="submit"]').click();
    await expect(page.locator('#adm-visits [role="status"]')).toContainText('Type their email');
    await f.locator('[name="email"]').fill('someone@example.test');
    await f.locator('button[type="submit"]').click();
    await expect(page.locator('.vis-url')).toHaveText('https://example.test/inspect/#t=PRETEND');
    const b = bodies[0].fields;
    expect(b.card_tag_id).toBeUndefined();
    expect(b.usable_from).toMatch(/^2098-05-01T09:00:00[+-]\d\d:\d\d$/);
    expect(b.usable_to).toMatch(/^2098-05-01T11:30:00[+-]\d\d:\d\d$/);
    expect(b.email).toBe('someone@example.test');
    await page.locator('[data-vis-url]').click();
    await expect(page.locator('.vis-url')).toHaveCount(0);
    expect(await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage))).not.toContain('#t=PRETEND');
  });

  test('a refusal is said plainly and nothing is ticked', async ({ page }) => {
    await open(page);
    await saves(page, () => ({ ok: false, code: 'CARD_IN_USE', message: 'That card already has a visit then.' }));
    await visits(page);
    await page.locator('[data-vis-mode="give"]').click();
    const f = page.locator('form[data-vis-form="give"]');
    await f.locator('[name="name"]').fill('Pretend Person');
    await f.locator('button[type="submit"]').click();
    await expect(page.locator('#adm-visits [role="status"]')).toContainText('Type the purpose');
    await f.locator('[name="purpose"]').fill('Visit');
    await f.locator('button[type="submit"]').click();
    await expect(page.locator('#adm-visits [role="status"]')).toHaveText('NOT saved — That card already has a visit then.');
    await expect(page.locator('#adm-visits .adm-ok')).toHaveCount(0);
  });

  test('owner rescans a card: #/admin?visit_tag= opens End now for its visit, or Give for a free card', async ({ page }) => {
    await open(page);
    await page.evaluate(() => { location.hash = '#/admin?visit_tag=VC1'; });
    await expect(page.locator('form[data-vis-form="end"] [name="link_id"]')).toHaveValue('il-live');
    await page.evaluate(() => { location.hash = '#/admin?visit_tag=VC2'; });
    await expect(page.locator('form[data-vis-form="give"] [name="card"]')).toHaveValue('qt-2');
    await page.evaluate(() => { location.hash = '#/admin?visit_tag=' + 'sha256:x'; });   // the stored hash itself is not a card
    await expect(page.locator('#adm-visits [role="status"]')).toHaveText('That card is not on the list.');
  });
});

test.describe('CD Hub Visits: who can give visits', () => {
  test('only live give_visit rows list, with their limits and who passed it on; ending one ends its children', async ({ page }) => {
    await open(page);
    const bodies = await saves(page, () => ({ ok: true, result: { status: 'saved', ended_at: '2026-11-13T12:00:00+00:00' } }));
    await visits(page);
    await page.locator('[data-vis-mode="who"]').click();
    const rowsL = page.locator('#adm-visits .vis-row');
    await expect(rowsL).toHaveCount(2);   // ended row and the code power are not listed
    await expect(rowsL.nth(0)).toContainText('Manny');
    await expect(rowsL.nth(0)).toContainText('Pretend Inspector type · up to 6h · View, Review');
    await expect(rowsL.nth(0)).toContainText('may pass on (1)');
    await expect(rowsL.nth(1)).toContainText('via Manny');
    await page.locator('[data-vis-dend="dl-1"]').click();
    await page.locator('form[data-vis-form="dend"] [name="reason"]').fill('Left the job');
    await page.locator('form[data-vis-form="dend"] [name="end_issued"][value="end"]').check();
    await page.locator('form[data-vis-form="dend"] button[type="submit"]').click();
    await expect(page.locator('#adm-visits [role="status"]')).toHaveText('Ended ✓');
    expect(bodies[0]).toMatchObject({ action: 'delegation_end', fields: { id: 'dl-1', reason: 'Left the job', end_issued: 'end' } });
    await expect(page.locator('#adm-visits .vis-row')).toHaveCount(0);
  });

  test('let someone give visits: limits ticked go to delegation_give; no one can be saved without a person', async ({ page }) => {
    await open(page);
    const bodies = await saves(page, () => ({ ok: true, result: { status: 'saved', id: 'dl-new' } }));
    await visits(page);
    await page.locator('[data-vis-mode="who"]').click();
    await page.locator('[data-vis-dnew="1"]').click();
    const f = page.locator('form[data-vis-form="deleg"]');
    await f.locator('button[type="submit"]').click();
    await expect(page.locator('#adm-visits [role="status"]')).toContainText('Pick who');
    await f.locator('[name="holder"]').selectOption('sc-c');
    await f.locator('[name="d_types"][value="vt-1"]').check();
    await f.locator('[name="d_rights"][value="view"]').check();
    await f.locator('[name="max_hours"]').fill('3');
    await f.locator('button[type="submit"]').click();
    await expect(page.locator('.vis-row[data-vis-deleg="dl-new"] .adm-ok')).toBeVisible();
    expect(bodies[0]).toMatchObject({ action: 'delegation_give', fields: { power: 'give_visit', holder_code_id: 'sc-c', visit_type_ids: 'vt-1', rights: 'view', max_hours: '3', depth_left: '0', end_others: 'no' } });
  });
});

test.describe('CD Hub Visits: who gave what', () => {
  test('per person: what they can give (with the chain back to you) and what they gave; filters; End now from a row', async ({ page }) => {
    await open(page);
    const bodies = await saves(page, () => ({ ok: true, result: { status: 'saved', ended_at: '2026-11-13T12:00:00+00:00' } }));
    await visits(page);
    await page.locator('[data-vis-mode="gave"]').click();
    const manny = page.locator('[data-vis-who="sc-a"]');
    await expect(manny).toContainText('Give visits');
    await expect(manny).toContainText('from You → Manny');
    await expect(manny).toContainText('Pretend Vet');
    await expect(manny).toContainText('Pretend Deputy: Give visits');   // Manny passed it on
    await expect(page.locator('[data-vis-who="-"]')).toContainText('Pretend Inspector');   // owner's own visits
    await expect(page.locator('[data-vis-who="sc-b"]')).toContainText('from You → Manny → Pretend Deputy');
    await page.locator('form[data-vis-form="gavef"] [name="who"]').selectOption('sc-a');
    await expect(page.locator('[data-vis-who]')).toHaveCount(1);
    await page.locator('form[data-vis-form="gavef"] [name="kind"]').selectOption('visit');
    await expect(manny).not.toContainText('Pretend Deputy: Give visits');
    await manny.locator('[data-vis-end="il-soon"]').click();
    await page.locator('form[data-vis-form="end"] [name="reason"]').fill('Not needed');
    await page.locator('form[data-vis-form="end"] button[type="submit"]').click();
    await expect(page.locator('#adm-visits [role="status"]')).toHaveText('Ended ✓');
    expect(bodies[0]).toMatchObject({ action: 'visit_end', fields: { link_id: 'il-soon' } });
    await expect(manny).toContainText('ended');
  });
});

fresh.describe('CD Hub Visits: first use', () => {
  fresh('no types yet: a suggestion fills the form; Save sends a dated row with the ticked rights and lists', async ({ page }) => {
    await open(page);
    const bodies = await saves(page, () => ({ ok: true, result: { status: 'saved', id: 'vt-new' } }));
    await visits(page);
    await page.locator('[data-vis-mode="give"]').click();
    await expect(page.locator('#adm-visits')).toContainText('First make a visit type');
    await page.locator('#adm-visits [data-vis-mode="types"]').click();
    await page.locator('[data-vis-suggest="Vet"]').click();
    const f = page.locator('form[data-vis-form="type"]');
    await expect(f.locator('[name="name"]')).toHaveValue('Vet');
    await expect(f.locator('[name="t_rights"][value="record"]')).toBeChecked();
    await expect(f.locator('[name="t_rights"][value="print"]')).not.toBeChecked();
    await f.locator('[name="max_hours"]').fill('1');
    await f.locator('button[type="submit"]').click();
    await expect(page.locator('#adm-visits [role="status"]')).toContainText('Usual hours are more than the longest');
    await f.locator('[name="max_hours"]').fill('6');
    await f.locator('button[type="submit"]').click();
    await expect(page.locator('#adm-visits .vis-row .adm-ok')).toBeVisible();
    expect(bodies[0].action).toBe('visit_type_save');
    expect(bodies[0].fields).toMatchObject({ type_key: 'vet', name: 'Vet', default_hours: '2', max_hours: '6', rights: 'view|raise_finding|record', lists: 'subject|microchip|health_screen', active: 'yes' });
    expect(bodies[0].fields.effective_from).toMatch(/^\d{4}-\d\d-\d\d$/);
  });
});
