(function (root) {
  'use strict';

  var CFG = {
    owner: 'lisa@puppyclassroom.com',
    driveId: '0AE4lOsGSf-cXUk9PVA',
    folders: {
      index: '1wB3t6ScV6mnbKpXU6UBjnMvToUt_A7rj',
      ops: '115saDuLMClWZVfzIYTn2fN-BjPWijgBm',
      accountant: '1yBTSQKXDue6gRkfLD3g6FVOIHfFnt7kQ',
      factory: '1GkoMTMmH7B_zQvq5-DY_7KUYJzTAJKB1',
      drop: '10-HE-oa3eY9cHMAn5_gWHK9GFnNcqdKe'
    }
  };
  var INDEX = [
    { key: 'register', name: 'MON-REGISTER.csv', folder: 'index', head: 'id' },
    { key: 'subjects', name: 'MON-SUBJECTS.csv', folder: 'index', head: 'id' },
    { key: 'intake', name: 'MON-INTAKE.csv', folder: 'index', head: 'id' },
    { key: 'dates', name: 'MON-DATES.csv', folder: 'ops', head: 'id' },
    { key: 'reports', name: 'MON-REPORTS.csv', folder: 'ops', head: 'week_of' },
    { key: 'checks', name: 'CHECK-LOG.csv', folder: 'ops', head: 'check_id' },
    { key: 'accountant', name: 'QUESTIONS-FOR-ACCOUNTANT.csv', folder: 'accountant', head: 'id' },
    { key: 'triggers', name: 'TRIGGERS.csv', folder: 'factory', head: 'trigger_id' }
  ];
  var LEDGER = {
    balances: { name: 'BALANCES.csv', head: 'account' },
    cashflow: { name: 'CASHFLOW.csv', head: 'expected_on' },
    forecast: { name: 'FORECAST.csv', head: 'projected_balance' },
    monthly: { name: 'MONTHLY.csv', head: 'month' },
    coming: { name: 'OUTGOINGS-NEXT.csv', head: 'expected_on' },
    recurring: { name: 'RECURRING.csv', head: 'counterparty' },
    liabilities: { name: 'LIABILITIES.csv', head: 'creditor' }
  };
  var CORE_SET = ['balances', 'cashflow', 'forecast', 'monthly', 'coming', 'recurring'];
  var XERO = {
    snapshot: { base: 'XERO-SNAPSHOT', head: 'metric' },
    recv: { base: 'XERO-RECEIVABLES', head: 'invoice_number' },
    pnl: { base: 'XERO-PNL', head: 'fy' },
    income: { base: 'XERO-INCOME-LINES', head: 'account' },
    unrec: { base: 'XERO-UNRECONCILED', head: 'reference' },
    banks: { base: 'XERO-BANK-ACCOUNTS', head: 'xero_account_id' },
    pay: { base: 'XERO-BILLS-UNPAID-BY-SUPPLIER', head: 'supplier' }
  };
  var API = 'https://www.googleapis.com/drive/v3';
  var FOLDER_MIME = 'application/vnd.google-apps.folder';
  var FILE_FIELDS = 'id,name,mimeType,modifiedTime,webViewLink,parents,size';
  var STALE_DAYS = 8;
  function parseCSV(text) {
    var rows = [], row = [], cell = '', q = false;
    text = String(text || '').replace(/^\uFEFF/, '').replace(/\r/g, '');
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return x.trim(); }); });
  }
  function parseTable(text, keyCol) {
    var rows = parseCSV(text);
    var hi = -1;
    for (var i = 0; i < Math.min(rows.length, 6); i++) {
      if (rows[i].some(function (c) { return c.trim() === keyCol; })) { hi = i; break; }
    }
    var prov = hi > 0 ? rows.slice(0, hi).map(function (r) { return r.join(','); }).join(' ') : '';
    if (hi < 0) return { prov: rows[0] ? rows[0].join(',') : '', head: [], rows: [], held: null, countOk: false, bad: 'header not found' };
    var head = rows[hi].map(function (c) { return c.trim(); });
    var recs = rows.slice(hi + 1).map(function (r) {
      var o = {}; head.forEach(function (k, j) { o[k] = (r[j] || '').trim(); }); return o;
    });
    var m = /(\d+)\s+(?:rows|triggers)\s+held/i.exec(prov) || /COUNT:\s*(\d+)/i.exec(prov);
    var held = m ? parseInt(m[1], 10) : null;
    return { prov: prov, head: head, rows: recs, held: held, countOk: held === null ? null : held === recs.length, hasCountLine: /^(CURRENT|COUNT)/i.test(prov) };
  }
  var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  function provDate(prov) {
    var m = /(\d{4}-\d{2}-\d{2})/.exec(prov || '');
    if (m) return m[1];
    m = /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i.exec(prov || '');
    if (m) return m[3] + '-' + pad(MONTHS[m[2].toLowerCase().slice(0, 3)]) + '-' + pad(+m[1]);
    return '';
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  var ukDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' });
  function todayISO() { return root.__MONEY_TODAY || ukDay.format(new Date()); }
  function isISO(d) { return /^\d{4}-\d{2}-\d{2}$/.test(d || ''); }
  function utc(iso) { var p = iso.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function toISO(ms) { var d = new Date(ms); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function addDays(iso, n) { return toISO(utc(iso) + n * 86400000); }
  function daysBetween(a, b) { return Math.round((utc(b) - utc(a)) / 86400000); }
  function nextDue(d, today) {
    today = today || todayISO();
    var m = /^weekly:(MON|TUE|WED|THU|FRI|SAT|SUN)$/i.exec(d || '');
    if (m) {
      var want = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 }[m[1].toUpperCase()];
      var dow = new Date(utc(today)).getUTCDay();
      return addDays(today, (want - dow + 7) % 7);
    }
    m = /^monthly:(\d{1,2})$/.exec(d || '');
    if (m) {
      var p = today.split('-'), y = +p[0], mo = +p[1], dd = +m[1];
      var cand = y + '-' + pad(mo) + '-' + pad(dd);
      if (cand < today) { mo++; if (mo > 12) { mo = 1; y++; } cand = y + '-' + pad(mo) + '-' + pad(dd); }
      return cand;
    }
    return d;
  }
  function isRecurring(d) { return /^(weekly|monthly):/i.test(d || ''); }
  function daysTo(d, today) { today = today || todayISO(); var n = nextDue(d, today); return isISO(n) ? daysBetween(today, n) : null; }
  function isDone(status) { return /^(done|filed|paid|closed|complete|answered)/i.test(status || ''); }
  function sev(days, status) {
    if (/urgent/i.test(status || '')) return 'risk';
    if (days === null) return 'none';
    if (days <= 14) return 'risk';
    if (days <= 45) return 'soon';
    return 'ok';
  }
  var PRIORITY = { urgent: 0, high: 1, normal: 2, low: 3 };
  function isOpen(r) { return !/^closed|^done|^answered/i.test(r.state || ''); }
  function isLisa(r) { return /^lisa\b/i.test(r.owner || ''); }
  function isTask(r) { return /^(todo|question|decision)$/i.test(r.kind || ''); }
  function ready(rec, all) {
    var t = String(rec.trigger_or_event || '').toLowerCase();
    if (t === 'now') return 'ready';
    var m = t.match(/^after\s+([a-z]\d{3})/i);
    if (m) {
      var dep = all.filter(function (x) { return String(x.id).toLowerCase() === m[1].toLowerCase(); })[0];
      return dep && !isOpen(dep) ? 'ready' : 'waits for ' + m[1].toUpperCase();
    }
    if (t.indexOf('at the gate') === 0) return 'at the gate';
    if (t.indexOf('event:') === 0) return 'on event';
    if (t.indexOf('named job') === 0) return 'job';
    if (t.indexOf('when ') === 0) return 'waiting';
    return t || 'unknown';
  }
  function yourTurn(data) {
    var all = data.register || [];
    return all.filter(function (r) { return isOpen(r) && isLisa(r) && isTask(r); }).map(function (r) {
      return { r: r, ready: ready(r, all) };
    }).sort(function (a, b) {
      var ra = a.ready === 'ready' ? 0 : 1, rb = b.ready === 'ready' ? 0 : 1;
      if (ra !== rb) return ra - rb;
      var pa = PRIORITY[a.r.priority] != null ? PRIORITY[a.r.priority] : 2, pb = PRIORITY[b.r.priority] != null ? PRIORITY[b.r.priority] : 2;
      if (pa !== pb) return pa - pb;
      return String(a.r.id).localeCompare(String(b.r.id), 'en-GB', { numeric: true });
    });
  }
  function isCompany(name) { return /\b(limited|ltd|cic|llp|plc)\b/i.test(name || ''); }
  function entities(data) {
    var list = (data.subjects || []).filter(function (r) { return r.kind === 'entity' && !/retired|template/i.test(r.status || ''); }).map(function (r) {
      return { code: r.entity, name: r.name, folder: r.drive_id, company: isCompany(r.name) };
    });
    return list.filter(function (e) { return e.company; }).concat(list.filter(function (e) { return !e.company; }));
  }
  function n(x) { var v = parseFloat(String(x == null ? '' : x).replace(/[£,\s]/g, '')); return isNaN(v) ? null : v; }
  function sum(rows, f) { return rows.reduce(function (s, r) { var v = n(f(r)); return s + (v || 0); }, 0); }
  function monthRows(mon) {
    if (!mon) return [];
    var t = mon.rows.filter(function (r) { return r.category === 'TOTAL' && r.month; });
    return t.slice().sort(function (a, b) { return a.month.localeCompare(b.month); });
  }
  function entityMoney(ent, files, today) {
    today = today || todayISO();
    var f = files || {};
    var out = { code: ent.code, name: ent.name, company: ent.company, has: Object.keys(f).filter(function (k) { return f[k] && f[k].table; }) };
    var T = function (k) { return f[k] && f[k].table ? f[k].table : null; };
    var bal = T('balances');
    if (bal) {
      var accts = bal.rows.filter(function (a) { return a.status !== 'nil'; });
      var known = accts.filter(function (a) { return a.balance !== ''; });
      out.accounts = accts;
      out.unknownAccounts = accts.filter(function (a) { return a.balance === ''; }).map(function (a) { return a.account; });
      if (known.length) {
        out.bank = sum(known, function (a) { return a.balance; });
        out.bankAsOf = known.map(function (a) { return a.as_of; }).sort().slice(-1)[0];
        out.bankAge = isISO(out.bankAsOf) ? daysBetween(out.bankAsOf, today) : null;
        out.bankStale = out.bankAge !== null && out.bankAge > STALE_DAYS;
      }
    }
    var coming = T('coming');
    if (coming) {
      var end = addDays(today, 30);
      var rows = coming.rows.filter(function (r) { return isISO(r.expected_on) && r.expected_on >= today && r.expected_on < end; });
      out.out30 = -sum(rows, function (r) { return r.amount; });
      var last = coming.rows.map(function (r) { return r.expected_on; }).filter(isISO).sort().slice(-1)[0];
      out.out30Partial = !last || last < addDays(end, -1);
      out.planDate = provDate(coming.prov);
    }
    var fc = T('forecast');
    if (fc) {
      var dry = fc.rows.filter(function (r) { var v = n(r.projected_balance); return v !== null && v < 0; })[0];
      var lastF = fc.rows.map(function (r) { return r.date; }).filter(isISO).sort().slice(-1)[0];
      out.forecastFrom = provDate(fc.prov);
      out.forecastTo = lastF || '';
      if (dry) {
        out.dry = dry.date;
        out.dryDays = isISO(dry.date) ? daysBetween(today, dry.date) : null;
        out.dryState = out.dryDays !== null && out.dryDays < 0 ? 'stale' : 'dry';
      } else out.dryState = lastF && lastF < today ? 'stale-ok' : 'ok';
    }
    var mon = T('monthly');
    if (mon) {
      var mt = monthRows(mon);
      var ledgerEnd = out.bankAsOf || provDate(mon.prov);
      var partial = ledgerEnd ? ledgerEnd.slice(0, 7) : null;
      var full = mt.filter(function (r) { return !partial || r.month < partial; });
      out.months = mt;
      var lm = full.slice(-1)[0];
      if (lm) {
        out.month = { month: lm.month, in: n(lm.money_in), out: -n(lm.money_out), net: n(lm.net) };
        var prev = full.slice(-4, -1);
        if (prev.length === 3) {
          out.avg3 = { months: prev.map(function (r) { return r.month; }), in: sum(prev, function (r) { return r.money_in; }) / 3, out: -sum(prev, function (r) { return r.money_out; }) / 3 };
        }
      }
    }
    var snap = T('snapshot');
    var sv = function (m) { var r = snap ? snap.rows.filter(function (x) { return x.metric === m; })[0] : null; return r ? { v: n(r.value_gbp), at: r.as_at, basis: r.basis } : null; };
    if (snap) { out.xcash = sv('cash_balance'); out.owedToYou = sv('receivables_outstanding'); out.youOwe = sv('payables_outstanding'); }
    var pay = T('pay');
    if (pay) {
      out.bills = { suppliers: pay.rows.length, total: sum(pay.rows, function (r) { return r.amount_due; }), asOf: provDate(pay.prov),
        overdue: sum(pay.rows.filter(function (r) { return isISO(r.oldest_due) && r.oldest_due < today; }), function (r) { return r.amount_due; }) };
    }
    var liab = T('liabilities');
    if (liab) {
      var lr = liab.rows.filter(function (r) { return r.status !== 'plan'; });
      out.liab = {
        rows: liab.rows,
        overdue: lr.filter(function (r) { return r.status === 'overdue'; }),
        check: lr.filter(function (r) { return r.status === 'check'; }),
        due: lr.filter(function (r) { return r.status === 'due'; }).sort(function (a, b) { return String(a.due).localeCompare(String(b.due)); }),
        asOf: provDate(liab.prov)
      };
      out.liab.overdueTotal = sum(out.liab.overdue, function (r) { return r.amount; });
      out.liab.checkTotal = sum(out.liab.check, function (r) { return r.amount; });
    }
    out.noData = !out.has.length;
    return out;
  }
  function datesView(data, today) {
    today = today || todayISO();
    return (data.dates || []).map(function (r) {
      var due = nextDue(r.due_on, today), d = isISO(due) ? daysBetween(today, due) : null;
      return { r: r, due: due, days: d, recurring: isRecurring(r.due_on), gap: !isISO(due), done: isDone(r.status), sev: sev(d, r.status) };
    }).sort(function (a, b) {
      if (a.gap !== b.gap) return a.gap ? 1 : -1;
      return String(a.due).localeCompare(String(b.due));
    });
  }
  function overdueDates(data, today) { return datesView(data, today).filter(function (x) { return !x.done && !x.recurring && x.days !== null && x.days < 0; }); }
  function dueWithin(data, today, days) { return datesView(data, today).filter(function (x) { return !x.done && x.days !== null && x.days >= 0 && x.days <= days; }); }
  function intakeOverdue(data, today) {
    today = today || todayISO();
    return (data.intake || []).filter(function (r) { return isISO(r.next_due) && r.next_due < today && !/^(live|retired)/i.test(r.status || ''); });
  }
  function needsNow(data, money, today) {
    today = today || todayISO();
    var items = [];
    overdueDates(data, today).forEach(function (x) {
      items.push({ level: 'risk', when: x.due, text: x.r.filing, who: x.r.owner, ent: x.r.entity, tag: 'Overdue ' + (-x.days) + (x.days === -1 ? ' day' : ' days'), href: '#/dates', src: 'MON-DATES ' + x.r.id });
    });
    (money || []).forEach(function (m) {
      if (m.liab && m.liab.overdue.length) {
        var dupe = overdueDates(data, today).some(function (x) { return (x.r.entity || '').split(';').indexOf(m.code) >= 0 && /hmrc|self assessment/i.test(x.r.filing); });
        if (!dupe) items.push({ level: 'risk', text: m.code + ': ' + m.liab.overdue.length + ' overdue on ' + m.liab.overdue[0].creditor, ent: m.code, tag: 'Overdue', href: '#/e/' + m.code, src: 'LIABILITIES ' + m.code });
      }
      if (m.dryState === 'dry' && m.dryDays !== null && m.dryDays <= 30) {
        items.push({ level: 'risk', text: m.code + ': forecast goes below zero', ent: m.code, tag: 'In ' + m.dryDays + ' days', href: '#/e/' + m.code, src: 'FORECAST ' + m.code });
      }
    });
    (data.register || []).filter(function (r) { return isOpen(r) && /urgent/i.test(r.priority || '') && isTask(r); }).forEach(function (r) {
      items.push({ level: 'risk', text: r.subject, who: r.owner, ent: r.entity, tag: isLisa(r) ? 'Your turn · urgent' : 'Waiting on ' + r.owner, href: '#/register/' + r.id, src: 'MON-REGISTER ' + r.id });
    });
    var stale = (money || []).filter(function (m) { return m.bankStale; });
    if (stale.length) {
      items.push({ level: 'ops', text: 'Statements are ' + Math.max.apply(null, stale.map(function (m) { return m.bankAge; })) + ' days old for ' + stale.map(function (m) { return m.code; }).join(' and ') + '. Drop new exports to refresh the figures.', tag: 'Old data', href: '#/control', src: 'BALANCES' });
    }
    var io = intakeOverdue(data, today);
    if (io.length) items.push({ level: 'ops', text: io.length + ' statement uploads are past their due date.', tag: 'Uploads', href: '#/control', src: 'MON-INTAKE' });
    dueWithin(data, today, 14).forEach(function (x) {
      if (/urgent/i.test(x.r.status)) return;
      if (x.recurring && x.days > 1) return;
      items.push({ level: 'ops', when: x.due, text: x.r.filing, who: x.r.owner, ent: x.r.entity, tag: x.days === 0 ? 'Today' : 'In ' + x.days + (x.days === 1 ? ' day' : ' days'), href: '#/dates', src: 'MON-DATES ' + x.r.id });
    });
    return items;
  }
  function Reader(getToken) { this.getToken = getToken; this.meta = {}; }
  Reader.prototype.get = function (url, asText) {
    var token = this.getToken();
    return fetch(url, { headers: { Authorization: 'Bearer ' + token } }).then(function (res) {
      if (res.ok) return asText ? res.text() : res.json();
      return res.json().catch(function () { return {}; }).then(function (b) {
        var e = new Error((b.error && b.error.message) || ('HTTP ' + res.status));
        e.status = res.status; e.reason = b.error && b.error.errors && b.error.errors[0] && b.error.errors[0].reason;
        throw e;
      });
    });
  };
  Reader.prototype.about = function () { return this.get(API + '/about?fields=user(emailAddress,displayName)'); };
  Reader.prototype.list = function (params) {
    var self = this, out = [];
    function page(tok) {
      var p = new URLSearchParams({ supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', pageSize: '1000', fields: 'nextPageToken,files(' + FILE_FIELDS + ')' });
      Object.keys(params).forEach(function (k) { p.set(k, params[k]); });
      if (tok) p.set('pageToken', tok);
      return self.get(API + '/files?' + p.toString()).then(function (r) {
        out = out.concat(r.files || []);
        return r.nextPageToken && out.length < 5000 ? page(r.nextPageToken) : out;
      });
    }
    return page(null);
  };
  Reader.prototype.folder = function (id, inDrive) {
    var p = { q: "'" + id + "' in parents and trashed = false" };
    if (inDrive) { p.corpora = 'drive'; p.driveId = CFG.driveId; } else p.corpora = 'allDrives';
    return this.list(p);
  };
  Reader.prototype.parent = function (id) {
    var self = this;
    if (this.meta[id]) return this.meta[id];
    this.meta[id] = this.get(API + '/files/' + encodeURIComponent(id) + '?supportsAllDrives=true&fields=id,name,parents').then(function (m) { return (m.parents || [])[0] || null; });
    return this.meta[id];
  };
  Reader.prototype.owningEntity = function (file, stopIds) {
    var self = this, depth = 0;
    function step(pid) {
      if (!pid || depth++ > 6) return Promise.resolve(null);
      if (stopIds[pid]) return Promise.resolve(stopIds[pid]);
      if (pid === CFG.driveId) return Promise.resolve(null);
      return self.parent(pid).then(step);
    }
    return step((file.parents || [])[0]);
  };
  Reader.prototype.content = function (id) {
    return this.get(API + '/files/' + encodeURIComponent(id) + '?alt=media&supportsAllDrives=true', true);
  };
  function mapLimit(items, limit, fn) {
    var i = 0, results = new Array(items.length);
    function worker() { if (i >= items.length) return Promise.resolve(); var k = i++; return Promise.resolve(fn(items[k], k)).then(function (r) { results[k] = r; return worker(); }); }
    var ws = []; for (var w = 0; w < Math.min(limit, items.length); w++) ws.push(worker());
    return Promise.all(ws).then(function () { return results; });
  }
  function pick(list, name) {
    var hits = list.filter(function (f) { return f.name === name && f.mimeType !== FOLDER_MIME; });
    if (!hits.length) return { error: 'missing' };
    if (hits.length > 1) return { error: 'duplicate ×' + hits.length, files: hits };
    return { file: hits[0] };
  }
  function loadAll(getToken, opts) {
    opts = opts || {};
    var rd = new Reader(getToken), today = todayISO();
    var res = { readAt: Date.now(), today: today, data: {}, meta: {}, ents: [], files: {}, money: [], problems: [] };
    return rd.about().then(function (a) {
      res.email = a.user && a.user.emailAddress || '';
      res.gate = res.email.toLowerCase() === CFG.owner ? 'ok' : 'denied';
      if (res.gate !== 'ok') return res;
      var keys = Object.keys(CFG.folders).filter(function (k) { return k !== 'drop'; });
      return Promise.all(keys.map(function (k) {
        return rd.folder(CFG.folders[k], k !== 'factory').then(function (l) { return [k, l]; }, function (e) { return [k, null, e]; });
      })).then(function (lists) {
        var byFolder = {}; lists.forEach(function (x) { byFolder[x[0]] = x[1] ? x[1] : { error: x[2] }; });
        var wanted = INDEX.filter(function (d) { return !opts.only || opts.only.indexOf(d.key) >= 0; });
        return mapLimit(wanted, 6, function (d) {
          var l = byFolder[d.folder];
          var m = { name: d.name, folder: d.folder };
          res.meta[d.key] = m;
          if (!l || l.error) { m.error = 'folder read failed'; return; }
          var p = pick(l, d.name);
          if (p.error) { m.error = p.error; return; }
          m.file = p.file;
          return rd.content(p.file.id).then(function (t) {
            var tb = parseTable(t, d.head);
            m.table = tb; m.asOf = provDate(tb.prov);
            res.data[d.key] = tb.rows;
          }, function (e) { m.error = e.message || 'read failed'; });
        });
      });
    }).then(function () {
      if (res.gate !== 'ok') return res;
      res.ents = entities(res.data);
      if (!res.ents.length) return res;
      var stop = {}; res.ents.forEach(function (e) { if (e.folder) stop[e.folder] = e.code; });
      var names = Object.keys(LEDGER).map(function (k) { return LEDGER[k].name; });
      res.ents.filter(function (e) { return e.company; }).forEach(function (e) {
        Object.keys(XERO).forEach(function (k) { names.push(XERO[k].base + '-' + e.code.toUpperCase() + '.csv'); });
      });
      var q = 'trashed = false and (' + names.map(function (x) { return "name = '" + x.replace(/'/g, "\\'") + "'"; }).join(' or ') + ')';
      return rd.list({ q: q, corpora: 'drive', driveId: CFG.driveId }).then(function (found) {
        return mapLimit(found, 6, function (f) { return rd.owningEntity(f, stop).then(function (code) { f._ent = code; }); }).then(function () { return found; });
      }).then(function (found) {
        var groups = {};
        found.forEach(function (f) {
          if (!f._ent) return;
          var key = null, ent = f._ent;
          Object.keys(LEDGER).forEach(function (k) { if (LEDGER[k].name === f.name) key = k; });
          Object.keys(XERO).forEach(function (k) { if (XERO[k].base + '-' + ent.toUpperCase() + '.csv' === f.name) key = k; });
          if (!key) return;
          var g = groups[ent] = groups[ent] || {};
          (g[key] = g[key] || []).push(f);
        });
        var jobs = [];
        Object.keys(groups).forEach(function (ent) {
          res.files[ent] = {};
          Object.keys(groups[ent]).forEach(function (k) {
            var list = groups[ent][k], spec = LEDGER[k] || XERO[k];
            var m = res.files[ent][k] = { name: list[0].name };
            if (list.length > 1) { m.error = 'duplicate ×' + list.length; return; }
            m.file = list[0];
            jobs.push(function () {
              return rd.content(m.file.id).then(function (t) { m.table = parseTable(t, spec.head); m.asOf = provDate(m.table.prov); }, function (e) { m.error = e.message || 'read failed'; });
            });
          });
          var have = Object.keys(groups[ent]);
          if (CORE_SET.some(function (k) { return have.indexOf(k) >= 0; })) {
            CORE_SET.forEach(function (k) { if (have.indexOf(k) < 0) res.files[ent][k] = { name: LEDGER[k].name, error: 'missing' }; });
          }
          if (Object.keys(XERO).some(function (k) { return have.indexOf(k) >= 0; })) {
            Object.keys(XERO).forEach(function (k) { if (have.indexOf(k) < 0) res.files[ent][k] = { name: XERO[k].base + '-' + ent.toUpperCase() + '.csv', error: 'missing' }; });
          }
        });
        return mapLimit(jobs, 6, function (j) { return j(); });
      });
    }).then(function () {
      if (res.gate !== 'ok') return res;
      res.money = res.ents.map(function (e) { return entityMoney(e, res.files[e.code], today); });
      return res;
    });
  }
  function fileChecks(res) {
    var out = [];
    Object.keys(res.meta).forEach(function (k) { out.push(check('Index', res.meta[k])); });
    Object.keys(res.files).forEach(function (ent) {
      Object.keys(res.files[ent]).forEach(function (k) { out.push(check(ent, res.files[ent][k])); });
    });
    function check(scope, m) {
      var t = m.table;
      var state = m.error ? 'fail' : !t ? 'wait' : t.countOk === false ? 'warn' : 'ok';
      var note = m.error ? m.error : !t ? 'not read' : t.countOk === false ? 'count line says ' + t.held + ', file has ' + t.rows.length : t.held !== null ? t.rows.length + ' rows, matches count line' : t.rows.length + ' rows, no count line';
      return { scope: scope, name: m.name, state: state, note: note, asOf: m.asOf || '', link: m.file && m.file.webViewLink, modified: m.file && m.file.modifiedTime };
    }
    return out;
  }

  function gbp(v, dp) {
    if (v === null || v === undefined || isNaN(v)) return '–';
    var d = dp === undefined ? 0 : dp;
    return (v < 0 ? '−' : '') + '£' + Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  var dFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  var dFmtY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  function fmtDate(iso, today) {
    if (!isISO(iso)) return String(iso || '');
    today = today || todayISO();
    return (iso.slice(0, 4) === today.slice(0, 4) ? dFmt : dFmtY).format(new Date(utc(iso)));
  }

  root.MoneyCore = {
    CFG: CFG, INDEX: INDEX, LEDGER: LEDGER, XERO: XERO, STALE_DAYS: STALE_DAYS,
    parseCSV: parseCSV, parseTable: parseTable, provDate: provDate,
    todayISO: todayISO, addDays: addDays, daysBetween: daysBetween, nextDue: nextDue, daysTo: daysTo, sev: sev, isISO: isISO,
    isOpen: isOpen, isLisa: isLisa, isTask: isTask, ready: ready, yourTurn: yourTurn,
    entities: entities, entityMoney: entityMoney, monthRows: monthRows, n: n, sum: sum,
    datesView: datesView, overdueDates: overdueDates, dueWithin: dueWithin, intakeOverdue: intakeOverdue, needsNow: needsNow,
    loadAll: loadAll, fileChecks: fileChecks, gbp: gbp, fmtDate: fmtDate
  };
})(window);
