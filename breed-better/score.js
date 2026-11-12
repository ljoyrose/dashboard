/**
 * Breed Better calculator. Rows in, one result out.
 *
 * It knows nothing about any species, breed, test or Google Sheet. Every gate, band, point and word
 * is a row the user enters. It reads no clock: the date to judge on is passed in, so an old score can
 * always be worked out again by the rules in force on its own date.
 *
 * Works in a browser (window.BreedBetterScore) and in Node (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BreedBetterScore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* skip: no record means the line does not apply (a maiden has no last litter); never a pass, it just leaves the total */
  var WHEN_MISSING = ['unknown', 'zero', 'fail', 'skip'];
  var READS = ['latest', 'lowest', 'count'];
  var OUTCOMES = ['pass', 'fail', 'unverified'];
  var TARGET_IS = ['points', 'percent'];
  var JUDGED = 'judged';

  function text(v) { return v === undefined || v === null ? '' : String(v).trim(); }
  function same(a, b) { return text(a).toLowerCase() === text(b).toLowerCase(); }
  function isDate(v) { return /^\d{4}-\d{2}-\d{2}$/.test(text(v)); }

  /** Add whole months to YYYY-MM-DD, holding the day inside the shorter month (31 Jan + 1 = 28 Feb). */
  function addMonths(date, months) {
    var p = date.split('-').map(Number);
    var total = p[0] * 12 + (p[1] - 1) + months;
    var y = Math.floor(total / 12), m = total % 12 + 1;
    var last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    var d = Math.min(p[2], last);
    return y + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d;
  }

  function addDays(date, days) {
    var d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  /** The points needed: a number, or a percent of what this animal could earn (rounded up). '' when no target. */
  function targetFor(scheme, available) {
    var n = text(scheme && scheme.target_points);
    if (!/^\d+(\.\d+)?$/.test(n)) return '';
    return /^percent\b/i.test(text(scheme.target_is)) ? Math.ceil(available * Number(n) / 100) : Number(n);
  }

  /** Whole months from a to b (both YYYY-MM-DD). */
  function monthsBetween(a, b) {
    var p = a.split('-').map(Number), q = b.split('-').map(Number);
    return (q[0] - p[0]) * 12 + (q[1] - p[1]) - (q[2] < p[2] ? 1 : 0);
  }

  /** "0-11:0.5" (months at the record date : share of the points), pairs joined by ';'. null when not understood. */
  function parseAgeWeight(spec) {
    if (!text(spec)) return [];
    var out = [];
    var ok = text(spec).split(';').every(function (pair) {
      var m = /^\s*(\d+)-(\d+)\s*:\s*(\d+(?:\.\d+)?)\s*$/.exec(pair);
      if (!m || Number(m[3]) > 1) return false;
      out.push({ from: Number(m[1]), to: Number(m[2]), weight: Number(m[3]) });
      return true;
    });
    return ok ? out : null;
  }

  /** Parse an answer rule. Fixed forms only; returns null when the rule is not one of them. */
  function parseMatch(rule) {
    var r = text(rule), m;
    if (r === 'any') return { type: 'any' };
    if ((m = /^is:(.+)$/.exec(r))) return { type: 'is', value: m[1].trim() };
    if ((m = /^in:(.+)$/.exec(r))) return { type: 'in', values: m[1].split('|').map(text) };
    if ((m = /^range:(-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)$/.exec(r))) return { type: 'range', low: Number(m[1]), high: Number(m[2]) };
    return null;
  }

  function matches(parsed, answer) {
    if (!parsed) return false;
    if (parsed.type === 'any') return true;
    if (parsed.type === 'is') return same(parsed.value, answer);
    if (parsed.type === 'in') return parsed.values.some(function (v) { return same(v, answer); });
    if (text(answer) === '' || isNaN(Number(answer))) return false;
    return Number(answer) >= parsed.low && Number(answer) <= parsed.high;
  }

  /** "field=value" pairs joined by ';'. Blank matches everything. */
  function fieldsMatch(spec, row) {
    if (!text(spec)) return true;
    return text(spec).split(';').every(function (pair) {
      var at = pair.indexOf('=');
      if (at < 1) return false;
      return same(row[pair.slice(0, at).trim()], pair.slice(at + 1));
    });
  }

  function byId(rows, key) { return rows.filter(function (r) { return r[key.field] === key.value; }); }

  /** The active scheme for this animal on this date. A breed's own scheme beats a whole-species one. */
  function pickScheme(schemes, speciesId, breed, asOf) {
    var usable = (schemes || []).filter(function (s) {
      return same(s.status, 'active') && same(s.species_id, speciesId) && isDate(s.effective_from) && s.effective_from <= asOf &&
        (!text(s.breed) || same(s.breed, breed));
    });
    usable.sort(function (a, b) {
      var ab = text(a.breed) ? 1 : 0, bb = text(b.breed) ? 1 : 0;
      if (ab !== bb) return bb - ab;
      if (a.effective_from !== b.effective_from) return a.effective_from < b.effective_from ? 1 : -1;
      return Number(b.version || 0) - Number(a.version || 0);
    });
    return usable[0] || null;
  }

  /** Problems that would make a rule set unsafe. Empty list = fine. */
  function validateScheme(set) {
    var errors = [];
    var bands = {};
    if (set.scheme && text(set.scheme.target_is) && TARGET_IS.indexOf(text(set.scheme.target_is).toLowerCase().split(/\s/)[0]) < 0) errors.push((set.scheme.id || 'scheme') + ': target_is must be points or percent');
    (set.bands || []).forEach(function (b) { bands[b.id] = b; });
    (set.criteria || []).forEach(function (c) {
      var band = bands[c.band_id];
      if (!band) { errors.push(c.id + ': belongs to no band'); return; }
      var when = text(c.when_missing) || 'unknown';
      if (WHEN_MISSING.indexOf(when) < 0) errors.push(c.id + ': when_missing cannot be "' + when + '"');
      if (text(c.reads) && READS.indexOf(text(c.reads)) < 0) errors.push(c.id + ': cannot read "' + c.reads + '"');
      if (text(c.valid_months) && !/^\d+$/.test(text(c.valid_months))) errors.push(c.id + ': valid_months must be a whole number');
      if (text(c.valid_months) && !text(c.date_field)) errors.push(c.id + ': valid_months needs a date_field');
      if (text(c.due_soon_days) && !/^\d+$/.test(text(c.due_soon_days))) errors.push(c.id + ': due_soon_days must be a whole number');
      if (text(c.due_soon_days) && !text(c.valid_months)) errors.push(c.id + ': due_soon_days needs valid_months');
      if (text(c.lapsed_affects_verdict) && !/^(true|false)$/i.test(text(c.lapsed_affects_verdict))) errors.push(c.id + ': lapsed_affects_verdict must be TRUE or FALSE');
      if (parseAgeWeight(c.age_weight) === null) errors.push(c.id + ': age_weight must look like 0-11:0.5 (months:share, share 0 to 1)');
      if (text(c.age_weight) && !text(c.date_field)) errors.push(c.id + ': age_weight needs a date_field');
      var rows = (set.points || []).filter(function (p) { return p.criterion_id === c.id; });
      if (band.kind !== 'status' && !rows.length) errors.push(c.id + ': has no answers');
      rows.forEach(function (p) {
        if (!parseMatch(p.answer_match)) errors.push(p.id + ': answer rule "' + p.answer_match + '" is not understood');
        if (band.kind === 'gate' && OUTCOMES.indexOf(text(p.gate_outcome)) < 0) errors.push(p.id + ': a gate answer needs pass, fail or unverified');
        if (band.kind === 'points' && text(p.gate_outcome) !== 'unverified' && !/^\d+(\.\d+)?$/.test(text(p.points))) errors.push(p.id + ': a points answer needs a number');
      });
    });
    return errors;
  }

  function maxPoints(rows) {
    return rows.reduce(function (m, p) { return Math.max(m, Number(p.points) || 0); }, 0);
  }

  function findRule(rows, answer) {
    for (var i = 0; i < rows.length; i++) if (matches(parseMatch(rows[i].answer_match), answer)) return rows[i];
    return null;
  }

  /** The evidence for one criterion: { rows, answer, row, reason }. reason is set when nothing usable exists. */
  function readEvidence(c, ruleRows, subject, evidence, judgements, asOf) {
    if (c.evidence_source === JUDGED) {
      var j = judgements[c.id];
      if (!j || !text(j.answer)) return { reason: 'not_judged' };
      return { answer: j.answer, row: null, judgedBy: text(j.by) };
    }
    var table = evidence[c.evidence_source];
    if (!table) return { reason: 'no_source' };
    var subjectField = text(c.subject_field) || 'subject_id';
    var dateField = text(c.date_field);
    var found = table.filter(function (r) {
      return r[subjectField] === subject.id && fieldsMatch(c.evidence_match, r) &&
        (!dateField || !isDate(r[dateField]) || r[dateField] <= asOf);
    });
    var reads = text(c.reads) || 'latest';
    /* a count is of things that happened: a row with no date (a mating that took, say, or a blank line) is not one */
    if (reads === 'count' && dateField) found = found.filter(function (r) { return isDate(r[dateField]); });
    if (reads === 'count') return { answer: String(found.length), row: null, count: true };
    if (!found.length) return { reason: 'no_record' };
    var chosen;
    if (reads === 'lowest') {
      chosen = found.slice().sort(function (a, b) {
        var pa = findRule(ruleRows, a[c.answer_field]), pb = findRule(ruleRows, b[c.answer_field]);
        return (pa ? Number(pa.points) || 0 : -1) - (pb ? Number(pb.points) || 0 : -1);
      })[0];
    } else {
      chosen = found.slice().sort(function (a, b) {
        var da = text(a[dateField]), db = text(b[dateField]);
        return da === db ? 0 : (da < db ? 1 : -1);
      })[0];
    }
    var due = '', dueDate = '';
    if (text(c.valid_months)) {
      var when = text(chosen[dateField]);
      if (!isDate(when)) return { reason: 'undated', row: chosen };
      dueDate = addMonths(when, Number(c.valid_months));
      if (dueDate < asOf) {
        due = 'overdue';
        /* a lapse changes the verdict only when the check's row says so; blank means it does */
        if (!/^false$/i.test(text(c.lapsed_affects_verdict))) return { reason: 'expired', row: chosen, due: due, dueDate: dueDate };
      } else if (text(c.due_soon_days) && addDays(asOf, Number(c.due_soon_days)) >= dueDate) due = 'due_soon';
    }
    if (text(chosen[c.answer_field]) === '') return { reason: 'blank_answer', row: chosen, due: due, dueDate: dueDate };
    return { answer: chosen[c.answer_field], row: chosen, due: due, dueDate: dueDate };
  }

  function appliesTo(c, subject) { return !text(c.applies_to) || fieldsMatch(c.applies_to, subject); }

  /**
   * Score one animal.
   * input: { scheme, bands, criteria, points, subject, evidence: {table: rows}, judgements: {criterion_id: {answer, by}}, asOf }
   */
  function score(input) {
    if (!isDate(input.asOf)) throw new Error('asOf must be a date (YYYY-MM-DD)');
    var problems = validateScheme(input);
    if (problems.length) throw new Error('The rules have problems: ' + problems.join('; '));
    var bands = {};
    input.bands.forEach(function (b) { bands[b.id] = b; });
    var evidence = input.evidence || {};
    var judgements = input.judgements || {};
    var lines = [], gates = { pass: 0, fail: 0, unverified: 0 };
    var earned = 0, available = 0, unverified = 0, unknownCount = 0;

    input.criteria.forEach(function (c) {
      var band = bands[c.band_id];
      if (!appliesTo(c, input.subject)) return;
      var ruleRows = byId(input.points || [], { field: 'criterion_id', value: c.id });
      var ev = readEvidence(c, ruleRows, input.subject, evidence, judgements, input.asOf);
      var line = {
        criterion_id: c.id, band_id: c.band_id, kind: band.kind, label_then: c.label,
        evidence_table: c.evidence_source, evidence_id: ev.row ? text(ev.row.id) : '',
        answer_then: ev.answer === undefined ? '' : text(ev.answer),
        date_then: ev.row && text(c.date_field) ? text(ev.row[c.date_field]) : '', due: ev.due || '', due_date: ev.dueDate || '',
        points: '', points_max: '', gate_outcome: '', unknown_reason: ev.reason || '', judged_by: ev.judgedBy || ''
      };

      if (band.kind === 'status') { lines.push(line); return; }

      var rule = ev.reason ? null : findRule(ruleRows, ev.answer);
      if (!ev.reason && !rule) line.unknown_reason = 'no_rule_for_answer';
      var when = text(c.when_missing) || 'unknown';
      if (when === 'skip' && ev.reason === 'no_record') return;

      if (band.kind === 'gate') {
        var outcome;
        if (rule) outcome = rule.gate_outcome;
        else if (ev.reason === 'expired') outcome = 'unverified';
        else if (when === 'fail') outcome = 'fail';
        else outcome = 'unverified';
        line.gate_outcome = outcome;
        gates[outcome]++;
        if (outcome === 'unverified') unknownCount++;
      } else {
        var max = maxPoints(ruleRows);
        line.points_max = max;
        available += max;
        if (rule && text(rule.gate_outcome) === 'unverified') {
          /* the record exists but says nothing that can be scored, such as NOT RECORDED: never 0 */
          line.unknown_reason = 'recorded_unverified';
          unverified += max;
          unknownCount++;
        } else if (rule) {
          line.points = Number(rule.points) || 0;
          /* the breeder's own rule: e.g. an X-ray before 12 months counts for half */
          var aw = parseAgeWeight(c.age_weight);
          if (aw.length && ev.row && isDate(input.subject.dob) && isDate(line.date_then)) {
            line.age_months = monthsBetween(input.subject.dob, line.date_then);
            aw.some(function (w) {
              if (line.age_months < w.from || line.age_months > w.to) return false;
              line.points = Math.round(line.points * w.weight * 10) / 10;
              line.weight = w.weight;
              return true;
            });
          }
          earned += line.points;
        } else if (when === 'zero' || when === 'fail') {
          line.points = 0;
        } else {
          unverified += max;
          unknownCount++;
        }
      }
      lines.push(line);
    });

    var gateResult = gates.fail ? 'fail' : (gates.unverified ? 'unverified' : 'pass');
    var target = targetFor(input.scheme, available);
    /* one verdict: Fail, then Unverified, then the target. Points still unknown that could reach the target keep it Unverified */
    var verdict = gateResult;
    if (verdict === 'pass' && target !== '' && earned < target) verdict = earned + unverified >= target ? 'unverified' : 'below_target';
    return {
      subject_id: input.subject.id, scheme_id: input.scheme.id, as_of: input.asOf,
      gate_result: gateResult, verdict: verdict, target: target, points_earned: earned, points_available: available,
      points_unverified: unverified, unknown_count: unknownCount, lines: lines
    };
  }

  return { score: score, targetFor: targetFor, parseAgeWeight: parseAgeWeight, monthsBetween: monthsBetween, pickScheme: pickScheme, validateScheme: validateScheme, parseMatch: parseMatch, addMonths: addMonths };
});
