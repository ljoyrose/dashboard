// Puppy Enquiries Hub: pure logic (JOB 13). PUBLIC repo: no data, no names, no ids, no keys.
// The same file runs in three places: the enquiries/ page (window.EnquiriesCore), node tests (require) and the
// RR_PUPPY-ENQUIRIES Apps Script engine, which embeds a copy under the version header below. No I/O in here:
// nothing in this file reads, sends or writes anything; callers pass plain values in and get plain values back.
(function (root) {
  'use strict';

  var VERSION = 'enquiries-core 1.11.0 (2026-10-30)';

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

  // ---- Names (Stage 6) -----------------------------------------------------------------------------------------
  // Lower case, accents off, titles off, letters and spaces only: "Mrs. Zoë O'Brien" -> "zoe obrien".
  var TITLES = { mr: 1, mrs: 1, ms: 1, miss: 1, mx: 1, dr: 1, prof: 1, sir: 1 };
  function nameKey(raw) {
    var s = String(raw == null ? '' : raw);
    if (s.normalize) s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    s = s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z\s-]/g, ' ').replace(/-/g, ' ');
    return s.split(/\s+/).filter(function (t) { return t && !TITLES[t]; }).join(' ');
  }
  // Jaro-Winkler, 0 to 1.
  function jaroWinkler(a, b) {
    if (a === b) return a ? 1 : 0;
    if (!a || !b) return 0;
    var win = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1), am = [], bm = [], m = 0, t = 0, i, j, k = 0;
    for (i = 0; i < a.length; i++) {
      for (j = Math.max(0, i - win); j < Math.min(b.length, i + win + 1); j++) {
        if (bm[j] || a[i] !== b[j]) continue;
        am[i] = bm[j] = true; m++; break;
      }
    }
    if (!m) return 0;
    for (i = 0; i < a.length; i++) {
      if (!am[i]) continue;
      while (!bm[k]) k++;
      if (a[i] !== b[k]) t++;
      k++;
    }
    var jaro = (m / a.length + m / b.length + (m - t / 2) / m) / 3, p = 0;
    while (p < 4 && a[p] && a[p] === b[p]) p++;
    return jaro + p * 0.1 * (1 - jaro);
  }
  // How alike two names are, 0 to 1. Needs a first AND a last name on both sides to go above 0.7: a first name on its
  // own never makes two people one. An initial matches its name at 0.85 ("j smith" / "jane smith").
  function nameSimilarity(a, b) {
    var x = nameKey(a).split(' ').filter(Boolean), y = nameKey(b).split(' ').filter(Boolean);
    if (!x.length || !y.length) return 0;
    if (x.length < 2 || y.length < 2) return Math.round(jaroWinkler(x.join(' '), y.join(' ')) * 0.7 * 100) / 100;
    function part(p, q) { return (p.length === 1 || q.length === 1) ? (p[0] === q[0] ? 0.85 : 0) : jaroWinkler(p, q); }
    var last = jaroWinkler(x[x.length - 1], y[y.length - 1]), s = 0.4 * part(x[0], y[0]) + 0.6 * last;
    if (last < 0.9) s = Math.min(s, 0.85); // surnames must be (nearly) the same: Smith / Smyth stay two people
    return Math.round(s * 100) / 100;
  }

  // ---- One person across sources (Stage 6) ---------------------------------------------------------------------
  // Matches each incoming person (from any reader) to a stored People row, or makes a new one. Never deletes and never
  // re-keys a stored person, so a person_key once written stays put.
  //   1. Same normalised email or same valid phone: the same person, confidence 1.
  //   2. Otherwise a full name (first + last) at least opts.nameMin (0.9) alike, and NO clash (both have a phone and
  //      the phones differ, or both have an email and the emails differ): joined, confidence = similarity x 0.88,
  //      which is always below 0.9, so check is set and Lisa sees "check". Two people with the same first name and
  //      different phones are never joined.
  //   3. Otherwise a new person.
  // When one incoming record links two stored people (email of one, phone of another) both stay; the later one is
  // marked check "same as <key>?" for Lisa. Returns { people: [rows to upsert], assign: { enquiry_key: person_key } }.
  var CONSENT_RANK = { 'do-not-contact': 3, unsubscribed: 2, ok: 1, unknown: 0, '': 0 };
  function strongIds(p, dc) { return { em: emailKey(p.email), ph: phoneKey(p.phone_e164 || p.phone, dc) }; }
  function clash(a, b, dc) {
    var x = strongIds(a, dc), y = strongIds(b, dc);
    return !!((x.ph && y.ph && x.ph !== y.ph) || (x.em && y.em && x.em !== y.em));
  }
  function addSource(list, s) {
    var out = String(list || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean);
    String(s || '').split(',').forEach(function (t) { t = t.trim(); if (t && out.indexOf(t) < 0) out.push(t); });
    return out.join(', ');
  }
  function stickyConsent(a, b) { return (CONSENT_RANK[b] || 0) > (CONSENT_RANK[a] || 0) ? b : (a || b || 'unknown'); }
  // Merge two versions of one People row: blanks never overwrite, stated country beats inferred, sources add up,
  // first contact is the earliest, last touch the latest, do-not-contact never switches itself off.
  function mergePerson(stored, incoming) {
    var out = {}, k; stored = stored || {}; incoming = incoming || {};
    for (k in stored) if (Object.prototype.hasOwnProperty.call(stored, k)) out[k] = stored[k];
    for (k in incoming) if (Object.prototype.hasOwnProperty.call(incoming, k) && k !== 'check' && k !== '_row' && (out[k] === undefined || out[k] === '') && incoming[k] !== '') out[k] = incoming[k];
    if (incoming.country && (!out.country || (out.country_basis !== 'stated' && incoming.country_basis === 'stated'))) {
      out.country = incoming.country; out.country_basis = incoming.country_basis || out.country_basis || '';
    }
    out.sources = addSource(out.sources, incoming.sources);
    var f = [stored.first_contact_uk, incoming.first_contact_uk].filter(Boolean).sort();
    out.first_contact_uk = f[0] || '';
    var l = [stored.last_touch_uk, incoming.last_touch_uk].filter(Boolean).sort();
    out.last_touch_uk = l.length ? l[l.length - 1] : '';
    if (incoming.touches !== undefined && incoming.touches !== '') out.touches = incoming.touches;
    out.consent = stickyConsent(String(stored.consent || ''), String(incoming.consent || ''));
    out.do_not_contact = truthy(stored.do_not_contact) || truthy(incoming.do_not_contact) || CONSENT_RANK[out.consent] >= 2;
    ['repeat_buyer', 'past_deposit'].forEach(function (c) { out[c] = truthy(stored[c]) || truthy(incoming[c]); });
    var cs = stored.match_confidence, ci = incoming.match_confidence;
    if (ci !== undefined && ci !== '') out.match_confidence = (cs === undefined || cs === '') ? Number(ci) : Math.min(Number(cs), Number(ci));
    if (incoming.check && String(stored.check || '').indexOf(incoming.check) < 0) out.check = stored.check ? stored.check + '; ' + incoming.check : incoming.check;
    if (out.check === undefined) out.check = '';
    return out;
  }
  function nextRef(people) {
    var n = 0;
    (people || []).forEach(function (p) { var m = String(p.ref || '').match(/^C-(\d+)$/); if (m) n = Math.max(n, Number(m[1])); });
    return n;
  }
  function pad4(n) { return ('000' + n).slice(-Math.max(4, String(n).length)); }
  function resolvePeople(existing, incoming, opts) {
    opts = opts || {};
    var dc = opts.defaultCode, min = opts.nameMin || 0.9, people = [], touched = {}, assign = {};
    (existing || []).forEach(function (p) { var c = {}; for (var k in p) if (k !== '_row') c[k] = p[k]; people.push(c); });
    var refN = nextRef(people);
    (incoming || []).forEach(function (r) {
      var me = strongIds(r, dc), strong = [], at = -1, conf = 1, check = '';
      people.forEach(function (p, i) { var x = strongIds(p, dc); if ((me.em && me.em === x.em) || (me.ph && me.ph === x.ph)) strong.push(i); });
      if (strong.length) {
        strong.sort(function (a, b) { return String(people[a].first_contact_uk || '9').localeCompare(String(people[b].first_contact_uk || '9')) || a - b; });
        at = strong[0];
        strong.slice(1).forEach(function (i) {
          var note = 'same as ' + people[at].person_key + '?';
          if (String(people[i].check || '').indexOf(note) < 0) { people[i] = mergePerson(people[i], { check: note, match_confidence: 0.5 }); touched[i] = 1; }
        });
      } else if (nameKey(r.name)) {
        var best = -1, bs = 0;
        people.forEach(function (p, i) {
          if (clash(p, r, dc)) return;
          var s = nameSimilarity(p.name, r.name);
          if (s > bs) { bs = s; best = i; }
        });
        if (best >= 0 && bs >= min) { at = best; conf = Math.round(bs * 0.88 * 100) / 100; check = 'name match ' + conf; }
      }
      var row = { name: r.name || '', email: normaliseEmail(r.email), phone_e164: (normalisePhone(r.phone_e164 || r.phone, dc).e164) || '',
        country: r.country || '', country_basis: r.country_basis || '', sources: r.channel || r.sources || '',
        first_contact_uk: r.received_uk || r.first_contact_uk || '', consent: r.consent || 'unknown',
        do_not_contact: truthy(r.do_not_contact), match_confidence: conf, check: check };
      if (at < 0) {
        var id = me.em || me.ph || ('row|' + (r.enquiry_key || people.length));
        row.person_key = 'P-' + hash(id); row.ref = 'C-' + pad4(++refN);
        people.push(mergePerson({}, row)); at = people.length - 1;
      } else {
        people[at] = mergePerson(people[at], row);
      }
      touched[at] = 1;
      if (r.enquiry_key) assign[r.enquiry_key] = people[at].person_key;
    });
    return { people: Object.keys(touched).map(function (i) { return people[i]; }), assign: assign };
  }

  // ---- History: touches per person (Stage 6) -------------------------------------------------------------------
  // From the Events tab (each event carries enquiry_key, and person_key once known) and the enquiry -> person map.
  // Returns { person_key: { touches, first_uk, last_uk } }. A touch is any event (received, booked, replied ...).
  function personHistory(events, personOf) {
    var out = {};
    (events || []).forEach(function (e) {
      var pk = e.person_key || (personOf || {})[e.enquiry_key];
      if (!pk) return;
      var h = out[pk] = out[pk] || { touches: 0, first_uk: '', last_uk: '' };
      h.touches++;
      var at = String(e.at_uk || '');
      if (at && (!h.first_uk || at < h.first_uk)) h.first_uk = at;
      if (at && at > h.last_uk) h.last_uk = at;
    });
    return out;
  }

  // ---- Past deposits (Stage 6) ---------------------------------------------------------------------------------
  // The litter allocation sheets (current tab and the old deposit list) are read by the engine and turned straight
  // into hashed keys here: no name, email or number is kept, only 'em:', 'ph:' and 'nm:' hashes. A name-only match
  // ('nm:') is weaker and sets check. repeatWords say a deposit ended in a sale (collected, sold ...).
  var REPEAT_WORDS = /\b(collected|sold|home|went home|completed|bought|handed over)\b/i;
  function depositKeys(rows, opts) {
    opts = opts || {};
    var dc = opts.defaultCode, re = opts.repeatWords || REPEAT_WORDS, out = {};
    function put(k, sold) { if (!k) return; var o = out[k] = out[k] || { sold: false }; if (sold) o.sold = true; }
    (rows || []).forEach(function (r) {
      if (Object.prototype.hasOwnProperty.call(r, 'deposit') && !String(r.deposit == null ? '' : r.deposit).trim()) return; // a lead, not a deposit
      var sold = re.test([r.status, r.outcome, r.stage, r.section].join(' '));
      put(emailKey(r.email), sold);
      put(phoneKey(r.phone || r.whatsapp, dc), sold);
      var nk = nameKey(r.name);
      if (nk.split(' ').length >= 2) put('nm:' + hash(nk), sold);
    });
    return out;
  }
  // Allocation-sheet values (header row first) to plain rows for depositKeys(). Column names vary between the current
  // tab and the old deposit list, so each field takes the first header that fits. A row counts as a deposit only when
  // a deposit column holds something (leads with no deposit are skipped by depositKeys).
  var DEP_COLS = { name: /^(name|xero_contact|contact|buyer)$/i, email: /^e-?mail$/i, phone: /^(whatsapp|phone|mobile)$/i,
    status: /^(status|section)$/i, outcome: /^(outcome.*|old_.*stage)$/i, deposit: /^(deposit_date|first_deposit|deposit_total|deposit)$/i };
  function depositRowsFrom(values) {
    var v = values || [], head = (v[0] || []).map(function (h) { return String(h == null ? '' : h).trim(); }), at = {};
    Object.keys(DEP_COLS).forEach(function (f) {
      at[f] = [];
      head.forEach(function (h, i) { if (DEP_COLS[f].test(h)) at[f].push(i); });
    });
    return v.slice(1).map(function (r) {
      var o = {};
      Object.keys(at).forEach(function (f) {
        if (!at[f].length) return;
        o[f] = at[f].map(function (i) { return r[i] == null ? '' : String(r[i]).trim(); }).filter(Boolean).join(' ');
      });
      return o;
    });
  }
  // Flags for one person from depositKeys(). Returns { past_deposit, repeat_buyer, check }.
  function depositFlags(person, keys, dc) {
    keys = keys || {};
    var ids = strongIds(person || {}, dc), hit = keys[ids.em] || keys[ids.ph], check = '';
    if (!hit) {
      var nk = nameKey((person || {}).name);
      if (nk.split(' ').length >= 2) { hit = keys['nm:' + hash(nk)]; if (hit) check = 'deposit list match on name only'; }
    }
    return { past_deposit: !!hit, repeat_buyer: !!(hit && hit.sold), check: check };
  }

  // ---- Deposits and balances report (Stage 11) ------------------------------------------------------------------
  // Report only. Amounts come from the allocation sheets and a Xero invoice CSV EXPORT that Lisa or the Money Hub drops
  // into the private requests folder; nothing here makes an invoice, a payment link or a reminder, and nothing is ever
  // written to Xero, Activepieces or an allocation sheet. Amounts per person live only in the private Deposits tab.
  function money(v) {
    var s = String(v == null ? '' : v).replace(/[£€$,\s]|GBP|EUR/gi, '');
    return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
  }
  // A date cell to YYYY-MM-DD: 2026-08-01, 01/08/2026 (UK order), 1 Aug 2026 or a Date. '' when unreadable.
  function isoDate(v) {
    if (v instanceof Date) return isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
    var s = String(v == null ? '' : v).trim(), m;
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return m[1] + '-' + m[2] + '-' + m[3];
    if ((m = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/))) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    if ((m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})$/)) && MONTHS.indexOf(m[2].toLowerCase()) >= 0)
      return m[3] + '-' + ('0' + (MONTHS.indexOf(m[2].toLowerCase()) + 1)).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    return '';
  }
  // CSV text (RFC 4180: quotes, doubled quotes, CRLF, a leading BOM) to rows of strings. Blank lines are dropped.
  function parseCsv(text) {
    var t = String(text || '').replace(/^﻿/, ''), rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < t.length; i++) {
      var c = t[i];
      if (q) {
        if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return String(x).trim(); }); });
  }
  // Allocation tab (header first) to Deposits rows: one per person whose deposit date or amount is filled. People are
  // carried as hashed person keys only. opts as litterRowsFrom: { personKeyOf, litterRef, source, defaultCode }.
  var LEDGER_COLS = { section: /^section$/i, ref: /^(ref|xero_contact_id)$/i, status: /^status$/i, outcome: /^(outcome.*|old_.*stage)$/i,
    date: /^(deposit_date|first_deposit)$/i, amount: /^(deposit|deposit_total|deposit_amount)$/i, due: /^balance(_due)?$/i,
    paid: /^balance_paid$/i, collect: /^(collection|collection_date|collect(ion)?_on|go_home)$/i, pup: /^(provisional_pup|pup|pup_ref)$/i,
    litter: /^litter(_ref)?$/i, email: /^e-?mail$/i, phone: /^(whatsapp|phone|mobile)$/i };
  function depositLedgerFrom(values, opts) {
    opts = opts || {};
    var v = values || [], head = (v[0] || []).map(function (h) { return String(h == null ? '' : h).trim(); }), at = {}, out = [];
    Object.keys(LEDGER_COLS).forEach(function (f) { at[f] = -1; head.forEach(function (h, i) { if (at[f] < 0 && LEDGER_COLS[f].test(h)) at[f] = i; }); });
    function cell(r, f) { return at[f] < 0 || r[at[f]] == null ? '' : r[at[f]] instanceof Date ? r[at[f]] : String(r[at[f]]).trim(); }
    v.slice(1).forEach(function (r, n) {
      var section = String(cell(r, 'section')), date = isoDate(cell(r, 'date')) || String(cell(r, 'date')), amount = String(cell(r, 'amount'));
      if (/^pups?$/i.test(section) || (!date && !amount)) return;
      var words = [cell(r, 'status'), cell(r, 'outcome')].join(' '), pup = String(cell(r, 'pup'));
      var status = /refund/i.test(words) ? 'refunded' : REPEAT_WORDS.test(words) ? 'collected' : isClosedList(section) ? 'closed' : 'held';
      var pk = opts.personKeyOf ? opts.personKeyOf(String(cell(r, 'email')), String(cell(r, 'phone'))) : '', check = '';
      if (!pk) {
        var id = emailKey(String(cell(r, 'email'))) || phoneKey(String(cell(r, 'phone')), opts.defaultCode);
        pk = id ? 'P-' + hash(id) : 'P-' + hash('alloc|' + (opts.source || '') + '|' + (cell(r, 'ref') || n));
        check = 'not matched to an enquiry yet';
      }
      if (amount && isNaN(money(amount))) check = (check ? check + '; ' : '') + 'deposit amount unreadable';
      out.push({ deposit_key: 'D-' + hash(['alloc', opts.source || '', cell(r, 'ref') || n, pk].join('|')),
        litter_ref: opts.litterRef || String(cell(r, 'litter')) || (pup.indexOf('-') > 0 ? pup.slice(0, pup.indexOf('-')) : ''),
        pup_ref: pup, person_key: pk, deposit_date: date, deposit: amount, balance_due: String(cell(r, 'due')), balance_paid: String(cell(r, 'paid')),
        collection_date: isoDate(cell(r, 'collect')) || String(cell(r, 'collect')), status: status, basis: 'allocation sheet', check: check });
    });
    return out;
  }
  // Held, due and overdue totals from Deposits rows, overall and by litter. Only 'held' rows count (a suggested Xero
  // match waits for Lisa's tap). A balance is due when the collection date falls within dueDays (30) from now and the
  // balance is not paid; overdue when the collection date has passed and it is still not paid.
  function depositTotals(rows, now, opts) {
    opts = opts || {};
    var t = now == null ? Date.now() : toMs(now), days = opts.dueDays || 30, all = blank(), by = {};
    function blank() { return { held_count: 0, held: 0, due_count: 0, due: 0, overdue_count: 0, overdue: 0, undated: 0, unreadable: 0, suggested: 0 }; }
    (rows || []).forEach(function (r) {
      var lr = r.litter_ref || '(no litter)', b = by[lr] = by[lr] || blank();
      [all, b].forEach(function (o) {
        if (r.status === 'suggested') { o.suggested++; return; }
        if (r.status !== 'held') return;
        var d = money(r.deposit), due = money(r.balance_due), paid = money(r.balance_paid);
        o.held_count++;
        if (String(r.deposit || '').trim() && isNaN(d)) o.unreadable++; else if (!isNaN(d)) o.held += d;
        if (String(r.balance_due || '').trim() && isNaN(due)) o.unreadable++;
        var owed = isNaN(due) ? 0 : Math.max(0, due - (isNaN(paid) ? 0 : paid));
        var settled = String(r.balance_due || '').trim() ? owed === 0 : String(r.balance_paid || '').trim() !== '';
        var c = toMs(r.collection_date);
        if (isNaN(c)) { o.undated++; return; }
        if (settled) return;
        if (c < t) { o.overdue_count++; o.overdue += owed; } else if (c - t <= days * 86400000) { o.due_count++; o.due += owed; }
      });
    });
    return { all: all, byLitter: by };
  }
  // Xero invoice CSV export rows (header first) to paid invoices: { invoice_key, email, date, amount }. Only the
  // email, number, date and paid amount are read: no name, address or line text is kept.
  var XERO_COLS = { email: /^(email ?address|e-?mail|\*?emailaddress)$/i, number: /^\*?invoice ?number$/i,
    date: /^(\*?invoice ?date|payment ?date|paid ?date|date)$/i, paid: /^(invoice ?amount ?paid|amount ?paid|paid)$/i,
    total: /^(\*?total|invoice ?total|amount)$/i, owed: /^(invoice ?amount ?due|amount ?due|due)$/i, status: /^status$/i };
  function xeroInvoicesFrom(values) {
    var v = values || [], head = (v[0] || []).map(function (h) { return String(h == null ? '' : h).trim(); }), at = {}, out = [];
    Object.keys(XERO_COLS).forEach(function (f) { at[f] = -1; head.forEach(function (h, i) { if (at[f] < 0 && XERO_COLS[f].test(h)) at[f] = i; }); });
    function cell(r, f) { return at[f] < 0 || r[at[f]] == null ? '' : String(r[at[f]]).trim(); }
    v.slice(1).forEach(function (r) {
      var st = cell(r, 'status'), amt = at.paid >= 0 ? money(cell(r, 'paid')) : money(cell(r, 'total')), owed = money(cell(r, 'owed'));
      var paid = st ? /^paid$/i.test(st) : at.owed >= 0 ? owed === 0 : at.paid >= 0;
      var em = normaliseEmail(cell(r, 'email'));
      if (!paid || isNaN(amt) || amt <= 0 || !em) return;
      out.push({ invoice_key: 'X-' + hash([cell(r, 'number'), em, cell(r, 'date'), amt].join('|')), email: em, date: isoDate(cell(r, 'date')), amount: amt.toFixed(2) });
    });
    return out;
  }
  // Suggest Xero invoices as deposits: the email must match an open enquiry AND the amount must equal one of the
  // deposit amounts in Settings. Same email, other amount: refused. Returns { suggested, refused, unmatched }.
  function matchInvoices(invoices, candidates, amounts) {
    var ok = (amounts || []).map(money).filter(function (n) { return !isNaN(n); }), byEm = {}, out = { suggested: [], refused: [], unmatched: 0 };
    (candidates || []).forEach(function (c) { var em = normaliseEmail(c.email); if (em && !byEm[em]) byEm[em] = c; });
    (invoices || []).forEach(function (iv) {
      var c = byEm[normaliseEmail(iv.email)], amt = money(iv.amount);
      if (!c) { out.unmatched++; return; }
      if (!ok.some(function (a) { return Math.abs(a - amt) < 0.005; })) { out.refused.push({ invoice_key: iv.invoice_key, enquiry_key: c.enquiry_key, why: 'amount is not a deposit amount' }); return; }
      out.suggested.push({ invoice_key: iv.invoice_key, enquiry_key: c.enquiry_key, person_key: c.person_key, litter_ref: c.litter_ref || '', date: iv.date, amount: amt.toFixed(2) });
    });
    return out;
  }
  // The page's "deposit paid" tap (request-file pattern). Never carries an amount. depositKey confirms a suggested row.
  function depositPaidRequest(enquiryKey, depositKey, nowIso) {
    if (!/^K-[0-9a-f]{16}$/.test(String(enquiryKey || ''))) return { ok: false, error: 'Unknown enquiry.' };
    if (depositKey && !/^D-[0-9a-f]{16}$/.test(String(depositKey))) return { ok: false, error: 'Unknown deposit row.' };
    var at = nowIso || new Date().toISOString();
    return { ok: true, name: 'ENQ-deposit-paid-' + at.replace(/[^0-9]/g, '').slice(0, 14) + '-' + String(enquiryKey).slice(2, 8) + '.json',
      body: { v: 1, kind: 'deposit-paid', enquiry_key: enquiryKey, deposit_key: depositKey || '', at: at } };
  }

  // ---- What they asked for (Stage 7) ---------------------------------------------------------------------------
  // Sex, size, colour, coat and breed words in free text. Only fills what the enquiry row leaves blank.
  var PREF_WORDS = {
    sex: [['female', /\b(girls?|female|bitch(es)?)\b/i], ['male', /\b(boys?|males?)\b/i]],
    size: [['miniature', /\b(mini(ature)?)\b/i], ['medium', /\bmedium\b/i], ['standard', /\b(standard|large)\b/i]],
    colour: [['chocolate', /\bchoc(olate)?\b/i], ['caramel', /\bcaramel\b/i], ['cream', /\bcream\b/i], ['black', /\bblack\b/i],
      ['red', /\bred\b/i], ['apricot', /\bapricot\b/i], ['gold', /\bgold(en)?\b/i], ['parti', /\bparti\b/i], ['phantom', /\bphantom\b/i],
      ['cafe', /\bcaf[eé]\b/i], ['lavender', /\blavender\b/i], ['chalk', /\bchalk\b/i]],
    coat: [['fleece', /\bfleece\b/i], ['wool', /\bwool(ly)?\b/i], ['hair', /\bhair coat\b/i]],
    breed_interest: [['Cobberdog', /\bcobber(dog)?s?\b/i], ['Labradoodle', /\b(labra)?doodles?\b/i]]
  };
  function extractPrefs(text, row) {
    var t = String(text || ''), r = row || {}, out = {};
    Object.keys(PREF_WORDS).forEach(function (f) {
      if (r[f]) { out[f] = r[f]; return; }
      var hits = PREF_WORDS[f].filter(function (w) { return w[1].test(t); }).map(function (w) { return w[0]; });
      if (f === 'breed_interest' && hits.length > 1) out[f] = 'either';
      else if (hits.length === 1) out[f] = hits[0];
      else out[f] = '';
    });
    return out;
  }
  // Does one pup fit what the enquiry asked? A field the enquiry leaves blank (or "either") fits anything.
  function pupFits(prefs, pup) {
    prefs = prefs || {}; pup = pup || {};
    return ['sex', 'size', 'colour', 'coat'].every(function (f) {
      var want = String(prefs[f] || '').toLowerCase(), have = String(pup[f] || '').toLowerCase();
      return !want || want === 'either' || !have || have.indexOf(want) >= 0;
    });
  }

  // When they want a pup, in months from now (0 = now), or null when the text does not say.
  var MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  var SEASON = { spring: 2, summer: 5, autumn: 8, fall: 8, winter: 11 }; // the month a season starts (0 = January)
  function timingMonths(text, now) {
    var t = String(text || '').toLowerCase(), d = new Date(toMs(now) || Date.now());
    var y0 = d.getUTCFullYear(), m0 = d.getUTCMonth();
    if (/\b(asap|as soon as possible|right away|straight away|now|this month|immediately|ready now)\b/.test(t)) return 0;
    if (/\bnext month\b/.test(t)) return 1;
    var m = t.match(/\b(?:in|within)\s+(\d{1,2})\s*(weeks?|months?)\b/);
    if (m) return m[2].charAt(0) === 'w' ? Math.round(Number(m[1]) / 4.3) : Number(m[1]);
    if (/\bnext year\b/.test(t)) return 12 - m0;
    var yr = (t.match(/\b(20\d\d)\b/) || [])[1];
    var mon = -1;
    MONTHS.forEach(function (n, i) { if (mon < 0 && new RegExp('\\b' + n + '[a-z]*\\b').test(t)) mon = i; });
    if (mon < 0) Object.keys(SEASON).forEach(function (n) { if (mon < 0 && new RegExp('\\b' + n + '\\b').test(t)) mon = SEASON[n]; });
    if (mon < 0 && !yr) return null;
    var y = yr ? Number(yr) : y0;
    if (mon < 0) mon = yr && Number(yr) > y0 ? 0 : m0;
    var diff = (y - y0) * 12 + (mon - m0);
    if (diff < 0 && !yr) diff += 12;
    return Math.max(0, diff);
  }

  // ---- Triage and scoring (Stage 7) ----------------------------------------------------------------------------
  // Score 0 to 100 from weights Lisa keeps in Settings (score_weights, score_bands). Every score comes with its top 3
  // reasons. Sensitive things (allergies, a neurodiverse home, young children, export to a hard country) are flags
  // that are SHOWN, never scored down: the same message with or without them scores the same.
  var WEIGHTS = { timing: 20, fit: 15, deposit: 15, home: 10, uk: 10, repeat: 15, call: 15 };
  var BAND_AT = { hot: 70, warm: 45, cool: 20 };
  function parseNumbers(text, defaults) {
    var out = {}, k;
    for (k in defaults) out[k] = defaults[k];
    String(text || '').split(',').forEach(function (p) {
      var m = p.match(/^\s*([a-z-]+)\s*=\s*(-?\d+(\.\d+)?)\s*$/i);
      if (m && Object.prototype.hasOwnProperty.call(defaults, m[1].toLowerCase())) out[m[1].toLowerCase()] = Number(m[2]);
    });
    return out;
  }
  var DEPOSIT_WORDS = /\b(deposit|ready to (pay|commit|go)|reserve|secure (a|one|our)|put (a|my|our) name down|waiting list|book (a|one|our) pup|how do (i|we) (pay|reserve|book))\b/i;
  var HOME_WORDS = /\b(garden|fenced|work(s|ing)? from home|wfh|retired|at home all day|had dogs|have had|owned (a )?dogs?|experience(d)? (with|owner)|grew up with dogs|current dog|our (old|last) dog|dog walker|puppy class(es)?)\b/i;
  var SENSITIVE = [
    ['allergies', /\b(allerg\w*|asthma\w*)\b/i],
    ['neurodiverse home', /\b(autis\w*|asd|adhd|neurodiver\w*|sensory needs?|special needs|send)\b/i],
    ['young children', /\b(toddlers?|bab(y|ies)|newborn|young (children|kids|family)|little ones|under (5|five)s?|(1|2|3|4|one|two|three|four)[- ]?(year|yr)[- ]?old)\b/i]
  ];
  var HOME_COUNTRIES = ['United Kingdom', 'Jersey', 'Guernsey', 'Isle of Man'];
  function listOf(v) { return Array.isArray(v) ? v : String(v || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean); }
  // e: an Enquiries row. ctx: { now, person (People row), openPups: [Litters rows], weights, bands, simpleCountries,
  // hardCountries }. Returns { score, band, reasons: [3 at most, never none], flags: [], prefs }.
  function scoreEnquiry(e, ctx) {
    e = e || {}; ctx = ctx || {};
    var w = ctx.weights && typeof ctx.weights === 'object' ? Object.assign({}, WEIGHTS, ctx.weights) : parseNumbers(ctx.weights, WEIGHTS);
    var b = ctx.bands && typeof ctx.bands === 'object' ? Object.assign({}, BAND_AT, ctx.bands) : parseNumbers(ctx.bands, BAND_AT);
    var text = [e.question_summary, e.timing, e.household_flags].filter(Boolean).join(' · ');
    var prefs = extractPrefs(text, e), got = [], flags = [];
    function add(points, why) { if (points > 0) got.push({ p: points, why: why + ' (+' + points + ')' }); }
    var tm = timingMonths(e.timing || text, ctx.now);
    if (tm !== null && tm <= 3) add(w.timing, 'Wants a pup within 3 months');
    else if (tm !== null && tm <= 6) add(Math.round(w.timing / 2), 'Wants a pup in 4 to 6 months');
    var open = (ctx.openPups || []).filter(function (p) { return /^(open|available|for sale)$/i.test(String(p.status || '').trim()); });
    if (e.kind === 'puppy' || !e.kind) {
      var fits = open.filter(function (p) { return pupFits(prefs, p); });
      var stated = ['sex', 'size', 'colour', 'coat'].some(function (f) { return prefs[f]; });
      if (fits.length && stated) add(w.fit, fits.length + ' open pup' + (fits.length > 1 ? 's fit' : ' fits') + ' what they asked');
      else if (fits.length) add(Math.round(w.fit / 2), 'Open pups now; no preference stated yet');
    }
    if (DEPOSIT_WORDS.test(text)) add(w.deposit, 'Talks about a deposit or reserving');
    if (HOME_WORDS.test(text)) add(w.home, 'Home and dog experience sound right');
    var simple = listOf(ctx.simpleCountries);
    if (HOME_COUNTRIES.indexOf(e.country) >= 0) add(w.uk, 'Lives in the UK');
    else if (e.country && simple.indexOf(e.country) >= 0) add(Math.round(w.uk / 2), 'Simple import (' + e.country + ')');
    var person = ctx.person || {};
    if (truthy(person.repeat_buyer)) add(w.repeat, 'Has bought from us before');
    else if (truthy(person.past_deposit)) add(Math.round(w.repeat / 2), 'Paid a deposit before');
    if (e.channel === 'calendly' || stageRank(e.stage) >= stageRank('call-booked')) add(w.call, 'Booked a call');
    SENSITIVE.forEach(function (s) { if (s[1].test(text)) flags.push(s[0]); });
    var hard = listOf(ctx.hardCountries);
    if (e.country && hard.indexOf(e.country) >= 0) flags.push('export to ' + e.country);
    var score = Math.max(0, Math.min(100, got.reduce(function (a, g) { return a + g.p; }, 0)));
    got.sort(function (x, y) { return y.p - x.p; });
    var reasons = got.slice(0, 3).map(function (g) { return g.why; });
    if (!reasons.length) reasons = ['No fit signals yet: nothing on timing, home, deposit or a call (0)'];
    var band = score >= b.hot ? 'hot' : score >= b.warm ? 'warm' : score >= b.cool ? 'cool' : 'not-a-fit';
    return { score: score, band: band, reasons: reasons, flags: flags, prefs: prefs };
  }

  // ---- Reply drafts in Lisa's style (Stage 8) ------------------------------------------------------------------
  // Drafts only: written to the Drafts tab and shown in copy boxes; Lisa sends every message herself. The wording
  // follows her own approved texts (sales plan Appendix A and B) until the style guide from her sent mail is approved.
  // Never a price, a £ figure, a COI value, the licence number, a puppyclassroom.com link or "hypoallergenic" without
  // "low-shedding". Every draft carries at least one info link. checkDraft() enforces all of this on every draft.
  var INFO = 'https://doc.labradoodles.co.uk/';
  var LINKS = { breed: INFO + 'breed', health: INFO + 'health-tests', sizes: INFO + 'sizes', colour: INFO + 'colour', coats: INFO + 'coats' };
  var UK_PET_TRAVEL = 'https://www.gov.uk/taking-your-pet-abroad';
  var BRAND_LINE = 'Australian Labradoodles/Cobberdogs, www.cobberdogs.com';
  var STOP_LINE = "If you would rather not hear from me again, reply STOP and I won't contact you again.";
  var CASES = ['first-uk', 'first-abroad', 'after-call', 'waiting-list', 'pup-offer', 'no-fit-now', 'adult-dog', 'breeder', 'missed', 'gentle-close',
    'check-in', 'call-check-in', 'offer-check-in', 'waiting-check-in'];
  // Cases the engine may pick by itself. A pup offer is Lisa's alone: it is only ever drafted when she asks for it.
  var AUTO_CASES = ['first-uk', 'first-abroad', 'after-call', 'no-fit-now', 'adult-dog', 'breeder', 'missed', 'gentle-close'];

  function firstName(name) {
    var t = String(name || '').trim().split(/\s+/)[0] || '';
    return /^[A-Za-zÀ-ɏ'-]{2,}$/.test(t) ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : '';
  }
  // Which links fit: always the breed page, then what they asked about; the missed-enquiry apology carries all five.
  function linksFor(kase, prefs) {
    prefs = prefs || {};
    if (kase === 'missed') return [LINKS.breed, LINKS.sizes, LINKS.colour, LINKS.coats, LINKS.health];
    var out = [LINKS.breed];
    if (prefs.size) out.push(LINKS.sizes);
    if (prefs.colour) out.push(LINKS.colour);
    if (prefs.coat) out.push(LINKS.coats);
    if (kase === 'breeder' || kase === 'adult-dog' || out.length === 1) out.push(LINKS.health);
    return out;
  }
  // The official page for buyers abroad: Lisa keeps a country=URL list in Settings (import_pages). With no page on
  // file the draft points to the UK government pet travel page and says "Lisa to confirm" for the country's rules.
  function importLine(country, pages) {
    var map = {};
    String(pages || '').split(/[\n;]+/).forEach(function (p) {
      var m = p.match(/^\s*([^=]+?)\s*=\s*(https:\/\/\S+)\s*$/);
      if (m && /\.(gov\.uk|admin\.ch|gov|gouv\.fr|europa\.eu|gv\.at|bund\.de|govt\.nz|gov\.au|gc\.ca|gov\.ie)(\/|$)/i.test(m[2])) map[m[1].toLowerCase()] = m[2];
    });
    var own = map[String(country || '').toLowerCase()];
    if (own) return { text: 'The official rules for bringing a puppy to ' + country + ' are here: ' + own, link: own };
    return { text: 'For travel from the UK the government page is ' + UK_PET_TRAVEL + '. The rules for ' + (country || 'your country') + ' are: Lisa to confirm.', link: UK_PET_TRAVEL };
  }
  // Pick the case for an enquiry with no reply yet. ctx: { now, missedDays (7) }.
  function chooseCase(e, ctx) {
    e = e || {}; ctx = ctx || {};
    var days = hoursSince(e.received_uk, ctx.now) / 24, missed = ctx.missedDays || 7;
    if (e.stage === 'call-held') return 'after-call';
    if (e.stage && e.stage !== 'new') return '';
    if (e.kind === 'adult-dog') return 'adult-dog';
    if (e.kind === 'breeding-set' || e.kind === 'stud' || e.channel === 'cf-breeding') return 'breeder';
    if (days > missed) return 'missed';
    if (e.country && HOME_COUNTRIES.indexOf(e.country) < 0) return 'first-abroad';
    return 'first-uk';
  }
  function sign(lines) { return lines.concat(['', 'Kind regards,', '', 'Lisa', '', BRAND_LINE]); }
  // Build one case as { email: { subject, text }, whatsapp, links }. o: { name, country, prefs, importPages }.
  function buildDraft(kase, o) {
    o = o || {};
    var fn = firstName(o.name), hi = fn ? 'Hi ' + fn + ',' : 'Hi there,', links = linksFor(kase, o.prefs), list = links.join('\n');
    var subject = 'Your puppy enquiry with Australian Labradoodles/Cobberdogs', body, wa, stop = false;
    switch (kase) {
      case 'first-uk':
      case 'first-abroad':
        var imp = kase === 'first-abroad' ? importLine(o.country, o.importPages) : null;
        if (imp && links.indexOf(imp.link) < 0) links.push(imp.link);
        body = [hi, '', 'Thank you for getting in touch about our puppies. I\'d love to help.', '',
          'These pages explain the breed and how we health test:', '', list].concat(imp ? ['', imp.text] : [])
          .concat(['', 'Just reply and tell me what you\'re looking for and when, and I\'ll let you know what we have coming up. If it\'s easier, we can have a short WhatsApp call.']);
        wa = (fn ? 'Hi ' + fn : 'Hi') + ', it\'s Lisa from Australian Labradoodles/Cobberdogs. Thank you for your enquiry, I\'d love to help. The breed: ' + links[0]
          + (imp ? '. Travel: ' + imp.link + ' (rules for ' + (o.country || 'your country') + ': Lisa to confirm)' : '') + '. What are you looking for, and when?';
        break;
      case 'after-call':
        subject = 'Lovely to talk to you';
        body = [hi, '', 'Thank you for your time on the call today. As promised, here are the pages we talked about:', '', list, '',
          'Have a read, and just reply with any questions. I\'ll be in touch about the next step.'];
        wa = (fn ? 'Hi ' + fn : 'Hi') + ', lovely to talk today. Here is the breed page we mentioned: ' + links[0] + '. Any questions, just message me. Lisa';
        break;
      case 'waiting-list':
        subject = 'Our waiting list';
        body = [hi, '', 'Thank you for waiting so patiently. We have a place on our waiting list for you if you would like it.', '',
          'The pages about the breed and our health testing are here:', '', list, '', 'Just reply if you\'d like me to put your name down, and I\'ll send you the details.'];
        wa = (fn ? 'Hi ' + fn : 'Hi') + ', it\'s Lisa. We have a place on our waiting list for you if you\'d like it. Breed info: ' + links[0] + '. Shall I send you the details?';
        break;
      case 'pup-offer':
        subject = 'A puppy for you';
        body = [hi, '', 'I think we may have the right puppy for you: [Lisa: which pup and why].', '', 'The pages about the breed and our health testing are here:', '', list, '',
          'Just reply and I\'ll send you the details.'];
        wa = (fn ? 'Hi ' + fn : 'Hi') + ', it\'s Lisa. I think we may have the right puppy for you: [Lisa: which pup]. Breed info: ' + links[0] + '. Shall I send you the details?';
        break;
      case 'no-fit-now':
        body = [hi, '', 'Thank you for getting in touch. I don\'t have a puppy that fits what you\'re looking for just now, but I\'d love to keep you in mind for our next litters.', '',
          'These pages explain the breed and how we health test:', '', list, '', 'Just reply if you\'d like me to keep you posted.'];
        wa = (fn ? 'Hi ' + fn : 'Hi') + ', it\'s Lisa. I don\'t have a puppy that fits just now, but I\'d love to keep you posted about our next litters. Breed info: ' + links[0];
        break;
      case 'adult-dog':
        subject = 'Our adult dogs';
        body = [hi, '', 'Thank you for asking about our adult dogs. Prices are on request, and I\'m happy to send you the details of any dog you\'re interested in.', '',
          'You can read about the breed and our health testing here:', '', list, '', 'Just reply and tell me what you\'re looking for.'];
        wa = (fn ? 'Hi ' + fn : 'Hi') + ', it\'s Lisa. Thank you for asking about our adult dogs. Price on request: I\'m happy to send details. Breed info: ' + links[0];
        break;
      case 'breeder':
        stop = true;
        subject = 'Cobberdogs from Australian Labradoodles/Cobberdogs';
        body = [hi, '', 'I\'m Lisa from Australian Labradoodles/Cobberdogs in Wales. Thank you for your interest in our breeding dogs.', '',
          'You can read about the breed and our health testing here:', '', list, '', 'Prices are on request. Just reply and I\'ll send you the details, or message me on WhatsApp.'];
        wa = (fn ? 'Hi ' + fn : 'Hi') + ', it\'s Lisa from Australian Labradoodles/Cobberdogs. Thank you for your interest in our breeding dogs; price on request. Breed info: ' + links[0] + '. Reply STOP and I won\'t contact you again.';
        break;
      case 'missed':
        stop = true;
        body = [hi, '', 'Thank you for getting in touch through our website, and I\'m so sorry for the very slow reply. A problem with our website form meant your message never reached me, and that has now been put right.', '',
          'If you are still looking for a puppy, I\'d love to help. These pages explain the breed, sizes, colours, coats and our health testing:', '', list, '',
          'Just reply and tell me what you\'re looking for, and I\'ll let you know what we have coming up.'];
        wa = (fn ? 'Hi ' + fn : 'Hi') + ', it\'s Lisa from Australian Labradoodles/Cobberdogs. I\'m so sorry for the very slow reply: a website problem meant your message never reached me. If you\'re still looking, I\'d love to help. Breed info: ' + links[0] + '. Reply STOP and I won\'t contact you again.';
        break;
      case 'gentle-close':
        subject = 'Still looking?';
        body = [hi, '', 'I just wanted to check in. If you\'re still looking for a puppy I\'d love to help, and if your plans have changed that\'s absolutely fine.', '',
          'The breed pages are here if useful:', '', list];
        wa = (fn ? 'Hi ' + fn : 'Hi') + ', it\'s Lisa. Just checking in: if you\'re still looking I\'d love to help, and if plans have changed that\'s fine. ' + links[0];
        break;
      // Stage 12 follow-ups: short check-ins. Never a price, never a new offer (offers are Lisa's alone).
      case 'check-in':
        subject = 'Just checking in';
        body = [hi, '', 'I just wanted to check my last message reached you. If you\'re still looking for a puppy I\'d love to help, and if now isn\'t the right time that\'s absolutely fine.', '',
          'The breed pages are here if useful:', '', list];
        wa = (fn ? 'Hi ' + fn : 'Hi') + ', it\'s Lisa. Just checking my last message reached you. If you\'re still looking I\'d love to help. ' + links[0];
        break;
      case 'call-check-in':
        subject = 'Following up on our call';
        body = [hi, '', 'Thank you again for your time on the call. I just wanted to see if you had any questions after reading the pages I sent.', '',
          'They are here again if useful:', '', list, '', 'Just reply, or message me on WhatsApp, and I\'ll help with the next step.'];
        wa = (fn ? 'Hi ' + fn : 'Hi') + ', it\'s Lisa. Following up on our call: any questions after reading ' + links[0] + '? Happy to help with the next step.';
        break;
      case 'offer-check-in':
        subject = 'The puppy I mentioned';
        body = [hi, '', 'I just wanted to check you saw my message about the puppy. There\'s no pressure at all: just let me know either way when you can, so I can keep my list fair to everyone.', '',
          'The breed pages are here if useful:', '', list];
        wa = (fn ? 'Hi ' + fn : 'Hi') + ', it\'s Lisa. Just checking you saw my message about the puppy. No pressure: let me know either way when you can. ' + links[0];
        break;
      case 'waiting-check-in':
        subject = 'News from our waiting list';
        body = [hi, '', 'A quick hello from our waiting list. [Lisa: litter news, or "no news yet"]. You are still on our list, and I\'ll be in touch as soon as I have more.', '',
          'The breed pages are here if useful:', '', list, '', 'If anything has changed for you, just reply and let me know.'];
        wa = (fn ? 'Hi ' + fn : 'Hi') + ', it\'s Lisa with a quick waiting-list hello: [Lisa: litter news]. You are still on our list. Breed info: ' + links[0];
        break;
      default: return null;
    }
    var text = sign(body).concat(stop ? ['', STOP_LINE] : []).join('\n');
    return { email: { subject: subject, text: text }, whatsapp: wa, links: links };
  }

  // Everything a draft must never contain. Returns plain-English problems ([] = fine).
  var PRICE_RE = /£|€|\$\s*\d|\b\d[\d,.]*\s*(k\b|pounds?|gbp|eur(os?)?|chf|francs?|usd|dollars?)|\b(gbp|eur|chf|usd)\s*\d|\bprice (is|of|will be|=)\s*\d/i;
  var LICENCE_WORDS = /\blicen[cs]e\s*(no\.?|number|#|ref(erence)?)\b/i, LICENCE_CODE = /\b[A-Z]{2,4}[\s\/-]?\d{3,}\b/;
  function checkDraft(text, o) {
    var t = String(text || ''), why = [];
    o = o || {};
    if (PRICE_RE.test(t)) why.push('a price or money figure');
    if (/\bCOI\b|coefficient of inbreeding|inbreeding (coefficient|%)|\d+(\.\d+)?\s*%\s*(coi|inbreeding)/i.test(t)) why.push('a COI value');
    if (/hypo-?allergenic/i.test(t) && !/low[- ]shedding/i.test(t)) why.push('"hypoallergenic" without "low-shedding"');
    if (LICENCE_WORDS.test(t) || LICENCE_CODE.test(t)) why.push('a licence number or licence-number pattern');
    if (/puppyclassroom\.com/i.test(t)) why.push('a puppyclassroom.com link');
    if (t.indexOf(INFO) < 0) why.push('no info link');
    if (o.stop && t.indexOf('STOP') < 0) why.push('no STOP line on a cold message');
    return why;
  }

  // Lisa's own sent reply, made safe for the private Style tab: quoted text cut off, every email, phone number, money
  // figure and reference code replaced, the greeting name and the recipient's names replaced by <name>. Returns
  // { text, greeting, sign_off, words, links } where links are page addresses only (no query strings).
  function stripForStyle(raw, opts) {
    opts = opts || {};
    var lines = String(raw || '').replace(/\r/g, '').split('\n'), keep = [];
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (/^\s*>/.test(l) || /^On .+wrote:\s*$/.test(l) || /^-{2,}\s*Original Message/i.test(l) || /^From:\s/.test(l)) break;
      keep.push(l);
    }
    var t = keep.join('\n').trim();
    var links = (t.match(/https?:\/\/[^\s<>()]+/g) || []).map(function (u) { return u.replace(/[?#].*$/, '').replace(/[.,;:!]+$/, ''); });
    t = t.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<email>')
      .replace(/(\+|00)\d[\d\s().-]{7,}\d|\b0\d[\d\s-]{8,}\d/g, '<number>')
      .replace(/(£|€|\$)\s*\d[\d,.]*|\b\d[\d,.]*\s*(pounds?|gbp|eur(os?)?|chf|francs?)\b/gi, '<price>')
      .replace(/\b[A-Z]{2,4}[\s\/-]?\d{3,}\b/g, '<ref>')
      .replace(/\b\d{4,}\b/g, '<number>');
    var gm = t.match(/^(hi|hello|dear|good (morning|afternoon|evening))\s+([^\s,!]+)/im);
    var names = (opts.names || []).map(String).join(' ').split(/[\s,<>"]+/).filter(function (n) { return /^[A-Za-zÀ-ɏ'-]{2,}$/.test(n); });
    if (gm && names.indexOf(gm[3]) < 0) names.push(gm[3]);
    names.forEach(function (n) {
      if (/^(lisa|there|all|everyone)$/i.test(n)) return;
      t = t.replace(new RegExp('\\b' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g'), '<name>');
    });
    var first = (t.split('\n')[0] || '').trim(), tail = t.split('\n').filter(function (x) { return x.trim(); }).slice(-3).join(' / ');
    return { text: t, greeting: first.length <= 40 ? first : first.slice(0, 40), sign_off: tail.slice(0, 80),
      words: (t.match(/\S+/g) || []).length, links: links.filter(function (u, j) { return links.indexOf(u) === j; }) };
  }

  // ---- Call prep and after the call (Stage 9) ------------------------------------------------------------------
  // One IANA zone for countries that have one, so the prep card can show the caller's own clock. Countries with
  // several zones (USA, Canada, Australia ...) show "their time: check" rather than a guess.
  var ONE_ZONE = { 'United Kingdom': 'Europe/London', Jersey: 'Europe/Jersey', Guernsey: 'Europe/Guernsey', 'Isle of Man': 'Europe/Isle_of_Man',
    Ireland: 'Europe/Dublin', Switzerland: 'Europe/Zurich', France: 'Europe/Paris', Germany: 'Europe/Berlin', Netherlands: 'Europe/Amsterdam',
    Belgium: 'Europe/Brussels', Italy: 'Europe/Rome', Austria: 'Europe/Vienna', Denmark: 'Europe/Copenhagen', Sweden: 'Europe/Stockholm',
    Norway: 'Europe/Oslo', Finland: 'Europe/Helsinki', Poland: 'Europe/Warsaw', Greece: 'Europe/Athens', Luxembourg: 'Europe/Luxembourg',
    'New Zealand': 'Pacific/Auckland', Singapore: 'Asia/Singapore', 'Hong Kong': 'Asia/Hong_Kong', Japan: 'Asia/Tokyo',
    'United Arab Emirates': 'Asia/Dubai', Israel: 'Asia/Jerusalem', 'South Africa': 'Africa/Johannesburg' };
  function clockIn(ms, zone) {
    try {
      var p = {};
      new Intl.DateTimeFormat('en-GB', { timeZone: zone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        .formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
      return p.weekday + ' ' + p.hour + ':' + p.minute;
    } catch (e) { return ''; }
  }
  // The two questions most worth asking: the first two things the enquiry has not told us yet.
  function questionsToAsk(e, prefs, flags) {
    e = e || {}; prefs = prefs || {}; flags = flags || [];
    var text = [e.question_summary, e.timing, e.household_flags].join(' '), q = [];
    if (flags.indexOf('allergies') >= 0) q.push('Who in the family has allergies, and have they spent time with a low-shedding dog?');
    if (flags.indexOf('young children') >= 0) q.push('How old are the children, and how are they with dogs?');
    if (timingMonths(e.timing || text) === null) q.push('When would you like your puppy to come home?');
    if (!prefs.sex && !prefs.size) q.push('Girl or boy, and what size suits your home?');
    if (!HOME_WORDS.test(text)) q.push('Tell me about your home and day: garden, work hours, other pets?');
    if (e.country && HOME_COUNTRIES.indexOf(e.country) < 0) q.push('How are you thinking of bringing the puppy home to ' + e.country + '?');
    q.push('What made you choose a ' + (prefs.breed_interest === 'Labradoodle' ? 'Labradoodle' : 'Cobberdog') + '?');
    return q.slice(0, 2);
  }
  // The prep card for one booked WhatsApp call. ctx: { now, person, openPups, events (all Events rows), weights,
  // bands, simpleCountries, hardCountries, readyHours (2) }. The card is "ready" from readyHours before the call.
  // Returns null for an enquiry with no booked call.
  function callPrep(e, ctx) {
    e = e || {}; ctx = ctx || {};
    if (e.channel !== 'calendly' || e.stage !== 'call-booked' || !e.next_due_uk) return null;
    var call = toMs(e.next_due_uk), now = ctx.now == null ? Date.now() : toMs(ctx.now), ready = call - (ctx.readyHours || 2) * 3600000;
    if (isNaN(call)) return null;
    var s = scoreEnquiry(e, ctx), zone = ONE_ZONE[e.country];
    var fits = (ctx.openPups || []).filter(function (p) { return /^(open|available|for sale)$/i.test(String(p.status || '').trim()) && pupFits(s.prefs, p); })
      .map(function (p) { return p.pup_ref; }).filter(Boolean);
    var pk = e.person_key, touches = (ctx.events || []).filter(function (v) { return (pk && v.person_key === pk) || v.enquiry_key === e.key; })
      .sort(function (a, b) { return String(b.at_uk).localeCompare(String(a.at_uk)); }).slice(0, 5)
      .map(function (v) { return String(v.at_uk).slice(0, 10) + ' · ' + v.channel + ' · ' + v.type; });
    return {
      enquiry_key: e.key, ref: e.ref || '', call_uk: e.next_due_uk, ready_from_uk: toUk(ready), ready: now >= ready, past: now > call + 3600000,
      score: s.score, band: s.band, reasons: s.reasons, flags: s.flags, asked: e.question_summary || '(nothing written on the booking form)',
      country: e.country || '', country_basis: e.country_basis || '', their_time: zone ? clockIn(call, zone) : (e.country ? 'their time: check' : ''),
      pups: fits, touches: touches, questions: questionsToAsk(e, s.prefs, s.flags), repeat_buyer: truthy((ctx.person || {}).repeat_buyer)
    };
  }
  // The page's one-tap "call held" request (request-file pattern). The engine moves the stage to call-held and the
  // after-call WhatsApp draft follows in the same run.
  function callHeldRequest(enquiryKey, nowIso, note) {
    if (!/^K-[0-9a-f]{16}$/.test(String(enquiryKey || ''))) return { ok: false, error: 'Unknown enquiry.' };
    var at = nowIso || new Date().toISOString(), n = String(note == null ? '' : note).slice(0, 500);
    return { ok: true, name: 'ENQ-call-held-' + at.replace(/[^0-9]/g, '').slice(0, 14) + '-' + String(enquiryKey).slice(2, 8) + '.json',
      body: { v: 1, kind: 'call-held', enquiry_key: enquiryKey, note: n, at: at } };
  }

  // ---- Waiting list and litters (Stage 10) ----------------------------------------------------------------------
  // The allocation sheet's current tab, read only, turned into Litters rows: one row per pup (person_key blank) and
  // one row per person on a list (pup_ref = their provisional pup, if any). People are carried as hashed person keys
  // only: no name, email or number from the allocation sheet is ever written anywhere.
  //   values: the tab, header first (section, ref, name, status, deposit_date, whatsapp, email, ppf, notes, provisional_pup)
  //   opts: { personKeyOf(email, phone) -> person_key, litterRef, source, defaultCode }
  var LIT_COLS = { section: /^section$/i, ref: /^ref$/i, status: /^status$/i, deposit: /^deposit_date$/i, phone: /^(whatsapp|phone)$/i,
    email: /^e-?mail$/i, pref: /^ppf\b/i, notes: /^notes$/i, pup: /^provisional_pup$/i };
  function litterRowsFrom(values, opts) {
    opts = opts || {};
    var v = values || [], head = (v[0] || []).map(function (h) { return String(h == null ? '' : h).trim(); }), at = {}, out = [], order = {};
    Object.keys(LIT_COLS).forEach(function (f) { at[f] = -1; head.forEach(function (h, i) { if (at[f] < 0 && LIT_COLS[f].test(h)) at[f] = i; }); });
    function cell(r, f) { return at[f] < 0 || r[at[f]] == null ? '' : String(r[at[f]]).trim(); }
    var lref = opts.litterRef || '';
    v.slice(1).forEach(function (r) {
      var section = cell(r, 'section'), ref = cell(r, 'ref');
      if (!section && !ref) return;
      var prefs = extractPrefs([cell(r, 'pref'), cell(r, 'notes')].join(' '), {});
      if (/^pups?$/i.test(section)) {
        var lr = lref || (ref.indexOf('-') > 0 ? ref.slice(0, ref.indexOf('-')) : '');
        out.push({ litter_ref: lr, pup_ref: ref, sex: prefs.sex, colour: prefs.colour, size: prefs.size, coat: prefs.coat,
          status: cell(r, 'status').toLowerCase(), person_key: '', list: 'pups', list_order: '', deposit_date: '', source_sheet: opts.source || '' });
        return;
      }
      var list = section.toLowerCase();
      order[list] = (order[list] || 0) + 1;
      var pk = opts.personKeyOf ? opts.personKeyOf(cell(r, 'email'), cell(r, 'phone')) : '';
      if (!pk) { var id = emailKey(cell(r, 'email')) || phoneKey(cell(r, 'phone'), opts.defaultCode); pk = id ? 'P-' + hash(id) : 'P-' + hash('alloc|' + (opts.source || '') + '|' + ref); }
      out.push({ litter_ref: lref, pup_ref: cell(r, 'pup'), sex: prefs.sex, colour: prefs.colour, size: prefs.size, coat: prefs.coat,
        status: cell(r, 'status').toLowerCase(), person_key: pk, list: list, list_order: order[list], deposit_date: cell(r, 'deposit'), source_sheet: opts.source || '' });
    });
    out.forEach(function (o) { o.litter_key = 'L-' + hash([o.source_sheet, o.list, o.pup_ref, o.person_key].join('|')); });
    if (!lref) { var any = out.filter(function (o) { return o.litter_ref; })[0]; if (any) out.forEach(function (o) { if (!o.litter_ref) o.litter_ref = any.litter_ref; }); }
    return out;
  }
  var OPEN_PUP = /^(open|available|for sale)$/i;
  function isClosedList(list) { return /closed|lost|refund/i.test(String(list || '')); }
  // Waiting people matched to open pups by sex, colour, size and coat. Deposit holders come first, then each list in
  // its own order. A person already holding a pup is not matched again. Returns [{ pup_ref, person_key, list, list_order }].
  function matchLitter(rows) {
    var pups = (rows || []).filter(function (r) { return r.list === 'pups' && OPEN_PUP.test(r.status); });
    var waiting = (rows || []).filter(function (r) { return r.list !== 'pups' && !isClosedList(r.list) && !r.pup_ref; })
      .sort(function (a, b) { return (b.deposit_date ? 1 : 0) - (a.deposit_date ? 1 : 0) || String(a.list).localeCompare(String(b.list)) || a.list_order - b.list_order; });
    var out = [];
    pups.forEach(function (p) {
      waiting.forEach(function (w) { if (pupFits(w, p)) out.push({ pup_ref: p.pup_ref, person_key: w.person_key, list: w.list, list_order: w.list_order }); });
    });
    return out;
  }
  // Flags Lisa should see. now: a time; offerDays: 3. Returns [{ litter_key, pup_ref, person_key, flag }].
  function litterFlags(rows, now, offerDays) {
    rows = rows || []; offerDays = offerDays || 3;
    var t = now == null ? Date.now() : toMs(now), out = [], lists = {};
    var held = {}; rows.forEach(function (r) { if (r.list !== 'pups' && r.pup_ref && !isClosedList(r.list)) held[r.pup_ref] = 1; });
    rows.forEach(function (r) {
      if (r.list === 'pups') {
        if (OPEN_PUP.test(r.status) && !held[r.pup_ref]) out.push({ litter_key: r.litter_key, pup_ref: r.pup_ref, person_key: '', flag: 'open pup, no offer' });
        if (/^offered$/i.test(r.status) && r.status_since_uk && (t - toMs(r.status_since_uk)) / 86400000 > offerDays)
          out.push({ litter_key: r.litter_key, pup_ref: r.pup_ref, person_key: '', flag: 'offered more than ' + offerDays + ' days, no answer' });
        return;
      }
      if (isClosedList(r.list)) return;
      if (r.deposit_date && !r.pup_ref) out.push({ litter_key: r.litter_key, pup_ref: '', person_key: r.person_key, flag: 'deposit holder with no pup' });
      (lists[r.person_key] = lists[r.person_key] || []).push(r);
    });
    Object.keys(lists).forEach(function (pk) {
      var l = lists[pk], names = l.map(function (r) { return r.list; }).filter(function (x, i, a) { return a.indexOf(x) === i; });
      if (names.length > 1 || l.length > 1) l.forEach(function (r) { out.push({ litter_key: r.litter_key, pup_ref: r.pup_ref, person_key: pk, flag: 'on two lists (double deposits note)' }); });
    });
    return out;
  }

  // ---- Adult-dog sale (Stage 10) --------------------------------------------------------------------------------
  // From the Sale sheet only three things are read: the sale group, the dog's name and the Status column. Price,
  // COI and every other column are never read, so they can never reach a card.
  var SALE_COLS = { group: /^sale ?group$/i, dog: /^(name|dog|dog name)$/i, status: /^status$/i };
  function saleDogsFrom(values) {
    var v = values || [], head = (v[0] || []).map(function (h) { return String(h == null ? '' : h).trim(); }), at = {};
    Object.keys(SALE_COLS).forEach(function (f) { at[f] = -1; head.forEach(function (h, i) { if (at[f] < 0 && SALE_COLS[f].test(h)) at[f] = i; }); });
    if (at.group < 0 || at.dog < 0) return [];
    return v.slice(1).map(function (r) {
      return { group_ref: String(r[at.group] == null ? '' : r[at.group]).trim(), dog_ref: String(r[at.dog] == null ? '' : r[at.dog]).trim(),
        sale_status: at.status < 0 ? '' : String(r[at.status] == null ? '' : r[at.status]).trim() };
    }).filter(function (d) { return d.group_ref && d.dog_ref; });
  }
  // Adult-dog and breeding-set enquiries joined to a sale group by the dog's name or "group <n>" in what they wrote.
  var REPLY_KIND = { asked: 'reply', 'details-sent': 'reply', viewing: 'viewing', agreed: 'agreed', 'handed-over': 'agreed' };
  function saleReplyRows(enquiries, dogs) {
    var out = [];
    (enquiries || []).forEach(function (e) {
      if (e.kind !== 'adult-dog' && e.kind !== 'breeding-set') return;
      var t = String(e.question_summary || ''), hit = {};
      (dogs || []).forEach(function (d) {
        var byName = new RegExp('\\b' + d.dog_ref.split('/')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(t);
        var m = t.match(/\b(?:group|set)\s*(\d{1,2})\b/i), byGroup = m && String(d.group_ref).split(/[^0-9]+/).indexOf(m[1]) >= 0;
        if (byName || byGroup) hit[d.group_ref + '|' + (byName ? d.dog_ref : '')] = d;
      });
      Object.keys(hit).forEach(function (k) {
        var d = hit[k], dog = k.split('|')[1];
        out.push({ reply_key: 'R-' + hash(e.key + '|' + k), group_ref: d.group_ref, dog_ref: dog, enquiry_key: e.key, person_key: e.person_key || '',
          reply_kind: REPLY_KIND[e.stage] || 'reply', at_uk: e.received_uk || '', sale_status: dog ? d.sale_status : '' });
      });
    });
    return out;
  }
  // One card per sale group: its dogs and their sale status, and counts of replies, viewings and agreed. Price on
  // request only; never a price or a COI value.
  function saleGroupCards(dogs, replies) {
    var by = {};
    (dogs || []).forEach(function (d) { (by[d.group_ref] = by[d.group_ref] || { group_ref: d.group_ref, dogs: [], replies: 0, viewings: 0, agreed: 0, price: 'price on request' }).dogs.push({ dog_ref: d.dog_ref, sale_status: d.sale_status || 'no status' }); });
    var seen = {};
    (replies || []).forEach(function (r) {
      var c = by[r.group_ref]; if (!c) return;
      var k = r.group_ref + '|' + r.enquiry_key; if (seen[k]) return; seen[k] = 1;
      c.replies++; if (r.reply_kind === 'viewing') c.viewings++; if (r.reply_kind === 'agreed') c.agreed++;
    });
    return Object.keys(by).map(function (k) { return by[k]; });
  }
  // A card is refused if any text in it looks like a price or a COI value.
  function checkCard(card) {
    var t = JSON.stringify(card || {}), why = [];
    if (PRICE_RE.test(t) || /"price":"(?!price on request")/.test(t)) why.push('a price');
    if (/\bCOI\b|inbreeding/i.test(t)) why.push('a COI value');
    return why;
  }

  // ---- Do-not-contact gate (Stage 6; used by every draft and follow-up writer) ---------------------------------
  // A person or enquiry marked do-not-contact or unsubscribed is never drafted to and never gets a follow-up.
  function mayContact(person, enquiry) {
    var p = person || {}, e = enquiry || {};
    if (truthy(p.do_not_contact) || CONSENT_RANK[p.consent] >= 2) return { ok: false, why: p.consent && CONSENT_RANK[p.consent] >= 2 ? p.consent : 'do-not-contact' };
    if (truthy(e.do_not_contact) || CONSENT_RANK[e.consent] >= 2) return { ok: false, why: e.consent && CONSENT_RANK[e.consent] >= 2 ? e.consent : 'do-not-contact' };
    return { ok: true, why: '' };
  }
  // Split FollowUps (or Drafts) rows into the ones that may be written and the ones a contact rule blocks.
  function gateContact(items, peopleByKey, enquiriesByKey) {
    var keep = [], blocked = [];
    (items || []).forEach(function (it) {
      var g = mayContact((peopleByKey || {})[it.person_key], (enquiriesByKey || {})[it.enquiry_key]);
      if (g.ok) keep.push(it); else blocked.push({ item: it, why: g.why });
    });
    return { keep: keep, blocked: blocked };
  }

  // ---- Follow-ups (Stage 12) ------------------------------------------------------------------------------------
  // Rules from Settings (followup_rules): days to each follow-up, and tries before the hub suggests lost.
  var FU_DEFAULTS = { 'first-reply': 2, 'after-call': 1, offer: 3, 'waiting-list': 30, 'lost-after': 3 };
  function followUpRules(text) {
    var o = {}, k;
    for (k in FU_DEFAULTS) o[k] = FU_DEFAULTS[k];
    String(text || '').split(/[,;\n]/).forEach(function (part) {
      var m = part.match(/^\s*([a-z-]+)\s*=\s*(\d+(?:\.\d+)?)\s*$/i);
      if (m && Object.prototype.hasOwnProperty.call(FU_DEFAULTS, m[1].toLowerCase())) o[m[1].toLowerCase()] = Number(m[2]);
    });
    return o;
  }
  // Which rule an enquiry's stage follows, and the Events type that starts its clock. Other stages have no follow-up.
  var FU_RULE = { replied: 'first-reply', 'call-held': 'after-call', offered: 'offer', deposit: 'waiting-list' };
  var FU_EVENT = { 'first-reply': 'replied', 'after-call': 'call-held', offer: 'offered', 'waiting-list': 'deposit-paid' };
  var FU_CASE = { 'first-reply': 'check-in', 'after-call': 'call-check-in', offer: 'offer-check-in', 'waiting-list': 'waiting-check-in' };
  function followUpCase(rule) { return FU_CASE[rule] || ''; }
  var FU_OPEN = { waiting: 1, due: 1, snoozed: 1, 'suggest-lost': 1 };
  // Move a time out of UK quiet hours ('21:00-08:00'): a time inside them goes to the end of them, UK clock.
  function outOfQuiet(ms, quiet) {
    var m = String(quiet || '').match(/^\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*$/);
    if (!m || isNaN(ms)) return ms;
    var a = +m[1] * 60 + +m[2], b = +m[3] * 60 + +m[4], uk = toUk(ms), mins = +uk.slice(11, 13) * 60 + +uk.slice(14, 16);
    var inside = a > b ? mins >= a || mins < b : mins >= a && mins < b;
    if (!inside) return ms;
    var day = uk.slice(0, 10);
    if (a > b && mins >= a) day = toUk(toMs(day + 'T12:00:00') + 86400000).slice(0, 10);
    return toMs(day + 'T' + ('0' + m[3]).slice(-2) + ':' + m[4] + ':00');
  }
  // FollowUps rows for every enquiry: one open row per enquiry and rule (try n), closed when the enquiry moves on,
  // suggest-lost after the last try (the waiting-list check-in repeats and is never lost). The clock starts at the
  // stage's event (or the row's own update), or at Lisa's last "done" for the next try. A snooze moves the due time.
  //   opts: { now, rules: followUpRules(...), quiet: '21:00-08:00' }
  function planFollowUps(enquiries, events, existing, opts) {
    opts = opts || {};
    var now = opts.now == null ? Date.now() : toMs(opts.now), rules = opts.rules || followUpRules(''), out = [], byEnq = {}, last = {};
    (existing || []).forEach(function (f) { (byEnq[f.enquiry_key] = byEnq[f.enquiry_key] || []).push(f); });
    (events || []).forEach(function (v) {
      var k = v.enquiry_key + '|' + v.type, t = toMs(v.at_uk);
      if (!isNaN(t) && !(last[k] >= t)) last[k] = t;
    });
    (enquiries || []).forEach(function (e) {
      var rule = FU_RULE[e.stage], mine = byEnq[e.key] || [];
      mine.forEach(function (f) {
        if (f.rule !== rule && FU_OPEN[f.status]) out.push(row(f, { status: 'closed' }));
      });
      if (!rule) return;
      var done = mine.filter(function (f) { return f.rule === rule && f.status === 'done'; });
      var n = done.length + 1, key = 'F-' + hash([e.key, rule, n].join('|')), open = mine.filter(function (f) { return f.followup_key === key; })[0] || {};
      var base = last[e.key + '|' + FU_EVENT[rule]];
      if (base == null || isNaN(base)) base = toMs(e.updated_uk || e.received_uk);
      done.forEach(function (f) { var t = toMs(f.updated_uk || f.due_uk); if (!isNaN(t) && !(base >= t)) base = t; });
      var it = { followup_key: key, enquiry_key: e.key, person_key: e.person_key || '', rule: rule, try: n, snoozed_to_uk: open.snoozed_to_uk || '', draft_key: open.draft_key || '' };
      if (rule !== 'waiting-list' && done.length >= (rules['lost-after'] || 3)) { out.push(row(it, { due_uk: '', status: 'suggest-lost' })); return; }
      if (isNaN(base)) return;
      var due = outOfQuiet(base + (rules[rule] == null ? FU_DEFAULTS[rule] : rules[rule]) * 86400000, opts.quiet), status = due <= now ? 'due' : 'waiting';
      var sn = toMs(open.snoozed_to_uk);
      if (open.status === 'snoozed' && !isNaN(sn)) { due = outOfQuiet(sn, opts.quiet); status = due <= now ? 'due' : 'snoozed'; }
      out.push(row(it, { due_uk: toUk(due), status: status }));
    });
    function row(f, o) {
      var r = { followup_key: f.followup_key, enquiry_key: f.enquiry_key, person_key: f.person_key || '', rule: f.rule, try: f.try,
        due_uk: f.due_uk || '', status: f.status, snoozed_to_uk: f.snoozed_to_uk || '', draft_key: f.draft_key || '' };
      for (var k in o) r[k] = o[k];
      return r;
    }
    return out;
  }
  // The page's follow-up taps (request-file pattern): Lisa replied herself; snooze a follow-up; done (sent), or done and lost.
  function stamp(at) { return at.replace(/[^0-9]/g, '').slice(0, 14); }
  function repliedRequest(enquiryKey, nowIso) {
    if (!/^K-[0-9a-f]{16}$/.test(String(enquiryKey || ''))) return { ok: false, error: 'Unknown enquiry.' };
    var at = nowIso || new Date().toISOString();
    return { ok: true, name: 'ENQ-replied-' + stamp(at) + '-' + String(enquiryKey).slice(2, 8) + '.json', body: { v: 1, kind: 'replied', enquiry_key: enquiryKey, at: at } };
  }
  function snoozeRequest(followupKey, untilUk, nowIso) {
    if (!/^F-[0-9a-f]{16}$/.test(String(followupKey || ''))) return { ok: false, error: 'Unknown follow-up.' };
    var at = nowIso || new Date().toISOString(), t = toMs(untilUk);
    if (isNaN(t)) return { ok: false, error: 'Pick a date and time.' };
    if (t <= toMs(at)) return { ok: false, error: 'Pick a time in the future.' };
    return { ok: true, name: 'ENQ-snooze-' + stamp(at) + '-' + String(followupKey).slice(2, 8) + '.json',
      body: { v: 1, kind: 'snooze', followup_key: followupKey, until_uk: toUk(t), at: at } };
  }
  function doneRequest(followupKey, lost, nowIso) {
    if (!/^F-[0-9a-f]{16}$/.test(String(followupKey || ''))) return { ok: false, error: 'Unknown follow-up.' };
    var at = nowIso || new Date().toISOString();
    return { ok: true, name: 'ENQ-done-' + stamp(at) + '-' + String(followupKey).slice(2, 8) + '.json',
      body: { v: 1, kind: 'done', followup_key: followupKey, lost: lost === true, at: at } };
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
    if (typeof v === 'number') return v;
    var s = String(v || '').trim(); if (!s) return NaN;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return Date.parse(s + 'T00:00:00Z');
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(s)) {
      // A bare time is UK clock time (every *_uk column), so it is read as Europe/London, BST or GMT as on that day.
      var guess = Date.parse(s.replace(' ', 'T') + 'Z'), ms = guess;
      for (var i = 0; i < 2; i++) { var shown = Date.parse(toUk(ms) + 'Z'); if (!isNaN(shown)) ms = guess - (shown - ms); }
      return ms;
    }
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
      'lost_reason', 'flag', 'ref', 'score_reasons', 'updated_uk'],
    People: ['person_key', 'ref', 'name', 'email', 'phone_e164', 'country', 'country_basis', 'sources', 'first_contact_uk',
      'last_touch_uk', 'touches', 'repeat_buyer', 'past_deposit', 'do_not_contact', 'consent', 'match_confidence', 'check', 'updated_uk'],
    Events: ['event_key', 'enquiry_key', 'person_key', 'at_uk', 'channel', 'type', 'detail', 'source_ref'],
    Drafts: ['draft_key', 'enquiry_key', 'person_key', 'case', 'version', 'text', 'links', 'made_uk', 'status', 'blocked_by'],
    FollowUps: ['followup_key', 'enquiry_key', 'person_key', 'rule', 'try', 'due_uk', 'status', 'snoozed_to_uk', 'draft_key', 'updated_uk'],
    Litters: ['litter_key', 'litter_ref', 'pup_ref', 'sex', 'colour', 'size', 'coat', 'status', 'status_since_uk', 'person_key',
      'list', 'list_order', 'deposit_date', 'flag', 'source_sheet', 'read_uk'],
    'Sale Replies': ['reply_key', 'group_ref', 'dog_ref', 'enquiry_key', 'person_key', 'reply_kind', 'at_uk', 'sale_status', 'read_uk'],
    // Stage 11: deposit_key, status (held, suggested, collected, refunded, closed) and check added. Private amounts.
    Deposits: ['deposit_key', 'litter_ref', 'pup_ref', 'person_key', 'deposit_date', 'deposit', 'balance_due', 'balance_paid',
      'collection_date', 'status', 'basis', 'check', 'read_uk'],
    Sources: ['source', 'lands_where', 'machine_readable', 'reader', 'last_read_uk', 'last_count', 'status', 'note'],
    Settings: ['setting', 'value', 'note'],
    Requests: ['request_file', 'kind', 'enquiry_key', 'received_uk', 'applied_uk', 'result'],
    Log: ['at_uk', 'level', 'step', 'message', 'count', 'dry_run', 'engine_version'],
    // Stage 8: Lisa's own sent replies with names, emails and numbers stripped, read by styleSample(). Private.
    Style: ['style_key', 'sent_uk', 'words', 'greeting', 'sign_off', 'links', 'text', 'read_uk']
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
    addRequest: addRequest, parsePasted: parsePasted,
    nameKey: nameKey, nameSimilarity: nameSimilarity, mergePerson: mergePerson, resolvePeople: resolvePeople,
    personHistory: personHistory, depositKeys: depositKeys, depositRowsFrom: depositRowsFrom, depositFlags: depositFlags, mayContact: mayContact, gateContact: gateContact,
    extractPrefs: extractPrefs, pupFits: pupFits, timingMonths: timingMonths, scoreEnquiry: scoreEnquiry, WEIGHTS: WEIGHTS, BAND_AT: BAND_AT,
    DRAFT_CASES: CASES, AUTO_CASES: AUTO_CASES, LINKS: LINKS, firstName: firstName, linksFor: linksFor, importLine: importLine,
    chooseCase: chooseCase, buildDraft: buildDraft, checkDraft: checkDraft, stripForStyle: stripForStyle,
    questionsToAsk: questionsToAsk, callPrep: callPrep, callHeldRequest: callHeldRequest,
    litterRowsFrom: litterRowsFrom, matchLitter: matchLitter, litterFlags: litterFlags, saleDogsFrom: saleDogsFrom,
    saleReplyRows: saleReplyRows, saleGroupCards: saleGroupCards, checkCard: checkCard, isClosedList: isClosedList,
    money: money, isoDate: isoDate, parseCsv: parseCsv, depositLedgerFrom: depositLedgerFrom, depositTotals: depositTotals,
    xeroInvoicesFrom: xeroInvoicesFrom, matchInvoices: matchInvoices, depositPaidRequest: depositPaidRequest,
    followUpRules: followUpRules, followUpCase: followUpCase, planFollowUps: planFollowUps, outOfQuiet: outOfQuiet,
    repliedRequest: repliedRequest, snoozeRequest: snoozeRequest, doneRequest: doneRequest
  };
  root.EnquiriesCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
