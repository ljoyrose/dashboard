// JOB 32 Stage 1: each app card shows its next step and who it waits on, read from af-state.json (invented apps APP-A...).
const { test, expect } = require('../support/test');
const { build } = require('../fixtures/factory/state');
const { add } = require('../fixtures/factory/next');
const LOGS = require('../support/world').IDS.factoryLogs;

async function card(page, guard, id) {
  const now = Date.now();
  guard.world.folder(LOGS, 'AF logs (sample)');
  guard.world.file('af-state-sample', 'af-state.json', JSON.stringify(add(build(now), now)), { parents: [LOGS], mimeType: 'application/json' });
  await page.goto('factory/#/card/' + id);
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('.hero h2')).toBeVisible();
}

test.describe('Factory next step', () => {
  test('an app with open lines: the first open line of its stage, and who it waits on', async ({ page, guard }) => {
    await card(page, guard, 'appa00001');
    await expect(page.locator('[data-next="step"]')).toHaveText('Next: Write the schema notes');
    await expect(page.locator('[data-next="who"]')).toHaveText('Waits on: Claude');
  });

  test('an app with no lines: its open decision is the next step', async ({ page, guard }) => {
    await card(page, guard, 'appb00001');
    await expect(page.locator('[data-next="step"]')).toHaveText('Next: Research merit OK?');
    await expect(page.locator('[data-next="who"]')).toHaveText('Waits on: Lisa');
  });

  test('nothing recorded: both say "not recorded" in grey words, inside the house read-only pill', async ({ page, guard }) => {
    await card(page, guard, 'appc00001');
    await expect(page.locator('[data-next="step"] .nr')).toHaveText('not recorded');
    await expect(page.locator('[data-next="who"] .nr')).toHaveText('not recorded');
    const st = await page.locator('[data-next="step"]').evaluate((e) => {
      const c = getComputedStyle(e), n = getComputedStyle(e.querySelector('.nr'));
      return { bg: c.backgroundColor, bw: c.borderTopWidth, r: c.borderTopLeftRadius, nr: n.color, muted: getComputedStyle(document.body).getPropertyValue('--muted').trim() };
    });
    expect([st.bg, st.bw, st.r]).toEqual(['rgba(0, 0, 0, 0)', '1px', '12px']);
    const muted = await page.evaluate((m) => { const d = document.createElement('i'); d.style.color = m; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; }, st.muted);
    expect(st.nr).toBe(muted);
  });
});
