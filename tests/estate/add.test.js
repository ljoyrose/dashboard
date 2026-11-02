// Web Estate Hub, Stage 5 (Add). Run: node --test tests/estate/add.test.js
// Every name here is invented (example.com / example.org / .test style). No estate row lives in this repo.
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../../estate/add.js');

const NOW = Date.UTC(2026, 0, 2, 3, 4, 5);
const base = { company: 'Sample Co', brand: 'Sample Brand', client: '', by: 'test person', now: NOW };

test('ACCEPT: buildRequest gives exactly one request carrying the invented URL', () => {
  const r = A.buildRequest(Object.assign({ input: 'https://www.example.com/landing/' }, base));
  assert.equal(r.ok, true);
  assert.equal(typeof r.request, 'object');
  assert.equal(Array.isArray(r.request), false);
  assert.equal(r.fileName, 'estate-add-' + NOW + '.json');
  assert.deepEqual(r.request, {
    kind: 'estate-add',
    at: new Date(NOW).toISOString(),
    by: 'test person',
    target: { url: 'https://www.example.com/landing', key: 'example.com/landing', host: 'www.example.com', domain: 'example.com' },
    row_kind: 'site',
    company: 'Sample Co',
    brand: 'Sample Brand',
    client: '',
    scan: ['dns', 'ssl', 'live', 'tags'],
    source: 'Add'
  });
});

test('ACCEPT: refused for anything not http, https or a bare domain', () => {
  const bad = ['ftp://example.com', 'javascript:alert(1)', 'mailto:someone@example.com', 'data:text/html,hi',
    'file:///etc/hosts', 'https://user:pw@example.com', 'localhost', 'http://localhost:3000', '', '   ',
    'example .com', 'exa mple.com/x', null, undefined];
  bad.forEach((input) => {
    const r = A.buildRequest(Object.assign({ input }, base));
    assert.equal(r.ok, false, 'should refuse ' + JSON.stringify(input));
    assert.equal(typeof r.reason, 'string');
    assert.equal(r.request, undefined);
  });
});

test('accepts http, https and a bare domain', () => {
  ['http://example.org', 'https://example.org/a', 'example.org', 'shop.example.test'].forEach((input) => {
    assert.equal(A.buildRequest(Object.assign({ input }, base)).ok, true, input);
  });
});

test('a blank company is refused; text fields are trimmed, cleaned and capped at 80', () => {
  assert.equal(A.buildRequest({ input: 'example.com', company: '   ' }).ok, false);
  assert.equal(A.buildRequest({ input: 'example.com' }).ok, false);
  const r = A.buildRequest({ input: 'example.com', company: '  Sample\u0000 Co\n', brand: 'x'.repeat(200), client: '\tClient\u0007 One ', now: NOW });
  assert.equal(r.request.company, 'Sample Co');
  assert.equal(r.request.brand.length, 80);
  assert.equal(r.request.client, 'Client One');
  assert.equal(r.request.by, '');
});

test('kind: a valid picked kind wins, an unknown one falls back to the guess', () => {
  assert.equal(A.buildRequest(Object.assign({ input: 'example.com', kind: 'email-domain' }, base)).request.row_kind, 'email-domain');
  assert.equal(A.buildRequest(Object.assign({ input: 'sample.myshopify.com', kind: 'nonsense' }, base)).request.row_kind, 'shop');
});

test('guessKind', () => {
  const cases = {
    'https://sample.myclickfunnels.com/optin': 'funnel',
    'https://www.clickfunnels.com/x': 'funnel',
    'https://abc.cf2.com/page': 'funnel',
    'https://example.com/funnel/step-1': 'funnel',
    'https://sample.myshopify.com': 'shop',
    'https://example.com/products/mug': 'shop',
    'https://example.com/collections/all': 'shop',
    'https://app.example.com': 'app',
    'https://apps.example.com/x': 'app',
    'https://example.com/app/login': 'app',
    'https://sample.lovable.app': 'app',
    'https://sample.base44.app': 'app',
    'https://sample.overskill.app': 'app',
    'https://sample.vercel.app': 'app',
    'https://sample.netlify.app': 'app',
    'example.com': 'site',
    'https://example.com/about': 'site',
    'https://example.com/application-form': 'site',
    'ftp://example.com': 'site'
  };
  Object.keys(cases).forEach((k) => assert.equal(A.guessKind(k), cases[k], k));
});

test('multipartBody: metadata with parents, then the JSON once, studio shape', () => {
  const r = A.buildRequest(Object.assign({ input: 'https://example.com/landing' }, base));
  const body = A.multipartBody(r.request, 'FOLDER_ID_SAMPLE', 'bnd123', r.fileName);
  const json = JSON.stringify(r.request);
  assert.equal(body.split(json).length - 1, 1);
  assert.equal(body.split('"parents":["FOLDER_ID_SAMPLE"]').length - 1, 1);
  assert.ok(body.startsWith('--bnd123\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'));
  assert.ok(body.endsWith('\r\n--bnd123--'));
  const meta = JSON.parse(body.split('\r\n\r\n')[1].split('\r\n--bnd123')[0]);
  assert.deepEqual(meta, { name: 'estate-add-' + NOW + '.json', parents: ['FOLDER_ID_SAMPLE'], mimeType: 'application/json' });
  assert.equal(body, '--bnd123\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) +
    '\r\n--bnd123\r\nContent-Type: application/json\r\n\r\n' + json + '\r\n--bnd123--');
  // Without a file name it falls back to the request time.
  assert.ok(A.multipartBody(r.request, 'F', 'b').includes('"name":"estate-add-' + NOW + '.json"'));
});

test('scanPlan: dns, ssl, live, tags; mail only for a bare domain; nothing for a refused target', () => {
  assert.deepEqual(A.scanPlan('example.com'), ['dns', 'ssl', 'live', 'tags', 'mail']);
  assert.deepEqual(A.scanPlan('https://example.com'), ['dns', 'ssl', 'live', 'tags']);
  assert.deepEqual(A.scanPlan('example.com/shop'), ['dns', 'ssl', 'live', 'tags']);
  assert.deepEqual(A.scanPlan('javascript:alert(1)'), []);
  assert.deepEqual(A.buildRequest(Object.assign({ input: 'example.com' }, base)).request.scan, ['dns', 'ssl', 'live', 'tags', 'mail']);
});
