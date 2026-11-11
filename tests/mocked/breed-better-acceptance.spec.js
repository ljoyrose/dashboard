// Breed Better on the CD Hub: acceptance tests.
//
// The full spec is the Drive file RR_Breed-Better_CD-Hub_spec-and-acceptance.md in the Breed Better folder. Each test names the
// spec line it proves (S1, S2 ...). Invented animals only: the hub's own sample dogs plus tests/fixtures/breed-better/.
//
// Two kinds of test:
//  - Fixture and calculator checks run now. They prove the invented rows give the answers the hub tests below expect.
//  - Hub page checks are test.fixme until the Breed Better page and dog-card chip are live on main (another AI is
//    putting them on the hub now). When that lands: remove the fixme on each test, run it, and fix the PAGE, not the test,
//    unless Lisa has changed the spec. Selectors follow PR 362 and breed-better/hub-view.js (#/breed, data-bb-*, .bb-chip);
//    if the live build uses other hooks, change the selector only, never the assertion.
const fs = require('fs');
const path = require('path');
const { test: base, expect } = require('../support/test');
const { buildWorld, IDS } = require('../support/world');
const { tabClick } = require('../support/tabs');

const ROOT = path.resolve(__dirname, '..', '..');
const BB = path.join(ROOT, 'tests', 'fixtures', 'breed-better');
const BB_FILES = fs.readdirSync(BB).filter((f) => f.endsWith('.csv'));
const SCORE_FILES = ['BLD-score_scheme.csv', 'BLD-score_band.csv', 'BLD-score_criterion.csv', 'BLD-score_point.csv', 'BLD-score_enrolment.csv'];
const PENDING = 'Breed Better page and dog-card chip are not on main yet (Grok is building them). Remove fixme once they land.';
const PENDING_TARGET = 'Below target is in the spec but not built: score.js has no target_points yet.';
const PENDING_LABEL = 'Spec wants the Testing label on the dog-card chip too; hub-view.js shows it on the page heading only.';

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

// ---------------------------------------------------------------- hub page, owner (pending)

asOwner.describe('Breed Better acceptance: owner page', () => {
  asOwner.fixme(true, PENDING);

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
    asOwner.fixme(true, PENDING_TARGET);
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
    await expect(health.locator('[data-go]').first()).toBeVisible();
    await health.locator('[data-go]').first().click();
    await expect(page.locator('#main h2')).not.toContainText('Breed Better');
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

  asOwner('S8 wording: Unverified, never Unproven; any date is DD/MM/YY', async ({ page }) => {
    await openBreed(page);
    for (const r of await dogRows(page).all()) {
      await r.click();
      const text = await page.locator('#main').innerText();
      expect(text).not.toMatch(/unproven/i);
      expect(text, 'dates are DD/MM/YY').not.toMatch(/\b\d{4}-\d{2}-\d{2}\b/);
      await page.locator('#bbRoot [data-bb-back]').click();
    }
  });
});

asOwner.describe('Breed Better acceptance: dog card chip', () => {
  asOwner.fixme(true, PENDING);

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
    asOwner.fixme(true, PENDING_LABEL);
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

// ---------------------------------------------------------------- missing data (pending)

notEnrolled.describe('Breed Better acceptance: animal not enrolled', () => {
  notEnrolled.fixme(true, PENDING);
  notEnrolled('S6.1 a dog that is not enrolled has no chip and is not listed', async ({ page }) => {
    await openDogs(page);
    await expect(card(page, 'Test Pup One').locator('.bb-chip')).toHaveCount(0);
    await expect(card(page, 'Test Dog One').locator('.bb-chip')).toHaveCount(1);
    await tabClick(page, '#nav button[data-go="breed"]');
    await expect(page.locator('#bbRoot')).not.toContainText('Test Pup One');
  });
});

noEnrolment.describe('Breed Better acceptance: nothing enrolled', () => {
  noEnrolment.fixme(true, PENDING);
  noEnrolment('S6.2 with no enrolment rows the page says Not set up yet, never a low score', async ({ page }) => {
    await openBreed(page);
    await expect(page.locator('#bbRoot')).toContainText('Not set up yet');
    await expect(page.locator('#bbRoot')).not.toContainText(/\d+ of \d+/);
  });
});

draftScheme.describe('Breed Better acceptance: no active scheme', () => {
  draftScheme.fixme(true, PENDING);
  draftScheme('S6.3 a draft scheme scores nothing and says which table to check', async ({ page }) => {
    await openBreed(page);
    await expect(page.locator('#bbRoot')).toContainText('No active scheme');
    await expect(page.locator('#bbRoot [data-bb-open]')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------- staff (pending)

asStaff.describe('Breed Better acceptance: staff see no change', () => {
  asStaff.fixme(true, PENDING);

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
