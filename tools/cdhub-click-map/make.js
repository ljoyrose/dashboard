#!/usr/bin/env node
// SCRIPT. Writes docs/cdhub/CLICK-MAP.md from the click-crawl's own results. Nothing in the map is typed by hand.
//
//   npx playwright test --project=mocked cdhub-crawl     the crawl writes test-results/cdhub-crawl/*.json
//   node tools/cdhub-click-map/make.js                   this turns them into the map
//
// The crawl runs on the invented 27-animal set only (Dog A01..A20, Pup P01..P07, Room 1..8), so the map is safe to
// publish: every name in it is made up. Copies of one control (one per dog, one per room, one per day) are folded
// into one row with a count.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const IN = path.join(ROOT, 'test-results', 'cdhub-crawl');
const OUT = path.join(ROOT, 'docs', 'cdhub', 'CLICK-MAP.md');
const SITES = [['hub', 'CD Hub (cdhub/)'], ['temperatures', 'Temperatures page (cdhub/history.html)'], ['staff', 'Staff page (cdhub/staff/)']];
const FLAGS = ['LOOP', 'DEAD', 'ERROR', 'ESCAPE', 'WORDING'];

const one = (name) => { const p = path.join(IN, name + '.json'); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; };
/** One result per place and screen size. A walk done in parts (hub-desktop-0 .. hub-desktop-24, one per start screen) is added
 *  together. Two walks can meet the same screen (Main's walk and Today's walk both open a Today list): it is counted once. */
const read = (name) => {
  const parts = [one(name)].concat(Array.from({ length: 25 }, (_, n) => one(name + '-' + n))).filter(Boolean);
  if (!parts.length) return null;
  const sum = (k) => parts.reduce((a, r) => a + (r[k] || 0), 0);
  const seen = new Map();   // screen -> its counts, from the first walk that met it
  let loose = { reachable: 0, tapped: 0 };
  parts.forEach((r) => {
    if (!r.screens) { loose.reachable += r.reachable || 0; loose.tapped += r.tapped || 0; return; }   // an older result file: no per-screen counts
    r.screens.forEach((x) => { if (!seen.has(x.screen)) seen.set(x.screen, x); });
  });
  const per = Array.from(seen.values());
  const first = new Set();
  const rows = [].concat(...parts.map((r) => { const mine = new Set(r.rows.map((x) => x.screen).filter((sc) => !first.has(sc))); const out = r.rows.filter((x) => mine.has(x.screen)); mine.forEach((sc) => first.add(sc)); return out; }));
  return { rows, findings: [].concat(...parts.map((r) => r.findings)), tapped: loose.tapped + per.reduce((a, x) => a + x.tapped, 0), reachable: loose.reachable + per.reduce((a, x) => a + x.reachable, 0),
    states: new Set(rows.map((x) => x.screen).filter((sc) => !/\(old address\)$/.test(sc))).size, sampledLeft: sum('sampledLeft') };
};
/** One pattern for every copy: Dog A07 -> Dog A.., Room 3 -> Room N, 12/02/26 -> a date, 14.5 -> a number. */
const fold = (s) => String(s == null ? '' : s)
  .replace(/\b(Dog A|Pup P)\d\d\b/g, '$1..').replace(/\b(Room|Field) \d\b/g, '$1 N').replace(/\bsub-[ap]\d\d\b/g, 'sub-..').replace(/\bar-\d\b/g, 'ar-N')
  .replace(/\b\d{1,2}\/\d{1,2}\/\d{2}\b/g, 'DD/MM/YY').replace(/\b\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}\b/g, 'D Mon YYYY')
  .replace(/\b\d{15}\b/g, '(chip)').replace(/\d+(\.\d+)?/g, '#').replace(/\s+/g, ' ').trim();
