const { test, expect } = require('../support/test');
const P = require('../support/print-a4');

test.describe('Phone: CD Hub print on A4', () => {
  test('the round sheet: A4, 3 pages for 16 cabins, no bars on the paper', async ({ page, guard }) => {
    await P.openHub(page, guard);
    await page.evaluate(() => go('round'));
    await expect(page.locator('.rcabins > .card[data-area]')).toHaveCount(P.ROOMS);
    const pdf = await P.printPdf(page, 'phone-cdhub-round-sheet');
    expect(pdf.boxes.every((b) => P.isA4(b))).toBe(true);
    expect(pdf.count).toBe(3);
  });

  test('the Dogs page: A4, two whole cards a row', async ({ page, guard }) => {
    await P.openHub(page, guard);
    await page.evaluate(() => go('dogs'));
    await expect(page.locator('#rows > article.dc')).toHaveCount(P.DOGS);
    await expect(page.locator('img.dogphoto:not(.off)')).toHaveCount(4);
    await page.waitForFunction(() => Array.from(document.querySelectorAll('img.dogphoto:not(.off)')).every((i) => i.complete && i.naturalWidth > 0));
    const pdf = await P.printPdf(page, 'phone-cdhub-dogs');
    expect(pdf.boxes.every((b) => P.isA4(b))).toBe(true);
    expect(pdf.count).toBeLessThanOrEqual(6);
  });

  test('dog cards: Full A4, 2 per A4 and 4 per A4 give 1, 2 and 4 whole cards a page', async ({ page }) => {
    await P.openCards(page);
    for (const per of [1, 2, 4]) {
      await page.getByRole('button', { name: P.PER_LABEL[per] }).click();
      const pdf = await P.printPdf(page, 'phone-cdhub-kennel-cards-' + per + '-per-A4');
      expect(pdf.boxes.every((b) => P.isA4(b)), P.PER_LABEL[per]).toBe(true);   // all portrait (the owner's dog card, 18 Nov 2026)
      expect(pdf.count, P.PER_LABEL[per]).toBe(Math.ceil(P.CARDS / per));
    }
  });
});

