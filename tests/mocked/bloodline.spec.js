// Bloodline screens: https://ljoyrose.github.io/dashboard/bloodline/
// Same pretend Google sign-in and pretend Drive as CD Hub. No real tables, no writes.
const { test, expect, buildWorld } = require('../support/test');
const { IDS } = require('../support/world');

const signIn = async (page) => {
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('body')).toHaveClass(/ready/);
};

test.describe('Bloodline: signed out', () => {
  test('home asks for sign-in and shows no dog', async ({ page }) => {
    const res = await page.goto('bloodline/');
    expect(res.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/bld-home\.html/);
    await expect(page.locator('#main')).toContainText('Sign in to see the tables');
    await expect(page.locator('#main')).toContainText('holds no data of its own');
    await expect(page.locator('#main')).not.toContainText('Test Dog One');
    await expect(page.locator('#nav')).toBeHidden();
  });
});

test.describe('Bloodline: live tables (mocked Drive)', () => {
  test('asks for read-only Drive access and never writes', async ({ page, guard }) => {
    await page.goto('bloodline/bld-home.html');
    await signIn(page);
    const cfg = await page.evaluate(() => window.__GIS_LAST_CONFIG);
    expect(cfg.scope).toBe('https://www.googleapis.com/auth/drive.readonly');
    expect(cfg.client_id).toContain('apps.googleusercontent.com');
    const listing = guard.world.calls.find((c) => c.path === '/files' && c.query.includes(IDS.bld));
    expect(listing, 'folder listing').toBeTruthy();
    expect(listing.query).toContain('trashed = false');
    expect(guard.world.calls.filter((c) => c.method !== 'GET')).toEqual([]);
    expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  });

  test('dogs on file are shown from BLD-subject.csv', async ({ page }) => {
    await page.goto('bloodline/bld-dogs.html');
    await signIn(page);
    const main = page.locator('#main');
    await expect(main).toContainText('Test Dog One');
    await expect(main).toContainText('Test Dog Two');
    await expect(main).toContainText('Test Pup One');
    await expect(page.locator('#count')).toContainText('3 of 3');
  });

  test('a missing table says no data yet instead of a zero', async ({ page }) => {
    await page.goto('bloodline/bld-home.html');
    await signIn(page);
    const main = page.locator('#main');
    await expect(main).toContainText('no data yet');
    await expect(main).toContainText('BLD-vaccination.csv');
    await expect(main.locator('.kpi', { hasText: 'vaccines overdue' })).toContainText('—');
    await expect(main.locator('.kpi', { hasText: 'dogs on record' })).toContainText('3');
    await expect(main).toContainText('Sample item waiting on Lisa');
  });

  test('people, households and field triage say no data yet when the file is not there', async ({ page }) => {
    await page.goto('bloodline/bld-people.html');
    await signIn(page);
    await expect(page.locator('#main')).toContainText('no data yet');
    await expect(page.locator('#main')).toContainText('BLD-person.csv');
    await expect(page.locator('#main')).toContainText('BLD-household.csv');
    await expect(page.locator('#main')).not.toContainText('@');
    await page.goto('bloodline/bld-work.html');
    await expect(page.locator('#main')).toContainText('Sample item waiting on Lisa');
    await expect(page.locator('#main')).toContainText('BLD-FIELD-TRIAGE.csv');
  });

  test('two files with the same title: refuses to guess which is current', async ({ page, guard }) => {
    const w = buildWorld({ bld: { duplicate: ['BLD-subject.csv'] } });
    guard.world.files = w.files;
    guard.world.drives = w.drives;
    await page.goto('bloodline/bld-dogs.html');
    await page.locator('#signinbtn').click();
    await expect(page.locator('#main')).toContainText('More than one file shares a title');
    await expect(page.locator('#main')).toContainText('Refusing to guess which is current');
    await expect(page.locator('#main')).toContainText('BLD-subject.csv');
    await expect(page.locator('#main')).not.toContainText('Test Dog One');
  });

  test('sign out forgets the tables', async ({ page }) => {
    await page.goto('bloodline/bld-dogs.html');
    await signIn(page);
    await page.locator('nav button[data-signout]').click();
    await expect(page.locator('#main')).toContainText('Sign in to see the tables');
    await expect(page.locator('#main')).not.toContainText('Test Dog One');
    expect(await page.evaluate(() => window.__GIS_CALLS.revoke)).toBe(1);
  });

  test('a COUNT note on the first line is not used as the column headings', async ({ page }) => {
    await page.goto('bloodline/bld-home.html');
    const parsed = await page.evaluate(() => {
      const rows = DriveTables.toObjects('COUNT: 111 empty columns, still a note\n"table","column"\nsubject,name\n', 'BLD-FIELD-TRIAGE.csv');
      return { bad: rows.__badHeader || '', cols: rows.__cols, n: rows.length, table: rows[0] && rows[0].table };
    });
    expect(parsed.bad).toBe('');
    expect(parsed.cols).toEqual(['table', 'column']);
    expect(parsed.n).toBe(1);
    expect(parsed.table).toBe('subject');
  });
});

