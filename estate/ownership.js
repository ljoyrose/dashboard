// Web Estate Hub, Stage 16: ownership and control (I6). Pure: no network, no Drive, no DOM.
// The ownership columns live on RR_DOMAINS-AND-HOSTING and are joined to estate rows at READ TIME;
// there is never a second list. Values are role or account LABELS only: anything that looks like an
// email address, password, token or phone number is dropped and flagged, never returned.
// C4: a 'monitor only' row never gets a mail or DNS change suggestion. Nothing here changes anything.
(function (root, factory) {
  'use strict';
  var status = (typeof module === 'object' && module.exports) ? require('./status.js') : root.EstateStatus;
  var api = factory(status);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EstateOwnership = api;
})(this, function (S) {
  'use strict';
  var VERSION = '1.0.0';
  var OWNER_CLASSES = ['ours', 'client', 'resale', 'monitor only', 'unknown'];
  var LABELS = { ours: 'Ours', client: 'Client', resale: 'Resale', 'monitor only': 'Monitor only', unknown: 'Not set' };
  var HIDDEN_REASON = 'hidden: looked like an email/secret';

  // ---- headers ----
  function norm(h) { return String(h == null ? '' : h).trim().toLowerCase().replace(/[\s\-]+/g, '_'); }
  var COLS = {
    domain: ['domain', 'domain_name', 'name', 'host', 'url', 'url_or_domain'],
    owner_class: ['owner_class', 'owner', 'ownership', 'owner_type', 'ownership_class'],
    registrar_account: ['registrar_account', 'registrar_acct', 'registrar_account_label', 'registrar'],
    dns_account: ['dns_account', 'dns_acct', 'dns_account_label', 'dns_host_account', 'dns_provider_account', 'dns_provider'],
    twofa_holder: ['2fa_holder', 'twofa_holder', '2fa', 'mfa_holder', '2fa_owner', 'two_factor_holder'],
    agent_may_read: ['agent_may_read', 'agent_read', 'agent_can_read', 'agent_access', 'agent_may_view'],
    client: ['client', 'client_name', 'account']
  };
  function pick(row, cols) {
    if (!row || typeof row !== 'object') return '';
    var keys = Object.keys(row);
    for (var i = 0; i < cols.length; i++) {
      for (var j = 0; j < keys.length; j++) {
        if (norm(keys[j]) !== cols[i]) continue;
        var v = row[keys[j]];
        if (v == null || typeof v === 'object') continue;
        v = String(v).trim();
        if (v !== '') return v;
      }
    }
    return '';
  }

  // ---- owner class ----
  var CLASS_WORDS = {
    ours: ['ours', 'our', 'us', 'own', 'owned', 'mine', 'internal', 'company', 'in house', 'inhouse', 'we own'],
    client: ['client', 'clients', 'client owned', 'client own', 'customer'],
    resale: ['resale', 'reseller', 'resold', 'resell', 'white label'],
    'monitor only': ['monitor only', 'monitor', 'monitoring', 'monitor_only', 'separate owner', 'separately owned',
      'watch only', 'watch', 'read only', 'third party', 'not ours']
  };
  function ownerClass(v) {
    var w = String(v == null ? '' : v).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!w) return 'unknown';
    var found = 'unknown';
    Object.keys(CLASS_WORDS).some(function (c) {
      if (CLASS_WORDS[c].indexOf(w) !== -1) { found = c; return true; }
      return false;
    });
    return found;
  }
  function ownerLabel(c) { return LABELS[c] || LABELS.unknown; }

  // ---- safety ----
  var SECRET_WORD = /pass(word)?\b|pass\s*:|passwd|pwd|secret|token|api[\s_-]?key|recovery|backup code|otp\b/i;
  // value -> { value, hidden, reason }. value is '' when hidden. Never throws.
  function sanitize(value) {
    var v = (value == null || typeof value === 'object') ? '' : String(value).trim();
    if (!v) return { value: '', hidden: false, reason: '' };
    var bad = /@/.test(v) || /\bmailto:/i.test(v) || SECRET_WORD.test(v) ||
      // a long unbroken run with both letters and digits: treat as a token
      (/[A-Za-z0-9_\-+\/=]{16,}/.test(v) && /\d/.test(v) && /[A-Za-z]/.test(v)) ||
      // a phone number is a person's detail, not a label
      /(\d[\s().-]*){8,}/.test(v);
    if (bad) return { value: '', hidden: true, reason: HIDDEN_REASON };
    return { value: v.slice(0, 80), hidden: false, reason: '' };
  }

  function yesNo(v) {
    var w = String(v == null ? '' : v).trim().toLowerCase();
    return w === 'y' || w === 'yes' || w === 'true' || w === '1' || w === 'ok' || w === 'allowed';
  }

  // One RR_DOMAINS-AND-HOSTING row -> ownership object. A missing row gives owner_class 'unknown'.
  function readOwnership(domainRow) {
    var hidden = [];
    var out = { owner_class: ownerClass(pick(domainRow, COLS.owner_class)) };
    out.owner_label = ownerLabel(out.owner_class);
    ['registrar_account', 'dns_account', 'twofa_holder', 'client'].forEach(function (f) {
      var s = sanitize(pick(domainRow, COLS[f]));
      out[f] = s.value;
      if (s.hidden) hidden.push({ field: f, reason: s.reason });
    });
    out.agent_may_read = yesNo(pick(domainRow, COLS.agent_may_read));
    out.hidden = hidden;
    return out;
  }

  // ---- join ----
  function registrable(host) {
    if (S && S.registrable) return S.registrable(host);
    var labels = String(host || '').trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/[\/?#:].*$/, '').split('.').filter(Boolean);
    return labels.slice(-2).join('.');
  }
  function domainOf(row) {
    if (!row || typeof row !== 'object') return '';
    var d = row.url_or_domain || row.domain || row.key || '';
    return typeof d === 'string' ? registrable(d) : '';
  }

  // estateRows + domainRows -> new estate rows with `ownership` attached, matched by registrable domain.
  // The first domain row for a registrable domain wins. Inputs are never changed. Never throws.
  function join(estateRows, domainRows) {
    var index = {};
    (Array.isArray(domainRows) ? domainRows : []).forEach(function (d) {
      var key = registrable(pick(d, COLS.domain));
      if (key && key.indexOf('.') !== -1 && !index[key]) index[key] = d;
    });
    return (Array.isArray(estateRows) ? estateRows : []).filter(function (r) { return r && typeof r === 'object'; }).map(function (r) {
      var o = {};
      Object.keys(r).forEach(function (k) { o[k] = r[k]; });
      var key = domainOf(r);
      o.ownership = readOwnership(key ? index[key] : null);
      if (!o.ownership.client && r.client) {
        var c = sanitize(r.client);
        o.ownership.client = c.value;
      }
      return o;
    });
  }

  function ownershipOf(row) {
    if (row && row.ownership && typeof row.ownership === 'object') return row.ownership;
    return readOwnership(row);
  }

  // ---- C4: suggestions ----
  function canSuggestChanges(row) { return ownershipOf(row).owner_class !== 'monitor only'; }

  var CHANGE_VERB = /(^|[.!?:;]\s+|\n)\s*(add|merge|delete|remove|change|publish|shorten|keep a single|update|set|move|point|replace|tighten|export|create|switch|transfer|renew|enable|disable|turn on|turn off|fix)\b/i;
  var CHANGE_KIND = /fix|change|suggest|proposal|action|todo|open[\s_-]?work/i;
  function isChange(s) {
    if (s == null) return false;
    if (typeof s === 'string') return CHANGE_VERB.test(s);
    if (typeof s !== 'object') return false;
    if (s.change === true || s.proposal === true || s.action != null || s.fix != null) return true;
    if (s.read_only === true || s.fact === true) return false;
    if (CHANGE_KIND.test(String(s.kind || s.type || ''))) return true;
    if (s.suggested_by) return true; // open-work rows from alerts.openWorkRows
    return CHANGE_VERB.test(String(s.text || s.title || s.suggestion || s.note || ''));
  }

  // row, suggestions (array, or one string/object) -> a new array. Monitor-only rows lose every change
  // proposal; read-only facts are kept. Other rows keep everything.
  function filterSuggestions(row, suggestions) {
    var list = Array.isArray(suggestions) ? suggestions.slice() : (suggestions == null ? [] : [suggestions]);
    if (canSuggestChanges(row)) return list;
    return list.filter(function (s) { return !isChange(s); });
  }

  // ---- views ----
  // view: 'main' or { client: '<name>' }. Client and resale rows show only in their own client view
  // (exact client name after trimming). One with no client name stays in main so it never vanishes.
  // Ours, monitor only and unknown rows show in main only.
  function visibleIn(row, view) {
    if (!row || typeof row !== 'object') return false;
    var own = ownershipOf(row);
    var cls = own.owner_class;
    var client = String(own.client || pick(row, COLS.client) || '').trim();
    var isClientRow = cls === 'client' || cls === 'resale';
    if (view === 'main' || view == null) return !isClientRow || !client;
    if (typeof view === 'object' && view.client != null) {
      var want = String(view.client).trim();
      return isClientRow && !!want && client === want;
    }
    return false;
  }

  return {
    VERSION: VERSION,
    OWNER_CLASSES: OWNER_CLASSES,
    HIDDEN_REASON: HIDDEN_REASON,
    ownerClass: ownerClass,
    ownerLabel: ownerLabel,
    sanitize: sanitize,
    readOwnership: readOwnership,
    join: join,
    canSuggestChanges: canSuggestChanges,
    isChange: isChange,
    filterSuggestions: filterSuggestions,
    visibleIn: visibleIn
  };
});
