// Lisa 17 Nov 2026: "a thorough test line by line of the whole hub for working and also layout and design: find and mend".
// One test per fault found in the audit. Pretend Google and Drive only; every row here is invented.
const { test, expect } = require('../support/test');
const { IDS } = require('../support/world');
const { tabClick } = require('../support/tabs');

const signIn = async (page) => {
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
};
const setFile = (world, name, content) => {
  const f = world.files.find((x) => x.name === name);
  if (f) { f.content = content; f.size = String(content.length); }
  else world.file('bld-extra-' + name, name, content, { parents: [IDS.bld], driveId: 'drv-alpha1' });
};
const view = (page, id) => page.evaluate((h) => { location.hash = h; }, '#/' + id);
const box = (loc) => loc.evaluate((e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; });
const open = async (page, width) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('cdhub/');
  await signIn(page);
};

test.describe('CD Hub audit 17 Nov 2026', () => {
  test('a section with one view draws no empty chip strip (Staff, Enquiries, Settings)', async ({ page }) => {
    await open(page, 390);
    await view(page, 'staff');
    await expect(page.locator('#main h2', { hasText: 'Staff' })).toBeVisible();
    await expect(page.locator('#chips')).toBeHidden();
    await view(page, 'litters');
    await expect(page.locator('#chips')).toBeVisible();
  });

  test('the Main tab counts each waiting item once: its number matches Needs you', async ({ page }) => {
    await open(page, 860);
    expect(await page.evaluate(() => (CD.work || []).filter((r) => r.status === 'BLOCKED' && r.owner === 'Lisa').length)).toBe(1);   // also one of the needs
    const same = async () => {
      const n = await page.evaluate(() => needsToday().length);
      const tab = await page.locator('#nav .ht[data-section="main"] .n').textContent();
      const chip = await page.locator('#chips [data-go="today"] .cnt').textContent();
      return n > 0 && tab === String(n) && chip === String(n);
    };
    await expect.poll(same).toBe(true);
  });

  test('Litters reads the sheet\'s own columns: date of birth from born_on, the pair by name, the notes; never the row id', async ({ page, guard }) => {
    setFile(guard.world, 'BLD-litter.csv', 'id,dam_subject_id,sire_subject_id,born_on,notes\nlit-test-1,sub-test-dog-1,sub-test-dog-2,2026-01-20,a pretend first litter\n');
    await open(page, 1280);
    await tabClick(page, '#nav [data-go="litters"]');
    await expect(page.locator('#main .sub')).toHaveText('1 of 1 have a date of birth.');
    const row = page.locator('#lrows tr').first();
    await expect(row).toContainText('Test Dog One × Test Dog Two');
    await expect(row).toContainText('20 Jan 2026');
    await expect(row).toContainText('a pretend first litter');
    await expect(row).not.toContainText('no date of birth');
    await expect(row).not.toContainText('lit-test-1');
    await expect(page.locator('#main thead th')).toHaveText(['pairing', 'born', 'pups', 'notes']);
    await expect(page.locator('#littersCard')).toContainText('1 litter on file');
    await page.locator('[data-fpanel="fp-litters"]').click();
    expect(await page.locator('#ly option').allInnerTexts()).toEqual(['Any', '2026']);
    expect(await page.evaluate(() => litName(CD.litters[0]))).toBe('Test Dog One × Test Dog Two');
  });

  test('counts read as English: "1 stud", "1 here is not in a cabin", "files" not "file(s)"', async ({ page }) => {
    await open(page, 860);
    await tabClick(page, '#nav [data-go="today"]');
    await expect(page.locator('[data-k="licence"] .lb-s')).toHaveText('1 stud');
    await tabClick(page, '#nav [data-go="compliance"]');
    const checks = page.locator('#checksCard');
    await expect(checks).toContainText('1 here is not in a cabin');
    await expect(checks).not.toContainText(/\(s\)/);
    await expect(checks).not.toContainText('ISO');
    await expect(checks).not.toContainText('row 1');
  });

  test('a rule check with no rule set shows "not checked" with a grey dash, never a green tick', async ({ page }) => {
    await open(page, 860);
    await tabClick(page, '#nav [data-go="compliance"]');
    const row = page.locator('#checksCard .ckrow').filter({ has: page.locator('.t', { hasText: /^Time between litters/ }) });
    await expect(row).toHaveClass(/notrun/);
    await expect(row.locator('.mk')).toHaveText('–');
    await expect(row.locator('.sr')).toHaveText(' not checked');
    await expect(row).toBeVisible();
    const b = await box(row.locator('.t'));
    expect(b.left).toBeGreaterThan(0);   // on the card, not hidden away like the skip link
  });

  for (const width of [390, 860]) {
    test(`at ${width}px a fold chevron never sits on the first line of its card`, async ({ page }) => {
      await open(page, width);
      for (const v of ['work', 'today', 'items']) {
        await view(page, v);
        await expect(page.locator('#main button.house-fold').first()).toBeVisible();
        const hits = await page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('#main button.house-fold.house-fold-abs'), (b) => {
          const row = b.closest('[data-fold-box]').querySelector('[data-fold-row]');
          let n = row.nextElementSibling; while (n && n.classList.contains('house-fold')) n = n.nextElementSibling;
          if (!n || !n.getBoundingClientRect().height) return null;
          const over = b.getBoundingClientRect().bottom - n.getBoundingClientRect().top;
          return over > 0.5 ? b.getAttribute('aria-label') + ' by ' + over + 'px' : null;
        }).filter(Boolean));
        expect(hits, v).toEqual([]);
      }
    });
  }

  test('Items with no list yet says so in plain words, with no table names', async ({ page }) => {
    await open(page, 390);
    await view(page, 'items');
    await expect(page.locator('#itmPage')).toContainText('No items yet.');
    await expect(page.locator('#itmPage')).not.toContainText('BLD');
  });

  test('dog card on a phone: Edit sits on the name\'s row at the right; "no chip recorded" is a 44px button inside its own lines', async ({ page }) => {
    await open(page, 390);
    await tabClick(page, '#nav [data-go="dogs"]');
    const card = page.locator('.dc[data-dog="sub-test-dog-2"]');
    const nm = await box(card.locator('.nm')), ed = await box(card.locator('.dedit')), top = await box(card.locator('.dc-top'));
    expect(Math.abs(ed.top - nm.top)).toBeLessThan(12);
    expect(top.right - ed.right).toBeLessThan(16);
    const line = card.locator('[data-k="chip"]'), btn = line.locator('button');
    const lb = await box(line), bb = await box(btn);
    expect(bb.height).toBeGreaterThanOrEqual(44);
    expect(bb.top).toBeGreaterThanOrEqual(lb.top - 0.5);
    expect(bb.bottom).toBeLessThanOrEqual(lb.bottom + 0.5);
    expect(await btn.evaluate((e) => getComputedStyle(e).borderTopWidth)).toBe('1px');   // still a house control with its line
  });

  test('Compliance controls are house controls: the date and Add a rule boxes are 44px on a phone; "Not set only" is a normal tick box', async ({ page }) => {
    await open(page, 390);
    await view(page, 'compliance');
    for (const s of ['#compAsAt', '#brKey', '#brVal', '#brFrom', '#brSrc']) {
      const b = await box(page.locator(s));
      expect(b.height, s).toBeGreaterThanOrEqual(44);
      expect(b.right, s).toBeLessThanOrEqual(390);
    }
    const cb = await box(page.locator('[data-rules-unset]'));
    expect(cb.width).toBeLessThan(30);
    await page.locator('label', { hasText: 'Not set only' }).click();
    await expect(page.locator('[data-rules-unset]')).toBeChecked();
  });

  test('narrow tables as cards: no wide-table padding or sticky action cell, and labels in sentence case', async ({ page, guard }) => {
    setFile(guard.world, 'BLD-WORK.csv', 'id,area,item,status,owner,blocked_on,evidence,note\nW001,sample,Sample item waiting on Lisa,BLOCKED,Lisa,a sample answer,,\n');
    await open(page, 390);
    await tabClick(page, '#nav [data-go="work"]');
    const table = page.locator('#main table.tstack').first();
    const td = table.locator('tbody td[data-label]').nth(1);
    await expect(td).toHaveAttribute('data-label', /^[A-Z]/);
    expect(await td.evaluate((e) => getComputedStyle(e).paddingLeft)).toBe('0px');
    expect(await td.evaluate((e) => getComputedStyle(e, '::before').content)).toMatch(/^"[A-Z]/);
    await page.setViewportSize({ width: 1280, height: 900 });
    const th = page.locator('#main table[data-tidy] thead th', { hasText: 'item' }).first();
    expect(await th.evaluate((e) => getComputedStyle(e, '::first-letter').textTransform)).toBe('uppercase');
  });

  test('a list as cards keeps its action cell in the card, not stuck to the right with a shadow', async ({ page }) => {
    await open(page, 390);
    await tabClick(page, '#nav [data-go="today"]');
    await page.locator('#main .tile', { hasText: 'not yet placed' }).click();
    const act = page.locator('#tpanel table.tstack td.tact').first();
    await expect(act).toBeVisible();
    expect(await act.evaluate((e) => getComputedStyle(e).position)).toBe('static');
  });

  test('Main\'s first card has the same space under the chip row as every other view', async ({ page }) => {
    await open(page, 390);
    const chips = await box(page.locator('#chips')), first = await box(page.locator('#main .hhome > *').first());
    expect(first.top - chips.bottom).toBeGreaterThanOrEqual(10);
  });

  test('Areas names each group in sentence case ("Cabins", not "cabins")', async ({ page }) => {
    await open(page, 860);
    await tabClick(page, '#nav [data-go="areas"]');
    await expect(page.locator('[data-find-group] h3').first()).toContainText(/^Cabins/);
  });

  test('"+N more" on Main is a 44px tap on a phone', async ({ page }) => {
    await open(page, 390);
    const more = page.locator('[data-hm-more]');
    await expect(more).toBeVisible();
    await expect.poll(async () => (await box(more)).height).toBeGreaterThanOrEqual(44);   // Main redraws once the later tables land
  });

  test('today is the kennel\'s day: at 00:30 summer time the hub and the medicine form open on that day, not the UTC day before', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-07-01T23:30:00Z'));   // 00:30 on 2 Jul in London
    await open(page, 1280);
    expect(await page.evaluate(() => todayISO())).toBe('2026-07-02');
    await tabClick(page, '#nav [data-go="dogs"]');
    const card = page.locator('.dc[data-dog="sub-test-dog-1"]');
    await card.locator('details.meds > summary').click();
    await expect(card.locator('details.meds input[name="on"]')).toHaveValue('2026-07-02');
  });

  test('Enquiries All says what its number counts', async ({ page }) => {
    await open(page, 860);
    await view(page, 'enquiries/all');
    await expect(page.locator('[data-enq-count]')).toHaveText(/^\d+ enquir(y|ies)$/);
  });

  for (const width of [390, 1280]) {
    test(`at ${width}px the Compliance folds wear the same chevron box as the card beside them, and still fold`, async ({ page }) => {
      await open(page, width);
      await tabClick(page, '#nav [data-go="compliance"]');
      const sum = page.locator('#compUrgent details.compfold > summary');
      const look = (s) => s.evaluate((e) => { const a = getComputedStyle(e, '::after'), b = getComputedStyle(e, '::before');
        return { content: a.content, w: a.width, h: a.height, line: a.borderTopWidth, chevron: b.borderRightWidth, turn: b.transform }; });
      const house = await page.locator('#checksCard button.house-fold').evaluate((e) => { const s = getComputedStyle(e); return { w: s.width, h: s.height, line: s.borderTopWidth }; });
      const open1 = await look(sum);
      expect(open1.content).toBe('""');   // no ▾ / ▸ characters
      expect({ w: open1.w, h: open1.h, line: open1.line }).toEqual(house);
      expect(open1.chevron).toBe('2px');
      await sum.click();
      await expect(page.locator('#compUrgent details.compfold')).not.toHaveAttribute('open', '');
      await expect.poll(async () => (await look(sum)).turn).not.toBe(open1.turn);   // a quarter turn when folded
    });
  }
});

