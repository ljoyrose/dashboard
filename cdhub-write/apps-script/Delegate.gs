/* ---------------------------------------------------------------------------------------------------------------
 * DELEGATED ADMIN (V9, 13 Nov 2026; Lisa via OV10: giving access is a permission in itself, conferred only by the owner,
 * as dated, limited rows. Design: AA_ACCESS_2026-11-13-1535 "Delegated admin", agreed with ADMIN; holders keyed on code id).
 *
 *   BLD-delegation: one row per conferral. A role never implies a power. parent_id blank = conferred by the owner.
 *   Limits (pipe lists, blank = no wider than the parent; on an owner row blank = no limit): grant_type_ids, max_hours,
 *   rights, lists, fields, area_ids, subject_ids; end_others / extend_others yes or blank.
 *   The ceiling: what a holder may do is the INTERSECTION of their row and every row above it, worked out each time it is
 *   used, so a parent narrowed or ended later also narrows or ends everything under it.
 *
 *   action 'delegation_give'  owner, or a holder re-conferring under their own row (depth_left > 0; the child's depth is
 *                             lower and its limits no wider). Returns {status, id}.
 *   action 'delegation_end'   owner, or a holder of a row above it. Ends the row and every live row under it, now.
 *                             end_issued 'end' also ends the visits given under them; 'keep' (default) leaves them.
 * Only give_visit is used by this script so far; the other powers are recorded for later.
 * --------------------------------------------------------------------------------------------------------------- */
var DELEG_ = {
  FILE: 'BLD-delegation.csv',
  COLUMNS: ['id', 'tenant_id', 'power', 'holder_person_id', 'holder_code_id', 'holder_sign_in_id', 'parent_id', 'depth_left', 'from_date',
    'to_date', 'grant_type_ids', 'max_hours', 'rights', 'lists', 'fields', 'area_ids', 'subject_ids', 'end_others', 'extend_others',
    'ended_at', 'ended_by', 'end_reason', 'end_issued', 'set_by', 'set_on', 'source', 'notes', 'created_at', 'updated_at'],   // S4
  POWERS: ['give_visit', 'issue_code', 'issue_device', 'give_role'],
  LISTS: ['grant_type_ids', 'rights', 'lists', 'fields', 'area_ids', 'subject_ids'],
  MAX_DEPTH: 5
};

function delegFiles_() { return visitOn_() ? [DELEG_.FILE] : []; }

function delegRead_() {
  var read = store_read_(DELEG_.FILE, true);
  if (!sameHeader_(read.header, DELEG_.COLUMNS)) throw err_('HEADER_MISMATCH', DELEG_.FILE + ' does not have the columns the save system expects, so nothing was saved.');
  return read;
}

function delegSplit_(v) { return String(v || '').split('|').map(function (s) { return s.trim(); }).filter(String); }

/** Is this row itself live at nowMs (not ended, London today inside from_date..to_date, both whole days)? */
function delegRowLive_(r, nowMs) {
  if (String(r.ended_at || '')) return false;
  return grantRowOn_(r, todayLondon_(new Date(nowMs)));
}

/** The row and every row above it, nearest first; null if any is missing or not live (the chain is broken). */
function delegChain_(rows, id, nowMs) {
  var byId = {}, out = [], seen = {};
  rows.forEach(function (r) { byId[r.id] = r; });
  var cur = byId[id];
  while (cur) {
    if (seen[cur.id] || out.length > DELEG_.MAX_DEPTH + 1) return null;
    seen[cur.id] = true;
    if (!delegRowLive_(cur, nowMs)) return null;
    out.push(cur);
    if (!cur.parent_id) return out;
    cur = byId[cur.parent_id];
  }
  return null;
}

/** The effective limits of a chain: each list the intersection of the non-blank ones (null = no limit). */
function delegLimits_(chain) {
  var lim = { max_hours: null, end_others: true, extend_others: true, depth_left: Number(chain[0].depth_left) || 0, power: chain[0].power, to_date: null, to_ms: null };
  DELEG_.LISTS.forEach(function (k) {
    var set = null;
    chain.forEach(function (r) {
      var v = delegSplit_(r[k]);
      if (!v.length) return;
      set = set === null ? v : set.filter(function (x) { return v.indexOf(x) >= 0 || (k === 'fields' && v.indexOf(x.replace(/:last4$/, '')) >= 0); });
    });
    lim[k] = set;
  });
  chain.forEach(function (r) {
    var h = Number(r.max_hours);
    if (h > 0 && (lim.max_hours === null || h < lim.max_hours)) lim.max_hours = h;
    if (String(r.end_others) !== 'yes') lim.end_others = false;
    if (String(r.extend_others) !== 'yes') lim.extend_others = false;
    var to = String(r.to_date || '');
    if (to && (lim.to_date === null || to < lim.to_date)) lim.to_date = to;
  });
  if (lim.to_date !== null) lim.to_ms = Date.parse(inspectEndOfDay_(lim.to_date));   // a visit given under it ends by then
  return lim;
}

