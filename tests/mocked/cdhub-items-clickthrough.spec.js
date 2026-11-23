// Items page, click by click (ITEMS, 14 Nov 2026). Two made-up businesses on the same page with no code change:
// a kennel's plug-in tests (UK, readings typed with a decimal point) and a café's fridge probe checks (readings typed
// with a decimal comma, as in much of Europe). Every button is pressed and every save is checked as it leaves the page.
// The save script is pretend. Set ITEMS_SHOTS=<folder> to keep a screenshot of each step.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect, HUBS, IDS } = require('../fixtures/job34/load');

const SINK = 'https://script.google.com/macros/s/PRETENDSCRIPT/exec';
const csv = (h, rows) => [h].concat(rows).join('\r\n') + '\r\n';
// Replaces a sample table that already exists (two files with one name stop the hub), else adds it.
const addTable = (world, name, content) => {
  const f = world.files.find((x) => x.name === name);
  if (f) { f.content = content; f.size = String(content.length); }
  else world.file('bld-clk-' + name, name, content, { parents: [IDS.bld], driveId: 'drv-alpha1' });
};
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

const ITEM_H = 'id,tenant_id,item_no,name,kind_key,make,model,serial_no,size,made_on,expires_on,photo,note,corrects_id,created_at,created_by';
const TYPE_H = 'id,tenant_id,type_key,label,target,active,effective_from,every_days,item_kind,sop';
const LOG_H = 'id,tenant_id,check_type_id,area_id,subject_id,item,amount,outcome,happened_at,note,taken_at,taken_by,corrects_id,photo,how_recorded,litter_id,note_for_id,item_id';
const FIELD_H = 'id,tenant_id,type_key,field_key,label,kind,choices,required,sort,active,effective_from,set_at,set_by';
const RK_H = 'id,tenant_id,kind_key,label,unit_id,value_shape,precision_dp,source,set_by,set_on';
const RL_H = 'id,tenant_id,kind_id,scope_table,scope_id,low,high,label,from_date,to_date,source,set_by,set_on';
const LINK_H = 'id,tenant_id,from_table,from_id,role,to_table,to_id,from_date,to_date,source,set_by,set_on,sort,note,created_at,updated_at';

function world(w) {
  addTable(w, 'BLD-item_kinds.csv', csv('id,tenant_id,kind_key,label,source,set_by,set_on', [
    'k1,t,pretend_plug,Pretend plug-in,x,o,2026-01-01', 'k2,t,pretend_fridge,Pretend fridge,x,o,2026-01-01']));
  addTable(w, 'BLD-items.csv', csv(ITEM_H, [
    'i1,t,P-01,Pretend kettle,pretend_plug,,,,,,,,,,2026-01-01T00:00:00Z,o',
    'i2,t,P-02,Pretend heater,pretend_plug,,,,,,,,,,2026-01-01T00:00:00Z,o',
    'i3,t,F-01,Pretend chiller,pretend_fridge,,,,120 L,2024-01-01,2099-01-01,,,,2026-01-01T00:00:00Z,o']));
  addTable(w, 'BLD-check_type.csv', csv(TYPE_H, [
    'c1,t,pretend_pat,Pretend PAT,item,true,2020-01-01,365,pretend_plug,Pretend electrical SOP',
    'c2,t,pretend_probe,Pretend probe check,item,true,2020-01-01,7,pretend_fridge,Pretend food safety SOP']));
  addTable(w, 'BLD-check_log.csv', csv(LOG_H, [
    'l1,t,c1,,,,,ok,2020-05-28T12:00:00Z,,,o,,,typed,,,i1',
    'l2,t,c1,,,,,ok,2099-01-01T12:00:00Z,,,o,,,typed,,,i2']));
  addTable(w, 'BLD-check_field.csv', csv(FIELD_H, ['f1,t,pretend_pat,look,Pretend look,choice,Pass|Fail,false,1,true,2020-01-01,,']));
  addTable(w, 'BLD-check_value.csv', csv('id,tenant_id,check_log_id,check_field_id,field_key,value', []));
  addTable(w, 'BLD-reading_kinds.csv', csv(RK_H, ['r1,t,pretend_earth,Pretend earth,Ω,single,2,x,o,2026-01-01', 'r2,t,pretend_temp,Pretend probe,°C,single,1,x,o,2026-01-01']));
  addTable(w, 'BLD-reading_limits.csv', csv(RL_H, ['m1,t,r1,,,,0.1,,2020-01-01,,x,o,2026-01-01', 'm2,t,r2,item_kinds,pretend_fridge,0,5,,2020-01-01,,x,o,2026-01-01']));
  addTable(w, 'BLD-readings.csv', csv('id,tenant_id,kind_id,area_id,item_id,subject_id,check_log_id,value_min,value_max,value,unit_id,taken_at,in_range', []));
  addTable(w, 'BLD-files.csv', csv('id,tenant_id,kind,drive_file_id,url,mime,name,size_bytes,taken_on,sha256,source,set_by,set_on', []));
  addTable(w, 'BLD-links.csv', csv(LINK_H, [
    'n1,t,reading_kinds,r1,reading_for_job,check_types,pretend_pat,2020-01-01,,x,o,2026-01-01,,,,',
    'n2,t,reading_kinds,r2,reading_for_job,check_types,pretend_probe,2020-01-01,,x,o,2026-01-01,,,,']));
}

