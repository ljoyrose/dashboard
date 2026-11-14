// Codes vault crypto (cdhub/staff/lib/code-vault.js), Lisa 14 Nov 2026 option B. Runs in the browser's own WebCrypto.
// Invented passwords and codes only: none of these is a real code.
const { test, expect } = require('../support/test');

const PW = 'invented-vault-password-1';
const CODE = 'TESTCODE23';

async function lib(page) {
  await page.goto('cdhub/');
  await page.addScriptTag({ url: 'staff/lib/code-vault.js' });
  await page.waitForFunction(() => !!window.BLDVault);
}

test.describe('Codes vault: sealing in the browser', () => {
  test('seal then open gives the same code back; the sealed row holds no plain text', async ({ page }) => {
    await lib(page);
    const r = await page.evaluate(async ([pw, code]) => {
      const row = await BLDVault.seal(pw, 'sc-abcdef', code);
      return { row, back: await BLDVault.open(pw, row), json: JSON.stringify(row) };
    }, [PW, CODE]);
    expect(r.back).toBe(CODE);
    expect(r.json).not.toContain(CODE);
    expect(r.json).not.toContain(PW);
    expect(r.row.kdf).toBe('PBKDF2-SHA256/AES-GCM-256');
    expect(+r.row.kdf_iter).toBeGreaterThanOrEqual(600000);
    // every field passes the save's start-of-cell guard (no = + - @ first): hex, not base64
    for (const k of ['cipher', 'iv', 'salt']) expect(r.row[k]).toMatch(/^[0-9a-f]+$/);
  });

  test('every entry gets its own salt and IV', async ({ page }) => {
    await lib(page);
    const r = await page.evaluate(async ([pw, code]) => {
      const a = await BLDVault.seal(pw, 'sc-abcdef', code), b = await BLDVault.seal(pw, 'sc-abcdef', code);
      return [a.salt !== b.salt, a.iv !== b.iv, a.cipher !== b.cipher];
    }, [PW, CODE]);
    expect(r).toEqual([true, true, true]);
  });

  test('a wrong password, a changed row, a row moved to another id and a weak row are all refused', async ({ page }) => {
    await lib(page);
    const r = await page.evaluate(async ([pw, code]) => {
      const row = await BLDVault.seal(pw, 'sc-abcdef', code), why = async (p, x) => { try { await BLDVault.open(p, x); return 'opened'; } catch (e) { return e.code; } };
      const flip = Object.assign({}, row, { cipher: row.cipher.slice(0, -1) + (row.cipher.slice(-1) === '0' ? '1' : '0') });
      return {
        wrong: await why('not-the-password', row),
        changed: await why(pw, flip),
        moved: await why(pw, Object.assign({}, row, { code_id: 'sc-zzzzzz' })),
        weak: await why(pw, Object.assign({}, row, { kdf_iter: '1000' }))
      };
    }, [PW, CODE]);
    expect(r).toEqual({ wrong: 'WRONG_PASSWORD', changed: 'WRONG_PASSWORD', moved: 'WRONG_PASSWORD', weak: 'WEAK_ROW' });
  });

  test('the check row tells a wrong password before any code is tried', async ({ page }) => {
    await lib(page);
    const r = await page.evaluate(async (pw) => {
      const check = await BLDVault.makeCheck(pw);
      return [check.code_id, await BLDVault.checkPassword(pw, check), await BLDVault.checkPassword('nope', check)];
    }, PW);
    expect(r).toEqual(['vault-check', true, false]);
  });

  test('an unlocked spell shows one code, then locks itself after the idle time and drops the password', async ({ page }) => {
    await lib(page);
    const r = await page.evaluate(async ([pw, code]) => {
      let locked = 0;
      const check = await BLDVault.makeCheck(pw), row = await BLDVault.seal(pw, 'sc-abcdef', code);
      const s = BLDVault.session({ idleMs: 400, onLock: () => { locked++; } });
      let wrong = ''; try { await s.unlock('nope', check); } catch (e) { wrong = e.code; }
      await s.unlock(pw, check);
      const shown = await s.show(row), openNow = s.isOpen();
      await new Promise((ok) => setTimeout(ok, 700));
      let after = ''; try { await s.show(row); } catch (e) { after = e.code; }
      return { wrong, shown: shown === code, openNow, openLater: s.isOpen(), after, locked };
    }, [PW, CODE]);
    expect(r).toEqual({ wrong: 'WRONG_PASSWORD', shown: true, openNow: true, openLater: false, after: 'LOCKED', locked: 1 });
  });

  test('the default lock is one minute or less, and hiding the page locks at once', async ({ page }) => {
    await lib(page);
    const r = await page.evaluate(async (pw) => {
      const check = await BLDVault.makeCheck(pw), s = BLDVault.session({});
      await s.unlock(pw, check);
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
      return { idle: BLDVault.IDLE_MS, open: s.isOpen() };
    }, PW);
    expect(r.idle).toBeLessThanOrEqual(60000);
    expect(r.open).toBe(false);
  });

  test('a typed code is checked against the sign-in hash (salt + ":" + code), so a typo is never kept', async ({ page }) => {
    await lib(page);
    const r = await page.evaluate(async (code) => {
      const salt = 'invented-salt';
      const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + code));
      const hash = [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
      return [await BLDVault.hashMatches(code, salt, hash), await BLDVault.hashMatches(' ' + code + ' ', salt, hash), await BLDVault.hashMatches(code + 'X', salt, hash)];
    }, CODE);
    expect(r).toEqual([true, true, false]);
  });

  test('sealing and opening send nothing over the network', async ({ page }) => {
    await lib(page);
    const sent = [];
    page.on('request', (q) => sent.push(q.url() + ' ' + (q.postData() || '')));
    await page.evaluate(async ([pw, code]) => { const row = await BLDVault.seal(pw, 'sc-abcdef', code); await BLDVault.open(pw, row); }, [PW, CODE]);
    expect(sent.filter((s) => s.includes(CODE) || s.includes(PW))).toEqual([]);
    expect(sent.length).toBe(0);
  });
});
