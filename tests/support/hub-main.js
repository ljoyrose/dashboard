// Hub Mains (Lisa's house style, 2 Nov 2026): the checks every hub's Main must pass, shared by tests/mocked/hub-main-*.spec.js.
// Main = exactly Next, Needs you (at most 5 rows, late -> today -> waiting, each with its action), then the hub's 3 numbers
// (labels in Lisa's order, each a link to its filtered view, "–" when it cannot be read), or ONE "Nothing needs you" + the numbers.
const fs = require('fs');
const path = require('path');
const { expect } = require('@playwright/test');

const RANK = { late: 0, today: 1, wait: 2 };
const SHOTS = process.env.HUBMAIN_SHOTS || '';

// The parts of #view's Main, in order (data-hm on each direct child of the .hm block).
async function parts(page) {
  const hm = page.locator('#view [data-hub-main], [data-hub-main]').first();
  await expect(hm).toBeVisible();
  return hm.locator(':scope > [data-hm]').evaluateAll((els) => els.map((e) => e.getAttribute('data-hm')));
}

// Everything on Main is the .hm block: no other card or list is drawn next to it (a hub's own heading and banner may stay).
async function onlyMain(page, root = '#view') {
  const extra = await page.locator(root).evaluate((v) => {
    const hm = v.querySelector('[data-hub-main]');
    if (!hm) return ['no [data-hub-main]'];
    const out = [];
    v.querySelectorAll('.card, section, table, ul, ol, .tiles, .grid, input, select').forEach((el) => {
      if (hm.contains(el) || el.closest('[hidden]') || el.closest('[data-hm-allow]')) return;
      const r = el.getBoundingClientRect();
      if (r.width && r.height) out.push(el.tagName.toLowerCase() + '.' + String(el.className || '').split(' ').join('.'));
    });
    return out;
  });
  expect(extra, 'Main shows only Next, Needs you and the 3 numbers').toEqual([]);
}

// Checks one Main. want = { labels: [3], hrefs: [3] (exact href attribute, or RegExp), values?: [3] (exact text), empty?: bool,
// fail?: bool, late?: [bool x3] }.
async function checkMain(page, want) {
  const p = await parts(page);
  if (want.fail) expect(p).toEqual(['fail', 'nums']);
  else if (want.empty) expect(p).toEqual(['empty', 'nums']);
  else expect(p).toEqual(['next', 'needs', 'nums']);
  const hm = page.locator('[data-hub-main]').first();
  if (!want.empty && !want.fail) {
    const rows = hm.locator('[data-hm="needs"] .hm-row');
    const n = await rows.count();
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(5);
    const kinds = await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-kind')));
    for (let i = 1; i < kinds.length; i++) expect(RANK[kinds[i]], 'Needs you order late > today > waiting: ' + kinds.join(',')).toBeGreaterThanOrEqual(RANK[kinds[i - 1]]);
    // Every row carries its action (a real link), and Next is the first row.
    for (let i = 0; i < n; i++) await expect(rows.nth(i).locator('a[data-hm-act]')).toHaveAttribute('href', /./);
    await expect(hm.locator('[data-hm="next"] a[data-hm-act]')).toHaveAttribute('href', /./);
    expect(await hm.locator('[data-hm="next"] .hm-what').innerText()).toBe(await rows.first().locator('.hm-t > a').innerText());
    // Late rows wear the rose pill.
    for (let i = 0; i < n; i++) if (kinds[i] === 'late') await expect(rows.nth(i).locator('.dpill.late')).toBeVisible();
  } else {
    await expect(hm.locator('[data-hm="next"], [data-hm="needs"]')).toHaveCount(0);
    if (want.empty) await expect(hm.locator('[data-hm="empty"]')).toHaveText(/Nothing needs you/);
  }
  const nums = hm.locator('[data-hm="nums"] a.hm-n');
  await expect(nums).toHaveCount(3);
  const got = await nums.evaluateAll((els) => els.map((e) => ({ label: e.querySelector('.hm-l').textContent, value: e.querySelector('.hm-v').textContent, href: e.getAttribute('href'), late: e.querySelector('.hm-v').classList.contains('need') })));
  expect(got.map((g) => g.label)).toEqual(want.labels);
  for (let i = 0; i < 3; i++) {
    if (want.hrefs[i] instanceof RegExp) expect(got[i].href).toMatch(want.hrefs[i]);
    else expect(got[i].href).toBe(want.hrefs[i]);
    if (want.values) expect(got[i].value, want.labels[i]).toBe(String(want.values[i]));
    if (want.fail) expect(got[i].value, want.labels[i] + ' when the read failed').toBe('–');
    if (want.late) expect(got[i].late, want.labels[i] + ' rose ring').toBe(!!want.late[i]);
    if (got[i].value === '–') expect(got[i].late).toBe(false);
  }
  return got;
}

