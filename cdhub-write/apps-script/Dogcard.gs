/**
 * Dog card saves (12 Nov 2026, DRAFT): Add weight, Add vaccination, and Remove the newest vaccination.
 *
 *   action 'weighing'          adds one row to BLD-weight.csv
 *   action 'vaccination'       adds one row to BLD-vaccination.csv (one row per vaccination; a dog can have many)
 *   action 'vaccination_void'  marks the dog's NEWEST vaccination row as removed (voided_on, voided_by). Never deletes.
 *                              Older rows are read only. A removed row can be added again as a new row.
 *   action 'dog_details'       OWNER ONLY. Changes the dog card header in place: name, sex, date of birth, colour,
 *                              entire/neutered (BLD-subject.csv) and the microchip number (BLD-microchip.csv).
 *                              Switch: TABLE_ON_dog_details. Size is NOT here: it is worked out from the latest weight.
 *   action 'subject_create'    OWNER ONLY (13 Nov 2026, field list agreed by DOGCARD + BB). Adds one dog: one BLD-subject row,
 *                              an optional BLD-microchip row and one BLD-subject_status row (Active, from today).
 *                              Switch: TABLE_ON_subject_create. No photo and no room here: Photo.gs and the occupancy
 *                              action do those afterwards. Sex and kind come from rows, never a list in this file.
 *
 * Every one needs SAVE_ENABLED = true AND its own switch: TABLE_ON_weighing or TABLE_ON_vaccination = true. Both are OFF
 * until Lisa sets them. Columns are found by header NAME, never by position; a missing column is refused, not guessed.
 * The page sends the same staff code as The round. Nothing here makes anything public.
 */
var DOGCARD_ = {
  weighing:    { file: 'BLD-weight.csv',      on: 'weighing',    idPrefix: 'wt',  need: ['id', 'subject_id', 'performed_on', 'weight_kg'] },
  vaccination: { file: 'BLD-vaccination.csv', on: 'vaccination', idPrefix: 'vax', need: ['id', 'subject_id', 'given_on', 'product'] },
  dog_details: { file: 'BLD-subject.csv',     on: 'dog_details', idPrefix: 'mc',  need: ['id', 'name', 'sex', 'dob'], owner: true },
  subject_create: { file: 'BLD-subject.csv',  on: 'subject_create', idPrefix: 'sub', need: ['id', 'name', 'sex', 'dob', 'species', 'kind', 'source'], owner: true }
};
var STATUS_FILE_ = 'BLD-subject_status.csv';
var SPECIES_FILE_ = 'BLD-species.csv';
var CHIP_FILE_ = 'BLD-microchip.csv';
var DETAIL_COLS_ = ['name', 'sex', 'dob', 'coat_colour_id', 'neuter_status'];
var VOID_COLS_ = ['voided_on', 'voided_by'];

/** Files these saves may write. The dog record and microchip files are only on the list while TABLE_ON_dog_details is true. */
function dogcardFiles_() {
  var out = [DOGCARD_.weighing.file, DOGCARD_.vaccination.file];
  if (prop_(BLD.PROP.TABLE_ON_PREFIX + DOGCARD_.dog_details.on) === 'true') out.push(DOGCARD_.dog_details.file, CHIP_FILE_);
  if (prop_(BLD.PROP.TABLE_ON_PREFIX + DOGCARD_.subject_create.on) === 'true') {
    [DOGCARD_.subject_create.file, CHIP_FILE_, STATUS_FILE_].forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); });
  }
  return out;
}

function dogcardText_(v, name, errors, max) {
  v = String(v == null ? '' : v).trim();
  if (!v) return '';
  if (v.length > (max || BLD.LIMITS.MAX_TEXT_CHARS) || CONTROL_RE_.test(v)) { errors[name] = 'Please use plain text on one line.'; return ''; }
  if (/^[=+\-@\t]/.test(v)) { errors[name] = 'Please do not start with = + - or @.'; return ''; }
  return v;
}

function dogcardHeader_(read, cols, file) {
  var miss = cols.filter(function (c) { return read.header.indexOf(c) < 0; });
  if (miss.length) throw err_('HEADER_MISMATCH', file + ' has no ' + miss.join(', ') + ' column, so nothing was saved. Add the column and try again.');
}

