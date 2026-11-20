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
   * weight a dog must be OVER to count as large (SOP Care Rounds: "small under 10 kg, medium 10-25 kg, large over 25 kg",
   * so exactly 25 kg is medium; OV12 17 Nov 2026). A row needs a value and a source; the newest row in force on `today` wins.
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
  /** 'small' | 'medium' | 'large' for a weight, or '' when there is no weight or no cut-offs. Each cut-off starts its size
   * (live row size_from_kg.large, Lisa 12 Nov 2026, council licence: "25.0 counts as large"). */
  function sizeFromKg(kg, cut) {
    kg = parseFloat(kg); if (!cut || isNaN(kg) || kg <= 0) return '';
    return kg >= cut.large ? 'large' : (kg >= cut.medium ? 'medium' : 'small');
  }

  /**
   * Midpoint of a kg range typed in a size cell, e.g. "Mini 8-12kg" gives 10 and "Lge Mini/Sml Med 12-16kg" gives 14
   * (Lisa 15 Nov 2026: with no weighing, use the breed size range midpoint). NaN when the text has no "a-b kg" range.
   */
  function rangeMidKg(text) {
    var m = /(\d+(?:[.,]\d+)?)\s*(?:-|\u2013|to)\s*(\d+(?:[.,]\d+)?)\s*kg/i.exec(String(text == null ? '' : text));
    if (!m) return NaN;
    var a = parseFloat(m[1].replace(',', '.')), b = parseFloat(m[2].replace(',', '.'));
    return a > 0 && b >= a ? (a + b) / 2 : NaN;
  }
  /**
   * The size of one dog: the latest weighing against the cut-off rows, else the midpoint of the kg range in its size
   * cell. { size: 'small'|'medium'|'large'|'', from: 'weight'|'range'|'', kg }. No cut-off rows: no size (never a fixed default).
   */
  function sizeOf(latestKg, sizeText, cut) {
    var b = sizeFromKg(latestKg, cut);
    if (b) return { size: b, from: 'weight', kg: parseFloat(latestKg) };
    var mid = rangeMidKg(sizeText); b = sizeFromKg(mid, cut);
    return b ? { size: b, from: 'range', kg: mid } : { size: '', from: '', kg: null };
  }
  /**
   * The owner's size_override.<dog id> rule row in force on `today` (newest effective_from wins; a later row on the
   * same day wins a tie). 'small' | 'medium' | 'large', or '' (no row, or the row says 'weight').
   */
  function sizeOverride(rules, id, today) {
    var k = 'size_override.' + id, hit = null, from = '';
    (rules || []).forEach(function (r) {
      if (String(r.rule_key || '') !== k) return;
      if (today && !inForce([r], today, 'effective_from').length) return;
      var f = String(r.effective_from || '');
      if (hit == null || f >= from) { hit = String(r.value || '').trim().toLowerCase(); from = f; }
    });
    return /^(small|medium|large)$/.test(hit || '') ? hit : '';
  }
  /**
   * One dog's size: the ONE rule for the CD Hub dog page and the print cards (Lisa 15 Nov 2026), so they never differ.
   * 1. an owner size_override row; 2. the latest weight against the size_from_kg rows in force on `today`;
   * 3. no weighing: the middle of the kg range typed in the size cell (#653). Never a fixed default.
   * o = { id, kg: latest weight, sizeText: the typed size cell, rules: breeding_rule rows, today: YYYY-MM-DD, cut: optional }.
   * Returns { size: 'small'|'medium'|'large'|'', from: 'override'|'weight'|'range'|'', kg }.
   */
  function sizeForDog(o) {
    o = o || {};
    var ov = o.id ? sizeOverride(o.rules, o.id, o.today) : '', kg = parseFloat(o.kg);
    if (ov) return { size: ov, from: 'override', kg: isNaN(kg) ? null : kg };
    return sizeOf(o.kg, o.sizeText, o.cut !== undefined ? o.cut : sizeCutoffs(o.rules, o.today));
  }

  /**
   * The owner's words for the sizes: size_label.small|medium|large rule rows (OV12 17 Nov 2026), newest row in force on
   * `today` wins; a word over 30 characters is ignored. Without a row, Small, Medium, Large. Hub and print share this.
   */
  function sizeLabels(rules, today) {
    var out = { small: 'Small', medium: 'Medium', large: 'Large' }, from = {}, day = String(today || '').slice(0, 10);
    (rules || []).forEach(function (r) {
      var m = /^size_label\.(small|medium|large)$/.exec(String(r.rule_key || '').trim()); if (!m) return;
      var v = String(r.value || '').trim(), f = String(r.effective_from || '').slice(0, 10), t = String(r.to_date || '').slice(0, 10);
      if (!v || v.length > 30 || (day && f && f > day) || (day && t && t < day)) return;
      if (from[m[1]] !== undefined && f < from[m[1]]) return;
      from[m[1]] = f; out[m[1]] = v;
    });
    return out;
  }

  /**
   * Whether one access row counts. A row whose to_date is before its from_date was voided (it never applied; OV12 18 Nov
   * 2026, 3A.1/2) and never counts. With a date, the row must also be in force that day (inForce: started, not ended).
   */
  function accessRowCounts(r, date) {
    var f = ymd(r && r.from_date), t = ymd(r && r.to_date);
    if (f && t && t < f) return false;
    return !ymd(date) || inForce([r], date, 'from_date').length === 1;
  }
  /** The flap setting in force: the last counting row for that room with a value (rows are only ever added). */
  function accessOf(rows, areaId, date) {
    var a = '';
    (rows || []).forEach(function (r) { if (r.area_id === areaId && r.access_type && accessRowCounts(r, date)) a = String(r.access_type).toLowerCase(); });
    return a === 'free' || a === 'limited' ? a : '';
  }
  /**
   * The flap setting in force on a date (LD-SC audit, OV11 15 Nov 2026). area_access rows are dated: from_date (older
   * rows may carry effective_from) and to_date, the shared rule above. Of the rows in force that day the latest start
   * wins; on the same start, the later row. An undated row counts as the oldest. A voided row (to_date before from_date)
   * never counts. No date: every other row.
   */
  function accessOn(rows, areaId, iso) {
    var a = '', best = null, d = ymd(iso);
    (rows || []).forEach(function (r) {
      if (!r || r.area_id !== areaId || !r.access_type) return;
      var f = ymd(r.from_date || r.effective_from), t = ymd(r.to_date);
      if (f && t && t < f) return; // voided: to_date before from_date never counts (OV12 18 Nov 2026)
      if (d && ((f && f > d) || (t && d > t))) return;
      if (best === null || f >= best) { best = f; a = String(r.access_type).toLowerCase(); }
    });
    return a === 'free' || a === 'limited' ? a : '';
  }
  /**
   * The room's alternatives for one flap setting on a date, for a sign or a card: [{band:'small', n:3}, ...], small first.
   * Same rows as check(): in force that day, the latest from_date per size; "+ pups" rows left out.
   */
  function limitsOn(capacity, areaId, access, iso) {
    var rows = (capacity || []).filter(function (r) { return r.area_id === areaId; });
    if (iso) rows = latestPerBand(inForce(rows, iso, 'from_date'));
    var out = [];
    SIZES.forEach(function (s) { var n = limitFor(rows, [String(access || '').toLowerCase()], s); if (n > 0) out.push({ band: s, n: n }); });
    return out;
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
   * SPACE RULES (Lisa 17 Nov 2026: "should be calculated automatically"; "it should be in compliance rules already").
   * The poster's table is already dated rows in BLD-breeding_rule (set 11 Nov 2026): rule_key
   * space.<free|limited>.adult.<small|medium|large>.<number of dogs> = m² needed, and
   * space.<free|limited>.mum_with_pups.<size>.1 = m² needed for a mum with her litter. Nothing about the figures is coded here.
   * spaceRules(ruleRows, date) -> {free:{small:{1:2.5,...}, 'small+pups':5}, limited:{...}} (the row in force that day).
   */
  var SPACE_KEY = /^space\.(free|limited)\.(adult|mum_with_pups)\.(small|medium|large)\.(\d+)$/;
  function spaceRules(ruleRows, date) {
    var best = {}, out = {};
    inForce((ruleRows || []).filter(function (r) { return SPACE_KEY.test(String(r.rule_key || '').trim()); }), date, 'effective_from')
      .forEach(function (r) {
        var k = String(r.rule_key).trim(), f = ymd(r.effective_from), v = parseFloat(r.value);
        if (isNaN(v)) return;
        if (!(k in best) || f >= best[k].f) best[k] = { f: f, v: v };
      });
    Object.keys(best).forEach(function (k) {
      var m = SPACE_KEY.exec(k), mode = m[1], who = m[2], size = m[3], n = m[4];
      out[mode] = out[mode] || {};
      if (who === 'mum_with_pups') { if (n === '1') out[mode][size + '+pups'] = best[k].v; }
      else { out[mode][size] = out[mode][size] || {}; out[mode][size][n] = best[k].v; }
    });
    return out;
  }
  /**
   * The limits a room of m2 square metres gets from the space rules, as capacity rows (marked derived):
   * for each size, the most dogs whose m² needed fits the room; a mum with pups fits (1) or not (0).
   */
  function deriveRows(areaId, m2, space) {
    var rows = [], a = parseFloat(m2);
    if (isNaN(a) || a <= 0 || !space) return rows;
    Object.keys(space).forEach(function (mode) {
      SIZES.forEach(function (sz) {
        var t = space[mode][sz], most = 0;
        if (t && typeof t === 'object') Object.keys(t).forEach(function (n) { if (t[n] <= a + 1e-9 && +n > most) most = +n; });
        if (t) rows.push({ area_id: areaId, access_type: mode, size_band: sz, max_dogs: String(most), derived: true });
        var pups = space[mode][sz + '+pups'];
        if (pups != null) rows.push({ area_id: areaId, access_type: mode, size_band: sz + ' + pups', max_dogs: pups <= a + 1e-9 ? '1' : '0', derived: true });
      });
    });
    return rows;
  }
  /**
   * dogs = everyone who would be in the room: [{id, size, damId}]
   * Optional m2 (the room's size) and space (spaceRules()): a flap setting with no capacity rows of its own is worked out
   * from the room's m² and the space rules, and the message says so.
   * Returns {status: 'ok'|'over'|'unknown', count, limit, access, alternatives, mix, message, notes}
   */
  function check(o) {
    var rows = (o.capacity || []).filter(function (r) { return r.area_id === o.areaId; });
    if (o.date) rows = latestPerBand(inForce(rows, o.date, 'from_date'));
    var derivedFor = [];
    if (o.space && o.m2) {
      var have = {}; rows.forEach(function (r) { have[String(r.access_type).toLowerCase()] = 1; });
      deriveRows(o.areaId, o.m2, o.space).forEach(function (r) { if (!have[r.access_type]) { rows.push(r); if (derivedFor.indexOf(r.access_type) < 0) derivedFor.push(r.access_type); } });
    }
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
    if (o.access && derivedFor.indexOf(String(o.access).toLowerCase()) >= 0) res.notes.push('Limits for ' + o.access + ' access worked out from the room size (' + o.m2 + ' m²) and the space rules.');
    // Lisa 17 Nov 2026 (3A.1/2): the flap was set to one way but the limits are only recorded for the other. Say so.
    else if (!rows.some(function (r) { return String(r.access_type).toLowerCase() === String(o.access).toLowerCase(); })) {
      var have = rows.map(function (r) { return String(r.access_type).toLowerCase(); }).filter(function (v, i, a) { return v && a.indexOf(v) === i; });
      res.notes.push('The flap is set to ' + o.access + ' access, but this room only has limits for ' + have.join(' and ') + ' access.');
    }
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
      var c = check({ areaId: r.areaId, access: r.access, capacity: capacity, dogs: r.dogs, date: r.date, m2: r.m2, space: r.space });
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
    var sim = check({ areaId: o.areaId, access: o.access, capacity: o.capacity, dogs: cur.concat([add]), date: o.date, m2: o.m2, space: o.space });
    var free = (sim.status === 'ok' && sim.limit !== null) ? (sim.limit - (sim.count - 1)) : 0;
    if (free < 0) free = 0;
    return { ok: free >= 1 && sim.status === 'ok', free: free, size: size, limit: sim.limit, count: sim.count - 1 };
  }
  /**
   * fact(id) -> {id, size, damId} for check(), the same on every screen (Move dogs, the room's jobs). Size from the latest
   * weight with the owner's cut-off rows when weights can be read (Lisa, 12 Nov 2026), else the size on the dog's record.
   * o: {subjects, litters, weights, weightsRead, rules, today}
   */
  function facts(o) {
    var subj = {}, damOf = {}, lastKg = {}, cut = sizeCutoffs(o.rules || [], o.today), byWeight = !!(o.weightsRead && cut);
    (o.subjects || []).forEach(function (x) { subj[x.id] = x; });
    (o.litters || []).forEach(function (l) { damOf[l.id] = l.dam_subject_id; });
    (o.weights || []).forEach(function (w) { var p = lastKg[w.subject_id]; if (!p || String(w.performed_on) >= p.on) lastKg[w.subject_id] = { on: String(w.performed_on), kg: w.weight_kg }; });
    return function (id) { var x = subj[id] || {}; return { id: id, size: byWeight ? sizeFromKg((lastKg[id] || {}).kg, cut) : x.size_band, damId: damOf[x.birth_litter_id] || '' }; };
  }
  /** One plain line for a check() result: "Takes 3 small or 2 medium with limited access. 2 of 2 now." */
  function summary(r) {
    var takes = r.alternatives ? 'Takes ' + r.alternatives + (r.access ? ' with ' + r.access + ' access' : '') + '. ' : '';
    if (r.limit === null) return takes + (r.count ? r.count + ' here. ' : '') + r.notes.join(' ');
    return takes + r.count + ' of ' + r.limit + ' now.' + (r.notes.length ? ' ' + r.notes.join(' ') : '');
  }
  return { check: check, audit: audit, accessOf: accessOf, accessRowCounts: accessRowCounts, accessOn: accessOn, limitsOn: limitsOn, facts: facts, summary: summary, band: band, word: word, sizeCutoffs: sizeCutoffs, sizeFromKg: sizeFromKg, rangeMidKg: rangeMidKg, sizeOf: sizeOf, sizeOverride: sizeOverride, sizeForDog: sizeForDog, sizeLabels: sizeLabels, inForce: inForce, freePlaces: freePlaces, spaceRules: spaceRules, deriveRows: deriveRows };

}));
