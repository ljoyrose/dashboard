const { tabClick } = require('../support/tabs');
// JOB 34 (group B): CD Hub buttons, links and states that no other spec proves yet.
// Gap map: kept outside the repo. Every dog, litter and buyer here is invented (Test Dog One, Sample Buyer, @example.test).
const { test, expect, HUBS, IDS, fixture, DRIVE } = require('../fixtures/job34/load');

const tab = async (page, id) => {
  await tabClick(page, `#nav button[data-go="${id}"]`);
  await expect(page.locator(`#nav button[data-go="${id}"]`)).toHaveAttribute('aria-current', 'page');
};
const addTable = (world, name, content) => {
  const f = world.files.find((x) => x.name === name);
  if (f) { f.content = content; f.size = String(content.length); }
  else world.file('bld-job34-' + name, name, content, { parents: [IDS.bld], driveId: 'drv-alpha1' });
};

test.describe('CD Hub: Dogs search, Clear filters and the weighings panel', () => {
  test('typing in Search narrows the cards; Clear filters brings every dog back', async ({ page, guard }) => {
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'dogs');
    await expect(page.locator('#cnt')).toHaveText('3 of 3');
    await page.locator('#q').fill('pup');
    await expect(page.locator('#cnt')).toHaveText('1 of 3');
    await expect(page.locator('.dc .nm')).toHaveText(['Test Pup One']);
    await page.locator('[data-fpanel="fp-dogs"]').click();
    await page.locator('#fs').selectOption('Male');
    await expect(page.locator('#cnt')).toHaveText('0 of 3');
    await page.locator('#clr').click();
    await expect(page.locator('#q')).toHaveValue('');
    await expect(page.locator('#fs')).toHaveValue('');
    await expect(page.locator('#cnt')).toHaveText('3 of 3');
  });

  test('a dog\'s Weight opens its weighings (newest first, with the change), and close shuts it', async ({ page, guard }) => {
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'dogs');
    await page.locator('.dc', { hasText: 'Test Dog One' }).locator('.wtc').first().click();
    const panel = page.locator('#wpanel');
    await expect(panel).toContainText('Test Dog One: weighings');
    await expect(panel.locator('tbody tr')).toHaveCount(2);
    await expect(panel.locator('tbody tr').first()).toContainText('14.6 kg');
    await expect(panel.locator('tbody tr').first()).toContainText('+0.4');
    await expect(panel.locator('tbody tr').last()).toContainText('first');
    await panel.locator('#wclose').click();
    await expect(panel).toBeEmpty();
  });
});

test.describe('CD Hub: Today lists', () => {
  test('a list tile opens its table; flag says saving is off (never pretends to save); close shuts it', async ({ page, guard }) => {
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'today');
    const tile = page.locator('#main .tl[data-list]').first();
    await tile.click();
    const panel = page.locator('#tpanel');
    await expect(panel.locator('table')).toBeVisible();
    const flag = panel.locator('.flagb').first();
    await flag.click();
    await expect(flag).toHaveText('saving off');
    await panel.locator('#tclose').click();
    await expect(panel).toBeEmpty();
  });
});

