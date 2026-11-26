const { test, expect } = require('../support/test');
const P = require('../support/print-a4');

test.describe('CD Hub print on A4', () => {
  test('t-cdhub-print-a4-spec-1', async ({ page, guard }) => {
    await P.openHub(page, guard);
    await page.evaluate(() => go('round'));
    await expect(page.locator('.rcabins > .card[data-area]')).toHaveCount(P.ROOMS);
    await page.setViewportSize(P.PAPER.portrait);
    const look = await P.paperLook(page, 'round');
    expect(look.view).toBe('round');
    expect(look.bars, 'top bar and tab bar stay off the paper').toEqual([]);
    expect(look.controls, 'no flap or add-a-dog menus, present buttons, Empty buttons or save box on paper').toEqual([]);
    expect(look.whole, 'every cabin is kept whole').toBe(true);
    expect(look.perRow, 'two cabins a row').toBe(2);
    expect(look.boxes, 'am and pm min/max boxes to write in, every cabin').toBe(P.ROOMS * 4);
    expect(look.wide, 'nothing runs off the right edge').toEqual([]);
    const pdf = await P.printPdf(page, 'cdhub-round-sheet');
    expect(pdf.boxes.every((b) => P.isA4(b)), 'A4 portrait').toBe(true);
    expect(pdf.count, 'header and 6 cabins, then 8 a page: 3 pages (a split card or a stray row adds one)').toBe(3);
  });

  test('t-cdhub-print-a4-spec-2', async ({ page, guard }) => {
    await P.openHub(page, guard);
    await page.evaluate(() => go('dogs'));
    await expect(page.locator('#rows > article.dc')).toHaveCount(P.DOGS);
    await expect(page.locator('img.dogphoto:not(.off)')).toHaveCount(4);
    await page.waitForFunction(() => Array.from(document.querySelectorAll('img.dogphoto:not(.off)')).every((i) => i.complete && i.naturalWidth > 0));
    await page.setViewportSize(P.PAPER.portrait);
    const look = await P.paperLook(page, 'dogs');
    expect(look.bars).toEqual([]);
    expect(look.controls, 'no Edit, photo buttons, filter bar, forms or Next links on paper').toEqual([]);
    expect(look.whole).toBe(true);
    expect(look.perRow).toBe(2);
    expect(look.photoInside, 'each photo fills its square box, cropped').toBe(true);
    expect(look.wide).toEqual([]);
    const pdf = await P.printPdf(page, 'cdhub-dogs');
    expect(pdf.boxes.every((b) => P.isA4(b))).toBe(true);
    expect(pdf.count, '32 dogs, 2 a row, 3 rows a page').toBeLessThanOrEqual(6);
  });

  for (const per of [1, 2, 4]) {
    test('t-cdhub-print-a4-spec-3-' + per, async ({ page }) => {
      await P.openCards(page);
      await page.addStyleTag({ content: '*{font-family:"DejaVu Sans",Verdana,sans-serif!important}' });
      await page.getByRole('button', { name: P.PER_LABEL[per] }).click();
      await expect(page.locator('.sheet')).toHaveClass(new RegExp('\\bper' + per + '\\b'));
      // paper width: A4 portrait (the owner's dog card, 18 Nov 2026: two a page one above the other, cut line between)
      await page.setViewportSize(P.PAPER.portrait);
      const fit = await P.cardsFit(page);
      fit.forEach((c) => {
        expect(c.out, c.id + ': nothing past the card edge').toEqual([]);
        expect(c.qr, c.id + ': QR big enough to scan across a kennel (mm)').toBeGreaterThanOrEqual(Math.round({ 1: 66, 2: 55, 4: 35 }[per] * P.MM));
      });
      expect(fit[0].status, 'the "cards ready" line does not print').toBe('none');
      const pdf = await P.printPdf(page, 'cdhub-kennel-cards-' + per + '-per-A4');
      expect(pdf.boxes.every((b) => P.isA4(b)), 'A4 portrait').toBe(true);
      expect(pdf.count, P.CARDS + ' cards, ' + per + ' a page').toBe(Math.ceil(P.CARDS / per));
    });
  }

  test('room cards print two a sheet, each whole, QR at least 50 mm (the owner 18 Nov 2026) @regression', async ({ page }) => {
    await P.openCards(page);
    await page.addStyleTag({ content: '*{font-family:"DejaVu Sans",Verdana,sans-serif!important}' });
    await page.getByRole('button', { name: 'Room cards' }).click();
    await expect(page.locator('.rcard')).toHaveCount(P.SIGNS);
    await expect(page.locator('.rcard').first().locator('.szrow')).toHaveCount(3);
    await page.setViewportSize(P.PAPER.portrait);
    await page.emulateMedia({ media: 'print' });
    const signs = await page.evaluate(() => Array.from(document.querySelectorAll('.rcard')).map((c) => {
      const b = c.getBoundingClientRect(), q = c.querySelector('.code svg').getBoundingClientRect();
      const past = Array.from(c.querySelectorAll('.name,.facts,.rows,.code svg,.foot,.tag')).filter((e) => e.getBoundingClientRect().bottom > b.bottom + 1);
      return { out: past.length, what: past.map((e) => String(e.className.baseVal !== undefined ? 'svg' : e.className)), qr: Math.min(q.width, q.height) };
    }));
    await page.emulateMedia({ media: 'screen' });
    signs.forEach((x, i) => {
      expect(x.out, 'card ' + i + ': nothing past its edge ' + JSON.stringify(x)).toBe(0);
      expect(x.qr, 'card ' + i + ': QR at least 50 mm').toBeGreaterThanOrEqual(Math.round(50 * P.MM));
    });
    const pdf = await P.printPdf(page, 'cdhub-room-cards');
    expect(pdf.count, P.SIGNS + ' room cards, 2 a sheet').toBe(Math.ceil(P.SIGNS / 2));
    expect(pdf.boxes.every((b) => P.isA4(b))).toBe(true);
  });
});

