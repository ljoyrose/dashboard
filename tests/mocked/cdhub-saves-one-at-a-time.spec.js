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