// Lisa 17 Nov 2026, "yes all" to the audit questions: a touch screen of any width gets the 44px phone tap size.
test.describe('touch screen at 860px (folding phone open)', () => {
  test.use({ viewport: { width: 860, height: 900 }, hasTouch: true, isMobile: true });
  test('house buttons are 44px tall on a touch screen wider than a phone', async ({ page }) => {
    await page.goto('cdhub/');
    const h = await page.evaluate(() => { const b = document.createElement('button'); b.className = 'btn'; b.textContent = 'x'; document.body.appendChild(b); return Math.round(b.getBoundingClientRect().height); });
    expect(h).toBe(44);
  });
});
test('a mouse screen at 860px keeps 36px house buttons', async ({ page }) => {
  await page.setViewportSize({ width: 860, height: 900 });
  await page.goto('cdhub/');
  const h = await page.evaluate(() => { const b = document.createElement('button'); b.className = 'btn'; b.textContent = 'x'; document.body.appendChild(b); return Math.round(b.getBoundingClientRect().height); });
  expect(h).toBe(36);
});

test('plain names: data checks say Links between records, Date formats and Rule history; Settings is the page heading', async ({ page }) => {
  await page.goto('cdhub/');
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
  const names = await page.evaluate(() => [CHECKNAME.joins, CHECKNAME.dates, CHECKNAME['rule changes']]);
  expect(names).toEqual(['Links between records', 'Date formats', 'Rule history']);
});

test('an enquiry card shows the buyer\'s name, with the reference small beside it', async ({ page }) => {
  // Example enquiries show only with this flag (no sheet connected = "No enquiries yet").
  await page.addInitScript(() => localStorage.setItem('cdhub.enquiries.examples', '1'));
  await page.goto('cdhub/');
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
  await page.evaluate(() => go('enquiries/all', false));
  const card = page.locator('[data-enq]').first();
  await expect(card.locator('a.btn').first()).toHaveText(/^Example\d/);
  await expect(card.locator('[data-enq-ref]')).toHaveText(/^E-\d+/);
});
