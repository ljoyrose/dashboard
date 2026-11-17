/**
 * BLD outdoor temperature log (the script bound to the BLD-outdoor_temp Sheet; Extensions > Apps Script > Code.gs).
 * Free source: Open-Meteo (no key, no account). Kept in the repo from 17 Nov 2026 so changes go through a PR.
 *
 * WHAT IT DOES
 *  - Keeps ONE row per day in the first tab ("readings"), in the same columns as the original BLD-outdoor_temp.csv,
 *    plus current_temp, current_at, locked.
 *  - Every 3 hours it updates today's row (min/max so far plus the current reading) and the next 6 days as
 *    reading_kind = "forecast". A forecast row is overwritten in place by the real figures once its day has passed.
 *  - It finalises yesterday's row as reading_kind = "actual".
 *  - Rows with locked = Y are never touched, so any value can be hand-edited safely.
 *  - Optional email warning when today's low is below WARN_LOW or the high is above WARN_HIGH.
 *
 * IDS (17 Nov 2026, Lisa: "Clear all failures and ensure this is not repeated"; wx-0584 and wx-0585 were used twice)
 *  - A new row takes the next number after the HIGHEST wx- id ever used: the highest in the sheet or the highest
 *    this script has handed out before (Script Property WX_LAST_ID), whichever is larger. A deleted row's number is
 *    never given out again.
 *  - Only one run writes at a time (LockService). A second run that cannot get the lock in 30 s writes nothing.
 *  - The archive back-fill takes ids the same way and skips days already in the sheet.
 *
 * SETTINGS (Script Properties; Project Settings > Script Properties. Not in this file: the repo is public.)
 *  LAT, LON        the point to read, e.g. 51.42, -3.21          (needed)
 *  LOCATION        text written in the location column            (needed)
 *  LOCATION_KEY    short location key, e.g. the postcode          (needed)
 *  TENANT          tenant id, e.g. ten-...                        (needed)
 *  ALERT_EMAIL     where the cold/hot warning goes; blank = no emails
 *  OLD_CSV_ID      Drive id of the old AccuWeather CSV, only for setup()'s one-off archive copy
 *  WX_LAST_ID      set by the script: the highest wx- number handed out so far
 *
 * INSTALL / UPDATE
 *  1. Set the Script Properties above (copy the values from the old CFG block before replacing the code).
 *  2. Paste this file over Code.gs, Save (toolbar button).
 *  3. Run fixTriggers() once: one trigger, run() every 3 hours; a trigger for a function that no longer exists
 *     (e.g. writeForecast) is deleted.
 */

var CFG = {
  TZ: 'Europe/London',
  WARN_LOW: 10,
  WARN_HIGH: 27,
  BACKFILL_FROM: '2025-01-01',
  FORECAST_DAYS: 7,                        // today + 6 days ahead; each becomes 'actual' once the day has passed
  TAB: 'readings',
  ARCHIVE_TAB: 'archive_accuweather',
  LOCK_WAIT_MS: 30000
};

var HEAD = ['id','tenant_id','location','location_key','on_date','reading_kind','min_temp','temp_unit_id',
  'max_temp','realfeel_max_temp','cloud_cover_pct','wind_kmh','rain_value','rain_unit_id','phrase',
  'captured_at','unit_as_returned','source','note','current_temp','current_at','locked'];
var COL = {}; HEAD.forEach(function (h, i) { COL[h] = i; });

var NOTE = 'Open-Meteo modelled values for the postcode point, not a weather station. '
  + '"actual" = finished day; "today" = still updating; "forecast" = future day, overwritten by the actual when it passes.';

/* ── entry points ─────────────────────────────────────────────── */

function setup() {
  var sh = sheet_();
  archiveOldCsv_();
  var days = daysBetween_(CFG.BACKFILL_FROM, today_()) + 1;
  withLock_(function () { record_(Math.min(days, 92)); });
  fixTriggers();
  Logger.log('Setup done: ' + (sh.getLastRow() - 1) + ' rows; trigger every 3 hours.');
}

function run() {
  withLock_(function () { record_(2); });   // yesterday (finalise) + today
  alert_();
}

/** Exactly one trigger: run() every 3 hours. Any other time trigger of this project (writeForecast and the like,
 *  whose function no longer exists and so fails every time) is deleted. Returns the handler names deleted. */
