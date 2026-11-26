var EDIT_ = {
  PROP: 'RECORD_EDIT_ON',
  PERMISSION_FILE: 'BLD-permission.csv',
  AUDIT_FILE: 'BLD-audit_log.csv',
  AUDIT_COLS: ['id', 'tenant_id', 'at', 'person_id', 'sign_in_id', 'device_id', 'action', 'table_name', 'record_id', 'before', 'after', 'reason'],
  DEFAULT: { edit: ['USER'], archive: ['USER'], delete: [], edit_unlogged: [] }
};

function editOn_() { return prop_(EDIT_.PROP) === 'true'; }

function editFiles_() { return [EDIT_.AUDIT_FILE]; }

function editCan_(who, table, action, day) {
  var f = store_read_(EDIT_.PERMISSION_FILE, false), tenant = prop_(BLD.PROP.TENANT_ID);
  var person = null, role = null;
  if (f) f.records.forEach(function (r) {
    if (tenant && r.tenant_id && r.tenant_id !== tenant) return;
    if (String(r.action || '').trim() !== action) return;
    var t = String(r.table_name || '').trim();
    if (t !== table && t !== '*') return;
    var from = String(r.from_date || '').trim(), to = String(r.to_date || '').trim();
    if ((from && (!isRealDate_(from) || from > day)) || (to && (!isRealDate_(to) || to < day))) return;
    var yes = String(r.allowed || '').trim().toLowerCase() === 'yes';
    var pid = String(r.person_id || '').trim(), rc = String(r.role_code || '').trim().toUpperCase();
    if (pid) { if (who.id && pid === who.id) person = person === false ? false : yes; return; }
    if (rc && rc === who.role) role = role === false ? false : yes;
  });
  if (person !== null) return person;
  if (role !== null) return role;
  return (EDIT_.DEFAULT[action] || []).indexOf(who.role) >= 0;
}

function editRule_(name, table, day) {
  return (fileRule_(name + '.' + table, day) || fileRule_(name, day)).toLowerCase();
}

function editStart_(req, action) {
  if (!editOn_()) throw err_('EDIT_OFF', 'Changing saved entries is switched off.');
  if (!saveEnabled_()) throw err_('SAVE_OFF', 'Saving is switched off.');
  var who = authSaver_(req);
  if (who.role === ROLE_INSPECTOR || who.role === ROLE_GUEST) throw err_('NOT_ALLOWED', 'This code can only look.');
  var spec = specFor_(String(req.table || ''));
  if (!spec || spec.file === BLD.PENDING_FILE || spec.userEditable !== true) throw err_('FILE_NOT_ALLOWED', 'That file is not one the save system is allowed to change.');
  if (!tableOn_(spec)) throw err_('TABLE_OFF', 'Saving to ' + spec.file + ' is switched off.');
  var now = new Date(), day = todayLondon_(now), tenant = prop_(BLD.PROP.TENANT_ID);
  if (!tenant) throw err_('NOT_CONFIGURED', 'The tenant id has not been set up in the script (TENANT_ID).');
  if (!editCan_(who, spec.key, action, day)) throw err_('NOT_ALLOWED', 'You are not allowed to do this. Ask the user.');
  var rowId = String(req.record_id || '');
  if (!ID_RE_.test(rowId)) throw err_('INVALID', 'Say which entry.');
  return { who: who, spec: spec, tenant: tenant, now: now, day: day, rowId: rowId };
}

function editFind_(s) {
  var t = store_read_(s.spec.file, true);
  if (!sameHeader_(t.header, s.spec.columns)) throw err_('HEADER_MISMATCH', s.spec.file + ' does not have the columns the save system expects, so nothing was changed.');
  for (var i = 0; i < t.records.length; i++) if (t.records[i].id === s.rowId && t.records[i].tenant_id === s.tenant) return { t: t, idx: i, cur: t.records[i] };
  throw err_('NOT_FOUND', 'That entry was not found in ' + s.spec.file + '.');
}

function editReason_(req, need, errors) {
  var reason = String(req.reason || '').trim();
  if (!reason && !need) return '';
  if (reason.length < 3 || reason.length > BLD.LIMITS.MAX_TEXT_CHARS || CONTROL_RE_.test(reason)) errors.reason = 'Say briefly why (3 to 500 characters, one line).';
  return reason;
}
function editStop_(errors) { if (Object.keys(errors).length) throw err_('INVALID', 'Some details need fixing before this can be saved.', { fields: errors }); }

function editAuditRead_() {
  var a = store_read_(EDIT_.AUDIT_FILE, false);
  if (!a) throw err_('NOT_CONFIGURED', 'The change log (' + EDIT_.AUDIT_FILE + ') does not exist yet, so nothing was changed.');
  if (!sameHeader_(a.header, EDIT_.AUDIT_COLS)) throw err_('HEADER_MISMATCH', EDIT_.AUDIT_FILE + ' does not have the columns the save system expects, so nothing was changed.');
  return a;
}

