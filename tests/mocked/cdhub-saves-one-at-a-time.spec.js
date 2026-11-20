// Lisa 16 Nov 2026: the round sent every room's save at once. The save script lets one save write at a time, so the
// rest waited, gave up and said "Someone else is saving right now". Saves from one device now go one at a time.
// Invented addresses and rows only.
const { test, expect } = require('../support/test');

const SINK = 'https://script.google.com/macros/s/PRETENDSCRIPT/exec';

test('hub: four saves sent together reach the save script one at a time, each answered', async ({ page }) => {
  let now = 0, most = 0;
  const order = [];
  await page.route(SINK, async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    now++; most = Math.max(most, now); order.push(body.request_id);
    await new Promise((r) => setTimeout(r, 250));
    now--;
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, result: { status: 'saved', id: body.request_id } }) });
  });
  await page.goto('cdhub/');
  const ids = await page.evaluate((url) => Promise.all(['r1', 'r2', 'r3', 'r4'].map((id) => sinkFetch({ request_id: id }, url)))
    .then((rs) => rs.map((r) => r.ok && r.result.id)), SINK);
  expect(ids).toEqual(['r1', 'r2', 'r3', 'r4']);
  expect(order).toEqual(['r1', 'r2', 'r3', 'r4']);
  expect(most).toBe(1);
});

// OV12 16 Nov 2026: leaving the page while saves wait their turn dropped them. The page now asks "Leave site?" first.
test('hub: leaving while saves are still waiting asks first; once answered it does not', async ({ page }) => {
  let release;
  const held = new Promise((r) => { release = r; });
  await page.route(SINK, async (route) => {
    await held;
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, result: { status: 'saved', id: 'x' } }) });
  });
  await page.goto('cdhub/');
  const asks = () => page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
  expect(await asks()).toBe(false);
  await page.evaluate((url) => { window.__p = Promise.all([sinkFetch({ request_id: 'w1' }, url), sinkFetch({ request_id: 'w2' }, url)]); }, SINK);
  expect(await asks()).toBe(true);
  release();
  await page.evaluate(() => window.__p);
  expect(await asks()).toBe(false);
});
