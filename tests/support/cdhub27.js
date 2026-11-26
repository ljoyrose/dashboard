const fs = require('fs');
const path = require('path');
const { IDS } = require('./world');

const DIR = path.join(__dirname, '..', 'fixtures', 'cdhub-27');
const TODAY = '2026-03-10';
const NOW = new Date(TODAY + 'T09:30:00Z');
const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';   // a made-up save address
const CODE = 'FAKE-CODE-27';
const SAVE_ONLY = ['occupancy_out', 'sensor_reading'];
const names = () => fs.readdirSync(DIR).filter((f) => /^BLD-.*\.csv$/.test(f)).sort();
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');

function install(world, { skip = [] } = {}) {
  world.files = world.files.filter((f) => !(f.parents || []).includes(IDS.bld));
  names().filter((f) => !skip.includes(f)).forEach((f, i) => world.file('bld27-' + i, f, read(f), { parents: [IDS.bld], driveId: 'drv-alpha1' }));
  return world;
}

function rows(f) {
  const lines = read(f).replace(/\n$/, '').split('\n');
  const split = (l) => { const out = []; let cur = '', q = false;
    for (let i = 0; i < l.length; i++) { const c = l[i];
      if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c; }
    out.push(cur); return out; };
  const head = split(lines[0]);
  return lines.slice(1).map((l) => { const v = split(l), o = {}; head.forEach((h, i) => { o[h] = v[i] == null ? '' : v[i]; }); return o; });
}
function tables() {
  const t = {};
  names().forEach((f) => { t[f.replace(/^BLD-|\.csv$/g, '')] = rows(f); });
  ['capacity_setting', 'qr_tag'].forEach((k) => { if (!t[k]) t[k] = []; });
  return t;
}

async function staffScript(page, { role = 'USER' } = {}) {
  const t = tables(), sent = [], mode = { save: 'ok' };
  const CORS = { 'access-control-allow-origin': '*' };
  await page.route(SCRIPT, (route) => {
    const req = route.request();
    if (req.method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: Object.keys(t).concat(SAVE_ONLY).map((k) => ({ key: k, on: true, mode: 'direct' })) } });
    const b = JSON.parse(req.postData() || '{}');
    if (String(b.action).indexOf('read') === 0) {
      if (b.table && !t[b.table]) return route.fulfill({ headers: CORS, json: { ok: false, code: 'NOT_ALLOWED', message: 'off' } });
      return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: t[b.table] || [], tables: t, role } } });
    }
    sent.push(b);
    if (mode.save === 'offline') return route.abort('failed');
    if (mode.save === 'fail') return route.fulfill({ status: 500, headers: CORS, body: 'Sample failure' });
    if (mode.save === 'refused') return route.fulfill({ headers: CORS, json: { ok: false, code: 'INVALID', message: 'Check the entry.', fields: {} } });
    const id = 'new-' + sent.length;
    if (b.table && t[b.table] && b.fields) t[b.table].push(Object.assign({ id }, b.fields));
    return route.fulfill({ headers: CORS, json: { ok: true, result: { status: 'saved', id, at: NOW.toISOString() } } });
  });
  await page.addInitScript(([c, u]) => { try { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); } catch (e) { /* private mode */ } }, [CODE, SCRIPT]);
  return { sent, tables: t, mode };
}

module.exports = { DIR, TODAY, NOW, SCRIPT, CODE, names, read, rows, tables, install, staffScript };

