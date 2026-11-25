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
  var londonFmt = null, londonTz = '';

  function londonDate(value) {
    var d = new Date(value);
    if (isNaN(d.getTime())) return '';
    var tz = (typeof self !== 'undefined' && self.BLD_TZ) || 'Europe/London';
    if (!londonFmt || londonTz !== tz) {
      londonTz = tz;
      londonFmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    }
    return londonFmt.format(d);
  }
  function addDays(date, n) { return new Date(Date.parse(date + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10); }
  function daysBetween(from, to) { return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / DAY); }
  function isOff(v) { return String(v).toLowerCase() === 'false'; }
  function flagOn(v) { var s = String(v == null ? '' : v).trim().toLowerCase(); return s === 'true' || s === 'on' || s === 'yes' || s === '1'; }
  function ymd(v) { var s = String(v || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }
  var GONE_STATE = { sold: 1, collected: 1, deceased: 1 };
  var OCCUPIED_KEY = { daily_clean: 1, isolation_clean: 1, iso_clean: 1 };
  var ROOM_ONLY_KEY = { deep_clean: 1, room_disinfected: 1, full_clean: 1, room_emptied: 1 };
  var OWN_TABLE = { weight: 'weight', weighing: 'weight', weights: 'weight', medicine: 'dispense', medicines: 'dispense', meds: 'dispense', dispense: 'dispense', vaccination: 'vaccination', vaccinations: 'vaccination', vaccine: 'vaccination', microchip: 'microchip', microchips: 'microchip' };

  function ruleRow(rules, key, day) {
    var best = null;
    (rules || []).forEach(function (r) {
      if (r.rule_key !== key || !r.effective_from || r.effective_from > day || (r.to_date && r.to_date < day)) return;
      if (!best || r.effective_from > best.effective_from) best = r;
    });
    return best;
  }
  function ruleOn(rules, key, day) { var row = ruleRow(rules, key, day); return !!(row && flagOn(row.value)); }
  /** All-subject checks can leave juveniles out. No row and no setting = include them. */
  function excludeJuvenile(rules, typeKey, day, settings) {
    var best = null;
    (settings || []).forEach(function (r) {
      if (r.type_key !== typeKey || !r.from_date || r.from_date > day || (r.to_date && r.to_date < day)) return;
      if (!best || String(r.from_date) >= String(best.from_date)) best = r;
    });
    if (best && flagOn(best.exclude_juvenile)) return true;
    return ruleOn(rules, 'job.exclude_juvenile.' + typeKey, day) || ruleOn(rules, 'job.exclude_juvenile', day);
  }
  function adultMonths(rules, day) {
    var row = ruleRow(rules, 'dog.adult_from_months', day);
    var n = row ? parseInt(row.value, 10) : 6;
    return n > 0 ? n : 6;
  }
  function ageMonths(dob, day) {
    dob = ymd(dob); day = ymd(day);
    if (!dob || !day) return null;
    var m = (Number(day.slice(0, 4)) - Number(dob.slice(0, 4))) * 12 + (Number(day.slice(5, 7)) - Number(dob.slice(5, 7)));
    if (Number(day.slice(8, 10)) < Number(dob.slice(8, 10))) m--;
    return m < 0 ? null : m;
  }
  function isJuvenile(subject, day, rules) {
    if (!subject) return false;
    var kind = String(subject.kind || '').trim().toLowerCase();
    if (kind.indexOf('pup') === 0) return true;
    if (kind === 'adult') return false;
    var age = ageMonths(subject.dob, day);
    if (age == null) return false;
    return age < adultMonths(rules, day);
  }
  function recordOn(rows, subjectId, day) {
    var best = null, bestKey = '', bestIdx = -1;
    for (var i = 0; i < (rows || []).length; i++) {
      var r = rows[i];
      if (r.subject_id !== subjectId) continue;
      var mi = ymd(r.moved_in);
      if (mi && day && mi > day) continue;
      var key = mi || '';
      if (best === null || key > bestKey || (key === bestKey && i >= bestIdx)) { best = r; bestKey = key; bestIdx = i; }
    }
    return best;
  }
  function placedOn(rows, subjectId, day) {
    var best = recordOn(rows, subjectId, day);
    if (!best) return null;
    var mo = ymd(best.moved_out);
    if (mo && day && mo < day) return null;
    if (!best.area_id) return null;
    var kind = String(best.off_site_kind || '').toLowerCase();
    if (kind === 'sold' || kind === 'owned_by_family' || kind === 'deceased' || kind === 'temporary') return null;
    var cls = String(best.classification || '').toLowerCase();
    if (cls === 'collected' || cls === 'deceased') return null;
    return best;
  }
  function statusOn(rows, subjectId, day) {
    var best = null, bestFrom = '', bestIdx = -1;
    for (var i = 0; i < (rows || []).length; i++) {
      var s = rows[i];
      if (s.subject_id !== subjectId) continue;
      var from = ymd(s.from_date), to = ymd(s.to_date);
      if (from && day && from > day) continue;
      if (to && day && to < day) continue;
      if (best === null || from > bestFrom || (from === bestFrom && i >= bestIdx)) { best = s; bestFrom = from; bestIdx = i; }
    }
    return best;
  }
  /** On site that day: a placement in force, and a status that is not sold, collected or deceased. No occupancy list = the caller already chose. */
  function onSite(subject, occupancy, statuses, day) {
    if (!subject || !subject.id) return false;
    if (!occupancy) return true;
    day = ymd(day);
    var st = statusOn(statuses || [], subject.id, day);
    if (st && GONE_STATE[String(st.state || '').toLowerCase()]) return false;
    return !!placedOn(occupancy, subject.id, day);
  }
  function jobToken(job) { return (String(job.type_key || '') + ' ' + String(job.label || '')).toLowerCase().replace(/[_-]+/g, ' '); }
  function occupiedOnly(job) {
    if (perDogRoom(job)) return true;
    if (OCCUPIED_KEY[String(job.type_key || '')]) return true;
    var t = jobToken(job);
    return t.indexOf('daily clean') >= 0 || t.indexOf('isolation clean') >= 0 || t.indexOf('iso clean') >= 0;
  }
  function roomOnlyJob(job) {
    if (ROOM_ONLY_KEY[String(job.type_key || '')]) return true;
    var t = jobToken(job);
    return t.indexOf('deep clean') >= 0 || t.indexOf('room disinfected') >= 0 || t.indexOf('full clean') >= 0 || t.indexOf('room emptied') >= 0;
  }
  function nonRoomKind(v) {
    var k = String(v || '').toLowerCase().replace(/[\s_-]+/g, '');
    return k === 'field' || k === 'fields' || k === 'corridor' || k === 'corridors';
  }
  function ownKey(job) {
    var k = String(job.type_key || '').trim().toLowerCase();
    if (OWN_TABLE[k]) return OWN_TABLE[k];
    var lab = String(job.label || '').trim().toLowerCase();
    return OWN_TABLE[lab] || '';
  }
  function ownDate(table, row) {
    if (!row || ymd(row.voided_on)) return '';
    if (table === 'weight') return ymd(row.performed_on || row.on || row.taken_at);
    if (table === 'dispense' || table === 'vaccination') return ymd(row.given_on || row.performed_on);
    if (table === 'microchip') return ymd(row.fitted_on || row.implanted_on || row.chipped_on || row.registered_on || row.performed_on || row.given_on || row.from_date);
    return '';
  }

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
  /** Subjects a whole-site job covers on one day: on site then, born, and juveniles only when the check still includes them. */
  function subjectsFor(job, subjects, day, opts) {
    opts = opts || {};
    day = ymd(day);
    var list = subjects || [];
    if (opts.occupancy) list = list.filter(function (d) { return onSite(d, opts.occupancy, opts.statuses, day); });
    list = list.filter(function (d) { return !d.dob || ymd(d.dob) <= day; });
    list = dogsFor(job, { dogs: list });
    if (perDogSite(job) && excludeJuvenile(opts.rules, job.type_key, day, opts.settings)) list = list.filter(function (d) { return !isJuvenile(d, day, opts.rules); });
    return list;
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
    /* a room job saved per dog, and daily clean / isolation clean, need someone there that day when roomDogIds is given */
    if (target.area_id && occupiedOnly(job) && Array.isArray(target.roomDogIds) && !target.roomDogIds.length) return false;
    if (target.area_id && roomOnlyJob(job) && (target.areaRetired || target.areaNoDogs || nonRoomKind(target.areaKind) || nonRoomKind(target.areaUse) || nonRoomKind(target.areaGroup))) return false;
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
  /** Birth day as YYYY-MM-DD, or '' when none was given. */
  function oneBirth(x) {
    if (x == null) return '';
    if (typeof x !== 'object') {
      var s = String(x);
      if (!s) return '';
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
      return londonDate(s) || '';
    }
    return oneBirth(x.dob || x.born || x.born_on || x.birth_date || '');
  }
  /** Birth days in scope, or null when the caller did not name anyone. '' is a missing birth date. */
  function listedBirths(scope) {
    if (scope == null) return null;
    if (Array.isArray(scope)) return scope.length ? scope.map(oneBirth) : null;
    if (Array.isArray(scope.births)) return scope.births.length ? scope.births.map(oneBirth) : null;
    var list = [];
    (scope.subjects || []).forEach(function (s) { list.push(oneBirth(s)); });
    (scope.dogs || []).forEach(function (s) { list.push(oneBirth(s)); });
    (scope.litters || []).forEach(function (s) { list.push(oneBirth(s)); });
    if (!list.length && (scope.dob || scope.born || scope.born_on)) list.push(oneBirth(scope));
    return list.length ? list : null;
  }
  /** Birth days for one due target. A litter uses its birth date. One dog uses that dog. Several dogs: each of them. */
  function scopeBirths(target) {
    if (!target) return null;
    if (target.litter_id) return [oneBirth(target.born || target.dob || '')];
    if (target.subject_id) {
      var own = oneBirth(target.dob || target.born || '');
      if (!own && target.dogs) {
        for (var i = 0; i < target.dogs.length; i++) if (target.dogs[i] && target.dogs[i].id === target.subject_id) { own = oneBirth(target.dogs[i]); break; }
      }
      return [own];
    }
    if (target.dogs && target.dogs.length) {
      var list = target.dogs.map(oneBirth);
      (target.litters || []).forEach(function (l) { list.push(oneBirth(l)); });
      return list;
    }
    if (target.roomDogs && target.roomDogs.length) return target.roomDogs.map(oneBirth);
    if (target.litters && target.litters.length) return target.litters.map(oneBirth);
    return null;
  }
  /** "from-to:n|from-:n" -> [{from, to, n}]. Blank end age is open. Bad parts are skipped. */
  function mealBands(value) {
    var out = [];
    String(value || '').split('|').forEach(function (part) {
      if (!String(part || '').trim()) return;
      var m = /^\s*(\d+)\s*-\s*(\d*)\s*:\s*(\d+)\s*$/.exec(part);
      if (!m) return;
      var from = parseInt(m[1], 10), to = m[2] === '' ? null : parseInt(m[2], 10), n = parseInt(m[3], 10);
      if (!(n > 0) || (to != null && to < from)) return;
      out.push({ from: from, to: to, n: n });
    });
    return out;
  }
  function mealBandText(rows) {
    var parts = [];
    (rows || []).forEach(function (r) {
      var from = String(r.from == null ? '' : r.from).trim();
      var to = String(r.to == null ? '' : r.to).trim();
      var n = String(r.n == null ? '' : r.n).trim();
      if (!from && !to && !n) return;
      parts.push(String(parseInt(from, 10)) + '-' + (to === '' ? '' : String(parseInt(to, 10))) + ':' + String(parseInt(n, 10)));
    });
    return parts.join('|');
  }
  /** '' when every row is empty or complete. A half-filled row is an error. An empty list writes nothing. */
  function checkMealRows(rows) {
    var bad = '';
    (rows || []).forEach(function (r) {
      if (bad) return;
      var from = String(r.from == null ? '' : r.from).trim();
      var to = String(r.to == null ? '' : r.to).trim();
      var n = String(r.n == null ? '' : r.n).trim();
      if (!from && !to && !n) return;
      if (!/^\d+$/.test(from) || !/^\d+$/.test(n) || (to !== '' && !/^\d+$/.test(to))) bad = 'Each age band needs whole days and meals a day.';
      else if (to !== '' && parseInt(to, 10) < parseInt(from, 10)) bad = 'The end age cannot be before the start age.';
      else if (!(parseInt(n, 10) > 0)) bad = 'Meals a day must be at least 1.';
    });
    return bad;
  }
  /**
   * Rule rows to add for a daily check. Empty times and an empty band table add nothing.
   * Feeding bands are one job.times_per_day.feeding.by_age row. Incomplete bands are an error and add nothing.
   */
  function timesRules(typeKey, timesRaw, bandRows) {
    var times = String(timesRaw == null ? '' : timesRaw).trim();
    var rules = [], error = '';
    if (times) {
      if (!/^\d+$/.test(times) || !(parseInt(times, 10) > 0)) error = 'Times a day must be a whole number.';
      else rules.push({ rule_key: 'job.times_per_day.' + typeKey, value: String(parseInt(times, 10)) });
    }
    if (typeKey === 'feeding') {
      var bandError = checkMealRows(bandRows || []);
      if (bandError) error = error || bandError;
      else {
        var text = mealBandText(bandRows || []);
        if (text) rules.push({ rule_key: 'job.times_per_day.feeding.by_age', value: text });
      }
    }
    return { error: error, rules: error ? [] : rules };
  }
  function ruleValue(rules, key, day) {
    var row = ruleRow(rules, key, day);
    return row ? String(row.value == null ? '' : row.value) : '';
  }
  function feedingLive(types, day) {
    if (!types) return true;
    var best = null;
    types.forEach(function (r) {
      if (!r || String(r.type_key || '') !== 'feeding') return;
      if (!r.effective_from || r.effective_from > day) return;
      if (!best || r.effective_from > best.effective_from) best = r;
    });
    return !!(best && !isOff(best.active));
  }
  /**
   * Times a day a daily job must be done. The row in force on that day wins (newest effective_from; a later row never
   * edits an older one). job.times_per_day.<type_key>.by_age is "from-to:n|from-:n" (whole days from birth, inclusive).
   * Each dog or litter in scope uses the band for its age; the highest count wins. Feeding is the only banded check.
   * No matching band, no bands, or no birth date: job.times_per_day.<type_key>, else job.times_per_day, else 1.
   * food_bowls uses Feeding's count when that check is in force; otherwise its own row or 1.
   * scope may be omitted.
   */
  function timesPerDay(rules, typeKey, day, scope) {
    day = ymd(day) || String(day || '').slice(0, 10);
    if (typeKey === 'food_bowls' && feedingLive(scope && scope.types, day)) return timesPerDay(rules, 'feeding', day, scope);
    function flat(key) {
      var row = ruleRow(rules, 'job.times_per_day.' + key, day);
      var n = row ? parseInt(row.value, 10) : NaN;
      if (!(n > 0)) { row = ruleRow(rules, 'job.times_per_day', day); n = row ? parseInt(row.value, 10) : NaN; }
      return n > 0 ? n : 1;
    }
    var fb = flat(typeKey);
    var bands = typeKey === 'feeding' ? mealBands(ruleValue(rules, 'job.times_per_day.feeding.by_age', day)) : [];
    var births = listedBirths(scope);
    if (!bands.length || !births) return fb;
    var max = 0;
    births.forEach(function (born) {
      var c = fb;
      if (born) {
        var age = daysBetween(born, day);
        if (age >= 0) {
          var hit = 0;
          bands.forEach(function (b) { if (age >= b.from && (b.to == null || age <= b.to) && b.n > hit) hit = b.n; });
          if (hit > 0) c = hit;
        }
      }
      if (c > max) max = c;
    });
    return max > 0 ? max : fb;
  }
  /**
   * Due by age (Lisa 22 Nov 2026, puppy weights): owner rule row job.by_age.<type_key>, the row in force on `day` (newest
   * effective_from wins). Its value lists ages in days from birth, split by |: "a-b:n" = every n days from age a to age b,
   * "a" = once at age a. E.g. "0-6:1|7-27:7|42|70" = daily in week 1, weekly in weeks 2 to 4, at 6 and 10 weeks.
   * Returns the due dates for a litter born on `born`, oldest first; [] with no row or no birth date.
   */
  function ageDates(rules, typeKey, day, born) {
    born = /^\d{4}-\d{2}-\d{2}/.test(born || '') ? String(born).slice(0, 10) : londonDate(born);
    if (!born) return [];
    var best = null, k = 'job.by_age.' + typeKey;
    (rules || []).forEach(function (r) { if (String(r.rule_key || '').trim() === k && r.effective_from && r.effective_from <= day && (!r.to_date || r.to_date >= day) && (!best || r.effective_from > best.effective_from)) best = r; });
    if (!best) return [];
    var ages = {};
    String(best.value || '').split('|').forEach(function (part) {
      var m = /^\s*(\d+)\s*(?:-\s*(\d+)\s*:\s*(\d+))?\s*$/.exec(part);
      if (!m) return;
      var a = +m[1], b = m[2] == null ? a : +m[2], n = m[3] == null ? 1 : +m[3];
      if (!(n > 0) || b < a) return;
      for (var x = a; x <= b; x += n) ages[x] = true;
    });
    return Object.keys(ages).map(Number).sort(function (x, y) { return x - y; }).map(function (x) { return addDays(born, x); });
  }
  /* opts.rules: the owner's rule rows (optional), for times_per_day and by-age jobs. A litter target may carry born (its birth date).
     opts.records: weight, dispense, vaccination, microchip rows, used for those jobs' last date. */
  function forTarget(types, logs, target, today, visits, opts) {
    var byId = {}, vm = visitCounts(visits), rules = (opts && opts.rules) || [], settings = (opts && opts.settings) || [], records = (opts && opts.records) || {}, todayCount = {}, dogToday = {};
    (types || []).forEach(function (r) { byId[r.id] = r; });
    var done = {};              // type_key -> { date, by }
    var dogDone = {};           // per-dog whole-site job: type_key -> { dog id -> last date }
    function mark(key, date, by) { if (!done[key] || date > done[key].date) done[key] = { date: date, by: by }; else if (date === done[key].date && !by) done[key].by = ''; }
    function coveredOf(log) { return String(log.covered_ids || '').split('|').map(function (x) { return x.trim(); }).filter(Boolean); }
    function exceptionIds(log) { var m = {}; String(log.exceptions || '').split('|').forEach(function (p) { var id = String(p.split(':')[0] || '').trim(); if (id) m[id] = 1; }); return m; }
    var sessionUse = {}, sessionAt = {};
    standing(logs).forEach(function (log) {
      if (!String(log.covered_ids || '').trim() && !String(log.exceptions || '').trim()) return;
      var date = londonDate(log.happened_at || log.taken_at);
      if (!date) return;
      var slot = log.check_type_id + '|' + date + '|' + (log.area_id || ''), at = String(log.taken_at || log.happened_at || '');
      if (!sessionAt[slot] || at >= sessionAt[slot]) { sessionAt[slot] = at; sessionUse[slot] = log.id; }
    });
    function settingNow(typeKey) {
      var best = null;
      settings.forEach(function (r) {
        if (r.type_key !== typeKey || !r.from_date || r.from_date > today || (r.to_date && r.to_date < today)) return;
        if (!best || r.from_date >= best.from_date) best = r;
      });
      return best;
    }
    /* How one tap is stored today. No setting, or a blank choice, keeps the check's own site_scope. */
    function scoped(job) {
      var s = settingNow(job.type_key), scope = s && String(s.site_scope || '').trim();
      return scope ? Object.assign({}, job, { site_scope: scope }) : job;
    }
    standing(logs).forEach(function (log) {
      var version = byId[log.check_type_id];
      if (!version || log.outcome === 'not_done' || log.outcome === 'note' || log.outcome === 'part_done') return;   // a note, or part done, is never a done
      version = scoped(version);
      if (!counts(log, version, vm)) return;
      var date = londonDate(log.happened_at || log.taken_at);
      if (!date || date > today) return;
      var cov = coveredOf(log), exm = exceptionIds(log), slot = log.check_type_id + '|' + date + '|' + (log.area_id || '');
      if ((cov.length || String(log.exceptions || '').trim()) && sessionUse[slot] === log.id) {
        if (perDogSite(version) && target.dogs) {
          var sm = dogDone[version.type_key] = dogDone[version.type_key] || {};
          cov.forEach(function (id) { if (!exm[id] && (!sm[id] || date > sm[id])) sm[id] = date; });
        }
        if (target.subject_id && cov.indexOf(target.subject_id) >= 0 && !exm[target.subject_id]) {
          mark(version.type_key, date, '');
          includesOf(version).forEach(function (k) { mark(k, date, version.type_key); });
        }
        return;   // the dogs are on the list; a blank subject_id is not its own done
      }
      if ((cov.length || String(log.exceptions || '').trim()) && !log.subject_id) return;   // an older session row for that day
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
    function liveDogs(j) {
      var dogs = dogsFor(j, target);
      if (perDogSite(j) && excludeJuvenile(rules, j.type_key, today, settings)) dogs = dogs.filter(function (x) { return !isJuvenile(x, today, rules); });
      return dogs;
    }
    /* done once every subject it covers here has a line: the date is the oldest one's last line */
    function allDogs(j) {
      var m = dogDone[j.type_key] || {}, dogs = liveDogs(j), date = '';
      for (var i = 0; i < dogs.length; i++) { var x = m[dogs[i].id]; if (!x) return undefined; if (!date || x < date) date = x; }
      return date ? { date: date, by: '' } : undefined;
    }
    function foldOwn(j) {
      var table = ownKey(j), rows = records[table] || [];
      if (!table || !rows.length) return;
      if (perDogSite(j) && target.dogs) {
        var m = dogDone[j.type_key] = dogDone[j.type_key] || {};
        liveDogs(j).forEach(function (one) {
          var n = 0;
          rows.forEach(function (r) {
            if (r.subject_id !== one.id) return;
            var date = ownDate(table, r);
            if (!date || date > today) return;
            if (!m[one.id] || date > m[one.id]) m[one.id] = date;
            if (date === today) n++;
          });
          if (n) {
            var c = dogToday[j.type_key] = dogToday[j.type_key] || {};
            c[one.id] = Math.max(c[one.id] || 0, n);
          }
        });
        return;
      }
      var best = '', nToday = 0, sid = target.subject_id || '';
      rows.forEach(function (r) {
        if (sid && r.subject_id && r.subject_id !== sid) return;
        var date = ownDate(table, r);
        if (!date || date > today) return;
        if (date > best) best = date;
        if (date === today) nToday++;
      });
      if (best) mark(j.type_key, best, '');
      if (nToday) todayCount[j.type_key] = Math.max(todayCount[j.type_key] || 0, nToday);
    }
    function everyNow(j) {
      var best = settingNow(j.type_key);
      if (best && String(best.every_days || '').trim() !== '') return everyDays(best.every_days);
      return everyDays(j.every_days);
    }
    return jobsInForce(types, today).filter(function (j) {
      var s = scoped(j);
      if (!appliesTo(s, target)) return false;
      if (target.area_id && ruleOn(rules, 'job.when_occupied.' + s.type_key, today) && !occupiedOnly(s) && Array.isArray(target.roomDogIds) && !target.roomDogIds.length) return false;
      if (perDogSite(s) && target.dogs && excludeJuvenile(rules, s.type_key, today, settings) && !liveDogs(s).length) return false;
      return true;
    }).map(function (j) {
      j = scoped(j);
      foldOwn(j);
      var every = everyNow(j), d = perDogSite(j) && target.dogs ? allDogs(j) : done[j.type_key], next = d && every ? addDays(d.date, every) : '';
      var status = !every ? 'as_needed' : !d ? 'never' : next < today ? 'late' : next === today ? 'today' : 'ok';
      var times = every === 1 ? timesPerDay(rules, j.type_key, today, { births: scopeBirths(target), types: types }) : 1, doneToday = todayCount[j.type_key] || 0;
      if (perDogRoom(j) && target.area_id && !target.subject_id && dogToday[j.type_key]) {
        /* a room job saved per dog: done as many times as its least-checked dog here (the dogs in the room if given) */
        var per = dogToday[j.type_key], ids = Array.isArray(target.roomDogIds) ? target.roomDogIds : Object.keys(per);
        doneToday = ids.length ? Math.min.apply(null, ids.map(function (id) { return per[id] || 0; })) : 0;
      }
      if (times > 1 && d && d.date === today && doneToday < times) status = 'today';   // done, but not yet as many times as today needs
      var ages = target.litter_id && target.born ? ageDates(rules, j.type_key, today, target.born) : [];
      if (ages.length) {
        /* due by the litter's age: the latest age date up to today needs a record on or after it */
        var past = ages.filter(function (x) { return x <= today; }), last = past[past.length - 1], coming = ages.filter(function (x) { return x > today; })[0] || '';
        every = null;
        status = !last ? 'ok' : d && d.date >= last ? 'ok' : last === today ? 'today' : 'late';
        next = status === 'ok' ? coming : last;
        return { type_key: j.type_key, label: j.label, group: j.group || '', every_days: null, last_done: d ? d.date : '', next_due: next,
          days_late: status === 'late' ? daysBetween(last, today) : 0, status: status, reset_by: d ? d.by : '', times_per_day: 1, done_today: doneToday, by_age: true };
      }
      return { type_key: j.type_key, label: j.label, group: j.group || '', every_days: every, last_done: d ? d.date : '',
        next_due: status === 'today' && times > 1 ? today : next, days_late: status === 'late' ? daysBetween(next, today) : 0, status: status, reset_by: d ? d.by : '',
        times_per_day: times, done_today: doneToday };
    });
  }

  return { forTarget: forTarget, timesPerDay: timesPerDay, ageDates: ageDates, groupsOf: groupsOf, visitOf: visitOf, perDogRoom: perDogRoom, perDogSite: perDogSite, dogsFor: dogsFor, subjectsFor: subjectsFor, onSite: onSite, excludeJuvenile: excludeJuvenile, isJuvenile: isJuvenile, ownKey: ownKey, ownDate: ownDate, jobsInForce: jobsInForce, everyDays: everyDays, londonDate: londonDate, mealBands: mealBands, mealBandText: mealBandText, checkMealRows: checkMealRows, timesRules: timesRules, ruleValue: ruleValue };
}));