function fixTriggers() {
  var gone = [], kept = false;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var h = t.getHandlerFunction();
    if (h === 'run' && !kept) { kept = true; return; }
    ScriptApp.deleteTrigger(t); gone.push(h);
  });
  if (!kept) ScriptApp.newTrigger('run').timeBased().everyHours(3).create();
  Logger.log('Triggers: run every 3 hours' + (gone.length ? '; deleted ' + gone.join(', ') : ''));
  return gone;
}

/* ── core ─────────────────────────────────────────────────────── */

function record_(pastDays) {
  var c = cfg_();
  var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + c.LAT + '&longitude=' + c.LON
    + '&current=temperature_2m'
    + '&daily=temperature_2m_min,temperature_2m_max,apparent_temperature_max,cloud_cover_mean,'
    + 'wind_speed_10m_max,precipitation_sum,weather_code'
    + '&timezone=' + encodeURIComponent(CFG.TZ) + '&past_days=' + (pastDays - 1) + '&forecast_days=' + CFG.FORECAST_DAYS;
  var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) throw new Error('Open-Meteo ' + resp.getResponseCode() + ': ' + resp.getContentText());
  var d = JSON.parse(resp.getContentText()), dl = d.daily, cur = d.current || {};
  var today = today_(), now = Utilities.formatDate(new Date(), CFG.TZ, "yyyy-MM-dd'T'HH:mmXXX");

  var sh = sheet_(), data = sh.getDataRange().getValues(), byDate = {};
  for (var r = 1; r < data.length; r++) byDate[String(data[r][COL.on_date])] = r + 1;
  var ids = idMaker_(data);

  var added = 0;
  for (var i = 0; i < dl.time.length; i++) {
    var date = dl.time[i];
    if (date < CFG.BACKFILL_FROM) continue;
    var isToday = date === today;
    var rowNum = byDate[date];
    var existing = rowNum ? data[rowNum - 1] : null;
    if (existing && String(existing[COL.locked]).toUpperCase() === 'Y') continue;

    var row = existing ? existing.slice() : new Array(HEAD.length).fill('');
    if (!existing || !/^wx-\d+$/.test(String(row[COL.id]))) row[COL.id] = ids.next();   // a row with no proper id gets one too
    row[COL.tenant_id] = c.TENANT;
    row[COL.location] = c.LOCATION;
    row[COL.location_key] = c.LOCATION_KEY;
    row[COL.on_date] = date;
    row[COL.reading_kind] = date < today ? 'actual' : isToday ? 'today' : 'forecast';
    row[COL.min_temp] = r1_(dl.temperature_2m_min[i]);
    row[COL.temp_unit_id] = 'u-c';
    row[COL.max_temp] = r1_(dl.temperature_2m_max[i]);
    row[COL.realfeel_max_temp] = r1_(dl.apparent_temperature_max[i]);
    row[COL.cloud_cover_pct] = dl.cloud_cover_mean[i];
    row[COL.wind_kmh] = r1_(dl.wind_speed_10m_max[i]);
    row[COL.rain_value] = r1_(dl.precipitation_sum[i]);
    row[COL.rain_unit_id] = 'u-mm';
    row[COL.captured_at] = now;
    row[COL.unit_as_returned] = 'metric';
    row[COL.source] = 'Open-Meteo (free, no key)';
    row[COL.note] = NOTE;
    if (isToday && cur.temperature_2m != null) {
      row[COL.current_temp] = r1_(cur.temperature_2m);
      row[COL.current_at] = cur.time;
    }
    row[COL.phrase] = phrase_(row, dl.weather_code[i], isToday);
    row = row.map(function (v) { return v === null || v === undefined ? '' : String(v); });

    if (rowNum) sh.getRange(rowNum, 1, 1, HEAD.length).setValues([row]);
    else {
      var at = sh.getLastRow() + 1;
      if (at > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 50);
      sh.getRange(at, 1, 1, HEAD.length).setNumberFormat('@').setValues([row]);  // text first, so no date auto-convert
      byDate[date] = at; added++;
    }
  }
  ids.save();
  sh.sort(COL.on_date + 1, true);   // keep rows in date order
  return added;
}

