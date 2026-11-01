// LIVE STATE CHECK (JOB 31b). The local script check-real-state-b.js reads Lisa's downloaded Factory and Home JSON
// files, never on GitHub. Here it runs on the invented fixtures only.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { test, expect } = require('@playwright/test');
const { build } = require('../fixtures/factory/state.js');

const SCRIPT = path.join(__dirname, 'check-real-state-b.js');
const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
const RED = !!process.env.CONTRACT_PROVE_RED;
const REPO = path.resolve(__dirname, '..', '..');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'job31b-red-'));

test.describe('Live state check, Factory and Home @contract', () => {
  test('--dry-run on the invented fixtures passes and prints counts only (no file or key names)', () => {
    const r = run('--dry-run');
    expect(r.status).toBe(0);
    expect(r.stdout.trim().split('\n')).toEqual(['Checked 3 file(s); 0 with a problem; 0 not on the list (ignored).', 'Problems by kind: none']);
  });

  test('a renamed Factory list, a wrong Dropbox type and an empty Bin guard file are each counted by kind', () => {
    const d = tmp();
    const s = build(Date.now()); s.lists.tasks = s.lists.work; delete s.lists.work;
    fs.writeFileSync(path.join(d, 'af-state.json'), JSON.stringify(s));
    const o = JSON.parse(fs.readFileSync(path.join(REPO, 'tests/fixtures/dropbox/DROPBOX-TOTALS.json'), 'utf8')); o.marked_files = '12';
    fs.writeFileSync(path.join(d, 'DROPBOX-TOTALS.json'), JSON.stringify(o));
    fs.writeFileSync(path.join(d, 'BIN-GUARD-WEBAPP.json'), '{}');
    fs.writeFileSync(path.join(d, 'other.json'), '{}');
    const r = run(d, '--counts');
    fs.rmSync(d, { recursive: true, force: true });
    if (RED) { expect(r.status).toBe(0); return; }
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/Checked 3 file\(s\); 3 with a problem; 1 not on the list/);
    expect(r.stdout).toMatch(/RENAMED 1/);
    expect(r.stdout).toMatch(/WRONG_TYPE 1/);
    expect(r.stdout).toMatch(/EMPTY 1/);
    expect(r.stdout).not.toMatch(/tasks|marked_files|af-state|DROPBOX/); // counts only
  });

  test('a folder with none of the three files fails rather than passing silently', () => {
    const d = tmp();
    const r = run(d, '--counts');
    fs.rmSync(d, { recursive: true, force: true });
    if (RED) { expect(r.status).toBe(0); return; }
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/Checked 0 file\(s\)/);
  });
});
