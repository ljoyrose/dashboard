// Do page, "Standing approvals" card: the Drive queue of blocked agent actions, ticked in bulk.
// Pretend Drive only; every name below is made up.
const { test, expect } = require('../support/test');
const { IDS } = require('../support/world');

const QUEUE = 'date,session,action,target,why blocked,status\n' +
  '2026-11-03,JOB 9.1,Move file,Plans.md into Shared A,permission prompt,\n' +
  '2026-11-03,JOB 9.2,Rename,Old notes,folder not reachable,open\n' +
  '2026-11-02,JOB 9.3,Trash,Spare copy,sharing check failed,done\n';

const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};

test.describe('Do page: Standing approvals card', () => {
  test('lists only open rows, each with a tick box, and says a tick approves only that row', async ({ page, guard }) => {
    guard.world.byId(IDS.doQueue).content = QUEUE;
    await page.goto('./#/do');
    await signIn(page);
    const card = page.locator('#dqCard');
    await expect(card.locator('h3')).toHaveText('Standing approvals');
    await expect(card.locator('li[data-dq-row]')).toHaveCount(2);
    await expect(card).toContainText('Move file');
    await expect(card).toContainText('permission prompt');
    await expect(card).not.toContainText('Spare copy'); // done rows are not asked again
    await expect(card).toContainText('Ticking approves only that row');
    await expect(card.locator('[data-action="dqapprove"]')).toBeDisabled();
    await page.screenshot({ path: 'test-results/do-standing-approvals.png', fullPage: true });
  });

  test('an empty queue says nothing is blocked', async ({ page, guard }) => {
    await page.goto('./#/do');
    await signIn(page);
    await expect(page.locator('#dqCard')).toContainText('Nothing blocked');
  });

  test('Approve ticked drops ONE request file with only the ticked rows and never edits the queue', async ({ page, context, guard }) => {
    guard.world.byId(IDS.doQueue).content = QUEUE;
    const uploads = [];
    await context.route('https://www.googleapis.com/upload/drive/v3/files**', (route) => {
      uploads.push(route.request().postData() || '');
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'req-1' }) });
    });
    await page.goto('./#/do');
    await signIn(page);
    // The pretend sign-in already holds the full Drive scope, so the write goes straight through.
    const card = page.locator('#dqCard');
    await card.locator('li[data-dq-row="2"] input[type="checkbox"]').check();
    await expect(card.locator('[data-action="dqapprove"]')).toContainText('Approve ticked (1)');
    await card.locator('[data-action="dqapprove"]').click();
    await expect(card.locator('li[data-dq-row="2"]')).toContainText('Approved, sent');
    await expect(card.locator('li[data-dq-row="1"] input[type="checkbox"]')).toBeEnabled();
    expect(uploads).toHaveLength(1);
    expect(uploads[0]).toContain('AA_CJ-DO-APPROVE-');
    expect(uploads[0]).toContain(IDS.doQueueFolder);
    expect(uploads[0]).toContain('"row":2');
    expect(uploads[0]).not.toContain('"row":1');
    expect(guard.world.calls.filter((c) => c.method === 'PATCH' && c.path.indexOf(IDS.doQueue) >= 0)).toHaveLength(0);
  });
});