const inkOnPaper = (page, sel) => page.evaluate((q) => {
  const lum = (c) => { const m = c.match(/[\d.]+/g).slice(0, 3).map((x) => +x / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
  return { text: lum(getComputedStyle(document.querySelector(q)).color), page: lum(getComputedStyle(document.documentElement).backgroundColor), theme: document.documentElement.getAttribute('data-theme') };
}, sel);
for (const how of ['device dark mode', 'Look > Dark']) {
  test.describe('CD Hub print on A4, ' + how, () => {
    if (how === 'device dark mode') test.use({ colorScheme: 'dark' });
    else test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('dash-look', JSON.stringify({ mode: 'dark' }))); });
    test('t-cdhub-print-a4-spec-5', async ({ page, guard }) => {
      await P.openHub(page, guard);
      await page.evaluate(() => go('round'));
      const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
      await page.emulateMedia({ media: 'print' });
      const hub = await inkOnPaper(page, '.rcabins .dchip');
      expect(hub.text, 'dog names print near-black').toBeLessThan(0.05);
      expect(hub.page, 'no dark page behind the cards').toBeGreaterThan(0.9);
      await page.emulateMedia({ media: 'screen' });
      await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
      expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe(before);
      expect((await P.printPdf(page, 'cdhub-round-sheet-' + (how === 'Look > Dark' ? 'look' : 'device') + '-dark')).count).toBe(3);

      await P.openCards(page);
      await page.getByRole('button', { name: '4 per A4' }).click();
      await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
      await page.emulateMedia({ media: 'print' });
      const card = await inkOnPaper(page, '.dcard dd');
      expect(card.text, 'card values print near-black').toBeLessThan(0.05);
      await page.emulateMedia({ media: 'screen' });
      await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
      expect((await P.printPdf(page, 'cdhub-kennel-cards-4-per-A4-' + (how === 'Look > Dark' ? 'look' : 'device') + '-dark')).count).toBe(2);
    });
  });
}

