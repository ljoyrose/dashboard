// studio/tech-core.js (TECH-HUB-1): the pure view-model behind Dashboard › Tech, tested in Node with no browser. Invented rows only.
const path = require('path');
const { test, expect } = require('@playwright/test');
const T = require(path.join('..', '..', 'studio', 'tech-core.js'));
const FX = require('../fixtures/tech-tools');

const NOW = Date.UTC(2026, 10, 13, 9, 0);
const OPTS = { now: NOW, devHostingSlot: 6, freshDays: 35 };
const d = (off) => FX.iso(NOW, off);
const base = { tool: 'Example Tool A', tool_key: 'example-a', group: 'AI', plan_or_tier: 'Tier 1', period: 'month', status: 'live', verified: 'VERIFIED', last_updated: d(-1) };
const one = (o) => T.read([FX.HEADER, FX.row(Object.assign({}, base, o))], OPTS).tiles[0];

test.describe('studio/tech-core.js', () => {
  test('header: matched by name in any order; "tool" stands in for tool_name; required columns listed when missing', () => {
    const h = T.header(['verified', 'TOOL', 'group', 'tool_key', 'status', 'period', 'last_updated', 'extra']);
    expect(h.missing).toEqual([]);
    expect(h.idx.tool_name).toBe(1);
    expect(T.header(['tool_key', 'tool', 'group']).missing).toEqual(['status', 'period', 'verified', 'last_updated']);
  });

  test('modes: Studio-only tab = example (no links); a missing Tech column = header (fail closed); no rows at all = header', () => {
    const ex = T.read([['tool', 'licence_tier_and_codes', 'agency_white_label', 'used_for', 'verdict'], ['Example Tool A', '', '', '', '']], OPTS);
    expect(ex.mode).toBe('example');
    expect(ex.tiles.map((t) => t.name).every((n) => /^Example Tool [A-Z]$/.test(n))).toBe(true);
    expect(ex.tiles.filter((t) => t.reviewHref)).toEqual([]);
    const v = FX.values(NOW); v[0] = v[0].filter((c) => c !== 'verified');
    expect(T.read(v, OPTS)).toMatchObject({ mode: 'header', missing: ['verified'], tiles: [] });
    expect(T.read([], OPTS).mode).toBe('header');
  });

  test('every named paid row is a tile; ended or plan-less rows are counted, blank names skipped', () => {
    const r = T.read(FX.values(NOW), OPTS);
    expect(r.mode).toBe('live');
    expect(r.tiles.map((t) => t.key)).toEqual(['example-a', 'example-b', 'example-c', 'example-d', 'example-e', 'example-f', 'example-g', 'example-h', 'example-i']);
    expect(r.hidden).toBe(2);
    expect(r.skipped).toBe(1);
    expect(r.keys).toContain('example-tool-j'); // hidden rows still block a duplicate Add tech
  });

  test('group order and colour: fixed order, colour from the group, Dev and hosting from the one setting, unknown group = Other', () => {
    expect(T.GROUPS.map((g) => g.name)).toEqual(['AI', 'Design and assets', 'Money and admin', 'Comms', 'Dev and hosting', 'Data and automation', 'Other']);
    const v = T.view(T.read(FX.values(NOW), OPTS).tiles, {}, OPTS);
    expect(v.groups.map((g) => g.key)).toEqual(['ai', 'design', 'money', 'comms', 'dev', 'data', 'other']);
    expect(one({ group: 'Dev and hosting' }).slot).toBe(6);
    expect(T.read([FX.HEADER, FX.row(Object.assign({}, base, { group: 'Dev and hosting' }))], Object.assign({}, OPTS, { devHostingSlot: 0 })).tiles[0].slot).toBe(0);
    expect(T.read([FX.HEADER, FX.row(Object.assign({}, base, { group: 'Dev and hosting' }))], Object.assign({}, OPTS, { devHostingSlot: 'x' })).tiles[0].slot).toBe(T.DEV_SLOT_DEFAULT);
    expect(one({ group: 'design and assets' }).slot).toBe(7);
    expect(one({ group: 'Something new' })).toMatchObject({ group: 'other', slot: 0 });
  });

  test('search, filter and sort', () => {
    const tiles = T.read(FX.values(NOW), OPTS).tiles;
    const keys = (v) => v.groups.flatMap((g) => g.tiles.map((t) => t.key));
    expect(keys(T.view(tiles, { q: 'starter' }, OPTS))).toEqual(['example-d']);
    expect(keys(T.view(tiles, { q: 'example tool' }, OPTS)).length).toBe(9);
    expect(keys(T.view(tiles, { groups: ['comms'] }, OPTS))).toEqual(['example-d', 'example-i']);
    expect(keys(T.view(tiles, { flags: ['unused'] }, OPTS))).toEqual(['example-a']);
    expect(keys(T.view(tiles, { flags: ['broken'] }, OPTS))).toEqual(['example-i']);
    expect(keys(T.view(tiles, { groups: ['ai'] }, OPTS))).toEqual(['example-b', 'example-a']); // sort_order 1 before 2
    expect(keys(T.view(tiles, { groups: ['ai'], sort: 'name' }, OPTS))).toEqual(['example-a', 'example-b']);
    const v = T.view(tiles, { groups: ['ai'] }, OPTS);
    expect(v.groupCounts.comms).toBe(2); // a chip row's own choice never hides its other chips
    expect(T.view(tiles, { q: 'nothing like this' }, OPTS).shown).toBe(0);
  });

  test('unused this month: on only when live, monthly, a cap, nothing used, and fresh', () => {
    expect(one({ allowance_amount: '100', used_period: '0' }).unused).toBe(true);
    expect(one({ allowance_amount: '100', used_period: '1' }).unused).toBe(false);
    expect(one({ allowance_amount: '100', used_period: '' }).unused).toBe(false); // unknown is not zero
    expect(one({ allowance_amount: '', used_period: '0' }).unused).toBe(false);
    expect(one({ allowance_amount: '100', used_period: '0', period: 'week' }).unused).toBe(false);
    expect(one({ allowance_amount: '100', used_period: '0', status: 'trial' }).unused).toBe(false);
    expect(one({ allowance_amount: '100', used_period: '0', last_updated: d(-40) }).unused).toBe(false);
    expect(one({ allowance_amount: '100', used_period: '0', flag_unused_month: 'FALSE' }).unused).toBe(true); // worked out, never read
  });

  test('reviews: 0 = needs review, 1 = one link, 2+ = duplicate reviews; blank count follows the file', () => {
    expect(one({ review_count: '0' })).toMatchObject({ needsReview: true, dupReviews: false, reviewHref: '' });
    expect(one({ review_count: '1', review_file_id: 'EXAMPLE-ID-1' })).toMatchObject({ needsReview: false, dupReviews: false, reviewHref: 'https://drive.google.com/file/d/EXAMPLE-ID-1/view' });
    expect(one({ review_count: '3', review_file_id: 'EXAMPLE-ID-1' })).toMatchObject({ needsReview: false, dupReviews: true });
    expect(one({ review_file_id: 'EXAMPLE-ID-1' }).reviews).toBe(1);
    expect(one({}).needsReview).toBe(true);
    expect(one({ review_count: '1', review_file_id: 'javascript:alert(1)' }).reviewHref).toBe('');
    expect(T.reviewHref('http://example.com/x')).toBe('');
  });

  test('dates: lifetime vs renewing vs ended vs unknown; UK and ISO dates', () => {
    expect(one({ period: 'lifetime', renewal_or_expiry: 'lifetime' })).toMatchObject({ lifetime: true, renew: null });
    expect(one({ renewal_or_expiry: 'Lifetime' }).lifetime).toBe(true);
    expect(one({ renewal_or_expiry: d(10) }).renewDays).toBe(10);
    expect(one({ renewal_or_expiry: '01/12/2026' }).renew).toBe(Date.UTC(2026, 11, 1));
    expect(one({ renewal_or_expiry: d(-3) }).renewDays).toBe(-3);
    expect(one({ renewal_or_expiry: 'soon' }).renew).toBe(null);
    expect(one({ last_updated: d(-36) }).stale).toBe(true);
    expect(one({ last_updated: d(-35) }).stale).toBe(false);
  });

  test('VERIFIED / UNVERIFIED and unknown figures', () => {
    expect(one({}).verified).toBe(true);
    expect(T.flagsOf(one({ verified: 'UNVERIFIED' }))).toContain('unverified');
    const t = one({ allowance_amount: '2,000', used_period: '' });
    expect(t.allow.n).toBe(2000);
    expect(t.used.n).toBe(null);
    expect(t.left).toBe(null);
    expect(one({ allowance_amount: 'unlimited' }).allow).toEqual({ n: null, text: 'unlimited' });
    const html = T.tileHtml(one({ allowance_amount: '', used_period: '' }));
    expect(html).toContain('Allowance <span class="tt-unk">unknown</span>');
    expect(html).not.toMatch(/>0</);
  });

  test('a half-filled row fails closed for that tile; an unknown status or period counts as not filled', () => {
    expect(one({ status: '' })).toMatchObject({ broken: true, problems: ['status'] });
    expect(one({ status: 'paused' }).problems).toEqual(['status']);
    expect(one({ period: 'fortnight' }).problems).toEqual(['period']);
    expect(one({ verified: 'maybe' }).problems).toEqual(['verified']);
    expect(T.tileHtml(one({ group: '' }))).toContain('Row not complete: group.');
  });

  test('AI-only lines: only where the row has a value; counts must be whole numbers (never names or ids)', () => {
    expect(one({}).ai).toEqual([]);
    const t = one({ ai_share_used_week: '40%', ai_outputs_in_drive: '12', ai_higher_spec_runs: 'EXAMPLE-ID-9', ai_right_first_time: '1,204' });
    expect(t.ai.map((a) => [a.key, a.text])).toEqual([['ai_share_used_week', '40%'], ['ai_outputs_in_drive', '12'], ['ai_right_first_time', '1,204']]);
  });

  test('the tile: logo (https only) or initials first, few words, everything escaped', () => {
    expect(T.initials('Example Tool A')).toBe('EA');
    expect(T.initials('example')).toBe('EX');
    expect(T.safeLogo('https://example.com/a.png')).toBe('https://example.com/a.png');
    for (const bad of ['http://example.com/a.png', 'javascript:alert(1)', 'https://example.com/a".png', 'data:image/png;base64,AA']) expect(T.safeLogo(bad)).toBe('');
    const html = T.tileHtml(one({ tool: '<b>Example</b> Tool', logo_url: 'https://example.com/a.png' }));
    expect(html).toContain('&lt;b&gt;Example&lt;/b&gt; Tool');
    expect(html.indexOf('img class="bmark tlogo"')).toBeLessThan(html.indexOf('tt-name'));
    expect(T.tileHtml(one({}))).toMatch(/<span class="bmark bav"[^>]*>EA<\/span><h5/);
    expect(T.tileHtml(one({}))).not.toMatch(/href="#/);
  });

  test('Add tech: checks the entry and builds the row', () => {
    const ok = T.newRow({ tool_name: 'Example Tool Y', group: 'Comms', plan_or_tier: 'Tier 1', status: 'live', period: 'month', allowance_amount: '1,000', renewal_or_expiry: '2026-12-01' }, NOW, []);
    expect(ok.ok).toBe(true);
    expect(ok.row).toMatchObject({ tool_key: 'example-tool-y', group: 'Comms', allowance_amount: '1000', renewal_or_expiry: '2026-12-01', verified: 'UNVERIFIED', last_updated: '2026-11-13', review_count: '0' });
    expect(T.newRow({ tool_name: 'Example Tool Y', group: 'AI', plan_or_tier: 'x', status: 'trial', period: 'lifetime', renewal_or_expiry: '2026-12-01' }, NOW, []).row.renewal_or_expiry).toBe('lifetime');
    const bad = T.newRow({ tool_name: 'Example Tool A', group: 'Nope', status: 'expired', period: 'day', allowance_amount: 'lots', renewal_or_expiry: 'soon', logo_url: 'http://x' }, NOW, ['example-tool-a']);
    expect(bad.ok).toBe(false);
    expect(Object.keys(bad.errors).sort()).toEqual(['allowance_amount', 'group', 'logo_url', 'period', 'plan_or_tier', 'renewal_or_expiry', 'status', 'tool_name']);
    expect(bad.errors.tool_name).toBe('Already on the list.');
  });

  test('the file holds no real tool data and no ids', () => {
    const src = require('fs').readFileSync(path.join(__dirname, '..', '..', 'studio', 'tech-core.js'), 'utf8');
    const names = [...src.matchAll(/'(Example Tool [A-Z])'/g)].map((m) => m[1]);
    expect(names.length).toBe(6);
    expect(src).not.toMatch(/\b(?=[\w-]*\d)(?=[\w-]*[A-Z])(?=[\w-]*[a-z])[\w-]{25,}\b/);
    expect(src).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/);
  });
});
