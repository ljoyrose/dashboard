// Web Estate DNS & Email section (phase 2 checks 2.1 to 2.7, Mail map hops, Mail switch progress, header contracts).
// Run: node --test tests/estate/mail-phase2.test.js. Every name is invented (example.com, example.net, example.org).
// Nothing here reads the network or writes DNS, a registrar, a mailbox or a sheet.
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../../estate/mail.js');
const E = require('../../estate/core.js');
const AL = require('../../estate/alerts.js');

const txt = (...data) => ({ Status: 0, Answer: data.map((d) => ({ name: 'example.com.', type: 16, data: d })) });
const mx = (...data) => ({ Status: 0, Answer: data.map((d) => ({ name: 'example.com.', type: 15, data: d })) });
const NX = { Status: 3 };
const TODAY = '2026-11-12';

const MAP = [
  ['address', 'kind', 'delivers_to', 'next_hop', 'checked_by'],
  ['a@example.com', 'forward', 'SiteGround', 'b@example.test', 'bot'],
  ['b@example.test', 'forward', 'iCloud', 'c@example.test', 'bot'],
  ['c@example.test', 'mailbox', 'Gmail', '', 'bot'],
  ['one@example.com', 'forward', 'Namecheap', 'c@example.test', 'bot'],
  ['x@example.com', 'forward', 'Namecheap', 'y@example.test', 'bot'],
  ['y@example.test', 'forward', 'Namecheap', 'x@example.com', 'bot'],
  ['who@example.com', 'forward', 'Namecheap', '', 'bot'],
  ['info@example.test', 'mailbox', 'WebWave', '', 'bot'],
];
const mapRows = () => M.mailMapFromValues(MAP).rows;

// ---- 2.1 DKIM ----
test('2.1 DKIM: google selector found on Workspace passes', () => {
  const w = M.dkimWord({ google: txt('"v=DKIM1; k=rsa; p=QUJD"'), selector1: NX }, { word: 'Google Workspace' });
  assert.equal(w.word, 'found (google)');
  assert.deepEqual(M.summarise({ spf: 'pass', dkim: w, dmarc: 'reject', mx: 'Google Workspace' }).faults, []);
});
test('2.1 DKIM: no google selector on Workspace reads "missing (google)" and alerts amber', () => {
  const w = M.dkimWord({ google: NX, selector1: NX, selector2: NX, k1: NX, s1: NX, default: NX }, { word: 'Google Workspace' });
  assert.equal(w.word, 'missing (google)');
  assert.deepEqual(E.emailProblems({ spf: 'pass', dkim: w.word, dmarc: 'reject', mx: 'Google Workspace' }), ['DKIM missing']);
  const a = AL.alerts([{ key: 'dk.example.com', url_or_domain: 'dk.example.com', spf: 'pass', dkim: w.word, dmarc: 'reject', mx: 'Google Workspace' }], TODAY);
  assert.equal(a.find((x) => x.kind === 'dkim').level, 'amber');
});

// ---- 2.2 DMARC missing ----
test('2.2 DMARC: present passes; missing is a fault', () => {
  assert.equal(M.dmarcWord(txt('"v=DMARC1; p=reject; rua=mailto:r@example.com"')).word, 'reject');
  assert.equal(M.dmarcWord(NX).word, 'missing');
  assert.deepEqual(M.summarise({ spf: 'pass', dmarc: M.dmarcWord(NX) }).faults, ['DMARC missing']);
});

// ---- 2.3 DMARC weak ----
test('2.3 DMARC: p=none with rua is a note only; p=none without rua is weak', () => {
  const watched = M.dmarcWord(txt('"v=DMARC1; p=none; rua=mailto:r@example.com"'));
  assert.deepEqual(M.summarise({ spf: 'pass', dmarc: watched }), { faults: [], notes: ['DMARC p=none'] });
  const weak = M.dmarcWord(txt('"v=DMARC1; p=none"'));
  assert.equal(weak.word, 'weak');
  const a = AL.alerts([{ key: 'w.example.com', spf: 'pass', dmarc: weak.word }], TODAY);
  assert.match(a.find((x) => x.kind === 'dmarc').text, /DMARC weak/);
});

