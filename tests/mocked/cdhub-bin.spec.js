// CD Hub Bin (Settings -> Bin), owner only, read only. OV11 for the owner, 15 Nov 2026. Invented rows only.
const { test: base, expect } = require('../support/test');
const { buildWorld, IDS } = require('../support/world');
const { tabClick } = require('../support/tabs');

const FV = 'id,tenant_id,table_name,field_name,audience_id,visible,condition,redaction,set_by,set_on,reason\nfv-1,ten-x,area,*,aud-staff,yes,,,test,2026-10-16,every row\n';
const RULES = [
  'id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by,to_date,end_reason',
  'r-1,ten-x,pretend.old_rule,5,2020-01-01,Pretend,,2020-01-01T00:00:00Z,sc-aaaaaa,2021-03-02,Replaced by r-2',
  'r-2,ten-x,pretend.old_rule,6,2021-03-03,Pretend,,2021-03-03T00:00:00Z,sc-aaaaaa,2024-05-06,',
  'r-3,ten-x,pretend.live_rule,7,2020-01-01,Pretend,,2020-01-01T00:00:00Z,sc-aaaaaa,,',
  'r-4,ten-x,pretend.future_end,8,2020-01-01,Pretend,,2020-01-01T00:00:00Z,sc-aaaaaa,2099-01-01,',
].join('\n') + '\n';
const CODES = 'id,tenant_id,code_id,who,role,from_date,to_date,ended_by\ncr-1,ten-x,sc-aaaaaa,Test Person,STAFF,2026-10-01,,\ncr-2,ten-x,sc-bbbbbb,Old Helper,STAFF,2026-01-01,2026-06-30,Test Owner\n';

// Replaces a sample table that already exists (two files with one name stop the hub), else adds it.
const setTable = (d, id, name, content) => {
  const f = d.files.find((x) => x.name === name);
  if (f) { f.content = content; f.size = String(content.length); }
  else d.file(id, name, content, { parents: [IDS.bld], driveId: 'drv-alpha1' });
};

function world({ owner = true } = {}) {
  const d = buildWorld();
  setTable(d, 'bin-rules', 'BLD-breeding_rule.csv', RULES);
  if (!owner) return d;
  setTable(d, 'bin-fv', 'BLD-field_visibility.csv', FV);
  setTable(d, 'bin-codes', 'BLD-code_register.csv', CODES);
  return d;
}
const asOwner = base.extend({ world: async ({}, use) => use(world()) });
const asOther = base.extend({ world: async ({}, use) => use(world({ owner: false })) });

const open = async (page) => {
  await page.goto('cdhub/');
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
};

asOther.describe('CD Hub Bin: not the owner', () => {
  asOther('no Bin without the owner rows', async ({ page }) => {
    await open(page);
    await expect(page.locator('#nav button[data-go="bin"]')).toHaveCount(0);
  });
});

asOwner.describe('CD Hub Bin: owner', () => {
  asOwner('ended rows grouped by kind, newest first, with when, who and why; live and future-ended rows stay out', async ({ page }) => {
    await open(page);
    await tabClick(page, '#nav button[data-go="bin"]');
    const bin = page.locator('#binPage');
    await expect(bin.locator('h2')).toHaveText('Bin');
    const kinds = bin.locator('[data-bin-kind]');
    await expect(kinds).toHaveCount(2);
    await expect(kinds.nth(0)).toHaveAttribute('data-bin-kind', 'Code register');   // ended 2026, newer than the rules
    await expect(kinds.nth(0)).toContainText('Old Helper');
    await expect(kinds.nth(0)).toContainText('Ended 30 Jun 2026 · by Test Owner');
    const rules = bin.locator('[data-bin-kind="Breeding rule"] [data-bin-row]');
    await expect(rules).toHaveCount(2);
    await expect(rules.nth(0)).toContainText('pretend.old_rule = 6');
    await expect(rules.nth(0)).toContainText('Ended 6 May 2024');
    await expect(rules.nth(1)).toContainText('Ended 2 Mar 2021 · by sc-aaaaaa · Replaced by r-2');
    await expect(bin).not.toContainText('pretend.live_rule');
    await expect(bin).not.toContainText('pretend.future_end');
    await expect(bin).not.toContainText('Test Person');
    await expect(page.locator('#binDrive')).toHaveAttribute('href', '../index.html#/bin');
  });

  asOwner('find narrows the list and keeps focus', async ({ page }) => {
    await open(page);
    await tabClick(page, '#nav button[data-go="bin"]');
    const q = page.locator('#binQ');
    await q.fill('helper');
    await expect(q).toBeFocused();
    await expect(page.locator('#binCount')).toHaveText('1');
    await expect(page.locator('[data-bin-kind="Breeding rule"]')).toBeHidden();
    await q.fill('nothing like this');
    await expect(page.locator('#binNoMatch')).toBeVisible();
    await q.fill('');
    await expect(page.locator('#binCount')).toHaveText('3');
  });
});

