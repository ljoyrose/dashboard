// JOB 34 (group B): Money Hub views, buttons and states that no other spec proves yet.
// Every row is invented (tests/fixtures/job34/money/). Pretend Google and Drive only.
const { test, expect, HUBS, fixture, DRIVE, sideScroll, tabWalk } = require('../fixtures/job34/load');

const useManyTodos = (world) => {
  const f = world.byId('m-reg');
  f.content = fixture('money', 'MON-REGISTER-many.csv');
  f.size = String(f.content.length);
};
const hashTo = (page, v) => page.evaluate((h) => { location.hash = '#/' + h; }, v);

test.describe('Money Hub: Show more and Show all on a long list', () => {
  test('To-do Ready now shows 8 of 20; Show more adds 8; Show all shows every one and the bar goes', async ({ page, guard }) => {
    useManyTodos(guard.world);
    await HUBS.money.open(page, guard);
    await hashTo(page, 'todo');
    const card = page.locator('#view section.card', { has: page.locator('h3', { hasText: 'Ready now' }) });
    const rows = card.locator('ul.items > li');
    await expect(rows).toHaveCount(8);
    await expect(card.locator('[data-show-bar]')).toContainText('Showing 8 of 20.');
    await card.locator('[data-action="showmore"]').click();
    await expect(rows).toHaveCount(16);
    await expect(card.locator('[data-show-bar]')).toContainText('Showing 16 of 20.');
    await card.locator('[data-action="showall"]').click();
    await expect(rows).toHaveCount(20);
    await expect(card.locator('[data-show-bar]')).toHaveCount(0);
  });

  test('signing out forgets Show all: after signing in again the list is short again', async ({ page, guard }) => {
    useManyTodos(guard.world);
    await HUBS.money.open(page, guard);
    await hashTo(page, 'todo');
    const card = page.locator('#view section.card', { has: page.locator('h3', { hasText: 'Ready now' }) });
    await card.locator('[data-action="showall"]').click();
    await expect(card.locator('ul.items > li')).toHaveCount(20);
    await page.locator('#signOutBtn').click();
    await page.locator('#signInBtn').click();
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    await expect(card.locator('ul.items > li')).toHaveCount(8);
  });
});

test.describe('Money Hub: what each To-do tab holds', () => {
  test('Waiting on others holds only other people\'s open tasks; Watching holds open checks; Closed holds closed rows, newest first', async ({ page, guard }) => {
    useManyTodos(guard.world);
    await HUBS.money.open(page, guard);
    await hashTo(page, 'todo/others');
    await expect(page.locator('#view')).toContainText('Sample task for Sample Person');
    await expect(page.locator('#view')).not.toContainText('Sample ready task 01');
    await expect(page.locator('#view')).not.toContainText('Sample watched check');
    await hashTo(page, 'todo/watch');
    await expect(page.locator('.subnav a[href="#/todo/watch"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#view h3', { hasText: 'Conditions and checks being watched' })).toBeVisible();
    await expect(page.locator('#view')).toContainText('Sample watched check');
    await expect(page.locator('#view')).not.toContainText('Sample ready task 01');
    await hashTo(page, 'todo/closed');
    const items = page.locator('#view ul.items > li');
    await expect(items).toHaveCount(2);
    await expect(items.first()).toContainText('Sample newer closed task');
    await expect(page.locator('#view')).not.toContainText('Sample watched check');
  });

  test('with the fixture register, Watching says "Nothing here." in plain words', async ({ page, guard }) => {
    await HUBS.money.open(page, guard);
    await hashTo(page, 'todo/watch');
    await expect(page.locator('#view')).toContainText('Nothing here.');
  });
});

