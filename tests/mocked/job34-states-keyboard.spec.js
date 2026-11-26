const { test, expect, HUBS, fixture } = require('../fixtures/job34/load');
const H = fixture('states', 'hubs.json');

test.describe.configure({ timeout: 90_000 });

async function tabTo(page, match, max) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const hit = await page.evaluate((src) => {
      const a = document.activeElement;
      if (!a || a === document.body || !new Function('el', 'return ' + src)(a)) return null;
      const s = getComputedStyle(a);
      const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none');
      return { label: (a.getAttribute('aria-label') || a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40), focusVisible: a.matches(':focus-visible'), ring };
    }, match);
    if (hit) return hit;
  }
  return null;
}

async function openByKeyboard(page, guard, hub) {
  const real = page.locator.bind(page);
  let signIn = null;
  page.locator = (sel, o) => {
    const loc = real(sel, o);
    if (sel !== H[hub].signIn) return loc;
    return new Proxy(loc, { get: (t, k) => k === 'click' ? async () => {
      await expect(loc.first()).toBeEnabled();
      signIn = await tabTo(page, '(el.matches("[data-action=signin], #signInBtn, #signinbtn"))', 40);
      expect(signIn, `${hub}: Tab never reached the sign-in button`).not.toBeNull();
      await page.keyboard.press('Enter');
    } : (typeof t[k] === 'function' ? t[k].bind(t) : t[k]) });
  };
  try { await HUBS[hub].open(page, guard); } finally { page.locator = real; }
  await page.evaluate(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); window.scrollTo(0, 0); });
  return signIn;
}

for (const hub of Object.keys(HUBS)) {
  test(`${hub}: keyboard only reaches Sign in and the main menu, and focus is visible on both`, async ({ page, guard }) => {
    const signIn = await openByKeyboard(page, guard, hub);
    expect(signIn.focusVisible && signIn.ring, `${hub}: no visible focus on sign-in ${JSON.stringify(signIn)}`).toBe(true);
    const nav = await tabTo(page, '!!el.closest("nav.house-tabs") && el.getAttribute("aria-current") !== "page"', 250);
    expect(nav, `${hub}: Tab never reached the main menu`).not.toBeNull();
    expect(nav.focusVisible && nav.ring, `${hub}: no visible focus on menu item ${JSON.stringify(nav)}`).toBe(true);
  });
}

for (const hub of ['money', 'marketplace', 'studio']) {
  test(`J34-F85 ${hub}: the current bottom tab shows a focus ring when Tab lands on it`, async ({ page, guard }) => {
    await openByKeyboard(page, guard, hub);
    const cur = await tabTo(page, '!!el.closest("nav.house-tabs") && el.getAttribute("aria-current") === "page"', 250);
    expect(cur, `${hub}: Tab never reached the current tab`).not.toBeNull();
    expect(cur.ring, JSON.stringify(cur)).toBe(true);
  });
}

