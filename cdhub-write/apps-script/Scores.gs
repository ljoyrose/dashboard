/**
 * Saved dated scores (15 Nov 2026, DRAFT names from Breed Better THE-DOCUMENT Stage 4; gate PENDING; OV11 for Lisa).
 *
 *   action 'score_save'  keeps what the Breed Better page worked out for ONE animal on ONE date: one
 *                        BLD-score_assessment row and one BLD-score_line row per line, in the same save.
 *
 * Scores are still worked out when the page loads; a saved score is the record of what it said then, so a later
 * rule or record change never rewrites the past. Nothing is edited or deleted: saving again for the same animal and
 * scheme adds a new assessment whose replaces_id points at the one before.
 * Owner only. Both files need their headers (made by Lisa); the switch TABLE_ON_score_assessment covers both and is
 * OFF until Lisa says go. Rows follow STANDARD S4 as far as the draft names allow: _at UTC, _by paired.
 */
var SCORES_ = {
  on: 'score_assessment',
  file: 'BLD-score_assessment.csv', idPrefix: 'sca',
  need: ['id', 'tenant_id', 'subject_id', 'scheme_id', 'period', 'verdict', 'points_earned', 'points_available',
    'points_unverified', 'unknown_count', 'status', 'calculated_at', 'calculated_by', 'replaces_id'],
  lineFile: 'BLD-score_line.csv', lineIdPrefix: 'scl',
  lineNeed: ['id', 'tenant_id', 'assessment_id', 'criterion_id', 'label_then', 'evidence_table', 'evidence_record_id',
    'answer_then', 'points', 'points_max', 'gate_outcome', 'unknown_reason', 'judged_at', 'judged_by', 'rule_version_then'],
  verdicts: ['pass', 'below_target', 'unverified', 'fail'],
  outcomes: ['', 'pass', 'fail', 'unverified'],
  maxLines: 200
};

function scoresOn_() { return prop_(BLD.PROP.TABLE_ON_PREFIX + SCORES_.on) === 'true'; }
function scoresFiles_() { return scoresOn_() ? [SCORES_.file, SCORES_.lineFile] : []; }

function scoreNum_(v, field, errors, blankOk) {
  var s = String(v == null ? '' : v).trim();
  if (s === '' && blankOk) return '';
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(s)) { errors[field] = 'Use a number.'; return ''; }
  return s;
}

function sinkScoreSave_(req) {
  if (!saveEnabled_()) throw err_('SAVE_OFF', 'Saving is switched off.');
  if (!req || typeof req !== 'object') throw err_('BAD_REQUEST', 'That request was not understood.');
  if (!scoresOn_()) throw err_('TABLE_OFF', 'Saving to ' + SCORES_.file + ' is switched off.');
  var rid = String(req.request_id || '');
  if (!/^[A-Za-z0-9_\-]{8,64}$/.test(rid)) throw err_('BAD_REQUEST', 'The request had no valid reference.');
  var who = authStaff_(req.code);
  if (who.role !== 'OWNER') throw err_('NOT_ALLOWED', 'Only the owner can save a score.');
  var cache = CacheService.getScriptCache(), cached = cache.get('rid:' + rid);
  if (cached) { var again = JSON.parse(cached); again.repeat = true; return again; }
  var f = req.fields && typeof req.fields === 'object' ? req.fields : {};
  var result = withLock_(function () { return scoreSaveNow_(f, who, new Date()); });
  cache.put('rid:' + rid, JSON.stringify(result), BLD.LIMITS.REQUEST_CACHE_SEC);
  return result;
}

