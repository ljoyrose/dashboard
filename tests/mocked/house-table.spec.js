// One table look everywhere (Lisa 14 Nov 2026: "no jumping about on columns... i prefer justified text and concise organised tables").
// Every hub table carries class house-table: widths are set once from the headers, so they do not move when the later tables land,
// on a redraw or on a filter. Paragraph text is justified. The staff app, inspector and checks pages load the same helper.
const { test, expect } = require('../support/test');

const signIn = async (page) => {
  await page.goto('cdhub/');
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
  await page.waitForFunction(() => window.LOAD && LOAD.state === 'ok' && LOAD.later === 'ok' && !LOAD.copy);
  await page.addStyleTag({ content: 'html{overflow-y:scroll}' });   // a page scrollbar coming and going is not a column moving
};
const widths = (page, sel) => page.locator(sel + ' thead th').evaluateAll((hs) => hs.map((h) => Math.round(h.getBoundingClientRect().width)));

test.describe('house-table: steady columns everywhere', () => {
  test('every table on the hub carries house-table, with a colgroup set from its headers', async ({ page }) => {
    await signIn(page);
    for (const p of ['litters', 'buyers', 'work', 'shape', 'compliance']) {
      await page.evaluate((p) => go(p, false), p);
      const r = await page.evaluate(() => [...document.querySelectorAll('#main table')].map((t) => t.classList.contains('house-table') && !!t.querySelector('colgroup col')));
      expect(r.length, p + ' has tables').toBeGreaterThan(0);
      expect(r.every(Boolean), p + ' tables are house-table').toBe(true);
    }
  });

  test('Compliance rules: column widths stay put through the later-tables redraw', async ({ page }) => {
    await signIn(page);
    await page.evaluate(() => go('compliance', false));
    const sel = '#compRules table.house-table';
    await expect(page.locator(sel).first().locator('tbody tr').first()).toBeVisible();
    const before = await widths(page, sel);
    await page.evaluate(() => { redrawAfterRead(); });
    await expect(page.locator(sel).first().locator('tbody tr').first()).toBeVisible();
    expect(await widths(page, sel)).toEqual(before);
  });

  test('paragraph text is justified; table cells and buttons are not', async ({ page }) => {
    await signIn(page);
    await page.evaluate(() => go('compliance', false));
    await expect(page.locator('#compRules td').first()).toBeVisible();
    const s = await page.evaluate(() => {
      const p = document.createElement('p'); p.textContent = 'x'; document.getElementById('main').appendChild(p);
      return { p: getComputedStyle(p).textAlign, td: getComputedStyle(document.querySelector('#main td')).textAlign, btn: getComputedStyle(document.querySelector('#nav button')).textAlign };
    });
    expect(s.p).toBe('justify');
    expect(s.td).not.toBe('justify');
    expect(s.btn).not.toBe('justify');
  });

  for (const path of ['cdhub/staff/', 'cdhub/staff/inspect/', 'cdhub/checks/']) {
    test(path + ' loads the same table helper and house style', async ({ page }) => {
      await page.goto(path);
      await page.waitForFunction(() => !!window.BLDTables);
      const t = await page.evaluate(() => {
        const t = document.createElement('table'); t.className = 'house-table';
        t.innerHTML = '<thead><tr><th>Room</th><th>Read</th></tr></thead><tbody><tr><td>A</td><td>12</td></tr></tbody>';
        document.body.appendChild(t); BLDTables.prep(t);
        return { layout: getComputedStyle(t).tableLayout, cols: t.querySelectorAll('col').length, num: t.querySelector('tbody td + td').classList.contains('num') };
      });
      expect(t).toEqual({ layout: 'fixed', cols: 2, num: true });
    });
  }
});
