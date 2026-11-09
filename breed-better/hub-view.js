/*!
 * Breed Better in CD Hub: reads rule rows and draws scores. It writes nothing and holds no animal data.
 * Everything specific to a species, breed or scheme comes from rows. Needs BreedBetterScore (score.js).
 * Scores are worked out when the page loads and carry a Testing label until the owner signs the scoring off.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./score.js'));
  else root.BBHubView = factory(root.BreedBetterScore);
}(typeof self !== 'undefined' ? self : this, function (Score) {
  'use strict';

  var FILES = ['BLD-score_scheme.csv', 'BLD-score_band.csv', 'BLD-score_criterion.csv', 'BLD-score_point.csv', 'BLD-score_enrolment.csv'];
  var VERDICT = { pass: 'Pass', unverified: 'Unverified', fail: 'Fail' };
  var ORDER = ['pass', 'unverified', 'fail'];
  var REASON = {
    no_source: 'Record type not set up yet', no_record: 'No record yet', not_judged: 'Not entered yet', expired: 'Out of date',
    undated: 'Record has no date', blank_answer: 'Blank on the record', no_rule_for_answer: 'Answer is not in the rules',
    recorded_unverified: 'Recorded, cannot be scored yet'
  };
  var GO = { 'BLD-litter': 'litters', 'BLD-health_screen': 'dogs', 'BLD-dna_result': 'dogs', 'BLD-subject_status': 'dogs' };
  var state = { filter: '', dog: '' }, last = null, memo = null;

  function t(v) { return v === undefined || v === null ? '' : String(v).trim(); }

  /** One result per enrolled animal, best first. { results, error, byId } */
  function compute(v) {
    var T = v.T, key = v.today + '|' + FILES.concat(['BLD-subject.csv', 'BLD-health_screen.csv', 'BLD-dna_result.csv', 'BLD-litter.csv'])
      .map(function (f) { return (T[f] || []).length; }).join(',');
    if (memo && memo.key === key) return memo;
    var out = { key: key, results: [], byId: {}, error: '', setUp: !!(T['BLD-score_enrolment.csv'] || []).length };
    var subjects = {};
    (T['BLD-subject.csv'] || []).forEach(function (s) { subjects[s.id] = s; });
    var evidence = new Proxy({}, { get: function (o, name) { return T[name + '.csv']; } });
    (T['BLD-score_enrolment.csv'] || []).forEach(function (e) {
      if (/^false$/i.test(t(e.is_active)) || (t(e.valid_from) && e.valid_from > v.today)) return;
      var subject = subjects[e.subject_id];
      if (!subject) { out.error = 'An enrolled animal is not in the animal list: check BLD-score_enrolment.'; return; }
      var scheme = (T['BLD-score_scheme.csv'] || []).filter(function (s) {
        return s.id === e.scheme_id && /^active$/i.test(t(s.status)) && t(s.effective_from) && s.effective_from <= v.today;
      })[0];
      if (!scheme) { out.error = 'No active scheme for an enrolled animal: check BLD-score_scheme.'; return; }
      var inScheme = function (r) { return r.scheme_id === scheme.id; };
      var bands = (T['BLD-score_band.csv'] || []).filter(function (b) { return inScheme(b) && t(b.kind); });
      var criteria = (T['BLD-score_criterion.csv'] || []).filter(inScheme);
      var ids = {}; criteria.forEach(function (c) { ids[c.id] = 1; });
      var points = (T['BLD-score_point.csv'] || []).filter(function (p) { return ids[p.criterion_id]; });
      try {
        var r = Score.score({ scheme: scheme, bands: bands, criteria: criteria, points: points, subject: subject, evidence: evidence, judgements: {}, asOf: v.today });
        r.name = t(subject.name); r.bands = bands;
        out.results.push(r); out.byId[r.subject_id] = r;
      } catch (err) { out.error = err.message; }
    });
    out.results.sort(function (a, b) {
      var d = ORDER.indexOf(a.gate_result) - ORDER.indexOf(b.gate_result);
      return d || (b.points_earned - a.points_earned) || a.name.localeCompare(b.name);
    });
    memo = out;
    return out;
  }

  function total(r) { return r.points_earned + ' of ' + r.points_available; }
  function pill(r) { return '<span class="bb-v bb-' + r.gate_result + '">' + VERDICT[r.gate_result] + '</span>'; }

  function listHtml(v, c) {
    var esc = v.esc, f = state.filter;
    var counts = { '': c.results.length };
    c.results.forEach(function (r) { counts[r.gate_result] = (counts[r.gate_result] || 0) + 1; });
    var h = '<div class="bb-filt" role="group" aria-label="Filter by verdict">' + [''].concat(ORDER).map(function (k) {
      return '<button type="button" class="bb-f" data-bb-filter="' + k + '" aria-pressed="' + (f === k) + '">' + (VERDICT[k] || 'All') + ' <span class="cnt">' + (counts[k] || '') + '</span></button>';
    }).join('') + '</div>';
    var shown = c.results.filter(function (r) { return !f || r.gate_result === f; });
    return h + (shown.length ? shown.map(function (r) {
      return '<button type="button" class="bb-dog" data-bb-open="' + esc(r.subject_id) + '"><span class="bb-name">' + esc(r.name) + '</span>' + pill(r)
        + '<span class="bb-pts">' + total(r) + (r.points_unverified ? ', ' + r.points_unverified + ' unverified' : '') + '</span></button>';
    }).join('') : '<p class="mut">None.</p>');
  }

  function dogHtml(v, r) {
    var esc = v.esc;
    var bands = r.bands.slice().sort(function (a, b) { return Number(a.sort_order) - Number(b.sort_order); });
    return '<button type="button" class="bb-f" data-bb-back="1">Back</button>'
      + '<div class="bb-head"><h3>' + esc(r.name) + '</h3>' + pill(r) + '<span class="bb-pts">' + total(r) + (r.points_unverified ? ', ' + r.points_unverified + ' unverified' : '') + '</span></div>'
      + bands.map(function (b) {
        var lines = r.lines.filter(function (l) { return l.band_id === b.id; });
        if (!lines.length) return '';
        return '<details class="card bb-band bb-c-' + esc(t(b.colour)) + '"><summary>' + esc(b.label) + ' <span class="cnt">' + lines.length + '</span></summary>'
          + lines.map(function (l) { return lineHtml(v, l); }).join('') + '</details>';
      }).join('');
  }

  function lineHtml(v, l) {
    var esc = v.esc, res;
    if (l.kind === 'gate') res = '<span class="bb-v bb-' + l.gate_outcome + '">' + VERDICT[l.gate_outcome] + '</span>';
    else if (l.kind === 'status') res = '<span class="bb-pts">' + esc(l.answer_then) + '</span>';
    else res = l.points === '' ? '<span class="bb-v bb-unverified">Unverified</span>' : '<span class="bb-pts">' + l.points + ' of ' + l.points_max + '</span>';
    var why = l.unknown_reason ? (REASON[l.unknown_reason] || '') : (l.answer_then ? 'Recorded: ' + esc(l.answer_then) : '');
    var go = GO[l.evidence_table];
    return '<div class="bb-line"><span class="bb-l">' + esc(l.label_then) + '</span>' + res
      + '<span class="bb-why">' + why + (go ? ' <button type="button" class="bb-src" data-go="' + go + '">Open</button>' : '') + '</span></div>';
  }

  function inner(v) {
    var c = compute(v);
    if (!c.setUp) return '<p class="mut">Not set up yet.</p>';
    var err = c.error ? '<div class="card acc2"><p>' + v.esc(c.error) + '</p></div>' : '';
    var dog = state.dog && c.byId[state.dog];
    return err + (dog ? dogHtml(v, dog) : listHtml(v, c));
  }

  function css() {
    if (typeof document === 'undefined' || document.getElementById('bbStyle')) return;
    var s = document.createElement('style'); s.id = 'bbStyle';
    s.textContent = [
      '.bb-v{display:inline-flex;align-items:center;height:24px;padding:0 8px;border-radius:var(--radius);border:1px solid;font-size:var(--fs-small);font-weight:500;white-space:nowrap;background:transparent}',
      '.bb-pass{border-color:var(--ljr-5);color:var(--ljr-5-text)}.bb-unverified{border-color:var(--ljr-6);color:var(--ljr-6-text)}.bb-fail{border-color:var(--ljr-2);color:var(--ljr-2-text)}',
      '.bb-test{border-color:var(--ljr-7);color:var(--ljr-7-text)}',
      '.bb-filt{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}',
      '.bb-f,.bb-dog,.bb-src,.bb-chip{font:inherit;color:var(--ink);background:transparent;border:1px solid var(--line);border-radius:var(--radius);cursor:pointer}',
      '.bb-f{min-height:44px;padding:0 12px;display:inline-flex;align-items:center;gap:8px;font-weight:500}',
      '.bb-f[aria-pressed=true],.bb-f:hover,.bb-dog:hover,.bb-src:hover,.bb-chip:hover,.bb-f:focus-visible,.bb-dog:focus-visible,.bb-src:focus-visible,.bb-chip:focus-visible{border-color:var(--ljr-7);outline:none}',
      '.bb-dog{display:flex;flex-wrap:wrap;align-items:center;gap:8px;width:100%;min-height:44px;padding:8px 12px;margin:0 0 8px;text-align:left}',
      '.bb-name{font-weight:500;flex:1 1 auto}.bb-pts,.bb-why{color:var(--muted);font-size:var(--fs-small)}',
      '.bb-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:12px 0}.bb-head h3{margin:0;font-weight:500}',
      '.bb-band{border-left:3px solid var(--bb,var(--line))}.bb-band summary{cursor:pointer;font-weight:500;display:flex;align-items:center;gap:8px;min-height:44px}',
      '.bb-band summary .cnt{margin-left:auto}',
      '.bb-c-red{--bb:var(--ljr-2)}.bb-c-orange{--bb:var(--ljr-3)}.bb-c-yellow{--bb:var(--ljr-4)}.bb-c-green{--bb:var(--ljr-5)}.bb-c-blue{--bb:var(--ljr-6)}.bb-c-purple{--bb:var(--ljr-7)}.bb-c-white{--bb:var(--line)}.bb-c-black{--bb:var(--ink)}',
      '.bb-line{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;padding:8px 0}.bb-l{flex:1 1 60%}.bb-why{flex:1 1 100%}',
      '.bb-src{min-height:24px;padding:0 8px;font-size:var(--fs-small);color:var(--ink)}',
      '.bb-chip{display:inline-flex;align-items:center;gap:4px;padding:0;border:0;margin-top:4px}'
    ].join('');
    document.head.appendChild(s);
  }

  /** The whole page. v = { T, today, esc } */
  function page(v) {
    last = v; css();
    return '<h2>Breed Better <span class="bb-v bb-test">Testing</span></h2><div id="bbRoot">' + inner(v) + '</div>';
  }

  /** The score on a dog card. Empty when that animal is not enrolled. */
  function chip(v, id) {
    last = v; css();
    var r = compute(v).byId[id];
    if (!r) return '';
    return '<button type="button" class="bb-chip" data-go="breed" data-bb-dog="' + v.esc(id) + '" aria-label="Breed Better score">' + pill(r) + '<span class="bb-pts">' + total(r) + '</span></button>';
  }

  function redraw() { var el = document.getElementById('bbRoot'); if (el && last) el.innerHTML = inner(last); }

  if (typeof document !== 'undefined') {
    /* capture, so the chosen dog is set before the hub's own click handler opens the page */
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-bb-dog],[data-bb-filter],[data-bb-open],[data-bb-back]');
      if (!b) return;
      if (b.hasAttribute('data-bb-dog')) { state.dog = b.getAttribute('data-bb-dog'); return; }
      if (b.hasAttribute('data-bb-filter')) state.filter = b.getAttribute('data-bb-filter');
      if (b.hasAttribute('data-bb-open')) state.dog = b.getAttribute('data-bb-open');
      if (b.hasAttribute('data-bb-back')) state.dog = '';
      redraw();
    }, true);
  }

  return { FILES: FILES, compute: compute, page: page, chip: chip };
}));
