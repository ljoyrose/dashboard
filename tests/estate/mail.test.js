// Email sending and verification words from DNS-over-HTTPS answers. Run: node --test tests/estate/mail.test.js
// Every name is invented (example.com, example.org, example.net).
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../../estate/mail.js');
const E = require('../../estate/core.js');

const txt = (...data) => ({ Status: 0, Answer: data.map((d) => ({ name: 'example.com.', type: 16, data: d })) });
const mx = (...data) => ({ Status: 0, Answer: data.map((d) => ({ name: 'example.com.', type: 15, data: d })) });
const NX = { Status: 3 };

test('chunked TXT joins; CNAME hops and empty answers are skipped', () => {
  assert.deepEqual(M.txtRecords(txt('"v=spf1 include:_spf.example.net" " ~all"')), ['v=spf1 include:_spf.example.net ~all']);
  assert.deepEqual(M.txtRecords(txt('"v=DKIM1; k=rsa; p=AAAA""BBBB"')), ['v=DKIM1; k=rsa; p=AAAABBBB']);
  assert.deepEqual(M.txtRecords(txt('plain text')), ['plain text']);
  assert.deepEqual(M.txtRecords({ Status: 0, Answer: [{ type: 5, data: 'x.example.net.' }, { type: 16, data: '"a"' }] }), ['a']);
  assert.deepEqual(M.txtRecords(NX), []);
  assert.deepEqual(M.txtRecords(null), []);
});

test('ACCEPT: two SPF records is NEVER shown as passing', () => {
  const two = M.spfWord(txt('"v=spf1 include:_spf.example.net ~all"', '"v=spf1 include:mail.example.org -all"'));
  assert.equal(two.word, 'two records');
  assert.equal(two.count, 2);
  assert.notEqual(two.word, 'pass');
  assert.ok(!/pass|present|ok/i.test(two.word));
  const s = M.summarise({ spf: two, dmarc: { word: 'reject' } });
  assert.deepEqual(s.faults, ['two SPF records']);
  assert.deepEqual(E.emailProblems({ spf: two.word }), ['two SPF records'], 'core reads the word as a fault too');
  assert.equal(M.spfWord(txt('"v=spf1 a"', '"v=spf1 mx"', '"v=spf1 -all"')).word, 'two records', 'three is still the fault');
});

test('SPF: one record passes, none is missing, look-alikes do not count', () => {
  const one = M.spfWord(txt('"v=spf1 include:_spf.example.net ~all"', '"google-site-verification=abc"'));
  assert.deepEqual(one, { word: 'pass', count: 1, record: 'v=spf1 include:_spf.example.net ~all' });
  assert.equal(M.spfWord(txt('"some other text"')).word, 'missing');
  assert.equal(M.spfWord(NX).word, 'missing');
  assert.equal(M.spfWord(txt('"v=spf10 nonsense"')).word, 'missing');
  assert.equal(M.spfWord(['v=spf1 -all']).word, 'pass', 'accepts already-joined strings');
});

test('DKIM: found at a selector vs not found (never "missing")', () => {
  const found = M.dkimWord({ google: txt('"v=DKIM1; k=rsa; p=MIIB" "AQAB"'), selector1: NX, s1: txt('"p=QUJD"'), k1: NX });
  assert.equal(found.word, 'found (google, s1)');
  const none = M.dkimWord({ google: NX, selector1: NX, selector2: NX, k1: NX, s1: NX, default: NX });
  assert.equal(none.word, 'not found');
  assert.ok(!/missing/.test(none.word));
  assert.deepEqual(E.emailProblems({ spf: 'pass', dkim: none.word, dmarc: 'reject' }), []);
  assert.deepEqual(M.DKIM_SELECTORS, ['google', 'selector1', 'selector2', 'k1', 's1', 'default']);
});

test('DMARC policies, missing, two records', () => {
  const d = (...r) => M.dmarcWord(txt(...r)).word;
  assert.equal(d('"v=DMARC1; p=none; rua=mailto:r@example.com"'), 'none');
  assert.equal(d('"v=DMARC1; p=quarantine"'), 'quarantine');
  assert.equal(d('"v=DMARC1;" " p=reject; pct=100"'), 'reject');
  assert.equal(M.dmarcWord(NX).word, 'missing');
  assert.equal(d('"not dmarc"'), 'missing');
  assert.equal(d('"v=DMARC1; p=none"', '"v=DMARC1; p=reject"'), 'two records');
  assert.equal(M.dmarcWord(txt('"v=DMARC1; p=none"')).rua, false);
});