// Each number opens its filtered view: click it and the page moves to that address and draws something.
async function clickNumbers(page, labels) {
  for (const l of labels) {
    const a = page.locator('[data-hub-main] a.hm-n[data-k="' + l + '"]');
    const href = await a.getAttribute('href');
    if (!/^#\//.test(href)) continue; // links that leave the page are checked by href only
    await a.click();
    await expect(page).toHaveURL(new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
    await expect(page.locator('[data-hub-main]')).toHaveCount(0);
    await page.goBack();
    await expect(page.locator('[data-hub-main]')).toBeVisible();
  }
}

async function noSideways(page) {
  const w = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(w, 'no sideways scroll').toBeLessThanOrEqual(0);
}

// Screenshot for Lisa (HUBMAIN_SHOTS=<folder>): <hub>-main-<width>-<scheme>.png.
async function shot(page, hub, width, scheme) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${hub}-main-${width}-${scheme}.png`), fullPage: true });
}

// Rows never move (Lisa, 2 Nov: "weird jumping"): each row's box and its icon (or first part) keep their place (±0.5px) on hover and
// focus, and every row's icon starts at the same x. Also checks the left bar is a straight 3px line (no rounded "(" per row).
async function steadyRows(page, rowSel, iconSel) {
  const rows = page.locator(rowSel);
  const n = await rows.count();
  expect(n, rowSel).toBeGreaterThan(0);
  const measure = (i) => rows.nth(i).evaluate((r, sel) => {
    const b = r.getBoundingClientRect(), ic = r.querySelector(sel).getBoundingClientRect(), bar = getComputedStyle(r, '::before');
    return { x: b.x + scrollX, y: b.y + scrollY, w: b.width, h: b.height, ix: ic.x + scrollX, barW: bar.borderLeftWidth, barR: bar.borderTopLeftRadius };
  }, iconSel);
  const xs = [];
  for (let i = 0; i < n; i++) {
    const before = await measure(i);
    await rows.nth(i).hover();
    const hov = await measure(i);
    const f = rows.nth(i).locator('a, button').first();
    await f.focus();
    const foc = await measure(i);
    for (const [k, after] of [['hover', hov], ['focus', foc]]) {
      for (const key of ['x', 'y', 'w', 'h', 'ix']) expect(Math.abs(after[key] - before[key]), `row ${i + 1} ${key} on ${k}`).toBeLessThanOrEqual(0.5);
    }
    expect(before.barW, `row ${i + 1} bar`).toBe('3px');
    expect(before.barR, `row ${i + 1} bar is straight`).toBe('0px');
    xs.push(before.ix);
  }
  await page.mouse.move(0, 0);
  for (const x of xs) expect(Math.abs(x - xs[0]), 'every row\'s icon at the same x').toBeLessThanOrEqual(0.5);
}

// A group of numbers (Lisa, 2 Nov): same size (18px / 600) on one baseline; a late one has a rose ring sized to it, others none;
// hover shows the pale grey fill, no line (Lisa, 12 Nov 2026); focus the 1px ink line, no fill; no layout change. links = the number
// links, v = the number inside.
async function numberGroup(page, links, v) {
  const els = page.locator(links);
  const n = await els.count();
  expect(n).toBeGreaterThan(0);
  const look = (i) => els.nth(i).evaluate((a, sel) => {
    const b = a.querySelector(sel), cs = getComputedStyle(b), r = b.getBoundingClientRect(), ar = a.getBoundingClientRect();
    const pr = document.createElement('span'); pr.style.background = 'var(--hov)'; a.parentElement.appendChild(pr); const hov = getComputedStyle(pr).backgroundColor; pr.remove();
    return { hov, os: getComputedStyle(a).outlineStyle, size: cs.fontSize, weight: cs.fontWeight, h: r.height, y: r.y + scrollY, bg: getComputedStyle(a).backgroundColor, box: [ar.x + scrollX, ar.y + scrollY, ar.width, ar.height].map((x) => Math.round(x * 2) / 2).join(','), ring: cs.borderTopColor, late: b.classList.contains('need') };
  }, v);
  const rest = [];
  for (let i = 0; i < n; i++) rest.push(await look(i));
  for (const r of rest) { expect(r.size).toBe('18px'); expect(String(r.weight)).toBe('600'); expect(r.h).toBe(rest[0].h); expect(Math.abs(r.y - rest[0].y)).toBeLessThanOrEqual(0.5); }
  for (let i = 0; i < n; i++) {
    await els.nth(i).hover();
    const h = await look(i);
    expect(h.bg, 'the pale grey fill on hover').toBe(h.hov);
    expect(h.os, 'no line on hover').toBe('none');
    expect(h.box, 'nothing moves on hover').toBe(rest[i].box);
    await page.mouse.move(0, 0);
    await els.nth(i).focus();
    const f = await look(i);
    expect(f.bg, 'no fill on focus').toBe(rest[i].bg);
    expect(f.box, 'nothing moves on focus').toBe(rest[i].box);
  }
  await page.mouse.move(0, 0);
  return rest;
}

module.exports = { numberGroup, steadyRows, parts, onlyMain, checkMain, clickNumbers, noSideways, shot };
