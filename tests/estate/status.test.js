// Stage 4: live, down and SSL. Run: node --test tests/estate/status.test.js
// Every name is invented (example.com, example.co.uk, .test). Today is pinned so dates never drift.
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../../estate/status.js');
const TODAY = '2026-10-29';

const word = (r) => S.classifyResponse(r).live_status;

test('live: 2xx, including after a redirect chain', () => {
  assert.equal(word({ code: 200, finalUrl: 'https://example.com/', body: '<h1>Welcome</h1>' }), 'live');
  const r = S.classifyResponse({ code: 200, finalUrl: 'https://www.example.com/home', body: 'ok', redirects: 2 });
  assert.deepEqual([r.live_status, r.http_code], ['live', '200']);
  assert.match(r.note, /2 redirects/);
});

test('blocked to scripts: 403 and challenge pages', () => {
  assert.equal(word({ code: 403, body: 'Forbidden' }), 'blocked to scripts');
  assert.equal(word({ code: 503, body: '<html><title>Just a moment...</title>' }), 'blocked to scripts');
  assert.equal(word({ code: 200, body: '<div id="cf-challenge-running">' }), 'blocked to scripts');
  assert.equal(word({ code: 403, body: '<title>Attention Required! | Cloudflare</title>' }), 'blocked to scripts');
  assert.equal(word({ code: 200, body: '<div class="g-recaptcha"></div>' }), 'blocked to scripts');
  assert.equal(word({ code: 429, body: '<script src="//captcha-delivery.test/c.js">' }), 'blocked to scripts');
});

test('a full shop page whose form script mentions a captcha is still live', () => {
  const page = '<title>Example Shop</title>' + 'x'.repeat(50000) + "d=['g-recaptcha-response','h-captcha-response']";
  assert.equal(word({ code: 200, body: page }), 'live');
});

test('parked: registrar parking beats a 200', () => {
  assert.equal(word({ code: 200, body: '<script src="//sedoparking.com/x.js">' }), 'parked');
  assert.equal(word({ code: 200, body: 'This domain is parked free, courtesy of GoDaddy' }), 'parked');
  assert.equal(word({ code: 200, body: 'The domain example.test is for sale!' }), 'parked');
  assert.equal(word({ code: 200, body: 'powered by ParkingCrew' }), 'parked');
  assert.equal(word({ code: 200, finalUrl: 'https://ww1.bodis.com/?d=example.test', body: '' }), 'parked');
  assert.equal(word({ code: 200, body: 'This domain is registered at Namecheap ... parking' }), 'parked');
});

test('down: 5xx, TLS failure, timeout, DNS, refused', () => {
  assert.equal(word({ code: 500 }), 'down');
  assert.equal(word({ code: 502, body: 'Bad gateway' }), 'down');
  const tls = S.classifyResponse({ tlsError: 'certificate has expired' });
  assert.equal(tls.live_status, 'down');
  assert.match(tls.note, /TLS/);
  assert.equal(word({ tlsError: true }), 'down');
  assert.match(S.classifyResponse({ timeout: true }).note, /no answer/);
  assert.match(S.classifyResponse({ error: 'getaddrinfo ENOTFOUND shop.example.test' }).note, /DNS/);
  assert.match(S.classifyResponse({ error: 'connect ECONNREFUSED' }).note, /refused/);
  assert.match(S.classifyResponse({ error: 'Hostname/IP does not match certificate altnames' }).note, /TLS/);
  assert.equal(word({}), 'down');
});

test('4xx other than 403 is down with a reason', () => {
  const nf = S.classifyResponse({ code: 404, body: 'Not Found' });
  assert.deepEqual([nf.live_status, nf.http_code, nf.note], ['down', '404', 'page not found (404)']);
  assert.match(S.classifyResponse({ code: 410 }).note, /gone/);
  assert.equal(word({ code: 400 }), 'down');
});

test('"live mode" text on a page never sets the status; only the HTTP/TLS result does', () => {
  assert.equal(word({ code: 200, body: 'Funnel in live mode' }), 'live');
  assert.equal(word({ tlsError: true, body: 'live mode on' }), 'down');
});

