/*!
 * Breed Better DNA panel (its on-screen name from 13 Nov 2026). Read only.
 * Everything about a test comes from its BLD-dna_marker row: name, inheritance_mode, the meaning of 0, 1 and 2 copies,
 * the breeding rule and its source. Results come from BLD-dna_result. Nothing about any test is written here.
 * Works the same in the standalone app, the BLD suite and the CD Hub: it only needs the two tables.
 * Grade-to-colour bands for health results (hips, elbows, patella, eyes ...) come from BLD-grade_band rows, never from code:
 * each row names a test, an answer rule (the calculator's forms: is:, in:, range:, any) and a level (good, watch or poor).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BBDnaPanel = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function t(v) { return v === undefined || v === null ? '' : String(v).trim(); }
  var RANK = { affected: 0, carrier: 1, unknown: 2, clear: 3 };
  var COLOUR = { clear: '--ljr-5', carrier: '--ljr-3', affected: '--ljr-2', unknown: '--line' };
  var TEXT = { clear: '--ljr-5-text', carrier: '--ljr-3-text', affected: '--ljr-2-text', unknown: '--muted' };
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function day(d) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t(d)); return m ? Number(m[3]) + ' ' + MON[Number(m[2]) - 1] + ' ' + m[1] : t(d); }

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

  /** The DNA panel on an animal's Breed Better page: health grades in their band colour, then DNA results.
   *  Empty when the animal has neither. */
  function card(T, id, esc) {
    var list = results(T, id), gr = grades(T, id);
    if (!list.length && !gr.length) return '';
    if (!list.length) {
      return '<details class="card bb-dna" data-bb-band="__dna" style="--v:var(--line)"><summary><span class="bb-strong">DNA panel</span>'
        + '<span class="bb-dnasum"><span class="bb-tag">' + gr.length + ' health ' + (gr.length === 1 ? 'grade' : 'grades') + '</span></span></summary>' + gradesHtml(gr, esc) + '</details>';
    }
    var n = { clear: 0, carrier: 0, affected: 0, unknown: 0 };
    list.forEach(function (x) { n[x.kind]++; });
    var w = worst(list);
    return '<details class="card bb-dna" data-bb-band="__dna" style="--v:var(' + COLOUR[w] + ')"><summary><span class="bb-strong">DNA panel</span>'
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
      }).join('') + gradesHtml(gr, esc) + '</details>';
  }

  /* ---- grade-to-colour bands (settings rows) ---- */
  var LEVEL = { good: { c: '--ljr-5', tx: '--ljr-5-text', d: 'M5 12l5 5l10 -10' }, watch: { c: '--ljr-3', tx: '--ljr-3-text', d: 'M12 5v9 M12 18v.01' }, poor: { c: '--ljr-2', tx: '--ljr-2-text', d: 'M18 6l-12 12 M6 6l12 12' } };
  /** The calculator's answer forms, read the same way: any, is:x, in:a|b, range:lo-hi. */
  function matchRule(rule, answer) {
    var r = t(rule), a = t(answer), m;
    if (r === 'any') return true;
    if ((m = /^is:(.+)$/.exec(r))) return t(m[1]).toLowerCase() === a.toLowerCase();
    if ((m = /^in:(.+)$/.exec(r))) return m[1].split('|').some(function (x) { return t(x).toLowerCase() === a.toLowerCase(); });
    if ((m = /^range:(-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)$/.exec(r))) return a !== '' && !isNaN(Number(a)) && Number(a) >= Number(m[1]) && Number(a) <= Number(m[2]);
    return false;
  }
  function inForce(row, d) { var f = t(row.from_date), to = t(row.to_date); return (!f || !d || f <= d) && (!to || !d || to >= d); }
  /** Band rows grouped by test, in their own order: [{test, label, scale, bands:[{label, level, match}]}]. */
  function gradeBands(T, today) {
    var by = {}, order = [];
    (T['BLD-grade_band.csv'] || []).filter(function (b) { return t(b.test) && t(b.grade_match) && inForce(b, today); })
      .sort(function (a, b) { return Number(a.sort_order || 0) - Number(b.sort_order || 0); }).forEach(function (b) {
        var k = t(b.test).toLowerCase();
        if (!by[k]) { by[k] = { test: t(b.test), label: t(b.test_label) || t(b.test), scale: t(b.scale), source: t(b.source), bands: [] }; order.push(k); }
        by[k].bands.push({ label: t(b.label) || t(b.grade_match), level: LEVEL[t(b.level).toLowerCase()] ? t(b.level).toLowerCase() : '', match: t(b.grade_match) });
      });
    return order.map(function (k) { return by[k]; });
  }
  /** The band a grade falls in for a test, or null. */
  function bandFor(T, test, grade, today) {
    var g = gradeBands(T, today).filter(function (x) { return x.test.toLowerCase() === t(test).toLowerCase(); })[0];
    if (!g) return null;
    return g.bands.filter(function (b) { return matchRule(b.match, grade); })[0] || null;
  }
  /** One animal's newest health result per banded test, with its band. Health results are always tested, never by parentage. */
  function grades(T, id) {
    var tests = gradeBands(T, '');
    if (!tests.length) return [];
    return tests.map(function (g) {
      var rows = (T['BLD-health_screen.csv'] || []).filter(function (r) { return r.subject_id === id && t(r.test).toLowerCase() === g.test.toLowerCase(); })
        .sort(function (a, b) { return t(b.tested_on).localeCompare(t(a.tested_on)); });
      if (!rows.length) return null;
      var b = g.bands.filter(function (x) { return matchRule(x.match, rows[0].grade); })[0] || null;
      return { test: g.label, grade: t(rows[0].grade), on: t(rows[0].tested_on), band: b };
    }).filter(Boolean);
  }
  function chipFor(b, text, esc) {
    var L = b && LEVEL[b.level];
    return '<span class="bb-tag bb-gband" data-level="' + (b ? esc(b.level) : '') + '" style="border-color:var(' + (L ? L.c : '--line') + ')">'
      + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" aria-hidden="true" style="stroke:var(' + (L ? L.tx : '--muted') + ')"><path d="' + (L ? L.d : 'M8 12h8') + '"/></svg>' + esc(text) + '</span>';
  }
  function gradesHtml(gr, esc) {
    if (!gr.length) return '';
    return '<div class="bb-grades"><span class="bb-strong">Health grades</span>' + gr.map(function (g) {
      return '<div class="bb-line"><span class="bb-l">' + esc(g.test) + '</span>' + chipFor(g.band, g.grade || 'Not read', esc)
        + '<span class="bb-why">' + (g.on ? esc(day(g.on)) : '') + (g.band ? '' : ' · grade not in the bands') + '</span></div>';
    }).join('') + '</div>';
  }
  /** Grade to colour: every banded test with its bands, from the rows. */
  function bandsHtml(T, esc, today) {
    var gs = gradeBands(T, today);
    return '<div class="card bb-gradebands"><h4 class="bb-h4">Grade to colour</h4><p class="bb-pts">From the grade band rows. Health results are always tested, never by parentage.</p>'
      + (gs.length ? gs.map(function (g) {
        return '<div class="bb-line" data-bb-gtest="' + esc(g.test) + '"><span class="bb-l"><span class="bb-strong">' + esc(g.label) + '</span>' + (g.scale ? ' <span class="bb-pts">' + esc(g.scale) + '</span>' : '') + '</span>'
          + '<span class="bb-gbands">' + g.bands.map(function (b) { return chipFor(b, b.label, esc); }).join('') + '</span>'
          + (g.source ? '<span class="bb-why">Source: ' + esc(g.source) + '</span>' : '') + '</div>';
      }).join('') : '<p class="mut">No grade bands set up yet.</p>') + '</div>';
  }

  /* ---- set-up: a test is a row. Read only here; the fields are shown as the row holds them. ---- */
  var SETUP = [['species_id', 'Species'], ['breeds', 'Breeds'], ['kind', 'Kind'], ['group_label', 'Category'], ['inheritance_mode', 'Inheritance'],
    ['gene', 'Gene or locus'], ['alleles', 'Allele names'], ['at_risk', 'Reduced penetrance (at risk)'], ['generations', 'Generations allowed by parentage'],
    ['copies_0', 'No copies'], ['copies_1', 'One copy'], ['copies_2', 'Two copies'], ['breeding_rule', 'Breeding rule'], ['source', 'Source of the rule'], ['scored', 'In the score']];
  function setupHtml(T, esc) {
    var ms = (T['BLD-dna_marker.csv'] || []).filter(function (m) { return t(m.code); });
    return '<div class="card bb-setup"><h4 class="bb-h4">Set-up</h4><p class="bb-pts">A test is a row. Read only here: rules are row values with a source.</p>'
      + (ms.length ? ms.map(function (m) {
        return '<details class="bb-done" data-bb-band="dna-' + esc(t(m.code)) + '"><summary><span class="bb-strong">' + esc(t(m.code)) + '</span>' + (t(m.name) ? ' <span class="bb-pts">' + esc(t(m.name)) + '</span>' : '') + '</summary>'
          + '<dl class="bb-dl">' + SETUP.filter(function (f) { return t(m[f[0]]); }).map(function (f) { return '<dt>' + f[1] + '</dt><dd>' + esc(t(m[f[0]])) + '</dd>'; }).join('') + '</dl></details>';
      }).join('') : '<p class="mut">No DNA tests set up yet.</p>') + '</div>';
  }
  /** The DNA panel screen under More: key, grade-to-colour bands, probability per puppy, set-up. */
  function screen(T, pick, esc, today) {
    return '<h3 class="bb-h">DNA panel</h3><p class="bb-pts">Colour is the result; shape is how it is known. DNA is not in the score for the trial dogs.</p>'
      + key() + bandsHtml(T, esc, today) + '<div class="card">' + calc(T, pick || {}, esc) + '</div>' + setupHtml(T, esc);
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
      '.bb-oc .bb-big{text-align:right;font-size:var(--fs-body)}',
      '.bb-gband{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}.bb-gbands{display:flex;flex-wrap:wrap;gap:6px}',
      '.bb-grades{margin-top:8px}.bb-dl{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:4px 12px;margin:8px 0;font-size:var(--fs-small)}.bb-dl dt{color:var(--muted)}.bb-dl dd{margin:0}'
    ].join('');
  }

  return { markers: markers, copiesOf: copiesOf, kindOf: kindOf, results: results, worst: worst, card: card, key: key, perPuppy: perPuppy, calcMarkers: calcMarkers, calc: calc, css: css,
    gradeBands: gradeBands, bandFor: bandFor, grades: grades, bandsHtml: bandsHtml, setupHtml: setupHtml, screen: screen, matchRule: matchRule };
}));
