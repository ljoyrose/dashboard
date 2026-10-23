// Turns course SVG/HTML files into PNG (and PDF on request) with headless Chromium and the Lexend files in
// ../assets/fonts, so every render looks the same on any machine. Usage:
//   node build/shoot.mjs file1.svg [file2.svg ...]           -> file1.png next to each SVG
//   node build/shoot.mjs --pdf out.pdf a.svg b.svg ...       -> one PDF, one page per SVG (vector)
//   node build/shoot.mjs --html page.html --width 1440 --out page.png
// Chromium: CHROME env var, else the Playwright copy in /opt/pw-browsers.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FONTS = path.join(ROOT, 'assets', 'fonts');
const face = [300, 400, 600, 700].map((w) => `@font-face{font-family:Lexend;font-weight:${w};src:url('${pathToFileURL(path.join(FONTS, `Lexend-${w}.ttf`)).href}')}`).join('');

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const base = '/opt/pw-browsers';
  if (fs.existsSync(base)) {
    for (const d of fs.readdirSync(base).filter((x) => x.startsWith('chromium_headless_shell-')).sort().reverse()) {
      const p = path.join(base, d, 'chrome-linux', 'headless_shell');
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined; // playwright default
}

const raw = process.argv.slice(2);
const transparent = raw.includes('--transparent');
const args = raw.filter((a) => a !== '--transparent');
const browser = await chromium.launch({ executablePath: findChrome() });
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function svgPage(file) {
  const svg = fs.readFileSync(file, 'utf8');
  const m = /width="(\d+)" height="(\d+)"/.exec(svg);
  const [w, h] = [Number(m[1]), Number(m[2])];
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><html><head><style>${face}html,body{margin:0;padding:0}svg{display:block}</style></head><body>${svg}</body></html>`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  return [w, h];
}

if (args[0] === '--pdf') {
  const out = args[1];
  const files = args.slice(2);
  const parts = [];
  for (const f of files) parts.push(fs.readFileSync(f, 'utf8'));
  const m = /width="(\d+)" height="(\d+)"/.exec(parts[0]);
  const [w, h] = [Number(m[1]), Number(m[2])];
  await page.setContent(`<!doctype html><html><head><style>${face}@page{size:${w}px ${h}px;margin:0}html,body{margin:0}svg{display:block;page-break-after:always}</style></head><body>${parts.join('')}</body></html>`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: out, width: `${w}px`, height: `${h}px`, printBackground: true });
  console.log('pdf', out, files.length, 'pages');
} else if (args[0] === '--html') {
  const file = args[1];
  const width = Number(args[args.indexOf('--width') + 1] || 1440);
  const out = args[args.indexOf('--out') + 1];
  await page.setViewportSize({ width, height: 900 });
  await page.goto(pathToFileURL(path.resolve(file)).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out, fullPage: true });
  if (args.includes('--pdfout')) await page.pdf({ path: args[args.indexOf('--pdfout') + 1], printBackground: true, width: `${width}px` });
  console.log('png', out);
} else {
  for (const f of args) {
    await svgPage(f);
    const out = f.replace(/\.svg$/, '.png');
    await page.screenshot({ path: out, omitBackground: transparent });
    console.log('png', out);
  }
}
await browser.close();
