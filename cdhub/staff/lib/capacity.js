/*!
 * BLDCapacity - is a room within its licence limit? Pure functions, no network. The staff page and the CD Hub
 * compliance audit both use this file, so they always give the same answer.
 *
 * Every limit comes from the owner's own rows (BLD-area_capacity: area_id, access_type, size_band, max_dogs).
 * A room's rows are ALTERNATIVES, not an allowance per size (Lisa, 8 Nov 2026): "3 small or 2 medium" means one or
 * the other, so 1 medium and 2 small is over. Every dog must fit the alternative for its size, so the room is held to
 * the alternative of its largest dog. Being under is fine (Lisa, 8 Nov 2026): 1 medium and 1 small fits "2 medium".
 * A puppy with its dam in the same room is not counted; the dam then uses the "+ pups" alternative.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDCapacity = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var SIZES = ['small', 'medium', 'large'];
  function word(s) {
    s = String(s || '').toLowerCase();
    if (/small|<\s*10/.test(s)) return 'small';
    if (/medium|10\s*-\s*25/.test(s)) return 'medium';
    if (/large|25\s*kg\s*\+/.test(s)) return 'large';
    return '';
  }
  function band(s) { var w = word(s); return w ? w + (/pups/i.test(String(s)) ? '+pups' : '') : ''; }

  /**
   * The rows in force on a date (the dated-limits rule, Lisa 12 Nov 2026; same wording as SOPS's breedRule and the save script):
   * a row is in force when from <= date <= to_date. Dates compare on their first 10 characters (YYYY-MM-DD), so a datetime
   * such as taken_at works; to_date is inclusive; a blank or unreadable from or to counts as open. No date: every row, as before.
   * fromKey is the row's start column ('from_date' for area_capacity, 'effective_from' for breeding_rule). Never throws.
   */
  function ymd(v) { var s = String(v == null ? '' : v).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }
  function inForce(rows, iso, fromKey) {
    var d = ymd(iso); rows = rows || [];
    if (!d) return rows.slice();
    fromKey = fromKey || 'from_date';
    return rows.filter(function (r) { var f = ymd(r && r[fromKey]), t = ymd(r && r.to_date); return (!f || f <= d) && (!t || d <= t); });
  }
  /**
   * Size from weight (Lisa's dog card mock-up, 7 Nov 2026). The cut-offs are the owner's rows in BLD-breeding_rule,
   * never fixed here: size_from_kg.medium = the weight (kg) at which a dog counts as medium, size_from_kg.large = the
   * weight at which it counts as large. A row needs a value and a source; the newest row in force on `today` wins.
   * Returns null unless both are set and medium < large, so a half-set pair never sorts a dog.
   */
  function sizeCutoffs(rules, today) {
    var got = {};
    (rules || []).forEach(function (r) {
      var m = /^size_from_kg\.(medium|large)$/.exec(String(r.rule_key || '').trim()); if (!m) return;
      var kg = parseFloat(r.value), from = String(r.effective_from || '');
      if (isNaN(kg) || kg <= 0 || !String(r.source || '').trim()) return;
      if (today && !inForce([r], today, 'effective_from').length) return;   // not yet started, or ended (to_date)
      var cur = got[m[1]]; if (!cur || from >= cur.from) got[m[1]] = { kg: kg, from: from, source: String(r.source).trim() };
    });
    if (!got.medium || !got.large || !(got.medium.kg < got.large.kg)) return null;
    return { medium: got.medium.kg, large: got.large.kg, source: got.medium.source === got.large.source ? got.medium.source : got.medium.source + '; ' + got.large.source };
  }
  /** 'small' | 'medium' | 'large' for a weight, or '' when there is no weight or no cut-offs. */
  function sizeFromKg(kg, cut) {
    kg = parseFloat(kg); if (!cut || isNaN(kg) || kg <= 0) return '';
    return kg >= cut.large ? 'large' : (kg >= cut.medium ? 'medium' : 'small');
  }

  /** The flap setting in force: the last row for that room with a value (rows are only ever added). */
  function accessOf(rows, areaId) {
    var a = '';
    (rows || []).forEach(function (r) { if (r.area_id === areaId && r.access_type) a = String(r.access_type).toLowerCase(); });
    return a === 'free' || a === 'limited' ? a : '';
  }
  /** The limit for one alternative. With two flap settings possible, the stricter. null = no row. */
  function limitFor(rows, modes, b) {
    var limit = null;
    rows.forEach(function (r) {
      if (modes.indexOf(String(r.access_type).toLowerCase()) < 0 || band(r.size_band) !== b) return;
      var n = parseInt(r.max_dogs, 10);
      if (!isNaN(n) && (limit === null || n < limit)) limit = n;
    });
    return limit;
  }
  function alternatives(rows, modes) {
    var out = [];
    SIZES.forEach(function (s) { var n = limitFor(rows, modes, s); if (n > 0) out.push(n + ' ' + s); });
    return out.join(' or ');
  }

  /** On a date, several rows can cover the same room, flap setting and size: the latest from_date wins (a new row replaces
   *  the old one even if the old one was not closed). Rows with the same from_date all stay, and the stricter figure counts. */
  function latestPerBand(rows) {
    var top = {};
    rows.forEach(function (r) { var k = String(r.access_type).toLowerCase() + '|' + band(r.size_band), f = ymd(r.from_date); if (!(k in top) || f > top[k]) top[k] = f; });
    return rows.filter(function (r) { return ymd(r.from_date) === top[String(r.access_type).toLowerCase() + '|' + band(r.size_band)]; });
  }
  /**
   * dogs = everyone who would be in the room: [{id, size, damId}]
   * Returns {status: 'ok'|'over'|'unknown', count, limit, access, alternatives, mix, message, notes}
   */
  function check(o) {
    var rows = (o.capacity || []).filter(function (r) { return r.area_id === o.areaId; });
    if (o.date) rows = latestPerBand(inForce(rows, o.date, 'from_date'));
    var ids = {}; o.dogs.forEach(function (d) { ids[d.id] = true; });
    var dams = {}; o.dogs.forEach(function (d) { if (d.damId && ids[d.damId]) dams[d.damId] = true; });
    var counted = o.dogs.filter(function (d) { return !(d.damId && ids[d.damId]); });
    var modes = o.access ? [o.access] : ['free', 'limited'];
    var res = { status: 'unknown', count: counted.length, limit: null, access: o.access || '', alternatives: alternatives(rows, modes), mix: '', message: '', notes: [] };
    if (!rows.length) {
      if (!counted.length) res.status = 'ok';
      else res.notes.push('No licence limits are recorded for this room.');
      res.message = res.notes.join(' ');
      return res;
    }
    if (!o.access) res.notes.push('The flap is not set for this room, so the stricter limit is used.');
    var tally = {}, noSize = 0;
    counted.forEach(function (d) {
      var w = word(d.size);
      if (!w) { noSize++; return; }
      var b = w + (dams[d.id] ? '+pups' : '');
      tally[b] = (tally[b] || 0) + 1;
    });
    res.mix = Object.keys(tally).sort().map(function (b) { return tally[b] + ' ' + b.replace('+pups', ' bitch with litter'); }).join(' and ');
    if (noSize) res.notes.push(noSize + ' dog(s) here have no size recorded.');
    var limit = null, missing = [];
    Object.keys(tally).forEach(function (b) {
      var n = limitFor(rows, modes, b);
      if (n === null) missing.push(b.replace('+pups', ' with litter'));
      else if (limit === null || n < limit) limit = n;
    });
    if (missing.length) res.notes.push('No limit is recorded for ' + missing.join(', ') + ' here.');
    res.limit = limit;
    if (!counted.length) res.status = 'ok';
    else if (limit !== null && counted.length > limit) res.status = 'over';
    else res.status = noSize || missing.length || limit === null ? 'unknown' : 'ok';
    if (res.status === 'over') res.message = (res.mix || counted.length + ' dogs') + ' is over the limit. This room takes ' + (res.alternatives || 'no dogs of this size') + (res.alternatives.indexOf(' or ') > 0 ? ', one or the other. Every dog counts as the largest size here.' : '.');
    else res.message = res.notes.join(' ');
    return res;
  }

  /** Every room at once, for the compliance audit. rooms = [{areaId, label, access, dogs, reasons, date}]; date (optional) judges each room by the rows in force that day. */
  function audit(rooms, capacity) {
    var out = { over: [], unknown: [], ok: 0 };
    rooms.forEach(function (r) {
      var c = check({ areaId: r.areaId, access: r.access, capacity: capacity, dogs: r.dogs, date: r.date });
      c.areaId = r.areaId; c.label = r.label; c.reasons = r.reasons || [];
      if (c.status === 'over') out.over.push(c); else if (c.status === 'unknown') out.unknown.push(c); else out.ok++;
    });
    return out;
  }
  /**
   * How many places of the incoming dog's size are free in this room (including this dog). 0 = no space or over.
   * The mix is judged as check() does: every dog counts as the largest size present after this dog would join.
   */
  function freePlaces(o) {
    var add = o && o.add, cur = (o && o.dogs) || [];
    if (!add) return { ok: false, free: 0, size: '', limit: null, count: cur.length };
    var size = word(add.size) || '';
    var sim = check({ areaId: o.areaId, access: o.access, capacity: o.capacity, dogs: cur.concat([add]), date: o.date });
    var free = (sim.status === 'ok' && sim.limit !== null) ? (sim.limit - (sim.count - 1)) : 0;
    if (free < 0) free = 0;
    return { ok: free >= 1 && sim.status === 'ok', free: free, size: size, limit: sim.limit, count: sim.count - 1 };
  }
  return { check: check, audit: audit, accessOf: accessOf, band: band, word: word, sizeCutoffs: sizeCutoffs, sizeFromKg: sizeFromKg, inForce: inForce, freePlaces: freePlaces };

}));