test.describe('CD Hub: Buyers prospects (invented rows)', () => {
  test('Search, the Buyer signal filter and Clear filters work; Email is a mailto link; Sort by kennel name', async ({ page, guard }) => {
    addTable(guard.world, 'BLD-prospect.csv', fixture('cdhub', 'BLD-prospect.csv'));
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'buyers');
    const rows = page.locator('#brows tr');
    await expect(page.locator('#bcnt')).toHaveText('2 of 2');
    await expect(rows.filter({ hasText: 'Sample Kennel Alpha' }).locator('a', { hasText: 'Email' })).toHaveAttribute('href', 'mailto:buyer.alpha@example.test');
    await page.locator('#bq').fill('bravo');
    await expect(page.locator('#bcnt')).toHaveText('1 of 2');
    await expect(rows).toHaveCount(1);
    await page.locator('#bq').fill('');
    await page.locator('[data-fpanel="fp-buyers"]').click();
    await page.locator('#bsig').selectOption('MODERATE');
    await expect(page.locator('#bcnt')).toHaveText('1 of 2');
    await expect(page.locator('#ach-buyers .achip')).toHaveText(/Buyer signal: Moderate/);
    await page.locator('#bclr').click();
    await expect(page.locator('#bcnt')).toHaveText('2 of 2');
    await page.locator('#bsort').selectOption('name');
    await expect(rows.first()).toContainText('Sample Kennel Alpha');
  });

  // J34-F20 (fixed): RK['VERY STRONG'] is 0, so (RK[x]||9) once sank the strongest lead to the bottom.
  test('J34-F20 default Sort "strongest signal" puts a VERY STRONG lead above a MODERATE one', async ({ page, guard }) => {
    addTable(guard.world, 'BLD-prospect.csv', fixture('cdhub', 'BLD-prospect.csv'));
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'buyers');
    await expect(page.locator('#bsort')).toHaveValue('');
    await expect(page.locator('#brows tr').first()).toContainText('Sample Kennel Alpha');
  });
});

test.describe('CD Hub: addresses and the browser buttons', () => {
  test('a link straight to #/litters, opened before sign-in, lands on Litters after sign-in', async ({ page }) => {
    await page.goto('cdhub/#/litters');
    await expect(page.locator('#signinbtn')).toBeEnabled();
    await page.locator('#signinbtn').click();
    await expect(page.locator('#nav button[data-go="litters"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#main h2')).toHaveText('Litters');
  });

  test('browser Back and Forward move between sections and put focus on the heading', async ({ page, guard }) => {
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'dogs');
    await tab(page, 'vet');
    await page.goBack();
    await expect(page).toHaveURL(/#\/dogs$/);
    await expect(page.locator('#nav button[data-go="dogs"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#main h2')).toBeFocused();
    await page.goForward();
    await expect(page.locator('#nav button[data-go="vet"]')).toHaveAttribute('aria-current', 'page');
  });

  test('an unknown section address falls back to the Map', async ({ page, guard }) => {
    await HUBS.cdhub.open(page, guard);
    await page.goto('cdhub/#/nonsense');
    await expect(page.locator('#nav button[data-go="map"]')).toHaveAttribute('aria-current', 'page');
  });

  test('The round: picking another date redraws the round for that date', async ({ page, guard }) => {
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'round');
    await page.locator('#rdate').fill('2026-01-15');
    await page.locator('#rdate').dispatchEvent('change');
    await expect(page.locator('#rdate')).toHaveValue('2026-01-15');
    await expect(page.locator('.card[data-area]').first()).toContainText('Step 1:');
  });
});

test.describe('CD Hub: entry boxes on The round and Areas (saving not set up, so nothing may claim it saved)', () => {
  test('a temperature with 2 decimals is refused (1 decimal place only); a 1-decimal one says saving off', async ({ page, guard }) => {
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'round');
    await expect(page.locator('#sinkcard')).toContainText('Saving on this device: off');
    const box = page.locator('.tmin').first();
    const area = await box.getAttribute('data-area'), slot = await box.getAttribute('data-slot');
    const msg = page.locator(`.tmsg[data-area="${area}"][data-slot="${slot}"]`);
    await box.fill('12.34');
    await box.blur();
    await expect(msg).toHaveText('1 decimal place only, e.g. 18.5');
    await expect(box).toHaveClass(/\bbad\b/);
    await box.fill('12.5');
    await box.blur();
    await expect(msg).toHaveText('saving off — set it up at the top of this page');
    await expect(box).not.toHaveClass(/\bbad\b/);
  });

  test('changing how a cabin is run (The round) says it is not saved yet; an area\'s access (Areas) says saving off', async ({ page, guard }) => {
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'round');
    const racc = page.locator('.racc').first();
    const ra = await racc.getAttribute('data-area');
    const rv = await racc.locator('option').evaluateAll((o) => o.map((x) => x.value).filter(Boolean));
    await racc.selectOption(rv[rv.length - 1]);
    await expect(page.locator(`.rsave[data-area="${ra}"]`)).toHaveText('how a cabin is run is not saved yet');
    await tab(page, 'areas');
    const aacc = page.locator('.aacc').first();
    const aa = await aacc.getAttribute('data-area');
    const av = await aacc.locator('option').evaluateAll((o) => o.map((x) => x.value).filter(Boolean));
    await aacc.selectOption(av[av.length - 1]);
    await expect(page.locator(`.asave[data-area="${aa}"]`)).toHaveText('saving off');
  });
});

