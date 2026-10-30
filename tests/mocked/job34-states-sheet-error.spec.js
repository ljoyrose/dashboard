// JOB 34 state matrix (group E): DRIVE / SHEETS ANSWER 500, every hub. Every Drive files call and every Sheets call
// fails with 500 (after any retries the page makes). Each hub must show a visible error message in its own words and
// not crash. The browser's own "Failed to load resource ... 500" network line is expected here and allowed; anything
// else on the console still fails the test.
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

// FIX-REQUEST J34-F80 (money/index.html:416 and :715): when every Drive read fails, the Now view still says
// "Nothing needs you right now" and the header stamp says "Read hh:mm" instead of "Read failed"; the failure shows only
// as small "folder read failed" source notes and a Control count. It reads as all clear when nothing was read.
// DECISION NEEDED: fix the page (see FIX-REQUEST above) or accept it. OWNER: Lisa. BY 2026-11-06
test.fixme('J34-F80 money: every Drive read failing must not say "Nothing needs you" and the stamp must say Read failed', async ({ page, guard, allowedConsole }) => {
  await openFailing(page, guard, allowedConsole, 'money');
  await expect(page.locator('#readStamp')).toHaveText(/Read failed/, { timeout: 45_000 });
  await expect(page.locator('#view')).not.toContainText('Nothing needs you');
});
