/*!
 * Breed Better DNA Kit (Lisa's DNA Kit artifact, approved 12 Nov 2026). Read only.
 * Everything about a test comes from its BLD-dna_marker row: name, inheritance_mode, the meaning of 0, 1 and 2 copies,
 * the breeding rule and its source. Results come from BLD-dna_result. Nothing about any test is written here.
 * Works the same in the standalone app, the BLD suite and the CD Hub: it only needs the two tables.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BBDnaKit = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function t(v) { return v === undefined || v === null ? '' : String(v).trim(); }
  var RANK = { affected: 0, carrier: 1, unknown: 2, clear: 3 };
  var COLOUR = { clear: '--ljr-5', carrier: '--ljr-3', affected: '--ljr-2', unknown: '--line' };
  var TEXT = { clear: '--ljr-5-text', carrier: '--ljr-3-text', affected: '--ljr-2-text', unknown: '--muted' };
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function day(d) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t(d)); if (m && typeof BLDDates !== 'undefined') return BLDDates.long(t(d)); return m ? Number(m[3]) + ' ' + MON[Number(m[2]) - 1] + ' ' + m[1] : t(d); }

  /** Marker rows by code (case kept, matched without case). */
  function markers(T) {
    var out = {};
    (T['BLD-dna_marker.csv'] || []).forEach(function (m) { if (t(m.code)) out[t(m.code).toLowerCase()] = m; });
    return out;
  }
  /** How many copies a result shows: the copies cell, else the lab's words read against the marker's own words. */
  function copiesOf(r) {
    var c = t(r.copies);
    if (/^[012]$/.test(c)) return Number(c);
    var w = (t(r.interpretation) + ' ' + t(r.genotype)).toLowerCase();
    if (/\b(not|non)[- ]?(affected|carrier)|clear|normal|negative|n\/n\b/.test(w)) return 0;
    if (/carrier|\bn\/[a-z]/.test(w)) return 1;
    if (/affected|at[- ]?risk/.test(w)) return 2;
    return null;
  }
  /** Recessive: 1 copy carries, 2 affects. Any dominant or risk-factor mode: 1 copy is enough. From inheritance_mode. */
  function dominant(m) { return /dominant|risk factor/i.test(t(m && m.inheritance_mode)); }
  function kindOf(m, copies) {
    if (copies === null || copies === undefined) return 'unknown';
    if (copies === 0) return 'clear';
    if (copies === 2 || dominant(m)) return 'affected';
    return 'carrier';
  }
  /** One animal's DNA results, worst first, each with the marker's own words. */
  function results(T, id) {
    var M = markers(T);
    return (T['BLD-dna_result.csv'] || []).filter(function (r) { return r.subject_id === id; }).map(function (r) {
      var m = M[t(r.marker_code).toLowerCase()] || null, c = copiesOf(r), k = kindOf(m, c);
      return {
        code: t(r.marker_code), name: m ? t(m.name) : '', copies: c, kind: k, genotype: t(r.genotype),
        meaning: m && c !== null ? t(m['copies_' + c]) : t(r.interpretation), mode: m ? t(m.inheritance_mode) : '',
        rule: m ? t(m.breeding_rule) : '', source: m ? t(m.source) : '', lab: t(r.lab), on: t(r.tested_on), known: !!m
      };
    }).sort(function (a, b) { return RANK[a.kind] - RANK[b.kind] || a.code.localeCompare(b.code); });
  }
  function worst(list) { return list.reduce(function (w, x) { return RANK[x.kind] < RANK[w] ? x.kind : w; }, 'clear'); }

  /** Two copies drawn as two circles: filled = the variant. A dominant test draws squares. */
  function glyph(x, size) {
    var s = size || 22, col = 'var(' + COLOUR[x.kind] + ')', sq = /dominant|risk factor/i.test(x.mode), out = '';
    for (var i = 0; i < 2; i++) {
      var filled = x.copies !== null && i >= 2 - x.copies, cx = i * (s + 4) + s / 2 + 1, cy = s / 2 + 1, r = s / 2 - 1.5;
      var style = 'fill:' + (filled ? col : 'transparent') + ';stroke:' + col + ';stroke-width:1.75' + (x.copies === null ? ';stroke-dasharray:2 3' : '');
      out += sq ? '<rect x="' + (cx - r) + '" y="' + (cy - r) + '" width="' + 2 * r + '" height="' + 2 * r + '" rx="3" style="' + style + '"/>'
        : '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" style="' + style + '"/>';
    }
    return '<svg width="' + (2 * s + 6) + '" height="' + (s + 2) + '" viewBox="0 0 ' + (2 * s + 6) + ' ' + (s + 2) + '" aria-hidden="true">' + out + '</svg>';
  }
  var WORD = { clear: 'Clear', carrier: 'Carrier', affected: 'Affected or at risk', unknown: 'Not read' };

  /** The DNA card on an animal's Breed Better page. Empty when the animal has no DNA results. */
  function card(T, id, esc) {
    var list = results(T, id);
    if (!list.length) return '';
    var n = { clear: 0, carrier: 0, affected: 0, unknown: 0 };
    list.forEach(function (x) { n[x.kind]++; });
    var w = worst(list);
    return '<details class="card bb-dna" data-bb-band="__dna" style="--v:var(' + COLOUR[w] + ')"><summary><span class="bb-strong">DNA</span>'
      + '<span class="bb-dnasum">' + ['clear', 'carrier', 'affected', 'unknown'].filter(function (k) { return n[k]; }).map(function (k) {
        return '<span class="bb-tag" style="border-color:var(' + COLOUR[k] + ')">' + n[k] + ' ' + WORD[k] + '</span>';
      }).join('') + '</span></summary>'
      + list.map(function (x) {
        return '<div class="bb-line bb-dnal"><span class="bb-dg">' + glyph(x) + '</span><span class="bb-l"><span class="bb-strong">' + esc(x.code) + '</span>'
          + (x.name ? ' <span class="bb-pts">' + esc(x.name) + '</span>' : '') + '</span>'
          + '<span class="bb-tag" style="border-color:var(' + COLOUR[x.kind] + ');color:var(' + TEXT[x.kind] + ')">' + WORD[x.kind] + '</span>'
          + '<span class="bb-why">' + esc([x.genotype, x.meaning].filter(Boolean).join(': '))
          + (x.on ? ' · ' + esc(day(x.on)) : '') + (x.lab ? ' · ' + esc(x.lab) : '')
          + (x.known ? '' : ' · test not in the marker list') + '</span></div>';
      }).join('') + '</details>';
  }

  /** The key: the three results, read from the drawing alone. */
  function key() {
    return '<div class="bb-dnakey">' + [['clear', 0], ['carrier', 1], ['affected', 2]].map(function (k) {
      return '<span class="bb-tag">' + glyph({ kind: k[0], copies: k[1], mode: '' }, 16) + ' ' + WORD[k[0]] + '</span>';
    }).join('') + '<span class="bb-pts">Filled = a copy of the variant. Square = one copy is enough.</span></div>';
  }

  /** Probability per puppy for one autosomal test: each parent passes the variant with chance copies / 2. */
  function perPuppy(sire, dam) {
    var a = sire / 2, b = dam / 2;
    return { 0: (1 - a) * (1 - b), 1: a * (1 - b) + b * (1 - a), 2: a * b };
  }
  /** Tests the calculator can work: any marker whose mode is autosomal or dominant (not X-linked or mitochondrial). */
  function calcMarkers(T) {
    return (T['BLD-dna_marker.csv'] || []).filter(function (m) {
      var mode = t(m.inheritance_mode);
      return t(m.code) && mode && !/x[- ]?linked|mitochond|y[- ]?linked/i.test(mode);
    });
  }
  function calc(T, pick, esc) {
    var ms = calcMarkers(T);
    if (!ms.length) return '<p class="mut">No DNA tests set up yet.</p>';
    var m = ms.filter(function (x) { return t(x.code) === pick.code; })[0] || ms[0];
    var opt = function (who, cur) {
      return '<div class="bb-filt" role="group" aria-label="' + who + '">' + [0, 1, 2].map(function (c) {
        var x = { kind: kindOf(m, c), copies: c, mode: t(m.inheritance_mode) };
        return '<button type="button" class="bb-f" data-bb-calc="' + who.toLowerCase() + ':' + c + '" aria-pressed="' + (cur === c) + '" aria-label="' + who + ': ' + c + ' copies, ' + WORD[x.kind] + '">' + glyph(x, 16) + ' ' + c + '</button>';
      }).join('') + '</div>';
    };
    var s = pick.sire === undefined ? 0 : pick.sire, d = pick.dam === undefined ? 0 : pick.dam, p = perPuppy(s, d);
    return '<h3 class="bb-h">Probability per puppy</h3><p class="bb-pts">Pick a test, then each parent\'s copies. Worked from the test\'s own row.</p>'
      + '<label class="bb-lab">Test<select data-bb-calc-test="1">' + ms.map(function (x) {
        return '<option value="' + esc(t(x.code)) + '"' + (x === m ? ' selected' : '') + '>' + esc(t(x.code)) + (t(x.name) ? ', ' + esc(t(x.name)) : '') + '</option>';
      }).join('') + '</select></label>'
      + '<div class="card"><span class="bb-strong">Sire</span>' + opt('Sire', s) + '<span class="bb-strong">Dam</span>' + opt('Dam', d) + '</div>'
      + '<div class="card bb-calcout">' + [0, 1, 2].map(function (c) {
        var k = kindOf(m, c), pc = Math.round(p[c] * 1000) / 10;
        return '<div class="bb-oc"><span>' + glyph({ kind: k, copies: c, mode: t(m.inheritance_mode) }, 16) + '</span><span>' + esc(t(m['copies_' + c]) || WORD[k]) + '</span>'
          + '<span class="bb-ocbar"><i style="width:' + pc + '%;background:var(' + COLOUR[k] + ')"></i></span><span class="bb-big">' + pc + '%</span></div>';
      }).join('')
      + (t(m.breeding_rule) ? '<p class="bb-why"><span class="bb-strong">Breeding rule:</span> ' + esc(t(m.breeding_rule)) + '</p>' : '')
      + '<p class="bb-pts">' + esc(t(m.inheritance_mode)) + (t(m.source) ? '. Source: ' + esc(t(m.source)) : '') + '</p></div>';
  }

  function css() {
    return [
      '.bb-dna{border-left:3px solid var(--v,var(--line))}.bb-dna summary{cursor:pointer;display:flex;flex-wrap:wrap;align-items:center;gap:8px;min-height:44px}',
      '.bb-dnasum{display:flex;flex-wrap:wrap;gap:6px;margin-left:auto}.bb-dg{flex:none}.bb-dnal .bb-tag{white-space:nowrap}',
      '.bb-dnakey{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:8px 0}.bb-dnakey .bb-tag{display:inline-flex;align-items:center;gap:4px}',
      '.bb-calcout{display:flex;flex-direction:column;gap:8px}.bb-oc{display:grid;grid-template-columns:auto minmax(0,1fr) 80px 56px;align-items:center;gap:8px}',
      '.bb-ocbar{height:12px;border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}.bb-ocbar i{display:block;height:100%}',
      '.bb-oc .bb-big{text-align:right;font-size:var(--fs-body)}'
    ].join('');
  }

  return { markers: markers, copiesOf: copiesOf, kindOf: kindOf, results: results, worst: worst, card: card, key: key, perPuppy: perPuppy, calcMarkers: calcMarkers, calc: calc, css: css };
}));
