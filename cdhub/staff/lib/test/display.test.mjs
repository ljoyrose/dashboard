import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { BLDDisplay } = createRequire(import.meta.url)('../display.js');

const H = BLDDisplay.hideSource;

assert.equal(H('Whelping/housing with free access (needs remeasure)'), 'Whelping/housing with free access');
assert.equal(H('(Cabin List 2026, User 11 Nov 2026)'), '');
assert.equal(H('Cabin List 2026 internal capacity, User 11 Nov 2026'), '');
assert.equal(H('Whelping/housing with free access'), 'Whelping/housing with free access');
assert.equal(H(''), '');
assert.equal(H(null), '');
const short = BLDDisplay.marblePupName;
assert.equal(short('Blue merle marble', ''), 'z-b-merle');
assert.equal(short('Marble pup', 'Blue merle'), 'z-b-merle');
assert.equal(short('Red merle 2', ''), 'z-r-merle-2');
assert.equal(short('z-b-merle', ''), 'z-b-merle');
assert.equal(short('Nell', 'solid'), '');
// leftover source should not survive
['needs remeasure', 'Cabin List 2026', 'internal capacity', 'User 11 Nov 2026'].forEach(function (p) {
  const out = H('Room use (' + p + ')');
  assert.equal(out.includes(p), false, p + ' remained in ' + out);
});

