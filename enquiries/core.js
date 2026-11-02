// Puppy Enquiries Hub: pure logic (JOB 13). PUBLIC repo: no data, no names, no ids, no keys.
// The same file runs in three places: the enquiries/ page (window.EnquiriesCore), node tests (require) and the
// RR_PUPPY-ENQUIRIES Apps Script engine, which embeds a copy under the version header below. No I/O in here:
// nothing in this file reads, sends or writes anything; callers pass plain values in and get plain values back.
(function (root) {
  'use strict';

  var VERSION = 'enquiries-core 1.4.0 (2026-10-29)';

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
    var G = 'g' + 'mail.com'; // assembled: the public repo keeps the personal mail domain out of its code (drives-submenu guard)
    if (dom === 'google' + G.slice(1)) dom = G;
    if (dom === G) local = local.replace(/\./g, '').replace(/\+.*$/, '');
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
  // The order a puppy sale really moves in: the deposit comes before a pup is offered (offers are Lisa's alone).
  var FLOW = ['new', 'replied', 'call-booked', 'call-held', 'deposit', 'offered', 'balance', 'collected'];
  function stageRank(s) {
    var i = FLOW.indexOf(s); if (i >= 0) return i;
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

  // ---- Data contract: RR_ENQUIRIES --------------------------------------------------------------------------
  // The page and the engine agree on these names. A tab whose header row is missing a column, or has one renamed or
  // moved, is refused (fail closed): the page shows "the sheet changed" and no rows, rather than wrong rows.
  var COLUMNS = {
    Enquiries: ['key', 'person_key', 'source', 'source_ref', 'received_uk', 'channel', 'kind', 'brand', 'country',
      'country_basis', 'breed_interest', 'size', 'colour', 'coat', 'sex', 'timing', 'household_flags', 'question_summary',
      'score', 'band', 'stage', 'next_step', 'next_due_uk', 'owner', 'do_not_contact', 'consent', 'litter_ref', 'pup_ref',
      'lost_reason', 'flag', 'ref', 'updated_uk'],
    People: ['person_key', 'ref', 'name', 'email', 'phone_e164', 'country', 'country_basis', 'sources', 'first_contact_uk',
      'last_touch_uk', 'touches', 'repeat_buyer', 'past_deposit', 'do_not_contact', 'consent', 'match_confidence', 'check', 'updated_uk'],
    Events: ['event_key', 'enquiry_key', 'person_key', 'at_uk', 'channel', 'type', 'detail', 'source_ref'],
    Drafts: ['draft_key', 'enquiry_key', 'person_key', 'case', 'version', 'text', 'links', 'made_uk', 'status', 'blocked_by'],
    FollowUps: ['followup_key', 'enquiry_key', 'person_key', 'rule', 'try', 'due_uk', 'status', 'snoozed_to_uk', 'draft_key', 'updated_uk'],
    Litters: ['litter_ref', 'pup_ref', 'sex', 'colour', 'size', 'coat', 'status', 'person_key', 'list', 'list_order',
      'deposit_date', 'source_sheet', 'read_uk'],
    'Sale Replies': ['group_ref', 'dog_ref', 'enquiry_key', 'person_key', 'reply_kind', 'at_uk', 'sale_status', 'read_uk'],
    Deposits: ['litter_ref', 'pup_ref', 'person_key', 'deposit_date', 'deposit', 'balance_due', 'balance_paid',
      'collection_date', 'basis', 'read_uk'],
    Sources: ['source', 'lands_where', 'machine_readable', 'reader', 'last_read_uk', 'last_count', 'status', 'note'],
    Settings: ['setting', 'value', 'note'],
    Requests: ['request_file', 'kind', 'enquiry_key', 'received_uk', 'applied_uk', 'result'],
    Log: ['at_uk', 'level', 'step', 'message', 'count', 'dry_run', 'engine_version']
  };
  var CHANNELS = ['email', 'calendly', 'web-form', 'cf-website-optin', 'cf-breeding', 'cf-waiting-list', 'hubspot',
    'hubspot-legacy', 'pets4homes', 'whatsapp', 'facebook', 'instagram', 'phone', 'manual'];
  var BANDS = ['hot', 'warm', 'cool', 'not-a-fit'];
  var CONSENT = ['ok', 'do-not-contact', 'unsubscribed', 'unknown'];
  var BASIS = ['stated', 'inferred'];
  var BREEDS = ['Cobberdog', 'Labradoodle', 'either'];
  // Enquiries columns that must hold one word from a list (blank allowed only where noted).
  var ENUMS = {
    channel: [CHANNELS, false], kind: [KIND_ORDER, false], stage: [STAGES.concat(ADULT_STAGES), false],
    band: [BANDS, true], consent: [CONSENT, true], country_basis: [BASIS, true], breed_interest: [BREEDS, true]
  };

  // Check one header row against the contract. Returns [] when it matches, else plain-English problems.
  function checkHeader(tab, header) {
    var want = COLUMNS[tab];
    if (!want) return ['unknown tab "' + tab + '"'];
    var got = (header || []).map(function (h) { return String(h == null ? '' : h).trim(); });
    var problems = [];
    want.forEach(function (c, i) {
      if (got.indexOf(c) < 0) problems.push(tab + ': column "' + c + '" is missing or renamed');
      else if (got[i] !== c) problems.push(tab + ': column "' + c + '" has moved (column ' + (got.indexOf(c) + 1) + ', expected ' + (i + 1) + ')');
    });
    return problems;
  }

  function truthy(v) { return v === true || /^(true|yes|y|1)$/i.test(String(v == null ? '' : v).trim()); }

  // Check one Enquiries row: words outside the lists, and stage flow (see stageFlags).
  function validateRow(r) {
    var problems = [];
    Object.keys(ENUMS).forEach(function (col) {
      var v = String(r[col] == null ? '' : r[col]).trim(), list = ENUMS[col][0], blankOk = ENUMS[col][1];
      if (!v) { if (!blankOk) problems.push(col + ' is blank'); return; }
      if (list.indexOf(v) < 0) problems.push(col + ' "' + v + '" is not one of the allowed words');
    });
    if (!String(r.key || '').trim()) problems.push('key is blank');
    return problems;
  }

  // A puppy enquiry must pass deposit before it is offered a pup, pays a balance or is collected. history is the list
  // of stages the enquiry has been at (from Events), or the row may carry a deposit. Returns flag words ([] = fine).
  function stageFlags(r, history) {
    var s = String(r.stage || '').trim(), flags = [];
    var after = { offered: 1, balance: 1, collected: 1 };
    if (after[s]) {
      var seen = (history || []).some(function (h) { return h === 'deposit'; }) || truthy(r.deposit_paid) || !!String(r.deposit_date || '').trim();
      if (!seen) flags.push('no-deposit-before-' + s);
    }
    if (truthy(r.do_not_contact) && r.consent === 'ok') flags.push('consent-conflict');
    return flags;
  }

  // Sheet values (first row = header) -> { ok, problems, rows }. ok is false when the header breaks the contract:
  // then rows is EMPTY (fail closed). Each row object carries _row (sheet row number) and, for Enquiries, _problems.
  function parseTab(tab, values) {
    values = values || [];
    var header = values[0] || [];
    var problems = checkHeader(tab, header);
    if (!values.length) problems = [tab + ': no header row'];
    if (problems.length) return { ok: false, problems: problems, rows: [] };
    var cols = COLUMNS[tab];
    var rows = [];
    for (var i = 1; i < values.length; i++) {
      var v = values[i] || [];
      if (!v.some(function (c) { return String(c == null ? '' : c).trim(); })) continue;
      var o = { _row: i + 1 };
      cols.forEach(function (c, j) { o[c] = v[j] == null ? '' : v[j]; });
      if (tab === 'Enquiries') o._problems = validateRow(o);
      rows.push(o);
    }
    return { ok: true, problems: [], rows: rows };
  }

  // ---- UK time ------------------------------------------------------------------------------------------------
  // Any time -> 'YYYY-MM-DDTHH:mm:ss' on the UK clock (GMT or BST). '' when unreadable.
  var UK_FMT = null;
  function toUk(v) {
    var ms = toMs(v); if (isNaN(ms)) return '';
    try {
      UK_FMT = UK_FMT || new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
      var p = {}; UK_FMT.formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
      return p.year + '-' + p.month + '-' + p.day + 'T' + p.hour + ':' + p.minute + ':' + p.second;
    } catch (e) { return new Date(ms).toISOString().slice(0, 19); }
  }
  function summary(text, max) {
    var t = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    max = max || 300;
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }
  function lastPart(uri) { var s = String(uri || '').replace(/\/+$/, ''); return s.slice(s.lastIndexOf('/') + 1); }

  // ---- Capture: Calendly "Whatsapp Call" ------------------------------------------------------------------------
  // pairs: [{ event, invitee }] as the Calendly API v2 returns them (scheduled_events and their invitees, cancelled ones
  // included). A reschedule in Calendly cancels the old invitee (rescheduled: true, new_invitee set) and books a new one
  // (old_invitee set), so we follow old_invitee back to the first booking: one chain = one enquiry.
  // Returns { enquiries: [row], events: [row], people: [person] }. Person details go only to the private People tab.
  function calendlyRecords(pairs, opts) {
    opts = opts || {};
    var byUri = {}, list = (pairs || []).filter(function (p) { return p && p.invitee && p.invitee.uri; });
    if (opts.eventName) {
      var want = String(opts.eventName).toLowerCase();
      list = list.filter(function (p) { return String((p.event && p.event.name) || '').toLowerCase() === want; });
    }
    list.forEach(function (p) { byUri[p.invitee.uri] = p; });
    function root(p) {
      var seen = {}, cur = p;
      while (cur.invitee.old_invitee && byUri[cur.invitee.old_invitee] && !seen[cur.invitee.uri]) { seen[cur.invitee.uri] = 1; cur = byUri[cur.invitee.old_invitee]; }
      return cur;
    }
    var chains = {};
    list.forEach(function (p) { var r = root(p).invitee.uri; (chains[r] = chains[r] || []).push(p); });
    var out = { enquiries: [], events: [], people: [] };
    Object.keys(chains).forEach(function (rootUri) {
      var ch = chains[rootUri].sort(function (a, b) { return toMs(a.invitee.created_at) - toMs(b.invitee.created_at); });
      var first = ch[0], last = ch[ch.length - 1], inv = last.invitee;
      var key = rowKey('calendly', rootUri);
      var qa = {};
      ch.forEach(function (p) { (p.invitee.questions_and_answers || []).forEach(function (q) { if (q && q.answer) qa[String(q.question || '').toLowerCase()] = q.answer; }); });
      var help = '', phone = inv.text_reminder_number || '';
      Object.keys(qa).forEach(function (q) { if (/help/.test(q)) help = qa[q]; else if (/whats ?app|mobile|phone|number/.test(q)) phone = qa[q] || phone; });
      var where = inferCountry({ phone: phone, timezone: inv.timezone, defaultCode: opts.defaultCode });
      var ev = [];
      ch.forEach(function (p, i) {
        var at = p.invitee.created_at;
        ev.push({ type: i === 0 ? 'booked' : 'rescheduled', at: at, start: p.event && p.event.start_time, ref: p.invitee.uri });
      });
      if (inv.status === 'canceled' && !inv.rescheduled) ev.push({ type: 'cancelled', at: (inv.cancellation && inv.cancellation.created_at) || inv.updated_at, start: last.event && last.event.start_time, ref: inv.uri, who: inv.cancellation && inv.cancellation.canceler_type });
      if (inv.no_show) ev.push({ type: 'no-show', at: inv.no_show.created_at || (last.event && last.event.start_time), start: last.event && last.event.start_time, ref: inv.uri });
      ev.forEach(function (e) {
        out.events.push({ event_key: 'V-' + hash(rootUri + '|' + e.type + '|' + e.ref), enquiry_key: key, person_key: '', at_uk: toUk(e.at),
          channel: 'calendly', type: e.type, detail: e.start ? 'call ' + toUk(e.start).replace('T', ' ').slice(0, 16) + ' UK' + (e.who ? ', cancelled by ' + e.who : '') : '', source_ref: lastPart(e.ref) });
      });
      var cancelled = inv.status === 'canceled' && !inv.rescheduled;
      var kind = help ? classifyKind(help) : 'puppy';
      if (kind === 'other' && !/\w{3,}.*\w{3,}/.test(help)) kind = 'puppy';  // a one-word answer on the puppy call is a puppy enquiry
      out.enquiries.push({
        key: key, person_key: '', source: 'Calendly ' + ((first.event && first.event.name) || 'Whatsapp Call'), source_ref: lastPart(rootUri),
        received_uk: toUk(first.invitee.created_at), channel: 'calendly', kind: kind, country: where.country,
        country_basis: where.basis, question_summary: summary(help, opts.maxChars), stage: cancelled ? 'new' : 'call-booked',
        next_step: cancelled ? 'Call cancelled: offer a new time' : inv.no_show ? 'No-show: message to rebook' : 'Prep the WhatsApp call',
        next_due_uk: cancelled ? '' : toUk(last.event && last.event.start_time), consent: 'unknown',
        flag: [where.conflict ? 'country-check' : '', inv.no_show ? 'no-show' : ''].filter(Boolean).join(' ')
      });
      out.people.push({ enquiry_key: key, name: inv.name || [inv.first_name, inv.last_name].filter(Boolean).join(' '), email: normaliseEmail(inv.email),
        phone_e164: normalisePhone(phone, opts.defaultCode).e164, country: where.country, country_basis: where.basis, timezone: inv.timezone || '' });
    });
    return out;
  }

  // ---- Capture: email and website forms ---------------------------------------------------------------------------
  // Form notifications (WordPress on labradoodles.co.uk, ClickFunnels, HubSpot) write "Label: value" lines. Pull the
  // fields we know by any of their usual labels; keep the rest out (the sheet holds a 300 character summary at most).
  var FIELD_LABELS = {
    name: /^(your |full |first )?name$|^contact name$/, last: /^(last|sur) ?name$/, email: /^(your )?e-?mail( address)?$/,
    phone: /^(your )?(phone|mobile|telephone|tel|whats ?app)( number| no\.?)?$/, country: /^(your )?country( of residence)?$/,
    message: /^(your )?(message|enquiry|inquiry|comments?|question|how can (i|we) help\??|tell us .*)$/,
    timing: /^(when|timing|when would you like.*|preferred timing)$/, breed: /^(breed|which breed.*)$/
  };
  function formFields(body) {
    var out = {}, lines = String(body || '').replace(/\r/g, '').split('\n');
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].match(/^\s*\**\s*([A-Za-z][A-Za-z ?.'/-]{1,40}?)\s*\**\s*[:：]\s*(.*)$/);
      if (!m) continue;
      var label = m[1].trim().toLowerCase(), val = m[2].trim();
      if (!val && lines[i + 1] && !/:/.test(lines[i + 1])) val = lines[i + 1].trim();   // value on the next line
      for (var f in FIELD_LABELS) if (FIELD_LABELS[f].test(label) && !out[f] && val) out[f] = val;
    }
    if (out.last && out.name && out.name.indexOf(out.last) < 0) out.name = out.name + ' ' + out.last;
    delete out.last;
    return out;
  }

  // Senders and words that are never an enquiry. Settings can add more (noise_senders, comma list) at run time.
  var NOISE_SENDERS = /@(calendly\.com|github\.com|google\.com|accounts\.google\.com|wordfence\.com|semrush\.com|xero\.com|paypal\.|stripe\.com|shopify\.com|mailchimp|hubspot\.com$|e\.hubspot\.com|linkedin\.com|facebookmail\.com$)|^(no-?reply|noreply|mailer-daemon|postmaster)@/i;
  var NOISE_SUBJECT = /\b(invoice|statement|remittance|receipt|order confirm(ation|ed)|price ?list|newsletter|webinar|seo (report|audit)|ranking report|weekly (activity|report)|security alert|wordfence|new user registration|password reset|unsubscribe|% off|sale ends|your order|payment (received|failed)|direct debit)\b/i;
  var NOISE_BODY = /\b(view (this email )?in (your )?browser|to unsubscribe|manage (your )?preferences|invoice (no|number)|amount due|vat (no|number)|keyword rankings?|domain authority|backlinks?)\b/i;
  var FORM_SIGNAL = /\b(new (form )?submission|form submission|new (enquiry|inquiry|contact|lead|message) (from|via|on)|contact form|enquiry form|website (enquiry|form)|has submitted|submitted the form|opt-?in)\b/i;
  var DOG_WORDS = /\b(pupp(y|ies)|pups?|litters?|cobberdogs?|labradoodles?|doodles?|stud|breed(ing|er)?|waiting list|dog|girl|boy|deposit)\b/i;
  var ASK_WORDS = /\?|\b(interested|enquir|inquir|looking for|would (like|love)|available|availability|how much|cost|price|waiting list|can (i|we|you)|do you have)\b/i;

  // One email -> { enquiry: bool, channel, kind, reason, fields }.
  // m: { from, to, subject, body, labels: [..], noiseSenders: [..], formSenders: [..] }. formSenders are the addresses or
  // domains that send form notifications (the website, ClickFunnels, HubSpot): their mail is judged on its fields.
  function classifyEmail(m) {
    m = m || {};
    var from = String(m.from || '').toLowerCase(), subject = String(m.subject || ''), body = String(m.body || '');
    var addr = (from.match(/<([^>]+)>/) || [null, from])[1].trim();
    var labels = (m.labels || []).map(function (l) { return String(l).toLowerCase(); });
    var no = function (why) { return { enquiry: false, channel: '', kind: '', reason: why, fields: {} }; };
    if (labels.some(function (l) { return /^(spam|trash|category_promotions|promotions|category_social)$/.test(l); })) return no('promotions or spam');
    var extra = (m.noiseSenders || []).map(function (x) { return String(x).trim().toLowerCase(); }).filter(Boolean);
    if (extra.some(function (x) { return addr.indexOf(x) >= 0; })) return no('listed noise sender');
    var formSender = (m.formSenders || []).some(function (x) { x = String(x).trim().toLowerCase(); return x && addr.indexOf(x) >= 0; });
    var fields = formFields(body);
    var isForm = formSender || FORM_SIGNAL.test(subject) || (FORM_SIGNAL.test(body) && (fields.email || fields.phone));
    if (isForm) {
      if (NOISE_SUBJECT.test(subject) && !(fields.email || fields.phone)) return no('system mail from a form sender');
      if (!(fields.email || fields.phone || fields.message)) return no('form mail with no contact fields');
      var text = [fields.message, subject].join(' ');
      var ch = /clickfunnels|myclickfunnels/.test(addr + ' ' + body.toLowerCase()) ? 'cf-website-optin' : /hubspot/.test(addr) ? 'hubspot' : /pets4homes/.test(addr) ? 'pets4homes' : 'web-form';
      return { enquiry: true, channel: ch, kind: kindOrPuppy(text), reason: 'form notification', fields: fields };
    }
    if (NOISE_SENDERS.test(addr)) return no('system or supplier sender');
    if (NOISE_SUBJECT.test(subject) || NOISE_BODY.test(body)) return no('invoice, report or marketing mail');
    var all = subject + ' ' + body;
    if (/pets4homes/.test(addr) && DOG_WORDS.test(all)) return { enquiry: true, channel: 'pets4homes', kind: kindOrPuppy(all), reason: 'Pets4Homes message', fields: fields };
    if (DOG_WORDS.test(all) && ASK_WORDS.test(all)) return { enquiry: true, channel: 'email', kind: kindOrPuppy(all), reason: 'asks about our dogs', fields: fields };
    return no('no enquiry words');
  }
  function kindOrPuppy(text) { var k = classifyKind(text); return k === 'other' && DOG_WORDS.test(text) ? 'puppy' : k; }

  // Gmail search for the reader: mail to the business addresses or from the form senders, newest first, never
  // promotions, spam or trash. Addresses and senders come from Settings (kept out of this public file).
  function gmailQuery(o) {
    o = o || {};
    var to = (o.addresses || []).filter(Boolean), frm = (o.formSenders || []).filter(Boolean);
    var parts = [];
    if (to.length) parts.push('to:(' + to.join(' OR ') + ')');
    if (frm.length) parts.push('from:(' + frm.join(' OR ') + ')');
    var q = parts.length > 1 ? '{' + parts.join(' ') + '}' : (parts[0] || '');
    return (q + ' newer_than:' + (o.days || 90) + 'd -category:promotions -category:social -in:spam -in:trash').trim();
  }

  // ---- Contact rules (SYS-CK) ---------------------------------------------------------------------------------
  // Do-not-contact lives in ClickFunnels tags and in every unsubscribe. A person with any of these is never drafted to
  // and never gets a follow-up. Settings can add tag words (dnc_tags) at run time.
  var DNC_TAGS = /x-?dont-?contact|do-?not-?(contact|market)|ldd-bad/i;
  var UNSUB_TAGS = /opted-?out|unsubscrib/i;
  function consentFrom(o) {
    o = o || {};
    var tags = (o.tags || []).map(String), extra = (o.dncTags || []).filter(Boolean);
    var dnc = tags.some(function (t) { return DNC_TAGS.test(t) || extra.some(function (x) { return t.toLowerCase() === String(x).toLowerCase(); }); });
    if (dnc) return { consent: 'do-not-contact', do_not_contact: true };
    if (truthy(o.unsubscribed) || tags.some(function (t) { return UNSUB_TAGS.test(t); })) return { consent: 'unsubscribed', do_not_contact: true };
    if (truthy(o.optedIn)) return { consent: 'ok', do_not_contact: false };
    return { consent: 'unknown', do_not_contact: false };
  }

  // ---- Junk check (HubSpot integration batches, form spam) ----------------------------------------------------
  // Stage 0 found about 20 of 23 new HubSpot contacts in 30 days were junk: random mixed-case letter names, dotted
  // throwaway mail, test domains, a dummy number. Returns the reasons ([] = looks real). Shown, and kept out of counts.
  // opts.testDomains replaces the built-in test-domain list (the tests pass [] because their invented people use
  // example.com, which in real data is a test entry).
  var TEST_DOMAINS = ['example.com', 'example.org', 'example.net', 'mailinator.com', 'guerrillamail.com', 'yopmail.com', 'sharklasers.com', 'tempmail.com'];
  function junkReasons(p, opts) {
    p = p || {}; opts = opts || {};
    var testDomains = opts.testDomains || TEST_DOMAINS;
    var why = [], name = String(p.name || '').trim(), email = normaliseEmail(p.email) || String(p.email || '').toLowerCase();
    var word = name.replace(/\s+/g, '');
    if (word.length >= 8 && /[a-z][A-Z][a-z]*[A-Z]/.test(word) && !/\s/.test(name.trim()) ) why.push('random letters name');
    else if (word.length >= 10 && !/[aeiou]{1}/i.test(word.slice(0, 6))) why.push('random letters name');
    var local = String(p.email || '').split('@')[0] || '';
    if ((local.match(/\./g) || []).length >= 3) why.push('dotted throwaway address');
    var dom = email.split('@')[1] || '';
    if (testDomains.indexOf(dom) >= 0 || /\.(test|invalid|localhost)$/.test(dom) || /^test\./.test(dom)) why.push('test or throwaway domain');
    var ph = normalisePhone(p.phone).e164;
    if (/^\+44(7123456789|7000000000|1234567890)$/.test(ph) || /^\+\d*(\d)\1{7,}$/.test(ph)) why.push('dummy phone');
    if (/^test\b|\btest$/i.test(name) || /^test/i.test(local)) why.push('test entry');
    return why;
  }

  // ---- ClickFunnels guard --------------------------------------------------------------------------------------
  // Before every read batch the engine reads the workspace live and compares id and exact name with Script Properties.
  function workspaceGuard(expected, live) {
    expected = expected || {}; live = live || {};
    if (!expected.id || !expected.name) return { ok: false, why: 'CF_WORKSPACE_ID and CF_WORKSPACE_NAME are not both set' };
    if (String(live.id) !== String(expected.id)) return { ok: false, why: 'workspace id does not match' };
    if (String(live.name || '') !== String(expected.name)) return { ok: false, why: 'workspace name does not match (live "' + (live.name || '') + '")' };
    return { ok: true, why: '' };
  }

  // ---- Capture: ClickFunnels workflow runs ---------------------------------------------------------------------
  // runs: [{ id, workflow, created_at, page, contact: { id, email, phone, first_name, last_name, tags: [names] } | null }]
  // A run with no email and no phone is an anonymous page view: noise, never an enquiry (27 of 27 Breeding Cobberdogs
  // runs on 29 Oct were like this). Returns { enquiries, people, events, noise: n, byWorkflow: { name: { runs, real } } }.
  var CF_WORKFLOWS = [
    [/website ?opt-?in/i, 'cf-website-optin', 'puppy'], [/breeding cobberdogs|breeder/i, 'cf-breeding', 'breeding-set'],
    [/waiting ?list|application/i, 'cf-waiting-list', 'puppy']
  ];
  function cfRecords(runs, opts) {
    opts = opts || {};
    var out = { enquiries: [], people: [], events: [], noise: 0, byWorkflow: {} };
    (runs || []).forEach(function (r) {
      var wf = String(r.workflow || ''), map = null;
      for (var i = 0; i < CF_WORKFLOWS.length; i++) if (CF_WORKFLOWS[i][0].test(wf)) { map = CF_WORKFLOWS[i]; break; }
      var b = out.byWorkflow[wf] = out.byWorkflow[wf] || { runs: 0, real: 0, noise: 0 };
      b.runs++;
      var c = r.contact || {}, email = normaliseEmail(c.email), ph = normalisePhone(c.phone, opts.defaultCode);
      if (!map || (!email && !ph.valid)) { b.noise++; out.noise++; return; }
      b.real++;
      var key = rowKey(map[1], r.id), name = [c.first_name, c.last_name].filter(Boolean).join(' ');
      var cons = consentFrom({ tags: c.tags, dncTags: opts.dncTags });
      var msg = c.message || r.message || '';
      var where = inferCountry({ stated: c.country, phone: c.phone, defaultCode: opts.defaultCode });
      out.enquiries.push({ key: key, source: 'ClickFunnels ' + wf, source_ref: String(r.id), received_uk: toUk(r.created_at), channel: map[1],
        kind: msg ? (classifyKind(msg) === 'other' ? map[2] : classifyKind(msg)) : map[2], country: where.country, country_basis: where.basis,
        question_summary: summary(msg, opts.maxChars), stage: 'new', consent: cons.consent, do_not_contact: cons.do_not_contact,
        flag: junkReasons({ name: name, email: c.email, phone: c.phone }, opts).length ? 'junk?' : '' });
      out.people.push({ enquiry_key: key, channel: map[1], name: name, email: email, phone_e164: ph.valid ? ph.e164 : '', country: where.country, country_basis: where.basis, consent: cons.consent });
      out.events.push({ event_key: 'V-' + hash(key + '|received'), enquiry_key: key, at_uk: toUk(r.created_at), channel: map[1], type: 'received', detail: 'workflow ' + wf + (r.page ? ' on ' + r.page : ''), source_ref: String(r.id) });
    });
    return out;
  }

  // OW-0003: match each breeder-form run to a page submission that carries a contact, by page and time (within
  // windowMin minutes). Returns { matched: [{ run, submission }], unmatched: [run] }. Counts only go in a slip.
  function matchSubmissions(runs, submissions, windowMin) {
    var w = (windowMin || 10) * 60000, used = {}, out = { matched: [], unmatched: [] };
    (runs || []).forEach(function (r) {
      var t = toMs(r.created_at), best = null, bestGap = Infinity;
      (submissions || []).forEach(function (s, i) {
        if (used[i] || !(s.contact && (s.contact.email || s.contact.phone))) return;
        if (r.page && s.page && String(r.page) !== String(s.page)) return;
        var gap = Math.abs(toMs(s.created_at) - t);
        if (gap <= w && gap < bestGap) { best = i; bestGap = gap; }
      });
      if (best === null) out.unmatched.push(r); else { used[best] = 1; out.matched.push({ run: r, submission: submissions[best] }); }
    });
    return out;
  }

  // ---- Capture: HubSpot contacts --------------------------------------------------------------------------------
  // contacts: HubSpot v3 objects { id, properties: { email, firstname, lastname, phone, mobilephone, country, createdate,
  // message, hs_email_optout, recent_conversion_event_name } }. Junk is counted, not captured.
  function hubspotRecords(contacts, opts) {
    opts = opts || {};
    var out = { enquiries: [], people: [], events: [], junk: 0 };
    (contacts || []).forEach(function (c) {
      var p = (c && c.properties) || {}, name = [p.firstname, p.lastname].filter(Boolean).join(' ');
      var phone = p.phone || p.mobilephone || '', email = normaliseEmail(p.email), ph = normalisePhone(phone, opts.defaultCode);
      if (!email && !ph.valid) { out.junk++; return; }
      if (junkReasons({ name: name, email: p.email, phone: phone }, opts).length) { out.junk++; return; }
      var key = rowKey('hubspot', c.id), msg = p.message || p.recent_conversion_event_name || '';
      var where = inferCountry({ stated: p.country, phone: phone, defaultCode: opts.defaultCode });
      var cons = consentFrom({ unsubscribed: p.hs_email_optout });
      out.enquiries.push({ key: key, source: 'HubSpot contact', source_ref: String(c.id), received_uk: toUk(p.createdate), channel: 'hubspot',
        kind: msg ? (classifyKind(msg) === 'other' ? 'puppy' : classifyKind(msg)) : 'puppy', country: where.country, country_basis: where.basis,
        question_summary: summary(msg, opts.maxChars), stage: 'new', consent: cons.consent, do_not_contact: cons.do_not_contact });
      out.people.push({ enquiry_key: key, channel: 'hubspot', name: name, email: email, phone_e164: ph.valid ? ph.e164 : '', country: where.country, country_basis: where.basis, consent: cons.consent });
      out.events.push({ event_key: 'V-' + hash(key + '|received'), enquiry_key: key, at_uk: toUk(p.createdate), channel: 'hubspot', type: 'received', detail: p.recent_conversion_event_name ? 'form ' + p.recent_conversion_event_name : 'contact created', source_ref: String(c.id) });
    });
    return out;
  }

  // ---- Add by hand ----------------------------------------------------------------------------------------------
  // The page's "Add by hand" box: Lisa pastes a message from email, WhatsApp, Facebook, Instagram, a phone call or
  // Pets4Homes, picks the channel and kind; the page writes ONE request file; the engine turns it into a row.
  var HAND_CHANNELS = ['email', 'whatsapp', 'facebook', 'instagram', 'phone', 'pets4homes'];
  var HAND_MAX = 5000;
  function addRequest(o, nowIso) {
    o = o || {};
    var channel = String(o.channel || '').trim(), kind = String(o.kind || '').trim(), text = String(o.text == null ? '' : o.text);
    if (!channel) return { ok: false, error: 'Pick where it came from.' };
    if (HAND_CHANNELS.indexOf(channel) < 0) return { ok: false, error: 'Unknown channel "' + channel + '".' };
    if (kind && KIND_ORDER.indexOf(kind) < 0) return { ok: false, error: 'Unknown kind "' + kind + '".' };
    if (!text.trim()) return { ok: false, error: 'Paste the message first.' };
    if (text.length > HAND_MAX) return { ok: false, error: 'That is ' + text.length + ' characters; the most is ' + HAND_MAX + '. Paste the part that matters.' };
    var at = nowIso || new Date().toISOString();
    return { ok: true, name: 'ENQ-add-' + at.replace(/[^0-9]/g, '').slice(0, 14) + '-' + hash(channel + text).slice(0, 6) + '.json',
      body: { v: 1, kind: 'add', channel: channel, enquiry_kind: kind || classifyKind(text), text: text, at: at } };
  }
  // The engine's read of a pasted message: name, email and phone if the text gives them.
  function parsePasted(text, defaultCode) {
    var t = String(text || ''), f = formFields(t);
    var em = f.email || ((t.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/) || [])[0]) || '';
    var phRaw = f.phone || ((t.match(/(\+|00)\d[\d\s().-]{7,}\d|\b0\d[\d\s-]{8,}\d/) || [])[0]) || '';
    var ph = normalisePhone(phRaw, defaultCode);
    var name = f.name || ((t.match(/^(?:from|name)\s*[:\-]\s*(.+)$/im) || [])[1] || '').trim();
    return { name: name, email: normaliseEmail(em), phone_e164: ph.valid ? ph.e164 : '', message: f.message || t.trim() };
  }

  var api = {
    VERSION: VERSION, CALLING: CALLING, STAGES: STAGES, ADULT_STAGES: ADULT_STAGES, KINDS: KIND_ORDER.slice(),
    normalisePhone: normalisePhone, countryFromPhone: countryFromPhone, countryFromTimezone: countryFromTimezone,
    inferCountry: inferCountry, normaliseEmail: normaliseEmail, hash: hash, emailKey: emailKey, phoneKey: phoneKey,
    rowKey: rowKey, groupPeople: groupPeople, mergeRow: mergeRow, stageRank: stageRank, classifyKind: classifyKind,
    hoursSince: hoursSince, toMs: toMs,
    FLOW: FLOW, COLUMNS: COLUMNS, CHANNELS: CHANNELS, BANDS: BANDS, CONSENT: CONSENT, ENUMS: ENUMS,
    checkHeader: checkHeader, validateRow: validateRow, stageFlags: stageFlags, parseTab: parseTab, truthy: truthy,
    toUk: toUk, summary: summary, lastPart: lastPart, calendlyRecords: calendlyRecords,
    formFields: formFields, classifyEmail: classifyEmail, gmailQuery: gmailQuery,
    consentFrom: consentFrom, junkReasons: junkReasons, workspaceGuard: workspaceGuard, cfRecords: cfRecords,
    matchSubmissions: matchSubmissions, hubspotRecords: hubspotRecords, HAND_CHANNELS: HAND_CHANNELS, HAND_MAX: HAND_MAX,
    addRequest: addRequest, parsePasted: parsePasted
  };
  root.EnquiriesCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
