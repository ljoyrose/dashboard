// node --test cdhub/staff/modules/temperature/test/
// the owner, 16 Nov 2026: photos are kept with a reading ONLY while the owner's dated rule row job.temps_keep_photo = yes
// is in force. Off by default. module.js itself still makes, keeps and sends no picture (no-image.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const E = require('../evidence.js');
const here = (f) => new URL('../' + f, import.meta.url);
const code = (f) => readFileSync(here(f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const row = (value, from, to) => ({ rule_key: 'job.temps_keep_photo', value, effective_from: from, to_date: to || '' });

test('off with no rows, a blank value, or any value but yes', () => {
  assert.equal(E.on([], '2026-11-16'), false);
  assert.equal(E.on(null, '2026-11-16'), false);
  assert.equal(E.on([row('', '2026-11-01')], '2026-11-16'), false);
  assert.equal(E.on([row('no', '2026-11-01')], '2026-11-16'), false);
  assert.equal(E.on([row('true', '2026-11-01')], '2026-11-16'), false);
});

test('on only between effective_from and to_date (both days included)', () => {
  const rules = [row('yes', '2026-11-20', '2026-11-22')];
  assert.equal(E.on(rules, '2026-11-19'), false);
  assert.equal(E.on(rules, '2026-11-20'), true);
  assert.equal(E.on(rules, '2026-11-22'), true);
  assert.equal(E.on(rules, '2026-11-23'), false);
});

test('a row with no effective_from never counts', () => {
  assert.equal(E.on([row('yes', '')], '2026-11-16'), false);
});

test('latest effective_from wins: a later "no" row switches it off', () => {
  const rules = [row('yes', '2026-11-01'), row('no', '2026-11-10')];
  assert.equal(E.on(rules, '2026-11-05'), true);
  assert.equal(E.on(rules, '2026-11-12'), false);
});

test('other rule keys are ignored', () => {
  assert.equal(E.on([{ rule_key: 'job.paper_back_days', value: 'yes', effective_from: '2026-01-01' }], '2026-11-16'), false);
  assert.equal(E.mentioned([{ rule_key: 'job.paper_back_days' }]), false);
  assert.equal(E.mentioned([row('no', '2026-01-01')]), true);
});

test('module.js loads evidence.js only behind the setting, and never for guests or queued readings', () => {
  const src = code('module.js');
  assert.match(src, /keepRule\(o\.rules\)/);
  assert.match(src, /E\.on\(o\.rules, slot\.date\)/);
  assert.match(src, /r\.status !== 'queued'/);
  assert.match(src, /rules: o\.guest \? \[\] : o\.rules/);
});

test('evidence.js sends only through the save script (file_add, then link_add) and stores nothing on the phone', () => {
  const src = code('evidence.js');
  for (const [re, why] of [
    [/fetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|navigator\.share/, 'sends something itself'],
    [/localStorage|indexedDB|caches\.|sessionStorage/, 'stores data in the browser'],
    [/download\s*[:=]|\.download\b|createObjectURL/, 'saves a file to the phone'],
    [/capture\s*[:=]|['"]capture['"]/, 'opens the camera app (photo would land in the camera roll)']
  ]) assert.equal(re.test(src), false, `evidence.js ${why}: ${src.match(re)?.[0]}`);
  assert.match(src, /act\('file_add'/);
  assert.match(src, /linkAdd\(\{ from_table: 'area_reading'/);
  assert.match(src, /role: 'evidence'/);
});
