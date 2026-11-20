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
    return Object.keys(best).map(function (k) { return best[k]; }).filter(function (r) { return !isOff(r.active) && r.target !== 'item' && String(r.type_key).indexOf('round.') !== 0; });   // item tests (target item) are due per item on the Items page, never a job   // round.* = written by the Round itself, never a job (15 Nov 2026)
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
    return (target.dogs || []).filter(function (x) { return never.indexOf(x.area_id || '') < 0 && inGroups(job, x.groups); });
  }
  /* only_groups: group keys by |, the only dogs a dog job belongs to (e.g. breeding dogs); blank = every dog. An owner row, dated by
     effective_from like the rest of the job. groups = that dog's groups on the day (groupsOf); not given = the caller does not know, so the job shows */
  function inGroups(job, groups) {
    var only = listOf(job.only_groups);
    if (!only.length || !groups) return true;
    return only.some(function (k) { return groups.indexOf(k) >= 0; });
  }
  /** A dog's groups on `day`: BLD-links rows role member_of from the dog (subject/subjects) to a group, open on that day. */
  function groupsOf(links, subjectId, day) {
    return (links || []).filter(function (k) {
      return k.role === 'member_of' && (k.from_table === 'subject' || k.from_table === 'subjects') && k.from_id === subjectId && k.to_table === 'group'
        && (!k.from_date || k.from_date <= day) && (!k.to_date || k.to_date >= day);
    }).map(function (k) { return k.to_id; });
  }
  function appliesTo(job, target) {
    var t = job.target;
    if (target.litter_id) return t === 'litter';
    if (perDogSite(job) && target.dogs) return dogsFor(job, target).length > 0;
    if (target.subject_id) return (t === 'dog' || t === 'either' || (!!target.everyDog && perDogRoom(job) && inRooms(job, target.dogArea))) && inGroups(job, target.groups);
    /* a room job saved per dog needs a dog there: with roomDogIds given and none in the room, it is not due (Lisa 20 Nov 2026:
       isolation checks only when someone is in there) */
    if (target.area_id && perDogRoom(job) && Array.isArray(target.roomDogIds) && !target.roomDogIds.length) return false;
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
  /** The visit a record was saved under: taken_by 'visit:<link id>' (or its visit_id / grant_id column); '' for staff. */
  function visitOf(log) {
    var by = String(log.taken_by || '');
    return log.visit_id || log.grant_id || (by.indexOf('visit:') === 0 ? by.slice(6) : '');   // grant_id: the planned name for visit_id (schema Q-N2)
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
   * Room: add roomDogIds: [dog ids in the room] so a room job saved per dog is due only with a dog there, and counted per dog.
   * Add dogs: [{id, area_id}] (the dogs on site here) to show a whole-site job about dogs on a dog or room too, done once each of those dogs has a line.
   * one litter ({litter_id}: jobs with target litter) or the whole site ({}).
   * Status: late, today, ok, never (has a frequency, no record yet) or as_needed.
   * visits: BLD-inspect_link rows (optional). A visitor's record counts only if stamped counts_due true or, unstamped, if its visit lists the job in record_counts;
   * with no visits given, every visitor record is left out.
   * reset_by is the type_key of the bigger job that last restarted this one, if it did.
   */
  /**
   * Times a day a daily job must be done (owner rule row job.times_per_day.<type_key>, else job.times_per_day; the row in
   * force on that day, newest effective_from wins). No row = 1. Only a job due every day uses it (Isolation checks: 3).
   */
  function timesPerDay(rules, typeKey, day) {
    function pick(k) {
      var best = null;
      (rules || []).forEach(function (r) { if (r.rule_key === k && r.effective_from && r.effective_from <= day && (!r.to_date || r.to_date >= day) && (!best || r.effective_from > best.effective_from)) best = r; });
      return best ? parseInt(best.value, 10) : NaN;
    }
    var n = pick('job.times_per_day.' + typeKey);
    if (!(n > 0)) n = pick('job.times_per_day');
    return n > 0 ? n : 1;
  }
  /* opts.rules: the owner's rule rows (optional), for times_per_day */
  function forTarget(types, logs, target, today, visits, opts) {
    var byId = {}, vm = visitCounts(visits), rules = (opts && opts.rules) || [], todayCount = {}, dogToday = {};
    (types || []).forEach(function (r) { byId[r.id] = r; });
    var done = {};              // type_key -> { date, by }
    var dogDone = {};           // per-dog whole-site job: type_key -> { dog id -> last date }
    function mark(key, date, by) { if (!done[key] || date > done[key].date) done[key] = { date: date, by: by }; else if (date === done[key].date && !by) done[key].by = ''; }
    standing(logs).forEach(function (log) {
      var version = byId[log.check_type_id];
      if (!version || log.outcome === 'not_done' || log.outcome === 'note' || log.outcome === 'part_done') return;   // a note, or part done, is never a done
      if (!counts(log, version, vm)) return;
      var date = londonDate(log.happened_at || log.taken_at);
      if (!date || date > today) return;
      if (siteCoversRoom(version, target)) { includesOf(version).forEach(function (k) { mark(k, date, version.type_key); }); return; }
      if (perDogSite(version) && target.dogs) {
        var m = dogDone[version.type_key] = dogDone[version.type_key] || {};
        if (log.subject_id && (!m[log.subject_id] || date > m[log.subject_id])) m[log.subject_id] = date;
        return;
      }
      if (!sameTarget(log, target, version)) return;
      if (date === today) {
        todayCount[version.type_key] = (todayCount[version.type_key] || 0) + 1;
        if (perDogRoom(version) && !target.subject_id && log.subject_id) {   // a room tap writes a line per dog: count times per dog
          var c = dogToday[version.type_key] = dogToday[version.type_key] || {};
          c[log.subject_id] = (c[log.subject_id] || 0) + 1;
        }
      }
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
      var times = every === 1 ? timesPerDay(rules, j.type_key, today) : 1, doneToday = todayCount[j.type_key] || 0;
      if (perDogRoom(j) && target.area_id && !target.subject_id && dogToday[j.type_key]) {
        /* a room job saved per dog: done as many times as its least-checked dog here (the dogs in the room if given) */
        var per = dogToday[j.type_key], ids = Array.isArray(target.roomDogIds) ? target.roomDogIds : Object.keys(per);
        doneToday = ids.length ? Math.min.apply(null, ids.map(function (id) { return per[id] || 0; })) : 0;
      }
      if (times > 1 && d && d.date === today && doneToday < times) status = 'today';   // done, but not yet as many times as today needs
      return { type_key: j.type_key, label: j.label, group: j.group || '', every_days: every, last_done: d ? d.date : '',
        next_due: status === 'today' && times > 1 ? today : next, days_late: status === 'late' ? daysBetween(next, today) : 0, status: status, reset_by: d ? d.by : '',
        times_per_day: times, done_today: doneToday };
    });
  }

  return { forTarget: forTarget, timesPerDay: timesPerDay, groupsOf: groupsOf, visitOf: visitOf, perDogRoom: perDogRoom, perDogSite: perDogSite, dogsFor: dogsFor, jobsInForce: jobsInForce, everyDays: everyDays, londonDate: londonDate };
}));