/** A field 'list.col' or 'list.col:last4' is inside a limit set (the full column also allows its last 4). */
function delegFieldOk_(set, f) {
  return set === null || set.indexOf(f) >= 0 || (/:last4$/.test(f) && set.indexOf(f.replace(/:last4$/, '')) >= 0);
}

/**
 * The live give_visit (or other power) delegation a code holds: {row, chain, limits}, or null.
 * If the code holds several, `want` (a delegation id) picks one; none given and several held is refused.
 */
function delegFor_(who, power, want, nowMs) {
  if (!who.id) return null;
  var tenant = prop_(BLD.PROP.TENANT_ID), read = store_read_(DELEG_.FILE, false);
  if (!read || !sameHeader_(read.header, DELEG_.COLUMNS)) return null;
  var rows = read.records.filter(function (r) { return !tenant || r.tenant_id === tenant; });
  var mine = rows.filter(function (r) {
    return r.power === power && r.holder_code_id === who.id && (!want || r.id === want) && delegChain_(rows, r.id, nowMs);
  });
  if (!mine.length) return null;
  if (mine.length > 1) throw err_('INVALID', 'Say which of your permissions this is under.', { fields: { delegation_id: 'Choose which permission.' } });
  var chain = delegChain_(rows, mine[0].id, nowMs);
  return { row: mine[0], chain: chain, limits: delegLimits_(chain), rows: rows };
}

function sinkDelegEntry_(req, fn) {
  if (!saveEnabled_()) throw err_('SAVE_OFF', 'Saving is switched off.');
  if (!req || typeof req !== 'object') throw err_('BAD_REQUEST', 'That request was not understood.');
  if (!visitOn_()) throw err_('TABLE_OFF', 'Visits are switched off.');
  var rid = String(req.request_id || '');
  if (!/^[A-Za-z0-9_\-]{8,64}$/.test(rid)) throw err_('BAD_REQUEST', 'The request had no valid reference.');
  var who = authStaff_(req.code);
  if (who.role === ROLE_INSPECTOR || who.role === ROLE_GUEST) throw err_('NOT_ALLOWED', 'A visitor code cannot do this.');
  var cache = CacheService.getScriptCache(), cached = cache.get('rid:' + rid);
  if (cached) { var again = JSON.parse(cached); again.repeat = true; return again; }
  var f = req.fields && typeof req.fields === 'object' ? req.fields : {};
  var result = withLock_(function () { return fn(f, who, new Date()); });
  cache.put('rid:' + rid, JSON.stringify(result), BLD.LIMITS.REQUEST_CACHE_SEC);
  return result;
}