test.describe('CD Hub: max lower than min = min and max typed the wrong way round (Lisa, 7 Nov 2026)', () => {
  test('typing max below min raises a loud alert on both boxes and saves nothing; fixing it clears the alert', async ({ page, guard }) => {
    await page.addInitScript(() => { try { localStorage.setItem('cdhub.sink.url', 'https://script.google.com/macros/s/AKfyTEST_only_123/exec'); localStorage.setItem('cdhub.sink.code', 'test-code-1'); } catch (e) {} });
    const sent = [];
    await page.route(/^https:\/\/script\.google\.com\/macros\//, (route) => { sent.push(route.request().postData()); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result: { status: 'saved', id: 'r1', at: new Date().toISOString() } }) }); });
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'round');
    const mn = page.locator('.tmin[data-slot="am"]').first();
    const area = await mn.getAttribute('data-area');
    const mx = page.locator(`.tmax[data-area="${area}"][data-slot="am"]`);
    const msg = page.locator(`.tmsg[data-area="${area}"][data-slot="am"]`);
    await mn.fill('18.2'); await mn.blur();
    await mx.fill('12.4'); await mx.blur();
    await expect(msg).toHaveAttribute('role', 'alert');
    await expect(msg).toContainText('max (12.4) is lower than min (18.2)');
    await expect(msg).toContainText('Not saved');
    await expect(mn).toHaveClass(/\bbad\b/);
    await expect(mx).toHaveClass(/\bbad\b/);
    expect(sent).toHaveLength(0);
    await mx.fill('21.4'); await mx.blur();
    await expect(msg).toHaveText('saved ✓');
    await expect(mn).not.toHaveClass(/\bbad\b/);
    await expect(msg).not.toHaveAttribute('role', 'alert');
    expect(sent).toHaveLength(1);
  });

  test('with saving off the wrong-way-round alert still shows', async ({ page, guard }) => {
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'round');
    const mn = page.locator('.tmin[data-slot="pm"]').first();
    const area = await mn.getAttribute('data-area');
    await mn.fill('20'); await mn.blur();
    const mx = page.locator(`.tmax[data-area="${area}"][data-slot="pm"]`);
    await mx.fill('19.9'); await mx.blur();
    await expect(page.locator(`.tmsg[data-area="${area}"][data-slot="pm"]`)).toContainText('is lower than min');
  });

  test('a saved reading with max below min fails the Room temperatures data check and is flagged on The round', async ({ page, guard }) => {
    const f = guard.world.files.find((x) => x.name === 'BLD-area_reading.csv');
    f.content = f.content.replace('rdg-0003,ten-test,area-2,temperature,12.00,20.00', 'rdg-0003,ten-test,area-2,temperature,20.00,12.00');
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'shape');
    await expect(page.locator('#checksCard')).toContainText('Room temperatures');
    await expect(page.locator('#checksCard')).toContainText('1 reading has max lower than min');
    await expect(page.locator('#checksCard')).toContainText('2 2026-01-15 20.00–12.00');
    await tab(page, 'round');
    await page.locator('#rdate').fill('2026-01-15');
    await page.locator('#rdate').dispatchEvent('change');
    await expect(page.locator('.tmsg[data-area="area-2"][data-slot="am"]')).toContainText('max lower than min');
    await expect(page.locator('#kept-readings')).toContainText('max lower than min');
  });

  test('with every reading the right way round the check passes', async ({ page, guard }) => {
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'shape');
    await expect(page.locator('#checksCard')).toContainText('every saved reading has max at or above min');
  });
});

