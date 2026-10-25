// Hub V2 on the main dashboard (25 Oct 2026, same layout as Marketplace): a bar at the bottom with
// Home, Drive, Bin, Changes and More. Home opens with "Needs you: N", three big tiles and ONE most urgent card.
const { test, expect } = require('../support/test');

const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};
const noSidewaysScroll = async (page, where) => {
  const w = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, body: document.body.scrollWidth, screen: window.innerWidth }));
  expect(w.doc, `${where}: page is ${w.doc}px wide on a ${w.screen}px screen`).toBeLessThanOrEqual(w.screen + 1);
  expect(w.body, `${where}: body is ${w.body}px wide on a ${w.screen}px screen`).toBeLessThanOrEqual(w.screen + 1);
};

test.describe('Main dashboard: Hub V2 bottom bar', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the bar is hidden signed out, sits at the bottom after sign-in, every tab routes, no sideways scroll', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('#mainNav')).toBeHidden();
    await signIn(page);
    const bar = page.locator('#mainNav');
    await expect(bar).toBeVisible();
    expect(await bar.evaluate((e) => getComputedStyle(e).position)).toBe('fixed');
    const box = await bar.boundingBox();
    expect(Math.round(box.y + box.height)).toBe(844); // touches the bottom of the screen
    const tabs = bar.locator('a');
    await expect(tabs).toHaveCount(5);
    for (let i = 0; i < 5; i++) expect((await tabs.nth(i).boundingBox()).height).toBeGreaterThanOrEqual(44);
    await noSidewaysScroll(page, 'Home');
    for (const [key, title] of [['drive', 'Drive'], ['bin', 'Bin'], ['changes', 'Changes · Recent'], ['more', 'More'], ['map', 'Map']]) {
      await bar.locator(`a[data-nav="${key}"]`).click();
      await expect(page.locator('#hereTitle')).toHaveText(title);
      await expect(bar.locator(`a[data-nav="${key}"]`)).toHaveAttribute('aria-current', 'page');
      await expect(bar.locator('a[aria-current="page"]')).toHaveCount(1);
      await noSidewaysScroll(page, title);
    }
  });

  test('Home opens with Needs you: N, three tiles that open tabs, then one urgent card; the Home tab carries the count', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    const top = page.locator('#view > #homeTop');
    await expect(top).toBeVisible();
    const total = await page.locator('#needsToday li').count() ? Number((await page.locator('#needsToday .cardhead .mtag').textContent()).match(/\d+/)[0]) : 0;
    await expect(top.locator('.needsline')).toHaveText('Needs you: ' + total);
    if (total) await expect(page.locator('#n-map')).toHaveText(String(total));
    const tiles = top.locator('a.hometile');
    await expect(tiles).toHaveCount(3);
    for (let i = 0; i < 3; i++) expect((await tiles.nth(i).boundingBox()).height).toBeGreaterThanOrEqual(52);
    await expect(top.locator('#urgentOne')).toHaveCount(1);
    if (total) await expect(top.locator('#urgentOne a.btn')).toHaveAttribute('href', /.+/);
    await tiles.nth(1).click();
    await expect(page.locator('#hereTitle')).toHaveText('Bin');
  });

  test('More lists the sections not in the bar and the other hubs; those sections light up More', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    await page.locator('#mainNav a[data-nav="more"]').click();
    for (const key of ['readfirst', 'personal', 'usb']) await expect(page.locator(`#view a[data-nav="${key}"]`)).toHaveAttribute('href', '#/' + key);
    for (const href of ['money/', 'cdhub/', 'factory/', 'marketplace/']) {
      const a = page.locator(`#view a.morelink[href="${href}"]`);
      await expect(a).toHaveAttribute('target', '_blank');
      expect((await a.boundingBox()).height).toBeGreaterThanOrEqual(52);
    }
    await page.locator('#view a[data-nav="usb"]').click();
    await expect(page.locator('#hereTitle')).toHaveText('Drive check');
    await expect(page.locator('#mainNav a[data-nav="more"]')).toHaveAttribute('aria-current', 'page');
  });

  test('the selected tab has one clean border and a colour fill; the "You are here" title has no box @regression', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    for (const [via, key, title] of [['bar', 'drive', 'Drive'], ['more', 'readfirst', 'Read first'], ['bar', 'bin', 'Bin']]) {
      if (via === 'more') { await page.locator('#mainNav a[data-nav="more"]').click(); await page.locator(`#view a[data-nav="${key}"]`).click(); }
      else await page.locator(`#mainNav a[data-nav="${key}"]`).click();
      await expect(page.locator('#hereTitle')).toHaveText(title);
      const sel = page.locator('#mainNav a[aria-current="page"]');
      await expect(sel).toHaveCount(1);
      const st = await sel.evaluate((e) => { const c = getComputedStyle(e); return { bg: c.backgroundColor, l: c.borderLeftWidth + c.borderLeftColor, t: c.borderTopWidth + c.borderTopColor, r: c.borderRightWidth + c.borderRightColor, b: c.borderBottomWidth + c.borderBottomColor }; });
      expect(st.bg, title + ': selected tab fill').not.toBe('rgba(0, 0, 0, 0)');
      expect(st.bg).not.toBe('transparent');
      expect([st.t, st.r, st.b], title + ': one even border all round').toEqual([st.l, st.l, st.l]);
      await expect(page.locator('#hereTitle')).toBeFocused();
      const h = await page.locator('#hereTitle').evaluate((e) => { const c = getComputedStyle(e); return { o: c.outlineStyle, ow: c.outlineWidth, b: c.borderTopStyle + c.borderLeftStyle, sh: c.boxShadow }; });
      expect(h.o === 'none' || h.ow === '0px', title + ': heading outline ' + h.o + ' ' + h.ow).toBe(true);
      expect(h.b).toBe('nonenone');
      expect(h.sh).toBe('none');
    }
    // Keyboard route too (g then d = Drive): a keyboard user gets :focus-visible, which drew the square box.
    await page.locator('body').click({ position: { x: 5, y: 300 } });
    await page.keyboard.press('g'); await page.keyboard.press('d');
    await expect(page.locator('#hereTitle')).toHaveText('Drive');
    await expect(page.locator('#hereTitle')).toBeFocused();
    const k = await page.locator('#hereTitle').evaluate((e) => { const c = getComputedStyle(e); return c.outlineStyle === 'none' || c.outlineWidth === '0px'; });
    expect(k, 'heading has no outline after a keyboard move').toBe(true);
  });

  test('deep links still land on their section and light the right tab', async ({ page }) => {
    for (const [hash, tab] of [['#/changes/24h', 'changes'], ['#/bin', 'bin'], ['#/personal', 'more']]) {
      await page.goto('./' + hash);
      await signIn(page);
      await expect(page).toHaveURL(new RegExp(hash.replace(/[/#]/g, (c) => '\\' + c)));
      await expect(page.locator(`#mainNav a[data-nav="${tab}"]`)).toHaveAttribute('aria-current', 'page');
      await page.locator('#signOutBtn').click();
    }
  });
});