function scoreSaveNow_(f, who, now) {
  var errors = {}, tenant = prop_(BLD.PROP.TENANT_ID);
  var sid = String(f.subject_id || '').trim(), scheme = String(f.scheme_id || '').trim(), period = String(f.period || '').trim();
  var verdict = String(f.verdict || '').trim();
  if (!ID_RE_.test(sid)) errors.subject_id = 'Say which animal this is for.';
  if (!ID_RE_.test(scheme)) errors.scheme_id = 'Say which scheme this is.';
  if (!isRealDate_(period)) errors.period = 'Use a real date as YYYY-MM-DD.';
  else if (period > todayLondon_(now)) errors.period = 'A score cannot be saved for a future date.';
  if (SCORES_.verdicts.indexOf(verdict) < 0) errors.verdict = 'Use pass, below_target, unverified or fail.';
  var head = {
    points_earned: scoreNum_(f.points_earned, 'points_earned', errors),
    points_available: scoreNum_(f.points_available, 'points_available', errors),
    points_unverified: scoreNum_(f.points_unverified, 'points_unverified', errors, true),
    unknown_count: scoreNum_(f.unknown_count, 'unknown_count', errors, true)
  };
  var lines = Array.isArray(f.lines) ? f.lines : null;
  if (!lines || !lines.length) errors.lines = 'A score needs its lines.';
  else if (lines.length > SCORES_.maxLines) errors.lines = 'Too many lines in one score.';
  var clean = (lines || []).slice(0, SCORES_.maxLines).map(function (l, i) {
    l = l && typeof l === 'object' ? l : {};
    var e = {}, o = {
      criterion_id: String(l.criterion_id || '').trim(),
      label_then: dogcardText_(l.label_then, 'label_then', e, 200),
      evidence_table: String(l.evidence_table || '').trim(),
      evidence_record_id: String(l.evidence_record_id || '').trim(),
      answer_then: dogcardText_(l.answer_then, 'answer_then', e, 200),
      points: scoreNum_(l.points, 'points', e, true),
      points_max: scoreNum_(l.points_max, 'points_max', e, true),
      gate_outcome: String(l.gate_outcome || '').trim(),
      unknown_reason: String(l.unknown_reason || '').trim(),
      judged_at: String(l.judged_at || '').trim(),
      judged_by: dogcardText_(l.judged_by, 'judged_by', e, 100),
      rule_version_then: String(l.rule_version_then || '').trim()
    };
    if (!ID_RE_.test(o.criterion_id)) e.criterion_id = 'Each line needs its check.';
    if (o.evidence_table && !LINK_TABLE_RE_.test(o.evidence_table)) e.evidence_table = 'Not a list name.';
    if (o.evidence_record_id && !ID_RE_.test(o.evidence_record_id)) e.evidence_record_id = 'Not a record id.';
    if (SCORES_.outcomes.indexOf(o.gate_outcome) < 0) e.gate_outcome = 'Use pass, fail or unverified.';
    if (o.unknown_reason && !/^[a-z_]{1,40}$/.test(o.unknown_reason)) e.unknown_reason = 'Not a reason code.';
    if (o.judged_at && !isRealDate_(o.judged_at.slice(0, 10))) e.judged_at = 'Use a real date.';
    if (o.rule_version_then && !ID_RE_.test(o.rule_version_then)) e.rule_version_then = 'Not a rule id.';
    Object.keys(e).forEach(function (k) { errors['lines.' + i + '.' + k] = e[k]; });
    return o;
  });
  if (Object.keys(errors).length) throw err_('INVALID', 'Please check the highlighted fields.', { fields: errors });
  if (!linkRecordExists_('subject', sid)) throw err_('NOT_FOUND', 'That animal was not found, so nothing was saved.');
  if (!linkRecordExists_('score_scheme', scheme)) throw err_('NOT_FOUND', 'That scheme was not found, so nothing was saved.');

  var read = store_read_(SCORES_.file, true), lread = store_read_(SCORES_.lineFile, true);
  dogcardHeader_(read, SCORES_.need, SCORES_.file);
  dogcardHeader_(lread, SCORES_.lineNeed, SCORES_.lineFile);
  var mine = function (r) { return !tenant || !r.tenant_id || r.tenant_id === tenant; };
  var before = read.records.filter(function (r) { return mine(r) && r.subject_id === sid && r.scheme_id === scheme; })
    .sort(function (a, b) { return String(a.calculated_at).localeCompare(String(b.calculated_at)); }).pop();
  var stamp = new Date(now.getTime()).toISOString().replace(/\.\d{3}Z$/, 'Z');
  var ids = {}; read.records.forEach(function (r) { ids[r.id] = 1; });
  var id = newId_(SCORES_.idPrefix, now);
  while (ids[id]) id = newId_(SCORES_.idPrefix, now);
  var a = { id: id, tenant_id: tenant, subject_id: sid, scheme_id: scheme, period: period, verdict: verdict,
    points_earned: head.points_earned, points_available: head.points_available, points_unverified: head.points_unverified,
    unknown_count: head.unknown_count, status: 'saved', calculated_at: stamp, calculated_by: who.id || who.who,
    replaces_id: before ? before.id : '' };
  // lines first: an assessment row only ever exists with its lines
  var lids = {}; lread.records.forEach(function (r) { lids[r.id] = 1; });
  clean.forEach(function (o, i) {
    var lid = SCORES_.lineIdPrefix + '-' + id.slice(SCORES_.idPrefix.length + 1) + '-' + (i + 1);
    while (lids[lid]) lid += 'x';
    lids[lid] = 1;
    var v = Object.assign({ id: lid, tenant_id: tenant, assessment_id: id }, o);
    store_append_(SCORES_.lineFile, lread.header, lread.header.map(function (h) { return v[h] == null ? '' : String(v[h]); }), lread);
    lread = store_read_(SCORES_.lineFile, true);
  });
  store_append_(SCORES_.file, read.header, read.header.map(function (h) { return a[h] == null ? '' : String(a[h]); }), read);
  return { status: 'saved', id: id, lines: clean.length, replaces_id: a.replaces_id, at: stamp };
}