test.describe('Money Hub: addresses that point at nothing', () => {
  test('#/register/ with an unknown id shows the To-do list (Yours), not a blank page', async ({ page, guard }) => {
    await HUBS.money.open(page, guard);
    await hashTo(page, 'register/R999-FAKE');
    await expect(page.locator('#hereTitle')).toHaveText('To-do');
    await expect(page.locator('.subnav a[href="#/todo/yours"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#view')).toContainText('Sample task ready now');
  });

  test('#/e/ with an unknown entity says no entity has that name, and Money stays the selected tab', async ({ page, guard }) => {
    await HUBS.money.open(page, guard);
    await hashTo(page, 'e/NOPE-SAMPLE');
    await expect(page.locator('#view h3')).toHaveText('No entity called NOPE-SAMPLE');
    await expect(page.locator('#hereTitle')).toHaveText('NOPE-SAMPLE');
    await expect(page.locator('nav.main a[data-nav="money"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#view')).not.toContainText('£');
  });

  test('a single to-do (#/register/R001): its "All to-dos" link goes to the To-do list', async ({ page, guard }) => {
    await HUBS.money.open(page, guard);
    await hashTo(page, 'register/R001');
    await expect(page.locator('nav.main a[data-nav="todo"]')).toHaveAttribute('aria-current', 'page');
    await page.locator('#view a', { hasText: 'All to-dos' }).click();
    await expect(page).toHaveURL(/#\/todo$/);
    await expect(page.locator('.subnav')).toBeVisible();
  });
});

test.describe('Money Hub: keyboard', () => {
  test('changing view puts focus on the screen title; the bottom tabs are reachable with Tab and open with Enter', async ({ page, guard }) => {
    await HUBS.money.open(page, guard);
    await page.locator('nav.main a[data-nav="dates"]').click();
    await expect(page.locator('#hereTitle')).toBeFocused();
    const seen = await tabWalk(page, 80);
    for (const t of ['Now', 'Money', 'Dates', 'To-do', 'Accountant', 'Control']) expect(seen.some((s) => s.startsWith(t)), t + ' reachable by Tab').toBe(true);
    await page.locator('nav.main a[data-nav="accountant"]').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/accountant$/);
    await expect(page.locator('#hereTitle')).toHaveText('Accountant');
  });
});

test.describe('Money Hub: slow and failed reads', () => {
  test('while Drive is slow the stamp says "Reading…", then the read time', async ({ page, guard }) => {
    await page.goto('money/');
    await expect(page.locator('#signInBtn')).toBeEnabled();
    let held = false; // hold only the first Drive call so the test stays quick
    await page.route(DRIVE, async (route) => { if (!held) { held = true; await new Promise((r) => setTimeout(r, 2500)); } return route.fallback(); });
    await page.locator('#signInBtn').click();
    await expect(page.locator('#readStamp')).toHaveText('Reading…');
    await expect(page.locator('#view')).not.toContainText('£');
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
  });

  test('after a failed read, "Try again" reads Drive again and the figures appear', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/status of 403/);
    guard.world.failWith = { status: 403, reason: 'forbidden', message: 'Sample refusal', includeAbout: true };
    await page.goto('money/');
    await expect(page.locator('#signInBtn')).toBeEnabled();
    await page.locator('#signInBtn').click();
    await expect(page.locator('#view')).toContainText('Could not read Drive');
    guard.world.failWith = null;
    await page.locator('#view button[data-action="refresh"]', { hasText: 'Try again' }).click();
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    await expect(page.locator('#view')).not.toContainText('Could not read Drive');
    await hashTo(page, 'money');
    await expect(page.locator('a.ent', { hasText: 'TESTCO' })).toBeVisible();
  });
});

test.describe('Money Hub phone: views the phone spec does not visit', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('#/todo/watch, #/todo/yours with a long list, an unknown entity and an unknown to-do: no sideways scroll', async ({ page, guard }) => {
    useManyTodos(guard.world);
    await HUBS.money.open(page, guard);
    for (const v of ['todo/watch', 'todo/yours', 'e/NOPE-SAMPLE', 'register/R999-FAKE']) {
      await hashTo(page, v);
      await expect(page.locator('#view')).toHaveAttribute('data-view', v.split('/')[0]);
      expect(await sideScroll(page), '#/' + v).toBe(false);
    }
  });
});
