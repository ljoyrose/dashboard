// Factory checklist score + Factory docs strip (engine v2.5l, 21 Oct 2026). Pretend Google and Drive only; invented data.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const { build } = require('../fixtures/factory/state');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'factory', 'index.html'), 'utf8');
const LOGS = require('../support/world').IDS.factoryLogs;

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
  test('rooms show the checklist score and one-click factory docs', async ({ page, guard }) => {
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

// Steps in words and no solid colour fills (Lisa, 28 Oct 2026): same rule as Studio.
test.describe('Factory steps', () => {
  test('an app card says "Step N: Name"; step rings and the stage strip are tint + 1px ring, never solid', async ({ page, guard }) => {
    await open(page, guard);
    await page.evaluate(() => { location.hash = '#/card/869fjxpc2'; });
    await expect(page.locator('.hero .step')).toHaveText('Step 4:');
    await expect(page.locator('.hero p')).toContainText('Step 4: Schema');
    await expect(page.locator('.hero .disc')).toHaveCount(0);
    await expect(page.locator('.stage[data-stage="2"]')).toContainText('Step 2: Base');
    await expect(page.locator('.stage[data-stage="2"] .n')).toHaveText('✓');
    await expect(page.locator('.stage[data-stage="4"] .n')).toHaveText('●');
    const solid = await page.evaluate(() => {
      const sum = (c) => { const m = c.match(/[\d.]+/g).map(Number), k = /^color\(/.test(c) ? 255 : 1; return m[3] === 0 ? 999 : (m[0] + m[1] + m[2]) * k; };
      const bad = [];
      document.querySelectorAll('.stage .n, .strip i').forEach((e) => {
        const c = getComputedStyle(e), ring = c.borderTopWidth !== '0px' && c.borderTopStyle !== 'none' ? c.borderTopColor : (c.boxShadow.match(/rgba?\([^)]*\)/) || [''])[0];
        if (ring && c.backgroundColor !== 'rgba(0, 0, 0, 0)' && sum(c.backgroundColor) <= sum(ring)) bad.push(e.className + ' ' + c.backgroundColor);
      });
      return bad;
    });
    expect(solid).toEqual([]);
  });
});

// Factory tab counts match Studio's needs-you counts (Lisa, 28 Oct 2026); the unread dot and switch knob stay solid on purpose.
test.describe('Factory tab counts', () => {
  test('tab counts are an exact 30x22 amber ring with a tint and an ink number, never solid', async ({ page, guard }) => {
    await open(page, guard);
    const n = page.locator('#nMe');
    const st = await n.evaluate((e) => { const c = getComputedStyle(e), b = e.getBoundingClientRect(); return { w: Math.round(b.width * 100) / 100, h: Math.round(b.height), bw: c.borderTopWidth, bc: c.borderTopColor, bg: c.backgroundColor, col: c.color, ink: getComputedStyle(document.body).color }; });
    expect([st.w, st.h, st.bw]).toEqual([30, 22, '1px']);
    expect(st.bg).not.toBe(st.bc); // a tint, not a solid fill of the ring colour
    expect(st.col).toBe(st.ink);
  });
});
