// Shared pretend Google for the Product ideas specs (mocked and phone). Every row is invented (SAMPLE).
const fs = require('fs');
const path = require('path');
const { expect } = require('./test');

const FIX = path.join(__dirname, '..', 'fixtures', 'marketplace');
const SHEETS = /^https:\/\/sheets\.googleapis\.com\/v4\/spreadsheets\//;
const DETAIL = JSON.parse(fs.readFileSync(path.join(FIX, 'MKT-IDEA-DETAIL.json'), 'utf8'));
const FOLDER = 'FAKE-IDEAS-FOLDER-0000';
const row = (id, title, d, ans) => ['IDEA|' + id, 'idea', 'Ideas', title, JSON.stringify(d), '2026-11-02T15:30:00Z', ans || '', '', '', '', '', ''];
const rowsFor = () => [
  row('IDEA-SAMPLE-1', 'SAMPLE pet brush', DETAIL),
  row('IDEA-SAMPLE-2', 'SAMPLE digital guide', { kind: 'idea', v: 1, status: 'new', gate: 0, verdict: '', intake: { note: 'SAMPLE' } }),
  row('IDEA-SAMPLE-3', 'SAMPLE dropped thing', { kind: 'idea', v: 1, status: 'dropped', gate: 0, verdict: 'no', dropped_reason: 'SAMPLE too thin', intake: {} }),
];
// Pretend Sheets + pretend Drive. Records every sheet write and every file upload. Config gets the invented idea folder.
async function world(page, rows, opts = {}) {
  const out = { writes: [], uploads: [] };
  await page.route('**/config.js', async (route) => {
    const res = await route.fetch(); const body = await res.text();
    await route.fulfill({ response: res, body: body + (opts.noFolder ? '' : `\nwindow.DASH_CONFIG.marketplace.ideasRequestsFolderId='${FOLDER}';`) });
  });
  await page.route(/googleapis\.com\/drive\/v3\/files\/[\w-]+\?alt=media/, (r) => r.fulfill({ status: 200, contentType: 'text/csv', body: 'listing_id,image_url\n' }));
  await page.route(/googleapis\.com\/upload\/drive\/v3\/files/, async (route) => {
    out.uploads.push(route.request().postData());
    if (opts.uploadFails) return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"message":"boom"}}' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"FAKE-FILE-0000"}' });
  });
  await page.route(/googleapis\.com\/drive\/v3\/about/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"user":{"emailAddress":"sample@example.com"}}' }));
  await page.route(SHEETS, async (route) => {
    const req = route.request(), url = decodeURIComponent(req.url());
    if (req.method() === 'PUT') { out.writes.push({ range: /values\/([^?]+)/.exec(url)[1], body: JSON.parse(req.postData()) }); return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); }
    if (opts.loadFails) return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"message":"down"}}' });
    if (/!A2:L$/.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values: rows }) });
    const n = Number(/!A(\d+)/.exec(url)[1]);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values: [(rows[n - 2] || []).slice()] }) });
  });
  return out;
}
async function open(page, hash) {
  await page.goto('marketplace/' + (hash || '#/ideas'));
  await page.locator('#view [data-action="signin"]').click();
  await expect(page.locator('#tabs')).toBeVisible();
}


module.exports = { DETAIL, FOLDER, row, rowsFor, world, open };