test.describe('Bloodline: usable sires', () => {
  test('says no reference dogs yet when that table is not in the folder', async ({ page }) => {
    await page.goto('bloodline/bld-matings.html');
    await signIn(page);
    await expect(page.locator('#ref-note')).toContainText('no reference dogs yet');
    await expect(page.locator('#sires-usable')).not.toContainText('Test Dog Two');
    await expect(page.locator('#sires-unconfirmed')).toContainText('Test Dog Two');
    await expect(page.locator('#main')).toContainText('neuter_basis');
  });

  test('a usable sire is male, entire, stated or vet, active, alive and ours', async ({ page, guard }) => {
    const sub = guard.world.files.find((f) => f.name === 'BLD-subject.csv');
    const status = guard.world.files.find((f) => f.name === 'BLD-subject_status.csv');
    sub.content = [
      'id,name,sex,neuter_status,neuter_basis,kind',
      'sub-ok,Confirmed Stud,Male,entire,stated,',
      'sub-neu,Neutered Stud,Male,neutered,vet,Stud Male',
      'sub-sold,Sold Stud,Male,entire,stated,Stud Male',
      'sub-none,No Status Male,Male,entire,stated,Stud Male',
      'sub-def,Default Entire,Male,entire,default,Stud Male',
      'sub-miss,Missing Basis,Male,entire,,Stud Male',
      'sub-dead,Dead Male,Male,entire,stated,Stud Male',
      'sub-bitch,Active Bitch,Female,entire,stated,Breeding Female',
    ].join('\n');
    status.content = [
      'subject_id,state',
      'sub-ok,Active',
      'sub-neu,Active',
      'sub-sold,Sold',
      'sub-def,Active',
      'sub-miss,Active',
      'sub-dead,Active',
      'sub-bitch,Active',
    ].join('\n');
    guard.world.file('bld-animana-extra', 'BLD-MAP-animana.csv', [
      'system,subject_id,date_of_death,vet_active,vet_client',
      'animana,sub-dead,2024-05-30,false,Dynamic Dogs Limited',
      'animana,sub-ok,,true,Dynamic Dogs Limited',
    ].join('\n'), { parents: sub.parents, driveId: sub.driveId });
    guard.world.file('bld-ref-extra', 'BLD-ref_dog.csv', [
      'id,call_name,registered_name,sex,sire_ref,dam_ref,chip_number',
      'ref-out,Outside Dam,Outside Dam Registered,Female,sub-ok,,000111',
    ].join('\n'), { parents: sub.parents, driveId: sub.driveId });

    await page.goto('bloodline/bld-matings.html');
    await signIn(page);
    const usable = page.locator('#sires-usable');
    const unconfirmed = page.locator('#sires-unconfirmed');
    const excluded = page.locator('#sires-excluded');
    await expect(usable).toContainText('Confirmed Stud');
    await expect(usable).not.toContainText('Default Entire');
    await expect(usable).not.toContainText('Neutered Stud');
    await expect(usable).not.toContainText('Sold Stud');
    await expect(usable).not.toContainText('No Status Male');
    await expect(usable).not.toContainText('Dead Male');
    await expect(usable).not.toContainText('Outside Dam');
    await expect(unconfirmed).toContainText('Default Entire');
    await expect(unconfirmed).toContainText('Missing Basis');
    await expect(unconfirmed).not.toContainText('Confirmed Stud');
    await expect(excluded).toContainText('Neutered Stud');
    await expect(excluded).toContainText('Sold Stud');
    await expect(excluded).toContainText('No Status Male');
    await expect(excluded).toContainText('Dead Male');
    await expect(excluded).toContainText('no status row');
    await expect(page.locator('#main')).not.toContainText('no reference dogs yet');
    await expect(page.locator('#dam option')).toHaveCount(1);
    await expect(page.locator('#dam option')).toContainText('Active Bitch');
    await page.locator('#dogfind').fill('Outside');
    await expect(page.locator('#dam option', { hasText: 'Outside Dam' })).toHaveCount(1);
    await page.locator('#dam').selectOption('ref-out');
    await expect(page.locator('#coi')).toContainText('Outside Dam');
    await expect(page.locator('#coi')).toContainText('reference dog');
    await page.goto('bloodline/bld-dogs.html');
    await expect(page.locator('#main')).not.toContainText('Outside Dam');
    await expect(page.locator('#count')).toContainText('8 of 8');
  });
});

test.describe('Bloodline: saving stays off', () => {
  test('the build brief disables save and edit and names the write path', async ({ page }) => {
    await page.goto('bloodline/bloodline.html#/questions');
    await signIn(page);
    await expect(page.locator('#main')).toContainText('Saving switches on with the write path (PR #10)');
    const save = page.locator('[data-save]').first();
    await expect(save).toBeDisabled();
    await expect(page.locator('textarea').first()).toBeDisabled();
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
    expect(await page.evaluate(() => DriveTables.SCOPE)).toBe('https://www.googleapis.com/auth/drive.readonly');
  });
});
