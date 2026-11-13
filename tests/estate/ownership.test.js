// Stage 16: ownership and control columns (I6) and the C4 monitor-only rule. Run: node --test tests/estate/ownership.test.js
// Every row is invented (example.com / example.test names only).
const test = require('node:test');
const assert = require('node:assert/strict');
const O = require('../../estate/ownership.js');
const M = require('../../estate/mail.js');
const A = require('../../estate/alerts.js');

test('exports VERSION and OWNER_CLASSES', () => {
  assert.match(O.VERSION, /^\d+\.\d+\.\d+$/);
  ['ours', 'client', 'resale', 'monitor only'].forEach((c) => assert.ok(O.OWNER_CLASSES.includes(c)));
});

test('alias headers are read (case, spaces and hyphens tolerated)', () => {
  const a = O.readOwnership({ ' Owner Class ': 'Ours', 'Registrar Account': 'agency registrar', 'DNS-Account': 'agency dns', '2FA Holder': 'ops lead', 'Agent may read': 'Y' });
  assert.deepEqual(a, { owner_class: 'ours', owner_label: 'Ours', registrar_account: 'agency registrar', dns_account: 'agency dns', twofa_holder: 'ops lead', client: '', agent_may_read: true, hidden: [] });
  const b = O.readOwnership({ ownership: 'client', client_name: 'Client A', agent_read: 'n' });
  assert.equal(b.owner_class, 'client');
  assert.equal(b.client, 'Client A');
  assert.equal(b.agent_may_read, false);
  assert.equal(O.readOwnership({ owner: 'resale', account: 'Client B' }).client, 'Client B');
});

test('owner class variants normalise; blank or odd is unknown, shown as Not set', () => {
  const cases = { ours: 'ours', OURS: 'ours', 'in-house': 'ours', client: 'client', 'Client owned': 'client', Reseller: 'resale', resale: 'resale',
    'monitor only': 'monitor only', 'monitor-only': 'monitor only', Monitor_Only: 'monitor only', monitor: 'monitor only', 'Separate owner': 'monitor only',
    '': 'unknown', '   ': 'unknown', 'maybe?': 'unknown' };
  Object.keys(cases).forEach((v) => assert.equal(O.ownerClass(v), cases[v], v));
  assert.equal(O.ownerClass(null), 'unknown');
  assert.equal(O.ownerLabel('unknown'), 'Not set');
  assert.equal(O.readOwnership({}).owner_label, 'Not set');
});

test('sanitize drops emails, passwords and tokens with a flag; labels pass', () => {
  assert.deepEqual(O.sanitize('agency registrar'), { value: 'agency registrar', hidden: false, reason: '' });
  ['someone@example.com', 'password: hunter2', 'pass: abc', 'pwd hunter2', 'secret thing', 'Zx9kQ2mL7pR4tY8wB3nV', '+44 0000 000 000'].forEach((v) => {
    const s = O.sanitize(v);
    assert.equal(s.value, '', v);
    assert.equal(s.hidden, true, v);
    assert.equal(s.reason, O.HIDDEN_REASON);
  });
  assert.deepEqual(O.sanitize(''), { value: '', hidden: false, reason: '' });
  const own = O.readOwnership({ owner_class: 'ours', registrar_account: 'someone@example.com', dns_account: 'password: hunter2', '2fa_holder': 'ops lead' });
  assert.equal(own.registrar_account, '');
  assert.equal(own.dns_account, '');
  assert.equal(own.twofa_holder, 'ops lead');
  assert.deepEqual(own.hidden.map((h) => h.field), ['registrar_account', 'dns_account']);
  assert.ok(!/@|hunter2/.test(JSON.stringify(own)));
});

test('join matches by registrable domain, tolerant of www and subdomains; no match is unknown', () => {
  const estate = [
    { key: 'www.example.com', url_or_domain: 'https://www.example.com/' },
    { key: 'shop.example.com' },
    { key: 'app.example.test', client: 'Client A' },
    { key: 'none.example.net' },
  ];
  const domains = [
    { Domain: 'example.com', 'Owner Class': 'ours', 'Registrar Account': 'agency registrar' },
    { domain_name: 'example.test', owner: 'client', client: 'Client A', agent_may_read: 'yes' },
  ];
  const before = JSON.stringify(estate);
  const out = O.join(estate, domains);
  assert.equal(out.length, 4);
  assert.equal(out[0].ownership.owner_class, 'ours');
  assert.equal(out[0].ownership.registrar_account, 'agency registrar');
  assert.equal(out[1].ownership.owner_class, 'ours');
  assert.equal(out[2].ownership.owner_class, 'client');
  assert.equal(out[2].ownership.agent_may_read, true);
  assert.equal(out[3].ownership.owner_class, 'unknown');
  assert.equal(out[3].ownership.owner_label, 'Not set');
  assert.equal(JSON.stringify(estate), before, 'input not changed');
  assert.notEqual(out[0], estate[0]);
});

