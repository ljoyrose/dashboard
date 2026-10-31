// Invented RR_WEB-ESTATE rows for the estate tests. Every company, brand, client and address is made up
// (example.com / example.org / .test style). No real estate row ever lives in this repo.
const HEADER = ['key', 'kind', 'company', 'brand', 'client', 'owner_role', 'url_or_domain', 'platform', 'dns_host',
  'live_status', 'http_code', 'ssl_expires', 'domain_expires', 'spf', 'dkim', 'dmarc', 'gsc_verified', 'merchant_center',
  'ga4', 'gtm', 'meta_pixel', 'feed', 'keywords_tracked', 'access_note', 'source', 'checked_uk', 'flag'];

// One object per row; any column left out is blank.
const ROWS = [
  { key: 'example.com', kind: 'site', company: 'Sample Co', brand: 'Sample Brand', owner_role: 'owner', url_or_domain: 'https://example.com', platform: 'Webwave', dns_host: 'Cloudflare', live_status: 'live', http_code: '200', ssl_expires: '2027-01-15', domain_expires: '2027-06-01', spf: 'pass', dkim: 'found', dmarc: 'none', ga4: 'found (1)', gtm: 'not found in page source', meta_pixel: 'not checked', source: 'seed', checked_uk: '29/10/2026 09:00' },
  { key: 'shop.example.org', kind: 'shop', company: 'Sample Co', brand: 'Other Brand', owner_role: 'owner', url_or_domain: 'https://shop.example.org', platform: 'Shopify', dns_host: 'Shopify', live_status: 'live', http_code: '200', ssl_expires: '2026-12-01', ga4: 'found (1)', merchant_center: 'linked (per Lisa, not machine-checked)', feed: 'not reported', source: 'seed', checked_uk: '29/10/2026 09:00' },
  { key: 'funnels.example.net', kind: 'funnel', company: 'Sample Co', brand: 'Sample Brand', owner_role: 'owner', url_or_domain: 'https://funnels.example.net', platform: 'ClickFunnels', live_status: 'down', http_code: '', flag: 'TLS fail', source: 'seed', checked_uk: '29/10/2026 09:00' },
  { key: 'app.example.test', kind: 'app', company: 'Second Ltd', client: 'Client A', owner_role: 'builder', url_or_domain: 'https://app.example.test', platform: 'Sample builder', live_status: 'blocked to scripts', http_code: '403', source: 'Add', checked_uk: '29/10/2026 09:00' },
  { key: 'dns-zone:example.com', kind: 'dns-zone', company: 'Sample Co', url_or_domain: 'example.com', dns_host: 'Cloudflare', source: 'domains' },
  { key: 'email-domain:example.com', kind: 'email-domain', company: 'Sample Co', url_or_domain: 'example.com', spf: 'two records', dkim: 'not found', dmarc: 'missing', source: 'domains' },
  { key: 'ads-account:client-b.example', kind: 'ads-account', company: 'Second Ltd', client: 'Client B', url_or_domain: 'client-b.example', keywords_tracked: '0', access_note: 'manager role', source: 'manual' },
];

/** Sheet values as the Sheets API returns them: the header row, then one array per row. */
function values(header = HEADER, rows = ROWS) {
  return [header.slice()].concat(rows.map((r) => header.map((c) => (r[c] === undefined ? '' : String(r[c])))));
}

module.exports = { HEADER, ROWS, values };