function editAudit_(s, a, action, before, after, reason) {
  var ids = {}; a.records.forEach(function (r) { ids[r.id] = 1; });
  var id = newId_('aud', s.now); while (ids[id]) id = newId_('aud', s.now);
  store_append_(EDIT_.AUDIT_FILE, EDIT_.AUDIT_COLS, rowValues_(EDIT_.AUDIT_COLS, {
    id: id, tenant_id: s.tenant, at: s.now.toISOString(), person_id: s.who.id || '', sign_in_id: '', device_id: '',
    action: action, table_name: s.spec.key, record_id: s.rowId,
    before: before ? JSON.stringify(before) : '', after: after ? JSON.stringify(after) : '', reason: reason || ''
  }), a);
  return id;
}

function editWriteLogged_(s, f, next, a, action, before, after, reason) {
  store_replaceRow_(s.spec.file, s.spec.columns, f.idx, rowValues_(s.spec.columns, next), f.t);
  if (!a) return '';
  try { return editAudit_(s, a, action, before, after, reason); }
  catch (e) {
    try { store_replaceRow_(s.spec.file, s.spec.columns, f.idx, rowValues_(s.spec.columns, f.cur), store_read_(s.spec.file, true)); }
    catch (x) { throw err_('VERIFY_FAILED', 'The change was made but could not be logged, and putting the old values back could not be confirmed. Tell the user now.', { file: s.spec.file }); }
    throw e;
  }
}

function sinkRecordEdit_(req) {
  var s = editStart_(req, 'edit');
  return withLock_(function () {
    var f = editFind_(s), defs = userEditDefs_(s.spec), fields = req.fields && typeof req.fields === 'object' ? req.fields : {};
    var errors = {}, changedDefs = {}, changedVals = {}, name;
    for (name in fields) {
      if (!Object.prototype.hasOwnProperty.call(fields, name)) continue;
      if (!Object.prototype.hasOwnProperty.call(defs, name)) { errors[name] = 'This field cannot be changed here.'; continue; }
      var want = fields[name] === null || fields[name] === undefined ? '' : String(fields[name]).trim();
      if (want === String(f.cur[name] || '')) continue;
      changedDefs[name] = defs[name]; changedVals[name] = want;
    }
    var lookups = store_lookups_({ lookups: s.spec.lookups }, s.tenant);
    var v = validateInput_({ input: changedDefs, checkRow: null }, changedVals, lookups, s.now.getTime());
    for (name in v.errors) if (Object.prototype.hasOwnProperty.call(v.errors, name)) errors[name] = v.errors[name];
    var next = {}, before = {}, after = {}, changed = [];
    for (name in f.cur) if (Object.prototype.hasOwnProperty.call(f.cur, name)) next[name] = f.cur[name];
    for (name in v.clean) {
      if (!Object.prototype.hasOwnProperty.call(v.clean, name) || !changedDefs[name] || v.clean[name] === String(f.cur[name] || '')) continue;
      before[name] = String(f.cur[name] || ''); after[name] = v.clean[name]; next[name] = v.clean[name]; changed.push(name);
    }
    if (s.spec.checkRow) s.spec.checkRow(next, errors, lookups);
    var reason = editReason_(req, editRule_('edit.reason_required', s.spec.key, s.day) === 'yes', errors);
    editStop_(errors);
    if (!changed.length) throw err_('NOTHING_CHANGED', 'Nothing was different from what is already there, so nothing was changed.');
    var logged = editRule_('edit.log', s.spec.key, s.day) !== 'no';
    if (req.unlogged === true) {
      if (!editCan_(s.who, s.spec.key, 'edit_unlogged', s.day)) throw err_('NOT_ALLOWED', 'You are not allowed to change an entry without it being logged.');
      logged = false;
    }
    var a = logged ? editAuditRead_() : null;
    var aid = editWriteLogged_(s, f, next, a, 'edit', before, after, reason);
    return { status: 'edited', table: s.spec.key, id: s.rowId, changed: changed, logged: logged, audit_id: aid, who: s.who.who };
  });
}

