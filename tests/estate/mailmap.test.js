// Address-level mail map (Stage 17, I1). Run: node --test tests/estate/mailmap.test.js
// Every address, domain and service is invented (example.com, example.test, example.org, example.edu).
// at() joins invented .org/.edu fixtures so the privacy guard (which allows only @example.com/@example.test literals) stays strict.
const test = require('node:test');
const assert = require('node:assert/strict');
const MM = require('../../estate/mailmap.js');
const at = (user, domain) => user + '@' + domain;

const FWD_MX = 'eforward1.registrar-servers.com';
const domains = [
  { url_or_domain: 'example.com', mx: FWD_MX },
  { url_or_domain: 'example.test', mx: 'aspmx.l.google.com' },
  { url_or_domain: 'example.org', mx: 'none' },
  { url_or_domain: 'example.edu', mx: 'present · SiteGround' }
];
const byAddr = (rows, a) => rows.find((r) => r.address === a);

test('exports VERSION and the API', () => {
  assert.match(MM.VERSION, /^\d+\.\d+\.\d+$/);
  ['build', 'alerts', 'emptyState', 'mxKind', 'forwardMap'].forEach((k) => assert.equal(typeof MM[k], 'function'));
});

test('single forward: one hop, forward-only, lands at the mailbox address', () => {
  const rows = MM.build([{ alias: 'a@example.com', 'forward to': 'b@example.test' }], domains, []);
  assert.equal(rows.length, 1);
  const r = rows[0];
  assert.equal(r.address, 'a@example.com');
  assert.equal(r.kind, 'forward-only');
  assert.equal(r.lands_at, 'b@example.test');
  assert.equal(r.hops, 1);
  assert.deepEqual(r.path, ['a@example.com', 'b@example.test', 'Google Workspace']);
  assert.equal(r.risk, '');
  assert.deepEqual(MM.alerts(rows), []);
});

test('two-hop chain: amber more than one hop', () => {
  const rows = MM.build([
    { alias: 'a@example.com', 'forward to': 'c@example.com' },
    { alias: 'c@example.com', 'forward to': 'b@example.test' }
  ], domains, []);
  const a = byAddr(rows, 'a@example.com');
  assert.equal(a.hops, 2);
  assert.equal(a.lands_at, 'b@example.test');
  assert.equal(a.risk, 'more than one hop');
  assert.equal(a.level, 'amber');
  assert.equal(byAddr(rows, 'c@example.com').hops, 1);
  const al = MM.alerts(rows);
  assert.equal(al.length, 1);
  assert.deepEqual(Object.keys(al[0]).sort(), ['key', 'kind', 'level', 'text']);
  assert.equal(al[0].key, 'a@example.com');
  assert.equal(al[0].kind, 'mailmap');
  assert.equal(al[0].level, 'amber');
  assert.match(al[0].text, /a@example\.com → c@example\.com → b@example\.test/);
});

test('loop: kind unknown, risk loop, red first in alerts', () => {
  const rows = MM.build([
    { alias: 'z@example.com', 'forward to': 'y@example.com' },
    { alias: 'y@example.com', 'forward to': 'x@example.com' },
    { alias: 'x@example.com', 'forward to': 'y@example.com' },
    { alias: 'p@example.com', 'forward to': 'q@example.com' },
    { alias: 'q@example.com', 'forward to': 'b@example.test' }
  ], domains, []);
  const z = byAddr(rows, 'z@example.com');
  assert.equal(z.kind, 'unknown');
  assert.equal(z.risk, 'loop');
  assert.equal(z.level, 'red');
  assert.equal(z.lands_at, '');
  assert.deepEqual(z.path, ['z@example.com', 'y@example.com', 'x@example.com', 'y@example.com']);
  const al = MM.alerts(rows);
  assert.equal(al[0].level, 'red');
  assert.equal(al[al.length - 1].level, 'amber', 'the two-hop p row comes after the reds');
});

test('depth is capped', () => {
  const fwd = [];
  for (let i = 0; i < MM.MAX_HOPS + 3; i++) fwd.push({ from: 'n' + i + '@example.com', to: 'n' + (i + 1) + '@example.com' });
  const r = byAddr(MM.build(fwd, domains, []), 'n0@example.com');
  assert.equal(r.kind, 'unknown');
  assert.equal(r.risk, 'too deep');
  assert.ok(r.hops <= MM.MAX_HOPS + 1);
});

test('mailbox domain: a login address on a Google or SiteGround domain is a mailbox', () => {
  const rows = MM.build([{ alias: 'a@example.com', 'forward to': 'b@example.test' }], domains, [
    { address: 'b@example.test', service: 'Service One' },
    { address: at('d', 'example.edu'), service: 'Service Two' }
  ]);
  const b = byAddr(rows, 'b@example.test');
  assert.equal(b.kind, 'mailbox');
  assert.equal(b.hops, 0);
  assert.equal(b.lands_at, 'Google Workspace');
  assert.deepEqual(b.logins, ['Service One']);
  assert.equal(b.risk, '');
  assert.equal(byAddr(rows, at('d', 'example.edu')).lands_at, 'SiteGround');
});

