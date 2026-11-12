// Stage 13: registration expiry via RDAP. Run: node --test tests/estate/rdap.test.js
// Every domain, name and handle here is invented. Only RDAP server hostnames are real.
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../../estate/rdap.js');

const NOMINET_DOC = {
  objectClassName: 'domain',
  handle: 'EXAMPLE-HANDLE-1',
  ldhName: 'example.co.uk',
  status: ['client transfer prohibited', 'active'],
  events: [
    { eventAction: 'registration', eventDate: '2015-04-02T00:00:00Z' },
    { eventAction: 'last changed', eventDate: '2026-03-30T10:11:12Z' },
    { eventAction: 'expiration', eventDate: '2027-04-02T00:00:00Z' },
  ],
  entities: [
    { objectClassName: 'entity', handle: 'REGISTRANT-X', roles: ['registrant'], vcardArray: ['vcard', [['version', {}, 'text', '4.0'], ['fn', {}, 'text', 'Invented Holder Ltd']]] },
    {
      objectClassName: 'entity', handle: 'TAG-INVENTED', roles: ['registrar'],
      vcardArray: ['vcard', [['version', {}, 'text', '4.0'], ['fn', {}, 'text', 'Invented Registrar Ltd']]],
    },
  ],
  nameservers: [{ ldhName: 'ns1.example.net' }],
};

const VERISIGN_DOC = {
  objectClassName: 'domain',
  handle: '0000000_DOMAIN_COM-VRSN',
  ldhName: 'EXAMPLE.COM',
  status: ['client delete prohibited', 'client transfer prohibited'],
  events: [
    { eventAction: 'registration', eventDate: '2010-08-14T07:01:44Z' },
    { eventAction: 'expiration', eventDate: '2027-08-13T07:01:44Z' },
    { eventAction: 'last update of RDAP database', eventDate: '2026-11-12T09:00:00Z' },
  ],
  entities: [
    {
      objectClassName: 'entity', handle: '9999', roles: ['registrar'],
      publicIds: [{ type: 'IANA Registrar ID', identifier: '9999' }],
      vcardArray: ['vcard', [['version', {}, 'text', '4.0'], ['fn', {}, 'text', 'Example Registrar Inc.']]],
      entities: [{ objectClassName: 'entity', roles: ['abuse'], vcardArray: ['vcard', [['fn', {}, 'text', 'Abuse Desk']]] }],
    },
  ],
};

test('.uk routing: plain, .co.uk and .org.uk go to Nominet', () => {
  assert.equal(R.serverFor('example.uk'), 'https://rdap.nominet.uk/uk/');
  assert.equal(R.serverFor('example.co.uk'), 'https://rdap.nominet.uk/uk/');
  assert.equal(R.serverFor('example.org.uk'), 'https://rdap.nominet.uk/uk/');
  assert.equal(R.rdapUrl('example.co.uk'), 'https://rdap.nominet.uk/uk/domain/example.co.uk');
});

test('com, net, org and app routing', () => {
  assert.equal(R.serverFor('example.com'), 'https://rdap.verisign.com/com/v1/');
  assert.equal(R.serverFor('example.net'), 'https://rdap.verisign.com/net/v1/');
  assert.equal(R.serverFor('example.org'), 'https://rdap.publicinterestregistry.org/rdap/');
  assert.equal(R.serverFor('example.app'), 'https://pubapi.registry.google/rdap/');
  assert.equal(R.rdapUrl('example.com'), 'https://rdap.verisign.com/com/v1/domain/example.com');
});

test('unknown TLD and junk give null', () => {
  assert.equal(R.serverFor('example.unknowntld'), null);
  assert.equal(R.rdapUrl('example.unknowntld'), null);
  assert.equal(R.serverFor(''), null);
  assert.equal(R.serverFor(null), null);
  assert.equal(R.serverFor('localhost'), null);
  assert.equal(R.rdapUrl(undefined), null);
});

test('subdomains, scheme, path, case and spaces are stripped', () => {
  assert.equal(R.rdapUrl('  https://WWW.Example.COM/path?q=1 '), 'https://rdap.verisign.com/com/v1/domain/example.com');
  assert.equal(R.rdapUrl('shop.blog.example.co.uk'), 'https://rdap.nominet.uk/uk/domain/example.co.uk');
  assert.equal(R.rdapUrl('www.example.app.'), 'https://pubapi.registry.google/rdap/domain/example.app');
  assert.equal(R.registrable('a.b.example.org.uk'), 'example.org.uk');
  assert.equal(R.registrable('www.example.uk'), 'example.uk');
});

