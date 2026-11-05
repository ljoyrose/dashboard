// CD Hub SOPs (Stage A): bottom tab, Assocs under More, name labels, colour and frequency filters.
// The seed is the public index only. It has no form addresses, so every row says the form is not on the hub yet.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const { tabClick } = require('../support/tabs');

const SEED = path.resolve(__dirname, '..', '..', 'cdhub', 'sop-index.json');
const rows = () => JSON.parse(fs.readFileSync(SEED, 'utf8'));
const label = (r) => `${r.colour} – ${r.frequency}: ${r.short_name}`;

const signIn = async (page) => {
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
};

const openSops = async (page) => {
  await page.goto('cdhub/#/sops');
  await signIn(page);
  await expect(page.locator('#main h2')).toHaveText('SOPs');
  await expect(page.locator('#soprows [data-sop]')).toHaveCount(48);
};

test('the public seed is 48 name rows and carries no form address', () => {
  const list = rows();
  expect(list).toHaveLength(48);
  const keys = [...new Set(list.flatMap((r) => Object.keys(r)))].sort();
  expect(keys).toEqual(['colour', 'frequency', 'has_form', 'short_name']);
  for (const r of list) expect(['Y', 'N']).toContain(r.has_form);
  const text = JSON.stringify(list);
  expect(text).not.toMatch(/https?:|@|\b\d+\.\d+\b/);
  expect(list.filter((r) => r.short_name === 'Care Rounds')).toHaveLength(1);
  expect(list.map((r) => r.frequency)).not.toContain('As needed');
  const byName = Object.fromEntries(list.map((r) => [r.short_name, r]));
  expect(byName['Mating Plan']).toMatchObject({ colour: 'White', frequency: 'Breeding', has_form: 'Y' });
  expect(byName['Care Check']).toMatchObject({ colour: 'Yellow', frequency: 'Monthly' });
  expect(byName['Full Clean']).toMatchObject({ colour: 'Yellow', frequency: 'Monthly' });
  expect(byName['Fitness Review']).toMatchObject({ colour: 'Yellow', frequency: 'Annual' });
  expect(byName['Parasites and Zoonoses']).toMatchObject({ colour: 'Yellow', frequency: 'Ad hoc' });
  expect(byName['Mating and Retirement']).toMatchObject({ colour: 'Yellow', frequency: 'Breeding' });
  expect(byName['Licence Display']).toMatchObject({ colour: 'White', frequency: 'Ongoing' });
  expect(byName['Signs/Posters Index']).toMatchObject({ colour: 'Purple', frequency: 'Ongoing' });
  for (const name of ['Whelping', 'Puppy Handover', 'Socialisation', 'Puppy Packs']) {
    expect(byName[name].frequency, name).toBe('Per litter');
  }
  for (const old of ['Breeding Schedule', 'Monthly Care', 'Monthly Clean', 'Annual Care', 'Parasite Control']) {
    expect(byName[old], old).toBeUndefined();
  }
});

