// node --test cdhub/staff/modules/temperature/test/
// The reader on drawn screens: every reading right, or "not read" (never a wrong number).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { screen } from './synth.mjs';
const R = createRequire(import.meta.url)('../reader.js');
// drawn screens: all digits one size with a decimal point, MAX top right, MIN bottom right
const SYNTH = { tenths: 'any', max: { x: 0.48, y: 0.04, w: 0.5, h: 0.44 }, min: { x: 0.48, y: 0.52, w: 0.5, h: 0.44 } };

const PAIRS = [['21.4', '14.2'], ['19.8', '9.6'], ['28.0', '26.3'], ['30.7', '11.1'], ['17.5', '5.9'], ['24.6', '18.3'], ['12.0', '-2.4'], ['26.9', '23.7'], ['11.1', '10.0'], ['35.2', '0.8']];

test('drawn screens: each read right or "not read", never a wrong number; most are read', () => {
  let read = 0;
  PAIRS.forEach(([max, min], i) => {
    const s = screen({ max, min, seed: i + 1, slant: [0, 0.08, 0.15, 0.22][i % 4] });
    const r = R.readDisplay(s.g, s.W, s.H, SYNTH);
    if (r.max.ok) assert.equal(r.max.value, (+max).toFixed(1), `MAX of ${max}/${min}`);
    if (r.min.ok) assert.equal(r.min.value, (+min).toFixed(1), `MIN of ${max}/${min}`);
    if (r.ok) read++;
  });
  assert.ok(read >= 8, `only ${read} of ${PAIRS.length} read`);
});

test('light digits on a dark screen', () => {
  const s = screen({ max: '22.3', min: '15.8', invert: true, seed: 7 });
  const r = R.readDisplay(s.g, s.W, s.H, SYNTH);
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.max.value, '22.3'); assert.equal(r.min.value, '15.8');
});

test('never a wrong number: blur, blank, or a broken screen are "not read"', () => {
  const blank = screen({ max: '', min: '', seed: 3 });
  assert.equal(R.readDisplay(blank.g, blank.W, blank.H, SYNTH).ok, false);
  const flat = { g: new Uint8Array(400 * 300).fill(128), W: 400, H: 300 };
  assert.equal(R.readDisplay(flat.g, flat.W, flat.H, SYNTH).ok, false);
  const noisy = screen({ max: '21.4', min: '14.2', noise: 140, seed: 9 });
  const r = R.readDisplay(noisy.g, noisy.W, noisy.H, SYNTH);
  if (r.ok) { assert.equal(r.max.value, '21.4'); assert.equal(r.min.value, '14.2'); }
  const lo = screen({ max: '--.-', min: '--.-', seed: 4 });
  assert.equal(R.readDisplay(lo.g, lo.W, lo.H, SYNTH).ok, false);
});

test('steady: a pair counts only after 3 frames agree', () => {
  const st = R.Steady(3), ok = { ok: true, max: { value: '21.4' }, min: { value: '14.2' } };
  assert.equal(st.feed(ok), null); assert.equal(st.feed(ok), null);
  assert.deepEqual(st.feed(ok), { max: '21.4', min: '14.2' });
  assert.equal(st.feed({ ok: false }), null); assert.equal(st.feed(ok), null);
});
