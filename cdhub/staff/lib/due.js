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

  function everyDays(v) {
    var s = String(v == null ? '' : v).trim();
    if (!/^[0-9]+$/.test(s)) return null;
    var n = parseInt(s, 10);
    return n > 0 ? n : null;
  }
  function includesOf(row) {
    return String(row.includes || '').split('|').map(function (x) { return x.trim(); }).filter(Boolean);
  }

  function canonKey(typeKey) { return String(typeKey || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ''); }
  function baseId(id) { var m = /^(cty-.+)-\d+$/.exec(String(id || '').trim()); return m ? m[1] : ''; }
  function normLabel(s) { return String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function copyRank(id) { var m = /-(\d+)$/.exec(String(id || '')); if (!m) return 0; var n = parseInt(m[1], 10); return n <= 1 ? 0 : n; }

  function families(types) {
    var rows = (types || []).filter(function (r) { return r && (r.id || r.type_key); });
    var parent = [];
    function find(i) { if (parent[i] == null) parent[i] = i; if (parent[i] !== i) parent[i] = find(parent[i]); return parent[i]; }
    function unite(a, b) { a = find(a); b = find(b); if (a !== b) parent[Math.max(a, b)] = Math.min(a, b); }
    var byKey = {}, byBase = {}, byLabel = {};
    rows.forEach(function (r, i) {
      var k = canonKey(r.type_key), b = baseId(r.id), lab = normLabel(r.label);
      if (k) { if (byKey[k] != null) unite(byKey[k], i); byKey[k] = find(i); }
      if (b) { if (byBase[b] != null) unite(byBase[b], i); byBase[b] = find(i); }
      if (lab.length > 2) { var lk = lab + '\n' + String(r.target || ''); if (byLabel[lk] != null) unite(byLabel[lk], i); byLabel[lk] = find(i); }
    });
    var groups = {};
    rows.forEach(function (r, i) { var g = find(i); (groups[g] = groups[g] || []).push(r); });
    return Object.keys(groups).map(function (k) { return groups[k]; });
  }

  function mainOf(group, today) {
    var day = String(today || '9999-12-31').slice(0, 10);
    var live = (group || []).filter(function (r) { return !isOff(r.active) && (!r.effective_from || String(r.effective_from).slice(0, 10) <= day); });
    if (!live.length) return null;
    var byKey = {};
    live.forEach(function (r) {
      var k = canonKey(r.type_key) || r.id, cur = byKey[k];
      if (!cur || String(r.effective_from || '') > String(cur.effective_from || '')) byKey[k] = r;
    });
    var reps = Object.keys(byKey).map(function (k) { return byKey[k]; });
    reps.sort(function (a, b) { var d = copyRank(a.id) - copyRank(b.id); return d || String(a.effective_from || '').localeCompare(String(b.effective_from || '')); });
    return reps[0];
  }

  function familyKeyOf(types, today) {
    var map = {};
    families(types).forEach(function (g) {
      var main = mainOf(g, today) || g[0], key = main && main.type_key;
      g.forEach(function (r) { if (r.id && key) map[r.id] = key; });
    });
    return map;
  }

  function familyIds(types, keyOrId) {
    var want = String(keyOrId || ''), hit = null;
    families(types).forEach(function (g) {
      if (g.some(function (r) { return r.id === want || r.type_key === want || canonKey(r.type_key) === canonKey(want); })) hit = g;
    });
    return hit ? hit.map(function (r) { return r.id; }) : (want ? [want] : []);
  }

  function roundFamily(g) {
    return g.some(function (r) { return String(r.type_key || '').indexOf('round.') === 0 || canonKey(r.type_key) === 'roundpresence'; });
  }

  function jobsInForce(types, today) {
    var best = {};
    (types || []).forEach(function (r) {
      if (!r.type_key || !r.effective_from || r.effective_from > today) return;
      if (!best[r.type_key] || r.effective_from > best[r.type_key].effective_from) best[r.type_key] = r;
    });
    var list = Object.keys(best).map(function (k) { return best[k]; }).filter(function (r) { return !isOff(r.active) && r.target !== 'item'; });
    var out = [];
    families(list).forEach(function (g) {
      if (roundFamily(g)) return;
      var main = mainOf(g, today);
      if (main && best[main.type_key]) out.push(best[main.type_key]);
    });
    return out;
  }

  function standing(logs) {
    var replaced = {};
    (logs || []).forEach(function (r) { if (r.corrects_id) replaced[r.corrects_id] = true; });
    return (logs || []).filter(function (r) { return !replaced[r.id]; });
  }

  function perDogRoom(job) { return job.target === 'area' && job.site_scope === 'per_dog'; }
  function inRooms(job, areaId) { var only = listOf(job.only_in_areas); return !only.length || only.indexOf(areaId || '') >= 0; }
  function perDogSite(job) { return job.target === 'none' && job.site_scope === 'per_dog'; }
  function dogsFor(job, target) {
    var never = listOf(job.not_in_areas);
    return (target.dogs || []).filter(function (x) { return never.indexOf(x.area_id || '') < 0 && inGroups(job, x.groups); });
  }
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
  function inGroups(job, groups) {
    var only = listOf(job.only_groups);
    if (!only.length || !groups) return true;
    return only.some(function (k) { return groups.indexOf(k) >= 0; });
  }
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
    /* a room job saved per dog needs a dog there: with roomDogIds given and none in the room, it is not due (the owner 20 Nov 2026:
       isolation checks only when someone is in there) */
    if (target.area_id && perDogRoom(job) && Array.isArray(target.roomDogIds) && !target.roomDogIds.length) return false;
    /* a room job saved per dog, and daily clean / isolation clean, need someone there that day when roomDogIds is given */
    if (target.area_id && occupiedOnly(job) && Array.isArray(target.roomDogIds) && !target.roomDogIds.length) return false;
    if (target.area_id && roomOnlyJob(job) && (target.areaRetired || target.areaNoDogs || nonRoomKind(target.areaKind) || nonRoomKind(target.areaUse) || nonRoomKind(target.areaGroup))) return false;
    if (target.area_id) return (t === 'area' || t === 'either') && inRooms(job, target.area_id);
    return t === 'none';
  }
  function listOf(v) { return String(v || '').split('|').map(function (x) { return x.trim(); }).filter(Boolean); }
  function siteCoversRoom(version, target) {
    return !!target.area_id && !target.subject_id && version.target === 'none' && includesOf(version).length > 0 &&
      listOf(version.not_in_areas).indexOf(target.area_id) < 0;
  }
  function sameTarget(row, target, version) {
    if (perDogRoom(version)) return target.subject_id ? row.subject_id === target.subject_id : (row.area_id || '') === (target.area_id || '');
    if (version.target === 'litter') return (row.litter_id || '') === (target.litter_id || '');
    return (row.subject_id || '') === (target.subject_id || '') && (row.area_id || '') === (target.area_id || '');
  }

  function visitCounts(visits) {
    var m = {};
    (visits || []).forEach(function (v) { if (v && v.id) m[v.id] = listOf(v.record_counts); });
    return m;
  }
  function visitOf(log) {
    var by = String(log.taken_by || '');
    return log.visit_id || log.grant_id || (by.indexOf('visit:') === 0 ? by.slice(6) : '');
  }
  function counts(log, version, vm) {
    var visit = visitOf(log);
    if (!visit) return true;
    var stamp = String(log.counts_due || '').toLowerCase();
    if (stamp === 'true' || stamp === 'false') return stamp === 'true';
    var keys = vm[visit];
    return !!keys && keys.indexOf(version.type_key) >= 0;
  }
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
   * Due by age (the owner 22 Nov 2026, puppy weights): owner rule row job.by_age.<type_key>, the row in force on `day` (newest
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
  function forTarget(types, logs, target, today, visits, opts) {
    var byId = {}, vm = visitCounts(visits), rules = (opts && opts.rules) || [], settings = (opts && opts.settings) || [], records = (opts && opts.records) || {}, todayCount = {}, dogToday = {};
    (types || []).forEach(function (r) { byId[r.id] = r; });
    var alias = familyKeyOf(types, today);
    function asKey(id) { return alias[id] || (byId[id] && byId[id].type_key) || ''; }
    function aliasType(typeKey) {
      var found = typeKey;
      (types || []).some(function (t) { if (t.type_key === typeKey && alias[t.id]) { found = alias[t.id]; return true; } });
      return found;
    }
    var done = {};              // type_key -> { date, by }
    var dogDone = {};
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
    function scoped(job) {
      var s = settingNow(job.type_key), scope = s && String(s.site_scope || '').trim();
      return scope ? Object.assign({}, job, { site_scope: scope }) : job;
    }
    standing(logs).forEach(function (log) {
      var version = byId[log.check_type_id];
      if (!version || log.outcome === 'not_done' || log.outcome === 'note' || log.outcome === 'part_done') return;
      version = scoped(version);
      if (!counts(log, version, vm)) return;
      var date = londonDate(log.happened_at || log.taken_at);
      if (!date || date > today) return;
      var cov = coveredOf(log), exm = exceptionIds(log), slot = log.check_type_id + '|' + date + '|' + (log.area_id || ''), key = asKey(log.check_type_id);
      if ((cov.length || String(log.exceptions || '').trim()) && sessionUse[slot] === log.id) {
        if (perDogSite(version) && target.dogs) {
          var sm = dogDone[key] = dogDone[key] || {};
          cov.forEach(function (id) { if (!exm[id] && (!sm[id] || date > sm[id])) sm[id] = date; });
        }
        if (target.subject_id && cov.indexOf(target.subject_id) >= 0 && !exm[target.subject_id]) {
          mark(key, date, '');
          includesOf(version).forEach(function (k) { mark(aliasType(k), date, key); });
        }
        return;
      }
      if ((cov.length || String(log.exceptions || '').trim()) && !log.subject_id) return;
      if (siteCoversRoom(version, target)) { includesOf(version).forEach(function (k) { mark(aliasType(k), date, key); }); return; }
      if (perDogSite(version) && target.dogs) {
        var m = dogDone[key] = dogDone[key] || {};
        if (log.subject_id && (!m[log.subject_id] || date > m[log.subject_id])) m[log.subject_id] = date;
        return;
      }
      if (!sameTarget(log, target, version)) return;
      if (date === today) {
        todayCount[key] = (todayCount[key] || 0) + 1;
        if (perDogRoom(version) && !target.subject_id && log.subject_id) {
          var c = dogToday[key] = dogToday[key] || {};
          c[log.subject_id] = (c[log.subject_id] || 0) + 1;
        }
      }
      mark(key, date, '');
      includesOf(version).forEach(function (k) { mark(aliasType(k), date, key); });
    });
    function liveDogs(j) {
      var dogs = dogsFor(j, target);
      if (perDogSite(j) && excludeJuvenile(rules, j.type_key, today, settings)) dogs = dogs.filter(function (x) { return !isJuvenile(x, today, rules); });
      return dogs;
    }
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
        var per = dogToday[j.type_key], ids = Array.isArray(target.roomDogIds) ? target.roomDogIds : Object.keys(per);
        doneToday = ids.length ? Math.min.apply(null, ids.map(function (id) { return per[id] || 0; })) : 0;
      }
      if (times > 1 && d && d.date === today && doneToday < times) status = 'today';
      var ages = target.litter_id && target.born ? ageDates(rules, j.type_key, today, target.born) : [];
      if (ages.length) {
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

  return { forTarget: forTarget, timesPerDay: timesPerDay, ageDates: ageDates, groupsOf: groupsOf, visitOf: visitOf, perDogRoom: perDogRoom, perDogSite: perDogSite, dogsFor: dogsFor, subjectsFor: subjectsFor, onSite: onSite, excludeJuvenile: excludeJuvenile, isJuvenile: isJuvenile, ownKey: ownKey, ownDate: ownDate, jobsInForce: jobsInForce, everyDays: everyDays, londonDate: londonDate, mealBands: mealBands, mealBandText: mealBandText, checkMealRows: checkMealRows, timesRules: timesRules, ruleValue: ruleValue, families: families, mainOf: mainOf, familyKeyOf: familyKeyOf, familyIds: familyIds, canonKey: canonKey };
}));

