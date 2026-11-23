// Runs the Breed Better calculator tests in the normal test suite, so they run on every pull request.
const { test, expect } = require('@playwright/test');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

// Every *.test.js in tests/breed-better, so a new test file can never be left out of the run.
const files = (root) => require('node:fs').readdirSync(path.join(root, 'tests/breed-better')).filter((f) => f.endsWith('.test.js')).map((f) => 'tests/breed-better/' + f);

test('Breed Better calculator tests pass', () => {
  const root = path.resolve(__dirname, '..', '..');
  const run = spawnSync(process.execPath, ['--test', ...files(root)], { cwd: root, encoding: 'utf8' });
  expect(files(root).length).toBeGreaterThanOrEqual(4);
  expect(run.status, run.stdout + run.stderr).toBe(0);
});

// Each key condition in score.js, flipped one at a time, must turn a calculator test red (tools/bb-mutate).
test('Breed Better mutation check: every flipped condition is caught', () => {
  test.setTimeout(120_000);
  const root = path.resolve(__dirname, '..', '..');
  const run = spawnSync(process.execPath, ['tools/bb-mutate/run.mjs'], { cwd: root, encoding: 'utf8' });
  expect(run.status, run.stdout + run.stderr).toBe(0);
});
