// CD Hub menu, option A (Lisa 14 Nov 2026): Main · up to 3 sections · More. Which sections are on, and which sit on the bar,
// are owner settings (dated nav.* rule rows); no rows = the starting layout. Pretend Google and Drive only; rows invented.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, expect } = require('../support/test');
const { IDS } = require('../support/world');

const signIn = async (page) => {
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
};
const setFile = (world, name, content) => {
  const f = world.files.find((x) => x.name === name);
  if (f) { f.content = content; f.size = String(content.length); }
  else world.file('bld-extra-' + name, name, content, { parents: [IDS.bld], driveId: 'drv-alpha1' });
};

const nav = () => {
  const ctx = { DashKit: { icon: () => '', tabs: { tab: (t) => '<button type="button" class="ht" data-go="' + t.go + '">' + t.label + '</button>', more: (id, x) => '<div>' + x + '</div>' } } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '..', '..', 'cdhub', 'hub-nav.js'), 'utf8'), ctx);
  return ctx.HubNav;
};
const row = (k, v, from = '2026-01-01', to = '') => ({ rule_key: k, value: String(v), effective_from: from, to_date: to, source: 'Pretend setting' });

test.describe('CD Hub menu: layout from rows', () => {
  test('no nav rows: the starting layout Compliance, Ops, People, reported as not set', () => {
    const L = nav().layout({ rows: [], iso: '2026-11-14', role: 'OWNER' });
    expect(L.tabs).toEqual(['compliance', 'ops', 'people']);
    expect(L.set).toBe(false);
    expect(L.on.money).toBeUndefined();
    expect(L.on.ideas).toBeUndefined();
  });

  test('role rows set the bar order; a person row wins over the role; at most 3', () => {
    const H = nav();
    const rows = [row('nav.on.sales', 1), row('nav.tab.OWNER.sales', 1), row('nav.tab.OWNER.ops', 2), row('nav.tab.OWNER.compliance', 3), row('nav.tab.OWNER.people', 4),
      row('nav.tab.person.person-9.people', 1)];
    expect(H.layout({ rows, iso: '2026-11-14', role: 'OWNER' }).tabs).toEqual(['sales', 'ops', 'compliance']);
    expect(H.layout({ rows, iso: '2026-11-14', role: 'OWNER', person: 'person-9' }).tabs).toEqual(['people']);
  });

  test('a section switched off is hidden from the bar and More; Money shows only once switched on; rows judged on the day', () => {
    const H = nav();
    const rows = [row('nav.on.people', 0), row('nav.on.money', 1, '2026-12-01'), row('nav.on.ops', 0, '2026-01-01', '2026-06-30')];
    const nov = H.layout({ rows, iso: '2026-11-14', role: 'OWNER' });
    expect(nov.tabs).toEqual(['compliance', 'ops']);
    expect(nov.on.people).toBeUndefined();
    expect(nov.on.money).toBeUndefined();
    const dec = H.layout({ rows, iso: '2026-12-02', role: 'OWNER' });
    expect(dec.on.money).toBe(true);
    expect(H.layout({ rows, iso: '2026-03-01', role: 'OWNER' }).tabs).toEqual(['compliance']);   // ops off in its dated window
  });

  test('a view a bar tab opens is not repeated under More; every other view keeps its button', () => {
    const H = nav();
    const html = H.html({ has: () => true });
    for (const id of ['map', 'compliance', 'dogs', 'staff']) expect(html.split('data-go="' + id + '"').length - 1, id).toBe(1);
    for (const id of ['today', 'work', 'litters', 'areas', 'round', 'sops', 'enquiries', 'admin', 'breed']) expect(html, id).toContain('data-go="' + id + '"');
    expect(html).toContain('href="./history.html"');
    expect(html).not.toMatch(/data-go="(shape|buyers)"/);
  });
});

test('hub: owner rows move Sales onto the bar and switch People off; old routes still open', async ({ page, guard }) => {
  setFile(guard.world, 'BLD-breeding_rule.csv', 'id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by\n'
    + 'n1,t,nav.tab.OWNER.sales,1,2026-01-01,Pretend setting,,,\nn2,t,nav.tab.OWNER.compliance,2,2026-01-01,Pretend setting,,,\n'
    + 'n3,t,nav.on.people,0,2026-01-01,Pretend setting,,,\n');
  await page.goto('cdhub/');
  await signIn(page);
  await expect(page.locator('#nav > button.ht[data-section] .htl')).toHaveText(['Main', 'Sales', 'Compliance']);
  await expect(page.locator('#nav [data-go="staff"]')).toHaveCount(0);
  for (const id of ['litters', 'round', 'areas', 'today']) {
    await page.evaluate((h) => { location.hash = h; }, '#/' + id);
    await expect(page.locator(`#nav [data-go="${id}"]`)).toHaveAttribute('aria-current', 'page');
  }
  await page.evaluate(() => { location.hash = '#/today'; });
  await expect(page.locator('#nav button[data-section="main"]')).toHaveAttribute('aria-current', 'page');
});