// ---- 2.4 SPF ----
test('2.4 SPF: one sound record passes; two records is a fault', () => {
  assert.equal(M.spfWord(txt('"v=spf1 include:_spf.example.net ~all"')).word, 'pass');
  const two = M.spfWord(txt('"v=spf1 a ~all"', '"v=spf1 mx -all"'));
  assert.equal(two.word, 'two records');
  assert.deepEqual(M.summarise({ spf: two, dmarc: 'reject' }).faults, ['two SPF records']);
});
test('2.4 SPF syntax: lookup counting is exact at 10 and broken at 11', () => {
  const inc = (n) => Array.from({ length: n }, (_, i) => 'include:s' + i + '.example.net').join(' ');
  const ten = M.spfProblems('v=spf1 ' + inc(10) + ' ~all');
  assert.equal(ten.lookups, 10);
  assert.deepEqual(ten.problems, []);
  const eleven = M.spfWord(['v=spf1 ' + inc(11) + ' ~all']);
  assert.equal(eleven.word, 'broken');
  assert.equal(eleven.lookups, 11);
  assert.ok(eleven.problems.includes('more than 10 lookups'));
  // a, mx, ptr, exists and redirect each count; ip4/ip6/all do not
  assert.equal(M.spfProblems('v=spf1 a mx ptr exists:x.example.net ip4:192.0.2.1 ip6:2001:db8::1 redirect=r.example.net').lookups, 5);
});
test('2.4 SPF syntax: bad include target and no all are broken', () => {
  assert.ok(M.spfWord(['v=spf1 include: ~all']).problems.includes('include has no value'));
  assert.ok(M.spfWord(['v=spf1 include:.. ~all']).problems.includes('include has no domain'));
  assert.ok(M.spfWord(['v=spf1 include:_spf.example.net']).problems.includes('missing all'));
  assert.equal(M.spfWord(['v=spf1 redirect=_spf.example.net']).word, 'pass', 'redirect stands in for all');
  assert.deepEqual(E.emailProblems({ spf: 'broken', dmarc: 'reject' }), ['SPF broken']);
});

// ---- 2.5 MX ----
test('2.5 MX: WebWave is named; Google and forwarding still read', () => {
  assert.equal(M.mxHost(mx('10 mx1.webwavecms.com.')).word, 'WebWave');
  assert.equal(M.mxHost(mx('10 mx1.webwavecms.com.')).forwarding, false);
  assert.equal(M.mxHost(mx('1 smtp.google.com.')).word, 'Google Workspace');
  assert.equal(M.mxHost(mx('10 eforward1.registrar-servers.com.')).forwarding, true);
});
test('2.5 MX: none is a fault when the Mail map has addresses, a note when it has none, a fault when not read', () => {
  assert.deepEqual(M.summarise({ mx: 'none', mail_addresses: 2 }).faults, ['no MX']);
  const quiet = M.summarise({ mx: 'none', mail_addresses: 0 });
  assert.deepEqual(quiet.faults, []);
  assert.deepEqual(quiet.notes, ['no MX (no addresses on the Mail map)']);
  assert.deepEqual(M.summarise({ mx: 'none' }).faults, ['no MX'], 'unknown address count stays a fault (fail safe)');
  const rows = [{ key: 'example.test', url_or_domain: 'example.test', kind: 'email-domain', mx: 'none', spf: 'pass', dmarc: 'reject' },
    { key: 'quiet.example.com', url_or_domain: 'quiet.example.com', kind: 'email-domain', mx: 'none', spf: 'pass', dmarc: 'reject' }];
  const a = AL.alerts(rows, TODAY, [], mapRows());
  assert.equal(a.filter((x) => x.kind === 'mx').map((x) => x.key).join(), 'example.test');
});

