// CD Hub SOPs (Stage A + S2 + file types): bottom tab, Assocs under More, name labels,
// colour, frequency, category and role filters, and the labelled type icons with the format legend.
// The seed is the public index only. It has no form addresses, so a row with a form says the form is not on the hub yet.
// A row shows a type icon only when its type is already one of the 21. other, sheet and sds stay unmapped.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const { tabClick } = require('../support/tabs');
const { IDS } = require('../support/world');

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
  await expect(page.locator('#soprows [data-sop]')).toHaveCount(49);
};

const CATEGORIES = ['Breeding health', 'Daily care & premises', 'Emergency & safety', 'Licence & records', 'Puppy sale & handover', 'Signs & posters', 'Staff'];
const ROLES = ['licence_holder', 'manager', 'kennel_staff', 'all_staff'];

test('the public seed is 49 name rows and carries no form address', () => {
  const list = rows();
  expect(list).toHaveLength(49);
  const keys = [...new Set(list.flatMap((r) => Object.keys(r)))].sort();
  expect(keys).toEqual(['category', 'colour', 'frequency', 'has_form', 'role', 'short_name']);
  for (const r of list) {
    expect(['Y', 'N']).toContain(r.has_form);
    expect(CATEGORIES).toContain(r.category);
    expect(ROLES).toContain(r.role);
  }
  const text = JSON.stringify(list);
  expect(text).not.toMatch(/https?:|@|\b\d+\.\d+\b|docs\.google|drive\.google|spreadsheet/i);
  expect(text).not.toMatch(/inspector_view|Internal only/);
  const tally = (key) => list.reduce((m, r) => { m[r[key]] = (m[r[key]] || 0) + 1; return m; }, {});
  expect(tally('category')).toEqual({
    'Licence & records': 6,
    'Emergency & safety': 9,
    'Breeding health': 1,
    'Daily care & premises': 24,
    Staff: 4,
    'Puppy sale & handover': 4,
    'Signs & posters': 1,
  });
  expect(tally('role')).toEqual({ kennel_staff: 21, manager: 12, licence_holder: 9, all_staff: 7 });
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
  expect(byName['Signs/Posters Index']).toMatchObject({ colour: 'Purple', frequency: 'Ongoing', category: 'Signs & posters', role: 'all_staff' });
  expect(byName['Pest Checks']).toMatchObject({ category: 'Daily care & premises', role: 'all_staff' });
  expect(byName['Pest Control']).toMatchObject({ category: 'Daily care & premises', role: 'kennel_staff' });
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
  await expect(page.locator('#houseMore button .htl')).toHaveText(['Compliance', 'Table map', 'The round', 'Areas', 'Litters', 'Vet link', 'Assocs', 'Breed Better']);
  await tabClick(page, '#nav button[data-go="sops"]');
  await expect(page).toHaveURL(/#\/sops$/);
  await expect(page.locator('#main h2')).toHaveText('SOPs');
});

test('#/sops lists all 49 labels; colour and frequency filters and search work', async ({ page }) => {
  await openSops(page);
  const want = rows().map(label).sort((a, b) => a.localeCompare(b));
  await expect(page.locator('#soprows .t')).toHaveText(want);
  await expect(page.locator('#sopcnt')).toHaveText('49 of 49');

  await page.locator('[data-fpanel="fp-sops"]').click();
  const opt = (id) => page.locator(`#${id} option`).evaluateAll((els) => els.map((e) => e.value).filter(Boolean));
  expect(await opt('sopcol')).toEqual(['White', 'Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple']);
  expect(await opt('sopfr')).toEqual(['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annual', 'Ongoing', 'Per litter', 'Ad hoc', 'Breeding']);

  await page.locator('#sopcol').selectOption('Yellow');
  await page.locator('#sopfr').selectOption('Daily');
  await expect(page.locator('#soprows [data-sop]')).toHaveCount(4);
  const daily = await page.locator('#soprows [data-sop]').evaluateAll((els) => els.map((e) => e.getAttribute('data-sop')));
  expect(daily).toEqual(['Care Rounds', 'Cleaning', 'Feeding', 'Health Check']);
  await expect(page.locator('#sopcnt')).toHaveText('4 of 49');

  await page.locator('#sopclr').click();
  await expect(page.locator('#soprows [data-sop]')).toHaveCount(49);

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

test('category and role filters combine with colour, frequency, search and sort', async ({ page }) => {
  await openSops(page);
  await expect(page.locator('#soptypes [data-type-code]')).toHaveCount(21);
  await expect(page.locator('#sopformats [data-format-code]')).toHaveCount(4);
  await expect(page.locator('#soprows [data-type-code]')).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await page.locator('[data-fpanel="fp-sops"]').click();
  await expect(page.locator('#fp-sops .flab')).toHaveText(['Colour', 'Frequency', 'Category', 'Role']);
  const opt = (id) => page.locator(`#${id} option`).evaluateAll((els) => els.map((e) => e.value).filter(Boolean));
  const text = (id) => page.locator(`#${id} option`).evaluateAll((els) => els.map((e) => e.textContent).filter((t) => t && t !== 'Any'));
  expect(await opt('sopcat')).toEqual(CATEGORIES);
  expect(await opt('soprole')).toEqual(ROLES);
  expect(await text('soprole')).toEqual(['Licence holder', 'Manager', 'Kennel staff', 'All staff']);
  expect(await opt('soprole')).not.toContain('inspector_view');

  await page.locator('#sopcat').selectOption('Daily care & premises');
  await expect(page.locator('#sopcnt')).toHaveText('24 of 49');
  await page.locator('#soprole').selectOption('kennel_staff');
  await expect(page.locator('#sopcnt')).toHaveText('18 of 49');
  await page.locator('#sopcol').selectOption('Yellow');
  await page.locator('#sopfr').selectOption('Daily');
  const daily = await page.locator('#soprows [data-sop]').evaluateAll((els) => els.map((e) => e.getAttribute('data-sop')));
  expect(daily).toEqual(['Care Rounds', 'Cleaning', 'Feeding', 'Health Check']);
  await expect(page.locator('#ach-sops .achip')).toHaveText([
    'Colour: Yellow ×',
    'Frequency: Daily ×',
    'Category: Daily care & premises ×',
    'Role: Kennel staff ×',
  ]);

  await page.locator('#sopclr').click();
  await expect(page.locator('#soprows [data-sop]')).toHaveCount(49);
  await page.locator('#sopcat').selectOption('Staff');
  await page.locator('#soprole').selectOption('manager');
  const staff = await page.locator('#soprows [data-sop]').evaluateAll((els) => els.map((e) => e.getAttribute('data-sop')));
  expect(staff).toEqual(['Induction', 'Staff Training', 'Staff Rota']);
  await page.locator('.achip[data-fclear="soprole"]').click();
  await expect(page.locator('#soprows [data-sop]')).toHaveCount(4);
  await page.locator('#sopq').fill('rota');
  await expect(page.locator('#soprows .t')).toHaveText('Green – Weekly: Staff Rota');

  await page.locator('#sopclr').click();
  await page.locator('#soprole').selectOption('all_staff');
  const allStaff = await page.locator('#soprows [data-sop]').evaluateAll((els) => els.map((e) => e.getAttribute('data-sop')));
  expect(allStaff).toContain('Pest Checks');
  expect(allStaff).not.toContain('Pest Control');
  expect(allStaff).toHaveLength(7);
  await page.locator('#soprole').selectOption('kennel_staff');
  const kennel = await page.locator('#soprows [data-sop]').evaluateAll((els) => els.map((e) => e.getAttribute('data-sop')));
  expect(kennel).toContain('Pest Control');
  expect(kennel).not.toContain('Pest Checks');

  await page.locator('#sopclr').click();
  await page.locator('#sopsort').selectOption('category');
  await expect(page.locator('#soprows .t').first()).toHaveText('Orange – Breeding: Health Screening');
  await page.locator('#sopsort').selectOption('role');
  await expect(page.locator('#soprows .t').first()).toHaveText('Green – Ongoing: Staffing Ratio and Cover');
  await page.locator('#sopcat').selectOption('Staff');
  await page.locator('#sopcol').selectOption('Yellow');
  await expect(page.locator('#soprows [data-sop]')).toHaveCount(0);
  await expect(page.locator('#sopempty')).toHaveText('Nothing matches.');
  await expect(page.locator('#soptypes [data-type-code]')).toHaveCount(21);
  await expect(page.locator('#sopformats [data-format-code]')).toHaveCount(4);
});

test('inspector view is a role filter only when a row uses that code', async ({ page }) => {
  const body = JSON.stringify([
    { colour: 'White', frequency: 'Annual', category: 'Licence & records', role: 'inspector_view', short_name: 'Inspector Note', has_form: 'N' },
    { colour: 'White', frequency: 'Annual', category: 'Licence & records', role: 'manager', short_name: 'Microchip Audit', has_form: 'Y' },
  ]);
  await page.route('**/sop-index.json', (route) => route.fulfill({ status: 200, contentType: 'application/json', body }));
  await page.goto('cdhub/#/sops');
  await signIn(page);
  await expect(page.locator('#soprows [data-sop]')).toHaveCount(2);
  await page.locator('[data-fpanel="fp-sops"]').click();
  const withRow = await page.locator('#soprole option').evaluateAll((els) => els.map((e) => ({ value: e.value, text: e.textContent })).filter((o) => o.value));
  expect(withRow.map((o) => o.value)).toEqual(ROLES.concat(['inspector_view']));
  expect(withRow.map((o) => o.text)).toContain('Inspector view');
  await page.locator('#soprole').selectOption('inspector_view');
  await expect(page.locator('#soprows .t')).toHaveText('White – Annual: Inspector Note');
  await expect(page.locator('#ach-sops .achip')).toHaveText(['Role: Inspector view ×']);
  await expect(page.locator('#soprows')).not.toContainText('inspector_view');
});

test('no form address in the seed: rows with a form show the grey hint and no link', async ({ page }) => {
  await openSops(page);
  await expect(page.locator('#soprows a')).toHaveCount(0);
  await expect(page.locator('#soprows .mut')).toHaveCount(rows().filter((r) => r.has_form === 'Y').length);
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
  await expect(page.locator('#soprows .mut')).toHaveCount(3);
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
  await expect(page.locator('#soprows [data-sop]')).toHaveCount(49);
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
    { colour: 'Yellow', frequency: 'Daily', short_name: 'Care Rounds', has_form: 'Y', kind: 'checklist', category: 'Daily care & premises', role: 'kennel_staff', form_url: 'https://example.com/care-form' },
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
  await expect(row('Read-and-Sign')).not.toContainText('form not on hub yet');
  await expect(row('Care Rounds')).not.toContainText('form not on hub yet');
  await page.locator('[data-fpanel="fp-sops"]').click();
  await page.locator('#soprole').selectOption('kennel_staff');
  await expect(page.locator('#soprows [data-sop]')).toHaveCount(1);
  await expect(row('Care Rounds').locator('.atype-row')).toHaveAttribute('aria-label', 'Checklist');
  await expect(row('Care Rounds').locator('a')).toHaveAttribute('href', 'https://example.com/care-form');
  await expect(page.locator('#soptypes [data-type-code]')).toHaveCount(3);
  await page.locator('#sopclr').click();
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

// The wording is private and lives in a Drive file read after sign-in. These tests use made-up text.
const CARD_FILE = 'BLD-sop_cards.json';
const CARDS = {
  source: 'test',
  cards: [
    {
      short_name: 'Care Rounds', colour: 'Yellow',
      intro: [{ t: 'p', x: 'Example **intro** <img src=x onerror=alert(1)>' }],
      sections: [{ h: 'Steps', blocks: [{ t: 'ol', items: ['First step', 'Second step'] }, { t: 'p', x: 'A note' }] }, { h: 'Empty heading', blocks: [] }],
      links: [
        { type_code: 'sign', label: 'B.2 Example Sign', url: 'https://example.com/sign-b2' },
        { type_code: 'sign', label: 'D.1 No File', url: '' },
        { type_code: 'sign', label: 'D.2 Bad Link', url: 'javascript:alert(1)' },
      ],
    },
    { short_name: 'Signs/Posters Index', colour: 'Purple', intro: [{ t: 'p', x: 'Index intro' }], sections: [], links: [{ type_code: 'index_pointer', label: 'Example Index', url: 'https://example.com/index' }] },
  ],
};
const addCards = (world, id = 'sop-cards', body = JSON.stringify(CARDS)) =>
  world.file(id, CARD_FILE, body, { parents: [IDS.bld], driveId: 'drv-alpha1', mimeType: 'application/json' });
const sopRow = (page, name) => page.locator(`#soprows [data-sop="${name}"]`);
const tapSop = (page, name) => sopRow(page, name).locator('.sopopen').click();
const sopBody = (page, name) => page.locator(`#soprows [data-sop-body="${name}"]`);

test('tapping a SOP opens its private wording, folded sections, and closes again', async ({ page, world }) => {
  addCards(world);
  await openSops(page);
  const btn = sopRow(page, 'Care Rounds').locator('.sopopen');
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await tapSop(page, 'Care Rounds');
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  const body = sopBody(page, 'Care Rounds');
  await expect(body.locator('p').first()).toHaveText('Example intro <img src=x onerror=alert(1)>');
  await expect(body.locator('p b').first()).toHaveText('intro');
  await expect(body.locator('img')).toHaveCount(0);
  await expect(body.locator('.sopmeta')).toContainText('Applies to: Kennel staff');
  const sec = body.locator('details.sopsec');
  await expect(sec.locator('summary')).toHaveText('Steps 3');
  await expect(sec.locator('ol li').first()).toBeHidden();
  await sec.locator('summary').click();
  await expect(sec.locator('ol li')).toHaveText(['First step', 'Second step']);
  await tapSop(page, 'Signs/Posters Index');
  await expect(body).toHaveCount(0);
  await expect(sopBody(page, 'Signs/Posters Index')).toContainText('Index intro');
  await tapSop(page, 'Signs/Posters Index');
  await expect(page.locator('#soprows [data-sop-body]')).toHaveCount(0);
});

test('linked signs show their icon on the row and open only from a real https address', async ({ page, world }) => {
  addCards(world);
  await openSops(page);
  const badge = sopRow(page, 'Care Rounds').locator('.sopsigns');
  await expect(badge).toHaveAttribute('aria-label', '3 linked signs');
  await expect(badge.locator('use')).toHaveAttribute('href', '#i-sign');
  await tapSop(page, 'Care Rounds');
  const body = sopBody(page, 'Care Rounds');
  await expect(body.locator('.soplink use').first()).toHaveAttribute('href', '#i-sign');
  const link = body.locator('a.soplink');
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute('href', 'https://example.com/sign-b2');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener');
  await expect(body.locator('span.soplink')).toHaveText([/D\.1 No File/, /D\.2 Bad Link/]);
  await tapSop(page, 'Signs/Posters Index');
  await expect(sopBody(page, 'Signs/Posters Index').locator('a.soplink use')).toHaveAttribute('href', '#i-index_pointer');
});

test('a SOP with no wording in the master says it is not written yet', async ({ page, world }) => {
  addCards(world);
  await openSops(page);
  await tapSop(page, 'Staff Rota');
  await expect(sopBody(page, 'Staff Rota')).toContainText('Not written yet');
});

test('no wording file: the SOP says the file is missing', async ({ page }) => {
  await openSops(page);
  await tapSop(page, 'Care Rounds');
  await expect(sopBody(page, 'Care Rounds')).toContainText('not in the Drive folder yet');
});

test('two wording files: the hub refuses to guess and names the file', async ({ page, world }) => {
  addCards(world, 'sop-cards-1');
  addCards(world, 'sop-cards-2');
  await page.goto('cdhub/#/sops');
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#main')).toContainText(CARD_FILE);
  await expect(page.locator('#soprows')).toHaveCount(0);
});

test('a broken wording file shows a message, not a crash', async ({ page, world }) => {
  addCards(world, 'sop-cards', 'not json');
  await openSops(page);
  await tapSop(page, 'Care Rounds');
  await expect(sopBody(page, 'Care Rounds')).toContainText('could not be read');
});

test('phone width: an open SOP stays on the screen and every target is 44px', async ({ page, world }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  addCards(world);
  await openSops(page);
  await tapSop(page, 'Care Rounds');
  await sopBody(page, 'Care Rounds').locator('summary').click();
  const w = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, screen: window.innerWidth }));
  expect(w.doc).toBeLessThanOrEqual(w.screen + 1);
  const short = await page.evaluate(() => [...document.querySelectorAll('#soprows button, #soprows a, #soprows summary')].filter((e) => e.getBoundingClientRect().height < 44).map((e) => e.textContent.trim()));
  expect(short).toEqual([]);
  const line = await sopBody(page, 'Care Rounds').evaluate((e) => getComputedStyle(e).borderLeftWidth);
  expect(line).toBe('3px');
});
