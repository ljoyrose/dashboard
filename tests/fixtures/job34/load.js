// JOB 34 shared loader. Reuses the existing pretend Google, Drive and Sheets in tests/support (by import, never edited)
// and adds the small helpers the JOB 34 specs share. Every fixture under tests/fixtures/job34/<hub>/ is invented.
const fs = require('fs');
const path = require('path');
const { test, expect, buildWorld } = require('../../support/test');
const { HUBS, go, settle, sheets, setLook } = require('../../support/hubs');
const { IDS } = require('../../support/world');

const HERE = __dirname;

/** Read an invented fixture: JSON files are parsed, anything else comes back as text. */
function fixture(hub, name) {
  const text = fs.readFileSync(path.join(HERE, hub, name), 'utf8');
  return name.endsWith('.json') ? JSON.parse(text) : text;
}

/** Hold every request matching `re` for `ms` before it carries on (slow network). */
async function slow(page, re, ms = 3000) {
  await page.route(re, async (route) => { await new Promise((r) => setTimeout(r, ms)); return route.fallback(); });
}

/** Answer every request matching `re` with an error (sheet or Drive failure). */
async function fail(page, re, status = 500, message = 'Sample failure') {
  await page.route(re, (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: { code: status, message, status: 'INTERNAL' } }) }));
}

/** True when the page scrolls sideways (wider than its viewport). */
async function sideScroll(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
}

/** Press Tab up to `max` times and return the labels of what got focus, in order. */
async function tabWalk(page, max = 60) {
  const seen = [];
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    seen.push(await page.evaluate(() => {
      const a = document.activeElement;
      if (!a || a === document.body) return '';
      return (a.getAttribute('aria-label') || a.textContent || a.getAttribute('href') || a.id || a.tagName).trim().replace(/\s+/g, ' ').slice(0, 60);
    }));
  }
  return seen;
}

module.exports = { test, expect, buildWorld, HUBS, go, settle, sheets, setLook, IDS, fixture, slow, fail, sideScroll, tabWalk, SHEETS: /^https:\/\/sheets\.googleapis\.com\/v4\/spreadsheets\//, DRIVE: /^https:\/\/www\.googleapis\.com\/drive\/v3\// };
