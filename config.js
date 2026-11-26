(function (root) {
  'use strict';
  var EXCLUDED = [
    { id: '0AEf6v2sKb4FrUk9PVA', name: 'Karen - SHARED' }
  ];
  root.DASH_CONFIG = {
    clientId: '135419966158-qqhndd85mott7p7rqbjbrji8sjhbkt88.apps.googleusercontent.com',
    scopes: {
      read: 'https://www.googleapis.com/auth/drive.readonly',
      write: 'https://www.googleapis.com/auth/drive',
      personal: 'https://www.googleapis.com/auth/drive.metadata.readonly'
    },
    // Private settings file (the loader is at the bottom of this file). After Google sign-in the dashboard looks in Drive
    // for one trusted file with this name and can use its ids and addresses in place of the ones written here.
    // enabled false = never look. dryRun true = find and check the file but change nothing; switching it off is the owner's call.
    // Optional: timeoutMs = how long to wait for Drive before carrying on without the file (8 seconds when not set).
    privateConfig: {
      enabled: true,
      dryRun: true,
      fileName: 'DASH_CONFIG.json'
    },
    excludedDrives: EXCLUDED.map(function (d) { return d.id; }),
    cleanup: {
      excludedDrives: EXCLUDED,
      sharedDriveAllowIds: []
    },
    // Personal Drive page bin (TidyUp Apps stage 3). The page stays look-only until the owner presses "Allow personal bin
    // actions". A file can be binned only if it starts ZZ_DELETE_DRIVE_ and has a ledger row whose surface is `surface`.
    // dryRun true = the page lists what would be renamed or binned and changes nothing. the owner switched it off on 13 Nov 2026.
    // Its Rename step writes each renamed exact copy's ledger row itself (surface below), so those files become binnable.
    personalBin: {
      surface: 'drive-personal',
      dryRun: false
    },
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
      dbxFolderId: '0AEqV6Ky2jpmDUk9PVA',
      dbxTotalsName: 'DROPBOX-TOTALS.json',
      runLogFolderId: '',
      runLogName: 'RUN-LOG.csv'
    },
    // Bin page Canva card (TidyUp Apps stage 1). The page never calls Canva. It reads stateFile from folderId (00 AI Commons >
    // CHANGES), written by the CANVA-BIN bot, and writes ledger slips and CANVA-BIN-REQUEST_ files there. accounts are
    // labels only (no emails). dryRun true = the card lists and changes nothing; switching it off is the owner's call.
    canvaBin: {
      folderId: '11J2IuEGBT6fThCFD3UCN86J_9ZbiGhrF',
      stateFile: 'CANVA-BIN-STATE.json',
      accounts: ['main', 'book'],
      dryRun: true
    },
    cdhub: {
      folderId: '10m8HauOLAdj2QStgNJ2T3b3W599VXWro',
      folderName: '*01 SLA Inspections / BLD-app-tables',
      demoFolderId: '1W3axz-_p85ctrn2ZvBYn_Yi8T9-MoaZd',
      readingsSheetId: '1utmtG6V2q4kLQT15LtHg_AyncNObeBSyXyV86MaV8o0', // BLD-outdoor_temp readings sheet
      saveScriptUrl: '',
      enquiriesWrites: false
    },
    // Marketplace page: the "Marketplace" tab of RR_OPEN-WORK (filled by the RR_MKT-ENGINE Apps Script). Taps write only the
    // answer cells. wakeFolderId/wakeFile: optional Drive file holding the engine's web-app address (empty = the engine's
    // 15-minute timer picks taps up). live: false shows the TEST stamp until the owner switches the engine to LIVE.
    // GA Hub (food/): Designer Dog Foods orders, GA invoices and the product list. Read with the owner's sign-in from RR_FOOD
    // (RR_DDF folder), which the RR_FOOD-ENGINE Apps Script fills. The page writes only the 4 answer cells of a Cards row.
    food: {
      bookId: '1Lags6XfdNhvxwxGNgEKwfoosHr6ci9rzG-QXulgCfxU', // RR_FOOD (RR_DDF folder)
      live: false
    },
    studio: {
      rootFolderId: '1zY7WMtfw_w5GioaoQlyEKkew-0dYZLvQ',
      logsFolderId: '1Yq9ELzfAE27sxD1k3_KYEDCSz5BzmcdI',
      requestsFolderId: '13KclIUhOej1bmoQznfbrUiHtoab-FnDV',
      inboxFolderId: '1poaewHMRwrOcXwXa0PrMZhnmhyn66BzL',
      stateFile: 'studio-state.json',
      ownedTools: { sheetId: '1iwlUFBeFOAUxlHlr8FsCIxpmhqSWzq3038OEDN-Zfz8', tab: 'OWNED_TOOLS' }, // STUDIO-CONTROL sheet, Owned Tools tab
      live: false
    },
    // Tech section (Dashboard > More > Tech, TECH-HUB-1): one tile per paid tool, read with the owner's sign-in from the same tools tab
    // as studio.ownedTools above (no second sheet, no second id), once per page load, by header name. Until the tab has the Tech
    // columns the page shows invented Example tiles. devHostingSlot: the Dev and hosting group's colour slot (0-8). TBC, the owner's
    // decision: this one value moves every Dev and hosting tile. freshDays: a row older than this shows "Not updated since".
    // requestsFolderId: where Add tech drops one TECH-ROW-REQUEST_ file for the engine to append the row. Empty = Add tech says
    // "Not saved" and sends nothing (the engine has no tech-row handler yet).
    tech: {
      devHostingSlot: 6,
      freshDays: 35,
      requestsFolderId: ''
    },
    // Web Estate Hub (estate/): reads the private RR_WEB-ESTATE sheet (Properties tab) with the owner's sign-in; Add drops one
    // request file into requestsFolderId for the RR_WEB-ESTATE engine. Both ids stay empty until the owner installs the engine:
    // until then the page shows invented example rows and sends nothing. Read only: nothing here changes DNS or a site.
    estate: {
      sheetId: '',
      requestsFolderId: '',
      live: false
    },
    // Actions minutes card (Home). Reads ACTIONS-MINUTES.json (counts only) from folderId with the owner's sign-in; the file is
    // written by the private ACTIONS-MINUTES collector (Apps Script in Drive, read-only GitHub token in its Script Properties).
    // folderId: the folder that also holds DROPBOX-TOTALS.json. Empty = invented example data with the Example tag, reads nothing.
    // repoLabels: short labels only (the collector maps real repos to these); they set the row order. Never real repo names.
    actionsMinutes: {
      folderId: '0AEqV6Ky2jpmDUk9PVA',
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
      listingsFileId: '1JkewFinU42nKX7JDEwRHZY0I-FKdBhdW',
      wakeFolderId: '',
      wakeFile: 'MKT-WAKE-WEBAPP.json',
      ideasRequestsFolderId: '1cd3vZwUYB0pNFUTQzSOMkYwuOeATG7Rv',
      live: false
    },
    // Puppy Enquiries Hub (enquiries/): reads the private RR_ENQUIRIES sheet (filled by the enquiries engine) with the owner's
    // sign-in; a tap drops one request file into requestsFolderId. Both empty = example mode: invented rows, nothing sent.
    enquiries: {
      sheetId: '',
      requestsFolderId: '',
      live: false
    },
    factory: {
      logsFolderId: '1e04LM9qA2lXpy63Qfcd7x9HEEjhsMj9k',
      requestsFolderId: '1Z1Iuc_rRFq7cy12ELM0seZ-onpCSfDQ2',
      ideaFormUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSfzzTnlyNWeXzFEz9NfYxNXsCFN6KwV8RxFyIRTJZ-WrH15nw/viewform'
    },
    binGuard: {
      checkFolderId: '1o7ag4AndYA20h7aOmPsm0x69q3f2PqaZ',
      homeFolderId: '1HKAMkAER7ft-xMJYUQGzi_v6jV-3vQwk',
      webAppFile: 'BIN-GUARD-WEBAPP.json',
      webAppUrl: ''
    },
    // Projects Hub (Apps Script web app in the private projects-hub repo). the owner OK'd the address here (1 Nov 2026): it
    // grants nothing on its own; Google limits the web app to her Workspace and the hub lets in only its EDITORS list.
    // The /a/macros/puppyclassroom.com/ form makes Google use the work account (the plain form loops when Chrome's
    // first account is a personal one, 2 Nov 2026).
    // the owner's read-only sign-in for the Projects tile's 3 numbers; it never writes. Empty = the tile shows no numbers.
    projectsHub: {
      sheetId: '1ssFH6uTD6uEYbxio6iA3BlP9Op3l2d7MRf_ktusMcTU',
      tab: 'INDEX',
      webAppUrl: 'https://script.google.com/a/macros/puppyclassroom.com/s/AKfycbx42JNrRiolxbf5JJEqnOwXy_GgYelx-6GKhQaNuQMyUsTW5e89P2VZBANP_yGSOxgj/exec'
    },
    money: {
      user: 'user@puppyclassroom.com',
      driveId: '0AE4lOsGSf-cXUk9PVA',
      folders: {
        index: '1wB3t6ScV6mnbKpXU6UBjnMvToUt_A7rj',
        ops: '115saDuLMClWZVfzIYTn2fN-BjPWijgBm',
        accountant: '1yBTSQKXDue6gRkfLD3g6FVOIHfFnt7kQ',
        factory: '1GkoMTMmH7B_zQvq5-DY_7KUYJzTAJKB1',
        drop: '10-HE-oa3eY9cHMAn5_gWHK9GFnNcqdKe'
      }
    }
  };
})(typeof window !== 'undefined' ? window : this);

