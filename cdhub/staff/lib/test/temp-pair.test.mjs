// One temperature-pair rule. Run: node --test cdhub/staff/lib/test/temp-pair.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../..');
const pair = require(path.join(root, 'cdhub/staff/lib/temp-pair.js'));
const MSG = 'The lowest reading cannot be higher than the highest reading.';

test('the shared check matches the save-script words and refuses only lowest above highest', () => {
  assert.equal(pair.message, MSG);
  assert.equal(pair.error('22.0', '18.0'), MSG);
  assert.equal(pair.error('18.0', '22.0'), '');
  assert.equal(pair.error('18.0', '18.0'), '');
  assert.equal(pair.error('', '18.0'), '');
  assert.equal(pair.error('22', ''), '');
  assert.equal(pair.swapped(' 22 ', '18'), true);
  const spec = fs.readFileSync(path.join(root, 'cdhub-write/apps-script/Specs.gs'), 'utf8');
  assert.match(spec, /function tempPairError_\(min, max\)/);
  assert.equal((spec.match(new RegExp(MSG.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 1);
  const page = fs.readFileSync(path.join(root, 'cdhub-write/apps-script/ApprovePage.html'), 'utf8');
  const start = page.indexOf('var lo=parseFloat(f.min_c)');
  const guard = page.slice(start, page.indexOf('google.script.run', start));
  assert.ok(start > 0);
  assert.match(guard, new RegExp(MSG.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(guard, /return;/);
  for (const rel of ['cdhub/staff/lib/bld-save.js', 'cdhub-write/client/bld-save.js']) {
    const src = fs.readFileSync(path.join(root, rel), 'utf8');
    assert.match(src, /pairError\(fields\.min_c, fields\.max_c\)/);
    assert.doesNotMatch(src, /The lowest cannot be higher than the highest\./);
  }
});
