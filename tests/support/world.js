// Builds the pretend Drive contents the three pages read.
// Folder ids and file names are NOT copied here: they are read out of config.js and the page code,
// so if a folder id changes in the dashboard, the tests follow it automatically.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { FakeDrive } = require('./fake-drive');

const REPO = path.resolve(__dirname, '..', '..');
const FIX = path.resolve(__dirname, '..', 'fixtures');
const read = (rel) => fs.readFileSync(path.join(FIX, rel), 'utf8');
const src = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const grab = (text, re, what) => {
  const m = re.exec(text);
  if (!m) throw new Error('Could not find ' + what + ' in the page code. The tests need updating.');
  return m[1];
};

// ---- ids/names the pages use ----
const mainHtml = src('index.html');
const cdHtml = src('cdhub/index.html');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(src('config.js'), ctx); // defines window.DASH_CONFIG
vm.runInContext(src('money/core.js'), ctx); // defines window.MoneyCore.CFG etc.
const CONF = ctx.window.DASH_CONFIG;
const MC = ctx.window.MoneyCore;

const IDS = {
  readFirst: CONF.home.readFirstId,
  cf: CONF.home.cfFolderId,
  dbx: CONF.home.dbxFolderId,
  dbxName: CONF.home.dbxTotalsName,
  bld: CONF.cdhub.folderId,
  moneyDrive: MC.CFG.driveId,
  moneyOwner: MC.CFG.owner,
  moneyFolders: MC.CFG.folders,
  clientId: CONF.clientId,
  ledger: CONF.home.ledgerFileId,
  excludedDrive: (CONF.cleanup.excludedDrives.find((d) => d.name === 'Karen - SHARED') || {}).id, // hard rule 14, found by name
  moveSheet: CONF.urls.moveSheet,
  projectsHub: (CONF.projectsHub || {}).webAppUrl || '', // the Projects Hub tile's /exec address ('' = no tile)
  factoryLogs: CONF.factory.logsFolderId, // the folder the Factory page reads af-state.json from
};
const WANT_BLD = (() => {
  const m = /var WANT=\[([\s\S]*?)\];/.exec(cdHtml);
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
})();

const DAY = 86400000;
const iso = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();

/** Main dashboard shared drives (invented names). */
function addMainDashboard(d) {
  d.addDrive('drv-alpha1', 'Test Drive Alpha').addDrive('drv-bravo2', 'Test Drive Bravo');
  // "Read first" folder
  d.folder(IDS.readFirst, 'Read first (sample)', { parents: ['drv-alpha1'], driveId: 'drv-alpha1' });
  d.file('rf-1', 'READ-ME-FIRST sample.txt', 'invented', { parents: [IDS.readFirst], driveId: 'drv-alpha1', mimeType: 'text/plain' });
  d.file('rf-2', 'How this works sample.txt', 'invented', { parents: [IDS.readFirst], driveId: 'drv-alpha1', mimeType: 'text/plain' });
  // "Cf" project tree (two levels)
  d.folder(IDS.cf, 'Cf sample project', { parents: ['drv-alpha1'], driveId: 'drv-alpha1' });
  d.folder('cf-sub-1', 'Sample subfolder', { parents: [IDS.cf], driveId: 'drv-alpha1' });
  d.file('cf-f1', 'cf-notes-recent.txt', 'invented', { parents: [IDS.cf], driveId: 'drv-alpha1', mimeType: 'text/plain', modifiedTime: iso(-3600e3) });
  d.file('cf-f2', 'cf-notes-older.txt', 'invented', { parents: ['cf-sub-1'], driveId: 'drv-alpha1', mimeType: 'text/plain', modifiedTime: iso(-9 * DAY) });
  // Alpha drive: browsable folder + files
  d.folder('fld-alpha-docs', 'Sample Docs', { parents: ['drv-alpha1'], driveId: 'drv-alpha1' });
  d.file('alpha-f1', 'sample-report.txt', 'invented', { parents: ['fld-alpha-docs'], driveId: 'drv-alpha1', mimeType: 'text/plain', modifiedTime: iso(-2 * 3600e3) });
  d.file('alpha-f2', 'sample-old.txt', 'invented', { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'text/plain', modifiedTime: iso(-20 * DAY) });
  // Bravo drive
  d.file('bravo-f1', 'bravo-sample.txt', 'invented', { parents: ['drv-bravo2'], driveId: 'drv-bravo2', mimeType: 'text/plain', modifiedTime: iso(-5 * DAY) });
  // Delete ledger (invented rows). The page reads this id from the code. Tests add fake file ids to the file_id column.
  d.file(IDS.ledger, 'RR_DELETE-LEDGER.csv', 'file_id\n', { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'text/csv' });
  // Bin candidates: two ZZ_ items that need renaming, one RR_ item that must never be touched, one binned already
  d.file('zz-1', 'ZZ_sample-old-copy.txt', 'invented', { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'text/plain' });
  d.file('zz-2', 'ZZ_sample-dupe.txt', 'invented', { parents: ['fld-alpha-docs'], driveId: 'drv-alpha1', mimeType: 'text/plain' });
  d.file('rr-1', 'RR_sample-archive.txt', 'invented', { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'text/plain' });
  d.file('bin-1', 'sample-already-binned.txt', 'invented', { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'text/plain', trashed: true, trashedTime: iso(-DAY) });
}

