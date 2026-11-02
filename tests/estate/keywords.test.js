// Keywords and ads accounts (Stage 9). Run: node --test tests/estate/keywords.test.js
// Every keyword, address and account here is invented.
const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../../estate/keywords.js');
const F = require('../fixtures/estate/rows.js');

test('SOURCES are fixed and in order', () => {
  assert.deepEqual(K.SOURCES, ['Semrush', 'Search Console', 'Google Ads']);
});

test('keywordCard: every source with no rows says "not connected"', () => {
  const cards = K.keywordCard([]);
  assert.equal(cards.length, 3);
  for (const c of cards) {
    assert.equal(c.connected, false);
    assert.equal(c.word, 'not connected');
    assert.deepEqual(c.rows, []);
  }
  assert.deepEqual(K.keywordCard(undefined).map((c) => c.word), ['not connected', 'not connected', 'not connected']);
});

test('keywordCard: zero or blank positions are never shown as real data', () => {
  const cards = K.keywordCard([
    { source: 'Semrush', keyword: 'invented widget', position: 0 },
    { source: 'Semrush', keyword: 'sample gadget', position: '' },
    { source: 'Search Console', keyword: '', position: 0 }
  ]);
  const sem = cards[0];
  assert.equal(sem.connected, true);
  for (const r of sem.rows) {
    assert.equal(r.position, null);
    assert.equal(r.position_word, 'no position');
  }
  // A row with no keyword does not connect a source.
  assert.equal(cards[1].connected, false);
  assert.equal(cards[1].word, 'not connected');
  // Nothing anywhere is a 0 presented as a position.
  const shown = cards.flatMap((c) => c.rows.map((r) => [r.position, r.position_word]));
  assert.ok(!shown.flat().some((v) => v === 0 || v === '0'), 'a 0 position leaked as real data');
});

test('keywordCard: real positions are numbers, best first, no-position rows last', () => {
  const cards = K.keywordCard([
    { source: 'google ads', keyword: 'b term', position: '7', url: 'https://example.com/b', ads_account: 'Invented Ads', updated: '2026-10-01' },
    { source: 'Google Ads', keyword: 'a term', position: 2 },
    { source: 'Google Ads', keyword: 'c term', position: 'n/a' },
    { source: 'Google Ads', keyword: 'd term', position: '3.5' },
    { source: 'Unknown tool', keyword: 'ignored', position: 1 }
  ]);
  const ads = cards[2];
  assert.equal(ads.connected, true);
  assert.equal(ads.word, '4 keywords');
  assert.deepEqual(ads.rows.map((r) => r.position), [2, 3.5, 7, null]);
  assert.equal(ads.rows[2].url, 'https://example.com/b');
  assert.equal(ads.rows[2].ads_account, 'Invented Ads');
  assert.equal(ads.rows[3].position_word, 'no position');
  assert.equal(cards[0].word, 'not connected');
});

test('adsAccounts: ads-account rows only, summarised', () => {
  assert.deepEqual(K.adsAccounts(F.ROWS), [{ client: 'Client B', account_label: 'client-b.example', access_note: 'manager role' }]);
  assert.deepEqual(K.adsAccounts([{ kind: 'ads-account', company: 'Sample Co', key: 'ads-account:x' }]),
    [{ client: 'Sample Co', account_label: 'ads-account:x', access_note: 'not reported' }]);
  assert.deepEqual(K.adsAccounts([]), []);
});
