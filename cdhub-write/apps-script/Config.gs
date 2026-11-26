var BLD = {
  VERSION: '1.3.0',
  TZ: 'Europe/London',
  PROP: {
    SAVE_ENABLED: 'SAVE_ENABLED',
    TABLE_ON_PREFIX: 'TABLE_ON_',
    MODE_PREFIX: 'MODE_',
    FOLDER_ID: 'BLD_FOLDER_ID',
    TENANT_ID: 'TENANT_ID',
    ADMIN_EMAILS: 'ADMIN_EMAILS',
    SALT: 'CODE_SALT',
    REGISTRY: 'STAFF_REGISTRY',
    ALLOW_CREATE: 'ALLOW_CREATE',
    BACKUP_ON: 'BACKUP_ON',
    READ_ENABLED: 'READ_ENABLED',
    USER_EDIT_ENABLED: 'USER_EDIT_ENABLED',
    MOVES_QUEUE_UNTIL: 'MOVES_QUEUE_UNTIL',
    DOG_PHOTOS_FOLDER: 'DOG_PHOTOS_FOLDER_ID',
    FILES_FOLDER: 'FILES_FOLDER_ID',
    INSPECT_PAGE_URL: 'INSPECT_PAGE_URL',
    INSPECT_SCRIPT_ID: 'INSPECT_SCRIPT_ID',
    HUB_CLIENT_ID: 'HUB_CLIENT_ID'
  },
  RETENTION_FILE: 'BLD-retention_setting.csv',
  LIMITS: {
    MAX_BODY_CHARS: 60000,
    MAX_PHOTO_CHARS: 2500000,
    MAX_PHOTO_B64: 1800000,
    MAX_FILE_B64: 1800000,
    MAX_TEXT_CHARS: 500,
    FAIL_WINDOW_SEC: 600,
    FAIL_MAX: 25,
    DUP_WINDOW_MIN: 30,
    PERIOD_MAX_AGE_HOURS: 168,
    SAVE_TAIL_ROWS: 200,
    RETENTION_DEFAULT_YEARS: 6,
    REQUEST_CACHE_SEC: 86400,
    LOCK_WAIT_MS: 20000,
    MAX_BATCH_ITEMS: 200,
    TEMP_MIN: -30,
    TEMP_MAX: 60,
    READ_MAX_ROWS: 3000,
    READ_TAIL_ROWS: 3000,
    MOVES_QUEUE_DAYS: 14,
    CHECK_MAX_DOGS: 500
  },
  VISIBILITY_FILE: 'BLD-field_visibility.csv',
  PENDING_FILE: 'BLD-_pending.csv',
  PENDING_COLUMNS: [
    'event_id', 'pending_id', 'event', 'at', 'by', 'role', 'target_file',
    'kind', 'row_id', 'corrects_id', 'note', 'payload_json', 'result'
  ]
};

var TZ_MEMO_ = {};
var TZ_FILE_ = 'BLD-locale.csv';
var TZ_RE_ = /^[A-Za-z]+(?:\/[A-Za-z0-9_+\-]+){1,2}$|^UTC$/;

function tzFallback_() {
  try { var z = Session.getScriptTimeZone(); if (z) return z; } catch (e) { /* not available */ }
  return 'UTC';
}

function tzRows_(tenant) {
  var key = 'tzrows:' + (tenant || ''), cache = null, hit;
  if (TZ_MEMO_[key]) return TZ_MEMO_[key];
  try { cache = CacheService.getScriptCache(); hit = cache.get(key); } catch (e) { cache = null; }
  if (hit) { try { return (TZ_MEMO_[key] = JSON.parse(hit)); } catch (e) { /* re-read */ } }
  var out = [], read = null;
  try { read = store_read_(TZ_FILE_, false); } catch (e) { read = null; }
  ((read && read.records) || []).forEach(function (r) {
    var tz = String(r.time_zone || '').trim();
    if (!tz || !TZ_RE_.test(tz) || (tenant && r.tenant_id && r.tenant_id !== tenant)) return;
    out.push({ tz: tz, from: String(r.from_date || ''), to: String(r.to_date || '') });
  });
  if (cache) { try { cache.put(key, JSON.stringify(out), 600); } catch (e) { /* too big or unavailable */ } }
  return (TZ_MEMO_[key] = out);
}

function tzForget_(tenant) {
  var key = 'tzrows:' + (tenant || '');
  delete TZ_MEMO_[key];
  try { CacheService.getScriptCache().remove(key); } catch (e) { /* unavailable */ }
}

function tzOn_(tenant, day) {
  if (tenant === undefined || tenant === null || tenant === '') { try { tenant = prop_(BLD.PROP.TENANT_ID); } catch (e) { tenant = ''; } }
  var d = /^\d{4}-\d{2}-\d{2}$/.test(String(day || '')) ? String(day) : new Date().toISOString().slice(0, 10);
  var best = null;
  tzRows_(tenant).forEach(function (r) {
    if ((r.from && r.from > d) || (r.to && r.to < d)) return;
    if (!best || r.from >= best.from) best = r;
  });
  return best ? best.tz : tzFallback_();
}

function tzNotSet_() {
  var tenant = ''; try { tenant = prop_(BLD.PROP.TENANT_ID); } catch (e) { tenant = ''; }
  var d = new Date().toISOString().slice(0, 10);
  return !tzRows_(tenant).some(function (r) { return !(r.from && r.from > d) && !(r.to && r.to < d); });
}

Object.defineProperty(BLD, 'TZ', { get: function () { return tzOn_(); }, enumerable: true });

