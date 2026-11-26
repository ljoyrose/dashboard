'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('t-bld-save-copies-test-1', () => {
  const root = path.join(__dirname, '..', '..');
  const client = fs.readFileSync(path.join(root, 'cdhub-write/client/bld-save.js'));
  const staff = fs.readFileSync(path.join(root, 'cdhub/staff/lib/bld-save.js'));
  assert.deepEqual(staff, client);
});