test('parse: Nominet-shaped reply', () => {
  assert.deepEqual(R.parse(NOMINET_DOC), {
    expires: '2027-04-02', registered: '2015-04-02', registrar: 'Invented Registrar Ltd',
    status: ['client transfer prohibited', 'active'],
  });
});

test('parse: Verisign-shaped reply, also as JSON text', () => {
  const want = {
    expires: '2027-08-13', registered: '2010-08-14', registrar: 'Example Registrar Inc.',
    status: ['client delete prohibited', 'client transfer prohibited'],
  };
  assert.deepEqual(R.parse(VERISIGN_DOC), want);
  assert.deepEqual(R.parse(JSON.stringify(VERISIGN_DOC)), want);
});

test('parse: registrar falls back to publicIds, then handle', () => {
  const ids = R.parse({ entities: [{ roles: ['registrar'], handle: 'H-1', publicIds: [{ identifier: '1234' }] }] });
  assert.equal(ids.registrar, '1234');
  const handle = R.parse({ entities: [{ roles: ['Registrar'], handle: 'H-2' }] });
  assert.equal(handle.registrar, 'H-2');
});

test('parse: missing events give nulls, not a throw', () => {
  const p = R.parse({ objectClassName: 'domain', ldhName: 'example.com' });
  assert.deepEqual(p, { expires: null, registered: null, registrar: null, status: [] });
  assert.equal(R.parse({ events: [{ eventAction: 'expiration' }, { eventAction: 'expiration', eventDate: 'soon' }] }).expires, null);
});

test('parse: garbage input never throws', () => {
  const empty = { expires: null, registered: null, registrar: null, status: [] };
  [undefined, null, '', 'not json{', '[]', '42', 42, true, [], { events: 'x', entities: 7, status: 'active' },
    { events: [null, 5, 'x'], entities: [null, { roles: 'registrar' }, { vcardArray: 'x', roles: ['registrar'] }] }]
    .forEach((g) => assert.deepEqual(R.parse(g), empty, 'FAIL on ' + JSON.stringify(g)));
});

test('fill never overwrites an existing expiry in any expiry column', () => {
  const parsed = R.parse(VERISIGN_DOC);
  [{ domain: 'example.com', expiry: '2028-01-01' },
    { domain: 'example.com', 'Renewal Date': '01/02/2028' },
    { domain: 'example.com', domain_expires: '2029-09-09' }].forEach((row) => {
    const out = R.fill(row, parsed);
    assert.deepEqual(out, row);
    assert.notEqual(out, row, 'FAIL: fill must return a new object');
    assert.equal(out.domain_expires_source, undefined);
  });
});

test('fill fills an empty row and leaves the input untouched', () => {
  const row = { domain: 'example.com', expiry: '  ', registrar: '' };
  const out = R.fill(row, R.parse(VERISIGN_DOC));
  assert.equal(out.domain_expires, '2027-08-13');
  assert.equal(out.domain_expires_source, 'rdap');
  assert.equal(row.domain_expires, undefined);
  assert.deepEqual(R.fill(row, R.parse({})), row, 'no expiry in reply -> unchanged');
  assert.deepEqual(R.fill(row, null), row);
});

test('fillRows matches by registrable domain, accepts parsed or raw replies', () => {
  const rows = [
    { domain: 'www.example.com' },
    { 'Domain Name': 'example.co.uk', expires: '2030-01-01' },
    { url: 'https://example.app/' },
    { domain: 'example.unknowntld' },
  ];
  const out = R.fillRows(rows, {
    'example.com': R.parse(VERISIGN_DOC),
    'EXAMPLE.CO.UK': NOMINET_DOC,
    'example.app': JSON.stringify({ events: [{ eventAction: 'expiration', eventDate: '2027-12-31T00:00:00Z' }] }),
  });
  assert.equal(out[0].domain_expires, '2027-08-13');
  assert.deepEqual(out[1], rows[1]);
  assert.equal(out[2].domain_expires, '2027-12-31');
  assert.equal(out[2].domain_expires_source, 'rdap');
  assert.deepEqual(out[3], rows[3]);
  assert.deepEqual(R.fillRows(null, null), []);
});

test('VERSION is a version string', () => {
  assert.match(R.VERSION, /^\d+\.\d+\.\d+$/);
});
