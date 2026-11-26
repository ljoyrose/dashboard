// Every SOP can be recorded and printed (the owner, 25 Nov 2026). Invented rows only.
const { tabClick } = require('../support/tabs');
const { test, expect, HUBS, IDS } = require('../fixtures/job34/load');
const R = require('../../cdhub/sop-records.js');
const index = require('../../cdhub/sop-index.json');

const tab = async (page, id) => {
  await tabClick(page, `#nav button[data-go="${id}"]`);
  await expect(page.locator(`#nav button[data-go="${id}"]`)).toHaveAttribute('aria-current', 'page');
};
const addTable = (world, name, content) => {
  const f = world.files.find((x) => x.name === name);
  if (f) { f.content = content; f.size = String(content.length); }
  else world.file('sop-rec-' + name, name, content, { parents: [IDS.bld], driveId: 'drv-alpha1' });
};
const TYPE_H = 'id,tenant_id,type_key,label,target,active,effective_from,source,every_days,group,includes,sop';
const csv = (h, rows) => [h].concat(rows).join('\r\n') + '\r\n';
const KEY_RE = /^(round\.)?[a-z][a-z0-9_]{1,39}$/;

test('all 49 SOPs have a record control, a storage table and a print path', () => {
  expect(index).toHaveLength(49);
  const names = index.map((r) => r.short_name);
  expect(new Set(names).size).toBe(49);
  const rows = R.audit(index);
  expect(rows).toHaveLength(49);
  const keys = [];
  rows.forEach((row, i) => {
    expect(row.sop).toBe(names[i]);
    expect(row.record.startsWith('Yes')).toBe(true);
    expect(row.storage).toContain('BLD-check_log.csv');
    expect(row.print).toContain('Print records');
    expect(row.print).toContain('Yearly print');
    const slug = R.slug(row.sop);
    expect(slug).toMatch(KEY_RE);
    keys.push(slug);
  });
  expect(new Set(keys).size).toBe(49);
  const used = [];
  R.SPEC.forEach((s) => (s.keys || []).forEach((k) => used.push(k)));
  expect(new Set(used).size).toBe(used.length);
  expect(R.SPEC).toHaveLength(49);
});

test('a blank SOP column still belongs to the known check, and Checked today is only the fallback', () => {
  const types = [{ id: 'cty-feed', type_key: 'feeding', label: 'Feeding', target: 'none', active: 'true', effective_from: '2026-01-01', every_days: '1', sop: '' }];
  expect(R.withSop(types)[0].sop).toBe('Feeding');
  expect(R.shownOn(types, '2026-11-25', 'Feeding').map((t) => t.type_key)).toEqual(['feeding']);
  const html = R.extraHtml({ today: '2026-11-25', types }, { short_name: 'Feeding' });
  expect(html).not.toContain('data-sop-checked=');
  expect(html).toContain('Print records');
  const bare = R.extraHtml({ today: '2026-11-25', types: [] }, { short_name: 'Licence Display' });
  expect(bare).toContain('data-sop-checked="Licence Display"');
  expect(bare).toContain('>Checked today<');
  expect(bare).toContain('data-sop-day="sop_licence_display"');
  expect(bare).toContain('value="2026-11-25"');
  expect(R.audit([{ short_name: 'Licence Display' }])[0].record).toContain('display');
});

test('Checked today adds the check type once, then one check_log', () => {
  const sop = { short_name: 'Sign-Off', frequency: 'Annual' };
  const first = R.checkedPlan({ today: '2026-11-25', types: [] }, sop, '2026-11-25T12:00:00.000Z');
  expect(first.steps.map((s) => s.table)).toEqual(['check_type', 'check_log']);
  expect(first.steps[0].fields).toMatchObject({ type_key: 'sop_sign_off', target: 'none', site_scope: 'one_line', sop: 'Sign-Off', asks_outcome: 'false', every_days: '365' });
  expect(first.steps[1].needsType).toBe(true);
  expect(first.steps[1].fields).toMatchObject({ outcome: 'recorded', how_recorded: 'tapped', happened_at: '2026-11-25T12:00:00.000Z' });
  const again = R.checkedPlan({ today: '2026-11-25', types: [{ id: 'cty-1', type_key: 'sop_sign_off', active: 'true', effective_from: '2026-11-25' }] }, sop, '2026-11-25T13:00:00.000Z');
  expect(again.steps).toHaveLength(1);
  expect(again.steps[0].fields.check_type_id).toBe('cty-1');
});

