// Codes vault page (cdhub/staff/vault/), Lisa 14 Nov 2026 option B. Pretend save script, invented password and codes only.
const { test, expect } = require('../support/test');

test.use({ allowedConsole: [/404/] });

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };
const PW = 'invented-vault-password-1';
const CODE = 'TESTCODE23';
const REG = [
  { id: 'cr-1', code_id: 'sc-aaaaaa', who: 'Pretend Person', role: 'STAFF', from_date: '2026-10-01', to_date: '', ended_by: '' },
  { id: 'cr-2', code_id: 'sc-bbbbbb', who: 'Another Pretend', role: 'STAFF', from_date: '2026-10-02', to_date: '', ended_by: '' }
];

// rows sealed by the real library in a browser, with the invented password
async function sealed(page) {
  await page.goto('cdhub/');
  await page.addScriptTag({ url: 'staff/lib/code-vault.js' });
  return page.evaluate(async ([pw, code]) => [await BLDVault.makeCheck(pw), await BLDVault.seal(pw, 'sc-aaaaaa', code)], [PW, CODE]);
}

async function setup(page, o) {
  const posts = [];
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [{ key: 'code_vaults', on: true, mode: 'direct' }] } });
    const b = JSON.parse(route.request().postData());
    posts.push(route.request().postData());
    if (b.action === 'code_check') return route.fulfill({ headers: CORS, json: { ok: true, result: { match: b.code_id === 'sc-bbbbbb' && b.typed === 'OTHERCODE4' } } });
    if (b.action === 'read') {
      if (b.table === 'code_vaults' && o.vault === null) return route.fulfill({ headers: CORS, json: { ok: false, code: 'FILE_NOT_ALLOWED', message: 'not known' } });
      if (b.table === 'permission' && !o.perm) return route.fulfill({ headers: CORS, json: { ok: false, code: 'FILE_NOT_ALLOWED', message: 'not known' } });
      const rows = { code_register: REG, code_vaults: o.vault || [], permission: o.perm || [] }[b.table] || [];
      return route.fulfill({ headers: CORS, json: { ok: true, result: { rows, role: o.role || 'OWNER', name: 'Pretend Owner' } } });
    }
    return route.fulfill({ headers: CORS, json: { ok: true, result: { status: 'saved', id: 'cv-1' } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-CODE-1', SCRIPT]);
  return posts;
}

test.describe('Codes vault page', () => {
  test('first use: the password is set twice, the warning is plain, and only sealed hex is sent', async ({ page }) => {
    const posts = await setup(page, { vault: [] });
    await page.goto('cdhub/staff/vault/');
    await expect(page.locator('#screen')).toContainText('Forgotten password = every code is reset');
    await page.locator('#vP1').fill(PW);
    await page.locator('#vP2').fill(PW + 'x');
    await page.getByRole('button', { name: 'Set the password' }).click();
    await expect(page.locator('#screen')).toContainText('not the same');
    await page.locator('#vP1').fill(PW);
    await page.locator('#vP2').fill(PW);
    await page.getByRole('button', { name: 'Set the password' }).click();
    await expect(page.locator('#screen')).toContainText('Saved. Now open the vault with it.');
    const add = posts.map((p) => JSON.parse(p)).filter((b) => b.action === 'add');
    expect(add.length).toBe(1);
    expect(add[0].table).toBe('code_vaults');
    expect(add[0].fields.code_id).toBe('vault-check');
    expect(add[0].fields.cipher).toMatch(/^[0-9a-f]+$/);
    expect(posts.filter((p) => p.includes(PW))).toEqual([]);
  });

  test('a wrong password does not open; the right one shows one code, hides it after 30 s and locks after a minute', async ({ page }) => {
    const rows = await sealed(page);
    const posts = await setup(page, { vault: rows });
    await page.clock.install();
    await page.goto('cdhub/staff/vault/');
    await page.locator('#vPw').fill('not-the-password');
    await page.getByRole('button', { name: 'Open' }).click();
    await expect(page.locator('#screen')).toContainText('Wrong password.');
    await page.locator('#vPw').fill(PW);
    await page.getByRole('button', { name: 'Open' }).click();
    await expect(page.getByRole('button', { name: 'Lock now' })).toBeVisible();
    await expect(page.locator('tr', { hasText: 'Another Pretend' })).toContainText('Not kept yet');
    await page.locator('tr', { hasText: 'Pretend Person' }).getByRole('button', { name: 'Show' }).click();
    await expect(page.locator('#vShown')).toHaveText('sc-aaaaaa: ' + CODE);
    await page.clock.runFor(31000);
    await expect(page.locator('#vShown')).toHaveText('');
    await page.clock.runFor(31000);
    await expect(page.locator('#vPw')).toBeVisible();
    await expect(page.locator('#screen')).toContainText('Locked after a minute unused.');
    expect(posts.filter((p) => p.includes(PW) || p.includes(CODE))).toEqual([]);
  });

  test('add an existing code: checked by the script first, a wrong one is never kept, the right one is kept sealed', async ({ page }) => {
    const rows = await sealed(page);
    const posts = await setup(page, { vault: rows });
    await page.goto('cdhub/staff/vault/');
    await page.locator('#vPw').fill(PW);
    await page.getByRole('button', { name: 'Open' }).click();
    await page.locator('#vWho').selectOption('sc-bbbbbb');
    await page.locator('#vCode').fill('TYPOCODE44');
    await page.getByRole('button', { name: 'Check and keep' }).click();
    await expect(page.locator('#screen')).toContainText('That is not Another Pretend\u2019s code. Nothing kept.');
    await expect(page.locator('#vCode')).toHaveValue('');
    expect(posts.map((p) => JSON.parse(p)).filter((b) => b.action === 'add')).toEqual([]);
    await page.locator('#vWho').selectOption('sc-bbbbbb');
    await page.locator('#vCode').fill('OTHERCODE4');
    await page.getByRole('button', { name: 'Check and keep' }).click();
    await expect(page.locator('#screen')).toContainText('\u2713 Kept: Another Pretend');
    await expect(page.locator('tr', { hasText: 'Another Pretend' }).getByRole('button', { name: 'Show' })).toBeVisible();
    const bodies = posts.map((p) => JSON.parse(p));
    const add = bodies.filter((b) => b.action === 'add');
    expect(add.length).toBe(1);
    expect(add[0].fields.code_id).toBe('sc-bbbbbb');
    // the typed code goes only to the check, never into a save; the password goes nowhere
    expect(posts.filter((p) => p.includes('OTHERCODE4')).map((p) => JSON.parse(p).action)).toEqual(['code_check']);
    expect(posts.filter((p) => p.includes(PW))).toEqual([]);
    await page.locator('tr', { hasText: 'Another Pretend' }).getByRole('button', { name: 'Show' }).click();
    await expect(page.locator('#vShown')).toHaveText('sc-bbbbbb: OTHERCODE4');
  });

  test('Lock now locks at once', async ({ page }) => {
    const rows = await sealed(page);
    await setup(page, { vault: rows });
    await page.goto('cdhub/staff/vault/');
    await page.locator('#vPw').fill(PW);
    await page.getByRole('button', { name: 'Open' }).click();
    await page.getByRole('button', { name: 'Lock now' }).click();
    await expect(page.locator('#vPw')).toBeVisible();
  });

  test('who may open is an owner setting: default owner only; a role row lets staff in; a person row "no" keeps an owner out', async ({ page }) => {
    await setup(page, { vault: [], role: 'STAFF' });
    await page.goto('cdhub/staff/vault/');
    await expect(page.locator('#screen')).toContainText('Only people the owner allows can open the vault.');

    await page.unrouteAll();
    await setup(page, { vault: [], role: 'STAFF', perm: [{ id: 'p1', role_code: 'STAFF', person_id: '', table_name: 'code_vault', action: 'open', allowed: 'yes', from_date: '2026-01-01', to_date: '' }] });
    await page.goto('cdhub/staff/vault/');
    await expect(page.locator('#screen')).toContainText('Forgotten password');

    await page.unrouteAll();
    await setup(page, { vault: [], role: 'OWNER', perm: [{ id: 'p2', role_code: 'OWNER', person_id: '', table_name: 'code_vault', action: 'open', allowed: 'no', from_date: '2026-01-01', to_date: '' }] });
    await page.goto('cdhub/staff/vault/');
    await expect(page.locator('#screen')).toContainText('Only people the owner allows');
  });

  test('before the save script knows the vault list, the page says so', async ({ page }) => {
    await setup(page, { vault: null });
    await page.goto('cdhub/staff/vault/');
    await expect(page.locator('#screen')).toContainText('The vault starts after the save-script update.');
  });

  test('the page allows only its own scripts and sends only to the save script', async ({ page }) => {
    await setup(page, { vault: [] });
    await page.goto('cdhub/staff/vault/');
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain('connect-src https://script.google.com https://script.googleusercontent.com');
    expect(await page.evaluate(() => [...document.scripts].every((s) => s.src && new URL(s.src).origin === location.origin))).toBe(true);
  });
});