test('C4: monitor-only rows get no mail or DNS change suggestion; facts stay', () => {
  const row = O.join([{ key: 'watch.example.com' }], [{ domain: 'example.com', owner_class: 'monitor-only' }])[0];
  assert.equal(O.canSuggestChanges(row), false);
  const NX = { Status: 3 };
  const fix = M.fixSuggestion('watch.example.com', { spf: M.spfWord(NX), dmarc: M.dmarcWord(NX), mx: { word: 'Google Workspace' } });
  assert.doesNotMatch(fix, /No DNS change needed/);
  const alerts = [{ key: 'watch.example.com', kind: 'dmarc', level: 'amber', text: 'watch.example.com: DMARC missing' }];
  const work = A.openWorkRows(alerts, '12/11/2026');
  const kept = O.filterSuggestions(row, [fix, 'Add a TXT record at _dmarc.watch.example.com', { kind: 'fix', text: 'x' }, { action: 'merge spf' }].concat(alerts, work, ['DMARC missing', 'No DNS change needed for watch.example.com.']));
  assert.deepEqual(kept, alerts.concat(['DMARC missing', 'No DNS change needed for watch.example.com.']));
  assert.deepEqual(O.filterSuggestions(row, 'Delete all but one TXT record'), []);
  const ours = O.join([{ key: 'example.com' }], [{ domain: 'example.com', owner_class: 'ours' }])[0];
  assert.equal(O.canSuggestChanges(ours), true);
  assert.deepEqual(O.filterSuggestions(ours, ['Add a TXT record']), ['Add a TXT record']);
});

test('client and resale rows show only in their own client view; ours, monitor and unknown in main', () => {
  const rows = O.join(
    [{ key: 'a.example.com' }, { key: 'b.example.test' }, { key: 'c.example.org' }, { key: 'd.example.net' }, { key: 'e.example.edu' }],
    [{ domain: 'a.example.com', owner_class: 'ours' }, { domain: 'example.test', owner_class: 'client', client: 'Client A' },
      { domain: 'example.org', owner_class: 'resale', client_name: 'Client B' }, { domain: 'example.net', owner_class: 'monitor only' }]);
  const main = rows.filter((r) => O.visibleIn(r, 'main')).map((r) => r.key);
  assert.deepEqual(main, ['a.example.com', 'd.example.net', 'e.example.edu']);
  assert.deepEqual(rows.filter((r) => O.visibleIn(r, { client: 'Client A' })).map((r) => r.key), ['b.example.test']);
  assert.deepEqual(rows.filter((r) => O.visibleIn(r, { client: 'Client B' })).map((r) => r.key), ['c.example.org']);
  assert.deepEqual(rows.filter((r) => O.visibleIn(r, { client: 'client a' })).map((r) => r.key), []);
  assert.deepEqual(rows.filter((r) => O.visibleIn(r, { client: '' })).map((r) => r.key), []);
  const orphan = O.join([{ key: 'x.example.com' }], [{ domain: 'example.com', owner_class: 'client' }])[0];
  assert.equal(O.visibleIn(orphan, 'main'), true, 'a client row with no client name never vanishes');
});

test('garbage input never throws', () => {
  const junk = [undefined, null, 0, 1, '', 'x', true, [], {}, [null, 1, 'a', {}], { key: 5 }, { url_or_domain: {} }, NaN];
  junk.forEach((a) => {
    junk.forEach((b) => {
      assert.doesNotThrow(() => O.join(a, b));
      assert.doesNotThrow(() => O.visibleIn(a, b));
      assert.doesNotThrow(() => O.filterSuggestions(a, b));
    });
    assert.doesNotThrow(() => O.sanitize(a));
    assert.doesNotThrow(() => O.readOwnership(a));
    assert.doesNotThrow(() => O.canSuggestChanges(a));
    assert.doesNotThrow(() => O.ownerClass(a));
  });
  assert.deepEqual(O.join(null, null), []);
  assert.equal(O.join([{ key: 'a.example.com' }], [{ domain: { x: 1 }, owner_class: ['ours'] }])[0].ownership.owner_class, 'unknown');
});