const ct = [
  { name_value: 'example.com\nwww.example.com', common_name: 'example.com', not_before: '2026-08-01T00:00:00', not_after: '2026-10-30T23:59:59' },
  { name_value: 'example.com', common_name: 'example.com', not_before: '2026-09-15T00:00:00', not_after: '2026-12-14T23:59:59' },
  { name_value: '*.example.com', common_name: '*.example.com', not_before: '2026-07-01T00:00:00', not_after: '2027-01-20T00:00:00' },
  { name_value: 'old.example.com', not_before: '2025-01-01T00:00:00', not_after: '2025-04-01T00:00:00' },
  { name_value: 'next.example.com', not_before: '2026-11-05T00:00:00', not_after: '2027-02-03T00:00:00' },
  { name_value: 'other.test', not_before: '2026-10-01T00:00:00', not_after: '2027-06-01T00:00:00' }
];

test('certificates: exact name, latest currently valid', () => {
  assert.equal(S.certExpiryFromCt(ct, 'example.com', TODAY), '2026-12-14');
  assert.equal(S.certExpiryFromCt(ct, 'www.example.com', TODAY), '2027-01-20', 'wildcard outlasts the exact one');
});

test('certificates: wildcard covers one label only', () => {
  assert.equal(S.certExpiryFromCt(ct, 'shop.example.com', TODAY), '2027-01-20');
  assert.equal(S.certExpiryFromCt(ct, 'a.b.example.com', TODAY), '');
  assert.equal(S.certExpiryFromCt([ct[2]], 'example.com', TODAY), '', 'a wildcard does not cover the bare name');
});

test('certificates: expired and not-yet-valid are skipped; none gives ""', () => {
  assert.equal(S.certExpiryFromCt([ct[3]], 'old.example.com', TODAY), '');
  assert.equal(S.certExpiryFromCt([ct[4]], 'next.example.com', TODAY), '');
  assert.equal(S.certExpiryFromCt([], 'example.com', TODAY), '');
  assert.equal(S.certExpiryFromCt(null, 'example.com', TODAY), '');
  assert.equal(S.certExpiryFromCt(ct, 'nothing.test', TODAY), '');
});

test('registrable: last two labels, three for UK and AU second levels', () => {
  assert.equal(S.registrable('shop.example.com'), 'example.com');
  assert.equal(S.registrable('a.b.example.co.uk'), 'example.co.uk');
  assert.equal(S.registrable('www.example.org.uk'), 'example.org.uk');
  assert.equal(S.registrable('example.com.au'), 'example.com.au');
  assert.equal(S.registrable('https://Sub.Example.test/path'), 'example.test');
});

test('domainExpiry: finds the registrable row, reads ISO and UK dates', () => {
  const rows = [
    { Domain: 'example.com', 'Expiry Date': '2027-03-01' },
    { domain_name: 'example.co.uk', renewal_date: '05/11/2026' },
    { domain: 'nodate.test', expires: '' },
    { name: 'sample.test', expiration: 'soon' }
  ];
  assert.equal(S.domainExpiry(rows, 'shop.example.com'), '2027-03-01');
  assert.equal(S.domainExpiry(rows, 'www.example.co.uk'), '2026-11-05');
  assert.equal(S.domainExpiry(rows, 'nodate.test'), '');
  assert.equal(S.domainExpiry(rows, 'sample.test'), '');
  assert.equal(S.domainExpiry(rows, 'missing.test'), '');
  assert.equal(S.domainExpiry([{ domain: 'example.com', expiry: '1/2/2027' }], 'example.com'), '2027-02-01');
});

test('every word the scanner writes is read back by the page as the same status', () => {
  const Core = require('../../estate/core.js');
  const S = require('../../estate/status.js');
  const cases = [[{ code: 200, body: '<html>ok</html>' }, 'live'], [{ code: 403 }, 'blocked'], [{ code: 503 }, 'down'],
    [{ tlsError: 'certificate has expired' }, 'down'], [{ timeout: true }, 'down'],
    [{ code: 200, body: '<html>This domain is parked</html>' }, 'parked']];
  for (const [res, want] of cases) assert.equal(Core.statusOf({ live_status: S.classifyResponse(res).live_status }), want, JSON.stringify(res));
});
