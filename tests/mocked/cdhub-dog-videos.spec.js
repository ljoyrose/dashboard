// Dog videos (Lisa 25 Nov 2026): any number of RoseQuest clips. Main first, then the rest newest first.
// Invented dogs and links only. The save script is pretend.
const { test, expect, HUBS } = require('../fixtures/job34/load');
const { SINK, csv, put } = require('../support/dog-photo-world');

const SUBJECT = csv('id,tenant_id,name,sex,dob,kind,neuter_status', [
  'sub-x1,t,Pretend Video Dog,Female,2021-01-01,Breeding Female,entire']);
const STATUS = csv('id,tenant_id,subject_id,state', ['s1,t,sub-x1,Active']);
const u = (id) => 'https://share.puppyclassroom.com/v/' + id;
const VIDEO = csv('id,subject_id,video_url,title,is_main,created_at,corrects_id,active', [
  'sv1,sub-x1,' + u('a') + ',Title A,yes,2026-01-01T10:00:00Z,,yes',
  'sv2,sub-x1,' + u('b') + ',Title B,,2026-02-01T10:00:00Z,,yes',
  'sv3,sub-x1,' + u('c') + ',Title C,,2026-03-01T10:00:00Z,,yes',
  'sv4,sub-x1,' + u('d') + ',Title D,,2026-04-01T10:00:00Z,,yes',
  'sv5,sub-x1,' + u('e') + ',Title E,,2026-05-01T10:00:00Z,,yes',
  'sv6,sub-x1,' + u('f') + ',Title F,,2026-06-01T10:00:00Z,,yes',
  'sv7,sub-x1,' + u('g') + ',Title G,,2026-07-01T10:00:00Z,,yes',
  'sv0,sub-x1,' + u('gone') + ',Gone,yes,2026-08-01T10:00:00Z,,no',
  'sv8,sub-x1,' + u('old') + ',Replaced,,2025-01-01T10:00:00Z,,yes',
  'sv9,sub-x1,' + u('old') + ',New name,,2025-02-01T10:00:00Z,sv8,yes']);

test('dog card lists every clip: main first, then newest, with Show all past five @regression', async ({ page, guard }) => {
  const w = guard.world;
  put(w, 'BLD-subject.csv', SUBJECT);
  put(w, 'BLD-subject_status.csv', STATUS);
  put(w, 'BLD-subject_video.csv', VIDEO);
  await HUBS.cdhub.open(page, guard);
  await page.evaluate((url) => { localStorage.setItem('cdhub.sink.url', url); localStorage.setItem('cdhub.sink.code', 'pretend-code'); }, SINK);
  await page.evaluate(() => go('dogs/sub-x1'));
  const card = page.locator('#rows article.dc');
  const sec = card.locator('details[data-k="videos"]');
  await expect(sec.locator('> summary')).toHaveText('Videos (8)');
  await sec.locator('> summary').click();
  await expect(sec.locator('[data-k="watch"]')).toHaveAttribute('href', u('a'));
  await expect(sec.locator('[data-k="watch"]')).toHaveAttribute('target', '_blank');
  const rows = sec.locator('[data-k="vrow"]');
  await expect(rows).toHaveCount(5);
  await expect(rows.nth(0)).toContainText('Title G');
  await expect(rows.nth(4)).toContainText('Title C');
  await expect(sec).not.toContainText('Gone');
  await expect(sec).not.toContainText('Replaced');
  await sec.getByRole('button', { name: 'Show all (7)' }).click();
  await expect(sec.locator('[data-k="vrow"]')).toHaveCount(7);
  await expect(sec.locator('[data-k="vrow"]').last()).toContainText('New name');
  await expect(sec.locator('[data-k="watch"]')).toHaveAttribute('href', u('a'));
});

test('Add video sends a RoseQuest link only; a Drive link is refused on the card', async ({ page, guard }) => {
  const w = guard.world;
  put(w, 'BLD-subject.csv', SUBJECT);
  put(w, 'BLD-subject_status.csv', STATUS);
  await HUBS.cdhub.open(page, guard);
  const bodies = [];
  await page.route(SINK, async (route) => {
    const b = JSON.parse(route.request().postData() || '{}');
    bodies.push(b);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result: { status: 'saved', id: 'svd-new', rows: [{ id: 'svd-new', subject_id: 'sub-x1', video_url: b.fields.video_url, title: b.fields.title, is_main: 'yes', created_at: '2026-11-25T18:00:00Z', corrects_id: '', active: 'yes' }] } }) });
  });
  await page.evaluate((url) => { localStorage.setItem('cdhub.sink.url', url); localStorage.setItem('cdhub.sink.code', 'pretend-code'); }, SINK);
  await page.evaluate(() => go('dogs/sub-x1'));
  const f = page.locator('details[data-k="videos"] form');
  await page.locator('details[data-k="videos"] > summary').click();
  await f.locator('input[name=url]').fill('https://drive.google.com/file/d/pretend/view');
  await f.locator('button[type=submit]').click();
  await expect(f.locator('[data-video-msg]')).toContainText('RoseQuest');
  expect(bodies).toHaveLength(0);
  await f.locator('input[name=url]').fill(u('newclip'));
  await f.locator('input[name=title]').fill('New clip');
  await f.locator('button[type=submit]').click();
  await expect.poll(() => bodies.length).toBe(1);
  expect(bodies[0].action).toBe('subject_video');
  expect(bodies[0].fields).toMatchObject({ subject_id: 'sub-x1', video_url: u('newclip'), title: 'New clip' });
  await expect(page.locator('[data-k="watch"]')).toHaveAttribute('href', u('newclip'));
});
