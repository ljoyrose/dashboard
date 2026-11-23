/*!
 * BLDDocsView - a dog's documents on the dog card (Lisa 17 Nov 2026: "Yes, add it").
 * A document is a BLD-files row linked from the dog by a BLD-links row (one file store, decision C). The link's role is the
 * document type's code from BLD-doc_type (pedigree, ofa-hips, vet-history ...); its label is the doc_type row's label, so no
 * type is named in code. Photo roles (main, gallery) are the photo gallery's and are left out. Reads and draws only.
 * Lisa 18 Nov 2026 ("Yes, add them"): files linked from the dog's own records (a check_log row whose subject_id is the dog,
 * e.g. a fit-to-breed certificate) show too. v.records(table) gives that table's rows; v.recordLabel(table, row) names the
 * record (the check type's label) when the role has no doc_type row. Job evidence photos stay with the job.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDDocsView = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PHOTO_ROLES = { main: 1, gallery: 1, evidence: 1 };
  var DOG_TABLES = { subjects: 1, subject: 1 };

  /** The file as a Drive link: the row's url when it is https, else its Drive file id. */
  function fileUrl(f) {
    var u = String(f.url || '').trim(), id = String(f.drive_file_id || '').trim();
    if (/^https:\/\//i.test(u)) return u;
    return /^[A-Za-z0-9_-]{20,}$/.test(id) ? 'https://drive.google.com/file/d/' + id + '/view' : '';
  }

  /** The owner's words for a type: the doc_type row with that code, else the code in plain words. */
  function typeLabel(types, role) {
    var t = (types || []).filter(function (r) { return String(r.code || '').trim() === role; })[0];
    if (t && String(t.label || '').trim()) return String(t.label).trim();
    var s = role.replace(/[-_.]+/g, ' ').trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /** The dog's documents open on v.today, newest first: {role, label, on, name, url}. */
  function forDog(v, dogId) {
    var files = {};
    (v.files || []).forEach(function (f) { files[f.id] = f; });
    var out = [];
    var mine = {};                                               // table -> {id: row} of the dog's own records
    function ownRecord(table, id) {
      if (!mine[table]) {
        mine[table] = {};
        var rows = typeof v.records === 'function' ? v.records(table) : [];
        (rows || []).forEach(function (r) { if (r && r.subject_id === dogId && r.id) mine[table][r.id] = r; });
      }
      return mine[table][id];
    }
    (v.links || []).forEach(function (k) {
      var role = String(k.role || '').trim();
      if (k.to_table !== 'files' || !role || PHOTO_ROLES[role]) return;
      var rec = null;
      if (DOG_TABLES[k.from_table]) { if (k.from_id !== dogId) return; }
      else if (!(rec = ownRecord(k.from_table, k.from_id))) return;
      if (k.from_date && k.from_date > v.today) return;          // not started yet
      if (k.to_date && k.to_date <= v.today) return;             // ended (remove means end)
      var f = files[k.to_id], url = f && fileUrl(f);
      if (!url) return;
      var hasType = (v.docTypes || []).some(function (t) { return String(t.code || '').trim() === role; });
      var named = rec && !hasType && typeof v.recordLabel === 'function' ? String(v.recordLabel(k.from_table, rec) || '').trim() : '';
      var label = named ? named + ' ' + typeLabel([], role).toLowerCase() : typeLabel(v.docTypes, role);
      var on = f.taken_on || (rec && (rec.happened_at || rec.taken_at)) || k.from_date || '';
      out.push({ role: role, label: label, on: String(on).slice(0, 10), name: String(f.name || '').trim(), url: url });
    });
    return out.sort(function (a, b) { return (b.on || '').localeCompare(a.on || '') || a.label.localeCompare(b.label); });
  }

  /** The Documents section for the dog card. Each line opens the file in Drive. */
  function html(v, dogId, icon) {
    var esc = v.esc, dmy = v.dmy, docs = forDog(v, dogId);
    var head = docs.length ? '<b>' + docs.length + '</b> document' + (docs.length !== 1 ? 's' : '') : '<span class="mut">no documents</span>';
    return '<details class="dcs docs" data-k="docs"><summary>' + (icon || '')
      + '<span class="dcs-label">' + head + '</span></summary><div class="dcs-bd">'
      + docs.map(function (d) {
        return '<div class="dcs-row" data-k="doc"><span class="mut">' + (d.on ? esc(dmy(d.on)) : 'no date') + '</span>'
          + '<a class="cb" href="' + esc(d.url) + '" target="_blank" rel="noopener" data-doc="' + esc(d.role) + '"'
          + (d.name ? ' title="' + esc(d.name) + '"' : '') + '>' + esc(d.label) + '</a></div>';
      }).join('')
      + '</div></details>';
  }

  return { forDog: forDog, html: html, typeLabel: typeLabel };
}));
