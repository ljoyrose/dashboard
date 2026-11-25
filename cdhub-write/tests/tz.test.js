'use strict';
// Time zone per tenant (14 Nov 2026): the BLD-locale row in force on the day; no row = the script's time zone.
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv } = require('./harness');

function env(rows) {
  const e = standardEnv({});
  const t = e.props.TENANT_ID;
  if (rows) e.addFile('BLD-locale.csv', ['id,tenant_id,language_tag,date_display,time_zone,from_date,to_date,source']
    .concat(rows.map((r) => r.replace(/TEN/g, t))).join('\r\n') + '\r\n');
  e.ctx.tzForget_(t);
  return e;
}

test('tzOn_: the row in force on the day wins; a later row takes over from its from_date; other tenants ignored', () => {
  const e = env(['loc-1,TEN,en-GB,D MMM YYYY,Europe/London,2025-01-01,2026-12-31,test',
    'loc-2,TEN,en-GB,D MMM YYYY,Europe/Paris,2027-01-01,,test', 'loc-x,ten-other,fr-FR,,Asia/Tokyo,2020-01-01,,test']);
  assert.equal(e.ctx.tzOn_('', '2026-06-01'), 'Europe/London');
  assert.equal(e.ctx.tzOn_('', '2027-02-01'), 'Europe/Paris');
  assert.equal(e.ctx.tzOn_('', '2024-06-01'), 'Europe/London');   // before any row: the script's own zone
  assert.equal(e.ctx.tzNotSet_(), false);
});

test('tzOn_: no locale file or no time_zone: the script time zone, and Data checks can say "not set"; status shows it', () => {
  const e = env(null);
  assert.equal(e.ctx.tzOn_('', '2026-06-01'), 'Europe/London');
  assert.equal(e.ctx.tzNotSet_(), true);
  const bad = env(['loc-1,TEN,en-GB,,not a zone,2025-01-01,,test']);
  assert.equal(bad.ctx.tzNotSet_(), true);
  const s = JSON.parse(env(['loc-1,TEN,en-GB,,America/New_York,2025-01-01,,test']).ctx.doGet({ parameter: {} }).getContent());
  assert.equal(s.timeZone, 'America/New_York');
});