test.describe('CD Hub: breeding rules are set by the breeder on Compliance, and litters and matings are checked against them (Lisa, 8 Nov 2026)', () => {
  const LIT = (rows) => 'id,dam_subject_id,sire_subject_id,dob,pairing,status,notes\n' + rows.join('\n') + '\n';
  const RULES = (rows) => 'id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by\n' + rows.join('\n') + '\n';
  const STD = ['brl-1,ten-test,min_months_between_litters,12,2020-01-01,invented,,2026-11-08,owner',
    'brl-2,ten-test,max_litters_per_dam,6,2020-01-01,invented,,2026-11-08,owner',
    'brl-3,ten-test,min_dam_age_months,12,2020-01-01,invented,,2026-11-08,owner'];

  test('with no rules saved yet, nothing is judged and the breeder is sent to Compliance to set them', async ({ page, guard }) => {
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'shape');
    await expect(page.locator('#checksCard')).toContainText('Breeding rules');
    await expect(page.locator('#checksCard')).toContainText('3 of 3 not set yet');
    await expect(page.locator('#checksCard')).toContainText('not checked: set the shortest time between litters on Compliance');
    await tab(page, 'compliance');
    await expect(page.locator('#compProblems')).toContainText('3 of 3 rules not set');
    await expect(page.locator('#compRules tr[data-rule]')).toHaveCount(6);   // 3 breeding rules + look-back + 2 staffing ratios
    await expect(page.locator('#compRules')).toContainText('not set');
  });

  test('rules 12/6/12 and a second litter 9 months after the first: flagged on the check, on Compliance and on Litters', async ({ page, guard }) => {
    addTable(guard.world, 'BLD-breeding_rule.csv', RULES(STD));
    addTable(guard.world, 'BLD-litter.csv', LIT([
      'lit-a,sub-test-dog-1,sub-test-dog-2,2025-02-01,Alpha pairing,born,invented',
      'lit-b,sub-test-dog-1,sub-test-dog-2,2025-11-01,Beta pairing,born,invented']));
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'shape');
    await expect(page.locator('#checksCard')).toContainText('Time between litters');
    await expect(page.locator('#checksCard')).toContainText('2025-02-01 → 2025-11-01 (273 days, rule 12 months)');
    await expect(page.locator('#checksCard')).toContainText('all 3 set');
    await tab(page, 'compliance');
    await expect(page.locator('#compProblems')).toContainText('Litters too close: 273 days apart');
    await expect(page.locator('#compRules tr[data-rule="min_months_between_litters"]')).toContainText('12');
    await tab(page, 'litters');
    await expect(page.locator('#lrows .pill', { hasText: 'too close to another litter' })).toHaveCount(2);
  });

  test('the same litter entered twice (same date) is caught as "same day"', async ({ page, guard }) => {
    addTable(guard.world, 'BLD-breeding_rule.csv', RULES(STD));
    addTable(guard.world, 'BLD-litter.csv', LIT([
      'lit-a,sub-test-dog-1,sub-test-dog-2,2025-02-01,Alpha pairing,born,invented',
      'lit-b,sub-test-dog-1,sub-test-dog-2,2025-02-01,Alpha again,,invented']));
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'shape');
    await expect(page.locator('#checksCard')).toContainText('(same day)');
  });

  test('exactly 12 months apart passes, and a litter with no date of birth (missed or planned) is not counted', async ({ page, guard }) => {
    addTable(guard.world, 'BLD-breeding_rule.csv', RULES(STD));
    addTable(guard.world, 'BLD-litter.csv', LIT([
      'lit-a,sub-test-dog-1,sub-test-dog-2,2025-02-01,Alpha pairing,born,invented',
      'lit-m,sub-test-dog-1,sub-test-dog-2,,Missed pairing,Missed - Mated but Not Pregnant,invented',
      'lit-b,sub-test-dog-1,sub-test-dog-2,2026-02-01,Beta pairing,born,invented']));
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'shape');
    await expect(page.locator('#checksCard')).toContainText('every dam’s litters meet your rule on time between litters');
    await tab(page, 'litters');
    await expect(page.locator('#lrows .pill', { hasText: 'too close to another litter' })).toHaveCount(0);
  });

  test('a changed rule judges each litter by the version in force on its own date', async ({ page, guard }) => {
    addTable(guard.world, 'BLD-breeding_rule.csv', RULES([
      'brl-1,ten-test,min_months_between_litters,12,2020-01-01,invented,,2026-11-08,owner',
      'brl-4,ten-test,min_months_between_litters,18,2025-06-01,invented,,2026-11-08,owner']));
    addTable(guard.world, 'BLD-litter.csv', LIT([
      'lit-a,sub-test-dog-1,sub-test-dog-2,2023-01-01,Alpha pairing,born,invented',
      'lit-b,sub-test-dog-1,sub-test-dog-2,2024-03-01,Beta pairing,born,invented',
      'lit-c,sub-test-dog-1,sub-test-dog-2,2025-07-01,Gamma pairing,born,invented']));
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'shape');
    const c = page.locator('#checksCard');
    await expect(c).toContainText('1 litter is closer');
    await expect(c).toContainText('2024-03-01 → 2025-07-01');
    await expect(c).toContainText('rule 18 months');
    await expect(c).not.toContainText('2023-01-01 → 2024-03-01');
    await tab(page, 'compliance');
    await expect(page.locator('#compRules tr[data-rule="min_months_between_litters"]')).toContainText('12 from');
    await expect(page.locator('#compRules tr[data-rule="min_months_between_litters"]')).toContainText('18 from');
  });

  test('a bitch mated younger than the rule is flagged (dam born 2022-03-01, mated 2025-11-18, rule 48 months)', async ({ page, guard }) => {
    addTable(guard.world, 'BLD-breeding_rule.csv', RULES([
      'brl-3,ten-test,min_dam_age_months,48,2020-01-01,invented,,2026-11-08,owner']));
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'shape');
    await expect(page.locator('#checksCard')).toContainText('Age at mating');
    await expect(page.locator('#checksCard')).toContainText('1 mating was younger than your rule allows');
    await expect(page.locator('#checksCard')).toContainText('mated 2025-11-18, born 2022-03-01 (rule 48 months)');
    await tab(page, 'compliance');
    await expect(page.locator('#compProblems')).toContainText('Mated too young');
  });

  test('a third litter when the rule allows 2 is flagged', async ({ page, guard }) => {
    addTable(guard.world, 'BLD-breeding_rule.csv', RULES([
      'brl-2,ten-test,max_litters_per_dam,2,2020-01-01,invented,,2026-11-08,owner']));
    addTable(guard.world, 'BLD-litter.csv', LIT([
      'lit-a,sub-test-dog-1,sub-test-dog-2,2022-01-01,Alpha pairing,born,invented',
      'lit-b,sub-test-dog-1,sub-test-dog-2,2023-06-01,Beta pairing,born,invented',
      'lit-c,sub-test-dog-1,sub-test-dog-2,2025-01-01,Gamma pairing,born,invented']));
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'shape');
    await expect(page.locator('#checksCard')).toContainText('Litters per bitch');
    await expect(page.locator('#checksCard')).toContainText('litter 3 of 2 allowed (2025-01-01)');
    await tab(page, 'compliance');
    await expect(page.locator('#compProblems')).toContainText('Too many litters');
  });

  test('saving a rule sends ONE breeding_rule row; a change dated on or before the last version is refused in the hub', async ({ page, guard }) => {
    const URL_ = 'https://script.google.com/macros/s/AKfyTEST_only_123/exec';
    await page.addInitScript((u) => { try { localStorage.setItem('cdhub.sink.url', u); localStorage.setItem('cdhub.sink.code', 'test-code-1'); } catch (e) {} }, URL_);
    const sent = [];
    await page.route(/^https:\/\/script\.google\.com\/macros\//, (route) => {
      const b = JSON.parse(route.request().postData() || '{}'); sent.push(b);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result: { status: 'saved', table: b.table, id: 'brl-test-1', at: '2026-11-08T10:00:00Z' } }) });
    });
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'compliance');
    await page.locator('#brSave').click();
    await expect(page.locator('#brMsg')).toHaveText('Choose a rule.');
    await page.locator('#brKey').selectOption('min_months_between_litters');
    await page.locator('#brVal').fill('12');
    await page.locator('#brFrom').fill('2020-01-01');
    await page.locator('#brSrc').fill('licence condition');
    await page.locator('#brSave').click();
    await expect(page.locator('#brMsg')).toHaveText('saved ✓');
    expect(sent.length).toBe(1);
    expect(sent[0]).toMatchObject({ table: 'breeding_rule', action: 'add', fields: { rule_key: 'min_months_between_litters', value: '12', effective_from: '2020-01-01', source: 'licence condition' } });
    await expect(page.locator('#compRules tr[data-rule="min_months_between_litters"]')).toContainText('12');
    await page.locator('#brKey').selectOption('min_months_between_litters');
    await page.locator('#brVal').fill('18');
    await page.locator('#brFrom').fill('2020-01-01');
    await page.locator('#brSave').click();
    await expect(page.locator('#brMsg')).toContainText('A change must start after that date.');
    expect(sent.length).toBe(1);
  });
});