function sinkDelegationGive_(req) {
  return sinkDelegEntry_(req, function (f, who, now) {
    var errors = {}, nowMs = now.getTime(), tenant = prop_(BLD.PROP.TENANT_ID), owner = who.role === 'OWNER';
    var power = String(f.power || '').trim();
    if (DELEG_.POWERS.indexOf(power) < 0) errors.power = 'Choose what they may give.';
    var holder = String(f.holder_code_id || '').trim(), person = String(f.holder_person_id || '').trim();
    if (!/^sc-[a-z0-9]{6}$/.test(holder)) errors.holder_code_id = 'Choose the person by their staff code.';
    if (person && !ID_RE_.test(person)) errors.holder_person_id = 'Choose the person from the list.';
    var depth = String(f.depth_left == null || f.depth_left === '' ? '0' : f.depth_left).trim();
    if (!/^\d$/.test(depth) || +depth > DELEG_.MAX_DEPTH) errors.depth_left = 'How many more layers they may pass it on: 0 to ' + DELEG_.MAX_DEPTH + '.';
    var today = todayLondon_(now), from = String(f.from_date || '').trim() || today, to = String(f.to_date || '').trim();
    if (!isRealDate_(from)) errors.from_date = 'Use a real date as YYYY-MM-DD.';
    else if (from < today) from = today;
    if (to && !isRealDate_(to)) errors.to_date = 'Use a real date as YYYY-MM-DD.';
    else if (to && !errors.from_date && to < from) errors.to_date = 'The end cannot be before the start.';
    var lists = {};
    var okFor = {
      grant_type_ids: function (s) { return ID_RE_.test(s); }, rights: function (s) { return VISIT_.RIGHTS.indexOf(visitRightCode_(s)) >= 0; },
      lists: function (s) { return VISIT_.KEY_RE.test(s); }, fields: function (s) { return VISIT_.FIELD_RE.test(s); },
      area_ids: function (s) { return ID_RE_.test(s); }, subject_ids: function (s) { return ID_RE_.test(s); }
    };
    DELEG_.LISTS.forEach(function (k) {
      var v = visitList_(k === 'rights' ? (Array.isArray(f[k]) ? f[k] : String(f[k] == null ? '' : f[k]).split('|')).map(visitRightCode_) : f[k], okFor[k], 500);
      if (!v) errors[k] = 'One of these was not understood.';
      lists[k] = v || [];
    });
    var mh = visitHours_(f.max_hours, 'max_hours', errors);
    var yes = function (k) { var v = String(f[k] == null ? '' : f[k]).trim(); if (['', 'yes', 'no', 'true', 'false'].indexOf(v) < 0) errors[k] = 'Yes or no.'; return v === 'yes' || v === 'true'; };
    var endOthers = yes('end_others'), extOthers = yes('extend_others');
    var source = dogcardText_(f.source, 'source', errors, 200), notes = dogcardText_(f.notes, 'notes', errors, 500);
    if (Object.keys(errors).length) throw err_('INVALID', 'Please check the highlighted fields.', { fields: errors });

    var entry = null, reg = registry_(), h;
    for (h in reg) if (Object.prototype.hasOwnProperty.call(reg, h) && reg[h].id === holder) entry = reg[h];
    if (!entry || entry.active === false || entry.revoked_at) throw err_('NOT_FOUND', 'That staff code was not found or is switched off.');
    if (entry.role === ROLE_INSPECTOR || entry.role === ROLE_GUEST) throw err_('INVALID', 'A visitor cannot be given this.', { fields: { holder_code_id: 'Choose a staff member.' } });
    if (holder === who.id) throw err_('INVALID', 'You cannot give this to yourself.', { fields: { holder_code_id: 'Choose someone else.' } });

    var read = delegRead_(), parentId = String(f.parent_id || '').trim();
    if (!owner || parentId) {
      // a holder re-confers: only under their own live row, never wider, never deeper
      var rows = visitMine_(read);
      var parent = rows.filter(function (r) { return r.id === parentId; })[0];
      if (!parent) throw err_('NOT_ALLOWED', 'You can only pass on a permission you hold.');
      if (!owner && parent.holder_code_id !== who.id) throw err_('NOT_ALLOWED', 'You can only pass on a permission you hold.');
      var chain = delegChain_(rows, parent.id, nowMs);
      if (!chain) throw err_('NOT_ALLOWED', 'That permission has ended.');
      var lim = delegLimits_(chain);
      if (parent.power !== power) throw err_('NOT_ALLOWED', 'You can only pass on the same kind of permission.');
      if (lim.depth_left < 1) throw err_('NOT_ALLOWED', 'You may not pass this permission on.');
      if (+depth >= lim.depth_left) throw err_('INVALID', 'Please check the highlighted fields.', { fields: { depth_left: 'It must be fewer layers than you hold (' + lim.depth_left + ').' } });
      var wider = {};
      DELEG_.LISTS.forEach(function (k) {
        var set = lim[k];
        if (set === null) return;
        if (!lists[k].length) { lists[k] = set.slice(); return; }   // blank = no wider than the parent: written out in full
        var ok = k === 'fields' ? lists[k].every(function (x) { return delegFieldOk_(set, x); }) : lists[k].every(function (x) { return set.indexOf(x) >= 0; });
        if (!ok) wider[k] = 'This is wider than what you hold.';
      });
      if (lim.max_hours !== null && (!mh || +mh > lim.max_hours)) { if (mh) wider.max_hours = 'At most ' + lim.max_hours + ' hours.'; else mh = String(lim.max_hours); }
      if (endOthers && !lim.end_others) wider.end_others = 'You may not end others\' visits yourself.';
      if (extOthers && !lim.extend_others) wider.extend_others = 'You may not extend others\' visits yourself.';
      if (lim.to_date !== null && (!to || to > lim.to_date)) { if (!to) to = lim.to_date; else wider.to_date = 'It cannot last longer than yours.'; }
      if (Object.keys(wider).length) throw err_('INVALID', 'You cannot give more than you hold.', { fields: wider });
    }
    var id = dogcardAppend_({ file: DELEG_.FILE, idPrefix: 'dlg', need: DELEG_.COLUMNS }, {
      power: power, holder_person_id: person, holder_code_id: holder, holder_sign_in_id: '', parent_id: parentId, depth_left: depth,
      from_date: from, to_date: to,
      grant_type_ids: lists.grant_type_ids.join('|'), max_hours: mh, rights: lists.rights.join('|'), lists: lists.lists.join('|'),
      fields: lists.fields.join('|'), area_ids: lists.area_ids.join('|'), subject_ids: lists.subject_ids.join('|'),
      end_others: endOthers ? 'yes' : '', extend_others: extOthers ? 'yes' : '', end_issued: '',
      set_by: owner ? 'owner' : who.id, set_on: todayLondon_(now), source: source || ('CD Hub, ' + who.who), notes: notes,
      created_at: utcIso_(now), updated_at: ''
    });
    try {
      appendPendingEvent_({ event_id: newId_('evt', now), pending_id: 'dlg-' + id, event: 'delegation_given', at: londonIso_(now), by: who.who,
        role: who.role, kind: 'delegation', row_id: id, note: power + ' to ' + holder + (parentId ? ' under ' + parentId : ''), result: 'given' });
    } catch (e) { Logger.log('Delegation ' + id + ' not logged: ' + (e && e.message)); }
    return { status: 'saved', id: id };
  });
}