test('Print records for a month keeps that month’s mating and leaves last month out', () => {
  const ctx = {
    today: '2026-11-25', types: [], logs: [],
    dogName: (id) => (id === 'd1' ? 'Ada' : ''),
    tables: { 'BLD-mating.csv': [
      { id: 'm1', dam_subject_id: 'd1', mated_on: '2026-11-02', method: 'natural' },
      { id: 'm0', dam_subject_id: 'd1', mated_on: '2026-10-02', method: 'natural' }
    ] }
  };
  const pack = R.printPack(ctx, 'Mating Plan', { month: '2026-11', printed: '25 Nov 2026' });
  expect(pack.head.which).toBe('Mating Plan');
  expect(pack.lines).toHaveLength(1);
  expect(pack.lines[0]).toMatchObject({ date: '2026-11-02', check: 'Mating', subject: 'Ada' });
  const cat = [
    { id: 'check:mating_plan', kind: 'check', typeKey: 'mating_plan' },
    { id: 'mating', kind: 'table' },
    { id: 'weight', kind: 'table' },
    { id: 'check:custom', kind: 'check', typeKey: 'custom', type: { sop: 'Mating Plan' } }
  ];
  expect(R.yearlyIds('Mating Plan', cat)).toEqual(['check:mating_plan', 'mating', 'check:custom']);
});

test.describe('CD Hub: SOP record and print', () => {
  const URL_ = 'https://script.google.com/macros/s/AKfyTEST_only_123/exec';

  test('an SOP with no linked check still records Checked today and prints @regression', async ({ page, guard }) => {
    await page.addInitScript((u) => { try { localStorage.setItem('cdhub.sink.url', u); localStorage.setItem('cdhub.sink.code', 'test-code-1'); } catch (e) { /* private */ } }, URL_);
    await page.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
    const sent = [];
    await page.route(/^https:\/\/script\.google\.com\/macros\//, (route) => {
      const b = JSON.parse(route.request().postData() || '{}'); sent.push(b);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result: { status: 'saved', id: 'new-' + sent.length, at: '2026-11-25T12:00:00.000Z', who: 'Test Owner' } }) });
    });
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'sops');
    await page.locator('[data-sop-open="Sign-Off"]').click();
    const body = page.locator('[data-sop-body="Sign-Off"]');
    await expect(body.getByRole('button', { name: 'Checked today' })).toBeVisible();
    await expect(body.getByRole('link', { name: 'Print records' })).toBeVisible();
    await body.getByRole('button', { name: 'Checked today' }).click();
    await expect.poll(() => sent.length).toBe(2);
    expect(sent[0].table).toBe('check_type');
    expect(sent[0].fields).toMatchObject({ type_key: 'sop_sign_off', target: 'none', sop: 'Sign-Off', asks_outcome: 'false' });
    expect(sent[1].table).toBe('check_log');
    expect(sent[1].fields).toMatchObject({ check_type_id: 'new-1', outcome: 'recorded', how_recorded: 'tapped', note: 'Checked today' });
    await expect(body.locator('[data-sop-checked="Sign-Off"]')).toHaveCount(0);
    await expect(body).toContainText('Checked: Sign-Off');
    await body.getByRole('link', { name: 'Print records' }).click();
    await expect(page).toHaveURL(/#\/yearly\/sop-/);
    await expect.poll(() => page.evaluate(() => window.__printed || 0)).toBe(0);
    await expect(page.locator('#ypPreview')).toContainText('Declarations');
    await expect(page.locator('#ypPreview')).toContainText('Verifications');
    await page.locator('#ypSopPrint').click();
    await expect.poll(() => page.evaluate(() => window.__printed || 0)).toBe(1);
  });

  test('SOP Print records opens the print view and does not print the list @regression', async ({ page, guard }) => {
    await page.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'sops');
    await page.locator('[data-sop-open="Cleaning"]').click();
    await page.locator('[data-sop-body="Cleaning"]').getByRole('link', { name: 'Print records' }).click();
    await expect(page).toHaveURL(/#\/yearly\/sop-Cleaning$/);
    await expect(page.locator('#ypPreview')).toBeVisible();
    await expect(page.locator('h2').first()).toHaveText('Yearly print');
    expect(await page.evaluate(() => window.__printed || 0)).toBe(0);
    await expect(page.locator('#soprows')).toHaveCount(0);
  });

  test('a check whose SOP name was left blank still shows its record control @regression', async ({ page, guard }) => {
    addTable(guard.world, 'BLD-check_type.csv', csv(TYPE_H, [
      't-feed,t,feeding,Feeding,none,true,2020-01-01,,1,,,'
    ]));
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'sops');
    await page.locator('[data-sop-open="Feeding"]').click();
    const body = page.locator('[data-sop-body="Feeding"]');
    await expect(body.locator('[data-sop-save="feeding"]')).toBeVisible();
    await expect(body.locator('[data-sop-checked]')).toHaveCount(0);
    await expect(body.getByRole('link', { name: 'Print records' })).toBeVisible();
  });
});
