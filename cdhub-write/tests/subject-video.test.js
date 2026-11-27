'use strict';
// Dog videos (25 Nov 2026): RoseQuest share links only. A change is a new row. Invented dogs only.
const { test } = require('node:test');
const assert = require('node:assert');
const { standardEnv } = require('./harness');

const H = 'id,subject_id,video_url,title,is_main,created_at,corrects_id,active';
const LINK = 'https://share.puppyclassroom.com/v/clip';
let n = 0;

function env(props) {
  const e = standardEnv({ props: Object.assign({ TABLE_ON_subject_video: 'true' }, props || {}) });
  const subj = e.file('BLD-subject.csv');
  const text = 'id,tenant_id,name\r\nsub-test-a,' + e.props.TENANT_ID + ',Test A\r\n';
  if (subj.length) { subj[0].content = text; subj[0].sheet = undefined; } else e.addFile('BLD-subject.csv', text);
  e.addFile('BLD-subject_video.csv', H + '\r\n');
  return e;
}
function post(e, fields, code) {
  n += 1;
  const body = { v: 1, request_id: 'req-video-' + String(n).padStart(4, '0'), code: code || e.codes.staff, action: 'subject_video', fields };
  return JSON.parse(e.ctx.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
}
const lines = (e) => e.file('BLD-subject_video.csv')[0].content.trim().split(/\r?\n/);

test('subject_video: off until its switch is on; only a RoseQuest share link; the first clip is the main one', () => {
  const off = env({ TABLE_ON_subject_video: '' });
  assert.equal(post(off, { subject_id: 'sub-test-a', video_url: LINK + '1' }).code, 'TABLE_OFF');
  const e = env();
  assert.equal(post(e, { subject_id: 'sub-test-a', video_url: 'https://drive.google.com/file/d/abc/view' }).code, 'INVALID');
  assert.equal(post(e, { subject_id: 'sub-test-a', video_url: 'https://share.puppyclassroom.com/gallery/abc' }).code, 'INVALID');
  assert.equal(lines(e).length, 1);
  const r = post(e, { subject_id: 'sub-test-a', video_url: LINK + '1', title: 'First clip' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.match(lines(e)[1], new RegExp('^svd[^,]*,sub-test-a,' + LINK.replace(/[.]/g, '\\.') + '1,First clip,yes,'));
  const second = post(e, { subject_id: 'sub-test-a', video_url: LINK + '2', title: 'Second' });
  assert.equal(second.ok, true, JSON.stringify(second));
  assert.match(lines(e)[2], /,Second,,/);
  assert.equal(post(e, { subject_id: 'sub-test-a', video_url: LINK + '1' }).code, 'DUPLICATE');
  assert.equal(lines(e).length, 3);
});

test('subject_video: remove and make main add a new row and leave the old row unchanged @regression', () => {
  const e = env();
  const a = post(e, { subject_id: 'sub-test-a', video_url: LINK + 'a', title: 'Main' }).result;
  const b = post(e, { subject_id: 'sub-test-a', video_url: LINK + 'b', title: 'Other' }).result;
  const before = lines(e).slice();
  assert.ok(b.rows && b.rows[0] && b.rows[0].id, JSON.stringify(b));
  const main = post(e, { subject_id: 'sub-test-a', corrects_id: b.rows[0].id, is_main: 'yes' });
  assert.equal(main.ok, true, JSON.stringify(main));
  assert.ok(lines(e).length > before.length);
  assert.ok(lines(e).slice(0, before.length).join('\n') === before.join('\n'));
  const kept = lines(e).filter((l) => l.indexOf(LINK + 'a') >= 0);
  assert.ok(kept.some((l) => /,yes,/.test(l) && l.indexOf(a.rows[0].id + ',') === 0));
  const newer = (main.result.rows || []).filter((r) => r.corrects_id === b.rows[0].id)[0];
  assert.ok(newer && newer.id);
  const removed = post(e, { subject_id: 'sub-test-a', corrects_id: newer.id, active: 'no' });
  assert.equal(removed.ok, true, JSON.stringify(removed));
  assert.equal(post(e, { subject_id: 'sub-test-a', corrects_id: b.rows[0].id, active: 'no' }).ok, false);
  assert.equal(post(e, { subject_id: 'sub-nobody', video_url: LINK + 'z' }).code, 'NOT_FOUND');
});
