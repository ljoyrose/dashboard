const raw = process.env.SITE_BASE || '/dashboard/';
const BASE = ('/' + raw + '/').replace(/\/+/g, '/');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

const at = (tail) => new RegExp('^https?://[^/]+' + esc(BASE) + tail + '$');

module.exports = { BASE, esc, at };