/** CD Hub BLD-* sample tables, found under the BLD folder by exact title. */
function addCdHub(d, { skip = [], duplicate = [] } = {}) {
  d.folder(IDS.bld, 'BLD-app-tables (sample)', { parents: ['drv-alpha1'], driveId: 'drv-alpha1' });
  const dir = path.join(FIX, 'bld');
  fs.readdirSync(dir).filter((f) => f.endsWith('.csv') && !skip.includes(f)).forEach((f, i) => {
    d.file('bld-' + i, f, read('bld/' + f), { parents: [IDS.bld], driveId: 'drv-alpha1' });
    if (duplicate.includes(f)) d.file('bld-dup-' + i, f, read('bld/' + f), { parents: [IDS.bld], driveId: 'drv-alpha1' });
  });
}

/** Money Hub index files + two entities' ledgers, on the Money shared drive. */
function addMoneyHub(d) {
  const D = IDS.moneyDrive, F = IDS.moneyFolders;
  d.addDrive(D, 'Test Money Drive');
  const put = (id, name, fx, folder, driveId = D) => d.file(id, name, read('mon/' + fx), { parents: [folder], driveId });
  Object.entries(F).forEach(([k, id]) => d.folder(id, 'folder-' + k, { parents: [D], driveId: k === 'factory' ? null : D }));
  put('m-sub', 'MON-SUBJECTS.csv', 'MON-SUBJECTS.csv', F.index);
  put('m-reg', 'MON-REGISTER.csv', 'MON-REGISTER.csv', F.index);
  put('m-int', 'MON-INTAKE.csv', 'MON-INTAKE.csv', F.index);
  put('m-dat', 'MON-DATES.csv', 'MON-DATES.csv', F.ops);
  put('m-rep', 'MON-REPORTS.csv', 'MON-REPORTS.csv', F.ops);
  put('m-chk', 'CHECK-LOG.csv', 'CHECK-LOG.csv', F.ops);
  put('m-acc', 'QUESTIONS-FOR-ACCOUNTANT.csv', 'QUESTIONS-FOR-ACCOUNTANT.csv', F.accountant);
  d.file('m-trg', 'TRIGGERS.csv', read('mon/TRIGGERS.csv'), { parents: [F.factory], driveId: null });
  // entity folders (ids come from MON-SUBJECTS.csv)
  d.folder('fx-folder-testco', 'TESTCO', { parents: [D], driveId: D });
  d.folder('fx-folder-testpers', 'TESTPERS', { parents: [D], driveId: D });
  const ledger = (ent, folder, names) => names.forEach((n) => put('l-' + ent + '-' + n, n, n === 'BALANCES.csv' && ent === 'pers' ? 'BALANCES-PERSONAL.csv' : n, folder));
  ledger('co', 'fx-folder-testco', ['BALANCES.csv', 'CASHFLOW.csv', 'FORECAST.csv', 'MONTHLY.csv', 'OUTGOINGS-NEXT.csv', 'RECURRING.csv', 'LIABILITIES.csv']);
  ledger('pers', 'fx-folder-testpers', ['BALANCES.csv', 'CASHFLOW.csv', 'FORECAST.csv', 'MONTHLY.csv', 'OUTGOINGS-NEXT.csv', 'RECURRING.csv']);
}

/** Everything, signed in as `email`. Lisa's address is the Money Hub gate (read from the page code). */
function buildWorld({ email = IDS.moneyOwner, bld = {}, main = true, cd = true, money = true } = {}) {
  const d = new FakeDrive({ email });
  if (main) addMainDashboard(d);
  if (cd) addCdHub(d, bld);
  if (money) addMoneyHub(d);
  return d;
}

module.exports = { IDS, WANT_BLD, buildWorld, addMainDashboard, addCdHub, addMoneyHub, FIX, read };
