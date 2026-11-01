// Signed out, every page shows only its sign-in: no title, menu, search, names or footer. Pretend Google and Drive.
const { test, expect } = require('../support/test');

const PAGES = [['Main dashboard', './'], ['Money Hub', 'money/'], ['CD Hub', 'cdhub/'], ['Factory', 'factory/'], ['Marketplace', 'marketplace/'], ['GA Hub', 'food/'], ['Studio', 'studio/']];

// Visible text, skipping anything hidden by CSS (visibility, display, or 1px screen-reader-only text).
const shown = () => {
  const out = [];
  const walk = (n) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) {
        const p = c.parentElement, s = p && getComputedStyle(p);
        let tiny = false;
        for (let a = p; a && a !== document.body; a = a.parentElement) { const ar = a.getBoundingClientRect(); if (ar.width <= 1 || ar.height <= 1) tiny = true; }
        if (s && s.visibility === 'visible' && s.display !== 'none' && !tiny && c.textContent.trim()) out.push(c.textContent.trim());
      } else if (c.nodeType === 1 && !/^(SCRIPT|STYLE|TEMPLATE)$/.test(c.tagName)) walk(c);
    }
  };
  walk(document.body);
  return out.join(' ').replace(/\s+/g, ' ');
};

for (const [name, url] of PAGES) {
  test(`${name}: signed out, only the sign-in shows`, async ({ page }) => {
    await page.goto(url);
    await expect(page.locator('html')).toHaveClass(/dash-locked/);
    await page.waitForTimeout(300);
    const text = await page.evaluate(shown);
    // Only sign-in wording is allowed through.
    const left = text.replace(/Skip to content|← Dashboard|Sign in to see (your money|the tables|what needs you|the GA Hub)|Sign in to open\.|Sign in with Google|Sign in again|Sign in|Loading( Google)? sign-in…|Loading…|Read-only\. One sign-in for the whole site\.|Not signed in|Factory|Studio|Google sign-in is still loading\. Try again in a moment\./g, '').trim();
    expect(left, `${name} shows more than the sign-in: "${text}"`).toBe('');
    for (const sel of ['nav', 'footer', '[data-search-open]', '#tabs']) {
      for (const el of await page.locator(sel).all()) await expect(el).not.toBeVisible();
    }
  });

  test(`${name}: after signing in the page unlocks`, async ({ page }) => {
    await page.route(/sheets\.googleapis\.com/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"values":[]}' }));
    await page.goto(url);
    await page.locator('[data-action="signin"]:visible, [data-signin]:visible').first().click();
    await expect(page.locator('html')).not.toHaveClass(/dash-locked/);
  });
}

test('signing out locks the page again', async ({ page }) => {
  await page.route(/sheets\.googleapis\.com/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"values":[]}' }));
  await page.goto('marketplace/');
  await page.locator('#signin').click();
  await expect(page.locator('html')).not.toHaveClass(/dash-locked/);
  await page.evaluate(() => DashAuth.clear());
  await expect(page.locator('html')).toHaveClass(/dash-locked/);
});