function dogcardSubject_(subjectId) {
  if (!ID_RE_.test(subjectId)) throw err_('INVALID', 'Say which dog this is for.');
  var subj = store_read_('BLD-subject.csv', true), tenant = prop_(BLD.PROP.TENANT_ID);
  var hit = subj.records.some(function (r) { return r.id === subjectId && (!tenant || !r.tenant_id || r.tenant_id === tenant); });
  if (!hit) throw err_('NOT_FOUND', 'That dog was not found, so nothing was saved.');
}

/** Shared entry: switches, code, repeat-tap guard, one lock. */
function sinkDogcard_(req, kind, fn) {
  if (!saveEnabled_()) throw err_('SAVE_OFF', 'Saving is switched off.');
  if (!req || typeof req !== 'object') throw err_('BAD_REQUEST', 'That request was not understood.');
  var spec = DOGCARD_[kind];
  if (prop_(BLD.PROP.TABLE_ON_PREFIX + spec.on) !== 'true') throw err_('TABLE_OFF', 'Saving to ' + spec.file + ' is switched off.');
  var rid = String(req.request_id || '');
  if (!/^[A-Za-z0-9_\-]{8,64}$/.test(rid)) throw err_('BAD_REQUEST', 'The request had no valid reference.');
  var who = authStaff_(req.code);
  if (who.role !== 'OWNER' && (spec.owner || who.role !== 'STAFF')) throw err_('NOT_ALLOWED', 'Your role is not allowed to do this. Ask Lisa.');
  var cache = CacheService.getScriptCache(), cached = cache.get('rid:' + rid);
  if (cached) { var again = JSON.parse(cached); again.repeat = true; return again; }
  var f = req.fields && typeof req.fields === 'object' ? req.fields : {};
  var result = withLock_(function () { return fn(spec, f, who, new Date()); });
  cache.put('rid:' + rid, JSON.stringify(result), BLD.LIMITS.REQUEST_CACHE_SEC);
  return result;
}

function dogcardAppend_(spec, values) {
  var read = store_read_(spec.file, true);
  dogcardHeader_(read, spec.need, spec.file);
  var ids = {}; read.records.forEach(function (r) { ids[r.id] = 1; });
  var now = new Date(), id = newId_(spec.idPrefix, now);
  while (ids[id]) id = newId_(spec.idPrefix, now);
  values.id = id;
  if (read.header.indexOf('tenant_id') >= 0 && !values.tenant_id) values.tenant_id = prop_(BLD.PROP.TENANT_ID);
  var row = read.header.map(function (h) { return values[h] == null ? '' : String(values[h]); });
  store_append_(spec.file, read.header, row, read);
  return id;
}

function sinkWeighing_(req) {
  return sinkDogcard_(req, 'weighing', function (spec, f, who, now) {
    var errors = {}, subjectId = String(f.subject_id || '').trim();
    var on = String(f.performed_on || '').trim(), kg = String(f.weight_kg || '').trim(), bcs = String(f.body_condition_score || '').trim();
    if (!isRealDate_(on)) errors.performed_on = 'Use a real date as YYYY-MM-DD.';
    else if (on > todayLondon_(now)) errors.performed_on = 'That date is in the future.';
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(kg) || +kg < 0.1 || +kg > 150) errors.weight_kg = 'Type the weight in kg, e.g. 12.4';
    if (bcs && !/^[1-9]$/.test(bcs)) errors.body_condition_score = 'BCS is a whole number from 1 to 9.';
    if (Object.keys(errors).length) throw err_('INVALID', 'Please check the highlighted fields.', { fields: errors });
    dogcardSubject_(subjectId);
    var id = dogcardAppend_(spec, { subject_id: subjectId, performed_on: on, weight_kg: kg, unit: 'kg',
      body_condition_score: bcs, bcs_scale: bcs ? '9' : '', source: 'CD Hub, ' + who.who });
    return { status: 'saved', id: id, subject_id: subjectId };
  });
}