// ---- 2.6 forward hops ----
test('2.6 hops: one hop and a plain mailbox pass', () => {
  const one = M.hops('one@example.com', mapRows());
  assert.equal(one.hops, 1);
  assert.equal(one.flag, false);
  const box = M.hops('INFO@example.test', mapRows());
  assert.equal(box.hops, 0);
  assert.equal(box.text, 'mailbox (no forward)');
  assert.equal(M.hops('nobody@example.com', mapRows()), null);
});
test('2.6 hops: a 3-stop chain is flagged with the whole chain', () => {
  const c = M.hops('a@example.com', mapRows());
  assert.deepEqual(c.chain, ['a@example.com', 'b@example.test', 'c@example.test']);
  assert.equal(c.hops, 2);
  assert.equal(c.flag, true);
  assert.match(c.text, /2 hops/);
});
test('2.6 hops: a loop ends, is flagged, and alerts red', () => {
  const c = M.hops('x@example.com', mapRows());
  assert.equal(c.loop, true);
  assert.equal(c.flag, true);
  assert.deepEqual(c.chain, ['x@example.com', 'y@example.test', 'x@example.com']);
  const self = M.hops('s@example.com', [{ address: 's@example.com', kind: 'forward', next_hop: 'S@example.com' }]);
  assert.equal(self.loop, true, 'a row that forwards to itself (any case) is a loop');
  const a = AL.alerts([{ key: 'example.com', url_or_domain: 'example.com', kind: 'email-domain', mx: 'Namecheap email forwarding', spf: 'pass', dmarc: 'reject', forward_chain: 'x → y' }], TODAY, [], mapRows());
  assert.equal(a[0].kind, 'forward-loop');
  assert.equal(a[0].level, 'red');
});
test('2.6 hops: a long chain stops at 20 stops and counts as a loop', () => {
  const rows = Array.from({ length: 30 }, (_, i) => ({ address: 'n' + i + '@example.com', kind: 'forward', next_hop: 'n' + (i + 1) + '@example.com' }));
  const c = M.hops('n0@example.com', rows);
  assert.equal(c.loop, true);
  assert.ok(c.chain.length <= 21);
});
test('2.6 hops: a forward with no next hop reads target unknown', () => {
  const c = M.hops('who@example.com', mapRows());
  assert.equal(c.unknown, true);
  assert.equal(c.text, 'target unknown: needs Namecheap export');
});

// ---- 2.7 certificate ----
test('2.7 certificate: 6 days out is red, 20 amber, 90 none', () => {
  const at = (d) => new Date(Date.UTC(2026, 10, 12 + d)).toISOString().slice(0, 10);
  const rows = [6, 20, 90].map((d) => ({ key: 'c' + d + '.example.com', ssl_expires: at(d) }));
  const a = AL.alerts(rows, TODAY).filter((x) => x.kind === 'ssl');
  assert.deepEqual(a.map((x) => [x.key, x.level]), [['c6.example.com', 'red'], ['c20.example.com', 'amber']]);
});

// ---- header contracts ----
test('header contract: the Mail map and Mail switch headers read', () => {
  assert.equal(M.mailMapFromValues(MAP).ok, true);
  assert.equal(M.mailMapFromValues(MAP).rows.length, 8);
  const sw = M.mailSwitchFromValues([M.MAIL_SWITCH_COLUMNS, ['alias.example.com', 'brand alias', 'done']]);
  assert.equal(sw.ok, true);
  assert.equal(sw.rows[0].step_1, 'done');
  assert.equal(M.MAIL_SWITCH_COLUMNS.length, 15);
});
test('ACCEPT header contract: every renamed or missing column fails closed with no rows', () => {
  for (const [cols, fn, tab] of [[M.MAIL_MAP_COLUMNS, M.mailMapFromValues, 'Mail map'], [M.MAIL_SWITCH_COLUMNS, M.mailSwitchFromValues, 'Mail switch']]) {
    for (const col of cols) {
      const renamed = fn([cols.map((c) => (c === col ? col + '_old' : c)), cols.map(() => 'x')]);
      assert.equal(renamed.ok, false, tab + ' rename of ' + col);
      assert.equal(renamed.rows.length, 0);
      assert.match(renamed.problems[0], new RegExp(tab + ' tab header changed: missing ' + col));
      const dropped = fn([cols.filter((c) => c !== col), cols.map(() => 'x')]);
      assert.equal(dropped.ok, false, tab + ' drop of ' + col);
    }
  }
  assert.equal(M.mailMapFromValues([]).ok, false, 'empty tab fails closed');
});

