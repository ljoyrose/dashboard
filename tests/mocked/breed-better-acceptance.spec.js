// Breed Better on the CD Hub: acceptance tests.
//
// The full spec is the Drive file RR_Breed-Better_CD-Hub_spec-and-acceptance.md in the Breed Better folder. Each test names the
// spec line it proves (S1, S2 ...). Invented animals only: the hub's own sample dogs plus tests/fixtures/breed-better/.
//
// Fixture, calculator, owner page, dog-card chip, missing-data, staff and inspector (S10) checks all run. The inspector
// page is cdhub/staff/inspect/ (#441, #442); its script is mocked here with a fake id and fake code. If a test fails,
// fix the PAGE, not the test, unless Lisa has changed the spec. Selectors: #/breed, data-bb-*, .bb-chip (breed-better/hub-view.js).
const fs = require('fs');
const path = require('path');
const { test: base, expect } = require('../support/test');
const { buildWorld, IDS } = require('../support/world');
const { tabClick } = require('../support/tabs');

const ROOT = path.resolve(__dirname, '..', '..');
const BB = path.join(ROOT, 'tests', 'fixtures', 'breed-better');
const BB_FILES = fs.readdirSync(BB).filter((f) => f.endsWith('.csv'));
const SCORE_FILES = ['BLD-score_scheme.csv', 'BLD-score_band.csv', 'BLD-score_criterion.csv', 'BLD-score_point.csv', 'BLD-score_enrolment.csv'];
const MONTHS = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec';

// Expected results for the invented rows (see tests/fixtures/breed-better/README.md). Best first.
const EXPECT = [
  { id: 'sub-test-dog-1', name: 'Test Dog One', verdict: 'Pass', points: '15 of 20' },
  { id: 'sub-test-pup-1', name: 'Test Pup One', verdict: 'Unverified', points: '0 of 20, 15 unverified' },
  { id: 'sub-test-dog-2', name: 'Test Dog Two', verdict: 'Fail', points: '0 of 15' },
];
const FILTERS = ['All', 'Pass', 'Below target', 'Unverified', 'Fail'];

/** Plain CSV (the fixtures hold no quotes or commas inside values). */
function csv(text) {
  const [head, ...rows] = text.trim().split(/\r?\n/);
  const keys = head.split(',');
  return rows.map((line) => { const v = line.split(','); return Object.fromEntries(keys.map((k, i) => [k, v[i] === undefined ? '' : v[i]])); });
}
const readBB = (f) => fs.readFileSync(path.join(BB, f), 'utf8');

/** The Drive the hub reads: the usual sample world plus the Breed Better rows (owner) or without them (staff cannot read them). */
function bbWorld({ owner = true, drop = [], swap = {} } = {}) {
  const d = buildWorld();
  if (!owner) return d;
  const bld = IDS.bld;
  BB_FILES.filter((f) => !drop.includes(f)).forEach((f, i) => d.file('bb-' + i, f, swap[f] || readBB(f), { parents: [bld], driveId: 'drv-alpha1' }));
  return d;
}
const asOwner = base.extend({ world: async ({}, use) => use(bbWorld()) });
const asStaff = base.extend({ world: async ({}, use) => use(bbWorld({ owner: false })) });
const notEnrolled = base.extend({ world: async ({}, use) => use(bbWorld({ swap: { 'BLD-score_enrolment.csv': readBB('BLD-score_enrolment.csv').replace(/\ne3,.*$/m, '') } })) });
const noEnrolment = base.extend({ world: async ({}, use) => use(bbWorld({ swap: { 'BLD-score_enrolment.csv': readBB('BLD-score_enrolment.csv').split('\n')[0] + '\n' } })) });
const draftScheme = base.extend({ world: async ({}, use) => use(bbWorld({ swap: { 'BLD-score_scheme.csv': readBB('BLD-score_scheme.csv').replace(',active,', ',draft,') } })) });

const signIn = async (page) => {
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
};
const openBreed = async (page) => {
  await page.goto('cdhub/');
  await signIn(page);
  await tabClick(page, '#nav button[data-go="breed"]');
  await expect(page.locator('#main h2')).toContainText('Breed Better');
};
const openDogs = async (page) => {
  await page.goto('cdhub/');
  await signIn(page);
  await tabClick(page, '#nav button[data-go="dogs"]');
  await expect(page.locator('#main')).toContainText('Test Dog One');
};
const dogRows = (page) => page.locator('#bbRoot [data-bb-open]');
const card = (page, name) => page.locator('article.dc', { hasText: name });