function sinkVaccination_(req) {
  return sinkDogcard_(req, 'vaccination', function (spec, f, who, now) {
    var errors = {}, subjectId = String(f.subject_id || '').trim(), on = String(f.given_on || '').trim();
    if (!isRealDate_(on)) errors.given_on = 'Use a real date as YYYY-MM-DD.';
    else if (on > todayLondon_(now)) errors.given_on = 'That date is in the future.';
    var product = dogcardText_(f.product, 'product', errors, 120);
    if (!product && !errors.product) errors.product = 'Say which vaccine.';
    var covers = String(f.diseases_covered || '').trim();
    if (covers && !/^[a-z_]{2,40}(;[a-z_]{2,40}){0,11}$/.test(covers)) errors.diseases_covered = 'Tick what it protects against.';
    var vet = dogcardText_(f.practice, 'practice', errors, 120);
    var card = String(f.certificate_link || '').trim();
    if (card && !(/^https:\/\/\S{4,500}$/.test(card) || /^[A-Za-z0-9_-]{20,}$/.test(card))) errors.certificate_link = 'The card link must start with https://';
    if (Object.keys(errors).length) throw err_('INVALID', 'Please check the highlighted fields.', { fields: errors });
    dogcardSubject_(subjectId);
    var id = dogcardAppend_(spec, { subject_id: subjectId, event_kind: 'vaccination', product: product, product_shorthand: product,
      diseases_covered: covers, given_on: on, practice: vet, certificate_media_id: card, source: 'CD Hub, ' + who.who });
    return { status: 'saved', id: id, subject_id: subjectId };
  });
}