// ---- 4.x switch progress ----
test('switch progress: step N of 10, step 9 only from live checks, classes', () => {
  const row = (cls, ...steps) => { const o = { domain: 'a.example.com', class: cls }; steps.forEach((s, i) => { o['step_' + (i + 1)] = s; }); return o; };
  assert.equal(M.switchProgress(row('brand alias', 'done', 'done', 'todo'), null).text, 'step 3 of 10: Recreate every forward as an alias');
  const eight = row('brand alias', 'done', 'done', 'done', 'done', 'done', 'done', 'done', 'done', 'done');
  assert.equal(M.switchProgress(eight, false).step, 9, 'a hand tick on step 9 is ignored when checks fail');
  assert.match(M.switchProgress(eight, null).text, /step 9 of 10.*not yet read/);
  assert.equal(M.switchProgress(eight, true).text, 'all steps done');
  assert.equal(M.switchProgress(row('', 'done'), true).text, 'class: Lisa to say');
  assert.equal(M.switchProgress(row('keep own mail'), true).text, 'keeps its own mail: checks only');
  assert.equal(M.switchProgress(undefined, true).text, 'not on the Mail switch tab');
  assert.equal(M.switchProgress(row('brand alias', 'n/a', 'DONE'), null).step, 3);
});

// ---- the #/mail cards ----
test('domain cards: faults first, unread checks say "not yet read", fix text present', () => {
  const rows = [
    { key: 'good.example.net', url_or_domain: 'good.example.net', kind: 'email-domain', spf: 'pass', dkim: 'found (google)', dmarc: 'reject', mx: 'Google Workspace' },
    { key: 'example.com', url_or_domain: 'https://example.com', kind: 'site', ssl_expires: '2026-11-18' },
    { key: 'example.com#mail', url_or_domain: 'example.com', kind: 'email-domain', spf: 'pass', dmarc: 'weak', dkim: 'missing (google)', mx: 'Google Workspace' },
    { key: 'blank.example.org', url_or_domain: 'blank.example.org', kind: 'email-domain' },
  ];
  const cards = M.domainCards(rows, mapRows(), M.mailSwitchFromValues([M.MAIL_SWITCH_COLUMNS, ['good.example.net', 'brand alias', 'done']]).rows, TODAY);
  assert.equal(cards[0].domain, 'example.com');
  const ch = cards[0];
  assert.ok(ch.faults.includes('DKIM missing'));
  assert.ok(ch.faults.includes('DMARC weak'));
  assert.ok(ch.faults.includes('3 or more stops: a@example.com'));
  assert.ok(ch.faults.includes('certificate expires in 6 days'));
  assert.equal(ch.checks.find((c) => c.id === 'cert').level, 'bad');
  assert.match(ch.fix, /google\._domainkey\.example\.com/);
  const blank = cards.find((c) => c.domain === 'blank.example.org');
  assert.ok(blank.checks.filter((c) => c.id !== 'forward').every((c) => c.value === 'not yet read' && c.level === 'unread'));
  assert.equal(blank.progress.text, 'not on the Mail switch tab');
  const good = cards.find((c) => c.domain === 'good.example.net');
  assert.deepEqual(good.faults, []);
  assert.equal(good.checksGreen, true);
  assert.equal(good.progress.step, 2);
  assert.equal(M.domainCards(rows, null, null, TODAY)[0].progress.text, 'Mail switch not read');
});