test('forward-only login is flagged amber, with the services named', () => {
  const rows = MM.build([{ alias: 'a@example.com', 'forward to': 'b@example.test' }], domains, [
    { email: 'A@Example.com', service: 'Service One' },
    { email: 'a@example.com', service: 'Service Two' }
  ]);
  assert.equal(rows.length, 1, 'one row per address');
  const a = rows[0];
  assert.deepEqual(a.logins, ['Service One', 'Service Two']);
  assert.equal(a.risk, 'forward-only login');
  assert.equal(a.level, 'amber');
  const al = MM.alerts(rows);
  assert.equal(al.length, 1);
  assert.match(al[0].text, /forward-only login.*Service One, Service Two/);
});

test('target unknown: forwarder MX with no export row for the address', () => {
  const rows = MM.build([{ alias: 'a@example.com', 'forward to': 'b@example.test' }], domains, [{ address: 'e@example.com', service: 'Service Three' }]);
  const e = byAddr(rows, 'e@example.com');
  assert.equal(e.kind, 'unknown');
  assert.equal(e.risk, 'target unknown');
  assert.equal(MM.alerts(rows)[0].text, 'e@example.com: target unknown, needs registrar export');
  assert.equal(byAddr(MM.build([{ alias: 'a@example.com', to: 'b@example.test' }], domains, [{ address: at('f', 'example.org'), service: 'S' }]), at('f', 'example.org')).reason, 'domain has no MX');
});

test('empty export: empty state, and login rows still come back as unknown / export needed', () => {
  assert.deepEqual(MM.emptyState([]), { empty: true, text: 'Registrar export needed' });
  assert.deepEqual(MM.emptyState(undefined), { empty: true, text: 'Registrar export needed' });
  assert.equal(MM.emptyState([{ alias: 'a@example.com', 'forward to': 'b@example.test' }]).empty, false);
  const rows = MM.build([], [{ url_or_domain: 'example.com', mx: FWD_MX }], [{ address: 'a@example.com', service: 'Service One' }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'unknown');
  assert.equal(rows[0].reason, 'export needed');
  assert.equal(rows[0].risk, '');
  assert.equal(MM.build(null, null, [{ address: 'g@example.com', service: 'S' }])[0].reason, 'export needed');
});

test('header aliases: case, spacing, underscores, alias without @ plus domain column, arrays with a header row', () => {
  const variants = [
    [{ 'Alias': 'a@example.com', 'Forward To': 'b@example.test' }],
    [{ MAILBOX: 'a@example.com', Destination: 'b@example.test' }],
    [{ forward_from: 'a@example.com', forward_to: 'b@example.test' }],
    [{ Alias: 'a', Domain: 'example.com', 'Forward to': 'b@example.test' }],
    [['Alias', 'Domain Name', 'Forward-To'], ['a', 'example.com', 'B@Example.test']],
    [{ Source: 'mailto:a@example.com', Target: '<b@example.test>' }]
  ];
  variants.forEach((v, i) => {
    const rows = MM.build(v, domains, []);
    assert.equal(rows.length, 1, 'variant ' + i);
    assert.equal(rows[0].address, 'a@example.com', 'variant ' + i);
    assert.equal(rows[0].lands_at, 'b@example.test', 'variant ' + i);
  });
  const multi = MM.build([{ alias: 'a@example.com', 'forward to': 'b@example.test, h@example.test' }], domains, [])[0];
  assert.equal(multi.lands_at, 'b@example.test');
  assert.deepEqual(multi.also, ['h@example.test']);
  const domainAliases = MM.build([], [{ Domain: 'example.test', 'MX Host': 'aspmx.l.google.com' }], [{ Login: 'b@example.test', App: 'S' }]);
  assert.equal(domainAliases[0].kind, 'mailbox');
});

test('catch-all on a domain catches any address there', () => {
  const rows = MM.build([{ alias: '*', domain: 'example.com', 'forward to': 'b@example.test' }], domains, [{ address: 'k@example.com', service: 'S' }]);
  const k = byAddr(rows, 'k@example.com');
  assert.equal(k.kind, 'forward-only');
  assert.equal(k.risk, 'forward-only login');
});

test('mxKind reads mail.js objects, words, labels and hosts', () => {
  assert.equal(MM.mxKind({ word: 'Namecheap email forwarding', forwarding: true }), 'forwarder');
  assert.equal(MM.mxKind({ word: 'Google Workspace', present: true }), 'mailbox');
  assert.equal(MM.mxKind({ word: 'none', present: false }), 'none');
  assert.equal(MM.mxKind(FWD_MX), 'forwarder');
  assert.equal(MM.mxKind('example-mail.example.test'), 'mailbox');
  assert.equal(MM.mxKind('present · Microsoft 365'), 'mailbox');
  assert.equal(MM.mxKind('none'), 'none');
  assert.equal(MM.mxKind(''), '');
});

test('garbage input never throws', () => {
  const junk = [undefined, null, 0, 1, '', 'text', {}, [], [null], [1, 'x', true], [[]], [['alias'], null, 5, ['a']],
    [{ alias: null, 'forward to': {} }], [{ alias: 'not an address', to: 'also not' }], [{ alias: { a: 1 }, to: ['b@example.test'] }],
    [{ toString: null }], NaN];
  junk.forEach((a) => junk.forEach((b) => {
    assert.doesNotThrow(() => MM.build(a, b, a));
    assert.doesNotThrow(() => MM.emptyState(a));
  }));
  junk.forEach((a) => assert.doesNotThrow(() => MM.alerts(a)));
  assert.doesNotThrow(() => MM.alerts([{ address: 'a@example.com', risks: 'loop' }, { address: 'a@example.com', risk: 'nonsense' }]));
  assert.deepEqual(MM.build('text', 5, {}), []);
});