function sinkRecordArchive_(req) {
  var s = editStart_(req, 'archive');
  if (s.spec.columns.indexOf('to_date') < 0) throw err_('ARCHIVE_NOT_SUPPORTED', 'This list has no end date, so an entry cannot be archived.');
  return withLock_(function () {
    var f = editFind_(s), to = String(req.to_date || '').trim() || s.day;
    if (!isRealDate_(to)) throw err_('INVALID', 'Some details need fixing before this can be saved.', { fields: { to_date: 'Use a real date.' } });
    if (f.cur.from_date && to < String(f.cur.from_date)) throw err_('INVALID', 'Some details need fixing before this can be saved.', { fields: { to_date: 'The end date cannot be before the start date.' } });
    if (String(f.cur.to_date || '') && String(f.cur.to_date) <= to) throw err_('NOTHING_CHANGED', 'That entry has already ended.');
    var errors = {}, reason = editReason_(req, false, errors), next = {}, k;
    editStop_(errors);
    for (k in f.cur) if (Object.prototype.hasOwnProperty.call(f.cur, k)) next[k] = f.cur[k];
    next.to_date = to;
    var aid = editWriteLogged_(s, f, next, editAuditRead_(), 'archive', { to_date: String(f.cur.to_date || '') }, { to_date: to }, reason);
    return { status: 'archived', table: s.spec.key, id: s.rowId, to_date: to, audit_id: aid, who: s.who.who };
  });
}

function sinkRecordDelete_(req) {
  var s = editStart_(req, 'delete'), errors = {};
  var reason = editReason_(req, true, errors);
  editStop_(errors);
  return withLock_(function () {
    var f = editFind_(s);
    editRetentionCheck_(s, f.cur);
    var a = editAuditRead_(), last = {}, k;
    for (k in f.cur) if (Object.prototype.hasOwnProperty.call(f.cur, k) && k !== 'tenant_id') last[k] = f.cur[k];
    var aid = editAudit_(s, a, 'delete', last, null, reason);
    store_removeRow_(s.spec.file, s.spec.columns, f.idx, f.t);
    return { status: 'deleted', table: s.spec.key, id: s.rowId, audit_id: aid, who: s.who.who };
  });
}

function editRetentionCheck_(s, row) {
  var section = s.spec.retentionSection || (s.spec.ageCap && s.spec.ageCap.retentionSection) || s.spec.key;
  var cols = [(s.spec.ageCap || {}).field, 'taken_at', 'period_start', 'performed_on', 'given_on', 'from_date', 'set_on', 'created_at'];
  var own = '';
  for (var i = 0; i < cols.length && !own; i++) {
    var v = cols[i] ? String(row[cols[i]] || '').slice(0, 10) : '';
    if (isRealDate_(v)) own = v;
  }
  if (!own) throw err_('KEPT', 'This entry has no date of its own, so it is kept. Archive it instead.');
  var years = retentionYears_(section, s.tenant, own);
  var until = (parseInt(own.slice(0, 4), 10) + years) + own.slice(4);
  if (s.day < until) throw err_('KEPT', 'This entry is kept until ' + until + ' (' + years + ' years). Archive it instead.', { kept_until: until });
}

function store_removeRow_(title, expectedHeader, index, read) {
  if (allowedFiles_().indexOf(title) < 0 || title === BLD.PENDING_FILE || title === EDIT_.AUDIT_FILE) throw err_('FILE_NOT_ALLOWED', 'That file is not one the save system is allowed to change.');
  if (!sameHeader_(read.header, expectedHeader)) throw err_('HEADER_MISMATCH', title + ' does not have the columns the save system expects, so nothing was changed.');
  if (index < 0 || index >= read.records.length) throw err_('UNEXPECTED_LAYOUT', title + ' is laid out in a way the delete cannot handle safely, so nothing was changed.');
  if (read.kind === 'sheet') {
    var sh = read.tab;
    if (textHash_(store_rowsText_(store_sheetRows_(sh).rows)) !== textHash_(read.text)) throw err_('CHANGED_DURING_WRITE', title + ' changed while saving. Nothing was changed. Try again.');
    var rows = csvRecordsRows_(read); rows.splice(index + 1, 1);
    sh.deleteRow(read.rowNums[index + 1]);
    SpreadsheetApp.flush();
    if (textHash_(store_rowsText_(store_sheetRows_(sh).rows)) !== textHash_(store_rowsText_(rows))) {
      throw err_('VERIFY_FAILED', 'The table did not read back as expected after the delete. Tell the user now; the earlier version is in the Sheet\'s version history.', { file: title });
    }
    return store_rowsText_(rows);
  }
  var file = read.file, before = read.text, beforeHash = textHash_(before);
  if (textHash_(file.getBlob().getDataAsString('UTF-8')) !== beforeHash) throw err_('CHANGED_DURING_WRITE', title + ' changed while saving. Nothing was changed. Try again.');
  var spans = csvSpans_(before);
  if (spans.length !== read.records.length + 1) throw err_('UNEXPECTED_LAYOUT', title + ' is laid out in a way the delete cannot handle safely, so nothing was changed.');
  var sp = spans[index + 1], head = before.slice(0, sp.start), tail = before.slice(sp.next);
  return store_commit_(file, title, before, beforeHash, head + tail, function (check) {
    return check.slice(0, head.length) === head && check.slice(check.length - tail.length) === tail;
  });
}