(function (root) {
  'use strict';
  var CFG = root.DASH_CONFIG;
  if (!CFG) return;
  var CACHE_KEY = 'ljr-dash-private-config', RELOAD_KEY = CACHE_KEY + '-reload';
  var TTL_MS = 15 * 60 * 1000, RETRY_MS = 60 * 1000, TIMEOUT_MS = 8000, MAX_BYTES = 65536;
  var API = String((CFG.urls && CFG.urls.driveApi) || 'https://www.googleapis.com/drive/v3');
  var BUILT_IN = JSON.stringify(CFG); // the settings exactly as written above

  var ID_RE = /^[A-Za-z0-9_-]{1,128}$/, TEXT_RE = /^[^\u0000-\u001f\u007f]{1,200}$/, EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}$/;
  var URL_RE = /^https:\/\/(docs\.google\.com|script\.google\.com|drive\.google\.com|forms\.gle)\/[^\s\\]{0,1900}$/;
  var NEVER = /^(clientId|scopes|privateConfig|tidyApps|personalBin|excludedDrives)(\.|$)|^urls\.(files|drives|driveApi)$|^actionsMinutes\.usageUrl$/;

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function kindOf(path, key) {
    if (NEVER.test(path)) return '';
    if (/^money\.folders\.[^.]+$/.test(path) || /Id$/.test(key)) return 'id';
    if (path === 'money.user') return 'email';
    if (path === 'urls.moveSheet' || /Url$/.test(key)) return 'url';
    if (/(Name|File)$/.test(key) || key === 'tab') return 'text';
    return '';
  }

  function okValue(kind, v) {
    if (typeof v !== 'string') return false;
    if (kind === 'id') return ID_RE.test(v);
    if (kind === 'email') return EMAIL_RE.test(v);
    if (kind === 'url') return URL_RE.test(v);
    if (kind === 'text') return TEXT_RE.test(v);
    return false;
  }

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
  function effective(values) {
    var base = JSON.parse(BUILT_IN);
    if (values) apply(base, plan(base, values));
    return JSON.stringify(base);
  }

  var st = { state: 'off', dryRun: true, checkedAt: 0, found: 0, values: 0, drives: 0, wouldChange: 0, inUse: 0, skipped: [], pendingReload: false };
  function status() { var c = JSON.parse(JSON.stringify(st)); return c; }
  var api = { plan: plan, apply: apply, status: status, refresh: function () { return Promise.resolve(status()); }, ready: Promise.resolve(status()) };
  root.DashConfigLoader = api;

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
    try {
      if (!local) return;
      if (values) local.setItem(CACHE_KEY, JSON.stringify({ at: at, values: values })); else local.removeItem(CACHE_KEY);
    } catch (e) {}
  }
  function forget() {
    try { if (local) local.removeItem(CACHE_KEY); } catch (e) {}
    try { if (session) session.removeItem(RELOAD_KEY); } catch (e2) {}
  }

  var startedWith = null;
  if (!DRY) {
    var kept = readCache();
    if (kept && isObj(kept.values)) {
      var p0 = plan(CFG, kept.values);
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

  function refresh(force) {
    if (busy) return busy;
    var tok = token();
    if (!tok) { if (st.state !== 'in-use') st.state = 'signed-out'; return Promise.resolve(status()); }
    var c = readCache();
    if (!force && (st.checkedAt || (c && Date.now() - c.at < TTL_MS))) return Promise.resolve(status());
    var ctl = new AbortController(), slow = false;
    var timeoutMs = typeof SET.timeoutMs === 'number' && SET.timeoutMs > 0 ? SET.timeoutMs : TIMEOUT_MS;
    var timer = setTimeout(function () { slow = true; ctl.abort(); }, timeoutMs);
    var before = st.state;
    touched = false;
    st.state = 'checking';
    function failed(state) {
      st.state = before === 'in-use' ? 'in-use' : state;
      var old = readCache();
      if (old && old.values) writeCache(Date.now() - TTL_MS + RETRY_MS, old.values);
    }
    busy = find(tok, ctl.signal).then(function (res) {
      if (res.state !== 'found') {
        st.values = 0; st.drives = 0; st.wouldChange = 0; st.skipped = [];
        if (res.state === 'absent') { st.state = 'absent'; writeCache(Date.now(), null); if (!DRY) settle(null); }
        else failed(res.state);
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

