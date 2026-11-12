// Shared by the dog-photo crop specs (mocked and phone). Invented dogs only; the save script is pretend.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { expect } = require('@playwright/test');
const { HUBS } = require('./hubs');

const SINK = 'https://script.google.com/macros/s/PRETENDSCRIPT/exec';
const csv = (h, rows) => [h].concat(rows).join('\r\n') + '\r\n';

function put(world, name, content) {
  const f = world.files.find((x) => x.name === name && !x.trashed);
  if (f) { f.content = content; f.size = String(content.length); return; }
  const like = world.files.find((x) => x.name === 'BLD-area.csv' && !x.trashed);
  world.file('fx-' + name, name, content, { parents: like.parents, driveId: like.driveId, mimeType: like.mimeType });
}

/** One invented dog with no photo, the Dogs page open on it, and the pretend save script switched on. */
async function openOneDog(page, guard) {
  const w = guard.world;
  put(w, 'BLD-subject.csv', csv('id,tenant_id,name,sex,dob,kind,neuter_status,photo', ['sub-x2,t,Pretend Two,Male,2022-01-01,Stud,entire,']));
  put(w, 'BLD-subject_status.csv', csv('id,tenant_id,subject_id,state', ['s2,t,sub-x2,Active']));
  w.file('drv-photo-new', 'new.png', '', { mimeType: 'image/png' });
  w.byId('drv-photo-new').thumbnailLink = 'https://example.com/pretend-dog-new.png';
  await HUBS.cdhub.open(page, guard);
  await page.evaluate((url) => { localStorage.setItem('cdhub.sink.url', url); localStorage.setItem('cdhub.sink.code', 'pretend-code'); }, SINK);
  await page.evaluate(() => go('dogs'));
  await expect(page.locator('#rows article.dc')).toHaveCount(1);
}

/** Pretend save script: records every request body, answers "saved". */
async function recordSaves(page) {
  const bodies = [];
  await page.route(SINK, async (route) => {
    bodies.push(JSON.parse(route.request().postData() || '{}'));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result: { status: 'saved', subject_id: 'sub-x2', file_id: 'drv-photo-new' } }) });
  });
  return bodies;
}

/** A big, busy, landscape JPEG made in the browser (gradient + noise), written to a temp file. Several MB on purpose. */
async function bigPhoto(page, w = 3000, h = 2000) {
  const b64 = await page.evaluate(([w, h]) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#c33'); gr.addColorStop(0.5, '#3c3'); gr.addColorStop(1, '#33c');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const im = g.getImageData(0, 0, w, h), d = im.data;
    let s = 12345; for (let i = 0; i < d.length; i += 4) { s = (s * 1103515245 + 12345) & 0x7fffffff; const n = (s % 120) - 60; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(im, 0, 0);
    const u = c.toDataURL('image/jpeg', 0.95); return u.slice(u.indexOf(',') + 1);
  }, [w, h]);
  const file = path.join(os.tmpdir(), `pretend-big-photo-${w}x${h}.jpg`);
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  return { file, b64len: b64.length };
}

/** Width and height of a base64 JPEG, read in the page. */
async function jpegSize(page, b64) {
  return page.evaluate((b) => new Promise((res) => { const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.onerror = () => res([0, 0]); i.src = 'data:image/jpeg;base64,' + b; }), b64);
}

module.exports = { SINK, csv, put, openOneDog, recordSaves, bigPhoto, jpegSize };