test('summarise: faults and softer notes', () => {
  assert.deepEqual(M.summarise({ spf: { word: 'missing' }, dmarc: { word: 'missing' } }), { faults: ['SPF missing', 'DMARC missing'], notes: [] });
  assert.deepEqual(M.summarise({ spf: 'pass', dmarc: 'none' }), { faults: [], notes: ['DMARC p=none'] });
  assert.deepEqual(M.summarise({ spf: 'pass', dkim: 'not found', dmarc: 'reject' }), { faults: [], notes: [] });
});

test('MX: lowest preference wins, provider words', () => {
  const w = (...r) => M.mxHost(mx(...r)).word;
  assert.equal(w('20 alt1.aspmx.l.google.com.', '1 aspmx.l.google.com.'), 'Google Workspace');
  assert.equal(w('10 example-com.mail.protection.outlook.com.'), 'Microsoft 365');
  assert.equal(w('30 mx.example.net.', '5 mx1.privateemail.com.'), 'Namecheap Private Email');
  assert.equal(w('10 mx.zoho.eu.'), 'Zoho');
  assert.equal(w('10 in1-smtp.messagingengine.com.'), 'Fastmail');
  assert.equal(w('10 mail.protonmail.ch.'), 'ProtonMail');
  assert.equal(w('10 eu-smtp-inbound-1.mimecast.com.'), 'Mimecast');
  assert.equal(w('10 mx00.ionos.co.uk.'), 'IONOS');
  assert.equal(w('10 mx.googlemail.com.'), 'Google Workspace');
  assert.equal(w('10 eforward1.registrar-servers.com.'), 'Namecheap email forwarding');
  assert.equal(w('10 mx10.mailspamprotection.com.'), 'SiteGround');
  assert.equal(w('10 mail.mx.example.org.', '50 aspmx.l.google.com.'), 'example.org');
  assert.equal(M.mxHost(NX).word, 'none');
  assert.equal(w('0 .'), 'none', 'null MX means no mail');
});

test('verification: TXT google-site-verification and HTML meta names only', () => {
  assert.equal(M.googleVerified(txt('"v=spf1 -all"', '"google-site-verification=TOKEN123"')), true);
  assert.equal(M.googleVerified(txt('"v=spf1 -all"')), false);
  const html = '<head><meta name="google-site-verification" content="SECRETTOKENG1"><meta content="SECRETTOKENF2" name="facebook-domain-verification" />' +
    "<meta name='p:domain_verify' content='SECRETTOKENP3'><meta name=\"msvalidate.01\" content=\"SECRETTOKENB4\"><meta name=\"description\" content=\"x\"></head>";
  const v = M.htmlVerifications(html);
  assert.deepEqual(v, ['google', 'facebook', 'pinterest', 'bing']);
  assert.ok(!/SECRETTOKEN/.test(JSON.stringify(v)), 'no token value leaks');
  assert.deepEqual(M.htmlVerifications('<meta name="viewport" content="w">'), []);
});

test('fix suggestions: plain text, placeholder address, never a real value', () => {
  const two = M.spfWord(txt('"v=spf1 include:a.example.net ~all"', '"v=spf1 include:b.example.org ~all"'));
  const t1 = M.fixSuggestion('example.com', { spf: two, dmarc: M.dmarcWord(NX), mx: { word: 'Google Workspace' } });
  assert.match(t1, /Merge the 2 SPF TXT records on example\.com into ONE: "v=spf1 include:a\.example\.net include:b\.example\.org ~all"/);
  assert.deepEqual(M.mergeSpf(['v=spf1 include:a.example.net include:.. ~all', 'v=spf1 include:a.example.net -all']), { record: 'v=spf1 include:a.example.net ~all', dropped: ['include:..'] });
  assert.equal(M.mergeSpf(['v=spf1 mx -all', 'v=spf1 ip4:192.0.2.1 -all']).record, 'v=spf1 mx ip4:192.0.2.1 -all');
  assert.match(t1, /_dmarc\.example\.com: "v=DMARC1; p=none; rua=mailto:dmarc-reports@<your-domain>"/);
  const t2 = M.fixSuggestion('example.org', { spf: M.spfWord(NX), dmarc: M.dmarcWord(txt('"v=DMARC1; p=none"')), mx: { word: 'Google Workspace' } });
  assert.match(t2, /include:_spf\.google\.com/);
  assert.match(t2, /p=quarantine and add rua=/);
  assert.equal(M.fixSuggestion('example.net', { spf: 'pass', dmarc: 'reject' }), 'No DNS change needed for example.net.');
});
