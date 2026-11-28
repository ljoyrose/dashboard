// Printed dog card: one client-side QR for the main video clip. No video, or a link the card does not accept: nothing extra.
const { test, expect } = require('../support/test');
const P = require('../support/print-a4');

const u = (id) => 'https://share.puppyclassroom.com/v/' + id;

test('printed dog card: one QR for the main clip, none when there is no video @regression', async ({ page }) => {
  await P.openCards(page, (t) => {
    t.subject_video = [
      { id: 'sv1', subject_id: 'd0', video_url: u('mainclip'), title: 'Main', is_main: 'yes', created_at: '2026-01-01T00:00:00Z', corrects_id: '', active: 'yes' },
      { id: 'sv2', subject_id: 'd0', video_url: u('newer'), title: 'Newer', is_main: '', created_at: '2026-06-01T00:00:00Z', corrects_id: '', active: 'yes' },
      { id: 'sv3', subject_id: 'd0', video_url: u('gone'), title: 'Gone', is_main: 'yes', created_at: '2026-07-01T00:00:00Z', corrects_id: '', active: 'no' },
      { id: 'sv4', subject_id: 'd1', video_url: 'https://drive.google.com/file/d/pretend/view', title: 'Drive', is_main: 'yes', created_at: '2026-01-01T00:00:00Z', corrects_id: '', active: 'yes' }
    ];
  });
  const cards = page.locator('.dcard.vcard');
  await expect(cards).toHaveCount(P.CARDS);
  await expect(page.locator('[data-k="video-qr"]')).toHaveCount(1);
  const dog = page.locator('.dcard[data-dog="d0"]');
  const qr = dog.locator('[data-k="video-qr"]');
  await expect(qr).toHaveAttribute('data-url', u('mainclip'));
  await expect(qr.locator('svg')).toHaveAttribute('aria-label', 'Watch video');
  await expect(qr.locator('svg')).toHaveAttribute('viewBox', /0 0 \d+ \d+/);
  await expect(dog.locator('.code svg')).toHaveCount(1);
  await expect(page.locator('.dcard[data-dog="d1"] [data-k="video-qr"]')).toHaveCount(0);
  await expect(page.locator('.dcard[data-dog="d2"] [data-k="video-qr"]')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('puppyclassroom');
});
