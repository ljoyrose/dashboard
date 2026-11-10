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

  /**
   * dogs = everyone who would be in the room: [{id, size, damId}]
   * Returns {status: 'ok'|'over'|'unknown', count, limit, access, alternatives, mix, message, notes}
   */
  function check(o) {
    var rows = (o.capacity || []).filter(function (r) { return r.area_id === o.areaId; });
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

  /** Every room at once, for the compliance audit. rooms = [{areaId, label, access, dogs, reasons}] */
  function audit(rooms, capacity) {
    var out = { over: [], unknown: [], ok: 0 };
    rooms.forEach(function (r) {
      var c = check({ areaId: r.areaId, access: r.access, capacity: capacity, dogs: r.dogs });
      c.areaId = r.areaId; c.label = r.label; c.reasons = r.reasons || [];
      if (c.status === 'over') out.over.push(c); else if (c.status === 'unknown') out.unknown.push(c); else out.ok++;
    });
    return out;
  }
  return { check: check, audit: audit, accessOf: accessOf, band: band, word: word };
}));
