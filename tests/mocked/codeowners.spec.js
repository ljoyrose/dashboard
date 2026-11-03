// Stage 1: every delete-code path has a code owner, so a change to it can be held for review.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OWNERS = fs.readFileSync(path.join(ROOT, '.github', 'CODEOWNERS'), 'utf8');
const rules = OWNERS.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  .map((l) => l.split(/\s+/));

const DELETE_CODE = [
  'index.html',
  'tests/mocked/bin-safety.spec.js',
  'tests/mocked/bin-guard.spec.js',
  'tests/mocked/cleanup-safety.spec.js',
  'tests/mocked/excluded-drive.spec.js',
  'tests/mocked/no-empty-trash.spec.js',
  'tests/mocked/personal-and-drive-check.spec.js',
  'tests/mocked/codeowners.spec.js',
  '.github/CODEOWNERS',
];

test('each delete-code path exists and has an owner', () => {
  for (const f of DELETE_CODE) {
    expect(fs.existsSync(path.join(ROOT, f)), f + ' exists').toBe(true);
    const rule = rules.find((r) => r[0] === '/' + f);
    expect(rule, f + ' has a CODEOWNERS rule').toBeTruthy();
    expect(rule.length, f + ' names an owner').toBeGreaterThan(1);
    expect(rule.slice(1).every((o) => /^@[\w-]+(\/[\w-]+)?$/.test(o)), f + ' owner is a GitHub handle').toBe(true);
  }
});

test('no catch-all rule hides the delete-code rules', () => {
  expect(rules.some((r) => r[0] === '*' || r[0] === '/')).toBe(false);
});
