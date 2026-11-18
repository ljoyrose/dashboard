// Stage 15: dangling-record / takeover check. Run: node --test tests/estate/dangling.test.js
// Every host is invented (example.com style). Platform hostnames are the platforms' own public suffixes.
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../../estate/dangling.js');

test('exports VERSION and the platform list', () => {
  assert.match(D.VERSION, /^\d+\.\d+\.\d+$/);
  assert.ok(D.PLATFORMS.length >= 9);
});

test('platformOf: each platform matches by CNAME', () => {
  const cases = [
    ['funnel-x.myclickfunnels.com', 'clickfunnels'],
    ['pages.clickfunnels.com', 'clickfunnels'],
    ['shops.myshopify.com', 'shopify'],
    ['demo-store.myshopify.com.', 'shopify'],
    ['sites.brilliantdirectories.com', 'brilliantdirectories'],
    ['demo.webwave.me', 'webwave'],
    ['someone.github.io', 'github'],
    ['quiet-cat-123.netlify.app', 'netlify'],
    ['demo-app.vercel.app', 'vercel'],
    ['cname.vercel-dns.com', 'vercel'],
    ['demo-app.herokuapp.com', 'heroku'],
    ['shiny-thing.herokudns.com', 'heroku'],
    ['bucket-x.s3.amazonaws.com', 's3'],
    ['bucket-x.s3-website-eu-west-1.amazonaws.com', 's3'],
    ['bucket-x.s3-website.eu-west-2.amazonaws.com', 's3'],
  ];
  for (const [cname, id] of cases) assert.equal(D.platformOf({ cname }), id, 'FAIL: ' + cname);
});

test('platformOf: A addresses for Shopify, GitHub Pages, Vercel; others null', () => {
  assert.equal(D.platformOf({ a: '23.227.38.65' }), 'shopify');
  for (const n of [108, 109, 110, 111]) assert.equal(D.platformOf({ a: ['10.0.0.1', '185.199.' + n + '.153'] }), 'github');
  assert.equal(D.platformOf({ a: '185.199.112.153' }), null);
  assert.equal(D.platformOf({ A: '76.76.21.21' }), 'vercel');
  assert.equal(D.platformOf({ a: '192.0.2.10' }), null);
  assert.equal(D.platformOf({ cname: 'www.example.net' }), null);
  assert.equal(D.platformOf({ cname: 'notgithub.io.example.com' }), null);
  assert.equal(D.platformOf({ cname: 'evilmyshopify.com' }), null, 'FAIL: suffix must sit on a label boundary');
});

test('check: body fingerprint marks dangling even on 200', () => {
  const fp = [
    ['github', 'docs.example.com', { cname: 'someone.github.io' }, "There isn't a GitHub Pages site here."],
    ['netlify', 'app.example.com', { cname: 'x.netlify.app' }, 'Not Found - Request ID: 01ABC'],
    ['vercel', 'v.example.com', { cname: 'x.vercel.app' }, 'The deployment could not be found. DEPLOYMENT_NOT_FOUND'],
    ['heroku', 'h.example.com', { cname: 'x.herokuapp.com' }, '<h1>No such app</h1>'],
    ['s3', 'files.example.com', { cname: 'b.s3.amazonaws.com' }, '<Code>NoSuchBucket</Code>'],
    ['shopify', 'shop.example.com', { cname: 'shops.myshopify.com' }, 'Sorry, this shop is currently unavailable.'],
  ];
  for (const [id, host, rec, body] of fp) {
    const r = D.check(host, rec, { status: 200, body });
    assert.equal(r.risk, 'dangling', 'FAIL: ' + id);
    assert.equal(r.platform, id);
    assert.equal(r.host, host);
    assert.match(r.reason, /no-such-site/);
  }
});

test('check: 404 alone marks dangling (platforms with no body fingerprint)', () => {
  const r = D.check('Funnel.Example.com', { cname: 'x.myclickfunnels.com' }, { status: 404, body: '' });
  assert.deepEqual(r, { host: 'funnel.example.com', platform: 'clickfunnels', risk: 'dangling', reason: 'ClickFunnels answered 404' });
  assert.equal(D.check('dir.example.com', { cname: 'sites.brilliantdirectories.com' }, { status: '404' }).risk, 'dangling');
  assert.equal(D.check('ww.example.com', { cname: 'a.webwave.me' }, { status: 200, body: 'Welcome' }).risk, 'ok');
});

test('check: generic parked body is dangling', () => {
  const r = D.check('old.example.com', { cname: 'x.webwave.me' }, { status: 200, body: 'This domain is parked free of charge' });
  assert.equal(r.risk, 'dangling');
  assert.match(r.reason, /parked/);
});

test('check: live site on a platform is ok; off-platform is ok', () => {
  assert.equal(D.check('shop.example.com', { a: '23.227.38.65' }, { status: 200, body: '<title>Demo shop</title>' }).risk, 'ok');
  const off = D.check('www.example.com', { a: '192.0.2.1' }, { status: 404, body: 'NoSuchBucket' });
  assert.deepEqual(off, { host: 'www.example.com', platform: null, risk: 'ok', reason: 'not on a known hosted platform' });
});

test('check: no probe (or an empty one) is unknown', () => {
  assert.equal(D.check('docs.example.com', { cname: 'x.github.io' }).risk, 'unknown');
  assert.equal(D.check('docs.example.com', { cname: 'x.github.io' }, null).risk, 'unknown');
  assert.equal(D.check('docs.example.com', { cname: 'x.github.io' }, {}).risk, 'unknown');
});

test('garbage input never throws', () => {
  const junk = [undefined, null, 0, 42, '', 'x', [], {}, [null], { cname: 5 }, { cname: [null, {}] }, { a: {} }, { body: {} }, NaN, () => 1];
  for (const a of junk) {
    assert.doesNotThrow(() => D.platformOf(a));
    for (const b of junk) {
      assert.doesNotThrow(() => D.check(a, b, a));
      assert.doesNotThrow(() => D.check(a, { cname: 'x.github.io' }, b));
    }
    assert.doesNotThrow(() => D.alerts(a));
  }
  assert.deepEqual(D.alerts([null, 1, 'x', {}]), []);
});

test('alerts: dangling only, red, with the platform name', () => {
  const results = [
    D.check('shop.example.com', { cname: 'shops.myshopify.com' }, { status: 200, body: 'Sorry, this shop is currently unavailable' }),
    D.check('docs.example.com', { cname: 'x.github.io' }, { status: 200, body: 'ok' }),
    D.check('www.example.com', { a: '192.0.2.1' }, { status: 404 }),
    D.check('app.example.com', { cname: 'x.herokuapp.com' }),
  ];
  assert.deepEqual(D.alerts(results), [
    { key: 'shop.example.com', kind: 'dangling', level: 'red', text: 'shop.example.com: points at Shopify but no site behind it (takeover risk)' },
  ]);
});

test('report only: no alert or reason tells anyone to delete a record', () => {
  const r = D.check('s.example.com', { cname: 'b.s3.amazonaws.com' }, { status: 404 });
  const text = JSON.stringify([r, D.alerts([r])]);
  assert.doesNotMatch(text, /delete|remove|retire/i);
});
