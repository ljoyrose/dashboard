'use strict';
// cdhub/staff/lib/bld-save.js is the published copy of cdhub-write/client/bld-save.js.
// The staff page README says to copy again after changing the client. This fails if the two drift.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('the two bld-save.js copies are the same file @regression', () => {
  const root = path.join(__dirname, '..', '..');
  const client = fs.readFileSync(path.join(root, 'cdhub-write/client/bld-save.js'));
  const staff = fs.readFileSync(path.join(root, 'cdhub/staff/lib/bld-save.js'));
  assert.deepEqual(staff, client);
});