async function open(page, guard, opts) {
  world(guard.world);
  if (opts && opts.before) opts.before(guard.world);
  const sent = [];
  let readingFails = (opts && opts.readingFails) || 0;
  await page.route(SINK, async (route) => {
    const b = JSON.parse(route.request().postData() || '{}');
    sent.push(b);
    const ok = (result) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result }) });
    if (b.action === 'file_add') return ok({ status: 'saved', id: 'fil-new', drive_file_id: 'drvfilenewpretend000000001' });
    if (b.action === 'link_add') return ok({ status: 'saved', id: 'lnk-new-' + sent.length, role: b.fields.role, ended: (b.fields.role === 'placed_in' && opts && opts.ended) || [] });
    // 16 Nov 2026: BUSY is now retried by the hub on its own, so the failed save here is one the person must retry.
    if (b.table === 'readings' && readingFails > 0) { readingFails--; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, code: 'CHANGED_DURING_WRITE', message: 'Try again.' }) }); }
    return ok({ status: 'saved', id: (b.table || 'x').slice(0, 3) + '-new-' + sent.length });
  });
  await HUBS.cdhub.open(page, guard);
  await page.evaluate((url) => { localStorage.setItem('cdhub.sink.url', url); localStorage.setItem('cdhub.sink.code', 'pretend-code'); }, SINK);
  await page.evaluate(() => { location.hash = '#/items'; });
  await expect(page.locator('#itmPage .itm-row')).toHaveCount(3);
  return sent;
}
let shotN = 0;
async function shot(page, name) {
  const dir = process.env.ITEMS_SHOTS;
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  shotN++;
  await page.screenshot({ path: path.join(dir, String(shotN).padStart(2, '0') + '-' + name + '.png'), fullPage: true });
}
const card = (page) => page.locator('#itmCard');

