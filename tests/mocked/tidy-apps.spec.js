// TidyUp Apps stage 5: the app registry (CFG.tidyApps) and the Bin page's Other apps list. Pretend Drive only.
const { test, expect } = require('../support/test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8'), ctx);
const APPS = ctx.window.DASH_CONFIG.tidyApps;

const STATUSES = ['bot-and-browser', 'bot-capable', 'browser-only', 'nothing'];
const FORBIDDEN = ['delete_task', 'delete_label', 'destroy'];
const byApp = (name) => APPS.find((r) => r.app === name);

test.describe('TidyUp Apps registry (config)', () => {
  test('one row per app, each with a known status, a how line and a never list', () => {
    const names = APPS.map((r) => r.app);
    expect(new Set(names).size).toBe(names.length);
    expect(names.sort()).toEqual(['Animoto', 'Canva', 'ClickFunnels', 'ClickUp', 'Descript', 'Figma', 'GitHub', 'Gmail', 'Runway', 'Shopify', 'Vercel']);
    for (const r of APPS) {
      expect(STATUSES, r.app).toContain(r.status);
      expect(typeof r.how, r.app).toBe('string');
      expect(r.how.length, r.app).toBeGreaterThan(0);
      expect(Array.isArray(r.never), r.app).toBe(true);
      expect(Object.keys(r).sort(), r.app).toEqual(['app', 'how', 'never', 'status']);
    }
  });

  test('no row allows delete_task, delete_label or destroy; the three are listed as never', () => {
    for (const r of APPS) for (const f of FORBIDDEN) expect(r.how.toLowerCase(), r.app).not.toContain(f);
    expect(byApp('ClickUp').never).toContain('delete_task');
    expect(byApp('Gmail').never).toContain('delete_label');
    expect(byApp('ClickFunnels').never).toContain('destroy');
  });

  test('statuses match the plan', () => {
    expect(byApp('Canva').status).toBe('bot-and-browser');
    for (const a of ['Gmail', 'ClickUp', 'Shopify', 'ClickFunnels']) expect(byApp(a).status, a).toBe('bot-capable');
    for (const a of ['Figma', 'Descript', 'Runway', 'Animoto']) expect(byApp(a).status, a).toBe('browser-only');
    for (const a of ['GitHub', 'Vercel']) expect(byApp(a).status, a).toBe('nothing');
  });

  test('no emails or ids in the rows', () => {
    const text = JSON.stringify(APPS);
    expect(text).not.toMatch(/@/);
    expect(text).not.toMatch(/[A-Za-z0-9_-]{20,}/);
  });
});

test.describe('Bin page: Other apps', () => {
  test('lists every app before Dropbox, folded closed, in plain words, with no buttons or tick boxes', async ({ page, guard }) => {
    await page.goto('./#/bin');
    await expect(page.locator('#signInBtn')).toBeEnabled();
    await page.locator('#signInBtn').click();
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    const card = page.locator('#appsCard');
    await expect(card).toHaveJSProperty('open', false);
    await expect(page.locator('#view > *').last()).toHaveAttribute('id', 'dropboxCard');
    const pos = await page.evaluate(() => document.getElementById('appsCard').compareDocumentPosition(document.getElementById('dropboxCard')) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(pos).toBeTruthy();
    await card.locator('summary').click();
    await expect(card.locator('li[data-app]')).toHaveCount(APPS.length);
    await expect(card.locator('li[data-app="Canva"] .chip')).toHaveText('Bot moves, you empty');
    await expect(card.locator('li[data-app="Figma"] .chip')).toHaveText('By hand');
    await expect(card.locator('li[data-app="Vercel"] .chip')).toHaveText('Nothing to do');
    await expect(card.locator('button, input')).toHaveCount(0);
    const text = await card.innerText();
    expect(text).not.toMatch(/ZZ_|ledger|RR_|E02|UNSURE|delete_task|delete_label|destroy/);
    expect(guard.world.calls.filter((c) => c.method !== 'GET')).toEqual([]);
  });
});
