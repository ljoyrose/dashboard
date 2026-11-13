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
  /* only_in_areas: room ids by |, the only rooms a room job belongs to (isolation jobs); blank = every room */
  function inRooms(job, areaId) { var only = listOf(job.only_in_areas); return !only.length || only.indexOf(areaId || '') >= 0; }
  /* a whole-site job about dogs (health check): each dog as they go, or all at once; one line per dog either way */
  function perDogSite(job) { return job.target === 'none' && job.site_scope === 'per_dog'; }
  /* the dogs such a job covers here: target.dogs ([{id, area_id}]) less those in rooms it never covers (isolation) */
  function dogsFor(job, target) {
    var never = listOf(job.not_in_areas);
    return (target.dogs || []).filter(function (x) { return never.indexOf(x.area_id || '') < 0; });
  }
  function appliesTo(job, target) {
    var t = job.target;
    if (target.litter_id) return t === 'litter';
    if (perDogSite(job) && target.dogs) return dogsFor(job, target).length > 0;
    if (target.subject_id) return t === 'dog' || t === 'either' || (!!target.everyDog && perDogRoom(job) && inRooms(job, target.dogArea));
    if (target.area_id) return (t === 'area' || t === 'either') && inRooms(job, target.area_id);
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

  /* a visitor's record (taken_by visit:<link id>) is kept separate: it counts only when its counts_due stamp says true or, with no stamp,
     when that visit's BLD-inspect_link row lists the job in record_counts */
  function visitCounts(visits) {
    var m = {};
    (visits || []).forEach(function (v) { if (v && v.id) m[v.id] = listOf(v.record_counts); });
    return m;
  }
  /** The visit a record was saved under: taken_by 'visit:<link id>' (or a visit_id column, if one is ever added); '' for staff. */
  function visitOf(log) {
    var by = String(log.taken_by || '');
    return log.visit_id || (by.indexOf('visit:') === 0 ? by.slice(6) : '');
  }
  function counts(log, version, vm) {
    var visit = visitOf(log);
    if (!visit) return true;
    var stamp = String(log.counts_due || '').toLowerCase();   // stamped on the row when it was saved: what the visit granted then
    if (stamp === 'true' || stamp === 'false') return stamp === 'true';
    var keys = vm[visit];
    return !!keys && keys.indexOf(version.type_key) >= 0;
  }
  /**
   * Every job for one dog ({subject_id}; add everyDog: true, and dogArea: the dog's room, to count that dog on room jobs saved per dog), one room ({area_id}),
   * Add dogs: [{id, area_id}] (the dogs on site here) to show a whole-site job about dogs on a dog or room too, done once each of those dogs has a line.
   * one litter ({litter_id}: jobs with target litter) or the whole site ({}).
   * Status: late, today, ok, never (has a frequency, no record yet) or as_needed.
   * visits: BLD-inspect_link rows (optional). A visitor's record counts only if stamped counts_due true or, unstamped, if its visit lists the job in record_counts;
   * with no visits given, every visitor record is left out.
   * reset_by is the type_key of the bigger job that last restarted this one, if it did.
   */
  function forTarget(types, logs, target, today, visits) {
    var byId = {}, vm = visitCounts(visits);
    (types || []).forEach(function (r) { byId[r.id] = r; });
    var done = {};              // type_key -> { date, by }
    var dogDone = {};           // per-dog whole-site job: type_key -> { dog id -> last date }
    function mark(key, date, by) { if (!done[key] || date > done[key].date) done[key] = { date: date, by: by }; else if (date === done[key].date && !by) done[key].by = ''; }
    standing(logs).forEach(function (log) {
      var version = byId[log.check_type_id];
      if (!version || log.outcome === 'not_done' || !counts(log, version, vm)) return;
      var date = londonDate(log.happened_at || log.taken_at);
      if (!date || date > today) return;
      if (siteCoversRoom(version, target)) { includesOf(version).forEach(function (k) { mark(k, date, version.type_key); }); return; }
      if (perDogSite(version) && target.dogs) {
        var m = dogDone[version.type_key] = dogDone[version.type_key] || {};
        if (log.subject_id && (!m[log.subject_id] || date > m[log.subject_id])) m[log.subject_id] = date;
        return;
      }
      if (!sameTarget(log, target, version)) return;
      mark(version.type_key, date, '');
      includesOf(version).forEach(function (k) { mark(k, date, version.type_key); });   // the row in force when the job was done
    });
    /* done once every dog it covers here has a line: the date is the oldest dog's last line */
    function allDogs(j) {
      var m = dogDone[j.type_key] || {}, dogs = dogsFor(j, target), date = '';
      for (var i = 0; i < dogs.length; i++) { var x = m[dogs[i].id]; if (!x) return undefined; if (!date || x < date) date = x; }
      return date ? { date: date, by: '' } : undefined;
    }
    return jobsInForce(types, today).filter(function (j) { return appliesTo(j, target); }).map(function (j) {
      var every = everyDays(j.every_days), d = perDogSite(j) && target.dogs ? allDogs(j) : done[j.type_key], next = d && every ? addDays(d.date, every) : '';
      var status = !every ? 'as_needed' : !d ? 'never' : next < today ? 'late' : next === today ? 'today' : 'ok';
      return { type_key: j.type_key, label: j.label, group: j.group || '', every_days: every, last_done: d ? d.date : '',
        next_due: next, days_late: status === 'late' ? daysBetween(next, today) : 0, status: status, reset_by: d ? d.by : '' };
    });
  }

  return { forTarget: forTarget, visitOf: visitOf, perDogRoom: perDogRoom, perDogSite: perDogSite, dogsFor: dogsFor, jobsInForce: jobsInForce, everyDays: everyDays, londonDate: londonDate };
}));
