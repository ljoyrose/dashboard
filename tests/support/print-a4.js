// Print preview checks for the CD Hub (13 Nov 2026): the round sheet, the Dogs page and the kennel cards on A4.
// Shared by tests/mocked/cdhub-print-a4.spec.js (desktop) and tests/phone/cdhub-print-a4.spec.js (phone).
// Every row is invented. The save script is pretend. Chrome's own PDF output is the print preview: the page count
// proves no card was split and no row was pushed to a page of its own.
// CDHUB_PRINT_PDF=<folder> also keeps each PDF there, to open and check by eye.
const fs = require('fs');
const path = require('path');
const { expect } = require('@playwright/test');

const OUT = process.env.CDHUB_PRINT_PDF || '';
const SCRIPT = 'https://script.google.com/macros/s/FAKE-PRINT-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };
const csv = (h, rows) => [h].concat(rows).join('\r\n') + '\r\n';
// A4 printable area at the 10 mm margin the pages ask for, in CSS pixels (96 per inch).
const MM = 96 / 25.4;
const PAPER = { portrait: { width: Math.round(190 * MM), height: Math.round(277 * MM) } };

/** Pages and their sizes (points) in a PDF Chrome made. */
function pdfPages(buf) {
  const s = buf.toString('latin1');
  const boxes = [...s.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map((m) => [Math.round(+m[1]), Math.round(+m[2])]);
  const count = (s.match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
  return { count, boxes };
}
const A4 = [596, 842];
function isA4(box, landscape) { const [w, h] = landscape ? [A4[1], A4[0]] : A4; return Math.abs(box[0] - w) <= 2 && Math.abs(box[1] - h) <= 2; }

/** Chrome's print output as a PDF (what Print and Save as PDF both use), kept when CDHUB_PRINT_PDF is set. */
async function printPdf(page, name) {
  // Print and Save as PDF fire beforeprint and afterprint; page.pdf() does not, so they are fired here as a browser would.
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.emulateMedia({ media: 'print' });
  const buf = await page.pdf({ preferCSSPageSize: true, printBackground: false });   // Chrome's default: background graphics off
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  if (OUT) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, name + '.pdf'), buf); }
  return pdfPages(buf);
}

