// Safety net: the repo must never hold secrets or real data. Plain file checks, no browser.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SKIP = /(^|\/)(\.git|node_modules|test-results|playwright-report)(\/|$)/;
const TEXT = /\.(html|js|md|csv|json|yml|yaml|txt)$/;
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name), rel = path.relative(ROOT, p);
  if (SKIP.test(rel)) return [];
  return e.isDirectory() ? walk(p) : [rel];
});
const files = walk(ROOT).filter((f) => TEXT.test(f) && f !== 'package-lock.json');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('no passwords, secret keys or access tokens are committed', () => {
  const patterns = [
    [/ya29\.[0-9A-Za-z_-]{20,}/, 'Google access token'],
    [/AIza[0-9A-Za-z_-]{30,}/, 'Google API key'],
    [/GOCSPX-[0-9A-Za-z_-]{10,}/, 'Google client secret'],
    [/-----BEGIN (RSA |EC )?PRIVATE KEY-----/, 'private key'],
    [/ghp_[0-9A-Za-z]{30,}|github_pat_[0-9A-Za-z_]{30,}/, 'GitHub token'],
    [/"refresh_token"\s*:/, 'OAuth refresh token'],
    [/client_secret\s*[:=]\s*['"][^'"]{8,}/i, 'client secret'],
  ];
  const hits = [];
  for (const f of files) {
    const text = read(f);
    for (const [re, what] of patterns) if (re.test(text)) hits.push(`${f}: looks like a ${what}`);
  }
  expect(hits).toEqual([]);
});

test('the only OAuth client id in the pages is the public one, and it is the same on all three pages', () => {
  const ids = ['index.html', 'cdhub/index.html', 'money/index.html'].map((f) => (read(f).match(/[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com/g) || [])[0]);
  expect(ids[0]).toBeTruthy();
  expect(new Set(ids).size).toBe(1);
});

test('sample CSVs are invented: only example.test addresses and no real-looking data', () => {
  const csvs = files.filter((f) => f.startsWith('tests/fixtures/') && f.endsWith('.csv'));
  expect(csvs.length).toBeGreaterThan(10);
  const hits = [];
  for (const f of csvs) {
    const text = read(f);
    for (const m of text.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []) if (!/@example\.test$/.test(m)) hits.push(`${f}: ${m}`);
    if (/\b(?:\d{4}[ -]){3}\d{4}\b/.test(text)) hits.push(`${f}: looks like a card number`);
    if (/\b\d{2}-\d{2}-\d{2}\b.*\b\d{8}\b/.test(text)) hits.push(`${f}: looks like a bank sort code and account number`);
  }
  expect(hits).toEqual([]);
});

test('the pages pull in scripts, styles and images only from Google sign-in and Google Fonts', () => {
  // (Links the person clicks, like WhatsApp or Dropbox, are fine. This is about what loads by itself.
  //  Every browser test also fails if a page calls an address that is not mocked.)
  const ok = /^https:\/\/(accounts\.google\.com\/gsi\/client|fonts\.googleapis\.com|fonts\.gstatic\.com)(\/|$)/;
  const bad = [];
  for (const f of ['index.html', 'cdhub/index.html', 'money/index.html']) {
    const html = read(f);
    for (const m of html.matchAll(/<(?:script|img|iframe)\b[^>]*\bsrc=["']([^"']+)["']|<link\b[^>]*\bhref=["']([^"']+)["']/gi)) {
      const u = m[1] || m[2];
      if (/^https?:\/\//.test(u) && !ok.test(u)) bad.push(`${f}: ${u}`);
    }
  }
  expect(bad).toEqual([]);
});

test('no personal email addresses in the docs (this repo is public)', () => {
  // The pages themselves name Lisa's business sign-in address on purpose. The docs must not carry personal ones.
  const PERSONAL = /[\w.+-]+@(?:me\.com|icloud\.com|gmail\.com|googlemail\.com|outlook\.com|hotmail\.com|yahoo\.[a-z.]+)/gi;
  const ALREADY_ON_THE_PAGES = ['lisahcarson@gmail.com']; // named in the main page's PC-Personal text by Lisa's choice
  const bad = [];
  files.filter((f) => /\.md$/.test(f)).forEach((f) => (read(f).match(PERSONAL) || []).filter((m) => !ALREADY_ON_THE_PAGES.includes(m.toLowerCase())).forEach((m) => bad.push(`${f}: ${m}`)));
  expect(bad).toEqual([]);
});
