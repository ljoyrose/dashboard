'use strict';
// Lisa 16 Nov 2026, option A: owners save with their Google sign-in (no code); staff keep codes.
// FAKE accounts and tokens only. Google is a stand-in (harness UrlFetchApp): tokeninfo + Drive about.
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv, req, save } = require('./harness');

const HUB = 'hub-client.apps.googleusercontent.test';
const OWNER_TOKEN = 'ya29.FAKE-owner-token-000000000001';
const GMAIL_TOKEN = 'ya29.FAKE-gmail-owner-token-0000002';
const STRANGER_TOKEN = 'ya29.FAKE-stranger-token-00000003';
const OTHER_APP_TOKEN = 'ya29.FAKE-other-app-token-0000004';
const google = { tokens: {
  [OWNER_TOKEN]: { aud: HUB, email: 'owner@example.test', name: 'Olive Owner' },
  [GMAIL_TOKEN]: { aud: HUB, email: 'second.owner@example.test', name: 'Second Owner' },
  [STRANGER_TOKEN]: { aud: HUB, email: 'stranger@example.test', name: 'Stranger' },
  [OTHER_APP_TOKEN]: { aud: 'some-other-app', email: 'owner@example.test', name: 'Olive Owner' }
} };
const env0 = (props = {}) => standardEnv({ google, props: Object.assign({ MODE_area_reading: 'direct', HUB_CLIENT_ID: HUB, ADMIN_EMAILS: 'owner@example.test, Second.Owner@example.test' }, props) });
const noCode = (env, over = {}) => { const r = req(env, over); delete r.code; return r; };
const lastRow = (env) => { const rs = env.ctx.csvRecords_(env.text('BLD-area_reading.csv')).records; return rs[rs.length - 1]; };

test('an owner signed in with Google saves with no code, recorded under their name, never their email', () => {
  const env = env0();
  const r = save(env, noCode(env, { google_token: OWNER_TOKEN }));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.result.status, 'saved');
  const row = lastRow(env);
  assert.ok(JSON.stringify(row).includes('Olive Owner'));
  assert.ok(!JSON.stringify(row).includes('owner@example.test'), 'the email is never written into a record');
});

test('a personal Gmail on the owner list works the same (owner list is case-insensitive)', () => {
  const env = env0();
  const r = save(env, noCode(env, { google_token: GMAIL_TOKEN }));
  assert.equal(r.ok, true, JSON.stringify(r));
});

test('a Google account not on the owner list, with no code, is refused and nothing is saved', () => {
  const env = env0();
  const before = env.text('BLD-area_reading.csv');
  const r = save(env, noCode(env, { google_token: STRANGER_TOKEN }));
  assert.equal(r.ok, false);
  assert.equal(r.code, 'GOOGLE_NOT_OWNER');
  assert.equal(env.text('BLD-area_reading.csv'), before);
});

test('a token issued to another app is refused, even for an owner email (no replay)', () => {
  const env = env0();
  const r = save(env, noCode(env, { google_token: OTHER_APP_TOKEN }));
  assert.equal(r.code, 'GOOGLE_NOT_OWNER');
  assert.equal(env.fetches.filter((f) => f.url.includes('drive/v3/about')).length, 0, 'Drive is not even asked');
});

test('an unknown or expired token is refused', () => {
  const env = env0();
  assert.equal(save(env, noCode(env, { google_token: 'ya29.FAKE-not-a-real-token-000005' })).code, 'GOOGLE_NOT_OWNER');
  const env2 = standardEnv({ google: { tokens: { [OWNER_TOKEN]: { aud: HUB, email: 'owner@example.test', name: 'O', expires_in: 0 } } },
    props: { MODE_area_reading: 'direct', HUB_CLIENT_ID: HUB } });
  assert.equal(save(env2, noCode(env2, { google_token: OWNER_TOKEN })).code, 'GOOGLE_NOT_OWNER');
});

test('a staff code still works, with or without a non-owner Google token alongside', () => {
  const env = env0();
  assert.equal(save(env, req(env)).ok, true);
  const r = save(env, req(env, { google_token: STRANGER_TOKEN, fields: { area_id: 'area-t2', min_c: '20.0', max_c: '22.0' } }));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(JSON.stringify(lastRow(env)).includes('Sam Staff'));
});

test('HUB_CLIENT_ID not set: the Google route is off, Google is never asked, codes work as before', () => {
  const env = env0({ HUB_CLIENT_ID: '' });
  const r = save(env, noCode(env, { google_token: OWNER_TOKEN }));
  assert.equal(r.ok, false);
  assert.equal(r.code, 'NO_CODE');
  assert.equal(env.fetches.length, 0);
  assert.equal(save(env, req(env)).ok, true);
});

test('Google unreachable: plain message and nothing saved; with a code it falls back to the code', () => {
  const env = env0(); env.google = null;
  const r = save(env, noCode(env, { google_token: OWNER_TOKEN }));
  assert.equal(r.code, 'GOOGLE_UNREACHABLE');
  assert.equal(save(env, req(env, { google_token: OWNER_TOKEN })).ok, true);
});

test('the check is cached briefly: a second save does not ask Google again', () => {
  const env = env0();
  save(env, noCode(env, { google_token: OWNER_TOKEN }));
  const n = env.fetches.length;
  save(env, noCode(env, { google_token: OWNER_TOKEN, fields: { area_id: 'area-t2', min_c: '20.0', max_c: '22.0' } }));
  assert.equal(env.fetches.length, n);
  assert.ok(Object.keys(env.cache).every((k) => !k.includes(OWNER_TOKEN)), 'the token itself is never a cache key');
});

test('an owner Google sign-in reads lists as the owner (aud-admin rows)', () => {
  const env = env0({ READ_ENABLED: 'true' });
  let r; try { r = { ok: true, result: env.ctx.sinkRead_(noCode(env, { v: 1, action: 'read', table: 'area_reading', google_token: OWNER_TOKEN })) }; } catch (e) { r = env.ctx.errorBody_(e); }
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.result.role, 'OWNER');
});