/* ------------------------------------------------------------------ the hub: 16 cabins, 32 dogs, long names, 4 photos */
const ROOMS = 16, DOGS = 32;
const dogName = (i) => (i % 5 === 0 ? 'Pretend Bartholomew-Fitzgerald ' + i : 'Pretend Dog ' + i);
function put(world, name, content) {
  const f = world.files.find((x) => x.name === name && !x.trashed);
  if (f) { f.content = content; f.size = String(content.length); return; }
  const like = world.files.find((x) => x.name === 'BLD-area.csv' && !x.trashed);
  world.file('fx-' + name, name, content, { parents: like.parents, driveId: like.driveId, mimeType: like.mimeType });
}
async function openHub(page, guard) {
  const w = guard.world;
  put(w, 'BLD-area.csv', csv('id,code,grouping,group_sort,area_value,m2_confirmed,m2_note', Array.from({ length: ROOMS }, (_, i) => `area-${i},Test Cabin ${String.fromCharCode(65 + i)},cabins,1,12,yes,invented`)));
  put(w, 'BLD-subject.csv', csv('id,name,sex,dob,size_band,kind,species,photo', Array.from({ length: DOGS }, (_, i) => `sub-${i},${dogName(i)},${i % 2 ? 'M' : 'F'},2022-03-01,medium,${i % 2 ? 'Stud' : 'Breeding Bitch'},dog,${i < 4 ? 'drvprint' + i : ''}`)));
  put(w, 'BLD-subject_status.csv', csv('subject_id,state', Array.from({ length: DOGS }, (_, i) => `sub-${i},Active`)));
  put(w, 'BLD-occupancy.csv', csv('subject_id,area_id,classification,off_site_kind', Array.from({ length: DOGS }, (_, i) => `sub-${i},area-${i % ROOMS},Resident,`)));
  for (let i = 0; i < 4; i++) { w.file('drvprint' + i, 'p' + i + '.png', '', { mimeType: 'image/png' }); w.byId('drvprint' + i).thumbnailLink = 'https://example.com/pretend-print-dog-' + i + '.png'; }
  // a wide photo, so a photo that is not cropped to its box would show
  await page.route(/example\.com\/pretend-print-dog/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="300"><rect width="800" height="300" fill="#c84"/><circle cx="400" cy="150" r="120" fill="#432"/></svg>' }));
  await page.goto('cdhub/');
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
}

/** On paper: the bars, buttons and forms are gone, cards are kept whole, nothing is wider than the page. */
async function paperLook(page, view) {
  await page.emulateMedia({ media: 'print' });
  const r = await page.evaluate((v) => {
    const shown = (e) => !!e && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0;
    const main = document.getElementById('main');
    const cards = Array.from(main.querySelectorAll(v === 'round' ? '.rcabins > .card' : '#rows > .dc'));
    const rows = {}; cards.forEach((c) => { const t = Math.round(c.getBoundingClientRect().top); rows[t] = (rows[t] || 0) + 1; });
    const wide = Array.from(main.querySelectorAll('*')).filter((e) => shown(e) && e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).map((e) => e.tagName + '.' + e.className).slice(0, 5);
    return {
      view: main.getAttribute('data-view'),
      bars: ['.top', '#nav'].filter((q) => shown(document.querySelector(q))),
      controls: ['.racc', '.radd', '.rempty', '[data-here]', '#sinkcard', '.dedit', '.dogphoto-btn', '.fbar', '.dcs-form', '.next'].filter((q) => Array.from(document.querySelectorAll(q)).some(shown)),
      whole: cards.every((c) => /avoid/.test(getComputedStyle(c).breakInside)),
      perRow: Math.max(0, ...Object.values(rows)),
      boxes: v === 'round' ? Array.from(main.querySelectorAll('.rcabins .tmp input')).filter(shown).length : 0,
      photoInside: Array.from(main.querySelectorAll('img.dogphoto')).filter(shown).every((i) => { const a = i.getBoundingClientRect(), b = i.closest('.ph').getBoundingClientRect(); return Math.abs(a.width - b.width) < 8 && Math.abs(a.height - b.height) < 8 && getComputedStyle(i).objectFit === 'cover'; }),   // fills its square box, cropped, never squashed or cut short
      wide,
      cards: cards.length
    };
  }, view);
  await page.emulateMedia({ media: 'screen' });
  return r;
}

/* ------------------------------------------------------------------ the print page: kennel cards */
const CARDS = 5;
function cardTables() {
  return {
    area: [{ id: 'ar-a', code: 'Room A' }], requirement: [],
    subject: Array.from({ length: CARDS }, (_, i) => ({ id: 'd' + i, name: i === 1 ? 'Pretend Bartholomew-Fitzgerald the Third' : 'Pretend Dog ' + i, sex: i % 2 ? 'Male' : 'Female', size_band: ['5-10kg (small)', '10-25kg (medium)', '25kg+ (large)'][i % 3], dob: '2022-03-01', coat_colour_id: 'cc-1', coat_pattern_id: 'cp-1' })),
    subject_status: [], litter: [],
    breeding_rule: [{ rule_key: 'size_colour.medium', value: 'green' }, { rule_key: 'size_colour.small', value: 'orange' }, { rule_key: 'size_colour.large', value: 'blue' }],
    area_access: [], area_capacity: [],
    occupancy: Array.from({ length: CARDS }, (_, i) => ({ subject_id: 'd' + i, area_id: 'ar-a', moved_in: '2026-01-01' })),
    qr_tag: Array.from({ length: CARDS }, (_, i) => ({ tag: 'PRNT000' + i, kind: 'subject', ref_id: 'd' + i, active: 'true' })).concat([{ tag: 'PRNTROOM', kind: 'area', ref_id: 'ar-a', active: 'true' }]),
    coat_colour: [{ id: 'cc-1', name: 'Pretend Chocolate' }], coat_pattern: [{ id: 'cp-1', name: 'Parti' }], nose_pigment: [],
    microchip: Array.from({ length: CARDS }, (_, i) => ({ id: 'm' + i, subject_id: 'd' + i, chip_number: '12345678901234' + i })),
    // many jobs, so the job strip wraps: the most a card has to hold
    check_type: ['Nails', 'Ears', 'Weigh', 'Teeth', 'Coat brush', 'Flea and worm', 'Eyes'].map((l, i) => ({ type_key: 'k' + i, label: l, target: 'dog', every_days: '28', effective_from: '2026-01-01', active: 'true' }))
  };
}
async function openCards(page) {
  const tables = cardTables();
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [], version: 'test' } });
    return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: tables[JSON.parse(route.request().postData()).table] || [] } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-OWNER', SCRIPT]);
  await page.goto('cdhub/staff/print/');
  await page.getByRole('button', { name: 'Dog kennel cards' }).click();
  await expect(page.locator('.dcard')).toHaveCount(CARDS);
}
const PER_LABEL = { 1: 'Full A4', 2: '2 per A4', 4: '4 per A4' };
/** Every card on paper: nothing inside runs past its edge (no clipped QR, chip or jobs). */
async function cardsFit(page) {
  await page.emulateMedia({ media: 'print' });
  const r = await page.evaluate(() => Array.from(document.querySelectorAll('.dcard')).map((c) => {
    const b = c.getBoundingClientRect();
    const out = Array.from(c.querySelectorAll('.band,.cside,.code svg,.chipline,.jobs,.lst,.tag')).filter((e) => { const x = e.getBoundingClientRect(); return x.bottom > b.bottom + 1 || x.right > b.right + 1; }).map((e) => e.className.baseVal !== undefined ? 'svg' : e.className);
    const qr = c.querySelector('.code svg').getBoundingClientRect();
    return { id: c.getAttribute('data-dog'), out, qr: Math.round(Math.min(qr.width, qr.height)), status: getComputedStyle(document.querySelector('.msg')).display };
  }));
  await page.emulateMedia({ media: 'screen' });
  return r;
}

module.exports = { OUT, PAPER, MM, A4, isA4, pdfPages, printPdf, openHub, paperLook, ROOMS, DOGS, openCards, cardsFit, CARDS, PER_LABEL };
