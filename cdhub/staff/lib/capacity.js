/*!
 * BLDCapacity - would this room be over its licence limit? Pure functions, no network.
 * Every limit comes from the owner's own rows (BLD-area_capacity: area_id, access_type, size_band, max_dogs). Nothing is hard-coded.
 * max_dogs is a headcount for one size band, so a mixed room is held to the smallest limit among the bands in it.
 * A puppy with its dam in the same room is not counted; the dam then uses the "+ pups" band.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDCapacity = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
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

  /** dogs = everyone who would be in the room: [{id, size, damId}] */
  function check(o) {
    var rows = (o.capacity || []).filter(function (r) { return r.area_id === o.areaId; });
    var ids = {}; o.dogs.forEach(function (d) { ids[d.id] = true; });
    var dams = {}; o.dogs.forEach(function (d) { if (d.damId && ids[d.damId]) dams[d.damId] = true; });
    var counted = o.dogs.filter(function (d) { return !(d.damId && ids[d.damId]); });
    var res = { status: 'unknown', count: counted.length, limit: null, access: o.access || '', notes: [] };
    if (!rows.length) { res.notes.push('No licence limits are recorded for this room.'); return res; }
    var modes = o.access ? [o.access] : ['free', 'limited'];
    if (!o.access) res.notes.push('The flap is not set for this room, so the stricter limit is used.');
    var bands = {}, noSize = 0;
    counted.forEach(function (d) {
      var w = word(d.size);
      if (!w) { noSize++; return; }
      bands[w + (dams[d.id] ? '+pups' : '')] = true;
    });
    if (noSize) res.notes.push(noSize + ' dog(s) here have no size recorded.');
    var limit = null;
    Object.keys(bands).forEach(function (b) {
      rows.forEach(function (r) {
        if (modes.indexOf(String(r.access_type).toLowerCase()) < 0 || band(r.size_band) !== b) return;
        var n = parseInt(r.max_dogs, 10);
        if (!isNaN(n) && (limit === null || n < limit)) limit = n;
      });
    });
    if (limit === null) { res.notes.push('No limit matches the dogs here.'); return res; }
    res.limit = limit;
    res.status = counted.length > limit ? 'over' : (noSize ? 'unknown' : 'ok');
    return res;
  }
  return { check: check, accessOf: accessOf, band: band, word: word };
}));
