// JOB 34 Stage 1: every JOB 34 fixture is obviously invented (public repo). Reads files only; opens no page.
const fs = require('fs');
const path = require('path');
const { test, expect, fixture } = require('../fixtures/job34/load');

const ROOT = path.join(__dirname, '..', 'fixtures', 'job34');
const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));

test.describe('JOB 34 fixtures are invented', () => {
  test('the loader reads a fixture and exposes the shared helpers', async () => {
    const lib = require('../fixtures/job34/load');
    expect(fixture('common', 'people.json').apps).toEqual(['APP-A', 'APP-B', 'APP-C']);
    for (const k of ['HUBS', 'go', 'sheets', 'slow', 'fail', 'sideScroll', 'tabWalk']) expect(lib[k], k).toBeTruthy();
  });

  test('emails are @example.test only, phones are Ofcom drama numbers only, no Drive or Docs links', async () => {
    const bad = [];
    for (const f of files(ROOT)) {
      const t = fs.readFileSync(f, 'utf8');
      const rel = path.relative(ROOT, f);
      for (const m of t.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) || []) if (!/@example\.test$/.test(m)) bad.push(rel + ': email');
      for (const m of t.match(/(\+44\s?|\b0)\d{2,4}[\s-]?\d{3}[\s-]?\d{3,4}\b/g) || []) if (!/^(01632\s?960|07700\s?900)/.test(m.replace(/^\+44\s?/, '0'))) bad.push(rel + ': phone');
      if (/(docs|drive)\.google\.com/.test(t)) bad.push(rel + ': google link');
    }
    expect(bad).toEqual([]);
  });
});