const cell = (s, n) => { s = fold(s).replace(/\|/g, '/').replace(/[<>]/g, ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const WHAT = { link: 'link', button: 'button', fold: 'fold', select: 'list', row: 'row or card', tab: 'tab', '': '' };
const what = (k) => (WHAT[k] !== undefined ? WHAT[k] : /^input:/.test(k) ? 'box (' + k.slice(6) + ')' : k);

function rowsOf(r) {
  const out = new Map();
  (r ? r.rows : []).forEach((x) => {
    const k = [cell(x.screen, 70), cell(x.control, 60), what(x.kind || ''), cell(x.target, 60), cell(x.result, 70)].join(' | ');
    out.set(k, (out.get(k) || 0) + 1);
  });
  return out;
}
const count = (r, t) => (r ? r.findings.filter((f) => f.type === t).length : 0);
const line = (r) => (r ? `visited ${r.tapped} of ${r.reachable} controls (${(100 * r.tapped / Math.max(1, r.reachable)).toFixed(1)}%) on ${r.states} screens`
  + (r.sampledLeft ? `, plus ${r.sampledLeft} repeated calendar days sampled` : '') + ' · ' + FLAGS.map((t) => t + ' ' + count(r, t)).join(' · ') : 'no result file');

let md = '# CD Hub click map\n\n'
  + 'Every button, link and tap the click-crawl found, where each one goes and what it does. '
  + '**Made by a script from the crawl\'s own results; nothing here is typed by hand.**\n\n'
  + '- Data: the invented 27-animal set (`tests/fixtures/cdhub-27`): Dog A.., Pup P.., Room N. No real name, id or date. The day is 10 Mar 2026.\n'
  + '- Remake it: `npx playwright test --project=mocked cdhub-crawl` then `node tools/cdhub-click-map/make.js`.\n'
  + '- Copies of one control (one per dog, room or day) are one row with a count. `#` stands for a number.\n'
  + '- A screen that is switched off (Assocs, Table map, Litters, Vet link) is named but not walked.\n\n'
  + '## Totals\n\n| Where | Screen size | Result |\n|---|---|---|\n';
const all = {};
SITES.forEach(([key, title]) => ['desktop', 'phone'].forEach((v) => { const r = read(key + '-' + v); all[key + '-' + v] = r; md += `| ${title} | ${v === 'phone' ? 'phone, 360px' : 'desktop, 1280px'} | ${line(r)} |\n`; }));
md += '\nLOOP = goes round to the same screen. DEAD = nothing happens. ERROR = the browser logged an error. ESCAPE = left our pages. WORDING = raw or empty words.\n';

SITES.forEach(([key, title]) => {
  const d = all[key + '-desktop'], p = all[key + '-phone'];
  if (!d && !p) return;
  md += `\n## ${title}\n\n`;
  const dm = rowsOf(d), pm = rowsOf(p);
  md += '| Screen | Control | What it is | Goes to | What happens | Copies |\n|---|---|---|---|---|---|\n';
  Array.from(dm.entries()).forEach(([k, n]) => { md += '| ' + k + ' | ' + n + ' |\n'; });
  const only = Array.from(pm.entries()).filter(([k]) => !dm.has(k));
  if (only.length) {
    md += `\n### ${title}: on the phone only (or different on the phone)\n\n| Screen | Control | What it is | Goes to | What happens | Copies |\n|---|---|---|---|---|---|\n`;
    only.forEach(([k, n]) => { md += '| ' + k + ' | ' + n + ' |\n'; });
  }
  const f = [].concat(d ? d.findings.map((x) => ['desktop', x]) : [], p ? p.findings.map((x) => ['phone', x]) : []);
  if (f.length) { md += '\n### Problems found\n\n'; f.forEach(([v, x]) => { md += `- ${x.type} (${v}) · ${cell(x.screen, 70)} · ${cell(x.control, 60)} · ${cell(x.detail, 140)}\n`; }); }
});

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, md);
const n = md.split('\n').filter((l) => /^\| /.test(l)).length;
console.log('wrote ' + path.relative(ROOT, OUT) + ' (' + n + ' table rows)');
