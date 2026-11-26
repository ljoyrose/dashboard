const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const REPO = path.resolve(__dirname, '..', '..');

test('t-bld-save-copies-spec-1', () => {
  const client = fs.readFileSync(path.join(REPO, 'cdhub-write/client/bld-save.js'));
  const staff = fs.readFileSync(path.join(REPO, 'cdhub/staff/lib/bld-save.js'));
  expect(staff.equals(client)).toBe(true);
});

