// Enquiries under More. Invented BLD rows and the example enquiry list. Nothing is sent.
const { test: base, expect } = require('../support/test');
const { buildWorld, IDS } = require('../support/world');
const { tabClick } = require('../support/tabs');

const CODES = ['call-booked', 'call-held', 'offered', 'parked'];

function world() {
  const d = buildWorld();
  const lit = d.files.find((f) => f.name === 'BLD-litter.csv' && (f.parents || []).includes(IDS.bld));
  lit.content = [
    'id,dam_subject_id,sire_subject_id,born_on,notes,pairing,dob,external_ref,external_ref_system',
    'lit-b,sub-test-dog-1,sub-test-dog-2,2026-01-15,invented,Pair B,2026-01-15,zz26,allocation sheet',
    'lit-a,sub-test-dog-1,sub-test-dog-2,2026-03-02,invented,Pair A,2026-03-02,L-EX1,allocation sheet',
    ''
  ].join('\n');
  const sub = d.files.find((f) => f.name === 'BLD-subject.csv' && (f.parents || []).includes(IDS.bld));
  if (!sub.content.endsWith('\n')) sub.content += '\n';
  sub.content += 'sub-01,Pup One,F,2026-03-02,small,fleece,Pup,entire,invented,sp-dog,Sample Breed,,,,lit-a,,,,\n';
  const put = (name, text) => {
    const f = d.files.find((x) => x.name === name && (x.parents || []).includes(IDS.bld));
    f.content = text;
  };
  put('BLD-person.csv', 'id,tenant_id,full_name,known_as\nper-1,ten-1,Sample Buyer A,\n');
  put('BLD-household.csv', 'id,tenant_id,name,primary_person_id,stage\nhhd-1,ten-1,Sample Home A,per-1,after collection\n');
  put('BLD-subject_owner.csv', 'id,tenant_id,subject_id,person_id,household_id,role\nsow-1,ten-1,sub-test-dog-1,per-1,hhd-1,owner\n');
  d.file('bld-species-x', 'BLD-species.csv', 'id,young_word,adult_female_word,adult_male_word,birth_event_word\nsp-dog,young,female,male,birth\n', { parents: [IDS.bld], driveId: 'drv-alpha1' });
  return d;
}

const test = base.extend({ world: async ({}, use) => use(world()) });

async function openEnquiries(page) {
  await page.goto('cdhub/');
  await page.locator('#signinbtn').click();
  await tabClick(page, '#nav button[data-go="enquiries"]');
  await expect(page.locator('#main h2')).toHaveText('Enquiries');
}

test.describe('CD Hub enquiries', () => {
  test('More opens Enquiries, litters filter, plain stages, and the write button stays hidden', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await openEnquiries(page);
    await expect(page.locator('[data-enq-stamp]')).toHaveText('TEST');
    const options = page.locator('#enqLitter option');
    await expect(options).toHaveCount(3);
    await expect(options.nth(1)).toContainText('Pair A');
    await expect(options.nth(1)).toContainText('2 Mar 2026');
    await expect(options.nth(2)).toContainText('Pair B');
    await expect(options.nth(2)).toContainText('15 Jan 2026');
    await expect(page.locator('[data-enq="K-a000000000000001"] [data-litter-label]')).toHaveText('Pair A 2 Mar 2026');
    await expect(page.locator('[data-litter-label]', { hasText: 'not linked' }).first()).toBeVisible();
    await page.locator('#enqLitter').selectOption('lit-a');
    await expect(page.locator('[data-litter-label]', { hasText: 'not linked' })).toHaveCount(0);
    await expect(page.locator('[data-enq]')).toHaveCount(2);
    await expect(page.locator('[data-litter-label]').first()).toHaveText('Pair A 2 Mar 2026');
    const text = await page.locator('#main').innerText();
    for (const word of ['enquiry', 'deposit', 'working to collection', 'after collection']) expect(text).toContain(word);
    for (const code of CODES) expect(text).not.toContain(code);
    await expect(page.locator('[data-enq-write]')).toHaveCount(0);
    expect(await page.evaluate(() => window.DASH_CONFIG.cdhub.enquiriesWrites)).toBe(false);
    await page.locator('button[data-go="enquiries/litters"]').click();
    await page.locator('a[href="#/dogs/sub-01"]').click();
    await expect(page.locator('#main')).toContainText('Pup One');
    await tabClick(page, '#nav button[data-go="dogs"]');
    await expect(page.locator('article.dc', { hasText: 'Test Dog One' })).toContainText('Owner');
    await expect(page.locator('article.dc', { hasText: 'Test Dog One' })).toContainText('Sample Home A');
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('phone: the section fits 390px and tap targets are at least 44px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openEnquiries(page);
    const box = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, screen: window.innerWidth }));
    expect(box.doc).toBeLessThanOrEqual(box.screen + 1);
    const small = await page.locator('#main .seg button, #main .btn, #enqLitter').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 44).map((e) => e.textContent));
    expect(small).toEqual([]);
  });
});
