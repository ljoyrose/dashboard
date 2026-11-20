/*!
 * Dog-to-dog links (Lisa 13 Nov 2026): "BFFs" (dogs a dog likes to sleep with) and "Fren." (dogs it does not mix with).
 * Rows live in BLD-subject_link: subject_id, other_subject_id, kind, from_date, to_date, source. One row per pair, read
 * both ways. A row counts on a day when from_date <= day <= to_date (blank = open); ending a link sets to_date, rows are
 * never deleted. The kinds and their words are rule rows (rule_key link_kind.<kind>, value = the word shown), never fixed here.
 */
var BLDLinks = (function () {
  'use strict';
  function ymd(v) { var s = String(v == null ? '' : v).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }
  function on(r, day, fromKey) { var f = ymd(r[fromKey]), t = ymd(r.to_date); return (!f || f <= day) && (!t || day <= t); }
  /** The kinds in force on a day, in the order of the rule rows: [{kind, label}]. A later row for the same kind wins. */
  function kinds(rules, day) {
    var at = {}, order = [];
    (rules || []).forEach(function (r) {
      var m = /^link_kind\.([a-z0-9_]+)$/i.exec(String(r.rule_key || '')); if (!m || !String(r.value || '').trim() || !on(r, day, 'effective_from')) return;
      var k = m[1].toLowerCase(); if (!(k in at)) order.push(k);
      if (!at[k] || ymd(r.effective_from) >= ymd(at[k].effective_from)) at[k] = r;
    });
    return order.map(function (k) { return { kind: k, label: String(at[k].value).trim() }; });
  }
  /** One dog's links on a day, grouped by kind: [{kind, label, ids}]. Kinds with no rule row show their own key. */
  function forDog(rows, rules, id, day) {
    var ks = kinds(rules, day), by = {};
    (rows || []).forEach(function (r) {
      if (!on(r, day, 'from_date')) return;
      var other = r.subject_id === id ? r.other_subject_id : (r.other_subject_id === id ? r.subject_id : '');
      var k = String(r.kind || '').toLowerCase(); if (!other || !k || other === id) return;
      var list = by[k] || (by[k] = []); if (list.indexOf(other) < 0) list.push(other);
    });
    var out = ks.filter(function (k) { return by[k.kind]; }).map(function (k) { return { kind: k.kind, label: k.label, ids: by[k.kind] }; });
    Object.keys(by).forEach(function (k) { if (!ks.some(function (x) { return x.kind === k; })) out.push({ kind: k, label: k, ids: by[k] }); });
    return out;
  }
  return { kinds: kinds, forDog: forDog };
}());
if (typeof module !== 'undefined') module.exports = BLDLinks;
