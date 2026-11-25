// The published staff page copies cdhub-write/client/bld-save.js. #582 left the staff copy
// on a 5-hour outbox while the client copy was 23 hours. This fails if the two files drift.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const REPO = path.resolve(__dirname, '..', '..');

test('the two bld-save.js copies are the same file @regression', () => {
  const client = fs.readFileSync(path.join(REPO, 'cdhub-write/client/bld-save.js'));
  const staff = fs.readFileSync(path.join(REPO, 'cdhub/staff/lib/bld-save.js'));
  expect(staff.equals(client)).toBe(true);
});
