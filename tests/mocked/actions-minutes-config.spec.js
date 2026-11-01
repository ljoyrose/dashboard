// Actions minutes card settings (JOB 46, 30 Oct 2026). config.js holds only the Drive folder, the file name, the free
// allowance, the amber/red lines and short labels: never a token, never a real repo name.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, expect } = require('../support/test');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8');
const load = () => { const w = {}; vm.runInNewContext(SRC, { window: w }); return w.DASH_CONFIG; };

test.describe('Actions minutes settings', () => {
  test('config.js has the actionsMinutes block with the agreed defaults', () => {
    const a = load().actionsMinutes;
    expect(a).toBeTruthy();
    expect(typeof a.folderId).toBe('string');
    expect(a.fileName).toBe('ACTIONS-MINUTES.json');
    expect(a.freeMinutes).toBe(2000);
    expect(a.amber).toBe(0.75);
    expect(a.red).toBe(0.9);
    expect(a.staleDays).toBe(2);
    expect(Array.isArray(a.repoLabels)).toBe(true);
    expect(a.usageUrl).toMatch(/^https:\/\/github\.com\/settings\/billing/);
  });

  test('the block holds no token and no owner/repo name', () => {
    const block = SRC.slice(SRC.indexOf('actionsMinutes:'), SRC.indexOf('marketplace: {'));
    expect(block).not.toMatch(/gh[pousr]_|github_pat_|token\s*:/i);
    expect(block).not.toMatch(/ljoyrose\//);
    load().actionsMinutes.repoLabels.forEach((l) => expect(l.length).toBeLessThanOrEqual(20));
  });
});
