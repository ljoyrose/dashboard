// Bottom tabs (Lisa's picks, 2 Nov 2026): at most 6 tabs, the other views sit in the More menu. A person opens More first to reach
// one of those, so the tests do the same.
const MORE = 'nav.house-tabs [data-house-more]';
const shutIn = (t) => t.evaluate((e) => { const m = e.closest('.house-more'); return !!m && m.hidden; });

/** Clicks a tab or a view under More (opening More first only when the view sits in its shut menu). */
async function tabClick(page, sel, opts) {
  const t = typeof sel === 'string' ? page.locator(sel).first() : sel;
  await t.waitFor({ state: 'attached' });
  if (await shutIn(t)) await page.locator(MORE).click();
  await t.click(opts);
}

/** Presses Tab until `target` has the focus, the way a keyboard user gets there: a view under More is reached by tabbing to More,
 *  pressing Enter (the menu opens and takes the focus) and tabbing on inside the menu. Returns true when reached. */
async function tabTo(page, target, max = 150) {
  const t = typeof target === 'string' ? page.locator(target).first() : target;
  await t.waitFor({ state: 'attached' });
  const focused = (l) => l.evaluate((e) => e === document.activeElement);
  if (await shutIn(t)) {
    const more = page.locator(MORE);
    let got = false;
    for (let i = 0; i < max && !got; i++) { await page.keyboard.press('Tab'); got = await focused(more); }
    if (!got) return false;
    await page.keyboard.press('Enter');
    if (await focused(t)) return true;
  }
  for (let i = 0; i < max; i++) { if (await focused(t)) return true; await page.keyboard.press('Tab'); }
  return focused(t);
}
module.exports = { tabClick, tabTo, MORE };
