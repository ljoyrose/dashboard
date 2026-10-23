// Vision 2029 · Illustrative. Opens the REAL factory page (factory/index.html) on a local server with the
// page's own test stand-ins (pretend Google sign-in, pretend Drive from tests/support), feeds it the invented
// 2029 state (state-2029.js), and photographs each tab. Adds a Vision label and a dated footer band on top.
// Usage: node course/vision2029/shoot-dashboard.cjs     (from the repo root; writes course/vision2029/out/)
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const REPO = path.resolve(__dirname, '..', '..');
const { chromium } = require(path.join(REPO, 'course', 'node_modules', 'playwright-core'));
const gisStub = require(path.join(REPO, 'tests', 'support', 'gis-stub'));
const { buildWorld } = require(path.join(REPO, 'tests', 'support', 'world'));
const { build } = require('./state-2029');
const G = JSON.parse(fs.readFileSync(path.join(REPO, 'course', 'glossary.json'), 'utf8'));
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

function chrome() {
  const base = '/opt/pw-browsers';
  const d = fs.existsSync(base) && fs.readdirSync(base).filter((x) => x.startsWith('chromium_headless_shell-')).sort().reverse()[0];
  return process.env.CHROME || (d ? path.join(base, d, 'chrome-linux', 'headless_shell') : undefined);
}

const SRC = fs.readFileSync(path.join(REPO, 'factory', 'index.html'), 'utf8');
const LOGS = /logs: '([^']+)'/.exec(SRC)[1];
const TABS = [['me', '#/me'], ['rooms', '#/rooms'], ['decide', '#/decide'], ['do', '#/do'], ['docs', '#/docs']];
const C = G.colours;

const overlay = (tab) => `
  (function(){
    var s=document.createElement('style');
    s.textContent='#v2029{font:600 13px Lexend,system-ui;color:${C.ink};background:${C.sunk};border-bottom:1px solid ${C.border};text-align:center;padding:4px 16px}'+
      '#v2029f{position:relative;margin-top:24px;background:${C.ink};color:${C.page};font:400 13px Lexend,system-ui;padding:12px 16px}#v2029f b{font-weight:700;margin-right:12px}#v2029f small{display:block;color:${C.border};font-size:12px;margin-top:4px}';
    document.head.appendChild(s);
    var c=document.createElement('div'); c.id='v2029'; c.textContent='${G.brand.vision_label} · ${G.brand.fiction_label}'; document.body.insertBefore(c, document.body.firstChild);
    if ('${tab}'==='rooms'){ var v=document.getElementById('view'); if(v){ v.style.maxHeight='1500px'; v.style.overflow='hidden'; } }
    var f=document.createElement('div'); f.id='v2029f';
    f.innerHTML='<b>${G.brand.course_date}</b>Vision 2029 Factory Dashboard · ${tab} · v1<small>Source: real factory/index.html + invented state-2029.js (glossary.json vision2029). ${G.brand.fiction_label}.</small>';
    document.body.appendChild(f);
  })();`;

(async () => {
  const server = spawn(process.execPath, [path.join(REPO, 'tests', 'support', 'static-server.js')], { env: { ...process.env, PORT: '4199' }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch({ executablePath: chrome() });
  try {
    for (const [w, label] of [[1440, 'desktop'], [430, 'phone']]) {
      const context = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: w < 600 ? 3 : 1, serviceWorkers: 'block' });
      await context.addInitScript(() => { window.__GIS_MODE = 'ok'; });
      await context.route('https://accounts.google.com/gsi/client', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: gisStub }));
      const world = buildWorld({ email: 'owner@factory.example', main: false, cd: false, money: false });
      world.folder(LOGS, 'AF logs (Vision 2029 sample)');
      world.file('af-state-2029', 'af-state.json', JSON.stringify(build(Date.now())), { parents: [LOGS], mimeType: 'application/json' });
      await world.install(context);
      const page = await context.newPage();
      await page.goto('http://127.0.0.1:4199/dashboard/factory/#/me');
      await page.locator('#signInBtn').click({ timeout: 15000 });
      await page.locator('#appPick').waitFor({ state: 'visible', timeout: 15000 });
      for (const [name, hash] of TABS) {
        await page.goto('http://127.0.0.1:4199/dashboard/factory/' + hash);
        await page.waitForTimeout(1200);
        await page.evaluate(overlay(name));
        await page.evaluate(() => document.fonts.ready);
        const file = path.join(OUT, `dashboard-2029-${name}-${label}.png`);
        await page.screenshot({ path: file, fullPage: true });
        console.log(file);
        await page.evaluate(() => { document.getElementById('v2029').remove(); document.getElementById('v2029f').remove(); const v = document.getElementById('view'); if (v) { v.style.maxHeight = ''; v.style.overflow = ''; } });
      }
      await context.close();
    }
  } finally {
    await browser.close();
    server.kill();
  }
})().catch((e) => { console.error(e); process.exit(1); });
