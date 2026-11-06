// CD Hub SOPs (Stage A): bottom tab, Assocs under More, name labels, colour and frequency filters.
// The seed is the public index only. It has no form addresses, so every row says the form is not on the hub yet.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const { tabClick } = require('../support/tabs');

const SEED = path.resolve(__dirname, '..', '..', 'cdhub', 'sop-index.json');
const TYPES = path.resolve(__dirname, '..', '..', 'cdhub', 'asset-types.json');
const ICONS = path.resolve(__dirname, '..', '..', 'cdhub', 'asset-type-icons.svg');
const rows = () => JSON.parse(fs.readFileSync(SEED, 'utf8'));
const typeCfg = () => JSON.parse(fs.readFileSync(TYPES, 'utf8'));
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
  await expect(page.locator('#soptypes [data-type-code]')).toHaveCount(21);
  const w = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, body: document.body.scrollWidth, screen: window.innerWidth }));
  expect(w.doc).toBeLessThanOrEqual(w.screen + 1);
  expect(w.body).toBeLessThanOrEqual(w.screen + 1);
  const short = await page.evaluate(() => [...document.querySelectorAll('#main button, #main select, #nav button')].filter((e) => e.getBoundingClientRect().width > 1 && e.getBoundingClientRect().height < 44).map((e) => e.textContent.trim()));
  expect(short).toEqual([]);
  await page.locator('#sopq').fill('Care Rounds');
  await expect(page.locator('#soprows [data-sop]')).toHaveCount(1);
});

test('the file-type seed is 21 types and 4 formats, with a matching icon for each', () => {
  const cfg = typeCfg();
  const typeCodes = ['poster', 'sign', 'checklist', 'form', 'log', 'register', 'certificate', 'policy', 'map_plan', 'rota', 'training_record', 'datasheet', 'inspection_report', 'declaration', 'risk_assessment', 'emergency_plan', 'competency_sheet', 'index_pointer', 'schedule', 'programme', 'agreement'];
  const formatCodes = ['photo', 'scan', 'pdf', 'plain_upload'];
  expect(cfg.do_not_remap).toEqual(expect.arrayContaining(['other', 'sheet']));
  expect(cfg.types.map((t) => t.type_code)).toEqual(typeCodes);
  expect(cfg.formats.map((f) => f.format_code)).toEqual(formatCodes);
  expect(cfg.types.every((t) => t.icon_key === t.type_code && t.approval_status === 'approved' && t.enabled === true && t.label)).toBe(true);
  expect(cfg.types.find((t) => t.type_code === 'poster')).toMatchObject({ requires_sop_link: true, allow_unlinked_reconciliation: true });
  expect(cfg.types.find((t) => t.type_code === 'checklist')).toMatchObject({ requires_sop_link: false });
  expect(cfg.formats.map((f) => f.icon_key)).toEqual(['fmt_photo', 'fmt_scan', 'fmt_pdf', 'fmt_upload']);
  expect(cfg.formats.find((f) => f.format_code === 'plain_upload').mime_allowlist).toEqual([]);
  expect(cfg.formats.find((f) => f.format_code === 'pdf').mime_allowlist).toEqual(['application/pdf']);
  for (const banned of ['other', 'sheet', 'sds', 'photo', 'scan', 'pdf', 'plain_upload']) {
    expect(cfg.types.map((t) => t.type_code)).not.toContain(banned);
  }
  const svg = fs.readFileSync(ICONS, 'utf8');
  for (const key of [...cfg.types.map((t) => t.icon_key), ...cfg.formats.map((f) => f.icon_key)]) {
    expect(svg).toContain(`id="i-${key}"`);
  }
  expect(JSON.stringify(cfg)).not.toMatch(/https?:|@|drive\.google|\b0\d{9,}\b/i);
  expect(svg.replace('xmlns="http://www.w3.org/2000/svg"', '')).not.toMatch(/https?:|@|drive\.google|\b0\d{9,}\b/i);
});

