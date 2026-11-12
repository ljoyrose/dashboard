/*!
 * BLDAreaTempLine - today's temperature line for one room (DOGCARD room card, 12 Nov 2026).
 * lineFor(areaId, readings, thermos, links, bands, today, opts) ->
 *   { lines: [{ label, am, pm, text, ok }], limit: { lo, hi, source } | null }
 * - One line per thermometer in the room; a label (the thermometer name) only when the room has 2 or more.
 *   A room with no thermometer rows: no lines (a field). With no thermometer rows at all (before they exist),
 *   the room itself is one line.
 * - A reading names its thermometer (thermometer_id); a blank one counts for a room's only thermometer.
 * - links (BLD-area_link): an old room's reading also counts for the room it became (BLDAreaLink.expand).
 * - Words match the round: "AM 12.0–15.0 ✓", "AM Outside 8.5–15.0", "AM empty", "AM due", "AM missed".
 *   state is 'in' | 'out' | 'nolimit' | 'empty' | 'due' | 'missed' for the caller's colour (never a fill).
 * - The limit comes from temperature_band rows only (min_temp/max_temp or min_c/max_c), never typed here, and only
 *   rows in force on the day count (from_date blank or <= day, to_date blank or >= day; Lisa 12 Nov 2026). Two in
 *   force: the later from_date wins.
 *   Rows with ages need opts.youngestDays (the youngest dog in the room today); without it, an age-banded
 *   limit is null with source 'by age'.
 * opts: { hour (0-23, London, default now), youngestDays, req (BLD-requirement rows, to keep only thermometers
 *   needed today via BLDThermometer.neededOn) }.
 * Pure functions; works in a browser (window.BLDAreaTempLine, after capacity.js, area-link.js and thermometer.js) and in Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    var opt = function (p) { try { return require(p); } catch (e) { return null; } };
    module.exports = factory(opt('./area-link.js'), opt('./thermometer.js'), require('./capacity.js'));
  } else root.BLDAreaTempLine = factory(root.BLDAreaLink, root.BLDThermometer, root.BLDCapacity);
}(typeof self !== 'undefined' ? self : this, function (L, T, C) {
  'use strict';
  function num(v) { if (v === '' || v == null) return null; var n = parseFloat(v); return isNaN(n) ? null : n; }
  function dp(n) { return n === null ? '–' : n.toFixed(1); }
  function day(v) { var s = String(v || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }
  function slotOf(r) { var at = String(r.period_start || r.taken_at || ''), hr = parseInt(at.slice(11, 13), 10); return isNaN(hr) || hr < 12 ? 'am' : 'pm'; }
  function londonHour() { return parseInt(new Date().toLocaleString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hour12: false }), 10); }

  /** The limit in force on day d (YYYY-MM-DD; blank = every row): the room's own rows first, else the general rows;
   *  by the youngest dog's age when rows have ages; the later from_date first. */
  function limitFor(areaId, bands, youngestDays, d) {
    var on = C.inForce(bands || [], day(d)).slice()   // the shared rule (capacity.js)
      .sort(function (a, b) { return day(b.from_date).localeCompare(day(a.from_date)); });
    var own = on.filter(function (b) { return b.area_id === areaId; });
    var rows = own.length ? own : on.filter(function (b) { return !b.area_id; });
    rows = rows.filter(function (b) { return num(b.min_temp != null ? b.min_temp : b.min_c) !== null; });
    if (!rows.length) return null;
    var aged = rows.some(function (b) { return num(b.age_from_days) !== null || num(b.age_to_days) !== null; });
    var pick = rows[0];
    if (aged) {
      if (youngestDays == null) return { lo: null, hi: null, source: 'by age' };
      pick = rows.filter(function (b) {
        var f = num(b.age_from_days), t = num(b.age_to_days);
        return (f === null || youngestDays >= f) && (t === null || youngestDays <= t);
      })[0];
      if (!pick) return null;
    }
    return { lo: num(pick.min_temp != null ? pick.min_temp : pick.min_c), hi: num(pick.max_temp != null ? pick.max_temp : pick.max_c), source: pick.id || pick.band || '' };
  }
  function slotState(r, half, lim, hour) {
    if (!r) return { state: half === 'am' && hour >= 12 ? 'missed' : 'due', text: half.toUpperCase() + (half === 'am' && hour >= 12 ? ' missed' : ' due') };
    var lo = num(r.min_c), hi = num(r.max_c), empty = String(r.room_empty || '').toLowerCase() === 'yes', H = half.toUpperCase();
    if (lo === null && hi === null) return { state: empty ? 'empty' : 'in', text: H + (empty ? ' empty' : ' done') };
    var range = dp(lo) + '–' + dp(hi);
    if (!lim || lim.lo === null) return { state: 'nolimit', lo: lo, hi: hi, text: H + ' ' + range };
    var out = (lo !== null && lo < lim.lo) || (hi !== null && hi > lim.hi);
    if (empty) return { state: 'empty', lo: lo, hi: hi, text: H + ' ' + range + ' empty' };
    return out ? { state: 'out', lo: lo, hi: hi, text: H + ' Outside ' + range } : { state: 'in', lo: lo, hi: hi, text: H + ' ' + range + ' ✓' };
  }

  function lineFor(areaId, readings, thermos, links, bands, today, opts) {
    opts = opts || {};
    var hour = opts.hour != null ? opts.hour : londonHour(), d = day(today);
    var lim = limitFor(areaId, bands, opts.youngestDays, d);
    var all = (thermos || []).filter(function (t) { return t && t.area_id; });
    var mine = all.filter(function (t) { return t.area_id === areaId; });
    if (all.length && opts.req && T) mine = mine.filter(function (t) { return T.neededOn(t, d, opts.req); });
    if (all.length && !mine.length) return { lines: [], limit: lim };
    var rows = L && links && links.length ? L.expand(readings || [], links) : (readings || []);
    rows = rows.filter(function (r) { return r.area_id === areaId && day(r.period_start || r.taken_at) === d && !r.corrects_id; });
    var roomCount = all.filter(function (t) { return t.area_id === areaId; }).length;
    var items = mine.length ? mine : [{ id: '', name: '' }];
    var lines = items.map(function (t) {
      var got = { am: null, pm: null };
      rows.forEach(function (r) {
        var forT = !t.id || r.thermometer_id === t.id || (!r.thermometer_id && roomCount === 1);
        if (!forT) return;
        var s = slotOf(r), was = got[s];
        // own reading beats a linked copy; else the later one
        if (!was || (was.linked_from && !r.linked_from) || (!!was.linked_from === !!r.linked_from && String(r.taken_at || '') >= String(was.taken_at || ''))) got[s] = r;
      });
      var am = slotState(got.am, 'am', lim, hour), pm = slotState(got.pm, 'pm', lim, hour);
      return { label: mine.length > 1 ? String(t.name || t.id) : '', am: am, pm: pm, text: am.text + ' · ' + pm.text,
        ok: am.state !== 'out' && pm.state !== 'out' && am.state !== 'missed' };
    });
    return { lines: lines, limit: lim };
  }
  return { lineFor: lineFor, limitFor: limitFor };
}));