test.describe('CD Hub: The round saves through the save script (one row added, never edited)', () => {
  const URL_ = 'https://script.google.com/macros/s/AKfyTEST_only_123/exec';
  const setUp = async (page) => {
    await page.addInitScript((u) => { try { localStorage.setItem('cdhub.sink.url', u); localStorage.setItem('cdhub.sink.code', 'test-code-1'); } catch (e) {} }, URL_);
  };
  const sink = async (page, answer) => {
    const sent = [];
    await page.route(/^https:\/\/script\.google\.com\/macros\//, (route) => {
      const b = JSON.parse(route.request().postData() || '{}'); sent.push(b);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer(b)) });
    });
    return sent;
  };

  test('min then max: ONE reading is sent as a pair, 1 decimal place, with the morning slot; it says saved', async ({ page, guard }) => {
    await setUp(page);
    const sent = await sink(page, (b) => ({ ok: true, result: { status: 'saved', table: b.table, id: 'rdg-test-1', at: new Date().toISOString() } }));
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'round');
    await expect(page.locator('#sinkcard')).toContainText('Saving on this device: on');
    const box = page.locator('.tmin[data-slot="am"]').first();
    const area = await box.getAttribute('data-area');
    const msg = page.locator(`.tmsg[data-area="${area}"][data-slot="am"]`);
    await box.fill('11.3'); await box.blur();
    await expect(msg).toHaveText('type max too, then it saves');
    expect(sent.length).toBe(0);
    const mx = page.locator(`.tmax[data-area="${area}"][data-slot="am"]`);
    await mx.fill('14.2'); await mx.blur();
    await expect(msg).toHaveText('saved ✓');
    expect(sent.length).toBe(1);
    expect(sent[0]).toMatchObject({ v: 1, table: 'area_reading', action: 'add', code: 'test-code-1', fields: { area_id: area, min_c: '11.3', max_c: '14.2' } });
    expect(sent[0].fields.period_start).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00[+-]\d{2}:\d{2}$/);
    expect(sent[0].request_id).toMatch(/^cd[0-9a-f]{24}$/);
    await mx.fill('14.3'); await mx.blur();                         // a saved reading is never changed from here
    await expect(msg).toContainText('already saved');
    expect(sent.length).toBe(1);
  });

  test('a refusal from the script is shown in plain words and nothing claims it saved', async ({ page, guard }) => {
    await setUp(page);
    await sink(page, () => ({ ok: false, code: 'DUPLICATE', message: 'This looks like the same entry as one already saved.' }));
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'round');
    const box = page.locator('.tmin[data-slot="am"]').first();
    const area = await box.getAttribute('data-area');
    await box.fill('11'); await box.blur();
    await page.locator(`.tmax[data-area="${area}"][data-slot="am"]`).fill('12');
    await page.locator(`.tmax[data-area="${area}"][data-slot="am"]`).blur();
    await expect(page.locator(`.tmsg[data-area="${area}"][data-slot="am"]`)).toHaveText('NOT saved — This looks like the same entry as one already saved.');
  });

  test('adding a dog to a cabin sends one move; a queued move says it is waiting for approval', async ({ page, guard }) => {
    await setUp(page);
    const occ = guard.world.files.find((x) => x.name === 'BLD-occupancy.csv');   // one dog on site (SLA) so the round lists it
    occ.content = occ.content.replace('sub-test-dog-1,area-1,Resident,', 'sub-test-dog-1,area-1,SLA,');
    const sent = await sink(page, (b) => ({ ok: true, result: { status: 'queued', table: b.table, id: 'occ-test-1', pending_id: 'pnd-1' } }));
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'round');
    const pick = await page.locator('.radd').evaluateAll((els) => {
      for (const el of els) { const o = [...el.options].find((x) => x.value && !x.disabled); if (o) return { area: el.dataset.area, dog: o.value }; }
      return null;
    });
    expect(pick, 'the test data has a dog that can be added to a cabin').not.toBeNull();
    const { area, dog } = pick;
    await page.locator(`.radd[data-area="${area}"]`).selectOption(dog);
    await expect(page.locator(`.rsave[data-area="${area}"]`)).toHaveText('sent — waiting for approval');
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ table: 'occupancy', action: 'add', fields: { subject_id: dog, area_id: area } });
  });
});

