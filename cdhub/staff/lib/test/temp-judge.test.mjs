// node --test cdhub/staff/lib/test/
// Temps A (Lisa 17 Nov 2026): the room on the adult row (over its max = cooling action, never outside); puppies under
// four weeks: the bed spot on their own row; no bed spot = "not recorded", never outside.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const J = createRequire(import.meta.url)('../temp-judge.js');
const adult = { min: 10, max: 26 }, pup = { min: 26, max: 28 };

test('adult room: below the minimum is outside; over the maximum is cooling action, not outside', () => {
  assert.equal(J.judge({ min: '12.0', max: '20.0' }, adult, adult, false), 'ok');
  assert.equal(J.judge({ min: '9.9', max: '20.0' }, adult, adult, false), 'cold');
  assert.equal(J.judge({ min: '15.0', max: '27.5' }, adult, adult, false), 'warm');
  assert.equal(J.isBreach('cold'), true);
  assert.equal(J.isBreach('warm'), false);
});

test('puppy room: the room on the adult row, the bed spot on the puppy row', () => {
  assert.equal(J.judge({ min: '16.0', max: '21.0' }, pup, adult, true), 'nospot');            // H5/6 in October
  assert.equal(J.judge({ min: '16.0', max: '21.0', spot: '27.0' }, pup, adult, true), 'ok');
  assert.equal(J.judge({ min: '16.0', max: '21.0', spot: '24.5' }, pup, adult, true), 'spotcold');
  assert.equal(J.judge({ min: '16.0', max: '21.0', spot: '29.0' }, pup, adult, true), 'spothot');
  assert.equal(J.judge({ min: '8.0', max: '21.0', spot: '27.0' }, pup, adult, true), 'cold');  // the room itself too cold
  assert.equal(J.judge({ min: '18.0', max: '27.0', spot: '27.0' }, pup, adult, true), 'warm');
  assert.equal(J.isBreach('nospot'), false);
  assert.equal(J.words('nospot'), '');   // Lisa 18 Nov 2026: no "bed spot not recorded" words anywhere
  assert.equal(J.isBreach('spotcold'), true);
});

test('no rows at all is unknown; a room-specific row with different numbers is not mistaken for a puppy row', () => {
  assert.equal(J.judge({ min: '12', max: '15' }, null, null, false), 'unknown');
  assert.equal(J.judge({ min: '24.1', max: '25.3' }, { min: 10, max: 30 }, adult, false), 'ok');
});
