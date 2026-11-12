// One place for the dashboard's settings. None of these are secrets: the client id is the public
// Google sign-in id, and the rest are Drive folder/file ids and web addresses.
// Change an id here and all three pages (and the tests) follow it.
(function (root) {
  'use strict';
  // One list for shared drives the dashboard must never read, list, search or bin.
  // Match by id or by the drive's name. The name is the shared-drive title.
  var EXCLUDED = [
    { id: '0AEf6v2sKb4FrUk9PVA', name: 'Karen - SHARED' }
  ];
  root.DASH_CONFIG = {
    clientId: '135419966158-qqhndd85mott7p7rqbjbrji8sjhbkt88.apps.googleusercontent.com',
    scopes: {
      read: 'https://www.googleapis.com/auth/drive.readonly',
      // Full Drive scope: asked for only when the Bin actions are used (incremental consent).
      write: 'https://www.googleapis.com/auth/drive',
      // Personal Drive page only: a second, look-only sign-in. Its token stays in memory and is never used for work calls.
      personal: 'https://www.googleapis.com/auth/drive.metadata.readonly'
    },
    // Private settings file (the loader is at the bottom of this file). After Google sign-in the dashboard looks in Drive
    // for one trusted file with this name and can use its ids and addresses in place of the ones written here.
    // enabled false = never look. dryRun true = find and check the file but change nothing; switching it off is Lisa's call.
    // Optional: timeoutMs = how long to wait for Drive before carrying on without the file (8 seconds when not set).
    privateConfig: {
      enabled: true,
      dryRun: true,
      fileName: 'DASH_CONFIG.json'
    },
    // Ids only, derived from cleanup.excludedDrives. Kept so older checks still find them.
    excludedDrives: EXCLUDED.map(function (d) { return d.id; }),
    // Allow-list and excluded drives live together. An empty allow-list means every
    // shared drive except the excluded list. My Drive bins only what the signed-in person owns.
    cleanup: {
      excludedDrives: EXCLUDED,
      sharedDriveAllowIds: []
    },
    // Personal Drive page bin (TidyUp Apps stage 3). The page stays look-only until Lisa presses "Allow personal bin
    // actions". A file can be binned only if it starts ZZ_DELETE_DRIVE_ and has a ledger row whose surface is `surface`.
    // dryRun true = the page lists what would be renamed or binned and changes nothing; switching it off is Lisa's call.
    personalBin: {
      surface: 'drive-personal',
      dryRun: true
    },
    // TidyUp Apps stage 5: one row per app outside Drive and Dropbox. status: 'bot-and-browser' | 'bot-capable' |
    // 'browser-only' | 'nothing'. how = the only tidy route allowed; never = API actions no bot may call for that app.
    // Archive or trash only, never a permanent delete. No emails or ids here. The Bin page lists these under Other apps.
    tidyApps: [
      { app: 'Canva', status: 'bot-and-browser', how: 'The tidy bot moves marked designs to a bin folder; you empty it in Canva (kept 30 days).', never: ['delete', 'trash by bot'] },
      { app: 'Gmail', status: 'bot-capable', how: 'Nothing marked yet. A bot may archive or trash only.', never: ['delete_label', 'delete'] },
      { app: 'ClickUp', status: 'bot-capable', how: 'Nothing marked yet. A bot may archive or trash only.', never: ['delete_task'] },
      { app: 'Shopify', status: 'bot-capable', how: 'Nothing marked yet. A bot may archive only.', never: ['delete'] },
      { app: 'ClickFunnels', status: 'bot-capable', how: 'Nothing marked yet. A bot may archive or trash only.', never: ['destroy'] },
      { app: 'Figma', status: 'browser-only', how: 'By hand in the browser.', never: [] },
      { app: 'Descript', status: 'browser-only', how: 'By hand in the browser.', never: [] },
      { app: 'Runway', status: 'browser-only', how: 'By hand in the browser.', never: [] },
      { app: 'Animoto', status: 'browser-only', how: 'By hand in the browser.', never: [] },
      { app: 'GitHub', status: 'nothing', how: 'Nothing to tidy.', never: [] },
      { app: 'Vercel', status: 'nothing', how: 'Nothing to tidy.', never: [] }
    ],
    urls: {
      files: 'https://www.googleapis.com/drive/v3/files',
      drives: 'https://www.googleapis.com/drive/v3/drives',
      driveApi: 'https://www.googleapis.com/drive/v3',
      moveSheet: 'https://docs.google.com/spreadsheets/d/1AIgIefQMATEdWLtAkdvE7SvdnX8g2sTX87VnvOX5c-I/edit'
    },
    home: {
      ledgerFileId: '1oIQz2HR86iL8ZuJQdKaUeEplNj0mG9GY', // RR_DELETE-LEDGER, file_id column
      cfFolderId: '1cTqxH8ROs0Fj2u5zDdZwaBsJmSrRxi_A',
      readFirstId: '1HnnW5du3PxNbg-42C6mT79dHOo_RZS-L',
      dbxFolderId: '0AEqV6Ky2jpmDUk9PVA', // Drive folder holding DROPBOX-TOTALS.json
      dbxTotalsName: 'DROPBOX-TOTALS.json',
      // Bin page Log: the tidy engines' run history (RUN-LOG.csv, written by the private repo; columns in index.html
      // above loadRunLog and in README.md). Placeholder: empty until the folder exists. Empty = "No runs logged yet".
      runLogFolderId: '',
      runLogName: 'RUN-LOG.csv'
    },
    // Bin page Canva card (TidyUp Apps stage 1). The page never calls Canva. It reads stateFile from folderId (00 AI Commons >
    // CHANGES), written by the CANVA-BIN bot, and writes ledger slips and CANVA-BIN-REQUEST_ files there. accounts are
    // labels only (no emails). dryRun true = the card lists and changes nothing; switching it off is Lisa's call.
    canvaBin: {
      folderId: '11J2IuEGBT6fThCFD3UCN86J_9ZbiGhrF',
      stateFile: 'CANVA-BIN-STATE.json',
      accounts: ['main', 'book'],
      dryRun: true
    },
    cdhub: {
      folderId: '10m8HauOLAdj2QStgNJ2T3b3W599VXWro',
      folderName: '*01 SLA Inspections / BLD-app-tables',
      readingsSheetId: '1utmtG6V2q4kLQT15LtHg_AyncNObeBSyXyV86MaV8o0', // BLD-outdoor_temp readings sheet
      // Write targets for inline dashboard edits (chip and area saves)
      microchipFileId: '1GnL88Xtf0tlcXjFf_P2ML-Vfglz08-Ee',
      occupancyFileId: '18z1oJMhx01EoKDeL4fi4KGBuiSLtgcj-'
    },
    // Marketplace page: the "Marketplace" tab of RR_OPEN-WORK (filled by the RR_MKT-ENGINE Apps Script). Taps write only the
    // answer cells. wakeFolderId/wakeFile: optional Drive file holding the engine's web-app address (empty = the engine's
    // 15-minute timer picks taps up). live: false shows the TEST stamp until Lisa switches the engine to LIVE.
    // GA Hub (food/): Designer Dog Foods orders, GA invoices and the product list. Read with Lisa's sign-in from RR_FOOD
    // (RR_DDF folder), which the RR_FOOD-ENGINE Apps Script fills. The page writes only the 4 answer cells of a Cards row.
    food: {
      bookId: '1Lags6XfdNhvxwxGNgEKwfoosHr6ci9rzG-QXulgCfxU', // RR_FOOD (RR_DDF folder)
      live: false
    },
    // Studio page (studio/): asset hub. Reads studio-state.json from logsFolderId (written by the STUDIO-ENGINE Apps Script);
    // until it exists the page shows built-in example data and sends nothing. Clicks drop one request file into requestsFolderId.
    studio: {
      rootFolderId: '1zY7WMtfw_w5GioaoQlyEKkew-0dYZLvQ', // RR_Studio (shared drive "7 - Purple - Assets Ideas")
      logsFolderId: '1Yq9ELzfAE27sxD1k3_KYEDCSz5BzmcdI', // holds studio-state.json
      requestsFolderId: '13KclIUhOej1bmoQznfbrUiHtoab-FnDV', // the page writes request JSON files here
      inboxFolderId: '1poaewHMRwrOcXwXa0PrMZhnmhyn66BzL', // Ideas > Inbox - drop files here
      stateFile: 'studio-state.json',
      // Owned tools list (Tools page): read with the signed-in token only. The tool data lives in the sheet, never in this repo.
      ownedTools: { sheetId: '1iwlUFBeFOAUxlHlr8FsCIxpmhqSWzq3038OEDN-Zfz8', tab: 'OWNED_TOOLS' }, // STUDIO-CONTROL sheet, Owned Tools tab
      live: false
    },
    // Web Estate Hub (estate/): reads the private RR_WEB-ESTATE sheet (Properties tab) with Lisa's sign-in; Add drops one
    // request file into requestsFolderId for the RR_WEB-ESTATE engine. Both ids stay empty until Lisa installs the engine:
    // until then the page shows invented example rows and sends nothing. Read only: nothing here changes DNS or a site.
    estate: {
      sheetId: '',
      requestsFolderId: '',
      live: false
    },
    // Actions minutes card (Home). Reads ACTIONS-MINUTES.json (counts only) from folderId with Lisa's sign-in; the file is
    // written by the private ACTIONS-MINUTES collector (Apps Script in Drive, read-only GitHub token in its Script Properties).
    // folderId empty = the card shows invented example data with the EXAMPLE stamp and reads nothing.
    // repoLabels: short labels only (the collector maps real repos to these); they set the row order. Never real repo names.
    actionsMinutes: {
      folderId: '',
      fileName: 'ACTIONS-MINUTES.json',
      freeMinutes: 2000,
      amber: 0.75,
      red: 0.90,
      staleDays: 2,
      repoLabels: [],
      usageUrl: 'https://github.com/settings/billing/usage'
    },
    marketplace: {
      openWorkId: '1ShYbYmY8W-MEWqm9kHFsIcS5uR4b2SG00uXle_yL76U', // RR_OPEN-WORK (00 AI Commons)
      tab: 'Marketplace',
      listingsFileId: '1JkewFinU42nKX7JDEwRHZY0I-FKdBhdW', // RR_LISTINGS.csv: read only, for the second photo on "Same item?" cards
      wakeFolderId: '',
      wakeFile: 'MKT-WAKE-WEBAPP.json',
      ideasRequestsFolderId: '1cd3vZwUYB0pNFUTQzSOMkYwuOeATG7Rv', // Drive folder for Product ideas request files (MKT-IDEA-REQ-*.json). Empty = the Add idea form will not send.
      live: false
    },
    // Puppy Enquiries Hub (enquiries/): reads the private RR_ENQUIRIES sheet (filled by the enquiries engine) with Lisa's
    // sign-in; a tap drops one request file into requestsFolderId. Both empty = example mode: invented rows, nothing sent.
    enquiries: {
      sheetId: '',
      requestsFolderId: '',
      live: false
    },
    // App Factory page (factory/): reads af-state.json from logsFolderId (written by AF-ENGINE); writes request files into
    // requestsFolderId. The Idea Form is the front door (AF-ENGINE writes the card and the ClickUp task).
    factory: {
      logsFolderId: '1e04LM9qA2lXpy63Qfcd7x9HEEjhsMj9k',
      requestsFolderId: '1Z1Iuc_rRFq7cy12ELM0seZ-onpCSfDQ2',
      ideaFormUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSfzzTnlyNWeXzFEz9NfYxNXsCFN6KwV8RxFyIRTJZ-WrH15nw/viewform'
    },
    // Bin guard (Apps Script, owned by the business account). Restores binned items that are not ZZ_DELETE_/ZZ_SUPERSEDED_
    // into 00 CHECK. The web app is domain-only, so its address is not needed by anyone outside the business domain.
    binGuard: {
      checkFolderId: '1o7ag4AndYA20h7aOmPsm0x69q3f2PqaZ', // LD > *00 Current > 00 CHECK
      homeFolderId: '1HKAMkAER7ft-xMJYUQGzi_v6jV-3vQwk', // LD > *00 Current: the web app writes its address file here when first opened
      webAppFile: 'BIN-GUARD-WEBAPP.json',
      webAppUrl: '' // optional: paste the /exec address here instead. Left empty, the page reads it from webAppFile.
    },
    // Projects Hub (Apps Script web app in the private projects-hub repo). Lisa OK'd the address here (1 Nov 2026): it
    // grants nothing on its own; Google limits the web app to her Workspace and the hub lets in only its EDITORS list.
    // The /a/macros/puppyclassroom.com/ form makes Google use the work account (the plain form loops when Chrome's
    // first account is a personal one, 2 Nov 2026).
    // sheetId: the hub's own Sheet ("Projects Hub TEST", lisa@puppyclassroom.com). The Dashboard reads its INDEX tab with
    // Lisa's read-only sign-in for the Projects tile's 3 numbers; it never writes. Empty = the tile shows no numbers.
    projectsHub: {
      sheetId: '1ssFH6uTD6uEYbxio6iA3BlP9Op3l2d7MRf_ktusMcTU',
      tab: 'INDEX',
      webAppUrl: 'https://script.google.com/a/macros/puppyclassroom.com/s/AKfycbx42JNrRiolxbf5JJEqnOwXy_GgYelx-6GKhQaNuQMyUsTW5e89P2VZBANP_yGSOxgj/exec'
    },
    money: {
      owner: 'lisa@puppyclassroom.com',
      driveId: '0AE4lOsGSf-cXUk9PVA',
      folders: {
        index: '1wB3t6ScV6mnbKpXU6UBjnMvToUt_A7rj', // 0.1 - Index
        ops: '115saDuLMClWZVfzIYTn2fN-BjPWijgBm', // 4 - Ops, the one that holds CHECK-LOG
        accountant: '1yBTSQKXDue6gRkfLD3g6FVOIHfFnt7kQ',
        factory: '1GkoMTMmH7B_zQvq5-DY_7KUYJzTAJKB1',
        drop: '10-HE-oa3eY9cHMAn5_gWHK9GFnNcqdKe'
      }
    }
  };
})(typeof window !== 'undefined' ? window : this);