/** Remove the newest vaccination of one dog: fills voided_on and voided_by in that row only. */
function sinkVaccinationVoid_(req) {
  return sinkDogcard_(req, 'vaccination', function (spec, f, who, now) {
    var subjectId = String(f.subject_id || '').trim(), rowId = String(f.id || '').trim();
    if (!ID_RE_.test(subjectId) || !ID_RE_.test(rowId)) throw err_('INVALID', 'Say which vaccination to remove.');
    var read = store_read_(spec.file, true);
    dogcardHeader_(read, spec.need.concat(VOID_COLS_), spec.file);
    var newest = -1;
    read.records.forEach(function (r, i) {
      if (r.subject_id !== subjectId || String(r.voided_on || '').trim()) return;
      if (newest < 0 || String(r.given_on || '') >= String(read.records[newest].given_on || '')) newest = i;
    });
    if (newest < 0) throw err_('NOT_FOUND', 'That dog has no vaccinations to remove.');
    if (read.records[newest].id !== rowId) throw err_('NOT_ALLOWED', 'Only the most recent vaccination can be removed.');
    var rec = read.records[newest];
    var row = read.header.map(function (h) {
      if (h === 'voided_on') return Utilities.formatDate(now, BLD.TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
      if (h === 'voided_by') return who.who;
      return rec[h] == null ? '' : String(rec[h]);
    });
    store_replaceRow_(spec.file, read.header, newest, row, read);
    return { status: 'saved', id: rowId, subject_id: subjectId, voided: true };
  });
}

/**
 * Change the header of one dog card (owner only). Only the fields sent are looked at; a field equal to what is there
 * is left alone. The subject row is replaced in place by header name. The chip goes in the dog's microchip row
 * (replaced in place if there is one, otherwise one new row).
 */
function sinkDogDetails_(req) {
  return sinkDogcard_(req, 'dog_details', function (spec, f, who, now) {
    var errors = {}, subjectId = String(f.subject_id || '').trim(), want = {}, tenant = prop_(BLD.PROP.TENANT_ID);
    if (!ID_RE_.test(subjectId)) throw err_('INVALID', 'Say which dog this is for.');
    if (f.name != null) { want.name = dogcardText_(f.name, 'name', errors, 80); if (!want.name && !errors.name) errors.name = 'The dog needs a name.'; }
    if (f.sex != null) { want.sex = String(f.sex).trim(); if (want.sex !== 'Female' && want.sex !== 'Male') errors.sex = 'Pick Female or Male.'; }
    if (f.dob != null) {
      want.dob = String(f.dob).trim();
      if (want.dob && !isRealDate_(want.dob)) errors.dob = 'Use a real date as YYYY-MM-DD.';
      else if (want.dob > todayLondon_(now)) errors.dob = 'That date is in the future.';
    }
    if (f.neuter_status != null) { want.neuter_status = String(f.neuter_status).trim(); if (['entire', 'neutered', 'spayed', ''].indexOf(want.neuter_status) < 0) errors.neuter_status = 'Pick entire, neutered or spayed.'; }
    if (f.coat_colour_id != null) {
      want.coat_colour_id = String(f.coat_colour_id).trim();
      if (want.coat_colour_id) {
        var cols = store_read_('BLD-coat_colour.csv', false).records;
        if (!cols.some(function (c) { return c.id === want.coat_colour_id; })) errors.coat_colour_id = 'Pick a colour from the list.';
      }
    }
    var chip = f.chip_number == null ? null : String(f.chip_number).replace(/\s+/g, '');
    if (chip !== null && chip && !/^\d{15}$/.test(chip)) errors.chip_number = 'A microchip number is 15 digits.';
    if (Object.keys(errors).length) throw err_('INVALID', 'Please check the highlighted fields.', { fields: errors });

    var read = store_read_(spec.file, true), idx = -1;
    read.records.forEach(function (r, i) { if (r.id === subjectId && (!tenant || !r.tenant_id || r.tenant_id === tenant)) idx = i; });
    if (idx < 0) throw err_('NOT_FOUND', 'That dog was not found, so nothing was saved.');
    dogcardHeader_(read, spec.need.concat(Object.keys(want)), spec.file);
    var cur = read.records[idx], changed = [];
    DETAIL_COLS_.forEach(function (c) { if (Object.prototype.hasOwnProperty.call(want, c) && want[c] !== String(cur[c] || '')) changed.push(c); });
    if (changed.length) {
      var row = read.header.map(function (h) { var v = changed.indexOf(h) >= 0 ? want[h] : cur[h]; return v == null ? '' : String(v); });
      store_replaceRow_(spec.file, read.header, idx, row, read);
    }
    if (chip !== null) {
      var mc = store_read_(CHIP_FILE_, true), at = -1;
      dogcardHeader_(mc, ['id', 'subject_id', 'chip_number'], CHIP_FILE_);
      mc.records.forEach(function (r, i) { if (r.subject_id === subjectId) at = i; });
      if (at >= 0 && String(mc.records[at].chip_number || '') !== chip) {
        var m = mc.records[at];
        store_replaceRow_(CHIP_FILE_, mc.header, at, mc.header.map(function (h) { return h === 'chip_number' ? chip : (m[h] == null ? '' : String(m[h])); }), mc);
        changed.push('chip_number');
      } else if (at < 0 && chip) {
        dogcardAppend_({ file: CHIP_FILE_, need: ['id', 'subject_id', 'chip_number'], idPrefix: 'mc' }, { subject_id: subjectId, chip_number: chip, source: 'CD Hub, ' + who.who });
        changed.push('chip_number');
      }
    }
    if (!changed.length) throw err_('NOTHING_CHANGED', 'Nothing was different, so nothing was changed.');
    return { status: 'edited', id: subjectId, changed: changed };
  });
}

/** The rows of a lookup file for this tenant (rows with no tenant_id count for everyone). Missing file = []. */
function dogcardRows_(file) {
  var r = store_read_(file, false), tenant = prop_(BLD.PROP.TENANT_ID);
  if (!r) return [];
  return r.records.filter(function (x) { return !tenant || !x.tenant_id || x.tenant_id === tenant; });
}

/** The word as the rows spell it, matched without caring about case; '' if no row has it. */
function dogcardPick_(word, allowed) {
  var w = String(word || '').trim().toLowerCase(), hit = '';
  allowed.forEach(function (a) { if (!hit && String(a).trim().toLowerCase() === w) hit = String(a).trim(); });
  return hit;
}

/** sub-<name slug>, made unique against the ids already in the file. */
function dogcardSubjectId_(name, ids) {
  var slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'dog';
  var id = 'sub-' + slug, n = 2;
  while (ids[id]) id = 'sub-' + slug + '-' + (n++);
  return id;
}

/**
 * Add one dog (owner only). Required: name, sex, species, kind. dob is required for a pup (a birth litter, or a kind
 * equal to the species row's young_word). Optional: breed, neuter_status (default entire), coat_type, coat_colour_id,
 * coat_pattern_id, nose_pigment_id, birth_litter_id, chip_number. Every id must be an existing row.
 * Sex: a value the dog rows already use, or the species row's adult_female_word / adult_male_word.
 * Kind: a value the dog rows already use. Refused (DUPLICATE) when an active dog has the same name and date of birth.
 */
function sinkSubjectCreate_(req) {
  return sinkDogcard_(req, 'subject_create', function (spec, f, who, now) {
    var errors = {}, tenant = prop_(BLD.PROP.TENANT_ID), today = todayLondon_(now);
    var read = store_read_(spec.file, true);
    dogcardHeader_(read, spec.need, spec.file);
    var dogs = read.records.filter(function (r) { return !tenant || !r.tenant_id || r.tenant_id === tenant; });
    var used = function (col) { var o = []; dogs.forEach(function (r) { var v = String(r[col] || '').trim(); if (v && o.indexOf(v) < 0) o.push(v); }); return o; };

    var name = dogcardText_(f.name, 'name', errors, 80);
    if (!name && !errors.name) errors.name = 'The dog needs a name.';

    var sp = null, spWord = String(f.species || '').trim().toLowerCase();
    dogcardRows_(SPECIES_FILE_).forEach(function (r) {
      if (sp || String(r.active || 'yes').toLowerCase() === 'no') return;
      if ([r.id, r.code, r.common_name].some(function (v) { return String(v || '').trim().toLowerCase() === spWord; })) sp = r;
    });
    if (!spWord || !sp) errors.species = 'Pick a species from the list.';
    // keep the spelling the dog rows already use for this species
    var species = '';
    if (sp) {
      var names = [sp.id, sp.code, sp.common_name].map(function (v) { return String(v || '').trim().toLowerCase(); });
      dogs.some(function (r) { var v = String(r.species || '').trim(); if (v && names.indexOf(v.toLowerCase()) >= 0) { species = v; return true; } return false; });
      if (!species) species = String(sp.common_name || sp.code || sp.id).trim();
    }

    var sexAllowed = used('sex');
    if (sp) [sp.adult_female_word, sp.adult_male_word].forEach(function (w) { w = String(w || '').trim(); if (w) sexAllowed.push(w); });
    var sex = dogcardPick_(f.sex, sexAllowed);
    if (!sex) errors.sex = sexAllowed.length ? 'Pick ' + sexAllowed.join(' or ') + '.' : 'Pick the sex.';

    var kindAllowed = used('kind');
    var kind = dogcardPick_(f.kind, kindAllowed);
    if (!kind) errors.kind = kindAllowed.length ? 'Pick ' + kindAllowed.join(' or ') + '.' : 'No dog has a kind yet: add one in the Sheet first.';

    var litterId = String(f.birth_litter_id || '').trim();
    if (litterId) {
      var lit = dogcardRows_('BLD-litter.csv');
      if (!ID_RE_.test(litterId) || !lit.some(function (r) { return r.id === litterId; })) errors.birth_litter_id = 'Pick a litter from the list.';
    }
    var isYoung = !!litterId || (sp && kind && String(sp.young_word || '').trim().toLowerCase() === kind.toLowerCase());

    var dob = String(f.dob || '').trim();
    if (dob && !isRealDate_(dob)) errors.dob = 'Use a real date as YYYY-MM-DD.';
    else if (dob && dob > today) errors.dob = 'That date is in the future.';
    else if (!dob && isYoung) errors.dob = 'A ' + (sp && sp.young_word || 'young one') + ' needs a date of birth.';

    var neuter = String(f.neuter_status == null || f.neuter_status === '' ? 'entire' : f.neuter_status).trim();
    if (['entire', 'neutered', 'spayed'].indexOf(neuter) < 0) errors.neuter_status = 'Pick entire, neutered or spayed.';
    var breed = dogcardText_(f.breed, 'breed', errors, 80);
    var coatType = dogcardText_(f.coat_type, 'coat_type', errors, 80);

    var ids = {};
    [['coat_colour_id', 'BLD-coat_colour.csv', 'colour'], ['coat_pattern_id', 'BLD-coat_pattern.csv', 'pattern'], ['nose_pigment_id', 'BLD-nose_pigment.csv', 'nose colour']].forEach(function (t) {
      var v = String(f[t[0]] || '').trim();
      ids[t[0]] = v;
      if (v && !(ID_RE_.test(v) && dogcardRows_(t[1]).some(function (r) { return r.id === v; }))) errors[t[0]] = 'Pick a ' + t[2] + ' from the list.';
    });

    var chip = String(f.chip_number || '').replace(/\s+/g, '');
    if (chip && !/^\d{15}$/.test(chip)) errors.chip_number = 'A microchip number is 15 digits.';
    if (Object.keys(errors).length) throw err_('INVALID', 'Please check the highlighted fields.', { fields: errors });

    // an active dog with the same name and date of birth = a second copy of the same dog
    var st = store_read_(STATUS_FILE_, false), latest = {};
    if (st) st.records.forEach(function (r) {
      var cur = latest[r.subject_id];
      if (!cur || String(r.from_date || '') >= String(cur.from_date || '')) latest[r.subject_id] = r;
    });
    var dup = dogs.filter(function (r) {
      if (String(r.name || '').trim().toLowerCase() !== name.toLowerCase() || String(r.dob || '').trim() !== dob) return false;
      var s = latest[r.id];
      return !s || String(s.state || '').trim().toLowerCase() === 'active';
    });
    if (dup.length) throw err_('DUPLICATE', name + (dob ? ' born ' + dob : '') + ' is already on the list, so nothing was saved.', { duplicate_of: dup[0].id });

    if (st) dogcardHeader_(st, ['id', 'subject_id', 'state', 'from_date'], STATUS_FILE_);
    else throw err_('HEADER_MISMATCH', STATUS_FILE_ + ' was not found, so nothing was saved.');
    if (chip) {
      var mc = store_read_(CHIP_FILE_, true);
      dogcardHeader_(mc, ['id', 'subject_id', 'chip_number'], CHIP_FILE_);
      if (mc.records.some(function (r) { return String(r.chip_number || '') === chip; })) throw err_('DUPLICATE', 'That microchip number is already on another dog, so nothing was saved.');
    }

    var allIds = {}; read.records.forEach(function (r) { allIds[r.id] = 1; });
    var id = dogcardSubjectId_(name, allIds);
    var host = dogcardText_(f.host, 'host', {}, 40) || 'CD Hub';
    var values = { id: id, tenant_id: tenant, name: name, sex: sex, dob: dob, size_band: '', coat_type: coatType, kind: kind,
      neuter_status: neuter, species: species, breed: breed, coat_colour_id: ids.coat_colour_id, coat_pattern_id: ids.coat_pattern_id,
      nose_pigment_id: ids.nose_pigment_id, birth_litter_id: litterId,
      source: 'added in ' + host + ' by ' + who.role + ', ' + today };
    dogcardHeader_(read, Object.keys(values).filter(function (k) { return values[k] !== '' && k !== 'tenant_id'; }), spec.file);
    store_append_(spec.file, read.header, read.header.map(function (h) { return values[h] == null ? '' : String(values[h]); }), read);

    var activeWord = 'Active';
    st.records.some(function (r) { var v = String(r.state || '').trim(); if (v.toLowerCase() === 'active') { activeWord = v; return true; } return false; });
    dogcardAppend_({ file: STATUS_FILE_, need: ['id', 'subject_id', 'state', 'from_date'], idPrefix: 'sst' },
      { subject_id: id, state: activeWord, from_date: today, to_date: '', reason: 'added in ' + host });
    if (chip) dogcardAppend_({ file: CHIP_FILE_, need: ['id', 'subject_id', 'chip_number'], idPrefix: 'mc' }, { subject_id: id, chip_number: chip, source: 'CD Hub, ' + who.who });
    return { status: 'saved', id: id };
  });
}
