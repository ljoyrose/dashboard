// Runs the Breed Better calculator tests in the normal test suite, so they run on every pull request.
const { test, expect } = require('@playwright/test');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('Breed Better calculator tests pass', () => {
  const root = path.resolve(__dirname, '..', '..');
  const run = spawnSync(process.execPath, ['--test', 'tests/breed-better/score.test.js', 'tests/breed-better/hub-view.test.js', 'tests/breed-better/inspect.test.js', 'tests/breed-better/contract.test.js'], { cwd: root, encoding: 'utf8' });
  expect(run.status, run.stdout + run.stderr).toBe(0);
});
