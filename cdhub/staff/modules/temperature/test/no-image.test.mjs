// node --test cdhub/staff/modules/temperature/test/
// Lisa, 8 Nov 2026: no picture is ever saved, uploaded or kept, and nothing goes to the staff member's phone.
// These checks fail if the module ever gains a way to make, keep or send a picture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const here = (f) => new URL('../' + f, import.meta.url);
const code = (f) => readFileSync(here(f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const FORBIDDEN = [
  [/toDataURL|toBlob|convertToBlob/, 'turns a frame into a picture file'],
  [/createObjectURL|new\s+Blob|new\s+File\b|FormData/, 'makes a file or upload'],
  [/takePhoto|grabFrame|ImageCapture|MediaRecorder/, 'takes a photo or recording'],
  [/capture\s*[:=]|['"]capture['"]/, 'opens the phone camera app (capture attribute)'],
  [/accept\s*:\s*['"][^'"]*image/, 'lets a picture be chosen'],
  [/indexedDB|caches\.|sessionStorage\.setItem/, 'stores data in the browser'],
  [/fetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|navigator\.share/, 'sends something itself (only save.submit may send)'],
  [/download\s*[:=]|\.download\b/, 'saves a file to the phone']
];

for (const f of ['module.js', 'reader.js']) {
  test(`${f}: no way to make, keep or send a picture`, () => {
    const src = code(f);
    for (const [re, why] of FORBIDDEN) assert.equal(re.test(src), false, `${f} ${why}: ${src.match(re)?.[0]}`);
  });
}

test('module.js: the only localStorage use is reading the scanned room', () => {
  const src = code('module.js');
  const uses = src.match(/localStorage\.\w+/g) || [];
  assert.deepEqual([...new Set(uses)], ['localStorage.getItem']);
});

test('module.js: the camera is opened for video only, and every frame is blanked after reading', () => {
  const src = code('module.js');
  assert.match(src, /getUserMedia\(\{\s*audio:\s*false/);
  assert.match(src, /cx\.clearRect\(0, 0, W, H\)/);
  assert.match(src, /canvas\.width = 0; canvas\.height = 0;/);
  assert.match(src, /getTracks\(\)\.forEach\(function \(t\) \{ t\.stop\(\); \}\)/);
});

test('reader.js returns numbers as text and nothing else', () => {
  const R = createRequire(import.meta.url)('../reader.js');
  const g = new Uint8Array(200 * 100).fill(200);
  const r = R.readDisplay(g, 200, 100);
  const flat = JSON.stringify(r);
  assert.ok(flat.length < 2000, 'result carries no pixel data');
  assert.equal(/"(g|b|px|grid|data)":/.test(flat), false);
});
