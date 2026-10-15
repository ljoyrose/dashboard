'use strict';
/**
 * Loads the REAL Apps Script files (code/apps-script/*.gs) into a Node sandbox with a fake Drive,
 * fake properties, fake cache and a controllable clock. Nothing here touches a real Google account
 * or Lisa's files.
 */
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const fx = require('./fixtures');

const GS_DIR = path.join(__dirname, '..', 'apps-script');
const ORDER = ['Config', 'Csv', 'Specs', 'Validate', 'Auth', 'Store', 'Sink', 'Web', 'Admin'];

// 2026-10-15 22:30:00 UTC = 23:30 BST (London is +01:00 until 25 Oct 2026)
const DEFAULT_NOW = Date.UTC(2026, 9, 15, 22, 30, 0);

function londonParts(ms) {
  const dtf = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'longOffset'
  });
  const o = {};
  dtf.formatToParts(new Date(ms)).forEach((p) => { o[p.type] = p.value; });
  let off = (o.timeZoneName || 'GMT').replace('GMT', '');
  if (off === '') off = 'Z'; // Java's XXX prints Z for a zero offset
  return { y: o.year, mo: o.month, d: o.day, h: o.hour, mi: o.minute, s: o.second, off };
}

function makeEnv(opts = {}) {
  const env = {
    nowMs: opts.nowMs || DEFAULT_NOW,
    props: Object.assign({}, opts.props || {}),
    cache: {},
    email: opts.email || '',
    drive: [],          // [{id,title,content}]
    writes: [],         // every setContent: {title, old, next}
    created: [],        // every createFile title
    logs: [],
    breakSetContent: false
  };
  let idc = 0;
  const addFile = (title, content) => { const f = { id: 'file' + (++idc), title, content }; env.drive.push(f); return f; };
  env.addFile = addFile;
  env.file = (title) => env.drive.filter((f) => f.title === title);
  env.text = (title) => env.file(title)[0].content;

  const wrap = (f) => ({
    getName: () => f.title, getId: () => f.id,
    getSize: () => Buffer.byteLength(f.content, 'utf8'),
    getBlob: () => ({ getDataAsString: () => f.content }),
    setContent(s) {
      env.writes.push({ title: f.title, old: f.content, next: s });
      f.content = env.breakSetContent ? s.slice(0, -1) : s;
    }
  });
  const folder = {
    getFilesByName(t) {
      const m = env.drive.filter((f) => f.title === t).map(wrap); let i = 0;
      return { hasNext: () => i < m.length, next: () => m[i++] };
    },
    createFile(t, c) { env.created.push(t); return wrap(addFile(t, c)); }
  };

  class FakeDate extends Date {
    constructor(...a) { if (a.length === 0) super(env.nowMs); else super(...a); }
    static now() { return env.nowMs; }
  }

  const ctx = {
    Date: FakeDate, console, Math, JSON, parseInt, parseFloat, isNaN, Object, Array, String, Number, RegExp, Error,
    Logger: { log: (m) => env.logs.push(String(m)) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (k in env.props ? env.props[k] : null),
      setProperty: (k, v) => { env.props[k] = String(v); }
    }) },
    CacheService: { getScriptCache: () => ({
      get: (k) => (k in env.cache ? env.cache[k] : null),
      put: (k, v) => { env.cache[k] = String(v); }
    }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Session: { getActiveUser: () => ({ getEmail: () => env.email }) },
    DriveApp: { getFolderById: (id) => { if (id !== 'FOLDER-TEST') throw new Error('no folder'); return folder; } },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (s) => ({ text: s, setMimeType() { return this; }, getContent() { return s; } })
    },
    HtmlService: {
      createHtmlOutput: (s) => ({ html: s, setTitle() { return this; } }),
      createHtmlOutputFromFile: (n) => ({ html: '[file ' + n + ']', setTitle() { return this; } })
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF_8' },
      computeDigest: (alg, str) => Array.from(crypto.createHash('sha256').update(String(str), 'utf8').digest()).map((b) => (b > 127 ? b - 256 : b)),
      getUuid: () => crypto.randomUUID(),
      formatDate(d, tz, pattern) {
        const p = londonParts(d.getTime());
        if (pattern === 'yyyyMMdd-HHmmss') return `${p.y}${p.mo}${p.d}-${p.h}${p.mi}${p.s}`;
        if (pattern === "yyyy-MM-dd'T'HH:mm:ssXXX") return `${p.y}-${p.mo}-${p.d}T${p.h}:${p.mi}:${p.s}${p.off}`;
        throw new Error('pattern not mocked: ' + pattern);
      }
    }
  };
  vm.createContext(ctx);
  ORDER.forEach((n) => {
    const file = path.join(GS_DIR, n + '.gs');
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  });
  env.ctx = ctx;
  return env;
}

/** A ready-to-use environment: fake folder, lookups, header-only target + pending files, one staff code, saving ON. */
function standardEnv(over = {}) {
  const env = makeEnv(Object.assign({ props: {} }, over));
  const c = fx.csvFiles();
  Object.keys(c).forEach((t) => env.addFile(t, c[t]));
  if (over.noTargets !== true) {
    env.addFile('BLD-area_reading.csv', fx.headerOnly(fx.AREA_READING_HEADER));
    env.addFile('BLD-_pending.csv', fx.headerOnly(fx.PENDING_HEADER));
  }
  Object.assign(env.props, {
    BLD_FOLDER_ID: 'FOLDER-TEST', TENANT_ID: fx.TENANT, ADMIN_EMAILS: 'owner@example.test',
    SAVE_ENABLED: 'true', TABLE_ON_area_reading: 'true'
  }, over.props || {});
  env.ctx.adminSetup();
  env.codes = {};
  // add codes through the real admin function by temporarily editing its constants
  const src = fs.readFileSync(path.join(GS_DIR, 'Admin.gs'), 'utf8');
  const mk = (name, role) => {
    const s = src.replace("var NAME = 'Example Name';", `var NAME = '${name}';`).replace("var ROLE = 'STAFF';", `var ROLE = '${role}';`);
    vm.runInContext(s.replace(/function admin(\w+)\(/g, 'function admin$1_t(') , env.ctx);
    return env.ctx.adminAddStaffCode_t();
  };
  env.codes.staff = mk('Sam Staff', 'STAFF');
  env.codes.owner = mk('Olive Owner', 'OWNER');
  return env;
}

let rid = 0;
const nextRid = () => 'req-test-' + String(++rid).padStart(6, '0');

function req(env, over = {}) {
  return Object.assign({
    v: 1, request_id: nextRid(), code: env.codes.staff, table: 'area_reading', action: 'add',
    fields: { area_id: 'area-t1', min_c: '21.47', max_c: '24.1' }
  }, over);
}

/** Run a save and return {ok, result} or {ok:false, code, message, fields} - the same shape the web app sends. */
function save(env, r) {
  try { return { ok: true, result: env.ctx.sinkHandle_(r) }; }
  catch (e) { return env.ctx.errorBody_(e); }
}

module.exports = { makeEnv, standardEnv, req, save, nextRid, DEFAULT_NOW };
