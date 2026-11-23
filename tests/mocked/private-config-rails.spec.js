// Private settings loader (config.js, bottom block): the safety rails, checked without a browser.
// A Drive file may only fill in ids, Google addresses, the owner address and names that already have a place in
// config.js. It can never change the sign-in id, the permissions, the Google API addresses or a live / dryRun switch.
// Every value below is invented.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, expect } = require('@playwright/test');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8');
const load = () => { const w = {}; vm.runInNewContext(SRC, { window: w }); return w; };
const fresh = () => { const w = load(); return { cfg: w.DASH_CONFIG, L: w.DashConfigLoader }; };
const paths = (p) => p.set.map((s) => s.path).sort();
const why = (p, at) => (p.skipped.find((s) => s.path === at) || {}).why;
const SHEET = 'https://docs.google.com/spreadsheets/d/made-up-sheet/edit';

test.describe('Private settings: what a Drive file may and may not change', () => {
  test('without a browser the loader does nothing and config.js reads exactly as written', () => {
    const { cfg, L } = fresh();
    expect(L.status().state).toBe('off');
    expect(cfg.privateConfig).toEqual({ enabled: true, dryRun: true, fileName: 'DASH_CONFIG.json' });
    // The settings block is plain data, so a copy through JSON is the same thing (the loader relies on this).
    expect(JSON.parse(JSON.stringify(cfg))).toEqual(cfg);
  });

  test('ids, the owner address, Google addresses and names with a place in config.js are accepted', () => {
    const { cfg, L } = fresh();
    const p = L.plan(cfg, {
      _note: 'notes for people are ignored',
      home: { ledgerFileId: 'made-up-ledger', runLogFolderId: 'made-up-runlog' },
      cdhub: { folderName: 'Invented / folder name' },
      money: { owner: 'someone@example.com', driveId: 'made-up-drive', folders: { ops: 'made-up-ops' } },
      urls: { moveSheet: SHEET },
      factory: { ideaFormUrl: 'https://docs.google.com/forms/d/e/made-up/viewform' },
      estate: { sheetId: 'made-up-estate' },
    });
    expect(paths(p)).toEqual(['cdhub.folderName', 'estate.sheetId', 'factory.ideaFormUrl', 'home.ledgerFileId', 'home.runLogFolderId', 'money.driveId', 'money.folders.ops', 'money.owner', 'urls.moveSheet']);
    expect(p.skipped).toEqual([]);
    expect(L.apply(cfg, p)).toBe(9);
    expect(cfg.home.ledgerFileId).toBe('made-up-ledger');
    expect(cfg.estate.sheetId).toBe('made-up-estate'); // an empty slot in config.js can be filled from Drive
    expect(cfg.money.folders.ops).toBe('made-up-ops');
    expect(L.apply(cfg, p)).toBe(0); // the same values again change nothing
  });

  test('the sign-in id, permissions, Google API addresses and every live / dryRun switch can never be changed', () => {
    const { cfg, L } = fresh();
    const before = JSON.stringify(cfg);
    const p = L.plan(cfg, {
      clientId: 'made-up.apps.googleusercontent.com',
      scopes: { read: 'https://www.googleapis.com/auth/drive' },
      urls: { files: 'https://docs.google.com/steal', drives: 'https://docs.google.com/steal', driveApi: 'https://docs.google.com/steal' },
      privateConfig: { dryRun: false, enabled: false, fileName: 'other.json' },
      personalBin: { dryRun: false, surface: 'made-up' },
      canvaBin: { dryRun: false },
      food: { live: true },
      studio: { live: true },
      marketplace: { live: true },
      estate: { live: true },
      enquiries: { live: true },
      tidyApps: [],
      excludedDrives: [],
      actionsMinutes: { usageUrl: 'https://docs.google.com/made-up', freeMinutes: 1, red: 2 },
      cleanup: { sharedDriveAllowIds: ['made-up'] },
    });
    expect(p.set).toEqual([]);
    expect(p.drives).toEqual([]);
    expect(L.apply(cfg, p)).toBe(0);
    expect(JSON.stringify(cfg)).toBe(before);
    ['clientId', 'scopes', 'urls.files', 'privateConfig', 'personalBin', 'canvaBin.dryRun', 'food.live', 'tidyApps', 'excludedDrives', 'actionsMinutes.usageUrl', 'cleanup.sharedDriveAllowIds']
      .forEach((at) => expect(why(p, at), at).toBe('never changed from Drive'));
  });

  test('unknown settings, empty values, wrong types and badly formed values are left out', () => {
    const { cfg, L } = fresh();
    const p = L.plan(cfg, JSON.parse(JSON.stringify({
      madeUpSection: { anything: 'x' },
      home: { nope: 'x', ledgerFileId: '', cfFolderId: 'has spaces in it', readFirstId: 42, dbxFolderId: ['x'] },
      money: { owner: 'not-an-address', folders: 'x' },
      urls: { moveSheet: 'http://docs.google.com/not-https' },
      factory: { ideaFormUrl: 'https://docs.google.com.example.org/forms/made-up' },
      projectsHub: { webAppUrl: 'https://example.com/made-up' },
      binGuard: { webAppUrl: 'javascript:alert(1)' },
      cdhub: { folderName: 'line\nbreak' },
    })));
    expect(p.set).toEqual([]);
    expect(why(p, 'madeUpSection')).toBe('no place for it in config.js');
    expect(why(p, 'home.nope')).toBe('no place for it in config.js');
    expect(why(p, 'home.ledgerFileId')).toBe('empty'); // an empty value never replaces a filled one
    expect(why(p, 'home.cfFolderId')).toBe('not a valid id');
    expect(why(p, 'home.readFirstId')).toBe('not a valid id');
    expect(why(p, 'home.dbxFolderId')).toBe('not a valid id');
    expect(why(p, 'money.owner')).toBe('not a valid email');
    expect(why(p, 'money.folders')).toBe('not a settings group');
    expect(why(p, 'urls.moveSheet')).toBe('not a valid url');
    expect(why(p, 'factory.ideaFormUrl')).toBe('not a valid url'); // a look-alike host is not Google
    expect(why(p, 'projectsHub.webAppUrl')).toBe('not a valid url');
    expect(why(p, 'binGuard.webAppUrl')).toBe('not a valid url');
    expect(why(p, 'cdhub.folderName')).toBe('not a valid text');
  });

  test('a file that is not a settings object changes nothing, and tricks on the object itself do not work', () => {
    const { cfg, L } = fresh();
    const before = JSON.stringify(cfg);
    [null, 'text', 7, ['list'], true].forEach((bad) => {
      const p = L.plan(cfg, bad);
      expect(p.set).toEqual([]);
      expect(L.apply(cfg, p)).toBe(0);
    });
    const p = L.plan(cfg, JSON.parse('{"__proto__":{"polluted":"x"},"constructor":{"prototype":{"polluted":"x"}},"home":{"__proto__":{"ledgerFileId":"made-up"}}}'));
    expect(p.set).toEqual([]);
    L.apply(cfg, p);
    expect(JSON.stringify(cfg)).toBe(before);
    expect({}.polluted).toBeUndefined();
  });

  test('never-read drives can be added but never removed', () => {
    const { cfg, L } = fresh();
    const had = cfg.cleanup.excludedDrives.map((d) => d.id);
    expect(had.length).toBeGreaterThan(0);
    // An empty list (an attempt to remove the built-in entry) changes nothing.
    expect(L.apply(cfg, L.plan(cfg, { cleanup: { excludedDrives: [] } }))).toBe(0);
    expect(cfg.cleanup.excludedDrives.map((d) => d.id)).toEqual(had);
    const p = L.plan(cfg, { cleanup: { excludedDrives: [{ id: 'made-up-never-read', name: 'Invented never-read drive' }, { id: had[0], name: 'Same one again' }, { id: 'bad id' }, 'text'] } });
    expect(p.drives.map((d) => d.id)).toEqual(['made-up-never-read', had[0]]);
    expect(p.skipped.map((s) => s.why)).toEqual(['not a valid drive entry', 'not a valid drive entry']);
    expect(L.apply(cfg, p)).toBe(1);
    expect(cfg.cleanup.excludedDrives.map((d) => d.id)).toEqual(had.concat('made-up-never-read'));
    expect(cfg.excludedDrives).toEqual(had.concat('made-up-never-read')); // the id-only list follows
    expect(cfg.cleanup.excludedDrives[0].name).not.toBe('Same one again'); // a built-in entry is never rewritten
  });

  test('what was left out is reported by setting name only, never by value', () => {
    const { cfg, L } = fresh();
    const p = L.plan(cfg, { money: { owner: 'secret-looking-value' }, home: { cfFolderId: 'another secret value' } });
    const text = JSON.stringify(p.skipped);
    expect(text).not.toContain('secret');
    expect(p.skipped.map((s) => s.path)).toEqual(['money.owner', 'home.cfFolderId']);
  });
});
