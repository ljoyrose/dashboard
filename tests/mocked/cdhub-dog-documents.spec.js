// CD Hub dog card Documents (the owner 17 Nov 2026): files linked from the dog show under More, labelled by BLD-doc_type rows,
// newest first, each opening in Drive. Photos stay in the gallery. Invented rows only. Dates as "2 Mar 2026".
const { test, expect, HUBS } = require('../fixtures/job34/load');

const csv = (h, rows) => [h].concat(rows).join('\r\n') + '\r\n';
const ID = (n) => '1FAKEDOCFILEIDFORTESTS0000000000' + n;
const SUBJECT = csv('id,tenant_id,name,sex,dob,kind,neuter_status,size_band', ['sub-x1,t,Pretend Dam One,Female,2021-01-01,Breeding Female,entire,']);
const STATUS = csv('id,tenant_id,subject_id,state', ['s1,t,sub-x1,Active']);
const FILES = csv('id,tenant_id,kind,drive_file_id,url,mime,name,size_bytes,taken_on,sha256,source,set_by,set_on', [
  `fil-1,t,upload,${ID('a')},,application/pdf,pedigree.pdf,1,2024-05-01,,Pretend,user,2026-11-17`,
  `fil-2,t,upload,${ID('b')},,application/pdf,hips.pdf,1,2026-02-10,,Pretend,user,2026-11-17`,
  `fil-3,t,photo,${ID('c')},,image/jpeg,dog.jpg,1,,,Pretend,user,2026-11-17`,
]);
const LINKS = csv('id,tenant_id,from_table,from_id,role,to_table,to_id,from_date,to_date,source,set_by,set_on', [
  'lnk-1,t,subjects,sub-x1,pedigree,files,fil-1,2026-01-01,,Pretend,user,2026-11-17',
  'lnk-2,t,subjects,sub-x1,ofa-hips,files,fil-2,2026-01-01,,Pretend,user,2026-11-17',
  'lnk-3,t,subjects,sub-x1,gallery,files,fil-3,2026-01-01,,Pretend,user,2026-11-17',
]);
const DOCTYPE = csv('id,tenant_id,code,label,user_kind', ['dt-1,t,pedigree,Pedigree,subject', 'dt-2,t,ofa-hips,OFA Hips certificate,subject']);

function put(world, name, content) {
  const f = world.files.find((x) => x.name === name && !x.trashed);
  if (f) { f.content = content; f.size = String(content.length); return; }
  const like = world.files.find((x) => x.name === 'BLD-area.csv' && !x.trashed);
  world.file('fx-' + name, name, content, { parents: like.parents, driveId: like.driveId, mimeType: like.mimeType });
}

test.describe('CD Hub dog card documents', () => {
  test('documents list under More, newest first, labelled and opening in Drive; photos are not listed', async ({ page, guard }) => {
    const w = guard.world;
    put(w, 'BLD-subject.csv', SUBJECT);
    put(w, 'BLD-subject_status.csv', STATUS);
    put(w, 'BLD-files.csv', FILES);
    put(w, 'BLD-links.csv', LINKS);
    put(w, 'BLD-doc_type.csv', DOCTYPE);
    await HUBS.cdhub.open(page, guard);

    await page.evaluate(() => go('dogs/sub-x1'));
    const card = page.locator('#rows article.dc');
    await expect(card).toHaveCount(1);
    await card.locator('[data-k="more"] > summary').click();
    const docs = card.locator('[data-k="docs"]');
    await expect(docs.locator('summary')).toHaveText('2 documents');
    await docs.locator('summary').click();
    await expect(docs.locator('[data-k="doc"]')).toHaveText(['10 Feb 2026OFA Hips certificate', '1 May 2024Pedigree']);
    await expect(docs.locator('a[data-doc="pedigree"]')).toHaveAttribute('href', `https://drive.google.com/file/d/${ID('a')}/view`);
    await expect(docs.locator('a[data-doc="gallery"]')).toHaveCount(0);
  });
});