test('#/sops names every file type and file format with its icon', async ({ page }) => {
  const cfg = typeCfg();
  await openSops(page);
  await expect(page).toHaveURL(/#\/sops$/);
  await expect(page.locator('#soptypes [data-type-code]')).toHaveCount(21);
  await expect(page.locator('#soptypes .atype-lab')).toHaveText(cfg.types.map((t) => t.label));
  for (const t of cfg.types) {
    const item = page.locator(`#soptypes [data-type-code="${t.type_code}"]`);
    await expect(item).toHaveAttribute('aria-label', t.label);
    await expect(item).toHaveAttribute('data-icon-key', t.icon_key);
    await expect(item.locator('use')).toHaveAttribute('href', `#i-${t.icon_key}`);
    await expect(item.locator('svg')).toHaveAttribute('aria-hidden', 'true');
  }
  await expect(page.locator('#sopformats [data-format-code]')).toHaveCount(4);
  await expect(page.locator('#sopformats .atype-lab')).toHaveText(cfg.formats.map((f) => f.label));
  for (const f of cfg.formats) {
    const item = page.locator(`#sopformats [data-format-code="${f.format_code}"]`);
    await expect(item).toHaveAttribute('aria-label', f.label);
    await expect(item.locator('use')).toHaveAttribute('href', `#i-${f.icon_key}`);
  }
  await expect(page.locator('#soptypes [data-format-code]')).toHaveCount(0);
  await expect(page.locator('#sopformats [data-type-code]')).toHaveCount(0);
  await expect(page.locator('#soprows [data-type-code]')).toHaveCount(0);
  await expect(page.locator('#soprows [data-sop]')).toHaveCount(48);
  await expect(page.locator('#soprows a')).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  const read = await page.evaluate(() => ({
    unmap: ASSET.unmap,
    mime: ASSET.formats.map((f) => [f.format_code, f.mime_allowlist]),
  }));
  expect(read.unmap).toEqual(expect.arrayContaining(['other', 'sheet']));
  expect(read.mime).toEqual(cfg.formats.map((f) => [f.format_code, f.mime_allowlist]));
  const drawn = await page.locator('#soptypes [data-type-code="poster"] svg').evaluate((el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const use = el.querySelector('use');
    const box = use && use.getBoundingClientRect();
    return { w: r.width, h: r.height, stroke: s.stroke, fill: s.fill, uw: box ? box.width : 0, uh: box ? box.height : 0 };
  });
  expect(drawn.w).toBeGreaterThan(10);
  expect(drawn.h).toBeGreaterThan(10);
  expect(drawn.uw).toBeGreaterThan(10);
});

test('other and sheet are not remapped; a real type code keeps its icon and the old form link', async ({ page }) => {
  const sops = JSON.stringify([
    { colour: 'Purple', frequency: 'Ongoing', short_name: 'Signs/Posters Index', has_form: 'Y', form_url: 'https://example.com/posters', type_code: 'index_pointer' },
    { colour: 'Yellow', frequency: 'Daily', short_name: 'Care Rounds', has_form: 'Y', kind: 'checklist', form_url: 'https://example.com/care-form' },
    { colour: 'White', frequency: 'Ad hoc', short_name: 'Read-and-Sign', has_form: 'N', kind: 'other' },
    { colour: 'White', frequency: 'Ongoing', short_name: 'Record Keeping', has_form: 'N', kind: 'sheet' },
    { colour: 'Orange', frequency: 'Breeding', short_name: 'Health Screening', has_form: 'N', kind: 'sds' },
    { colour: 'Red', frequency: 'Ongoing', short_name: 'Emergency Display', has_form: 'Y', kind: 'sheet', type_code: 'poster', form_url: 'https://example.com/poster' },
    { colour: 'Blue', frequency: 'Ad hoc', short_name: 'Transport', has_form: 'N', kind: 'photo' },
  ]);
  const types = JSON.stringify({
    do_not_remap: ['other', 'sheet'],
    types: [
      { type_code: 'checklist', label: 'Checklist', icon_key: 'checklist', approval_status: 'approved', enabled: true, sort: 1 },
      { type_code: 'poster', label: 'Poster', icon_key: 'poster', approval_status: 'approved', enabled: true, sort: 2, requires_sop_link: true },
      { type_code: 'index_pointer', label: 'Index', icon_key: 'index_pointer', approval_status: 'approved', enabled: true, sort: 3 },
      { type_code: 'sign', label: 'Sign', icon_key: 'sign', approval_status: 'proposed', enabled: true, sort: 4 },
      { type_code: 'form', label: 'Form', icon_key: 'form', approval_status: 'approved', enabled: false, sort: 5 },
      { type_code: 'other', label: 'Other', icon_key: 'other', approval_status: 'approved', enabled: true, sort: 6 },
    ],
    formats: [
      { format_code: 'photo', label: 'Photo', icon_key: 'fmt_photo', mime_allowlist: ['image/jpeg'], sort: 1 },
      { format_code: 'scan', label: 'Scan of print', icon_key: 'fmt_scan', mime_allowlist: ['image/jpeg', 'image/png', 'application/pdf'], sort: 2 },
    ],
  });
  await page.route('**/sop-index.json', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: sops }));
  await page.route('**/asset-types.json', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: types }));
  await page.goto('cdhub/#/sops');
  await signIn(page);
  await expect(page.locator('#soptypes .atype-lab')).toHaveText(['Checklist', 'Poster', 'Index']);
  await expect(page.locator('#soptypes')).not.toContainText('Sign');
  await expect(page.locator('#soptypes')).not.toContainText('Form');
  await expect(page.locator('#sopformats .atype-lab')).toHaveText(['Photo', 'Scan of print']);
  const row = (name) => page.locator(`#soprows [data-sop="${name}"]`);
  await expect(row('Care Rounds').locator('.atype-row')).toHaveAttribute('aria-label', 'Checklist');
  await expect(row('Care Rounds').locator('.atype-row use')).toHaveAttribute('href', '#i-checklist');
  await expect(row('Care Rounds').locator('a')).toHaveAttribute('href', 'https://example.com/care-form');
  await expect(row('Care Rounds').locator('a use')).toHaveAttribute('href', '#i-clipboard');
  await expect(row('Signs/Posters Index').locator('.atype-row')).toHaveAttribute('aria-label', 'Index');
  await expect(row('Signs/Posters Index').locator('a')).toHaveAttribute('href', 'https://example.com/posters');
  await expect(row('Emergency Display').locator('.atype-row')).toHaveAttribute('aria-label', 'Poster');
  await expect(row('Emergency Display').locator('a')).toHaveAttribute('href', 'https://example.com/poster');
  for (const name of ['Read-and-Sign', 'Record Keeping', 'Health Screening', 'Transport']) {
    await expect(row(name).locator('[data-type-code]')).toHaveCount(0);
  }
  await expect(row('Health Screening')).not.toContainText('Data sheet');
  await expect(row('Transport')).not.toContainText('Photo');
  await expect(row('Read-and-Sign')).toContainText('form not on hub yet');
  await expect(page.locator('#soprows .t')).toHaveText([
    'Blue – Ad hoc: Transport',
    'Orange – Breeding: Health Screening',
    'Purple – Ongoing: Signs/Posters Index',
    'Red – Ongoing: Emergency Display',
    'White – Ad hoc: Read-and-Sign',
    'White – Ongoing: Record Keeping',
    'Yellow – Daily: Care Rounds',
  ]);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
});