/**
 * Hands out wx- ids: always above the highest number in the sheet (every row, whatever its kind or source) AND above
 * the highest this script has handed out before (WX_LAST_ID), so a number is never used twice, even after a row is
 * deleted. save() records the new highest; call it after the rows are written.
 */
function idMaker_(data) {
  var props = PropertiesService.getScriptProperties();
  var top = parseInt(props.getProperty('WX_LAST_ID') || '0', 10) || 0;
  for (var r = 1; r < data.length; r++) {
    var m = /^wx-(\d+)$/.exec(String(data[r][COL.id]).trim());
    if (m && parseInt(m[1], 10) > top) top = parseInt(m[1], 10);
  }
  return {
    next: function () { top++; return 'wx-' + (top < 10000 ? ('0000' + top).slice(-4) : String(top)); },
    save: function () { props.setProperty('WX_LAST_ID', String(top)); },
    top: function () { return top; }
  };
}

/** One run at a time. Another run already writing = this one writes nothing (the next 3-hourly run catches up). */
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(CFG.LOCK_WAIT_MS)) { Logger.log('Another run is writing; skipped.'); return null; }
  try { return fn(); } finally { lock.releaseLock(); }
}

/** The location and tenant settings, from Script Properties (see SETTINGS). Missing ones stop the run, plainly. */
function cfg_() {
  var p = PropertiesService.getScriptProperties(), c = {}, missing = [];
  ['LAT', 'LON', 'LOCATION', 'LOCATION_KEY', 'TENANT'].forEach(function (k) {
    c[k] = String(p.getProperty(k) || '').trim();
    if (!c[k]) missing.push(k);
  });
  if (missing.length) throw new Error('Script Properties missing: ' + missing.join(', ') + '. Nothing was written.');
  c.ALERT_EMAIL = String(p.getProperty('ALERT_EMAIL') || '').trim();
  c.OLD_CSV_ID = String(p.getProperty('OLD_CSV_ID') || '').trim();
  return c;
}

function phrase_(row, code, isToday) {
  var lo = parseFloat(row[COL.min_temp]), hi = parseFloat(row[COL.max_temp]);
  var parts = [];
  if (isToday && row[COL.current_temp] !== '') parts.push('Now ' + row[COL.current_temp] + ' °C');
  if (lo < CFG.WARN_LOW) parts.push('COLD: low under ' + CFG.WARN_LOW + ' °C');
  if (hi > CFG.WARN_HIGH) parts.push('HOT: high over ' + CFG.WARN_HIGH + ' °C');
  parts.push(wmo_(code));
  return parts.join(' · ');
}

function alert_() {
  var email = String(PropertiesService.getScriptProperties().getProperty('ALERT_EMAIL') || '').trim();
  if (!email) return;
  var props = PropertiesService.getScriptProperties(), today = today_();
  if (props.getProperty('alerted') === today) return;
  var data = sheet_().getDataRange().getValues();
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][COL.on_date]) !== today) continue;
    var lo = parseFloat(data[r][COL.min_temp]), hi = parseFloat(data[r][COL.max_temp]);
    if (lo < CFG.WARN_LOW || hi > CFG.WARN_HIGH) {
      MailApp.sendEmail(email, 'Outside temp warning ' + today + ': ' + lo + '–' + hi + ' °C',
        'Today: low ' + lo + ' °C, high ' + hi + ' °C.\nThresholds: below ' + CFG.WARN_LOW
        + ' or above ' + CFG.WARN_HIGH + ' °C.\n' + data[r][COL.phrase]);
      props.setProperty('alerted', today);
    }
  }
}

/* ── helpers ──────────────────────────────────────────────────── */

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CFG.TAB);
  if (!sh) { sh = ss.getSheets()[0]; sh.setName(CFG.TAB); }
  ss.setActiveSheet(sh); ss.moveActiveSheet(1);        // hub exports the FIRST tab only
  if (sh.getLastRow() === 0) sh.appendRow(HEAD);
  sh.getRange(1, 1, sh.getMaxRows(), HEAD.length).setNumberFormat('@');  // plain text: dates stay yyyy-MM-dd
  sh.setFrozenRows(1);
  return sh;
}

