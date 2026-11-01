// TidyUp stage 5 done-test: the Bin page in the job file's section 8 order, in plain words.
// Needs you now · Ready to bin · Check · Not ready yet · Already in the bin · Log · Dropbox.
// Pretend Drive only; every id below is made up.
const { test, expect } = require('../support/test');
const { IDS } = require('../support/world');

const PCP = 'ZZ_DELETE_DRIVE_';
const A = { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'text/plain' };
const MINE = { parents: ['my-root'], driveId: null, mimeType: 'application/pdf' };
const ORDER = ['needsNow', 'sweepCard', 'checkCard', 'notReadyCard', 'binCard', 'logCard', 'dropboxCard'];
const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};
const ledger = (world, ids) => { world.byId(IDS.ledger).content = 'file_id\n' + ids.join('\n') + '\n'; };
const patched = (world) => world.calls.filter((c) => c.method === 'PATCH').map((c) => c.path.replace('/files/', '')).sort();
const fill = (w) => {
  w.file('zz-ready', 'ZZ_DELETE_ready.txt', 'invented', A);
  w.file('zz-held', 'ZZ_DELETE_held.txt', 'invented', A);
  w.file('zz-zero', 'ZZ_DELETE_empty.txt', '', Object.assign({ size: 0 }, A));
  w.file('zz-rr', 'ZZ_DELETE_RR_notes.txt', 'invented', A);
  w.file('me-ready', PCP + 'old-invoice.pdf', 'x', MINE);
  w.file('me-held', PCP + 'no-row.pdf', 'x', MINE);
  ledger(w, ['zz-ready', 'zz-zero', 'zz-rr', 'me-ready']);
};
const openBin = async (page, guard) => {
  fill(guard.world);
  await page.goto('./#/bin');
  await signIn(page);
  await expect(page.locator('#sweepCard [title="ZZ_DELETE_ready.txt"]')).toHaveCount(1);
  await expect(page.locator('#sweepCard [title="' + PCP + 'old-invoice.pdf"]')).toHaveCount(1);
};