// ---------------------------------------------------------------- runs now: fixtures and calculator

base.describe('Breed Better acceptance: fixtures (run now)', () => {
  base('S9 privacy: the fixtures name only the hub\'s invented test animals and hold no real data', () => {
    const subjects = csv(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'bld', 'BLD-subject.csv'), 'utf8')).map((r) => r.id);
    const enrolled = csv(readBB('BLD-score_enrolment.csv')).map((r) => r.subject_id);
    expect(enrolled.length).toBeGreaterThan(0);
    for (const id of enrolled) expect(subjects, id + ' must be one of the invented hub test dogs').toContain(id);
    for (const f of BB_FILES) {
      const text = readBB(f);
      expect(text, f + ': no microchip-like number').not.toMatch(/\b\d{15}\b/);
      expect(text, f + ': no address, link or Drive id').not.toMatch(/https?:|@|docs\.google|drive\.google|\b[0-9A-Za-z_-]{28,}\b/);
      expect(text, f + ': no "Unproven" (the word is Unverified)').not.toMatch(/unproven/i);
    }
  });

  base('S3 the invented rows score as the hub tests expect, best first, with today\'s calculator', () => {
    const View = require(path.join(ROOT, 'breed-better', 'hub-view.js'));
    const T = {};
    for (const f of fs.readdirSync(path.join(ROOT, 'tests', 'fixtures', 'bld')).filter((x) => x.endsWith('.csv'))) {
      T[f] = csv(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'bld', f), 'utf8'));
    }
    for (const f of BB_FILES) T[f] = csv(readBB(f));
    const c = View.compute({ T, today: '2026-11-11', esc: (s) => String(s) });
    expect(c.error).toBe('');
    expect(c.results.map((r) => r.subject_id)).toEqual(EXPECT.map((e) => e.id));
    expect(c.results.map((r) => r.gate_result)).toEqual(['pass', 'unverified', 'fail']);
    const pts = (r) => r.points_earned + ' of ' + r.points_available + (r.points_unverified ? ', ' + r.points_unverified + ' unverified' : '');
    expect(c.results.map(pts)).toEqual(EXPECT.map((e) => e.points));
  });

  base('S6 every score file the hub reads has an invented fixture', () => {
    for (const f of SCORE_FILES) expect(BB_FILES, f).toContain(f);
  });
});

// ---------------------------------------------------------------- hub page, owner

