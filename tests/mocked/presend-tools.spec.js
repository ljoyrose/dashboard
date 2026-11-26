const { test, expect } = require('@playwright/test');
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

test('pre-send checker unit tests pass (invented data only, PRESEND_DATA unset)', () => {
  const env = { ...process.env, PYTHONDONTWRITEBYTECODE: '1' };
  delete env.PRESEND_DATA;
  const r = spawnSync('python3', ['-m', 'unittest', 'tools/presend/test_presend.py', '-v'], { cwd: ROOT, env, encoding: 'utf8', timeout: 120_000 });
  if (r.status !== 0) console.log(r.error ? String(r.error) : '', r.stdout, r.stderr);
  expect(r.status, 'python3 -m unittest tools/presend/test_presend.py').toBe(0);
  expect(r.stderr).toMatch(/\nOK\s*$/);
});