test.describe('Bin page: section 8 order and plain words (stage 5)', () => {
  test('the sections come in section 8 order, and Ready to bin is the first card and open', async ({ page, guard }) => {
    await openBin(page, guard);
    const order = await page.evaluate((ids) => {
      const els = ids.map((id) => document.getElementById(id));
      if (els.some((e) => !e)) return 'missing: ' + ids.filter((id, i) => !els[i]).join(', ');
      for (let i = 1; i < els.length; i++) if (!(els[i - 1].compareDocumentPosition(els[i]) & Node.DOCUMENT_POSITION_FOLLOWING)) return 'out of order at ' + ids[i];
      return 'ok';
    }, ORDER);
    expect(order).toBe('ok');
    await expect(page.locator('#view details.card').first()).toHaveAttribute('id', 'sweepCard');
    await expect(page.locator('#sweepCard')).toHaveJSProperty('open', true);
    await expect(page.locator('#sweepCard > summary h3')).toHaveText('Ready to bin');
    await expect(page.locator('#needsNow')).toContainText('2 files ready for you to approve');
    await expect(page.locator('#needsNow')).toContainText('0 problems');
    // The old index strip and Permission card are gone.
    await expect(page.locator('#view nav[aria-label="Bin index"]')).toHaveCount(0);
    await expect(page.locator('#view [data-fold="access"]')).toHaveCount(0);
    await expect(page.locator('#view [data-action="grantwrite"]')).toHaveCount(0);
  });

  test('one tick list holds both places, each line with a place tag and the plain name', async ({ page, guard }) => {
    await openBin(page, guard);
    const ready = page.locator('#sweepCard [data-bin-list="ready"]');
    const shared = ready.locator('li:has([title="ZZ_DELETE_ready.txt"])');
    const work = ready.locator('li:has([title="' + PCP + 'old-invoice.pdf"])');
    await expect(shared.locator('.fname, label span').first()).toContainText('ready.txt');
    await expect(shared).not.toContainText('ZZ_');
    await expect(shared.locator('.mtag')).toHaveText('Test Drive Alpha');
    await expect(work.locator('.mtag')).toHaveText('Work My Drive');
    await expect(work).not.toContainText('ZZ_');
    await expect(ready.locator('ul.files')).toHaveCount(1);
    await expect(ready.locator('li')).toHaveCount(2);
  });

  test('no red button on the Bin page except Bin these', async ({ page, guard }) => {
    await openBin(page, guard);
    await page.locator('#sweepCard [data-action="selectall"]').click();
    await page.locator('#sweepCard [data-action="sweep"]').click(); // asks for write access first
    await expect.poll(() => page.evaluate(() => window.__GIS_CALLS.request)).toBeGreaterThan(1);
    await expect(page.locator('[data-action="sweep"]')).toContainText('Bin these (2)');
    for (const key of ['notready', 'bins', 'log', 'dropbox']) await page.evaluate((k) => { const d = document.querySelector('[data-fold="' + k + '"]'); if (d) d.open = true; }, key);
    const red = await page.locator('#view .btn.danger').evaluateAll((els) => els.map((e) => e.getAttribute('data-action') + ':' + e.textContent.trim()));
    expect(red).toEqual(['sweep:Bin these (2)']);
  });

  test('no internal names in the visible text, outside file names, tooltips and the why fold', async ({ page, guard }) => {
    await openBin(page, guard);
    const text = await page.evaluate(() => {
      const hide = Array.from(document.querySelectorAll('#view .fname, #view [data-why]'));
      hide.forEach((e) => { e.dataset.was = e.style.display; e.style.display = 'none'; });
      const t = document.getElementById('view').innerText;
      hide.forEach((e) => { e.style.display = e.dataset.was; });
      return t;
    });
    expect(text).not.toMatch(/ZZ_|ledger|RR_|E02|UNSURE|lcme-grok/);
  });

  test('no disabled tick boxes, Not ready yet has no tick boxes, and each of its lines names who acts', async ({ page, guard }) => {
    await openBin(page, guard);
    await expect(page.locator('#view input[type="checkbox"][disabled]')).toHaveCount(0);
    const nr = page.locator('#notReadyCard');
    await expect(nr).toHaveJSProperty('open', false);
    await nr.locator('> summary').click();
    await expect(nr.locator('input')).toHaveCount(0);
    await expect(nr.locator('li', { hasText: 'ZZ_DELETE_held.txt' })).toContainText('Waiting for the tidy bot to log it');
    await expect(nr.locator('li', { hasText: 'ZZ_DELETE_empty.txt' })).toContainText('Empty file, left for a person to check');
    await expect(nr.locator('li', { hasText: 'ZZ_DELETE_RR_notes.txt' })).toContainText('Protected, never binned');
    await expect(nr.locator('li', { hasText: PCP + 'no-row.pdf' })).toContainText('Waiting for the tidy bot to log it');
    await expect(nr.locator('[data-why] > summary')).toHaveText("Why can't these be binned?");
  });

  test('Already in the bin, Log and Dropbox are folded closed; Dropbox sits last with neutral buttons', async ({ page, guard }) => {
    await openBin(page, guard);
    for (const id of ['binCard', 'logCard', 'dropboxCard']) await expect(page.locator('#' + id)).toHaveJSProperty('open', false);
    const dbx = page.locator('#dropboxCard');
    await expect(page.locator('#view > *').last()).toHaveAttribute('id', 'dropboxCard');
    await expect(dbx).toContainText('Dropbox is being emptied. A Dropbox copy never counts as a safe copy.');
    await expect(dbx.locator('a.btn', { hasText: 'Open Dropbox Deleted files (your own step)' })).toHaveCount(1);
    await expect(dbx.locator('.btn.danger')).toHaveCount(0);
  });

  test('without write access, the button reads "Allow access, then bin" and is not red; with nothing ticked it says tick a file first', async ({ page, guard }) => {
    await openBin(page, guard);
    const btn = page.locator('#sweepCard [data-action="sweep"]');
    await expect(btn).toBeDisabled();
    await expect(btn).toContainText('Bin these: tick a file first');
    await page.locator('#sweepCard li:has([title="ZZ_DELETE_ready.txt"]) input').check();
    await expect(btn).toContainText('Allow access, then bin (1)');
    await expect(btn).not.toHaveClass(/danger/);
    await expect(page.locator('#sweepCard')).toContainText('Goes to the shared-drive bin. You can get it back for 30 days.');
    expect(patched(guard.world)).toEqual([]);
  });

  test('Bin these bins a shared-drive row and a Work My Drive row after one short confirm', async ({ page, guard }) => {
    const dialogs = [];
    page.on('dialog', async (d) => { dialogs.push(d.message()); await d.accept(); });
    await openBin(page, guard);
    await page.locator('#sweepCard li:has([title="ZZ_DELETE_ready.txt"]) input').check();
    await page.locator('#sweepCard li:has([title="' + PCP + 'old-invoice.pdf"]) input').check();
    const btn = page.locator('#sweepCard [data-action="sweep"]');
    await btn.click();
    await expect.poll(() => page.evaluate(() => window.__GIS_CALLS.request)).toBeGreaterThan(1);
    await expect(btn).toContainText('Bin these (2)');
    await btn.click();
    await expect.poll(() => guard.world.byId('zz-ready').trashed).toBe(true);
    await expect.poll(() => guard.world.byId('me-ready').trashed).toBe(true);
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0].split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(40);
    expect(dialogs[0]).toMatch(/^Bin 2 files\? They go to the Drive bin and can be restored for 30 days\. Protected and unready files are never included\.$/);
    expect(patched(guard.world)).toEqual(['me-ready', 'zz-ready']);
    for (const id of ['zz-held', 'zz-zero', 'zz-rr', 'me-held']) expect(guard.world.byId(id).trashed, id).toBeFalsy();
    await expect(page.locator('#logCard')).toHaveJSProperty('open', true);
    await expect(page.locator('#logCard')).toContainText('Moved 1 to the bin');
    await expect(page.locator('#logCard')).toContainText('moved 1 to the bin');
  });

  test('Cancel on the one confirm bins nothing', async ({ page, guard }) => {
    const dialogs = [];
    page.on('dialog', async (d) => { dialogs.push(d.message()); await d.dismiss(); });
    await openBin(page, guard);
    await page.locator('#sweepCard [data-action="selectall"]').click();
    const btn = page.locator('#sweepCard [data-action="sweep"]');
    await btn.click();
    await expect.poll(() => page.evaluate(() => window.__GIS_CALLS.request)).toBeGreaterThan(1);
    await btn.click();
    await expect.poll(() => dialogs.length).toBe(1);
    await expect(page.locator('#logCard')).toContainText('Cancelled. Nothing moved.');
    await expect(page.locator('#logCard')).toContainText('Cancelled. Nothing binned.');
    expect(patched(guard.world)).toEqual([]);
  });

  test('Check: plain buttons, none red, and "Waiting for the tidy bot" when the web app is off', async ({ page, guard }) => {
    await openBin(page, guard);
    const card = page.locator('#checkCard');
    await expect(card.locator('> summary h3')).toHaveText('Check: put back by the bin guard');
    await expect(card.locator('[data-check-nourl]')).toContainText('Waiting for the tidy bot');
    await expect(card.locator('.btn.danger')).toHaveCount(0);
    await expect(card.locator('.note.fail')).toHaveCount(0);
  });
});