asOwner.describe('Breed Better acceptance: owner page', () => {

  asOwner('S4.1 Breed Better sits under More, not as a bottom tab', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await expect(page.locator('nav.house-tabs > button[data-go="breed"]')).toHaveCount(0);
    await page.locator('nav.house-tabs [data-house-more]').click();
    await expect(page.locator('#houseMore button', { hasText: 'Breed Better' })).toBeVisible();
  });

  asOwner('S4.2 the heading says Breed Better and carries the Testing label', async ({ page }) => {
    await openBreed(page);
    await expect(page.locator('#main h2')).toContainText('Testing');
  });

  asOwner('S4.3 animals are listed best to worst, each with verdict and points', async ({ page }) => {
    await openBreed(page);
    await expect(dogRows(page)).toHaveCount(EXPECT.length);
    for (let i = 0; i < EXPECT.length; i++) {
      const row = dogRows(page).nth(i);
      await expect(row).toContainText(EXPECT[i].name);
      await expect(row).toContainText(EXPECT[i].verdict);
      await expect(row).toContainText(EXPECT[i].points);
    }
  });

  asOwner('S4.4 filters run All, Pass, Below target, Unverified, Fail, with All chosen first', async ({ page }) => {
    await openBreed(page);
    const f = page.locator('#bbRoot [data-bb-filter]');
    await expect(f).toHaveCount(FILTERS.length);
    for (let i = 0; i < FILTERS.length; i++) await expect(f.nth(i)).toContainText(FILTERS[i]);
    await expect(f.first()).toHaveAttribute('aria-pressed', 'true');
  });

  asOwner('S4.5 a filter shows only that verdict, and its count matches', async ({ page }) => {
    await openBreed(page);
    const fail = page.locator('#bbRoot [data-bb-filter="fail"]');
    await expect(fail).toContainText('1');
    await fail.click();
    await expect(dogRows(page)).toHaveCount(1);
    await expect(dogRows(page).first()).toContainText('Test Dog Two');
    await page.locator('#bbRoot [data-bb-filter=""]').click();
    await expect(dogRows(page)).toHaveCount(EXPECT.length);
  });

  asOwner('S4.5b find a dog by name keeps focus; sort Name A to Z and Fail to Pass reorder the list', async ({ page }) => {
    await openBreed(page);
    const box = page.locator('#bbSearch');
    await box.fill('two');
    await expect(dogRows(page)).toHaveCount(1);
    await expect(dogRows(page).first()).toContainText('Test Dog Two');
    await expect(box).toBeFocused();
    await box.fill('');
    await expect(dogRows(page)).toHaveCount(EXPECT.length);
    await page.locator('#bbSort').selectOption('name');
    await expect(dogRows(page).locator('.bb-name')).toHaveText(['Test Dog One', 'Test Dog Two', 'Test Pup One']);
    await page.locator('#bbSort').selectOption('attention');
    await expect(dogRows(page).first()).toContainText('Test Dog Two');
  });

  asOwner('S4.6 one animal: sections in order, each foldable with a count, each line says why', async ({ page }) => {
    await openBreed(page);
    await dogRows(page).filter({ hasText: 'Test Pup One' }).click();
    await expect(page.locator('#bbRoot h3')).toContainText('Test Pup One');
    await expect(page.locator('#bbRoot [data-bb-back]')).toBeVisible();
    const bands = page.locator('#bbRoot details.bb-band');
    await expect(bands.locator('summary')).toContainText(['Gates', 'Health', 'Breeding record', 'Status']);
    for (const s of await bands.locator('summary .cnt').all()) await expect(s).toHaveText(/\d/);
    const gates = bands.filter({ hasText: 'Gates' });
    await gates.locator('summary').click();
    await expect(gates).toContainText('Hips pass');
    await expect(gates).toContainText('Unverified');
    await expect(gates).toContainText('No record yet');
    await gates.locator('summary').click();
    await expect(gates).not.toHaveAttribute('open', '');
  });

  asOwner('S4.7 every figure is clickable to where it comes from', async ({ page }) => {
    await openBreed(page);
    await dogRows(page).filter({ hasText: 'Test Dog One' }).click();
    const health = page.locator('#bbRoot details.bb-band', { hasText: 'Health' });
    await health.locator('summary').click();
    await expect(health).toContainText('Recorded: Good');
    const open = health.locator('[data-bb-edit]').first();
    await expect(open).toBeVisible();
    await open.click();
    const screen = page.locator('[data-bb-edit-screen]');
    await expect(screen).toBeVisible();
    await expect(screen.locator('h3')).toContainText('Hips');
    await expect(page.locator('#main h2')).toContainText('Breed Better');
    await screen.getByRole('button', { name: 'Back' }).click();
    await expect(page.locator('#bbRoot h3')).toContainText('Test Dog One');
    await expect(page).toHaveURL(/#\/breed$/);
  });

  asOwner('S7 look: verdict pills and buttons are 1px lines with no fill; each section has a 3px colour line', async ({ page }) => {
    await openBreed(page);
    const pills = page.locator('#bbRoot .bb-v, #main h2 .bb-v');
    expect(await pills.count()).toBeGreaterThan(0);
    for (const p of await pills.all()) {
      const s = await p.evaluate((e) => { const c = getComputedStyle(e); return { w: c.borderTopWidth, bg: c.backgroundColor }; });
      expect(s.w).toBe('1px');
      expect(s.bg).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    }
    await dogRows(page).first().click();
    for (const b of await page.locator('#bbRoot details.bb-band').all()) {
      expect(await b.evaluate((e) => getComputedStyle(e).borderLeftWidth)).toBe('3px');
    }
    const thick = await page.locator('#bbRoot *').evaluateAll((els) => els.filter((e) => {
      const c = getComputedStyle(e);
      return ['Top', 'Right', 'Bottom'].some((k) => c['border' + k + 'Style'] !== 'none' && parseFloat(c['border' + k + 'Width']) > 1) || (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 1);
    }).map((e) => e.className));
    expect(thick, 'only the left colour line may be wider than 1px').toEqual([]);
  });

  asOwner('S8 wording: Unverified, never Unproven; dates read like 2 Mar 2026', async ({ page }) => {
    await openBreed(page);
    for (const r of await dogRows(page).all()) {
      await r.click();
      const text = await page.locator('#main').innerText();
      expect(text).not.toMatch(/unproven/i);
      expect(text, 'no 2026-03-02 dates').not.toMatch(/\b\d{4}-\d{2}-\d{2}\b/);
      expect(text, 'no 02/03/26 dates: they read differently by country').not.toMatch(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/);
      await page.locator('#bbRoot [data-bb-back]').click();
    }
    // Test Dog One's hips X-ray is dated 2025-06-01 in the fixtures
    await dogRows(page).filter({ hasText: 'Test Dog One' }).click();
    await expect(page.locator('#bbRoot')).toContainText('1 Jun 2025');
  });

  asOwner('S11 trial scope: no offspring or post-adoption check-up section', async ({ page }) => {
    await openBreed(page);
    await dogRows(page).first().click();
    await expect(page.locator('#bbRoot')).not.toContainText(/offspring|check-?up/i);
  });
});

