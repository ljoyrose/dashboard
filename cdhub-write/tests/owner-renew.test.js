'use strict';
// 22 Nov 2026 (owner: "only 1 of my readings saved"; staff Temps "Loading..." for 45-110 s on every open).
// FAKE tokens only. The page's Google sign-in is a stand-in DashAuth on a stand-in window.
const test = require('node:test');
const assert = require('node:assert/strict');
const fsx = require('node:fs'), pathx = require('node:path');
const CODE = fsx.existsSync(pathx.join(__dirname, '..', 'code')) ? pathx.join(__dirname, '..', 'code') : pathx.join(__dirname, '..');
const GOOD_URL = 'https://script.google.com/macros/s/AKfycbxTESTTESTTEST/exec';
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

function fakeAuth(token, ms) {
  const a = { s: { access_token: token, expires_at: Date.now() + ms, scope: SCOPE } };
  a.read = () => a.s; a.valid = () => (Date.now() < a.s.expires_at ? a.s : null); a.hasScope = (s, sc) => String(s.scope).includes(sc);
  a.expire = () => { a.s = Object.assign({}, a.s, { expires_at: Date.now() - 1000 }); };
  a.renew = (t) => { a.s = { access_token: t, expires_at: Date.now() + 3600000, scope: SCOPE }; };
  return a;
}
function load(auth) {
  global.window = { DashAuth: auth };
  delete require.cache[require.resolve(CODE + '/client/bld-save.js')];
  return require(CODE + '/client/bld-save.js');
}
/** A script stand-in: answers each POST with reply(body), after `delay` ms (Infinity = never). */
function server(reply, delay = 0) {
  const posts = []; let inflight = 0, peak = 0;
  const f = (url, init = {}) => {
    if (!init.method || init.method === 'GET') return Promise.resolve({ json: async () => ({ ok: true, version: '1', saveEnabled: true, readEnabled: true, tables: [{ key: 'area_reading', file: 'BLD-area_reading.csv', on: true, mode: 'direct' }] }) });
    const body = JSON.parse(init.body); posts.push(body); inflight++; peak = Math.max(peak, inflight);
    if (delay === Infinity) return new Promise(() => {});
    return new Promise((r) => setTimeout(() => { inflight--; r({ json: async () => reply(body) }); }, delay));
  };
  return { f, posts, peak: () => peak };
}
const saved = (b) => ({ ok: true, result: { status: 'saved', id: 'rdg-' + b.request_id } });
const reading = { area_id: 'area-t1', min_c: '20', max_c: '21' };

test('a token that runs out mid-round: every later save still goes with Google, none asks for a code', async () => {
  const auth = fakeAuth('fake-token-a-000000000000000000001', 3600000), B = load(auth);
  B.setOwnerRefresher(() => { auth.renew('fake-token-b-000000000000000000002'); return Promise.resolve(); });
  let n = 0;
  const srv = server((b) => { if (++n === 1) auth.expire(); return saved(b); }, 20);   // runs out while the others wait their turn
  const s = B.create({ fetch: srv.f, localStorage: null, sessionStorage: null, scriptUrl: GOOD_URL });
  await s.checkStatus(); s.setLookups({ area: [{ id: 'area-t1' }] });
  const rs = await Promise.all([s.submit('area_reading', reading), s.submit('area_reading', reading), s.submit('area_reading', reading)]);
  rs.forEach((r) => assert.equal(r.ok, true, JSON.stringify(r)));
  assert.equal(srv.posts[0].google_token, 'fake-token-a-000000000000000000001');
  assert.deepEqual(srv.posts.slice(1).map((b) => b.google_token), ['fake-token-b-000000000000000000002', 'fake-token-b-000000000000000000002']);
});

test('GOOGLE_NOT_OWNER on a run-out token: renewed once and sent again with the SAME request id, then saved', async () => {
  const auth = fakeAuth('fake-token-a-000000000000000000001', 3600000), B = load(auth);
  B.setOwnerRefresher(() => { auth.renew('fake-token-b-000000000000000000002'); return Promise.resolve(); });
  const srv = server((b) => (b.google_token === 'fake-token-a-000000000000000000001' ? { ok: false, code: 'GOOGLE_NOT_OWNER', message: 'x' } : saved(b)));
  const s = B.create({ fetch: srv.f, localStorage: null, sessionStorage: null, scriptUrl: GOOD_URL });
  await s.checkStatus(); s.setLookups({ area: [{ id: 'area-t1' }] });
  const r = await s.submit('area_reading', reading);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(srv.posts.length, 2);
  assert.equal(srv.posts[0].request_id, srv.posts[1].request_id);
});

