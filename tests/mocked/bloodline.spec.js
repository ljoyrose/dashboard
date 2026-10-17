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
  test('an entire active male with no owner row is a usable sire', async ({ page }) => {
    await page.goto('bloodline/bld-matings.html');
    await signIn(page);
    await expect(page.locator('#sires-usable')).toContainText('Test Dog Two');
    await expect(page.locator('#sires-excluded')).not.toContainText('Test Dog Two');
    await expect(page.locator('#sires-unconfirmed')).toHaveCount(0);
    await expect(page.locator('#main')).not.toContainText('neuter_basis');
    await expect(page.locator('#main')).not.toContainText('Unconfirmed');
    await expect(page.locator('#main')).not.toContainText('reference dog');
    await expect(page.locator('#dam option')).toHaveCount(3);
    await expect(page.locator('#sire option')).toHaveCount(3);
    await page.locator('#damfind').fill('Pup');
    await expect(page.locator('#dam option')).toHaveCount(1);
    await page.locator('#dam').selectOption('sub-test-pup-1');
    await expect(page.locator('#coi')).toContainText('Test Pup One');
  });

  test('a usable sire is male, entire, active, alive and ours', async ({ page, guard }) => {
    const sub = guard.world.files.find((f) => f.name === 'BLD-subject.csv');
    const status = guard.world.files.find((f) => f.name === 'BLD-subject_status.csv');
    const occ = guard.world.files.find((f) => f.name === 'BLD-occupancy.csv');
    const placed = { parents: sub.parents, driveId: sub.driveId };
    sub.content = [
      'id,name,sex,neuter_status,kind',
      'sub-ok,Confirmed Stud,Male,entire,',
      'sub-lisa,Lisa Owned,Male,entire,',
      'sub-fam,Family Stud,Male,entire,',
      'sub-mark,Marker Stud,Male,entire,',
      'sub-cc,Cerys Stud,Male,entire,',
      'sub-past,Closed Owner,Male,entire,',
      'sub-neu,Neutered Stud,Male,neutered,Stud Male',
      'sub-sold,Sold Stud,Male,entire,Stud Male',
      'sub-none,No Status Male,Male,entire,Stud Male',
      'sub-dead,Dead Male,Male,entire,Stud Male',
      'sub-buyer,Buyer Stud,Male,entire,Stud Male',
      'sub-bitch,Active Bitch,Female,entire,Breeding Female',
      'sub-off,Collected Bitch,Female,entire,Breeding Female',
    ].join('\n');
    status.content = [
      'subject_id,state',
      'sub-ok,Active',
      'sub-lisa,Active',
      'sub-fam,Active',
      'sub-mark,Active',
      'sub-cc,Active',
      'sub-past,Active',
      'sub-neu,Active',
      'sub-sold,Sold',
      'sub-dead,Active',
      'sub-buyer,Active',
      'sub-bitch,Active',
      'sub-off,Sold',
    ].join('\n');
    occ.content = [
      'subject_id,area_id,off_site_kind,moved_out,classification',
      'sub-sold,area-1,,,',
      'sub-fam,,owned_by_family,,',
      'sub-mark,,,,"Westra Resident - Dog Owned by GC/CC, KC Required"',
    ].join('\n');
    guard.world.file('bld-person-extra', 'BLD-person.csv', [
      'id,full_name',
      'per-lisa,"Carson, Lisa"',
      'per-grace,"Carson, Grace"',
      'per-cerys,"Carson, Cerys"',
      'per-buyer,"Buyer, Pat"',
    ].join('\n'), placed);
    guard.world.file('bld-owner-extra', 'BLD-subject_owner.csv', [
      'subject_id,person_id,household_id,role,from_date,to_date',
      'sub-lisa,per-lisa,hh-1,owner,2020-01-01,',
      'sub-fam,per-grace,hh-2,owner,2020-01-01,',
      'sub-mark,per-buyer,hh-3,owner,2020-01-01,',
      'sub-cc,per-cerys,hh-2,owner,2020-01-01,',
      'sub-buyer,per-buyer,hh-3,owner,2020-01-01,',
      'sub-past,per-buyer,hh-3,owner,2010-01-01,2000-01-01',
    ].join('\n'), placed);
    guard.world.file('bld-animana-extra', 'BLD-MAP-animana.csv', [
      'system,subject_id,date_of_death',
      'animana,sub-dead,2024-05-30',
      'animana,sub-ok,',
    ].join('\n'), placed);
    guard.world.file('bld-chip-extra', 'BLD-microchip.csv', [
      'subject_id,chip_number,failed_on',
      'sub-off,000222,',
    ].join('\n'), placed);

    await page.goto('bloodline/bld-matings.html');
    await signIn(page);
    const usable = page.locator('#sires-usable');
    const excluded = page.locator('#sires-excluded');
    await expect(usable).toContainText('Confirmed Stud');
    await expect(usable).toContainText('Lisa Owned');
    await expect(usable).toContainText('Family Stud');
    await expect(usable).toContainText('Marker Stud');
    await expect(usable).toContainText('Cerys Stud');
    await expect(usable).toContainText('Closed Owner');
    await expect(usable).not.toContainText('Neutered Stud');
    await expect(usable).not.toContainText('Sold Stud');
    await expect(usable).not.toContainText('No Status Male');
    await expect(usable).not.toContainText('Dead Male');
    await expect(usable).not.toContainText('Buyer Stud');
    await expect(excluded).toContainText('Neutered Stud');
    await expect(excluded).toContainText('neuter status is neutered');
    await expect(excluded).toContainText('Sold Stud');
    await expect(excluded).toContainText('latest status is Sold');
    await expect(excluded).toContainText('No Status Male');
    await expect(excluded).toContainText('no status row');
    await expect(excluded).toContainText('Dead Male');
    await expect(excluded).toContainText('date of death 2024-05-30');
    await expect(excluded).toContainText('Buyer Stud');
    await expect(excluded).toContainText('not ours');
    await expect(page.locator('#sires-unconfirmed')).toHaveCount(0);
    await expect(page.locator('#main')).not.toContainText('neuter_basis');
    await expect(page.locator('#main')).not.toContainText('reference dog');
    await expect(page.locator('#dam option')).toHaveCount(13);
    await expect(page.locator('#sire option', { hasText: 'Confirmed Stud' })).toContainText('here');
    await expect(page.locator('#sire option', { hasText: 'Sold Stud' })).toContainText('here');
    await expect(page.locator('#sire option', { hasText: 'Family Stud' })).not.toContainText('here');
    await expect(page.locator('#sire option', { hasText: 'Buyer Stud' })).not.toContainText('here');
    await expect(page.locator('#dam option', { hasText: 'Collected Bitch' })).not.toContainText('here');
    await page.locator('#damfind').fill('000222');
    await expect(page.locator('#dam option')).toHaveCount(1);
    await page.locator('#dam').selectOption('sub-off');
    await page.locator('#sirefind').fill('Family');
    await expect(page.locator('#sire option')).toHaveCount(1);
    await page.locator('#sire').selectOption('sub-fam');
    await expect(page.locator('#coi')).toContainText('Collected Bitch');
    await expect(page.locator('#coi')).toContainText('Family Stud');
    await page.goto('bloodline/bld-dogs.html');
    await expect(page.locator('#main')).toContainText('Family Stud');
    await expect(page.locator('#main')).toContainText('Collected Bitch');
    await expect(page.locator('#main')).toContainText('here');
    await expect(page.locator('#count')).toContainText('13 of 13');
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