test.describe('CD Hub: items, click by click', () => {
  test('list: every filter, search, best to worst, Report and CSV', async ({ page, guard }) => {
    await open(page, guard);
    await shot(page, 'list-all');
    const rows = page.locator('#itmPage .itm-row');
    await expect(rows.first()).not.toContainText('Overdue');                     // best first
    for (const [f, n] of [['ok', null], ['soon', 0], ['due', null], ['archived', 0], ['all', 3]]) {
      await page.locator(`[data-itm-filter="${f}"]`).click();
      if (n !== null) await expect(rows).toHaveCount(n);
      await expect(page.locator(`[data-itm-filter="${f}"]`)).toHaveAttribute('aria-pressed', 'true');
    }
    await page.locator('[data-itm-filter="due"]').click();
    await expect(rows.filter({ hasText: 'Pretend kettle' })).toHaveCount(1);
    await page.locator('[data-itm-filter="all"]').click();
    await page.locator('[data-itm-q]').fill('chiller');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Pretend chiller');
    await shot(page, 'list-search');
    await page.locator('[data-itm-q]').fill('');
    const [pop] = await Promise.all([page.waitForEvent('popup'), page.locator('[data-itm-report="print"]').click()]);
    await expect(pop.locator('h1')).toHaveText('Items');
    await expect(pop.locator('body')).toContainText('As at');
    await expect(pop.locator('tbody tr')).toHaveCount(3);
    await pop.close();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-itm-report="csv"]').click()]);
    const text = fs.readFileSync(await dl.path(), 'utf8');
    expect(text.split('\r\n')[0]).toBe('item_no,name,kind,room,size,made_on,expires_on,status,archived,test,last,next,test_status,readings');
    expect(text).toContain('Pretend chiller');
  });

  test('kennel, UK: a PAT with an outside reading, a Fail needs a note, certificate PDF, then room, edit and archive', async ({ page, guard }) => {
    const sent = await open(page, guard);
    await page.locator('#itmPage .itm-row', { hasText: 'Pretend kettle' }).click();
    await expect(card(page)).toContainText('Overdue');
    await page.locator('[data-itm-form="test:pretend_pat"]').click();
    await expect(page.locator('form[data-itm-save="test"]')).toContainText('≤ 0.1');
    await page.locator('[name="r_r1"]').fill('0.2');
    await expect(page.locator('.itm-lim').first()).toHaveText('outside limit');
    await page.locator('[name="v_look"]').selectOption('Pass');
    await page.locator('[name="outcome"]').selectOption('concern');
    await shot(page, 'kennel-test-form');
    await page.locator('form[data-itm-save="test"] button[type="submit"]').click();
    await expect(card(page).locator('[role="status"]')).toHaveText('Say briefly what failed.');
    expect(sent.length).toBe(0);
    await expect(page.locator('[name="outcome"]')).toHaveValue('concern');      // a refused save keeps what was typed
    await expect(page.locator('[name="r_r1"]')).toHaveValue('0.2');
    await page.locator('[name="on"]').fill('2026-11-10');                          // Earlier: answers stay when the date changes
    await expect(page.locator('[name="r_r1"]')).toHaveValue('0.2');
    await page.locator('[name="on"]').fill(await page.evaluate(() => todayISO()));
    await page.locator('[name="note"]').fill('Earth bond high');
    await page.locator('[name="by"]').fill('Pretend Testers Ltd');
    await page.locator('[name="file_kind"]').selectOption('certificate');
    const pdf = path.join(os.tmpdir(), 'pretend-cert.pdf'); fs.writeFileSync(pdf, PDF);
    await page.locator('form[data-itm-save="test"] input[type="file"]').setInputFiles(pdf);
    await page.locator('form[data-itm-save="test"] button[type="submit"]').click();
    await expect(card(page).locator('[role="status"]')).toHaveText('Saved.');
    await expect(card(page).locator('.itm-tick')).toBeVisible();
    await shot(page, 'kennel-test-saved');
    const log = sent.find((b) => b.table === 'check_log');
    expect([log.fields.check_type_id, log.fields.item_id, log.fields.outcome]).toEqual(['c1', 'i1', 'concern']);
    expect(log.fields.note).toBe('by Pretend Testers Ltd. Earth bond high');
    expect(log.values).toEqual({ look: 'Pass' });
    const rd = sent.find((b) => b.table === 'readings');
    expect(rd.request_id).toBe(log.request_id + '-r1');
    expect([rd.fields.kind_id, rd.fields.value, rd.fields.unit_id, rd.fields.limit_id, rd.fields.in_range, rd.fields.source]).toEqual(['r1', '0.2', 'Ω', 'm1', 'false', 'staff']);
    const fa = sent.find((b) => b.action === 'file_add');
    expect([fa.fields.kind, fa.fields.mime]).toEqual(['upload', 'application/pdf']);
    expect(fa.fields.data_base64.length).toBeGreaterThan(20);
    expect(fa.fields.link_from_table).toBeUndefined();
    const la = sent.find((b) => b.action === 'link_add');
    expect([la.fields.from_table, la.fields.role, la.fields.to_table, la.fields.to_id]).toEqual(['check_log', 'certificate', 'files', 'fil-new']);
    await expect(card(page)).toContainText('Failed');
    await expect(card(page)).toContainText('outside');
    await expect(card(page).locator('a', { hasText: 'Certificate' })).toHaveAttribute('href', /drive\.google\.com\/file\/d\/drvfilenewpretend000000001/);

    // Room
    sent.length = 0;
    await page.locator('[data-itm-form="move"]').click();
    await page.locator('form[data-itm-save="move"] select[name="area_id"]').selectOption({ index: 1 });
    await page.locator('form[data-itm-save="move"] button[type="submit"]').click();
    await expect(card(page).locator('[role="status"]')).toHaveText('Saved.');
    expect(sent.map((b) => b.action)).toEqual(['link_add']);
    expect([sent[0].fields.from_table, sent[0].fields.from_id, sent[0].fields.role, sent[0].fields.to_table]).toEqual(['items', 'i1', 'placed_in', 'area']);
    await expect(card(page)).not.toContainText('No room');

    // Edit
    sent.length = 0;
    await page.locator('[data-itm-form="edit"]').click();
    await page.locator('form[data-itm-save="edit"] [name="name"]').fill('Pretend kettle, staff room');
    await page.locator('form[data-itm-save="edit"] button[type="submit"]').click();
    await expect(card(page).locator('[role="status"]')).toHaveText('Saved.');
    expect([sent[0].table, sent[0].fields.corrects_id, sent[0].fields.name]).toEqual(['items', 'i1', 'Pretend kettle, staff room']);

    // Archive
    sent.length = 0;
    await page.locator('[data-itm-form="archive"]').click();
    await page.locator('form[data-itm-save="archive"] [name="why"]').selectOption('Dead');
    await page.locator('form[data-itm-save="archive"] [name="note"]').fill('Element gone');
    await shot(page, 'kennel-archive');
    await page.locator('form[data-itm-save="archive"] button[type="submit"]').click();
    await expect(card(page).locator('[role="status"]')).toHaveText('Archived.');
    expect([sent[0].table, sent[0].fields.need_type, sent[0].fields.target_id, sent[0].fields.source]).toEqual(['requirement', 'item.in_use', 'i1', 'Dead: Element gone']);
    await expect(card(page)).toContainText('Archived');
    await expect(card(page).locator('[data-itm-form="archive"]')).toHaveCount(0);
    await page.locator('[data-itm-open=""]').click();
    await page.locator('[data-itm-filter="archived"]').click();
    await expect(page.locator('#itmPage .itm-row')).toHaveCount(1);
  });

  test('café, Europe: a fridge probe typed with a decimal comma; a failed reading save shows Retry', async ({ page, guard }) => {
    const sent = await open(page, guard, { readingFails: 1 });
    await page.locator('#itmPage .itm-row', { hasText: 'Pretend chiller' }).click();
    await expect(card(page)).toContainText('120 L');
    await page.locator('[data-itm-form="test:pretend_probe"]').click();
    await expect(page.locator('form[data-itm-save="test"]')).toContainText('≥ 0 ≤ 5');
    await page.locator('[name="r_r2"]').fill('3,5');
    await expect(page.locator('.itm-lim').first()).toHaveText('inside limit');
    await page.locator('[name="r_r2"]').fill('7,5');
    await expect(page.locator('.itm-lim').first()).toHaveText('outside limit');
    await page.locator('[name="r_r2"]').fill('3,5');
    await page.locator('form[data-itm-save="test"] button[type="submit"]').click();
    await expect(card(page).locator('[role="status"]')).toHaveText('Test saved. Values not all saved.');
    await expect(card(page).locator('[data-itm-retry]')).toBeVisible();
    await shot(page, 'cafe-retry');
    const first = sent.filter((b) => b.table === 'readings');
    expect(first[0].fields.value).toBe('3.5');
    expect(first[0].fields.in_range).toBe('true');
    expect(first[0].fields.limit_id).toBe('m2');
    await page.locator('[data-itm-retry]').click();
    await expect(card(page).locator('[role="status"]')).toHaveText('Saved.');
    await expect(card(page).locator('[data-itm-retry]')).toHaveCount(0);
    expect(sent.filter((b) => b.table === 'check_log').length).toBe(1);   // the test row is never resent
    const rs = sent.filter((b) => b.table === 'readings');
    expect(rs.length).toBe(2);
    expect(rs[1].request_id).toBe(rs[0].request_id);
    await expect(card(page)).toContainText('3.5 °C');
    await shot(page, 'cafe-saved');
  });

  test('add an item with room, start date and photo link', async ({ page, guard }) => {
    const sent = await open(page, guard);
    await page.locator('[data-itm-form="add"]').click();
    const f = page.locator('form[data-itm-save="add"]');
    await f.locator('[name="item_no"]').fill('F-02');
    await f.locator('[name="name"]').fill('Pretend freezer');
    await f.locator('[name="kind_key"]').selectOption('pretend_fridge');
    await f.locator('[name="area_id"]').selectOption({ index: 1 });
    await f.locator('[name="size"]').fill('200 L');
    await f.locator('[name="link"]').fill('https://example.org/pretend-freezer.jpg');
    await shot(page, 'add-form');
    await f.locator('button[type="submit"]').click();
    await expect(page.locator('#itmPage [role="status"]')).toHaveText('Saved.');
    const order = sent.map((b) => b.table || b.action);
    expect(order[0]).toBe('items');
    expect(order).toEqual(expect.arrayContaining(['link_add', 'requirement', 'file_add']));
    expect(sent.find((b) => b.action === 'file_add').fields).toEqual({ kind: 'link', url: 'https://example.org/pretend-freezer.jpg', source: 'link' });
    const links = sent.filter((b) => b.action === 'link_add').map((b) => b.fields.role).sort();
    expect(links).toEqual(['main', 'placed_in']);
    await expect(page.locator('#itmPage .itm-row', { hasText: 'Pretend freezer' })).toHaveCount(1);
  });

  test('phone (390px): list, card and test form fit with no sideways scroll; buttons are 44px tall', async ({ page, guard }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, guard);
    const noSideways = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await noSideways();
    await shot(page, 'phone-list');
    await page.locator('#itmPage .itm-row', { hasText: 'Pretend kettle' }).click();
    await noSideways();
    await page.locator('[data-itm-form="test:pretend_pat"]').click();
    await noSideways();
    const small = await page.evaluate(() => Array.from(document.querySelectorAll('#itmCard button')).filter((b) => b.offsetParent && b.getBoundingClientRect().height < 44).map((b) => b.textContent.trim()));
    expect(small).toEqual([]);
    await shot(page, 'phone-test-form');
  });

  test('phone: Photo on any item takes a photo with its date; only the file and its link are saved, then a tick (18 Nov 2026)', async ({ page, guard }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const sent = await open(page, guard);
    await page.locator('#itmPage .itm-row', { hasText: 'Pretend heater' }).click();
    await card(page).locator('[data-itm-form="photo"]').click();
    const f = page.locator('form[data-itm-save="photo"]');
    await expect(f.locator('input[type="file"]')).toHaveAttribute('capture', 'environment');
    await f.locator('input[type="file"]').setInputFiles({ name: 'heater.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
    await f.locator('input[name="on"]').fill('2026-11-17');
    await f.locator('button[type="submit"]').click();
    await expect(card(page).locator('.itm-tick')).toBeVisible();
    await expect(card(page)).toContainText('Saved.');
    const fa = sent.find((b) => b.action === 'file_add');
    expect(fa.fields.taken_on).toBe('2026-11-17');
    expect(fa.fields.kind).toBe('photo');
    const la = sent.find((b) => b.action === 'link_add');
    expect(la.fields).toMatchObject({ from_table: 'items', role: 'main', to_table: 'files', to_id: 'fil-new' });
    expect(sent.some((b) => b.table === 'items')).toBe(false);
    await expect(card(page)).toContainText('17 Nov 2026');
    const box = await card(page).locator('[data-itm-form="photo"]').boundingBox();
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  });
  for (const size of [{ name: 'phone', width: 390, height: 844 }, { name: 'laptop', width: 1280, height: 800 }]) {
    test(size.name + ': Move on an item lists every room in its group, shows where it is now, adds a dated row and ends the old one (18 Nov 2026)', async ({ page, guard }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      const sent = await open(page, guard, {
        ended: ['p1'],
        before: (w) => {
          addTable(w, 'BLD-area.csv', csv('id,tenant_id,code,name,grouping,group_sort', [
            'a-site,t,Pretend office,Pretend office,Pretend site,10', 'a-c2,t,C2,Cabin 2,Pretend cabins,1',
            'a-c1,t,C1,Cabin 1,Pretend cabins,1', 'a-cor,t,Pretend corridor,Pretend corridor,Pretend corridors,5']));
          addTable(w, 'BLD-links.csv', csv(LINK_H, [
            'n1,t,reading_kinds,r1,reading_for_job,check_types,pretend_pat,2020-01-01,,x,o,2026-01-01,,,,',
            'p1,t,items,i1,placed_in,area,a-c1,2025-05-28,,x,o,2026-01-01,,,,']));
        }
      });
      await expect(page.locator('#itmPage .itm-row', { hasText: 'Pretend kettle' })).toContainText('C1');
      await page.locator('#itmPage .itm-row', { hasText: 'Pretend kettle' }).click();
      const btn = card(page).locator('[data-itm-form="move"]');
      await expect(btn).toHaveText('Move');
      await btn.click();
      const f = page.locator('form[data-itm-save="move"]');
      await expect(f).toContainText('Now: C1 since 28 May 2025');
      expect(await f.locator('optgroup').evaluateAll((g) => g.map((x) => x.label + ': ' + Array.from(x.children).map((o) => o.textContent).join(', '))))
        .toEqual(['Pretend cabins: C1, C2', 'Pretend corridors: Pretend corridor', 'Pretend site: Pretend office']);
      // a day on or before the current room's start is refused before anything is sent
      await f.locator('select[name="area_id"]').selectOption('a-site');
      await f.locator('input[name="from_date"]').fill('2025-05-28');
      await f.locator('button[type="submit"]').click();
      await expect(card(page)).toContainText('Pick a day after 28 May 2025');
      expect(sent.length).toBe(0);
      await f.locator('input[name="from_date"]').fill('2026-11-18');
      await f.locator('button[type="submit"]').click();
      await expect(card(page).locator('.itm-tick')).toBeVisible();
      expect(sent.map((b) => b.action)).toEqual(['link_add']);
      expect(sent[0].fields).toMatchObject({ from_table: 'items', from_id: 'i1', role: 'placed_in', to_table: 'area', to_id: 'a-site', from_date: '2026-11-18' });
      expect(sent.some((b) => b.table === 'items')).toBe(false);
      await expect(card(page)).toContainText('Pretend office since 18 Nov 2026');
      await expect(card(page)).not.toContainText('C1 since');
      const box = await btn.boundingBox();
      expect(box.x + box.width).toBeLessThanOrEqual(size.width);
      if (size.width < 768) expect(box.height).toBeGreaterThanOrEqual(44);
    });
  }
  test('Move lists only rooms open today: a retired room is hidden, an items-only site room stays (20 Nov 2026)', async ({ page, guard }) => {
    await open(page, guard, {
      before: (w) => {
        addTable(w, 'BLD-area.csv', csv('id,tenant_id,code,name,grouping,group_sort', [
          'a-c1,t,C1,Cabin 1,Pretend cabins,1', 'a-old,t,ZZ_C9,Old cabin,Pretend cabins,1', 'a-site,t,Pretend office,Pretend office,Pretend site,10']));
        addTable(w, 'BLD-requirement.csv', csv('id,tenant_id,need_type,target_table,target_id,from_date,to_date,source,set_by,set_on', [
          'q1,t,room.in_use,area,a-old,2020-01-01,2021-01-01,x,o,2026-01-01',
          'q2,t,room.in_use,area,a-site,2000-01-01,2000-01-01,x,o,2026-01-01',
          'q3,t,room.items,area,a-site,2000-01-01,,x,o,2026-01-01']));
      }
    });
    await page.locator('#itmPage .itm-row', { hasText: 'Pretend kettle' }).click();
    await card(page).locator('[data-itm-form="move"]').click();
    const names = await page.locator('form[data-itm-save="move"] option').allTextContents();
    expect(names).toEqual(['Pick a room', 'C1', 'Pretend office']);
  });
});