test('a Google account that really is not an owner: refused after one renewal, not sent again and again', async () => {
  const auth = fakeAuth('fake-token-a-000000000000000000001', 3600000), B = load(auth);
  let n = 0; B.setOwnerRefresher(() => { auth.renew('fake-token-n-00000000000000000000' + (++n)); return Promise.resolve(); });
  const srv = server(() => ({ ok: false, code: 'GOOGLE_NOT_OWNER', message: 'not on the owner list' }));
  const s = B.create({ fetch: srv.f, localStorage: null, sessionStorage: null, scriptUrl: GOOD_URL });
  await s.checkStatus(); s.setLookups({ area: [{ id: 'area-t1' }] });
  const r = await s.submit('area_reading', reading);
  assert.equal(r.code, 'GOOGLE_NOT_OWNER');
  assert.equal(srv.posts.length, 2);
});

test('refreshOwnerToken gives up after 10 s at most and never hangs a save (refresher that never answers)', async () => {
  const auth = fakeAuth('fake-token-a-000000000000000000001', 3600000), B = load(auth);
  assert.equal(typeof B.refreshOwnerToken, 'function');
  B.setOwnerRefresher(() => Promise.resolve());
  assert.equal(await B.refreshOwnerToken(), 'fake-token-a-000000000000000000001');
});

test('a read that never answers comes back TIMEOUT within the read limit', async () => {
  const auth = fakeAuth('fake-token-a-000000000000000000001', 3600000), B = load(auth);
  const srv = server(saved, Infinity);
  const s = B.create({ fetch: srv.f, localStorage: null, sessionStorage: null, scriptUrl: GOOD_URL, readTimeoutMs: 50 });
  await s.checkStatus();
  const t0 = Date.now(); const r = await s.read('area');
  assert.equal(r.code, 'TIMEOUT');
  assert.ok(Date.now() - t0 < 1000);
});

test('slow lists are read once per page and shared; readings are kept 2 minutes; a save forgets its list', async () => {
  const auth = fakeAuth('fake-token-a-000000000000000000001', 3600000), B = load(auth);
  const srv = server((b) => (b.action === 'read' ? { ok: true, result: { table: b.table, rows: [{ id: 'r1' }] } } : saved(b)), 5);
  const s = B.create({ fetch: srv.f, localStorage: null, sessionStorage: null, scriptUrl: GOOD_URL });
  await s.checkStatus(); s.setLookups({ area: [{ id: 'area-t1' }] });
  await Promise.all([s.read('area'), s.read('area')]);   // asked twice at once: sent once
  await s.read('area');
  assert.equal(srv.posts.filter((b) => b.table === 'area').length, 1);
  assert.ok(s.keptAt('area') > 0);
  // readings are kept 2 minutes only, and a save to them forgets the copy at once
  await s.read('area_reading'); await s.read('area_reading');
  assert.equal(srv.posts.filter((b) => b.action === 'read' && b.table === 'area_reading').length, 1);
  const r = await s.submit('area_reading', { area_id: 'area-t1', min_c: '20', max_c: '21' });
  assert.equal(r.ok, true);
  await s.read('area_reading');
  assert.equal(srv.posts.filter((b) => b.action === 'read' && b.table === 'area_reading').length, 2);
  const realNow = Date.now; Date.now = () => realNow() + 121000;
  try { await s.read('area_reading'); } finally { Date.now = realNow; }
  assert.equal(srv.posts.filter((b) => b.action === 'read' && b.table === 'area_reading').length, 3);
  s.dropCache(); await s.read('area');
  assert.equal(srv.posts.filter((b) => b.table === 'area').length, 2);
  s.setCode('OTHERCODE1'); await s.read('area');   // a new code never sees the last code's copy
  assert.equal(srv.posts.filter((b) => b.table === 'area').length, 3);
});

test('readMany: the first list goes alone (one try on a wrong code), the rest together', async () => {
  const auth = fakeAuth('fake-token-a-000000000000000000001', 3600000), B = load(auth);
  const srv = server((b) => ({ ok: true, result: { table: b.table, rows: [] } }), 20);
  const s = B.create({ fetch: srv.f, localStorage: null, sessionStorage: null, scriptUrl: GOOD_URL });
  await s.checkStatus();
  const r = await s.readMany(['area', 'subject', 'occupancy', 'subject_status', 'requirement'], ['requirement']);
  assert.equal(r.ok, true);
  assert.equal(srv.peak(), 4);
});
