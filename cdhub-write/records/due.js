/*!
 * BLDDue - when each job was last done and when it is next due, from BLD-check_type and BLD-check_log rows.
 * Works everything out from rows the owner entered: nothing here names a job. No screen, no saving, no data.
 *
 * Reads two check_type columns that are NOT on the sheet yet. Until they are, every job is simply "as needed":
 *   every_days  whole number of days between jobs; blank means as needed
 *   includes    type_keys this job also covers, separated by | (a full groom can restart nails and ears;
 *               a whole-site clean can restart each room's daily clean, except rooms in its not_in_areas)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDDue = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DAY = 86400000;

  function londonDate(value) {
    var d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  }
  function addDays(date, n) { return new Date(Date.parse(date + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10); }
  function daysBetween(from, to) { return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / DAY); }
  function isOff(v) { return String(v).toLowerCase() === 'false'; }

  /** A whole number of days above zero, or null for as needed. */
  function everyDays(v) {
    var s = String(v == null ? '' : v).trim();
    if (!/^[0-9]+$/.test(s)) return null;
    var n = parseInt(s, 10);
    return n > 0 ? n : null;
  }
  function includesOf(row) {
    return String(row.includes || '').split('|').map(function (x) { return x.trim(); }).filter(Boolean);
  }

  /** For each type_key, the row in force today. A job whose latest row is switched off is left out. */
  function jobsInForce(types, today) {
    var best = {};
    (types || []).forEach(function (r) {
      if (!r.type_key || !r.effective_from || r.effective_from > today) return;
      if (!best[r.type_key] || r.effective_from > best[r.type_key].effective_from) best[r.type_key] = r;
    });
    return Object.keys(best).map(function (k) { return best[k]; }).filter(function (r) { return !isOff(r.active); });
  }

  /** Log rows that still stand: a corrected row gives way to the row that corrects it. */
  function standing(logs) {
    var replaced = {};
    (logs || []).forEach(function (r) { if (r.corrects_id) replaced[r.corrects_id] = true; });
    return (logs || []).filter(function (r) { return !replaced[r.id]; });
  }

  /* a room job about dogs: one room tap saves one line for each dog ticked */
  function perDogRoom(job) { return job.target === 'area' && job.site_scope === 'per_dog'; }
  function appliesTo(job, target) {
    var t = job.target;
    if (target.litter_id) return t === 'litter';
    if (target.subject_id) return t === 'dog' || t === 'either' || (!!target.everyDog && perDogRoom(job));
    if (target.area_id) return t === 'area' || t === 'either';
    return t === 'none';
  }
  function listOf(v) { return String(v || '').split('|').map(function (x) { return x.trim(); }).filter(Boolean); }
  /* a whole-site job (target none) that includes room jobs restarts them in every room, except the rooms it never covers (isolation) */
  function siteCoversRoom(version, target) {
    return !!target.area_id && !target.subject_id && version.target === 'none' && includesOf(version).length > 0 &&
      listOf(version.not_in_areas).indexOf(target.area_id) < 0;
  }
  function sameTarget(row, target, version) {
    if (perDogRoom(version)) return target.subject_id ? row.subject_id === target.subject_id : (row.area_id || '') === (target.area_id || '');
    if (version.target === 'litter') return (row.litter_id || '') === (target.litter_id || '');
    return (row.subject_id || '') === (target.subject_id || '') && (row.area_id || '') === (target.area_id || '');
  }

  /**
   * Every job for one dog ({subject_id}; add everyDog: true to count that dog on room jobs saved per dog), one room ({area_id}),
   * one litter ({litter_id}: jobs with target litter) or the whole site ({}).
   * Status: late, today, ok, never (has a frequency, no record yet) or as_needed.
   * reset_by is the type_key of the bigger job that last restarted this one, if it did.
   */
  function forTarget(types, logs, target, today) {
    var byId = {};
    (types || []).forEach(function (r) { byId[r.id] = r; });
    var done = {};              // type_key -> { date, by }
    function mark(key, date, by) { if (!done[key] || date > done[key].date) done[key] = { date: date, by: by }; else if (date === done[key].date && !by) done[key].by = ''; }
    standing(logs).forEach(function (log) {
      var version = byId[log.check_type_id];
      if (!version || log.outcome === 'not_done') return;
      var date = londonDate(log.happened_at || log.taken_at);
      if (!date || date > today) return;
      if (siteCoversRoom(version, target)) { includesOf(version).forEach(function (k) { mark(k, date, version.type_key); }); return; }
      if (!sameTarget(log, target, version)) return;
      mark(version.type_key, date, '');
      includesOf(version).forEach(function (k) { mark(k, date, version.type_key); });   // the row in force when the job was done
    });
    return jobsInForce(types, today).filter(function (j) { return appliesTo(j, target); }).map(function (j) {
      var every = everyDays(j.every_days), d = done[j.type_key], next = d && every ? addDays(d.date, every) : '';
      var status = !every ? 'as_needed' : !d ? 'never' : next < today ? 'late' : next === today ? 'today' : 'ok';
      return { type_key: j.type_key, label: j.label, group: j.group || '', every_days: every, last_done: d ? d.date : '',
        next_due: next, days_late: status === 'late' ? daysBetween(next, today) : 0, status: status, reset_by: d ? d.by : '' };
    });
  }

  return { forTarget: forTarget, perDogRoom: perDogRoom, jobsInForce: jobsInForce, everyDays: everyDays, londonDate: londonDate };
}));
