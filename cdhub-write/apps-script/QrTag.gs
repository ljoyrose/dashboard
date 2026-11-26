var QR_ = { FILE: 'BLD-qr_tag.csv', ALPHABET: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', LEN: 8,
  KINDS: ['area', 'subject', 'litter', 'site', 'thermometer', 'item'] };

function qrRuleOn_(rules, kind, sub, day, tenant) {
  var keys = sub ? ['qr.on_add.' + kind + '.' + sub, 'qr.on_add.' + kind] : ['qr.on_add.' + kind];
  for (var i = 0; i < keys.length; i++) {
    var hit = null, from = '';
    (rules || []).forEach(function (r) {
      if (String(r.rule_key || '').trim() !== keys[i]) return;
      if (tenant && r.tenant_id && r.tenant_id !== tenant) return;
      var f = String(r.effective_from || '').slice(0, 10), t = String(r.to_date || '').slice(0, 10);
      if ((f && day && f > day) || (t && day && t < day)) return;
      if (hit === null || f >= from) { hit = String(r.value || '').trim().toLowerCase(); from = f; }
    });
    if (hit !== null) return hit === 'yes' || hit === 'true';
  }
  return false;
}

function qrNewTag_(taken) {
  var tag;
  do {
    var raw = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    tag = '';
    for (var i = 0; i < QR_.LEN; i++) tag += QR_.ALPHABET.charAt(parseInt(raw.substr(i * 4, 4), 16) % QR_.ALPHABET.length);
  } while (taken[tag]);
  return tag;
}

function qrOnAdd_(kind, refId, sub, who, now) {
  try {
    if (prop_(BLD.PROP.TABLE_ON_PREFIX + 'qr_tag') !== 'true') return { qr: 'off' };
    if (QR_.KINDS.indexOf(kind) < 0 || !refId) return { qr: 'no' };
    var tenant = prop_(BLD.PROP.TENANT_ID), rules = store_read_('BLD-breeding_rule.csv', false);
    if (!rules || !qrRuleOn_(rules.records, kind, sub, todayLondon_(now), tenant)) return { qr: 'no' };
    var read = store_read_(QR_.FILE, false), spec = TABLES.qr_tag;
    if (!read || !sameHeader_(read.header, spec.columns)) return { qr: 'failed' };
    var taken = {}, have = '';
    read.records.forEach(function (r) {
      taken[r.tag] = 1;
      if (r.kind === kind && r.ref_id === refId && String(r.active).toLowerCase() !== 'false') have = have || r.tag;
    });
    if (have) return { qr: 'kept', tag: have };
    var ids = {}; read.records.forEach(function (r) { ids[r.id] = 1; });
    var id = newId_(spec.idPrefix, now); while (ids[id]) id = newId_(spec.idPrefix, now);
    var tag = qrNewTag_(taken);
    var row = { id: id, tenant_id: tenant, tag: tag, kind: kind, ref_id: refId, active: 'true', made_at: londonIso_(now), made_by: who.id || who.who };
    store_append_(QR_.FILE, spec.columns, rowValues_(spec.columns, row), read);
    return { qr: 'made', tag: tag };
  } catch (e) {
    return { qr: 'failed' };
  }
}

