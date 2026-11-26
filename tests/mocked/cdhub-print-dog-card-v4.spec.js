// the owner's APPROVED dog card, v4 (15 Nov 2026, re-confirmed 20 Nov 2026 18:26). Two cards per A4 portrait, one above the other,
// a dashed cut line between, each about 194 x 138 mm. Name large top-left with no label; Sex (with its sign) and Date of birth
// labelled top-right; the photo left in a thick frame of the size colour, fitted whole; a Size tile top-aligned with the photo;
// a QR of 62 mm (its black squares) bottom-aligned with the photo, 8 mm clear of the tile; the microchip labelled across the
// bottom. No tag code, room or access text. Invented dogs only.
const { test, expect } = require('../support/test');
const P = require('../support/print-a4');

test('t-cdhub-print-dog-card-v4-spec-1', async ({ page }) => {
  await P.openCards(page);
  await page.getByRole('button', { name: '2 per A4' }).click();
  await page.setViewportSize(P.PAPER.portrait);
  await page.emulateMedia({ media: 'print' });
  const mm = P.MM;
  const cards = await page.evaluate(() => Array.from(document.querySelectorAll('.dcard.vcard')).map((c) => {
    const r = (q) => { const e = c.querySelector(q); if (!e) return null; const x = e.getBoundingClientRect(); return { l: x.left, t: x.top, r: x.right, b: x.bottom, w: x.width, h: x.height }; };
    const svg = c.querySelector('.code svg'), n = +svg.getAttribute('viewBox').split(' ')[2];
    const cb = c.getBoundingClientRect();
    return { card: { l: cb.left, t: cb.top, r: cb.right, b: cb.bottom, w: cb.width, h: cb.height }, name: r('.name'), photo: r('.photo'), size: r('.szb'), qr: r('.code svg'), chip: r('.chipline'), n,
      dts: Array.from(c.querySelectorAll('.facts dt')).map((d) => d.textContent), chipLabel: c.querySelector('.chipline span') && c.querySelector('.chipline span').textContent,
      tag: c.querySelectorAll('.tag').length, nameLabel: c.querySelectorAll('.name dt, .name label').length, border: parseFloat(getComputedStyle(c).borderBottomWidth) > 0 ? getComputedStyle(c).borderBottomStyle : 'none',
      text: c.textContent };
  }));
  expect(cards.length).toBe(P.CARDS);
  expect(cards.filter((c) => c.size).length, 'the fixture has sized dogs').toBeGreaterThan(0);
  cards.forEach((c, i) => {
    const quiet = c.qr.w * 4 / c.n;
    const squares = { t: c.qr.t + quiet, b: c.qr.b - quiet, w: c.qr.w - 2 * quiet };
    expect(Math.abs(c.card.w / mm - 194), 'card about 194 mm wide').toBeLessThan(1);
    expect(c.card.h / mm, 'two cards fit on one A4 (277 mm inside the margins)').toBeLessThanOrEqual(138.5);
    if (c.size) expect(Math.abs(c.size.t - c.photo.t) / mm, 'Size tile top = photo top').toBeLessThan(0.5);
    expect(Math.abs(squares.b - c.photo.b) / mm, 'QR bottom = photo bottom').toBeLessThan(1);
    expect(Math.abs(squares.w / mm - 62), 'QR squares 62 mm').toBeLessThan(1);
    expect((squares.t - (c.photo.t + 18 * mm)) / mm, 'the QR quiet zone stays clear of the tile row').toBeGreaterThanOrEqual(quiet / mm - 0.5);
    expect(Math.abs(c.photo.w - c.photo.h), 'square photo').toBeLessThan(2);
    expect(c.photo.r <= c.qr.l + quiet && (!c.size || c.photo.r <= c.size.l), 'photo left of the tile and QR').toBe(true);
    if (c.chip) { expect(c.chip.t >= c.photo.b, 'microchip under the photo').toBe(true); expect(c.chipLabel).toBe('Microchip'); }
    expect(c.dts).toEqual(['Sex', 'Date of birth']);
    expect(c.tag, 'no tag code printed').toBe(0);
    expect(c.text).not.toMatch(/PRNT|Room A|Room\b|access/i);           // no tag, room or access text
    expect(c.border, 'dashed cut line under the first card of each sheet').toBe(i % 2 === 0 ? 'dashed' : 'none');
  });
  const pdf = await P.printPdf(page, 'cdhub-dog-card-v4');
  expect(pdf.count, P.CARDS + ' cards, 2 a page').toBe(Math.ceil(P.CARDS / 2));
});

