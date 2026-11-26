// Demo mode (the owner 22 Nov 2026: "a demo copy ... for video"; guardrails from the overseer): ?demo=1 reads only the demo
// folder, sends nothing anywhere, shows a DEMO banner on screen and in print, puts DEMO on exports, and cannot be reached
// from the inspector, guest or staff pages. Invented rows only.
const fs = require('fs');
const path = require('path');
const { tabClick } = require('../support/tabs');
const { test, expect, IDS } = require('../fixtures/job34/load');

const DEMO = (() => { const m = /demoFolderId:\s*'([^']+)'/.exec(fs.readFileSync(path.join(__dirname, '../../config.js'), 'utf8')); return m && m[1]; })();
const csv = (h, rows) => [h].concat(rows).join('\r\n') + '\r\n';
const ITEMS_H = 'id,tenant_id,item_no,name,kind_key,make,model,serial_no,size,made_on,expires_on,photo,note,corrects_id,created_at,created_by';
const KINDS = csv('id,tenant_id,kind_key,label,source,set_by,set_on', ['k1,t,pretend_plug,Pretend plug,x,o,2026-01-01']);

function worlds(world) {
  const put = (folder, name, content) => {
    const f = world.files.find((x) => x.name === name && (x.parents || []).includes(folder));
    if (f) { f.content = content; f.size = String(content.length); }
    else world.file(folder + '-' + name, name, content, { parents: [folder], driveId: 'drv-alpha1' });
  };
  put(IDS.bld, 'BLD-item_kinds.csv', KINDS);
  put(IDS.bld, 'BLD-items.csv', csv(ITEMS_H, ['i1,t,P-01,Pretend LIVE kettle,pretend_plug,,,,,,,,,,2026-01-01T00:00:00Z,o']));
  world.folder(DEMO, 'DEMO folder (sample)');
  world.files.filter((f) => (f.parents || []).includes(IDS.bld)).forEach((f) => put(DEMO, f.name, f.content));
  put(DEMO, 'BLD-items.csv', csv(ITEMS_H, ['i1,t,P-01,Pretend DEMO kettle,pretend_plug,,,,,,,,,,2026-01-01T00:00:00Z,o']));
}

async function openDemo(page, sent) {
  page.on('request', (r) => sent.push({ m: r.method(), url: decodeURIComponent(r.url().replace(/\+/g, ' ')) }));
  await page.goto('cdhub/?demo=1');
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
  await page.waitForFunction(() => window.LOAD && LOAD.later === 'ok');
}

test.describe('CD Hub: demo mode', () => {
  test('reads only the demo folder, never the live one; the banner shows on screen and in print', async ({ page, guard }) => {
    expect(DEMO).toBeTruthy();
    worlds(guard.world);
    const sent = [];
    await openDemo(page, sent);
    await expect(page.locator('[data-demo-banner]')).toHaveText(/DEMO: pretend data/);
    await expect(page).toHaveTitle(/^DEMO - /);
    await tabClick(page, '#nav button[data-go="items"]');
    await expect(page.locator('#main')).toContainText('Pretend DEMO kettle');
    await expect(page.locator('#main')).not.toContainText('Pretend LIVE kettle');
    const drive = sent.filter((r) => /googleapis\.com\/drive/.test(r.url));
    expect(drive.some((r) => r.url.includes(`'${DEMO}' in parents`))).toBe(true);
    expect(drive.filter((r) => r.url.includes(IDS.bld))).toEqual([]);
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('[data-demo-banner]')).toBeVisible();
  });

  test('nothing is sent: saves answer "Demo", and any write or save-script call is refused before it leaves', async ({ page, guard }) => {
    worlds(guard.world);
    const sent = [];
    await openDemo(page, sent);
    const r = await page.evaluate(() => sinkSend({ table: 'check_log', action: 'add', fields: {} }));
    expect(r).toEqual({ ok: false, code: 'DEMO', message: 'Demo: nothing is saved.' });
    const refused = await page.evaluate(async () => {
      const out = [];
      for (const [u, o] of [['https://www.googleapis.com/upload/drive/v3/files/x', { method: 'PATCH' }], ['https://script.google.com/macros/s/x/exec', {}], ['https://sheets.googleapis.com/v4/spreadsheets/x', {}]]) {
        try { await fetch(u, o); out.push('sent'); } catch (e) { out.push(e.message); }
      }
      return out;
    });
    expect(refused).toEqual(['Demo: nothing is sent.', 'Demo: nothing is sent.', 'Demo: nothing is sent.']);
    expect(sent.filter((x) => x.m !== 'GET' && x.m !== 'HEAD' && /google/.test(x.url))).toEqual([]);
    expect(await page.evaluate(() => copyGet())).toBe(null);
  });

  test('the items CSV is named DEMO and starts with the DEMO line; the printed report carries the banner', async ({ page, guard }) => {
    worlds(guard.world);
    await openDemo(page, []);
    await tabClick(page, '#nav button[data-go="items"]');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-itm-report="csv"]').click()]);
    expect(dl.suggestedFilename()).toMatch(/^DEMO Items /);
    const text = fs.readFileSync(await dl.path(), 'utf8');
    expect(text.split('\r\n')[0]).toBe('DEMO: pretend data, not real records');
    const [pop] = await Promise.all([page.waitForEvent('popup'), page.locator('[data-itm-report="print"]').click()]);
    await expect(pop.locator('body')).toContainText('DEMO: pretend data, not real records');
    await expect(pop).toHaveTitle(/^DEMO Items /);
  });

  test('without ?demo=1 the hub is live, with no banner; inspector, guest and staff pages never read ?demo', async ({ page, guard }) => {
    worlds(guard.world);
    await page.goto('cdhub/');
    await page.locator('#signinbtn').click();
    await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
    await expect(page.locator('[data-demo-banner]')).toHaveCount(0);
    expect(await page.evaluate(() => DEMO)).toBe(false);
    const root = path.join(__dirname, '../../cdhub/staff');
    const pages = ['inspect', 'guest', 'print'].flatMap((d) => fs.readdirSync(path.join(root, d)).map((f) => path.join(root, d, f)));
    for (const f of pages.concat([path.join(root, 'index.html'), path.join(root, 'lib/bld-save.js')])) {
      if (fs.statSync(f).isFile()) expect(fs.readFileSync(f, 'utf8'), f).not.toMatch(/demo=1|demoFolderId|CD_DEMO/);
    }
  });
});

test('in demo, links to live pages (history, The Board, print cards) are a plain note, never a link', async ({ page, guard }) => {
  worlds(guard.world);
  await openDemo(page, []);
  await expect(page.locator('[data-demo-live-note]').first()).toHaveText('Live page: open from the normal hub');
  for (const view of ['main', 'areas', 'today']) {
    await page.evaluate((v) => go(v, false), view);
    expect(await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => new URL(a.getAttribute('href'), location.href).pathname)
      .filter((p) => /\/cdhub\/(history[^/]*\.html|staff\/)/.test(p)))).toEqual([]);
  }
});

