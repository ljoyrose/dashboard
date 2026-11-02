// Where the site sits on the test server. GitHub Pages served it under /dashboard/; Cloudflare serves it at the root.
// Run the suite either way: SITE_BASE=/ npx playwright test --project=mocked   (default /dashboard/)
const raw = process.env.SITE_BASE || '/dashboard/';
const BASE = ('/' + raw + '/').replace(/\/+/g, '/');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** A page address on this site: `tail` is regex source for the part after the base, e.g. at('money/'), at('(#/map)?'). */
const at = (tail) => new RegExp('^https?://[^/]+' + esc(BASE) + tail + '$');

module.exports = { BASE, esc, at };