test('bottom bar is Main, Do, Today, Dogs, SOPs; Assocs is only under More', async ({ page }) => {
  await page.goto('cdhub/');
  await signIn(page);
  await expect(page.locator('#nav > button.ht .htl')).toHaveText(['Main', 'Do', 'Today', 'Dogs', 'SOPs']);
  await expect(page.locator('#nav > button.ht[data-go="buyers"]')).toHaveCount(0);
  await expect(page.locator('#nav > button.ht[data-go="sops"]')).toHaveAttribute('data-slot', '6');
  await page.locator('nav.house-tabs [data-house-more]').click();
  await expect(page.locator('#houseMore button .htl')).toHaveText(['Table map', 'The round', 'Areas', 'Litters', 'Vet link', 'Assocs']);
  await tabClick(page, '#nav button[data-go="sops"]');
  await expect(page).toHaveURL(/#\/sops$/);
  await expect(page.locator('#main h2')).toHaveText('SOPs');
});

test('#/sops lists all 48 labels; colour and frequency filters and search work', async ({ page }) => {
  await openSops(page);
  const want = rows().map(label).sort((a, b) => a.localeCompare(b));
  await expect(page.locator('#soprows .t')).toHaveText(want);
  await expect(page.locator('#sopcnt')).toHaveText('48 of 48');

  await page.locator('[data-fpanel="fp-sops"]').click();
  const opt = (id) => page.locator(`#${id} option`).evaluateAll((els) => els.map((e) => e.value).filter(Boolean));
  expect(await opt('sopcol')).toEqual(['White', 'Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple']);
  expect(await opt('sopfr')).toEqual(['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annual', 'Ongoing', 'Per litter', 'Ad hoc', 'Breeding']);

  await page.locator('#sopcol').selectOption('Yellow');
  await page.locator('#sopfr').selectOption('Daily');
  await expect(page.locator('#soprows [data-sop]')).toHaveCount(4);
  const daily = await page.locator('#soprows [data-sop]').evaluateAll((els) => els.map((e) => e.getAttribute('data-sop')));
  expect(daily).toEqual(['Care Rounds', 'Cleaning', 'Feeding', 'Health Check']);
  await expect(page.locator('#sopcnt')).toHaveText('4 of 48');

  await page.locator('#sopclr').click();
  await expect(page.locator('#soprows [data-sop]')).toHaveCount(48);

  await page.locator('#sopfr').selectOption('Per litter');
  const litter = await page.locator('#soprows [data-sop]').evaluateAll((els) => els.map((e) => e.getAttribute('data-sop')));
  expect(litter).toEqual(['Puppy Handover', 'Puppy Packs', 'Socialisation', 'Whelping']);

  await page.locator('#sopclr').click();
  await page.locator('#sopfr').selectOption('Breeding');
  const breeding = await page.locator('#soprows [data-sop]').evaluateAll((els) => els.map((e) => e.getAttribute('data-sop')));
  expect(breeding).toEqual(['Health Screening', 'Mating Plan', 'Mating and Retirement', 'Ovulation Testing', 'Season Tracking']);

  await page.locator('#sopclr').click();
  await page.locator('#sopcol').selectOption('Purple');
  await expect(page.locator('#soprows .t')).toHaveText('Purple – Ongoing: Signs/Posters Index');
  const purple = await page.locator('#soprows .dot').evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(purple).toBe('rgb(165, 112, 209)');

  await page.locator('#sopclr').click();
  await page.locator('#sopfr').selectOption('Quarterly');
  await expect(page.locator('#soprows [data-sop]')).toHaveCount(0);
  await expect(page.locator('#sopempty')).toHaveText('Nothing matches.');

  const find = async (q, text) => {
    await page.locator('#sopclr').click();
    await page.locator('#sopq').fill(q);
    await expect(page.locator('#soprows .t')).toHaveText(text);
  };
  await find('Care Check', 'Yellow – Monthly: Care Check');
  await find('Mating Plan', 'White – Breeding: Mating Plan');
  await find('Full Clean', 'Yellow – Monthly: Full Clean');
  await find('Fitness Review', 'Yellow – Annual: Fitness Review');
  await find('Parasites and Zoonoses', 'Yellow – Ad hoc: Parasites and Zoonoses');
  await find('Mating and Retirement', 'Yellow – Breeding: Mating and Retirement');
  await find('Care Rounds', 'Yellow – Daily: Care Rounds');

  await page.locator('#sopq').fill('Per litter');
  await expect(page.locator('#soprows [data-sop]')).toHaveCount(4);

  await page.locator('#sopq').fill('no such procedure');
  await expect(page.locator('#soprows [data-sop]')).toHaveCount(0);
  await expect(page.locator('#sopempty')).toBeVisible();
  await expect(page.locator('#sopempty')).toHaveText('Nothing matches.');
});

test('no form address in the seed: every row shows the grey hint and no link', async ({ page }) => {
  await openSops(page);
  await expect(page.locator('#soprows a')).toHaveCount(0);
  await expect(page.locator('#soprows .mut')).toHaveCount(48);
  await expect(page.locator('#soprows .mut').first()).toHaveText('form not on hub yet');
  const tone = await page.locator('#soprows .mut').first().evaluate((e) => {
    const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const hint = rgb(getComputedStyle(e).color);
    const ink = rgb(getComputedStyle(document.body).color);
    const chroma = Math.max(...hint) - Math.min(...hint);
    return { grey: chroma < 40, notInk: hint.join() !== ink.join() };
  });
  expect(tone).toEqual({ grey: true, notInk: true });
  await expect(page.locator('#main')).not.toContainText('📋');
});

test('a clipboard opens only when the row has a form and a real https address', async ({ page }) => {
  const body = JSON.stringify([
    { colour: 'Yellow', frequency: 'Daily', short_name: 'Care Rounds', has_form: 'Y', form_url: 'https://example.com/care-form' },
    { colour: 'Yellow', frequency: 'Daily', short_name: 'Cleaning', has_form: 'Y' },
    { colour: 'Red', frequency: 'Ad hoc', short_name: 'Euthanasia', has_form: 'N', form_url: 'https://example.com/should-not-open' },
    { colour: 'Red', frequency: 'Ad hoc', short_name: 'Inspections', has_form: 'Y', form_url: 'http://example.com/not-https' },
    { colour: 'White', frequency: 'Annual', short_name: 'Sign-Off', has_form: 'Y', form_url: 'javascript:alert(1)' },
  ]);
  await page.route('**/sop-index.json', (route) => route.fulfill({ status: 200, contentType: 'application/json', body }));
  await page.goto('cdhub/#/sops');
  await signIn(page);
  await expect(page.locator('#soprows [data-sop]')).toHaveCount(5);
  const open = page.locator('#soprows a');
  await expect(open).toHaveCount(1);
  await expect(open).toHaveAttribute('href', 'https://example.com/care-form');
  await expect(open).toHaveAttribute('target', '_blank');
  await expect(open.locator('use')).toHaveAttribute('href', '#i-clipboard');
  await expect(page.locator('#soprows [data-sop="Care Rounds"] .t')).toHaveText('Yellow – Daily: Care Rounds');
  await expect(page.locator('#soprows .mut')).toHaveCount(4);
  await expect(page.locator('#soprows')).not.toContainText('javascript:');
  await expect(page.locator('#soprows')).not.toContainText('http://example.com');
});

test('phone width: the SOP list stays on the screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSops(page);
  const w = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, body: document.body.scrollWidth, screen: window.innerWidth }));
  expect(w.doc).toBeLessThanOrEqual(w.screen + 1);
  expect(w.body).toBeLessThanOrEqual(w.screen + 1);
  const short = await page.evaluate(() => [...document.querySelectorAll('#main button, #main select, #nav button')].filter((e) => e.getBoundingClientRect().width > 1 && e.getBoundingClientRect().height < 44).map((e) => e.textContent.trim()));
  expect(short).toEqual([]);
  await page.locator('#sopq').fill('Care Rounds');
  await expect(page.locator('#soprows [data-sop]')).toHaveCount(1);
});