asOwner.describe('Breed Better acceptance: dog card chip', () => {

  asOwner('S5.1 each enrolled dog card shows its verdict and points', async ({ page }) => {
    await openDogs(page);
    for (const e of EXPECT) {
      const chip = card(page, e.name).locator('.bb-chip');
      await expect(chip).toHaveCount(1);
      await expect(chip).toContainText(e.verdict);
      await expect(chip).toContainText(e.points.split(',')[0]);
    }
  });

  asOwner('S5.2 the chip carries the Testing label until Lisa signs off', async ({ page }) => {
    await openDogs(page);
    await expect(card(page, 'Test Dog One').locator('.bb-chip')).toContainText('Testing');
  });

  asOwner('S5.3 tapping the chip opens that dog\'s Breed Better detail', async ({ page }) => {
    await openDogs(page);
    await card(page, 'Test Dog Two').locator('.bb-chip').click();
    await expect(page.locator('#main h2')).toContainText('Breed Better');
    await expect(page.locator('#bbRoot h3')).toContainText('Test Dog Two');
    await expect(page.locator('#bbRoot')).toContainText('Fail');
  });
});

// ---------------------------------------------------------------- missing data

notEnrolled.describe('Breed Better acceptance: animal not enrolled', () => {
  notEnrolled('S6.1 a dog that is not enrolled has no chip and is not listed', async ({ page }) => {
    await openDogs(page);
    await expect(card(page, 'Test Pup One').locator('.bb-chip')).toHaveCount(0);
    await expect(card(page, 'Test Dog One').locator('.bb-chip')).toHaveCount(1);
    await tabClick(page, '#nav button[data-go="breed"]');
    await expect(page.locator('#bbRoot')).not.toContainText('Test Pup One');
  });
});

noEnrolment.describe('Breed Better acceptance: nothing enrolled', () => {
  noEnrolment('S6.2 with no enrolment rows the page says Not set up yet, never a low score', async ({ page }) => {
    await openBreed(page);
    await expect(page.locator('#bbRoot')).toContainText('Not set up yet');
    await expect(page.locator('#bbRoot')).not.toContainText(/\d+ of \d+/);
  });
});

