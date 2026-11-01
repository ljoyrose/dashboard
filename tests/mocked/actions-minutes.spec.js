// Home: the Actions minutes card (JOB 46, 30 Oct 2026). Private minutes used this month against the 2,000 free, per repo
// and per workflow, days to reset, last run per repo, amber at 75%, red at 90%, stale after 2 days. Pretend Drive only;
// every label and number is invented. The card reads one counts-only JSON with the existing sign-in and sends nothing.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');

const CONFIG = fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8');
const FOLDER = 'FAKE_MINS_FOLDER';
const SHOTS = process.env.MINS_SHOTS; // set to a folder to save one screenshot per state for the PR

const state = (used, ageH = 3, extra = {}) => Object.assign({
  version: 1, generated_at: new Date(Date.now() - ageH * 3600e3).toISOString(),
  reset_at: (() => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString(); })(),
  free_minutes: 2000, used_minutes: used, source: 'billing', partial: false,
  repos: [{ label: 'Alpha', minutes: used - 100, last_run: { status: 'success' } }, { label: 'Beta', minutes: 100, last_run: { status: 'failure' } }, { label: 'Gamma', minutes: 0, last_run: { status: 'running' } }],
  workflows: [{ repo: 'Alpha', label: 'Scan', minutes: used - 140, runs: 30 }, { repo: 'Alpha', label: 'Tests', minutes: 40, runs: 12 }, { repo: 'Beta', label: 'Sync', minutes: 100, runs: 9 }]
}, extra);

async function withFile(page, guard, st) {
  await page.route(/\/config\.js$/, (route) => route.fulfill({ status: 200, contentType: 'text/javascript',
    body: CONFIG.replace(/actionsMinutes: \{\s*folderId: ''/, `actionsMinutes: {\n      folderId: '${FOLDER}'`) }));
  if (st) guard.world.file('mins-json', 'ACTIONS-MINUTES.json', JSON.stringify(st), { parents: [FOLDER], driveId: null, mimeType: 'application/json' });
}
async function open(page) {
  await page.goto('./');
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
  const card = page.locator('#minsCard');
  await expect(card).toBeVisible();
  return card;
}
async function shot(card, name) {
  if (!SHOTS) return;
  await card.page().addStyleTag({ content: 'header, nav.main { position: static !important; }' }); // screenshots only: keep the bars off the card
  await card.screenshot({ path: path.join(SHOTS, `actions-minutes-${name}.png`) });
}

test.describe('Home: Actions minutes card', () => {
  test('empty folder id: invented example data with the Example tag, and no Drive read for the file', async ({ page, guard }) => {
    const asked = [];
    page.on('request', (r) => { if (/ACTIONS-MINUTES/.test(decodeURIComponent(r.url()))) asked.push(r.url()); });
    const card = await open(page);
    await expect(card.locator('[data-example]')).toHaveText('Example');
    await expect(card.locator('[data-mins-used] .num')).toHaveText('1,240 / 2,000');
    await expect(card.locator('[data-mins-level]')).toHaveAttribute('data-mins-level', 'ok');
    await expect(card.locator('[data-mins-repos] li')).toHaveCount(3);
    await expect(card.locator('[data-mins-diet]')).toHaveCount(0);
    expect(asked).toEqual([]);
    await shot(card, 'example');
  });

  test('real file under 75%: counts, per repo with last-run chips, per workflow, days to reset, usage link', async ({ page, guard }) => {
    await withFile(page, guard, state(900));
    const card = await open(page);
    await expect(card.locator('[data-example]')).toHaveCount(0);
    await expect(card.locator('[data-mins-used] .num')).toHaveText('900 / 2,000');
    await expect(card.locator('[data-mins-used] .label')).toContainText('45%');
    const d = new Date(), reset = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    await expect(card.locator('[data-mins-reset] .num')).toHaveText(String(Math.ceil((reset - Date.now()) / 864e5)));
    await expect(card.locator('[data-mins-repos] li').nth(0)).toContainText('Alpha');
    await expect(card.locator('[data-mins-repos] li').nth(0).locator('.mtag.ok')).toHaveText('Passed');
    await expect(card.locator('[data-mins-repos] li').nth(1).locator('.mtag.risk')).toHaveText('Failed');
    await expect(card.locator('[data-mins-repos] li').nth(2).locator('.mtag.ops')).toHaveText('Running');
    await expect(card.locator('[data-mins-workflows] li')).toHaveCount(3);
    await expect(card.locator('[data-mins-workflows] li').first()).toContainText('Scan');
    await expect(card.locator('[data-mins-stale]')).toHaveCount(0);
    const link = card.locator('[data-mins-usage]');
    await expect(link).toHaveAttribute('href', 'https://github.com/settings/billing/usage');
    await expect(link).toHaveAttribute('target', '_blank');
    await shot(card, 'ok');
  });

  test('amber at 75%', async ({ page, guard }) => {
    await withFile(page, guard, state(1500));
    const card = await open(page);
    await expect(card.locator('[data-mins-level]')).toHaveAttribute('data-mins-level', 'amber');
    await expect(card.locator('[data-mins-level] .mtag.ops').first()).toHaveText('Over 75%');
    await expect(card.locator('[data-mins-diet]')).toHaveCount(0);
    await shot(card, 'amber');
  });

  test('red at 90% adds the one diet line (text only, no button, nothing sent)', async ({ page, guard }) => {
    await withFile(page, guard, state(1800));
    const card = await open(page);
    await expect(card.locator('[data-mins-level]')).toHaveAttribute('data-mins-level', 'red');
    await expect(card.locator('[data-mins-level] .mtag.risk')).toHaveText('Over 90%');
    await expect(card.locator('[data-mins-diet]')).toHaveText('Ask SYS-CD for a minutes diet');
    await expect(card.locator('[data-mins-diet] a, [data-mins-diet] button')).toHaveCount(0);
    await shot(card, 'red');
  });

  test('stale after 2 days says so', async ({ page, guard }) => {
    await withFile(page, guard, state(400, 24 * 3 + 1));
    const card = await open(page);
    await expect(card.locator('[data-mins-stale]')).toHaveText('Stale: 3 days old');
    await shot(card, 'stale');
  });

  test('folder set but no file yet: a plain note, not a failure', async ({ page, guard }) => {
    await withFile(page, guard, null);
    const card = await open(page);
    await expect(card).toContainText('No minutes file yet');
    await expect(card.locator('.st-failed')).toHaveCount(0);
  });

  test('page code holds no real repo names and no token', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
    const block = html.slice(html.indexOf('// ---- Actions minutes'), html.indexOf('// timed = the 5-minute refresh'));
    const tile = html.slice(html.indexOf('function minsTile'), html.indexOf('function minsTile') + 4000);
    [block, tile].forEach((t) => { expect(t).not.toMatch(/ljoyrose\/|gh[pousr]_|github_pat_|Authorization/); });
  });
});