test('dog card v4: no photo, or a photo that fails to load, keeps the size-colour frame and prints no word in it', async ({ page, allowedConsole }) => {
  allowedConsole.push(/Failed to load resource.*404/);                                                          // the pretend broken Drive image
  await page.route(/drive\.google\.com\/thumbnail/, (route) => route.fulfill({ status: 404, body: '' }));   // the Drive image fails
  await P.openCards(page, (t) => { t.subject[0].photo = 'PretendBrokenPhoto0'; });
  await page.getByRole('button', { name: '2 per A4' }).click();
  await page.setViewportSize(P.PAPER.portrait);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.dcard[data-dog="d0"] .photo img')).toHaveCount(0);
  const boxes = await page.locator('.dcard.vcard .photo').evaluateAll((els) => els.map((e) => {
    const st = getComputedStyle(e), r = e.getBoundingClientRect();
    return { text: e.textContent.trim(), w: r.width, h: r.height, border: parseFloat(st.borderTopWidth), colour: st.borderTopColor, card: getComputedStyle(e.closest('.dcard')).getPropertyValue('--c').trim() };
  }));
  expect(boxes).toHaveLength(P.CARDS);
  boxes.forEach((b) => {
    expect(b.text, 'no placeholder word printed').toBe('');
    expect(Math.abs(b.w / P.MM - 88), 'the frame keeps its 88 mm square').toBeLessThan(1);
    expect(Math.abs(b.w - b.h)).toBeLessThan(2);
    expect(b.border, 'the thick frame is still there').toBeGreaterThanOrEqual(5);
    expect(b.colour, 'in a colour, not transparent').not.toMatch(/rgba\(0, 0, 0, 0\)/);
  });
  await expect(page.locator('.sheet')).not.toContainText(/\bPhoto\b/);
});

test('dog card v4: a pup under puppy.under_weeks prints purple (size_colour.puppy), from 12 weeks the size colour; no dob = size colour; unknown size = a plain frame', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-21T12:00:00Z'));                     // the print day
  await P.openCards(page, (t) => {
    t.subject[0].dob = '2026-08-30';                                                      // 11 weeks 6 days: a pup
    t.subject[2].dob = '2026-08-29';
    delete t.subject[3].dob;                                                              // no date of birth
    t.subject[4].size_band = ''; t.subject[4].dob = '2022-03-01';                         // no weight, no size
    t.breeding_rule.push(
      { rule_key: 'size_colour.puppy', value: 'purple', effective_from: '2026-11-21', source: 'Pretend user rule' },
      { rule_key: 'puppy.under_weeks', value: '8', effective_from: '2026-01-01', source: 'Pretend older rule' },
      { rule_key: 'puppy.under_weeks', value: '12', effective_from: '2026-11-21', source: 'Pretend user rule' },   // the newest in force wins
      { rule_key: 'puppy.under_weeks', value: '20', effective_from: '2027-01-01', source: 'Pretend later rule' });  // not yet in force
  });
  await page.getByRole('button', { name: '2 per A4' }).click();
  await page.emulateMedia({ media: 'print' });
  const frame = (id) => page.locator('.dcard[data-dog="' + id + '"] .photo').evaluate((e) => {
    const st = getComputedStyle(e); return { colour: st.borderTopColor, text: st.color, border: parseFloat(st.borderTopWidth), word: e.textContent.trim(), c: getComputedStyle(e.closest('.dcard')).getPropertyValue('--c').trim() };
  });
  const tokens = await page.evaluate(() => { const r = getComputedStyle(document.documentElement), probe = (v) => { const d = document.createElement('i'); d.style.color = v; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; };
    return { purple: probe('var(--sz-purple)'), blue: probe('var(--sz-blue)'), orange: probe('var(--sz-orange)') }; });
  const pup = await frame('d0'), twelve = await frame('d2'), noDob = await frame('d3'), unknown = await frame('d4');
  expect(pup.colour, '11 weeks 6 days: purple').toBe(tokens.purple);
  expect(twelve.colour, 'exactly 12 weeks: its size colour (large, blue)').toBe(tokens.blue);
  expect(noDob.colour, 'no date of birth: its size colour (small, orange)').toBe(tokens.orange);
  expect(unknown.c, 'unknown size: no size colour on the card').not.toMatch(/--sz-/);
  expect([tokens.purple, tokens.blue, tokens.orange], 'unknown size: a plain frame, no size or puppy colour').not.toContain(unknown.colour);
  expect(unknown.colour, 'the plain frame is the card ink colour').toBe(unknown.text);
  [pup, twelve, noDob, unknown].forEach((f) => { expect(f.word).toBe(''); expect(f.border).toBeGreaterThan(0); });
  await expect(page.locator('.dcard[data-dog="d4"] [data-k="size"]')).toHaveCount(0);
});

for (const [rule, pupWord] of [[null, 'Small'], ['size', 'Small'], ['puppy', 'Puppy']]) {
  test('dog card v4: puppy.size_tile ' + (rule || 'with no row') + ': a pup\'s Size tile says ' + pupWord + '; a grown dog and a dog with no dob keep the size word', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-21T12:00:00Z'));
    await P.openCards(page, (t) => {
      t.subject[0].dob = '2026-08-30';
      delete t.subject[3].dob;                                                            // no date of birth, small
      t.breeding_rule.push({ rule_key: 'puppy.under_weeks', value: '12', effective_from: '2026-11-21', source: 'Pretend user rule' });
      if (rule) t.breeding_rule.push({ rule_key: 'puppy.size_tile', value: rule, effective_from: '2026-11-21', source: 'Pretend user rule' },
        { rule_key: 'puppy.size_tile', value: rule === 'puppy' ? 'size' : 'puppy', effective_from: '2026-01-01', source: 'Pretend older rule' });   // the newest row in force wins
    });
    const word = (id) => page.locator('.dcard[data-dog="' + id + '"] [data-k="size"] b');
    await expect(word('d0')).toHaveText(pupWord);
    await expect(word('d3')).toHaveText('Small');                                         // no dob: never a pup
    await expect(word('d1')).toHaveText('Medium');                                        // a grown dog
  });
}

