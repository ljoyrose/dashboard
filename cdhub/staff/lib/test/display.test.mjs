import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { BLDDisplay } = createRequire(import.meta.url)('../display.js');

const H = BLDDisplay.hideSource;

assert.equal(H('Whelping/housing with free access (needs remeasure)'), 'Whelping/housing with free access');
assert.equal(H('(Cabin List 2026, Lisa 11 Nov 2026)'), '');
assert.equal(H('Cabin List 2026 internal capacity, Lisa 11 Nov 2026'), '');
assert.equal(H('Whelping/housing with free access'), 'Whelping/housing with free access');
assert.equal(H(''), '');
assert.equal(H(null), '');
// leftover source should not survive
['needs remeasure', 'Cabin List 2026', 'internal capacity', 'Lisa 11 Nov 2026'].forEach(function (p) {
  const out = H('Room use (' + p + ')');
  assert.equal(out.includes(p), false, p + ' remained in ' + out);
});
console.log('display.hideSource ok');