function archiveOldCsv_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), id = cfg_().OLD_CSV_ID;
  if (ss.getSheetByName(CFG.ARCHIVE_TAB) || !id) return;
  try {
    var csv = Utilities.parseCsv(DriveApp.getFileById(id).getBlob().getDataAsString());
    var a = ss.insertSheet(CFG.ARCHIVE_TAB);
    a.getRange(1, 1, csv.length, csv[0].length).setNumberFormat('@').setValues(csv);
  } catch (e) { Logger.log('Old CSV not archived (already gone?): ' + e); }
}

function today_() { return Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd'); }
function r1_(v) { return v == null ? '' : Math.round(v * 10) / 10; }
function daysBetween_(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }

function wmo_(c) {
  var m = {0:'Clear',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Freezing fog',
    51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',
    66:'Freezing rain',67:'Freezing rain',71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',
    80:'Showers',81:'Heavy showers',82:'Violent showers',85:'Snow showers',86:'Snow showers',
    95:'Thunderstorm',96:'Thunderstorm, hail',99:'Thunderstorm, hail'};
  return m[c] || '';
}

/**
 * One-off: actual days from the Open-Meteo archive between two dates. Days already in the sheet are skipped (never a
 * second row for a day) and new rows take ids after the highest ever used. Before 17 Nov 2026 this numbered from
 * wx-0001 and inserted at row 2, which is how ids came to be used twice.
 */
function backfillArchive_(start, end) {
  var c = cfg_();
  start = start || CFG.BACKFILL_FROM; end = end || today_();
  var url = 'https://archive-api.open-meteo.com/v1/archive'
    + '?latitude=' + c.LAT + '&longitude=' + c.LON
    + '&start_date=' + start + '&end_date=' + end
    + '&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max,cloud_cover_mean,wind_speed_10m_max,precipitation_sum'
    + '&timezone=Europe%2FLondon';
  var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) throw new Error('Open-Meteo archive ' + resp.getResponseCode() + ': ' + resp.getContentText());
  var daily = JSON.parse(resp.getContentText()).daily;
  var sh = sheet_(), data = sh.getDataRange().getValues(), have = {};
  for (var r = 1; r < data.length; r++) have[String(data[r][COL.on_date])] = true;
  var ids = idMaker_(data), now = Utilities.formatDate(new Date(), CFG.TZ, "yyyy-MM-dd'T'HH:mmXXX");
  function n_(v, f) { return v === null || v === undefined ? '' : String(Math.round(v * f) / f); }
  var rows = [];
  daily.time.forEach(function (date, i) {
    if (have[date]) return;
    var row = new Array(HEAD.length).fill('');
    row[COL.id] = ids.next(); row[COL.tenant_id] = c.TENANT; row[COL.location] = c.LOCATION;
    row[COL.location_key] = c.LOCATION_KEY; row[COL.on_date] = date; row[COL.reading_kind] = 'actual';
    row[COL.min_temp] = n_(daily.temperature_2m_min[i], 10); row[COL.temp_unit_id] = 'u-c';
    row[COL.max_temp] = n_(daily.temperature_2m_max[i], 10); row[COL.realfeel_max_temp] = n_(daily.apparent_temperature_max[i], 10);
    row[COL.cloud_cover_pct] = n_(daily.cloud_cover_mean[i], 1); row[COL.wind_kmh] = n_(daily.wind_speed_10m_max[i], 10);
    row[COL.rain_value] = n_(daily.precipitation_sum[i], 10); row[COL.rain_unit_id] = 'u-mm';
    row[COL.captured_at] = now; row[COL.unit_as_returned] = 'metric'; row[COL.source] = 'Open-Meteo archive (free, no key)';
    row[COL.note] = NOTE;
    rows.push(row);
  });
  if (rows.length) {
    var at = sh.getLastRow() + 1;
    if (at + rows.length - 1 > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), at + rows.length - 1 - sh.getMaxRows());
    sh.getRange(at, 1, rows.length, HEAD.length).setNumberFormat('@').setValues(rows);
    ids.save();
    sh.sort(COL.on_date + 1, true);
  }
  Logger.log('Backfill done: ' + rows.length + ' days added (' + start + ' to ' + end + ')');
  return rows.length;
}

function runBackfill() {
  return withLock_(function () { return backfillArchive_(); });
}
