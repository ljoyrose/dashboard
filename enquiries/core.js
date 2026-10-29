// Puppy Enquiries Hub: pure logic (JOB 13). PUBLIC repo: no data, no names, no ids, no keys.
// The same file runs in three places: the enquiries/ page (window.EnquiriesCore), node tests (require) and the
// RR_PUPPY-ENQUIRIES Apps Script engine, which embeds a copy under the version header below. No I/O in here:
// nothing in this file reads, sends or writes anything; callers pass plain values in and get plain values back.
(function (root) {
  'use strict';

  var VERSION = 'enquiries-core 1.0.0 (2026-10-29)';

  // ---- Phone numbers -------------------------------------------------------------------------------------------
  // Calling codes to country. Longest prefix wins, so +44 1534 is Jersey and +44 7700 is the United Kingdom.
  // +1 covers the USA, Canada and parts of the Caribbean: shown as one name, never guessed further.
  var CALLING = {
    '1': ['US', 'United States or Canada'], '7': ['RU', 'Russia or Kazakhstan'], '20': ['EG', 'Egypt'],
    '27': ['ZA', 'South Africa'], '30': ['GR', 'Greece'], '31': ['NL', 'Netherlands'], '32': ['BE', 'Belgium'],
    '33': ['FR', 'France'], '34': ['ES', 'Spain'], '36': ['HU', 'Hungary'], '39': ['IT', 'Italy'], '40': ['RO', 'Romania'],
    '41': ['CH', 'Switzerland'], '43': ['AT', 'Austria'], '44': ['GB', 'United Kingdom'], '45': ['DK', 'Denmark'],
    '46': ['SE', 'Sweden'], '47': ['NO', 'Norway'], '48': ['PL', 'Poland'], '49': ['DE', 'Germany'], '52': ['MX', 'Mexico'],
    '55': ['BR', 'Brazil'], '60': ['MY', 'Malaysia'], '61': ['AU', 'Australia'], '62': ['ID', 'Indonesia'],
    '63': ['PH', 'Philippines'], '64': ['NZ', 'New Zealand'], '65': ['SG', 'Singapore'], '66': ['TH', 'Thailand'],
    '81': ['JP', 'Japan'], '82': ['KR', 'South Korea'], '86': ['CN', 'China'], '90': ['TR', 'Turkey'], '91': ['IN', 'India'],
    '350': ['GI', 'Gibraltar'], '351': ['PT', 'Portugal'], '352': ['LU', 'Luxembourg'], '353': ['IE', 'Ireland'],
    '354': ['IS', 'Iceland'], '356': ['MT', 'Malta'], '357': ['CY', 'Cyprus'], '358': ['FI', 'Finland'],
    '359': ['BG', 'Bulgaria'], '370': ['LT', 'Lithuania'], '371': ['LV', 'Latvia'], '372': ['EE', 'Estonia'],
    '377': ['MC', 'Monaco'], '385': ['HR', 'Croatia'], '386': ['SI', 'Slovenia'], '420': ['CZ', 'Czechia'],
    '421': ['SK', 'Slovakia'], '423': ['LI', 'Liechtenstein'], '852': ['HK', 'Hong Kong'], '886': ['TW', 'Taiwan'],
    '965': ['KW', 'Kuwait'], '966': ['SA', 'Saudi Arabia'], '968': ['OM', 'Oman'], '971': ['AE', 'United Arab Emirates'],
    '972': ['IL', 'Israel'], '973': ['BH', 'Bahrain'], '974': ['QA', 'Qatar'],
    '441481': ['GG', 'Guernsey'], '441534': ['JE', 'Jersey'], '441624': ['IM', 'Isle of Man']
  };
  var CODES = Object.keys(CALLING).sort(function (a, b) { return b.length - a.length; });

  function lookupCode(digits) {
    for (var i = 0; i < CODES.length; i++) if (digits.indexOf(CODES[i]) === 0) return CODES[i];
    return '';
  }
  // The country's own calling code (+44 for Jersey too), for E.164 checks.
  function baseCode(code) { return code.length > 3 && code.indexOf('44') === 0 ? '44' : code; }

  // Any written phone number -> { e164, code, iso, country, valid }. A number with no + or 00 is read as a
  // number in defaultCode's country (UK unless told otherwise): 07700 900123 -> +447700900123.
  function normalisePhone(raw, defaultCode) {
    var out = { e164: '', code: '', iso: '', country: '', valid: false };
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return out;
    s = s.replace(/^tel:/i, '').replace(/\(0\)/g, '');
    var plus = /^\s*(\+|00)/.test(s);
    var d = s.replace(/[^\d]/g, '');
    if (!d) return out;
    if (plus) { if (s.trim().indexOf('00') === 0) d = d.slice(2); }
    else if (d.charAt(0) === '0') d = String(defaultCode || '44') + d.slice(1);
    else if (d.length <= 10) d = String(defaultCode || '44') + d;   // a bare national number with its 0 dropped
    var code = lookupCode(d);
    out.e164 = '+' + d;
    out.code = code ? '+' + baseCode(code) : '';
    if (code) { out.iso = CALLING[code][0]; out.country = CALLING[code][1]; }
    out.valid = !!code && d.length >= 8 && d.length <= 15;
    return out;
  }

  function countryFromPhone(raw, defaultCode) {
    var p = normalisePhone(raw, defaultCode);
    return p.country ? { iso: p.iso, country: p.country } : null;
  }

  // ---- Time zones ----------------------------------------------------------------------------------------------
  var TZ = {
    'Europe/London': 'GB', 'Europe/Belfast': 'GB', 'Europe/Jersey': 'JE', 'Europe/Guernsey': 'GG', 'Europe/Isle_of_Man': 'IM',
    'Europe/Dublin': 'IE', 'Europe/Zurich': 'CH', 'Europe/Vaduz': 'LI', 'Europe/Paris': 'FR', 'Europe/Monaco': 'MC',
    'Europe/Berlin': 'DE', 'Europe/Amsterdam': 'NL', 'Europe/Brussels': 'BE', 'Europe/Luxembourg': 'LU', 'Europe/Madrid': 'ES',
    'Atlantic/Canary': 'ES', 'Europe/Lisbon': 'PT', 'Europe/Rome': 'IT', 'Europe/Vienna': 'AT', 'Europe/Copenhagen': 'DK',
    'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO', 'Europe/Helsinki': 'FI', 'Europe/Warsaw': 'PL', 'Europe/Prague': 'CZ',
    'Europe/Bratislava': 'SK', 'Europe/Budapest': 'HU', 'Europe/Bucharest': 'RO', 'Europe/Sofia': 'BG', 'Europe/Athens': 'GR',
    'Europe/Zagreb': 'HR', 'Europe/Ljubljana': 'SI', 'Europe/Vilnius': 'LT', 'Europe/Riga': 'LV', 'Europe/Tallinn': 'EE',
    'Europe/Malta': 'MT', 'Asia/Nicosia': 'CY', 'Europe/Gibraltar': 'GI', 'Atlantic/Reykjavik': 'IS', 'Europe/Istanbul': 'TR',
    'Europe/Moscow': 'RU', 'Asia/Dubai': 'AE', 'Asia/Qatar': 'QA', 'Asia/Riyadh': 'SA', 'Asia/Kuwait': 'KW', 'Asia/Bahrain': 'BH',
    'Asia/Muscat': 'OM', 'Asia/Jerusalem': 'IL', 'Asia/Tel_Aviv': 'IL', 'Africa/Cairo': 'EG', 'Africa/Johannesburg': 'ZA',
    'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Asia/Singapore': 'SG', 'Asia/Hong_Kong': 'HK', 'Asia/Shanghai': 'CN',
    'Asia/Taipei': 'TW', 'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Bangkok': 'TH', 'Asia/Kuala_Lumpur': 'MY',
    'Asia/Jakarta': 'ID', 'Asia/Manila': 'PH', 'America/Mexico_City': 'MX', 'America/Sao_Paulo': 'BR',
    'Pacific/Auckland': 'NZ'
  };
  var ISO_NAME = {};
  Object.keys(CALLING).forEach(function (c) { ISO_NAME[CALLING[c][0]] = CALLING[c][1]; });
  ISO_NAME.US = 'United States'; ISO_NAME.CA = 'Canada'; ISO_NAME.AU = 'Australia';

  // IANA time zone -> { iso, country } or null. Whole regions that are one country are matched by prefix.
  function countryFromTimezone(tz) {
    tz = String(tz || '').trim();
    if (!tz) return null;
    var iso = TZ[tz];
    if (!iso) {
      if (/^Australia\//.test(tz)) iso = 'AU';
      else if (/^Canada\/|^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina|Montreal)$/.test(tz)) iso = 'CA';
      else if (/^US\/|^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Indiana\/.+|Kentucky\/.+)$/.test(tz) || tz === 'Pacific/Honolulu') iso = 'US';
    }
    return iso ? { iso: iso, country: ISO_NAME[iso] || iso } : null;
  }

  // One country for an enquiry, with how we know: 'stated' (they said), else 'inferred' from the phone code, else from the
  // time zone. conflict is true when the phone and the time zone point at different countries (shown, never hidden).
  function inferCountry(o) {
    o = o || {};
    var stated = String(o.stated || '').trim();
    var ph = o.phone ? countryFromPhone(o.phone, o.defaultCode) : null;
    var tz = o.timezone ? countryFromTimezone(o.timezone) : null;
    var conflict = !!(ph && tz && ph.iso !== tz.iso && !(ph.iso === 'US' && (tz.iso === 'US' || tz.iso === 'CA')) && !(ph.iso === 'RU'));
    if (stated) return { country: stated, basis: 'stated', conflict: conflict };
    if (ph) return { country: ph.iso === 'US' && tz && tz.iso === 'CA' ? 'Canada' : ph.iso === 'US' && tz && tz.iso === 'US' ? 'United States' : ph.country, basis: 'inferred', from: 'phone', conflict: conflict };
    if (tz) return { country: tz.country, basis: 'inferred', from: 'timezone', conflict: false };
    return { country: '', basis: '', conflict: false };
  }

  // ---- Email ---------------------------------------------------------------------------------------------------
  // Lower case, no mailto:, no display name; Gmail's dots and +tags removed so one inbox gives one key.
  function normaliseEmail(raw) {
    var s = String(raw == null ? '' : raw).trim().toLowerCase().replace(/^mailto:/, '');
    var m = s.match(/<([^>]+)>/); if (m) s = m[1].trim();
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(s)) return '';
    var at = s.lastIndexOf('@'), local = s.slice(0, at), dom = s.slice(at + 1);
    if (dom === 'googlemail.com') dom = 'gmail.com';
    if (dom === 'gmail.com') local = local.replace(/\./g, '').replace(/\+.*$/, '');
    return local + '@' + dom;
  }

  // ---- Keys ----------------------------------------------------------------------------------------------------
  // FNV-1a, 2 x 32 bit -> 16 hex characters. Deterministic everywhere (page, node, Apps Script). Keys carry no
  // readable email or number, so a key can sit in a log or a slip without naming anyone.
  function hash(s) {
    s = String(s);
    var h1 = 0x811c9dc5, h2 = 0x01000193 ^ 0x5bd1e995;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      h1 ^= c; h1 = Math.imul(h1, 0x01000193) >>> 0;
      h2 ^= c; h2 = Math.imul(h2, 0x01000193) >>> 0; h2 ^= h2 >>> 13;
    }
    return ('0000000' + h1.toString(16)).slice(-8) + ('0000000' + (h2 >>> 0).toString(16)).slice(-8);
  }
  function emailKey(email) { var e = normaliseEmail(email); return e ? 'em:' + hash(e) : ''; }
  function phoneKey(phone, defaultCode) { var p = normalisePhone(phone, defaultCode); return p.valid ? 'ph:' + hash(p.e164) : ''; }

  // The Enquiries row key: one per source record (a Calendly booking, a Gmail thread, a form run). Same source + ref
  // always gives the same key, so a re-read updates the row instead of adding a second one.
  function rowKey(channel, sourceRef) {
    channel = String(channel || '').trim().toLowerCase(); sourceRef = String(sourceRef || '').trim();
    if (!channel || !sourceRef) return '';
    return 'K-' + hash(channel + '|' + sourceRef);
  }

  // ---- People --------------------------------------------------------------------------------------------------
  // Group enquiry rows into people: rows sharing a normalised email or a valid phone are one person (transitively).
  // Each row needs { key, email?, phone?, channel?, received_uk? }. Returns [{ person_key, rows: [keys], sources: [...],
  // first_contact }]. Names alone never join two rows here (Stage 6 adds name similarity with a "check" flag).
  function groupPeople(rows, defaultCode) {
    var parent = {};
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    function union(a, b) { a = find(a); b = find(b); if (a !== b) parent[b] = a; }
    var byId = {};
    (rows || []).forEach(function (r, i) {
      var id = 'r' + i; parent[id] = id;
      [emailKey(r.email), phoneKey(r.phone, defaultCode)].forEach(function (k) {
        if (!k) return;
        if (byId[k]) union(byId[k], id); else byId[k] = id;
      });
    });
    var groups = {};
    (rows || []).forEach(function (r, i) {
      var g = find('r' + i);
      (groups[g] = groups[g] || []).push(r);
    });
    return Object.keys(groups).map(function (g) {
      var rs = groups[g];
      var ids = [];
      rs.forEach(function (r) { var e = emailKey(r.email), p = phoneKey(r.phone, defaultCode); if (e) ids.push(e); if (p) ids.push(p); });
      ids.sort();
      var sources = []; rs.forEach(function (r) { if (r.channel && sources.indexOf(r.channel) < 0) sources.push(r.channel); });
      var first = rs.map(function (r) { return r.received_uk || ''; }).filter(Boolean).sort()[0] || '';
      return { person_key: ids.length ? 'P-' + hash(ids[0]) : 'P-' + hash('row|' + (rs[0].key || g)), rows: rs.map(function (r) { return r.key; }), sources: sources, first_contact: first };
    });
  }

  // ---- Merging one enquiry row ---------------------------------------------------------------------------------
  var STAGES = ['new', 'replied', 'call-booked', 'call-held', 'offered', 'deposit', 'balance', 'collected', 'lost', 'parked'];
  var ADULT_STAGES = ['asked', 'details-sent', 'viewing', 'agreed', 'handed-over'];
  var CLOSED = { lost: 1, parked: 1 };
  function stageRank(s) {
    var i = STAGES.indexOf(s); if (i >= 0 && !CLOSED[s]) return i;
    i = ADULT_STAGES.indexOf(s); return i >= 0 ? i : -1;
  }

  // Merge a freshly read version of a row into the stored one. Blanks never overwrite values; Lisa's own fields
  // (stage set by her tap, owner, next step, flag) are kept; the stage only moves forward unless the new one is lost or
  // parked; received_uk keeps the earliest time. Returns a new object; neither input is changed.
  var LISA_FIELDS = ['owner', 'next_step', 'next_due_uk', 'lost_reason', 'flag', 'litter_ref', 'pup_ref'];
  function mergeRow(stored, incoming) {
    var out = {}, k;
    stored = stored || {}; incoming = incoming || {};
    for (k in stored) if (Object.prototype.hasOwnProperty.call(stored, k)) out[k] = stored[k];
    for (k in incoming) {
      if (!Object.prototype.hasOwnProperty.call(incoming, k)) continue;
      var v = incoming[k];
      if (v === '' || v == null) continue;
      if (k === 'stage' || k === 'received_uk') continue;
      if (LISA_FIELDS.indexOf(k) >= 0 && stored[k]) continue;
      if (k === 'do_not_contact') { out[k] = stored[k] === true || stored[k] === 'TRUE' || v === true || v === 'TRUE'; continue; }
      out[k] = v;
    }
    var a = stored.received_uk, b = incoming.received_uk;
    out.received_uk = a && b ? (a < b ? a : b) : (a || b || '');
    var s0 = stored.stage, s1 = incoming.stage;
    if (!s0) out.stage = s1 || 'new';
    else if (!s1 || CLOSED[s0]) out.stage = s0;
    else if (CLOSED[s1]) out.stage = s1;
    else out.stage = stageRank(s1) > stageRank(s0) ? s1 : s0;
    return out;
  }

  // ---- What kind of enquiry ------------------------------------------------------------------------------------
  // Words that point at each kind, with a weight. The highest total wins; a tie goes to the earlier kind in ORDER.
  // "puppy" is the fallback when the text names our breeds but nothing more specific; "other" when nothing matches.
  var KIND_ORDER = ['stud', 'breeding-set', 'adult-dog', 'food', 'puppy', 'other'];
  var KIND_WORDS = {
    stud: [[/\bstud\b|\bstud (dog|service|fee)s?\b/, 4], [/\b(mate|mating|cover)\b.{0,20}\b(my|our)\b.{0,10}\b(bitch|girl|female)\b/, 4], [/\bat stud\b/, 3]],
    'breeding-set': [[/\bbreeding (rights|set|pair|trio|stock|programme|program|dogs?|bitch(es)?)\b/, 4], [/\bfoundation\b/, 2],
      [/\b(i am|i'm|we are|we're) a breeder\b|\bstart(ing)? (to )?breed(ing)?\b|\bbreed (them|my own)\b/, 4], [/\bbreeding\b/, 2], [/\bbreeder\b/, 1]],
    'adult-dog': [[/\badult (dog|cobberdog|labradoodle|girl|boy)s?\b/, 4], [/\b(older|retired|retiring|ex[- ]?breeding)\b.{0,15}\b(dog|girl|boy|bitch|stud|cobberdog|labradoodle)s?\b/, 4],
      [/\brehom(e|ing)\b/, 3], [/\b\d{1,2} (years?|yrs?)[- ]old\b/, 2], [/\bfor sale\b.{0,20}\bdogs?\b/, 1]],
    food: [[/\b(designer dog foods?|dog food|puppy food|kibble|raw food|food order|feeding plan)\b/, 4], [/\b(order|buy|stock|sample)s? (of )?(the )?food\b/, 3], [/\bfood\b/, 1]],
    puppy: [[/\bpupp(y|ies)\b|\bpups?\b/, 3], [/\blitters?\b/, 2], [/\bwaiting list\b/, 3], [/\b(cobberdog|labradoodle|doodle)s?\b/, 1], [/\bdeposit\b/, 1]]
  };
  function classifyKind(text) {
    var t = ' ' + String(text || '').toLowerCase().replace(/\s+/g, ' ') + ' ';
    var best = 'other', bestScore = 0;
    KIND_ORDER.forEach(function (k) {
      if (!KIND_WORDS[k]) return;
      var s = 0;
      KIND_WORDS[k].forEach(function (w) { if (w[0].test(t)) s += w[1]; });
      if (s > bestScore) { best = k; bestScore = s; }
    });
    return best;
  }

  // ---- Time ----------------------------------------------------------------------------------------------------
  function toMs(v) {
    if (v instanceof Date) return v.getTime();
    var s = String(v || '').trim(); if (!s) return NaN;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += 'T00:00:00Z';
    else if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(s)) s = s.replace(' ', 'T') + 'Z';  // a bare time is read as UTC
    return Date.parse(s);
  }
  // Whole hours from askedAt to now (now defaults to the clock). NaN-safe: an unreadable time gives null.
  function hoursSince(askedAt, now) {
    var a = toMs(askedAt), b = now == null ? Date.now() : toMs(now);
    if (isNaN(a) || isNaN(b)) return null;
    return Math.floor((b - a) / 3600000);
  }

  var api = {
    VERSION: VERSION, CALLING: CALLING, STAGES: STAGES, ADULT_STAGES: ADULT_STAGES, KINDS: KIND_ORDER.slice(),
    normalisePhone: normalisePhone, countryFromPhone: countryFromPhone, countryFromTimezone: countryFromTimezone,
    inferCountry: inferCountry, normaliseEmail: normaliseEmail, hash: hash, emailKey: emailKey, phoneKey: phoneKey,
    rowKey: rowKey, groupPeople: groupPeople, mergeRow: mergeRow, stageRank: stageRank, classifyKind: classifyKind,
    hoursSince: hoursSince, toMs: toMs
  };
  root.EnquiriesCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
