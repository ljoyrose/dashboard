// A small in-memory stand-in for the Apps Script services the enquiries engine uses, so the real engine file can run
// under node against invented data. Nothing here talks to Google. Records every HTTP call and every write.
'use strict';
const vm = require('node:vm');

function makeSheet(name) {
  const rows = [];
  const sheet = {
    name, rows,
    getName: () => name,
    setName: (n) => { sheet.name = n; return sheet; },
    getLastRow: () => rows.length,
    getDataRange: () => ({ getValues: () => rows.map((r) => r.slice()) }),
    appendRow: (r) => { rows.push(r.slice()); return sheet; },
    setFrozenRows: () => sheet,
    getRange: (row, col, nr, nc) => ({
      setValues: (vals) => { for (let i = 0; i < nr; i++) { rows[row - 1 + i] = rows[row - 1 + i] || []; for (let j = 0; j < nc; j++) rows[row - 1 + i][col - 1 + j] = vals[i][j]; } return { setFontWeight: () => {} }; }
    })
  };
  return sheet;
}

function makeBook(name) {
  const sheets = [makeSheet('Sheet1')];
  return {
    sheets,
    getId: () => 'SAMPLE-BOOK-ID',
    getName: () => name,
    getUrl: () => 'https://example.invalid/book',
    getSheets: () => sheets,
    getSheetByName: (n) => sheets.find((s) => s.name === n) || null,
    insertSheet: (n) => { const s = makeSheet(n); sheets.push(s); return s; }
  };
}

// A book the engine may only READ (a litter allocation sheet): { tabName: [[header], [row] ...] }. Reading works;
// any other call on the book or its tabs is recorded in touched and throws, so a test sees an attempted write.
function readOnlyBook(id, tabs, touched) {
  const guard = (obj, what) => new Proxy(obj, { get: (t, k) => {
    if (k in t) return t[k];
    if (typeof k === 'symbol' || k === 'then') return undefined;
    return () => { touched.push(what + '.' + String(k)); throw new Error('read-only ' + what + ': ' + String(k)); };
  } });
  const sheets = Object.keys(tabs).map((n) => guard({ getName: () => n, getDataRange: () => guard({ getValues: () => tabs[n].map((r) => r.slice()) }, 'range') }, 'sheet ' + n));
  return guard({ getId: () => id, getName: () => 'allocation ' + id, getSheets: () => sheets, getSheetByName: (n) => sheets.find((s) => s.getName() === n) || null }, 'book ' + id);
}

// routes: [[RegExp, (url, opt) => jsonObject]]. Unmatched URLs throw, so a test sees any unexpected call.
// others: { bookId: { tabName: values } } read-only books (allocation sheets). touched lists any write tried on them.
function load(engineSource, { props = {}, routes = [], dryRun, gmail = [], files = [], others = {} } = {}) {
  const store = Object.assign({}, props);
  const http = [], touched = [];
  let book = null;
  const ctx = {
    console: { log: () => {} },
    Intl, Date, JSON, Math, Object, Array, String, Number, RegExp, Error, encodeURIComponent, decodeURIComponent, isNaN, parseInt,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in store ? store[k] : null), setProperty: (k, v) => { store[k] = v; } }) },
    SpreadsheetApp: {
      create: (n) => { book = makeBook(n); return book; },
      openById: (id) => {
        if (others[id]) return readOnlyBook(id, others[id], touched);
        if (!book || id !== 'SAMPLE-BOOK-ID') throw new Error('no such book ' + id);
        return book;
      }
    },
    // files: [{ id, name, text, created }] in the requests folder. Read only: no move, trash or delete is offered.
    DriveApp: { getFileById: () => ({ moveTo: () => {} }), getFolderById: () => {
      let i = 0;
      return { getFiles: () => ({ hasNext: () => i < files.length, next: () => { const f = files[i++]; return { getId: () => f.id, getName: () => f.name, getDateCreated: () => new Date(f.created || '2026-10-29T10:00:00Z'), getBlob: () => ({ getDataAsString: () => f.text }) }; } }) };
    } },
    Utilities: { formatDate: (d) => d.toISOString().slice(0, 19), sleep: () => {} },
    ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyHours: () => ({ create: () => {} }) }) }) },
    // gmail: [{ id, from, to, subject, body, date, labels }] -> read-only thread objects. Every call is recorded.
    GmailApp: {
      search: (q, start, max) => { http.push({ url: 'gmail:search ' + q, method: 'get' }); return gmail.slice(start || 0, max || 100).map((m) => ({
        getId: () => m.id, getLabels: () => (m.labels || []).map((n) => ({ getName: () => n })), isInSpam: () => false,
        getMessages: () => [{ getFrom: () => m.from, getTo: () => m.to || '', getSubject: () => m.subject, getPlainBody: () => m.body, getDate: () => new Date(m.date || '2026-10-20T10:00:00Z') }]
      })); }
    },
    UrlFetchApp: {
      fetch: (url, opt) => {
        http.push({ url, method: (opt && opt.method) || 'get', headers: opt && opt.headers });
        const r = routes.find(([re]) => re.test(url));
        if (!r) throw new Error('unexpected HTTP call in test: ' + url);
        const body = JSON.stringify(r[1](url, opt));
        return { getResponseCode: () => 200, getContentText: () => body };
      }
    }
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  let src = engineSource;
  if (dryRun === false) src = src.replace('var DRY_RUN = true;', 'var DRY_RUN = false;');
  vm.runInContext(src, ctx, { filename: 'Code.gs' });
  return {
    ctx, http, touched, props: store,
    book: () => book,
    tab: (n) => { const s = book && book.getSheetByName(n); if (!s) return []; const [h, ...rs] = s.rows; return rs.map((r) => Object.fromEntries(h.map((c, i) => [c, r[i]]))); }
  };
}

module.exports = { load };
