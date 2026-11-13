/*!
 * Breed Better in CD Hub: reads rule rows and draws scores. It writes nothing and holds no animal data.
 * Everything specific to a species, breed or scheme comes from rows. Needs BreedBetterScore (score.js).
 * Scores are worked out when the page loads and carry a Testing label until the owner signs the scoring off.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./score.js'), require('./dna-kit.js'));
  else root.BBHubView = factory(root.BreedBetterScore, root.BBDnaKit);
}(typeof self !== 'undefined' ? self : this, function (Score, Dna) {
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
  var state = { filter: '', dog: '', open: {}, q: '', sort: 'verdict', tab: 'dogs', sex: '', month: '', cal: 'all', calc: {} }, last = null, memo = null;

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
    var out = { key: key, results: [], byId: {}, error: '', ended: [], setUp: !!(T['BLD-score_enrolment.csv'] || []).length };
    var subjects = {};
    (T['BLD-subject.csv'] || []).forEach(function (s) { subjects[s.id] = s; });
    var evidence = new Proxy({}, { get: function (o, name) { return T[name + '.csv']; } });
    (T['BLD-score_enrolment.csv'] || []).forEach(function (e) {
      /* enrolled from valid_from (live name) to to_date, both inclusive */
      if (/^false$/i.test(t(e.is_active)) || (t(e.to_date) && e.to_date < v.today)) {
        /* kept for the Archive: an enrolment that has ended, with its dates */
        if (subjects[e.subject_id]) out.ended.push({ id: e.subject_id, name: t(subjects[e.subject_id].name), from: t(e.valid_from), to: t(e.to_date) });
        return;
      }
      if (t(e.valid_from) && e.valid_from > v.today) return;
      var subject = subjects[e.subject_id];
      if (!subject) { out.error = 'An enrolled animal is not in the animal list: check BLD-score_enrolment.'; return; }
      /* the enrolment names one scheme; a later version of it (same name, species and breed) takes over on its own date */
      var schemes = T['BLD-score_scheme.csv'] || [];
      var named = schemes.filter(function (s) { return s.id === e.scheme_id; })[0];
      var scheme = named && Score.pickScheme(schemes.filter(function (s) {
        return t(s.name).toLowerCase() === t(named.name).toLowerCase() && t(s.breed).toLowerCase() === t(named.breed).toLowerCase();
      }), named.species_id, t(named.breed), v.today);
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

  /* Drawing only (mock-up and Style, 12 Nov 2026): verdict icons, the must-pass star and the band colours. No rule lives here. */
  var ICON = {
    pass: 'M5 12l5 5l10 -10', below_target: 'M6 9l6 6l6 -6', fail: 'M18 6l-12 12 M6 6l12 12',
    unverified: 'M8 8a3.5 3 0 0 1 3.5 -3h1a3.5 3 0 0 1 3.5 3a3 3 0 0 1 -2 3a3 4 0 0 0 -2 4 M12 19l0 .01',
    star: 'M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z',
    info: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0 M12 9h.01 M11 12h1v4h1'
  };
  var VTEXT = { pass: '--ljr-5-text', below_target: '--ljr-3-text', unverified: '--ljr-6-text', fail: '--ljr-2-text' };
  var BANDVAR = { red: '--ljr-2', orange: '--ljr-3', yellow: '--ljr-4', green: '--ljr-5', blue: '--ljr-6', purple: '--ljr-7', white: '--line', black: '--ink' };
  function ic(d, size, colour) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="stroke:' + (colour || 'currentColor') + ';flex-shrink:0"><path d="' + d + '"/></svg>';
  }
  function star() {
    return '<svg class="bb-star" role="img" aria-label="Must pass" width="15" height="15" viewBox="0 0 24 24"><path d="' + ICON.star + '"/></svg>';
  }
  function vword(r) {
    var k = verdictOf(r);
    return '<span class="bb-vw">' + ic(ICON[k], 16, 'var(' + VTEXT[k] + ')') + r.words[k] + '</span>';
  }
  function bandColour(b) { var k = BANDVAR[t(b.colour).toLowerCase()]; return k ? 'var(' + k + ')' : 'var(--line)'; }
  /** Points bands in their own order, each with what it can give, what was earned and what is still to prove. */
  function bandStats(r) {
    return r.bands.slice().sort(function (a, b) { return Number(a.sort_order) - Number(b.sort_order); })
      .filter(function (b) { return t(b.kind) === 'points'; }).map(function (b) {
        var o = { band: b, max: 0, earned: 0, unv: 0 };
        r.lines.forEach(function (l) {
          if (l.band_id !== b.id || l.points_max === '') return;
          o.max += Number(l.points_max) || 0;
          if (l.points === '') o.unv += Number(l.points_max) || 0; else o.earned += Number(l.points) || 0;
        });
        return o;
      }).filter(function (o) { return o.max > 0; });
  }
  function arc(c, rad, a, b) {
    function pt(x) { x = x * Math.PI / 180; return (c + rad * Math.sin(x)).toFixed(2) + ' ' + (c - rad * Math.cos(x)).toFixed(2); }
    return 'M' + pt(a) + 'A' + rad + ' ' + rad + ' 0 ' + (b - a > 180 ? 1 : 0) + ' 1 ' + pt(b);
  }
  /** The score ring round the photo: each points band owns an arc sized by its points, filled as far as earned. */
  function ring(r) {
    var st = bandStats(r), all = st.reduce(function (s, o) { return s + o.max; }, 0), a = 0, out = '';
    if (!all) return '';
    st.forEach(function (o) {
      var span = 360 * o.max / all, from = a + 1, to = a + span - 1;
      out += '<path d="' + arc(42, 38, from, to) + '" fill="none" stroke-width="6" style="stroke:var(--hov)"/>';
      var got = Math.max(0, Math.min(1, o.earned / o.max));
      if (got > 0) out += '<path d="' + arc(42, 38, from, from + (to - from) * got) + '" fill="none" stroke-width="6" style="stroke:' + bandColour(o.band) + '"/>';
      a += span;
    });
    return '<svg class="bb-ring" width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">' + out + '</svg>';
  }
  function hubDog(v, id) { return (v.dogs && v.dogs[id]) || null; }
  /** The animal's photo in a circle, or a plain circle when there is none. The hub loads the picture. */
  function photo(v, r) {
    var d = hubDog(v, r.subject_id), pic = d && v.photoId ? v.photoId(d.photo) : '';
    return '<span class="bb-ph">' + ring(r) + '<span class="bb-pic">' + (pic ? '<img class="dogphoto off" alt="" data-photo-id="' + v.esc(pic) + '" referrerpolicy="no-referrer">' : '') + '</span></span>';
  }
  /** "3 yrs 7 mths" on the given day. */
  function age(dob, today) {
    var a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t(dob)), b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t(today));
    if (!a || !b) return '';
    var m = (b[1] - a[1]) * 12 + (b[2] - a[2]) - (Number(b[3]) < Number(a[3]) ? 1 : 0);
    if (m < 0) return '';
    var y = Math.floor(m / 12), mm = m % 12;
    return [y ? y + (y === 1 ? ' yr' : ' yrs') : '', mm || !y ? mm + (mm === 1 ? ' mth' : ' mths') : ''].filter(Boolean).join(' ');
  }
  function subLine(v, r) {
    var d = hubDog(v, r.subject_id);
    return [d && t(d.sex), age(r.dob, v.today)].filter(Boolean).join(', ');
  }

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
    var sx = state.sex;
    return c.results.filter(function (r) {
      var d = hubDog(last || {}, r.subject_id);
      return (!f || verdictOf(r) === f) && (!q || r.name.toLowerCase().indexOf(q) !== -1) && (!sx || (d && t(d.sex) === sx));
    })
      .sort(SORT_FN[state.sort] || SORT_FN.verdict);
  }
  function rowsHtml(v, c) {
    var esc = v.esc, shown = shownRows(c);
    return shown.length ? shown.map(function (r) {
      var k = verdictOf(r);
      return '<button type="button" class="bb-dog" data-bb-open="' + esc(r.subject_id) + '" style="--v:var(' + VTEXT[k] + ')">' + photo(v, r)
        + '<span class="bb-info"><span class="bb-l1"><span class="bb-name">' + esc(r.name) + '</span><span class="bb-big" aria-hidden="true">' + r.points_earned + '</span></span>'
        + '<span class="bb-l2"><span>' + esc(subLine(v, r)) + '</span>' + vword(r) + '</span>'
        + '<span class="bb-pts">' + total(r) + unv(r) + dueCount(r) + '</span></span></button>';
    }).join('') : '<p class="mut">None.</p>';
  }

  function listHtml(v, c) {
    var esc = v.esc, f = state.filter;
    words = c.words || VERDICT;
    var counts = { '': c.results.length };
    c.results.forEach(function (r) { counts[verdictOf(r)] = (counts[verdictOf(r)] || 0) + 1; });
    var h = '<div class="bb-filt" role="group" aria-label="Filter by verdict">' + [''].concat(ORDER).map(function (k) {
      return '<button type="button" class="bb-f" data-bb-filter="' + k + '" aria-pressed="' + (f === k) + '">' + (words[k] || 'All') + ' <span class="cnt">' + (counts[k] || 0) + '</span></button>';
    }).join('') + '</div>';
    var tools = '<div class="bb-tools"><label class="bb-lab">Find a dog<input type="search" id="bbSearch" data-bb-search="1" placeholder="Name" autocomplete="off" value="' + esc(state.q) + '"></label>'
      + '<label class="bb-lab">Sort<select id="bbSort" data-bb-sort="1">' + SORTS.map(function (o) {
        return '<option value="' + o[0] + '"' + (state.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select></label></div>';
    /* sex: the words the hub holds, so another species' words show as they are */
    var sexes = {};
    c.results.forEach(function (r) { var d = hubDog(v, r.subject_id), x = d && t(d.sex); if (x) sexes[x] = (sexes[x] || 0) + 1; });
    var sk = Object.keys(sexes).sort();
    var sx = sk.length > 1 ? '<div class="bb-filt" role="group" aria-label="Filter by sex">' + [''].concat(sk).map(function (k) {
      return '<button type="button" class="bb-f" data-bb-sex="' + esc(k) + '" aria-pressed="' + (state.sex === k) + '">' + esc(k || 'Any sex') + (k ? ' <span class="cnt">' + sexes[k] + '</span>' : '') + '</button>';
    }).join('') + '</div>' : '';
    return tools + h + sx + '<div id="bbList">' + rowsHtml(v, c) + '</div>';
  }

  /** The animal's details from the hub, folded, as on the mock-up. Only what the hub holds is shown. */
  function infoHtml(v, r) {
    var esc = v.esc, d = hubDog(v, r.subject_id) || {}, pic = v.photoId ? v.photoId(d.photo) : '';
    var chips = [t(d.sex), age(r.dob, v.today), r.dob ? 'Born ' + day(r.dob) : '', d.colour && t(d.colour.name), t(d.pat),
      t(d.chip) ? 'Chip ...' + t(d.chip).slice(-4) : '', d.littersAsDam && d.littersAsDam.length ? d.littersAsDam.length + (d.littersAsDam.length === 1 ? ' litter' : ' litters') : '',
      t(d.state)].filter(Boolean);
    return '<details class="card bb-infobox" data-bb-band="__info"' + (state.open.__info ? ' open' : '') + '><summary>' + ic(ICON.info, 18, 'var(--muted)')
      + '<span class="bb-strong">Information</span><span class="bb-pts">' + esc([t(d.sex), age(r.dob, v.today)].filter(Boolean).join(', ')) + '</span></summary>'
      + '<div class="bb-infobd"><span class="bb-pic bb-pic88">' + (pic ? '<img class="dogphoto off" alt="" data-photo-id="' + esc(pic) + '" referrerpolicy="no-referrer">' : '') + '</span>'
      + '<span><span class="bb-strong">' + esc(r.name) + '</span><br><span class="bb-pts">' + esc(t(d.breed)) + '</span></span></div>'
      + '<div class="bb-chips">' + chips.map(function (x) { return '<span class="bb-tag">' + esc(x) + '</span>'; }).join('') + '</div></details>';
  }

  /** Why this verdict, in plain words, from the lines themselves. */
  function whyHtml(r) {
    var k = verdictOf(r), w = r.words;
    var gates = r.lines.filter(function (l) { return l.kind === 'gate'; });
    if (k === 'fail') return 'Must pass not met: ' + gates.filter(function (l) { return l.gate_outcome === 'fail'; }).map(function (l) { return l.label_then; }).join(', ') + '.';
    if (r.gate_result === 'unverified') return 'Must pass still to prove: ' + gates.filter(function (l) { return l.gate_outcome === 'unverified'; }).map(function (l) { return l.label_then; }).join(', ') + '.';
    if (k === 'unverified') return r.points_unverified + ' points still to prove could reach the target.';
    if (k === 'below_target') return 'All must pass met. ' + (r.target - r.points_earned) + ' points under the target.';
    return (gates.length ? 'All must pass met' : 'Scored') + (r.target !== '' && r.target !== undefined ? ', target reached.' : '.') + (w ? '' : '');
  }

  /** The verdict box: word, points, target, a bar split by section with the target marked, and why. */
  function verdictHtml(r) {
    var k = verdictOf(r), all = r.points_available || 0, st = bandStats(r);
    var lost = Math.max(0, all - r.points_earned - r.points_unverified);
    var hasT = r.target !== '' && r.target !== undefined;
    var bar = all ? st.map(function (o) {
      return (o.earned ? '<span style="width:' + (100 * o.earned / all) + '%;background:' + bandColour(o.band) + '" title="' + o.band.label + ': ' + o.earned + ' of ' + o.max + '"></span>' : '')
        + (o.unv ? '<span class="bb-tp" style="width:' + (100 * o.unv / all) + '%;--c:' + bandColour(o.band) + '" title="' + o.band.label + ': ' + o.unv + ' to prove"></span>' : '');
    }).join('') : '';
    return '<div class="card bb-vbox" style="--v:var(' + VTEXT[k] + ')"><div class="bb-vtop"><span class="bb-vl">' + ic(ICON[k], 28, 'var(' + VTEXT[k] + ')')
      + '<span><span class="bb-pts">Breed Better verdict</span><br><span class="bb-vword">' + r.words[k] + '</span></span></span>'
      + '<span class="bb-vr"><span class="bb-huge">' + r.points_earned + '</span><br><span class="bb-pts">of ' + all + ' points</span>'
      + (hasT ? '<br><span class="bb-pts">Target ' + r.target + '</span>' : '') + '</span></div>'
      + (all ? '<div class="bb-barw"><div class="bb-bar">' + bar + '</div>' + (hasT ? '<span class="bb-tmark" style="left:' + Math.min(100, 100 * r.target / all) + '%" title="Target ' + r.target + '"></span>' : '') + '</div>' : '')
      + '<div class="bb-three"><span>' + r.points_earned + ' earned</span><span>' + r.points_unverified + ' to prove</span><span>' + lost + ' lost</span></div>'
      + '<p class="bb-why">' + whyHtml(r) + '</p></div>';
  }

  function dogHtml(v, r) {
    var esc = v.esc;
    var bands = r.bands.slice().sort(function (a, b) { return Number(a.sort_order) - Number(b.sort_order); });
    return '<button type="button" class="bb-f" data-bb-back="1">Back</button>'
      + '<div class="bb-head"><h3>' + esc(r.name) + '</h3>' + pill(r) + '<span class="bb-pts">' + total(r) + unv(r) + dueCount(r) + '</span></div>'
      + infoHtml(v, r) + verdictHtml(r)
      + (Dna ? Dna.card(v.T, r.subject_id, esc).replace('data-bb-band="__dna"', 'data-bb-band="__dna"' + (state.open.__dna ? ' open' : '')) : '')
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
    if (l.rules_then) when += ' \u00b7 rules then';
    if (l.weight !== undefined && l.weight < 1) when += ' \u00b7 at ' + l.age_months + ' months, ' + (l.weight === 0.5 ? 'half' : Math.round(l.weight * 100) + '%') + ' points';
    var why = l.unknown_reason ? (REASON[l.unknown_reason] || '') + when : (l.answer_then ? 'Recorded: ' + esc(l.answer_then) + when : '');
    if (l.due_date && !l.due) why += ' \u00b7 due ' + esc(day(l.due_date));
    res += dueHtml(l);
    var go = GO[l.evidence_table];
    return '<div class="bb-line"><span class="bb-l">' + (l.kind === 'gate' ? star() : '') + esc(l.label_then) + '</span>' + res
      + '<span class="bb-why">' + why + (go ? ' <button type="button" class="bb-src" data-go="' + go + '">Open</button>' : '') + '</span></div>';
  }

  /* ---- Calendar, More, My system and Archive (mock-up, 12 Nov 2026). Read only. ---- */
  var TABS = [['dogs', 'Dogs', 'M9 6h11 M9 12h11 M9 18h11 M5 6v.01 M5 12v.01 M5 18v.01'],
    ['cal', 'Calendar', 'M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z M16 3v4 M8 3v4 M4 11h16'],
    ['more', 'More', 'M5 12l0 .01 M12 12l0 .01 M19 12l0 .01']];
  function tabsHtml() {
    var on = state.tab === 'system' || state.tab === 'archive' || state.tab === 'dna' ? 'more' : state.tab;
    return '<nav class="bb-tabs" aria-label="Breed Better">' + TABS.map(function (x) {
      return '<button type="button" class="bb-tab" data-bb-tab="' + x[0] + '"' + (on === x[0] ? ' aria-current="page"' : '') + '><span>' + ic(x[2], 18) + '</span>' + x[1] + '</button>';
    }).join('') + '</nav>';
  }
  function addDays(iso, n) { var d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  /** Every dated next step across the enrolled animals: the due dates the rules already give each line. */
  function dueItems(c) {
    var out = [];
    c.results.forEach(function (r) {
      r.lines.forEach(function (l) { if (l.due_date) out.push({ id: r.subject_id, dog: r.name, check: l.label_then, date: l.due_date, due: l.due }); });
    });
    return out.sort(function (a, b) { return a.date.localeCompare(b.date) || a.dog.localeCompare(b.dog); });
  }
  function calHtml(v, c) {
    var esc = v.esc, today = v.today, month = state.month || today.slice(0, 7);
    var all = dueItems(c), soon = addDays(today, 30);
    var modes = [['all', 'All'], ['overdue', 'Overdue'], ['next', 'Next 30 days']];
    var pick = {
      all: function (x) { return x.date.slice(0, 7) === month; },
      overdue: function (x) { return x.date < today; },
      next: function (x) { return x.date >= today && x.date <= soon; }
    };
    var n = {}; modes.forEach(function (m) { n[m[0]] = all.filter(m[0] === 'all' ? function () { return true; } : pick[m[0]]).length; });
    var rows = all.filter(pick[state.cal] || pick.all);
    var y = Number(month.slice(0, 4)), m = Number(month.slice(5, 7));
    var first = new Date(Date.UTC(y, m - 1, 1)), lead = (first.getUTCDay() + 6) % 7, days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    var has = {}; all.forEach(function (x) { if (x.date.slice(0, 7) === month) has[Number(x.date.slice(8, 10))] = (has[Number(x.date.slice(8, 10))] || 0) + 1; });
    var cells = '';
    for (var i = 0; i < lead; i++) cells += '<span></span>';
    for (var d = 1; d <= days; d++) {
      var iso = month + '-' + (d < 10 ? '0' : '') + d;
      cells += '<span class="bb-day' + (iso === today ? ' bb-today' : '') + '" aria-label="' + day(iso) + (has[d] ? ', ' + has[d] + ' due' : '') + '">' + d + (has[d] ? '<i></i>' : '') + '</span>';
    }
    var prev = addDays(month + '-01', -1).slice(0, 7), next = addDays(month + '-28', 7).slice(0, 7);
    return '<h3 class="bb-h">Calendar</h3><p class="bb-pts">' + n.next + ' due in the next 30 days. Dates come from each check\'s rules.</p>'
      + '<div class="bb-filt" role="group" aria-label="Show">' + modes.map(function (x) {
        return '<button type="button" class="bb-f" data-bb-cal="' + x[0] + '" aria-pressed="' + (state.cal === x[0]) + '">' + x[1] + ' <span class="cnt">' + n[x[0]] + '</span></button>';
      }).join('') + '</div>'
      + '<div class="card bb-month"><div class="bb-mhead"><button type="button" class="bb-f" data-bb-month="' + prev + '" aria-label="Previous month">' + ic('M15 6l-6 6l6 6', 18) + '</button>'
      + '<span class="bb-strong">' + MON[m - 1] + ' ' + y + '</span><button type="button" class="bb-f" data-bb-month="' + next + '" aria-label="Next month">' + ic('M9 6l6 6l-6 6', 18) + '</button></div>'
      + '<div class="bb-grid bb-wd"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div><div class="bb-grid">' + cells + '</div></div>'
      + (rows.length ? rows.map(function (x) {
        var late = x.date < today;
        return '<button type="button" class="bb-dog bb-calrow" data-bb-open="' + esc(x.id) + '" style="--v:var(' + (late ? '--ljr-3-text' : '--line') + ')"><span class="bb-info"><span class="bb-l1"><span class="bb-name">' + esc(x.dog) + ', ' + esc(x.check) + '</span></span>'
          + '<span class="bb-l2"><span>' + day(x.date) + '</span><span>' + (late ? 'Overdue' : 'Due') + '</span></span></span></button>';
      }).join('') : '<p class="mut">Nothing here.</p>');
  }
  function moreHtml(c) {
    return '<h3 class="bb-h">More</h3>'
      + '<button type="button" class="bb-dog" data-bb-tab="system"><span class="bb-name">My system</span><span class="bb-pts">Sections, checks and points</span></button>'
      + '<button type="button" class="bb-dog" data-bb-tab="archive"><span class="bb-name">Archive</span><span class="cnt">' + c.ended.length + '</span></button>'
      + (Dna ? '<button type="button" class="bb-dog" data-bb-tab="dna"><span class="bb-name">DNA: probability per puppy</span><span class="bb-pts">Sire and dam, per test</span></button>' : '');
  }
  function backMore() { return '<button type="button" class="bb-f" data-bb-tab="more">' + ic('M15 6l-6 6l6 6', 18) + 'More</button>'; }
  function archiveHtml(v, c) {
    var esc = v.esc;
    return backMore() + '<h3 class="bb-h">Archive</h3><p class="bb-pts">Animals whose scoring has ended. Their records stay.</p>'
      + (c.ended.length ? c.ended.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (x) {
        return '<div class="card bb-arch"><span class="bb-strong">' + esc(x.name) + '</span><span class="bb-pts">' + (x.from ? 'From ' + day(x.from) : '') + (x.to ? (x.from ? ', to ' : 'To ') + day(x.to) : '') + '</span></div>';
      }).join('') : '<p class="mut">None.</p>');
  }
  /** The rules in force today, read only: sections, checks, must pass, answers and points, target, and where each rule came from. */
  function systemHtml(v) {
    var esc = v.esc, T = v.T, today = v.today, schemes = (T['BLD-score_scheme.csv'] || []);
    var ids = {}; (T['BLD-score_enrolment.csv'] || []).forEach(function (e) { ids[e.scheme_id] = 1; });
    var shown = schemes.filter(function (s) { return ids[s.id] && /^active$/i.test(t(s.status)) && (!t(s.to_date) || s.to_date >= today); });
    if (!shown.length) return backMore() + '<p class="mut">No scheme in force today.</p>';
    return backMore() + '<h3 class="bb-h">My system</h3><p class="bb-pts">Read only. A star means must pass. Rules today; past records keep the rules of their own date.</p>'
      + shown.map(function (sc) {
        var bands = (T['BLD-score_band.csv'] || []).filter(function (b) { return b.scheme_id === sc.id && t(b.kind); })
          .sort(function (a, b) { return Number(a.sort_order) - Number(b.sort_order); });
        var crit = (T['BLD-score_criterion.csv'] || []).filter(function (x) { return x.scheme_id === sc.id && Score.inForce(x, today); });
        var pts = T['BLD-score_point.csv'] || [];
        return '<div class="card"><span class="bb-strong">' + esc(t(sc.name) || 'Scheme') + (t(sc.breed) ? ', ' + esc(sc.breed) : '') + (t(sc.version) ? ', version ' + esc(sc.version) : '') + '</span>'
          + '<p class="bb-pts">' + (t(sc.target_points) ? 'Target ' + esc(sc.target_points) + (t(sc.target_is) ? ' (' + esc(sc.target_is) + ')' : '') + '. ' : '') + (t(sc.source) ? 'Source: ' + esc(sc.source) : '') + '</p>'
          + bands.map(function (b) {
            var cs = crit.filter(function (x) { return x.band_id === b.id; });
            if (!cs.length) return '';
            return '<details class="card bb-band bb-c-' + esc(t(b.colour)) + '" data-bb-band="sys-' + esc(b.id) + '"' + (state.open['sys-' + b.id] ? ' open' : '') + '><summary>' + esc(b.label) + ' <span class="cnt">' + cs.length + '</span></summary>'
              + cs.map(function (x) {
                var rows = pts.filter(function (p) { return p.criterion_id === x.id && Score.inForce(p, today); });
                return '<div class="bb-line"><span class="bb-l">' + (t(b.kind) === 'gate' ? star() : '') + esc(x.label) + '</span>'
                  + '<span class="bb-why">' + rows.map(function (p) {
                    return esc(t(p.answer_match)) + ': ' + (t(p.gate_outcome) ? esc((words[t(p.gate_outcome)] || p.gate_outcome)) : esc(t(p.points)) + ' points');
                  }).join(' \u00b7 ') + (t(x.valid_months) ? ' \u00b7 lasts ' + esc(x.valid_months) + ' months' : '') + (t(x.authority) ? ' \u00b7 ' + esc(x.authority) : '') + '</span></div>';
              }).join('') + '</details>';
          }).join('') + '</div>';
      }).join('');
  }

  function inner(v) {
    var c = compute(v);
    if (!c.setUp) return '<p class="mut">Not set up yet.</p>';
    var err = c.error ? '<div class="card acc2"><p>' + v.esc(c.error) + '</p></div>' : '';
    var dog = state.dog && c.byId[state.dog];
    if (dog) return err + dogHtml(v, dog);
    words = c.words || VERDICT;
    var body = state.tab === 'cal' ? calHtml(v, c) : state.tab === 'more' ? moreHtml(c) : state.tab === 'archive' ? archiveHtml(v, c)
      : state.tab === 'system' ? systemHtml(v) : state.tab === 'dna' && Dna ? backMore() + Dna.key() + Dna.calc(v.T, state.calc, v.esc) : listHtml(v, c);
    return err + tabsHtml() + body;
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
      '.bb-chip{display:inline-flex;align-items:center;gap:4px;padding:0;border:0;margin-top:4px}',
      /* list row and dog page (mock-up and Style, 12 Nov 2026): colour sits in lines and icons, never a fill at rest */
      '.bb-dog{position:relative;flex-wrap:nowrap;gap:12px;padding:12px 12px 12px 15px;overflow:hidden}',
      '.bb-dog::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--v,var(--line))}',
      '.bb-ph{width:84px;height:84px;flex-shrink:0;position:relative}.bb-ring{position:absolute;inset:0}',
      '.bb-pic{position:absolute;inset:9px;border-radius:50%;background:var(--hov);overflow:hidden;display:block}',
      '.bb-pic img{width:100%;height:100%;object-fit:cover;display:block}.bb-pic img.off{display:none}',
      '.bb-pic88{position:relative;inset:auto;width:88px;height:88px;flex-shrink:0;border-radius:var(--radius)}',
      '.bb-info{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:4px}',
      '.bb-l1,.bb-l2{display:flex;justify-content:space-between;align-items:baseline;gap:8px}.bb-l2{font-size:var(--fs-small);color:var(--muted)}',
      '.bb-l1 .bb-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.bb-big{font-weight:600;font-size:18px;white-space:nowrap;font-variant-numeric:tabular-nums}',
      '.bb-vw{display:inline-flex;align-items:center;gap:4px;color:var(--ink);font-weight:500;white-space:nowrap}',
      '.bb-star{flex-shrink:0;fill:var(--ljr-2);stroke:var(--ljr-2);stroke-width:1.5;stroke-linejoin:round;vertical-align:-2px;margin-right:4px}',
      '.bb-infobox summary{cursor:pointer;display:flex;align-items:center;gap:8px;min-height:44px}.bb-strong{font-weight:500}',
      '.bb-infobd{display:flex;gap:12px;align-items:center;margin:8px 0}',
      '.bb-chips{display:flex;flex-wrap:wrap;gap:6px}.bb-tag{border:1px solid var(--line);border-radius:var(--radius);padding:2px 10px;font-size:var(--fs-small)}',
      '.bb-vbox{position:relative;display:flex;flex-direction:column;gap:10px;border-left:3px solid var(--v,var(--line))}',
      '.bb-vtop{display:flex;justify-content:space-between;align-items:center;gap:12px}.bb-vl{display:flex;align-items:center;gap:10px}',
      '.bb-vword{font-size:18px;font-weight:600}.bb-vr{text-align:right}.bb-huge{font-size:28px;font-weight:600;line-height:1}',
      '.bb-barw{position:relative;height:10px}.bb-bar{display:flex;height:10px;border:1px solid var(--line);box-sizing:border-box;background:var(--hov);border-radius:var(--radius);overflow:hidden}',
      '.bb-tp{background:repeating-linear-gradient(45deg,var(--c) 0 2px,transparent 2px 6px);opacity:.6}',
      '.bb-tmark{position:absolute;top:-4px;bottom:-4px;width:2px;margin-left:-1px;background:var(--ink)}',
      '.bb-three{display:flex;justify-content:space-between;gap:8px;font-size:var(--fs-small);color:var(--muted)}',
      '.bb-vbox .bb-why{margin:0;color:var(--ink)}',
      '.bb-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:0 0 12px}',
      '.bb-tab{font:inherit;font-size:var(--fs-small);color:var(--muted);background:transparent;border:1px solid var(--line);border-radius:var(--radius);min-height:44px;display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer}',
      '.bb-tab:hover,.bb-tab:active{background:var(--hov)}.bb-tab[aria-current=page]{color:var(--ink);font-weight:600;background:var(--hov)}.bb-tab:focus-visible{border-color:var(--ink);outline:none}',
      '.bb-h{margin:0 0 4px;font-weight:600}',
      '.bb-month{margin:12px 0}.bb-mhead{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}',
      '.bb-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px;text-align:center}.bb-wd{font-size:var(--fs-small);color:var(--muted)}',
      '.bb-day{position:relative;min-height:36px;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:var(--radius)}',
      '.bb-day i{width:6px;height:6px;border-radius:50%;background:var(--ljr-6);margin-top:2px}.bb-today{border:1px solid var(--ink)}',
      '.bb-calrow .bb-name{white-space:normal}',
      '.bb-arch{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}',
      '.bb-sec{border-top:1px solid var(--line);padding:10px 12px 12px;display:flex;flex-direction:column;gap:8px}',
      '.bb-sec .bb-sechd{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;width:100%;min-height:44px;padding:6px 8px;margin:0;border:1px solid var(--line);text-align:left}',
      '.bb-logo{flex:none;width:32px;height:32px}.bb-sect{font-weight:600;font-size:var(--fs-body)}.bb-secpts{margin-left:auto;white-space:nowrap}',
      '.bb-secbar{display:flex;flex-direction:column;gap:4px}.bb-secbar .bb-bar span{display:block;height:100%}',
      '.bb-gates{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}',
      '.bb-gates li{display:flex;align-items:center;gap:8px;min-height:32px;border-top:1px solid var(--line);font-size:var(--fs-small)}.bb-gates li:first-child{border-top:0}',
      '.bb-gl{flex:1;min-width:0}.bb-gw{color:var(--muted)}.bb-gates li[data-gate=fail] .bb-gw{color:var(--ljr-2-text)}'
    ].join('') + (Dna ? Dna.css() : '');
    document.head.appendChild(s);
  }

  /** The whole page. v = { T, today, esc } */
  function page(v) {
    last = v; css();
    return '<h2>Breed Better <span class="bb-v bb-test" title="Trial scores, not yet signed off">Testing</span></h2><div id="bbRoot">' + inner(v) + '</div>';
  }

  /** The score on a dog card. Empty when that animal is not enrolled. */
  function chip(v, id) {
    last = v; css();
    var r = compute(v).byId[id];
    if (!r) return '';
    return '<button type="button" class="bb-chip" data-go="breed" data-bb-dog="' + v.esc(id) + '" aria-label="Breed Better score, testing: trial scores, not yet signed off">' + pill(r) + '<span class="bb-pts">' + total(r) + '</span><span class="bb-v bb-test" title="Trial scores, not yet signed off">Testing</span></button>';
  }

  /* The Breed Better logo, as drawn in Lisa's mock-up (12 Nov 2026). No logo file is in the repo, so the mock-up's own SVG is used. */
  // the logo file sits beside this script (bb-logo.svg, drawn from the mock-up's own SVG: no logo file existed)
  var LOGO_SRC = (function () { try { var c = document.currentScript && document.currentScript.src; return c ? c.replace(/[^/]*$/, '') + 'bb-logo.svg' : 'bb-logo.svg'; } catch (e) { return 'bb-logo.svg'; } }());
  var LOGO = '<img class="bb-logo" src="' + LOGO_SRC + '" width="32" height="32" alt="Breed Better logo">';
  var GATE_WORD = { pass: 'Passed', fail: 'Failed', unverified: 'Missing' };
  var GATE_ICON = { pass: ICON.pass, fail: ICON.fail, unverified: 'M12 8v5 M12 16h.01 M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0' };

  /** The Breed Better section on a dog card (Lisa, 12 Nov 2026): logo heading, verdict and Testing badges, score bar
   *  against the target, the must-pass checks one per line, and a tap through to the dog's Breed Better page. */
  function section(v, id) {
    last = v; css();
    var r = compute(v).byId[id];
    if (!r) return '';
    var esc = v.esc, all = r.points_available || 0, hasT = r.target !== '' && r.target !== undefined;
    var pc = all ? Math.min(100, 100 * r.points_earned / all) : 0, tp = hasT && all ? Math.min(100, 100 * r.target / all) : null;
    var gates = r.lines.filter(function (l) { return l.kind === 'gate'; });
    return '<section class="bb-sec" data-k="bb" aria-label="Breed Better">'
      + '<button type="button" class="bb-chip bb-sechd" data-go="breed" data-bb-dog="' + esc(id) + '" aria-label="Breed Better: ' + esc(r.words[verdictOf(r)]) + ', ' + esc(total(r)) + '. Testing: trial scores, not yet signed off. Open the detail">'
      + LOGO + '<span class="bb-sect">Breed Better</span>' + pill(r) + '<span class="bb-v bb-test" title="Trial scores, not yet signed off">Testing</span>'
      + '<span class="bb-pts bb-secpts">' + total(r) + '</span>' + ic('M9 6l6 6l-6 6', 16) + '</button>'
      + (all ? '<div class="bb-secbar"><div class="bb-barw"><div class="bb-bar" role="img" aria-label="' + r.points_earned + ' of ' + all + ' points' + (hasT ? ', target ' + r.target : '') + '">'
        + '<span style="width:' + pc.toFixed(1) + '%;background:var(' + VTEXT[verdictOf(r)] + ')"></span></div>'
        + (tp !== null ? '<span class="bb-tmark" style="left:' + tp.toFixed(1) + '%" title="Target ' + r.target + '"></span>' : '') + '</div>'
        + '<div class="bb-three"><span>' + r.points_earned + ' of ' + all + '</span>' + (hasT ? '<span>target ' + r.target + ' (' + Math.round(tp) + '%)</span>' : '') + '</div></div>' : '')
      + (gates.length ? '<ul class="bb-gates">' + gates.map(function (l) {
        var o = l.gate_outcome || 'unverified';
        return '<li data-gate="' + esc(o) + '">' + ic(GATE_ICON[o] || GATE_ICON.unverified, 16, 'var(' + (VTEXT[o] || '--muted') + ')')
          + '<span class="bb-gl">' + esc(l.label_then) + '</span><span class="bb-gw">' + (GATE_WORD[o] || o) + '</span></li>';
      }).join('') + '</ul>' : '')
      + '</section>';
  }

  /* typing or a new sort redraws the rows only, so the search box keeps focus */
  /* the hub loads the photos after each draw */
  function after() { if (last && typeof last.after === 'function') last.after(); }
  function redrawRows() { var el = document.getElementById('bbList'); if (el && last && memo) { el.innerHTML = rowsHtml(last, memo); after(); } }
  function redraw() { var el = document.getElementById('bbRoot'); if (el && last) { el.innerHTML = inner(last); after(); } }

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
      if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-bb-calc-test')) { state.calc = { code: e.target.value }; redraw(); }
    });
    /* capture, so the chosen dog is set before the hub's own click handler opens the page */
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-bb-dog],[data-bb-filter],[data-bb-open],[data-bb-back],[data-bb-tab],[data-bb-sex],[data-bb-cal],[data-bb-month],[data-bb-calc]');
      if (!b) return;
      if (b.hasAttribute('data-bb-dog')) { state.dog = b.getAttribute('data-bb-dog'); return; }
      if (b.hasAttribute('data-bb-filter')) state.filter = b.getAttribute('data-bb-filter');
      if (b.hasAttribute('data-bb-open')) state.dog = b.getAttribute('data-bb-open');
      if (b.hasAttribute('data-bb-back')) state.dog = '';
      if (b.hasAttribute('data-bb-tab')) { state.tab = b.getAttribute('data-bb-tab'); state.dog = ''; }
      if (b.hasAttribute('data-bb-sex')) state.sex = b.getAttribute('data-bb-sex');
      if (b.hasAttribute('data-bb-cal')) state.cal = b.getAttribute('data-bb-cal');
      if (b.hasAttribute('data-bb-calc')) { var cv = b.getAttribute('data-bb-calc').split(':'); state.calc[cv[0]] = Number(cv[1]); }
      if (b.hasAttribute('data-bb-month')) { state.month = b.getAttribute('data-bb-month'); state.cal = 'all'; }
      redraw();
    }, true);
  }

  /** Open one animal's page next time the page is drawn: the hub's #/breed/<id> address. */
  function open(id) { state.dog = t(id); }
  function setTab(k) { state.tab = k; state.dog = ''; }

  return { FILES: FILES, compute: compute, page: page, chip: chip, section: section, open: open, setTab: setTab, age: age, bandStats: bandStats, day: day, lineHtml: lineHtml, wordsFor: wordsFor, SORTS: SORTS, sortRows: function (rows, k) { return rows.slice().sort(SORT_FN[k] || SORT_FN.verdict); } };
}));