// ---- Restore (the owner 18 Nov 2026, answer A): ended rules/settings and links only; a NEW row from today; owner switch OFF by default.
const SINK = 'https://script.google.com/macros/s/PRETENDSCRIPT/exec';
const ON = 'r-on,ten-x,bin.restore.on,1,2020-01-01,Owner setting,,2020-01-01T00:00:00Z,sc-aaaaaa,,';
const LIVE_COPY = 'r-5,ten-x,pretend.live_rule,7,2019-01-01,Pretend,,2019-01-01T00:00:00Z,sc-aaaaaa,2019-12-31,';
const todayLondon = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const withRules = (extra) => base.extend({ world: async ({}, use) => { const d = world(); setTable(d, 'bin-rules', 'BLD-breeding_rule.csv', RULES + extra.join('\n') + '\n'); use(d); } });

async function openBin(page, fail) {
  const sent = [];
  await page.route(SINK, async (route) => {
    const b = JSON.parse(route.request().postData() || '{}');
    sent.push(b);
    if (fail) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, code: 'BUSY_FOR_GOOD', message: 'Pretend failure' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result: { status: 'saved', id: 'brl-new-' + sent.length } }) });
  });
  await open(page);
  await page.evaluate((url) => { localStorage.setItem('cdhub.sink.url', url); localStorage.setItem('cdhub.sink.code', 'pretend-code'); }, SINK);
  await tabClick(page, '#nav button[data-go="bin"]');
  await expect(page.locator('#binPage h2')).toHaveText('Bin');
  return sent;
}

asOwner('restore: switch off by default, so no Restore buttons', async ({ page }) => {
  await openBin(page);
  await expect(page.locator('#binPage [data-bin-row]')).not.toHaveCount(0);
  await expect(page.locator('[data-bin-restore]')).toHaveCount(0);
});

const asOn = withRules([ON, LIVE_COPY]);
asOn('restore: rules only, asks first, Cancel undoes, Yes saves one new row from today and ticks', async ({ page }) => {
  const sent = await openBin(page);
  // ended rules r-1 and r-2 can be restored; r-5 is already in force (same key and value); the code row cannot
  await expect(page.locator('[data-bin-kind="Breeding rule"] [data-bin-restore]')).toHaveCount(2);
  await expect(page.locator('[data-bin-kind="Breeding rule"] [data-bin-live]')).toHaveCount(1);
  await expect(page.locator('[data-bin-kind="Code register"] [data-bin-restore]')).toHaveCount(0);
  const row = page.locator('[data-bin-kind="Breeding rule"] [data-bin-row]').filter({ hasText: 'pretend.old_rule = 6' });
  await row.locator('[data-bin-restore]').click();
  await expect(row).toContainText('Bring back from today?');
  await row.locator('[data-bin-no]').click();
  await expect(row.locator('[data-bin-restore]')).toBeVisible();
  expect(sent).toHaveLength(0);
  await row.locator('[data-bin-restore]').click();
  await row.locator('[data-bin-yes]').click();
  await expect(row.locator('[data-saved="good"]')).toContainText(/^Saved \d\d:\d\d\. Restored from today\.$/);
  expect(sent).toHaveLength(1);
  expect(sent[0].table).toBe('breeding_rule');
  expect(sent[0].action).toBe('add');
  expect(sent[0].fields).toEqual({ rule_key: 'pretend.old_rule', value: '6', effective_from: todayLondon(), source: 'Restored from Bin (r-2)' });
});

asOn('restore: a failed save says so and nothing is shown as saved', async ({ page }) => {
  await openBin(page, true);
  const row = page.locator('[data-bin-kind="Breeding rule"] [data-bin-row]').filter({ hasText: 'pretend.old_rule = 5' });
  await row.locator('[data-bin-restore]').click();
  await row.locator('[data-bin-yes]').click();
  await expect(row.locator('[data-saved="bad"]')).toHaveText('Not saved: Pretend failure. Nothing changed; try again.');
  await expect(row.locator('[data-saved="good"]')).toHaveCount(0);
});