test.describe('CD Hub: slow and failed reads', () => {
  test('while Drive is slow the pill says it is reading, and no section shows yet; then it goes live', async ({ page }) => {
    await page.goto('cdhub/');
    await expect(page.locator('#signinbtn')).toBeEnabled();
    let held = false; // hold only the first Drive call (the folder listing), so the test stays quick
    await page.route(DRIVE, async (route) => { if (!held) { held = true; await new Promise((r) => setTimeout(r, 2500)); } return route.fallback(); });
    await page.locator('#signinbtn').click();
    await expect(page.locator('#livepill')).toHaveText('…');
    await expect(page.locator('#nav button[data-go]')).toHaveCount(0);
    await expect(page.locator('#livepill')).toContainText('live');
    await expect(page.locator('#nav button[data-go]')).toHaveCount(12);
  });

  test('after a failed read, Try again reads the folder again and the tables load', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/status of 403/);
    guard.world.failWith = { status: 403, reason: 'forbidden', message: 'Sample refusal' };
    await page.goto('cdhub/');
    await expect(page.locator('#signinbtn')).toBeEnabled();
    await page.locator('#signinbtn').click();
    await expect(page.locator('#main')).toContainText('The folder could not be read');
    guard.world.failWith = null;
    await page.locator('#main button[data-reload]').click();
    await expect(page.locator('#livepill')).toContainText('live');
    await expect(page.locator('#nav button[data-go]')).toHaveCount(12);
  });
});

test.describe('CD Hub: phone top bar Look menu (it replaced the More menu, Lisa\'s pick A)', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('Look opens its menu; Escape and a tap outside both close it', async ({ page, guard }) => {
    await HUBS.cdhub.open(page, guard);
    await expect(page.locator('#moreBtn, #moreMenu')).toHaveCount(0);
    const btn = page.locator('#houseLookBtn'), menu = page.locator('#houseLook');
    await btn.click();
    await expect(menu).toBeVisible();
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    await btn.click();
    await expect(menu).toBeVisible();
    await page.mouse.click(195, 760); // the lower page, well away from the header menu
    await expect(menu).toBeHidden();
  });
});