// ---- Private settings loader (DASH_CONFIG.json on Drive) --------------------------------------------------------------
// The settings above are the fallback and keep working on their own. After Google sign-in this block looks in Drive for
// ONE file named privateConfig.fileName and, when it is found and trusted, can use its values in place of the ones above.
// No file, a broken file, a slow answer or no sign-in = the values above, exactly as before.
// Safety rails (tests: tests/mocked/private-config-rails.spec.js and private-config.spec.js):
//  - Trusted file only: owned by the signed-in person, or kept in a shared drive that Google limits to its own domain.
//    A file somebody else shared in is ignored. Two trusted files = neither is used.
//  - It may only fill in ids, Google addresses, the owner address and names that already have a place above. It can never
//    change the sign-in id, the permissions asked for, the Google API addresses, or any live / dryRun switch.
//  - Never-read drives can be added, never removed. An empty value never replaces a filled one.
//  - privateConfig.dryRun true = find and check the file, change nothing (DashConfigLoader.status() says what it found).
//  - Nothing is written to the console and no value is ever shown: status() gives counts and setting names only.
// With dryRun false the checked values are kept in this browser (cleared on sign-out) so the next page load starts with
// them, and the page reloads once when they differ from what it started with (never while someone is typing or tapping).
(function (root) {
  'use strict';
  var CFG = root.DASH_CONFIG;
  if (!CFG) return;
  var CACHE_KEY = 'ljr-dash-private-config', RELOAD_KEY = CACHE_KEY + '-reload';
  var TTL_MS = 15 * 60 * 1000, RETRY_MS = 60 * 1000, TIMEOUT_MS = 8000, MAX_BYTES = 65536;
  // Fixed before anything can be overridden: the loader only ever talks to the Google Drive API address written above.
  var API = String((CFG.urls && CFG.urls.driveApi) || 'https://www.googleapis.com/drive/v3');
  var BUILT_IN = JSON.stringify(CFG); // the settings exactly as written above

  var ID_RE = /^[A-Za-z0-9_-]{1,128}$/, TEXT_RE = /^[^\u0000-\u001f\u007f]{1,200}$/, EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}$/;
  var URL_RE = /^https:\/\/(docs\.google\.com|script\.google\.com|drive\.google\.com|forms\.gle)\/[^\s\\]{0,1900}$/;
  // Settings a Drive file can never change, whatever it says.
  var NEVER = /^(clientId|scopes|privateConfig|tidyApps|personalBin|excludedDrives)(\.|$)|^urls\.(files|drives|driveApi)$|^actionsMinutes\.usageUrl$/;

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  /** What sort of value a setting holds: 'id', 'email', 'url' or 'text'. '' = a Drive file may not change it. */
  function kindOf(path, key) {
    if (NEVER.test(path)) return '';
    if (/^money\.folders\.[^.]+$/.test(path) || /Id$/.test(key)) return 'id';
    if (path === 'money.owner') return 'email';
    if (path === 'urls.moveSheet' || /Url$/.test(key)) return 'url';
    if (/(Name|File)$/.test(key) || key === 'tab') return 'text';
    return '';
  }

  /** True when v is a filled-in, well-formed value of that sort. */
  function okValue(kind, v) {
    if (typeof v !== 'string') return false;
    if (kind === 'id') return ID_RE.test(v);
    if (kind === 'email') return EMAIL_RE.test(v);
    if (kind === 'url') return URL_RE.test(v);
    if (kind === 'text') return TEXT_RE.test(v);
    return false;
  }

  /** Works out what a private settings object may change in `base`. Changes nothing.
   *  Returns { set: [{ path, value }], drives: [{ id, name }], skipped: [{ path, why }] }. */
  function plan(base, over) {
    var out = { set: [], drives: [], skipped: [] };
    function skip(path, why) { if (out.skipped.length < 100) out.skipped.push({ path: String(path).slice(0, 80), why: why }); }
    if (!isObj(base) || !isObj(over)) { skip('', 'not a settings object'); return out; }
    (function walk(b, o, pre, depth) {
      Object.keys(o).forEach(function (k) {
        var path = pre + k, bv = b[k], ov = o[k];
        if (k.charAt(0) === '_') return; // notes for people
        if (path === 'cleanup.excludedDrives') {
          if (!Array.isArray(ov)) { skip(path, 'not a list'); return; }
          ov.slice(0, 50).forEach(function (d, i) {
            if (isObj(d) && okValue('id', d.id) && (d.name === undefined || okValue('text', d.name))) out.drives.push({ id: d.id, name: typeof d.name === 'string' ? d.name : '' });
            else skip(path + '[' + i + ']', 'not a valid drive entry');
          });
          return;
        }
        if (!own(b, k)) { skip(path, 'no place for it in config.js'); return; }
        if (NEVER.test(path)) { skip(path, 'never changed from Drive'); return; }
        if (isObj(bv)) {
          if (isObj(ov) && depth < 5) walk(bv, ov, path + '.', depth + 1); else skip(path, 'not a settings group');
          return;
        }
        var kind = typeof bv === 'string' ? kindOf(path, k) : '';
        if (!kind) { skip(path, 'never changed from Drive'); return; }
        if (!okValue(kind, ov)) { skip(path, ov === '' ? 'empty' : 'not a valid ' + kind); return; }
        out.set.push({ path: path, value: ov });
      });
    })(base, over, '', 0);
    return out;
  }

  /** Puts a plan's values into `base`. Returns how many settings changed. */
  function apply(base, p) {
    var changed = 0;
    p.set.forEach(function (s) {
      var parts = s.path.split('.'), o = base, last = parts.pop();
      for (var i = 0; i < parts.length; i++) o = o[parts[i]];
      if (o[last] !== s.value) { o[last] = s.value; changed++; }
    });
    p.drives.forEach(function (d) {
      if (!isObj(base.cleanup)) base.cleanup = {};
      if (!Array.isArray(base.cleanup.excludedDrives)) base.cleanup.excludedDrives = [];
      if (!Array.isArray(base.excludedDrives)) base.excludedDrives = [];
      if (!base.cleanup.excludedDrives.some(function (x) { return x && x.id === d.id; })) { base.cleanup.excludedDrives.push({ id: d.id, name: d.name }); changed++; }
      if (base.excludedDrives.indexOf(d.id) < 0) base.excludedDrives.push(d.id);
    });
    return changed;
  }

  // The checked values as a small settings object (what is kept in this browser between page loads).
  function keep(p) {
    var o = {};
    p.set.forEach(function (s) {
      var parts = s.path.split('.'), t = o, last = parts.pop();
      parts.forEach(function (k) { if (!own(t, k)) t[k] = {}; t = t[k]; });
      t[last] = s.value;
    });
    if (p.drives.length) { if (!own(o, 'cleanup')) o.cleanup = {}; o.cleanup.excludedDrives = p.drives; }
    return o;
  }
  // The full settings a page would run on with these private values ('' or null = the settings above alone).
  function effective(values) {
    var base = JSON.parse(BUILT_IN);
    if (values) apply(base, plan(base, values));
    return JSON.stringify(base);
  }

  var st = { state: 'off', dryRun: true, checkedAt: 0, found: 0, values: 0, drives: 0, wouldChange: 0, inUse: 0, skipped: [], pendingReload: false };
  function status() { var c = JSON.parse(JSON.stringify(st)); return c; }
  var api = { plan: plan, apply: apply, status: status, refresh: function () { return Promise.resolve(status()); }, ready: Promise.resolve(status()) };
  root.DashConfigLoader = api;

  // Tests and tools load this file without a browser: the checks above still work there, nothing below runs.
  if (!root.document || typeof root.fetch !== 'function' || typeof root.addEventListener !== 'function') return;
  var SET = isObj(CFG.privateConfig) ? CFG.privateConfig : {};
  if (SET.enabled !== true) return;
  var DRY = SET.dryRun !== false;
  st.dryRun = DRY;
  st.state = 'signed-out';

  var local = (function () { try { return root.localStorage; } catch (e) { return null; } })();
  var session = (function () { try { return root.sessionStorage; } catch (e) { return null; } })();
  function readCache() {
    try { var c = JSON.parse((local && local.getItem(CACHE_KEY)) || 'null'); return isObj(c) && typeof c.at === 'number' ? c : null; } catch (e) { return null; }
  }
  function writeCache(at, values) {
    try { if (local) local.setItem(CACHE_KEY, JSON.stringify(values ? { at: at, values: values } : { at: at })); } catch (e) {}
  }
  function forget() {
    try { if (local) local.removeItem(CACHE_KEY); } catch (e) {}
    try { if (session) session.removeItem(RELOAD_KEY); } catch (e2) {}
  }

  // Start of the page: with dryRun off, the values checked on an earlier visit go in before any page code reads a setting.
  var startedWith = null;
  if (!DRY) {
    var kept = readCache();
    if (kept && isObj(kept.values)) {
      var p0 = plan(CFG, kept.values); // checked again every time, so a changed browser store cannot get past the rails
      st.inUse = apply(CFG, p0);
      startedWith = keep(p0);
      st.state = 'in-use'; st.values = p0.set.length; st.drives = p0.drives.length;
    }
  }
  var runningOn = effective(startedWith);

  function token() {
    try { var a = root.DashAuth && root.DashAuth.valid(); return a && a.access_token ? a.access_token : ''; } catch (e) { return ''; }
  }
  function get(path, tok, signal) {
    return root.fetch(API + path, { headers: { Authorization: 'Bearer ' + tok }, signal: signal, cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('drive ' + r.status);
      return r;
    });
  }
  // A file is trusted when the signed-in person owns it (My Drive), or it sits in a shared drive limited to its own domain.
  function trusted(f, tok, signal) {
    if (!f.driveId) return Promise.resolve(f.ownedByMe === true);
    if (!ID_RE.test(String(f.driveId))) return Promise.resolve(false);
    return get('/drives/' + encodeURIComponent(f.driveId) + '?fields=' + encodeURIComponent('id,restrictions(domainUsersOnly)'), tok, signal)
      .then(function (r) { return r.json(); })
      .then(function (d) { return !!(d && d.restrictions && d.restrictions.domainUsersOnly === true); }, function (e) { if (signal.aborted) throw e; return false; });
  }
  function find(tok, signal) {
    var name = typeof SET.fileName === 'string' && TEXT_RE.test(SET.fileName) ? SET.fileName : 'DASH_CONFIG.json';
    var q = "name = '" + name.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "' and trashed = false";
    return get('/files?q=' + encodeURIComponent(q) + '&fields=' + encodeURIComponent('nextPageToken,files(id,name,size,ownedByMe,driveId)') +
      '&pageSize=20&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives', tok, signal)
      .then(function (r) { return r.json(); })
      .then(function (body) {
        var files = (body && Array.isArray(body.files) ? body.files : []).filter(function (f) { return f && f.name === name && typeof f.id === 'string' && ID_RE.test(f.id); });
        st.found = files.length;
        if (body && body.nextPageToken) return { state: 'ambiguous' };
        if (!files.length) return { state: 'absent' };
        return Promise.all(files.map(function (f) { return trusted(f, tok, signal); })).then(function (oks) {
          var good = files.filter(function (f, i) { return oks[i]; });
          if (good.length > 1) return { state: 'ambiguous' };
          if (!good.length) return { state: 'untrusted' };
          return { state: 'found', file: good[0] };
        });
      });
  }
  function readFile(f, tok, signal) {
    if (Number(f.size) > MAX_BYTES) return Promise.reject(new Error('too big'));
    return get('/files/' + encodeURIComponent(f.id) + '?alt=media&supportsAllDrives=true', tok, signal)
      .then(function (r) { return r.text(); })
      .then(function (t) {
        if (t.length > MAX_BYTES) throw new Error('too big');
        var j = JSON.parse(t);
        if (!isObj(j)) throw new Error('not a settings object');
        return j;
      });
  }

  var busy = null, touched = false;
  ['keydown', 'pointerdown', 'input'].forEach(function (ev) {
    root.addEventListener(ev, function () { touched = true; }, { capture: true, passive: true });
  });

  // The new values are kept for the next page load; the page reloads now only when nobody is using it and only once per change.
  function settle(values) {
    var want = effective(values);
    if (want === runningOn) { st.pendingReload = false; return; }
    var mark = String(want.length) + ':' + String(Array.prototype.reduce.call(want, function (h, c) { return (h * 31 + c.charCodeAt(0)) | 0; }, 7));
    var done = '';
    try { done = (session && session.getItem(RELOAD_KEY)) || ''; } catch (e) {}
    st.pendingReload = true;
    if (touched || !session || done === mark) return;
    try { session.setItem(RELOAD_KEY, mark); } catch (e2) { return; }
    root.location.reload();
  }

  /** Looks for the private settings file now (force true skips the 15-minute wait). Resolves with status(). Never rejects. */
  function refresh(force) {
    if (busy) return busy;
    var tok = token();
    if (!tok) { if (st.state !== 'in-use') st.state = 'signed-out'; return Promise.resolve(status()); }
    var c = readCache();
    if (!force && c && Date.now() - c.at < TTL_MS) { if (st.state === 'signed-out') st.state = 'checked-recently'; return Promise.resolve(status()); }
    var ctl = new AbortController(), slow = false;
    var timeoutMs = typeof SET.timeoutMs === 'number' && SET.timeoutMs > 0 ? SET.timeoutMs : TIMEOUT_MS;
    var timer = setTimeout(function () { slow = true; ctl.abort(); }, timeoutMs);
    var before = st.state;
    touched = false;
    st.state = 'checking';
    function failed(state) {
      // Whatever was in use stays in use. Try again in a minute, not on every page load.
      st.state = before === 'in-use' ? 'in-use' : state;
      var old = readCache();
      writeCache(Date.now() - TTL_MS + RETRY_MS, old && old.values);
    }
    busy = find(tok, ctl.signal).then(function (res) {
      if (res.state !== 'found') {
        st.values = 0; st.drives = 0; st.wouldChange = 0; st.skipped = [];
        if (res.state === 'absent') { st.state = 'absent'; writeCache(Date.now(), null); if (!DRY) settle(null); }
        else failed(res.state); // untrusted or ambiguous: nothing is used, and what was in use is left alone
        return;
      }
      return readFile(res.file, tok, ctl.signal).then(function (json) {
        var base = JSON.parse(BUILT_IN), p = plan(base, json);
        st.values = p.set.length; st.drives = p.drives.length; st.skipped = p.skipped;
        st.wouldChange = apply(base, p);
        if (DRY) { st.state = 'checked'; writeCache(Date.now(), null); return; }
        var values = keep(p);
        writeCache(Date.now(), values);
        st.state = 'in-use';
        settle(values);
      });
    }).catch(function () {
      failed(slow ? 'slow' : 'unreadable');
    }).then(function () {
      clearTimeout(timer);
      st.checkedAt = Date.now();
      busy = null;
      return status();
    });
    return busy;
  }
  api.refresh = refresh;

  // auth.js says when this tab's saved sign-in changes. Signing out forgets the kept values.
  root.addEventListener('dash-auth-change', function () {
    var signedOut = false;
    try { signedOut = !!root.DashAuth && !root.DashAuth.read(); } catch (e) {}
    if (signedOut) { forget(); if (st.state !== 'in-use') st.state = 'signed-out'; return; }
    refresh(false);
  });
  api.ready = new Promise(function (done) {
    function go() { refresh(false).then(done); }
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', go); else go();
  });
})(typeof window !== 'undefined' ? window : this);