function sinkDelegationEnd_(req) {
  return sinkDelegEntry_(req, function (f, who, now) {
    var errors = {}, nowMs = now.getTime(), id = String(f.id || '').trim();
    if (!ID_RE_.test(id)) errors.id = 'Say which permission to end.';
    var reason = visitReason_(f, errors, true);
    var endIssued = String(f.end_issued || 'keep').trim();
    if (['keep', 'end'].indexOf(endIssued) < 0) errors.end_issued = 'Keep or end the visits already given.';
    if (Object.keys(errors).length) throw err_('INVALID', 'Please check the highlighted fields.', { fields: errors });
    var read = delegRead_(), rows = visitMine_(read);
    var row = rows.filter(function (r) { return r.id === id; })[0];
    if (!row) throw err_('NOT_FOUND', 'That permission was not found.');
    if (String(row.ended_at || '')) throw err_('ALREADY_ENDED', 'That permission has already ended.');
    if (who.role !== 'OWNER') {
      // a holder may end what they passed on (any row below one of their own live rows), never their own or above
      var above = [], byId = {}, cur;
      rows.forEach(function (r) { byId[r.id] = r; });
      cur = byId[row.parent_id];
      while (cur && above.length <= DELEG_.MAX_DEPTH) { above.push(cur); cur = byId[cur.parent_id]; }
      if (!above.some(function (r) { return r.holder_code_id === who.id && delegRowLive_(r, nowMs); })) throw err_('NOT_ALLOWED', 'You can only end permissions you passed on.');
    }
    // the row and every live row below it
    var ending = {}, grew = true;
    ending[id] = true;
    while (grew) {
      grew = false;
      rows.forEach(function (r) { if (!ending[r.id] && ending[r.parent_id] && !String(r.ended_at || '')) { ending[r.id] = true; grew = true; } });
    }
    var at = utcIso_(now), done = 0;
    read.records.forEach(function (r, i) {
      if (!ending[r.id] || String(r.ended_at || '')) return;
      var rec = read.records[i];
      var next = read.header.map(function (hd) {
        if (hd === 'ended_at') return at;
        if (hd === 'ended_by') return who.who;
        if (hd === 'end_reason') return r.id === id ? reason : 'above it ended: ' + reason;
        if (hd === 'end_issued') return endIssued;
        return rec[hd] == null ? '' : String(rec[hd]);
      });
      store_replaceRow_(DELEG_.FILE, read.header, i, next, read);
      read = delegRead_();
      done++;
    });
    var visitsEnded = 0;
    if (endIssued === 'end') {
      var L = visitLinkRead_(), cur = linkCurrent_(L.records, prop_(BLD.PROP.TENANT_ID));
      Object.keys(cur).forEach(function (root) {
        var lk = cur[root];
        if (!ending[lk.delegation_id] || visitState_(lk, nowMs) === 'ended') return;
        var first = L.records.filter(function (r) { return r.id === root; })[0];
        if (first && first.code_id) { try { revokeCodeCore_(first.code_id, who.who, 'permission ended: ' + reason); } catch (e) { if (!e || e.code !== 'ALREADY_REVOKED') throw e; } }
        linkSupersede_(visitLinkRead_(), root, { ended_at: at, ended_by: who.who, end_reason: 'permission ended: ' + reason }, now);
        visitsEnded++;
      });
    }
    try {
      appendPendingEvent_({ event_id: newId_('evt', now), pending_id: 'dlg-' + id, event: 'delegation_ended', at: at, by: who.who, role: who.role,
        kind: 'delegation', row_id: id, note: reason + ' (' + (done - 1) + ' below, ' + visitsEnded + ' visits ended)', result: 'ended' });
    } catch (e) { Logger.log('Delegation end ' + id + ' not logged: ' + (e && e.message)); }
    return { status: 'saved', ended_at: at, children_ended: done - 1, visits_ended: visitsEnded };
  });
}
