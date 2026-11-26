const fs = require('fs');
const path = require('path');
const { test, expect, buildWorld } = require('../../support/test');
const { HUBS, go, settle, sheets, setLook } = require('../../support/hubs');
const { IDS } = require('../../support/world');

const HERE = __dirname;

function fixture(hub, name) {
  const text = fs.readFileSync(path.join(HERE, hub, name), 'utf8');
  return name.endsWith('.json') ? JSON.parse(text) : text;
}

async function slow(page, re, ms = 3000) {
  await page.route(re, async (route) => { await new Promise((r) => setTimeout(r, ms)); return route.fallback(); });
}

async function fail(page, re, status = 500, message = 'Sample failure') {
  await page.route(re, (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: { code: status, message, status: 'INTERNAL' } }) }));
}

async function sideScroll(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
}

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

