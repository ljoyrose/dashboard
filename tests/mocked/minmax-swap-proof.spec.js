// Proof: min/max typed the wrong way round is flagged and never saved (Lisa, 12 Nov 2026).
// Invented rooms and readings only. Saving is stubbed — nothing is posted to a live script.
const { test, expect, HUBS } = require('../fixtures/job34/load');
const { tabClick } = require('../support/tabs');
const fs = require('fs');
const path = require('path');

const SHOTS = process.env.MINMAX_SHOTS_DIR || require('path').join(process.cwd(), 'test-results', 'minmax');
const SCRIPT = 'https://script.google.com/macros/s/AKfyTEST_only_minmax/exec';

const tab = async (page, id) => {
  await tabClick(page, `#nav button[data-go="${id}"]`);
  await expect(page.locator(`#nav button[data-go="${id}"]`)).toHaveAttribute('aria-current', 'page');
};

function shotDir() {
  fs.mkdirSync(SHOTS, { recursive: true });
  return SHOTS;
}

async function captureRound(page, mn, mx, msg, file) {
  await msg.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  // Keep the row clear of the sticky house footer so the warning is visible in the shot.
  await page.evaluate(() => {
    const foot = document.querySelector('.house-dock, footer, .next, #next');
    const h = foot ? foot.getBoundingClientRect().height : 80;
    const el = document.querySelector('.tmsg.swapalert, .tmsg[role="alert"]');
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.bottom > window.innerHeight - h - 12) window.scrollBy(0, r.bottom - (window.innerHeight - h - 24));
  });
  const boxes = [];
  for (const loc of [mn, mx, msg]) {
    const b = await loc.boundingBox();
    if (b) boxes.push(b);
  }
  const pad = 16;
  const vw = page.viewportSize();
  const x = Math.max(0, Math.min(...boxes.map((b) => b.x)) - pad);
  const y = Math.max(0, Math.min(...boxes.map((b) => b.y)) - 40);
  const r = Math.min(vw.width, Math.max(...boxes.map((b) => b.x + b.width)) + pad);
  const btm = Math.min(vw.height - 90, Math.max(...boxes.map((b) => b.y + b.height)) + pad);
  await page.screenshot({ path: file, clip: { x, y, width: Math.max(1, r - x), height: Math.max(1, btm - y) } });
  await page.screenshot({ path: file.replace(/\.png$/, '-page.png'), fullPage: true });
}

test.describe('Proof: min 22.0 and max 18.0 are the wrong way round', () => {
  test('Round: min first, then max — warning, both boxes marked, no POST', async ({ page, guard }) => {
    const sent = [];
    await page.addInitScript(([u, c]) => {
      try { localStorage.setItem('cdhub.sink.url', u); localStorage.setItem('cdhub.sink.code', c); } catch (e) {}
    }, [SCRIPT, 'test-code-1']);
    await page.route(/^https:\/\/script\.google\.com\/macros\//, (route) => {
      sent.push({ method: route.request().method(), url: route.request().url(), post: route.request().postData() });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result: { status: 'saved', id: 'r1', at: new Date().toISOString() } }) });
    });
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'round');
    const mn = page.locator('.tmin[data-slot="am"]').first();
    const area = await mn.getAttribute('data-area');
    const mx = page.locator(`.tmax[data-area="${area}"][data-slot="am"]`);
    const msg = page.locator(`.tmsg[data-area="${area}"][data-slot="am"]`);
    await mn.fill('22.0'); await mn.blur();
    await mx.fill('18.0'); await mx.blur();
    await expect(msg).toHaveAttribute('role', 'alert');
    await expect(msg).toContainText('max (18.0) is lower than min (22.0)');
    await expect(msg).toContainText('Not saved');
    await expect(mn).toHaveClass(/\bbad\b/);
    await expect(mx).toHaveClass(/\bbad\b/);
    expect(sent, 'no POST must be sent when min/max are swapped').toHaveLength(0);
    const dir = shotDir();
    await captureRound(page, mn, mx, msg, path.join(dir, 'round-min-first.png'));
    fs.writeFileSync(path.join(dir, 'round-min-first-posts.json'), JSON.stringify(sent, null, 2));
  });

  test('Round: max first, then min — same warning, no POST', async ({ page, guard }) => {
    const sent = [];
    await page.addInitScript(([u, c]) => {
      try { localStorage.setItem('cdhub.sink.url', u); localStorage.setItem('cdhub.sink.code', c); } catch (e) {}
    }, [SCRIPT, 'test-code-1']);
    await page.route(/^https:\/\/script\.google\.com\/macros\//, (route) => {
      sent.push({ method: route.request().method(), url: route.request().url(), post: route.request().postData() });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result: { status: 'saved', id: 'r1', at: new Date().toISOString() } }) });
    });
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'round');
    const mx = page.locator('.tmax[data-slot="am"]').first();
    const area = await mx.getAttribute('data-area');
    const mn = page.locator(`.tmin[data-area="${area}"][data-slot="am"]`);
    const msg = page.locator(`.tmsg[data-area="${area}"][data-slot="am"]`);
    await mx.fill('18.0'); await mx.blur();
    await mn.fill('22.0'); await mn.blur();
    await expect(msg).toHaveAttribute('role', 'alert');
    await expect(msg).toContainText('max (18.0) is lower than min (22.0)');
    await expect(msg).toContainText('Not saved');
    await expect(mn).toHaveClass(/\bbad\b/);
    await expect(mx).toHaveClass(/\bbad\b/);
    expect(sent, 'no POST must be sent when min/max are swapped (max typed first)').toHaveLength(0);
    const dir = shotDir();
    await captureRound(page, mn, mx, msg, path.join(dir, 'round-max-first.png'));
    fs.writeFileSync(path.join(dir, 'round-max-first-posts.json'), JSON.stringify(sent, null, 2));
  });
});
