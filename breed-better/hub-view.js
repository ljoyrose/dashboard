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

  var FILES = ['BLD-score_scheme.csv', 'BLD-score_band.csv', 'BLD-score_criterion.csv', 'BLD-score_point.csv', 'BLD-score_enrolment.csv',
    /* evidence only Breed Better reads; the hub already loads health_screen, dna_result, litter and subject_status */
    'BLD-fit_to_breed.csv', 'BLD-score_judgement.csv'];
  /* default words; a scheme row can change any of them with verdict_words, e.g. "unverified=To prove" */
  var VERDICT = { pass: 'Pass', below_target: 'Below target', unverified: 'Unverified', fail: 'Fail' };
  var ORDER = ['pass', 'below_target', 'unverified', 'fail'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var words = VERDICT;
  var REASON = {
    no_source: 'Record type not set up yet', no_record: 'No record yet', not_judged: 'Not entered yet', expired: 'Out of date',
    undated: 'Record has no date', blank_answer: 'Blank on the record', no_rule_for_answer: 'Answer is not in the rules',
    recorded_unverified: 'Recorded, cannot be scored yet'
  };
  var GO = { 'BLD-fit_to_breed': 'dogs', 'BLD-litter': 'litters', 'BLD-health_screen': 'dogs', 'BLD-dna_result': 'dogs', 'BLD-subject_status': 'dogs' };
  var state = { filter: '', dog: '', open: {}, q: '', sort: 'verdict' }, last = null, memo = null;

  function t(v) { return v === undefined || v === null ? '' : String(v).trim(); }

  /** 2026-03-02 -> "2 Mar 2026". Anything else is shown as it is. */
  function day(d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t(d));
    return m ? Number(m[3]) + ' ' + MON[Number(m[2]) - 1] + ' ' + m[1] : t(d);
  }

  function wordsFor(scheme) {
    var w = Object.assign({}, VERDICT);
    t(scheme && scheme.verdict_words).split(';').forEach(function (pair) {
      var at = pair.indexOf('='), k = pair.slice(0, at).trim().toLowerCase().replace(/\s+/g, '_');
      if (at > 0 && w[k] && t(pair.slice(at + 1))) w[k] = t(pair.slice(at + 1));
    });
    return w;
  }
  function verdictOf(r) { return r.verdict || r.gate_result; }

  /** One result per enrolled animal, best first. { results, error, byId } */
  function compute(v) {
    var T = v.T, key = v.today + '|' + FILES.concat(['BLD-subject.csv', 'BLD-health_screen.csv', 'BLD-dna_result.csv', 'BLD-litter.csv', 'BLD-subject_status.csv'])
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
        r.name = t(subject.name); r.dob = t(subject.dob); r.bands = bands; r.words = wordsFor(scheme);
        out.words = r.words;
        out.results.push(r); out.byId[r.subject_id] = r;
      } catch (err) { out.error = err.message; }
    });
    out.results.sort(function (a, b) {
      var d = ORDER.indexOf(verdictOf(a)) - ORDER.indexOf(verdictOf(b));
      /* within a verdict, by percent of what each animal could earn: a male and a female can have different totals */
      return d || (pct(b) - pct(a)) || a.name.localeCompare(b.name);
    });
    memo = out;
    return out;
  }

  function pct(r) { return r.points_available ? r.points_earned / r.points_available : 0; }
  function total(r) { return r.points_earned + ' of ' + r.points_available + (r.target !== '' && r.target !== undefined ? ', target ' + r.target : ''); }
  function vpill(k, w) { return '<span class="bb-v bb-' + k + '">' + (w || words)[k] + '</span>'; }
  function pill(r) { return vpill(verdictOf(r), r.words); }
  function unv(r) { return r.points_unverified ? ', ' + r.points_unverified + ' ' + r.words.unverified.toLowerCase() : ''; }

  /* Sort choices, as on the mock-up (11 Nov 2026). Verdict best to worst is the default; "Fail to Pass" is the one opt-in reverse. */
  var SORTS = [
    ['verdict', 'Verdict, Pass to Fail'], ['high', 'Score, highest %'], ['low', 'Score, lowest %'], ['name', 'Name, A to Z'],
    ['oldest', 'Oldest first'], ['youngest', 'Youngest first'], ['attention', 'Verdict, Fail to Pass']
  ];
  function byVerdict(a, b) { return ORDER.indexOf(verdictOf(a)) - ORDER.indexOf(verdictOf(b)); }
  function byName(a, b) { return a.name.localeCompare(b.name); }
  /* no date of birth sorts last either way */
  function byDob(dir) { return function (a, b) { return (!a.dob - !b.dob) || dir * a.dob.localeCompare(b.dob); }; }
  var SORT_FN = {
    verdict: function (a, b) { return byVerdict(a, b) || (pct(b) - pct(a)) || byName(a, b); },
    high: function (a, b) { return (pct(b) - pct(a)) || byVerdict(a, b) || byName(a, b); },
    low: function (a, b) { return (pct(a) - pct(b)) || byVerdict(a, b) || byName(a, b); },
    name: byName,
    oldest: function (a, b) { return byDob(1)(a, b) || byName(a, b); },
    youngest: function (a, b) { return byDob(-1)(a, b) || byName(a, b); },
    attention: function (a, b) { return byVerdict(b, a) || (pct(a) - pct(b)) || byName(a, b); }
  };
  function shownRows(c) {
    var f = state.filter, q = state.q.toLowerCase();
    return c.results.filter(function (r) { return (!f || verdictOf(r) === f) && (!q || r.name.toLowerCase().indexOf(q) !== -1); })
      .sort(SORT_FN[state.sort] || SORT_FN.verdict);
  }
  function rowsHtml(v, c) {
    var esc = v.esc, shown = shownRows(c);
    return shown.length ? shown.map(function (r) {
      return '<button type="button" class="bb-dog" data-bb-open="' + esc(r.subject_id) + '"><span class="bb-name">' + esc(r.name) + '</span>' + pill(r)
        + '<span class="bb-pts">' + total(r) + unv(r) + dueCount(r) + '</span></button>';
    }).join('') : '<p class="mut">None.</p>';
  }

  function listHtml(v, c) {
    var esc = v.esc, f = state.filter;
    words = c.words || VERDICT;
    var counts = { '': c.results.length };
    c.results.forEach(function (r) { counts[verdictOf(r)] = (counts[verdictOf(r)] || 0) + 1; });
    var h = '<div class="bb-filt" role="group" aria-label="Filter by verdict">' + [''].concat(ORDER).map(function (k) {
      return '<button type="button" class="bb-f" data-bb-filter="' + k + '" aria-pressed="' + (f === k) + '">' + (words[k] || 'All') + ' <span class="cnt">' + (counts[k] || '') + '</span></button>';
    }).join('') + '</div>';
    var tools = '<div class="bb-tools"><label class="bb-lab">Find a dog<input type="search" id="bbSearch" data-bb-search="1" placeholder="Name" autocomplete="off" value="' + esc(state.q) + '"></label>'
      + '<label class="bb-lab">Sort<select id="bbSort" data-bb-sort="1">' + SORTS.map(function (o) {
        return '<option value="' + o[0] + '"' + (state.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select></label></div>';
    return tools + h + '<div id="bbList">' + rowsHtml(v, c) + '</div>';
  }

  function dogHtml(v, r) {
    var esc = v.esc;
    var bands = r.bands.slice().sort(function (a, b) { return Number(a.sort_order) - Number(b.sort_order); });
    return '<button type="button" class="bb-f" data-bb-back="1">Back</button>'
      + '<div class="bb-head"><h3>' + esc(r.name) + '</h3>' + pill(r) + '<span class="bb-pts">' + total(r) + unv(r) + dueCount(r) + '</span></div>'
      + bands.map(function (b) {
        var lines = r.lines.filter(function (l) { return l.band_id === b.id; });
        if (!lines.length) return '';
        return '<details class="card bb-band bb-c-' + esc(t(b.colour)) + '" data-bb-band="' + esc(b.id) + '"' + (state.open[b.id] ? ' open' : '') + '><summary>' + esc(b.label) + ' <span class="cnt">' + lines.length + '</span></summary>'
          + lines.map(function (l) { return lineHtml(v, l, r.words); }).join('') + '</details>';
      }).join('');
  }

  function dueCount(r) {
    var n = r.lines.filter(function (l) { return l.due; }).length;
    return n ? ', ' + n + ' due' : '';
  }

  /** The Due level: shown beside the result, never a result itself. */
  function dueHtml(l) {
    if (l.due === 'overdue') return '<span class="bb-due bb-overdue">Overdue since ' + day(l.due_date) + '</span>';
    if (l.due === 'due_soon') return '<span class="bb-due">Due ' + day(l.due_date) + '</span>';
    return '';
  }

  function lineHtml(v, l, w) {
    var esc = v.esc, res;
    w = w || words;
    if (l.kind === 'gate') res = vpill(l.gate_outcome, w);
    else if (l.kind === 'status') res = '<span class="bb-pts">' + esc(l.answer_then) + '</span>';
    else res = l.points === '' ? vpill('unverified', w) : '<span class="bb-pts">' + l.points + ' of ' + l.points_max + '</span>';
    var when = l.date_then ? ' \u00b7 ' + esc(day(l.date_then)) : '';
    if (l.weight !== undefined && l.weight < 1) when += ' \u00b7 at ' + l.age_months + ' months, ' + (l.weight === 0.5 ? 'half' : Math.round(l.weight * 100) + '%') + ' points';
    var why = l.unknown_reason ? (REASON[l.unknown_reason] || '') + when : (l.answer_then ? 'Recorded: ' + esc(l.answer_then) + when : '');
    if (l.due_date && !l.due) why += ' \u00b7 due ' + esc(day(l.due_date));
    res += dueHtml(l);
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
      '.bb-pass{border-color:var(--ljr-5);color:var(--ink)}.bb-below_target{border-color:var(--ljr-3);color:var(--ink)}.bb-unverified{border-color:var(--ljr-6);color:var(--ink)}.bb-fail{border-color:var(--ljr-2);color:var(--ink)}',
      '.bb-due{font-size:var(--fs-small);color:var(--muted);white-space:nowrap}.bb-overdue{color:var(--ljr-3-text)}',
      '.bb-test{border-color:var(--ljr-7);color:var(--ink)}',
      '.bb-filt{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}',
      '.bb-tools{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;margin:0 0 12px}',
      '.bb-lab{display:flex;flex-direction:column;gap:4px;font-size:var(--fs-small);color:var(--muted);min-width:0}',
      '.bb-lab input,.bb-lab select{min-height:44px;width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:var(--radius);padding:6px 10px;background:var(--card);color:var(--ink);font-size:var(--fs-input,16px)}',
      '.bb-f,.bb-dog,.bb-src,.bb-chip{font:inherit;color:var(--ink);background:transparent;border:1px solid var(--line);border-radius:var(--radius);cursor:pointer}',
      '.bb-f{min-height:44px;padding:0 12px;display:inline-flex;align-items:center;gap:8px;font-weight:500}',
      '.bb-f:hover,.bb-dog:hover,.bb-src:hover,.bb-chip:hover,.bb-f:active,.bb-dog:active,.bb-src:active,.bb-chip:active{background:var(--hov);outline:none}',
      '.bb-f[aria-pressed=true]{background:var(--hov);border-color:var(--press)}',
      '.bb-f:focus-visible,.bb-dog:focus-visible,.bb-src:focus-visible,.bb-chip:focus-visible{border-color:var(--ink);outline:none}',
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
    return '<button type="button" class="bb-chip" data-go="breed" data-bb-dog="' + v.esc(id) + '" aria-label="Breed Better score, testing">' + pill(r) + '<span class="bb-pts">' + total(r) + '</span><span class="bb-v bb-test">Testing</span></button>';
  }

  /* typing or a new sort redraws the rows only, so the search box keeps focus */
  function redrawRows() { var el = document.getElementById('bbList'); if (el && last && memo) el.innerHTML = rowsHtml(last, memo); }
  function redraw() { var el = document.getElementById('bbRoot'); if (el && last) el.innerHTML = inner(last); }

  if (typeof document !== 'undefined') {
    /* remember which sections are open, so a redraw keeps them */
    document.addEventListener('toggle', function (e) {
      var d = e.target;
      if (d && d.getAttribute && d.hasAttribute('data-bb-band')) state.open[d.getAttribute('data-bb-band')] = d.open;
    }, true);
    document.addEventListener('input', function (e) {
      if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-bb-search')) { state.q = e.target.value.trim(); redrawRows(); }
    });
    document.addEventListener('change', function (e) {
      if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-bb-sort')) { state.sort = e.target.value; redrawRows(); }
    });
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

  return { FILES: FILES, compute: compute, page: page, chip: chip, day: day, wordsFor: wordsFor, SORTS: SORTS, sortRows: function (rows, k) { return rows.slice().sort(SORT_FN[k] || SORT_FN.verdict); } };
}));
