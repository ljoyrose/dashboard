// Factory checklist score + Factory docs strip (engine v2.5l, 21 Oct 2026). Pretend Google and Drive only; invented data.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const { build } = require('../fixtures/factory/state');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'factory', 'index.html'), 'utf8');
const LOGS = /logs: '([^']+)'/.exec(SRC)[1];

async function open(page, guard, change) {
  const state = build(Date.now());
  if (change) change(state);
  guard.world.folder(LOGS, 'AF logs (sample)');
  guard.world.file('af-state-sample', 'af-state.json', JSON.stringify(state), { parents: [LOGS], mimeType: 'application/json' });
  await page.goto('factory/#/rooms');
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#appPick')).toBeVisible();
}

test.describe('Factory checklist', () => {
  test('rooms show the checklist score and one-click factory docs @regression', async ({ page, guard }) => {
    await open(page, guard, (s) => {
      s.checklist = { pass: 27, fail: 46, open: 129, total: 202, pct: 13.4 };
      s.lists.checklist = [{ id: 'ck1', name: 'Factory docs', status: 'to do', tags: ['docs'], desc: 'Factory docs\ngoal: https://drive.google.com/file/d/G/view\nchecklist: https://app.clickup.com/1/v/li/2\nlessons3: https://drive.google.com/file/d/L3/view', links: {} }];
    });
    const pill = page.locator('#view a.pill', { hasText: '27/202' });
    await expect(pill).toHaveAttribute('href', 'https://app.clickup.com/1/v/li/2');
    await expect(page.locator('#view .pills.docs a', { hasText: 'goal' })).toHaveAttribute('href', 'https://drive.google.com/file/d/G/view');
    await expect(page.locator('#view .pills.docs a', { hasText: 'lessons3' })).toHaveCount(1);
  });

  test('no checklist yet: no score pill, no docs strip', async ({ page, guard }) => {
    await open(page, guard);
    await expect(page.locator('#view .pills.docs')).toHaveCount(0);
    await expect(page.locator('#view .pill .ti-list-check')).toHaveCount(0);
  });
});
