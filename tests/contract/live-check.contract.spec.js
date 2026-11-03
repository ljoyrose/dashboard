// LIVE HEADER CHECK (JOB 31). The local script check-real-headers.js now also covers Food, Marketplace and Studio.
// It runs on Lisa's downloaded files, never on GitHub. Here it runs on the invented fixtures only.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { test, expect } = require('@playwright/test');
const { fixture } = require('./shape');

const SCRIPT = path.join(__dirname, 'check-real-headers.js');
const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
const RED = !!process.env.CONTRACT_PROVE_RED;

test.describe('Live header check @contract', () => {
  test('--dry-run on the invented fixtures passes and prints counts only (no file or column names)', () => {
    const r = run('--dry-run');
    expect(r.status).toBe(0);
    const lines = r.stdout.trim().split('\n');
    expect(lines).toEqual([expect.stringMatching(/^Checked \d+ file\(s\); 0 with a problem; 0 not on the list \(ignored\)\.$/), 'Problems by kind: none']);
    expect(Number(/Checked (\d+)/.exec(lines[0])[1])).toBeGreaterThanOrEqual(40);
  });

  test('a renamed Food column, a wrong Studio type and an empty wake file are each counted by kind', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'job31-red-'));
    const book = JSON.parse(fixture('food/book.json'));
    fs.writeFileSync(path.join(d, 'RR_FOOD - Invoices.csv'), book.Invoices.map((r) => r.map((c) => (c === 'total' ? 'total_gbp' : c)).join(',')).join('\n'));
    const s = JSON.parse(fixture('studio/contract-state.json')); s.assets[0].stage = '3';
    fs.writeFileSync(path.join(d, 'studio-state.json'), JSON.stringify(s));
    fs.writeFileSync(path.join(d, 'MKT-WAKE-WEBAPP.json'), '{}');
    const r = run(d, '--counts');
    fs.rmSync(d, { recursive: true, force: true });
    if (RED) { expect(r.status).toBe(0); return; }
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/Checked 3 file\(s\); 3 with a problem/);
    expect(r.stdout).toMatch(/Problems by kind: .*RENAMED 1/);
    expect(r.stdout).toMatch(/WRONG_TYPE 1/);
    expect(r.stdout).toMatch(/EMPTY 1/);
    expect(r.stdout).not.toMatch(/total_gbp|stage/); // counts only
  });
});
