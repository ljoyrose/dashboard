const { test, expect, HUBS, fail, SHEETS, fixture } = require('../fixtures/job34/load');
const H = fixture('states', 'hubs.json');

test.describe.configure({ timeout: 90_000 });
async function openFailing(page, guard, allowedConsole, hub) {
  allowedConsole.push(/Failed to load resource: the server responded with a status of 500/);
  guard.world.failWith = { status: 500, reason: 'backendError', message: 'Sample failure' };
  await fail(page, SHEETS, 500, 'Sample failure');
  await page.goto(H[hub].url);
  await expect(page.locator(H[hub].signIn).first()).toBeEnabled();
  await page.locator(H[hub].signIn).first().click();
}

for (const hub of Object.keys(HUBS)) {
  test(`${hub}: Drive or Sheets answering 500 shows a visible error message, no crash`, async ({ page, guard, allowedConsole }) => {
    await openFailing(page, guard, allowedConsole, hub);
    const msg = page.getByText(new RegExp(H[hub].error, 'i')).first();
    await expect(msg, `${hub}: no visible error after 500s`).toBeVisible({ timeout: 45_000 });
  });
}

test('J34-F80 money: every Drive read failing must not say "Nothing needs you" and the stamp must say Read failed', async ({ page, guard, allowedConsole }) => {
  await openFailing(page, guard, allowedConsole, 'money');
  await expect(page.locator('#readStamp')).toHaveText(/Read failed/, { timeout: 45_000 });
  await expect(page.locator('#view')).not.toContainText('Nothing needs you');
});