draftScheme.describe('Breed Better acceptance: no active scheme', () => {
  draftScheme('S6.3 a draft scheme scores nothing and says which table to check', async ({ page }) => {
    await openBreed(page);
    await expect(page.locator('#bbRoot')).toContainText('No active scheme');
    await expect(page.locator('#bbRoot [data-bb-open]')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------- staff

asStaff.describe('Breed Better acceptance: staff see nothing (Lisa 11 Nov 2026)', () => {

  asStaff('S2 staff (who cannot read the score files) see no Breed Better entry under More', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await page.locator('nav.house-tabs [data-house-more]').click();
    await expect(page.locator('#houseMore button', { hasText: 'Breed Better' })).toHaveCount(0);
  });

  asStaff('S2 staff see no score chip on any dog card', async ({ page }) => {
    await openDogs(page);
    await expect(page.locator('#main .bb-chip')).toHaveCount(0);
    await expect(page.locator('#main')).not.toContainText(/Unverified|Testing/);
  });

  asStaff('S2 typing the Breed Better address shows no scores', async ({ page }) => {
    await page.goto('cdhub/#/breed');
    await signIn(page);
    await expect(page.locator('#main')).not.toContainText(/\d+ of \d+/);
  });
});

// ---------------------------------------------------------------- inspector (spec S10): the staff inspect page, script mocked

const INS_ID = 'FAKE-TEST-ID-456';
const INS_SCRIPT = 'https://script.google.com/macros/s/' + INS_ID + '/exec';
const INS_LINK = 'cdhub/staff/inspect/#s=' + INS_ID + '&c=FAKEINSPECTCODEY';
const INS_CORS = { 'access-control-allow-origin': '*' };
// What the save script hands an inspector code: ticked dogs, ticked columns, chip already cut to its last 4 digits.
const INS_DATA = {
  subject: { fields: ['id', 'name', 'sex', 'dob'], rows: [
    { id: 'z', name: 'Test Dog Zed', sex: 'male', dob: '2021-05-04' },
    { id: 'a', name: 'Test Dog Able', sex: 'female', dob: '2022-03-02' },
    { id: 'm', name: 'Test Dog Mid', sex: 'female', dob: '2020-11-30' }] },
  microchip: { fields: ['id', 'subject_id', 'chip_number'], redacted: { chip_number: 'last4' }, rows: [{ id: 'c1', subject_id: 'a', chip_number: '0042' }] },
  health_screen: { fields: ['id', 'subject_id', 'test', 'grade', 'tested_on'], rows: [{ id: 'h1', subject_id: 'a', test: 'hips', grade: '5', tested_on: '2024-02-03' }] }
};
const inspectRoute = async (page) => {
  const asked = [];
  await page.route(INS_SCRIPT, (r) => {
    if (r.request().method() === 'GET') return r.fulfill({ headers: INS_CORS, json: { saveEnabled: false, readEnabled: true, tables: [], version: 'test' } });
    const b = JSON.parse(r.request().postData());
    asked.push(b.table);
    const t = INS_DATA[b.table];
    if (!t) return r.fulfill({ headers: INS_CORS, json: { ok: false, code: 'NOT_ALLOWED', message: 'no' } });
    return r.fulfill({ headers: INS_CORS, json: { ok: true, result: Object.assign({ ends: '2026-11-18T17:00:00' }, t) } });
  });
  return asked;
};

base.describe('Breed Better acceptance: inspector view', () => {
  base.use({ allowedConsole: [/404/] });
  const openInspector = async (page) => {
    const asked = await inspectRoute(page);
    await page.goto(INS_LINK);
    await expect(page.locator('.ins-dog')).toHaveCount(3);
    return asked;
  };

  base('S10.1 read only: no buttons, boxes or forms that change anything', async ({ page }) => {
    await openInspector(page);
    await expect(page.locator('#screen')).toContainText('Read only');
    await expect(page.locator('button, input, textarea, select, form, [contenteditable], [data-save], [data-edit]')).toHaveCount(0);
  });

  base('S10.2 shows the shared records, never points, target, verdict or ranking, and never asks for a score list', async ({ page }) => {
    const asked = await openInspector(page);
    await expect(page.locator('#screen')).toContainText('Health tests');
    await expect(page.locator('#screen')).not.toContainText(/\d+ of \d+|Below target|target|points|Unverified|\bPass\b|\bFail\b|Testing/i);
    expect(asked.length).toBeGreaterThan(0);
    expect(asked.some((t) => /score|enrol|judg/i.test(t))).toBe(false);
  });

  base('S10.3 dogs are A to Z, not best to worst', async ({ page }) => {
    await openInspector(page);
    await expect(page.locator('.ins-dog h2')).toHaveText(['Test Dog Able', 'Test Dog Mid', 'Test Dog Zed']);
  });

  base('S10.4 the link shows when it ends, as a date like 18 Nov 2026', async ({ page }) => {
    await openInspector(page);
    await expect(page.locator('.ins-ends').first()).toHaveText(new RegExp('Read only\\. This link ends \\d{1,2} (' + MONTHS + ') \\d{4}\\.'));
    await expect(page.locator('.ins-ends').first()).toHaveText('Read only. This link ends 18 Nov 2026.');
  });

  base('S10.5 a microchip ticked as last 4 shows only those 4 digits, and the code leaves the address bar', async ({ page }) => {
    await openInspector(page);
    const able = page.locator('.ins-dog', { hasText: 'Test Dog Able' });
    await expect(able.locator('.ins-list', { hasText: 'Microchip' })).toContainText('Chip number 0042');
    expect(await page.locator('#screen').innerText()).not.toMatch(/\d{5,}/);
    expect(page.url()).not.toContain('FAKEINSPECTCODEY');
    expect(page.url()).not.toContain(INS_ID);
  });

  base('S10.6 an inspector page on a phone (360px) needs no sideways scroll', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await openInspector(page);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(wide).toBeLessThanOrEqual(0);
  });
});
