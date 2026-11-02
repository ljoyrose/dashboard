/* Marketplace "Product ideas": the contract in code. No DOM, no network, no Google.
 * The page (stage 2) and the tests both use these functions, so the rule lives in one place.
 * Contract text: docs/marketplace-ideas/CONTRACT.md */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.MktIdeas = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var SECTION = 'idea', V = 1;
  var ENUMS = {
    product_type: ['physical', 'digital'],
    buyer: ['b2c', 'b2b'],
    branding: ['white_label', 'own_brand', 'supplier_brand', 'resell'],
    fulfilment: ['hold_stock', 'dropship', 'made_to_order', 'digital'],
    source: ['maker', 'wholesaler', 'distributor', 'licence'],
    verdict: ['', 'go', 'maybe', 'no'],
    status: ['new', 'screening', 'researching', 'testing', 'launched', 'dropped'],
    evidence: ['verified', 'assumed']
  };
  var INTAKE_KEYS = ['link', 'barcode', 'price_seen', 'where_seen', 'image_link', 'own_audience_fit', 'note'];
  var LIMITS = { name: 120, text: 500 };

  function str(v) { return v === undefined || v === null ? '' : String(v).trim(); }
  /** GS1 check digit for EAN-8, UPC-A, EAN-13, GTIN-14. */
  function barcodeOk(code) {
    if (!/^\d+$/.test(code) || [8, 12, 13, 14].indexOf(code.length) < 0) return false;
    var sum = 0, d = code.split('').map(Number), check = d.pop();
    d.reverse().forEach(function (n, i) { sum += n * (i % 2 === 0 ? 3 : 1); });
    return (10 - (sum % 10)) % 10 === check;
  }
  function httpsUrl(u) { return /^https:\/\/[^\s/$.?#][^\s]*$/i.test(u) && u.length <= 2000; }
  /** "£4.5", "4.50", "4,50" -> "£4.50"; '' if it is not a positive amount. */
  function money(v) {
    var n = parseFloat(str(v).replace(/[£\s]/g, '').replace(',', '.'));
    return isFinite(n) && n > 0 && /^[£\s]*\d+([.,]\d{1,2})?\s*$/.test(str(v)) ? '£' + n.toFixed(2) : '';
  }

  /** The Add idea form. Only the name is required. Returns { ok, errors: {field: words}, clean: {field: value} }. */
  function validateIntake(input) {
    input = input || {};
    var e = {}, c = { name: str(input.name) };
    if (!c.name) e.name = 'Add a name';
    else if (c.name.length > LIMITS.name) e.name = 'Make it under ' + LIMITS.name + ' letters';
    var barcode = str(input.barcode).replace(/[\s-]/g, '');
    if (barcode) { if (barcodeOk(barcode)) c.barcode = barcode; else e.barcode = 'Check the barcode: 8, 12, 13 or 14 digits'; }
    ['link', 'image_link'].forEach(function (k) {
      var u = str(input[k]); if (!u) return;
      if (httpsUrl(u)) c[k] = u; else e[k] = 'Use a full link starting https://';
    });
    var price = str(input.price_seen);
    if (price) { var m = money(price); if (m) c.price_seen = m; else e.price_seen = 'Type a price like 4.50'; }
    ['where_seen', 'own_audience_fit', 'note'].forEach(function (k) {
      var t = str(input[k]); if (!t) return;
      if (t.length > LIMITS.text) e[k] = 'Make it under ' + LIMITS.text + ' letters'; else c[k] = t;
    });
    return { ok: !Object.keys(e).length, errors: e, clean: c };
  }

  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  /** IDEA-20261102-1530-ab12: sortable, no personal data. `rand` is injectable for tests. */
  function newId(now, rand) {
    var d = new Date(now), r = String(rand || Math.random().toString(36).slice(2, 6)).replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 4);
    return 'IDEA-' + d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + '-' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + '-' + r;
  }
  var cardKey = function (id) { return 'IDEA|' + id; };
  var fileName = function (id) { return 'MKT-IDEA-REQ-' + id + '.json'; };

  /** The ONE request file the hub writes. The engine turns it into the card; nothing else is written. */
  function buildRequest(clean, now, by, opts) {
    opts = opts || {};
    var id = opts.id || newId(now, opts.rand), req = { kind: 'mkt-idea', v: V, id: id, at: new Date(now).toISOString(), by: str(by), dry_run: !!opts.dryRun, name: clean.name };
    INTAKE_KEYS.forEach(function (k) { req[k] = clean[k] || ''; });
    return req;
  }
  /** What the engine puts on the card row from a request: the fresh detail JSON. */
  function newDetail(req) {
    var intake = {}; INTAKE_KEYS.forEach(function (k) { intake[k] = str(req[k]); });
    return { kind: 'idea', v: V, status: 'new', gate: 0, verdict: '', intake: intake };
  }
  function cardRow(req) { return [cardKey(req.id), SECTION, 'Ideas', req.name, JSON.stringify(newDetail(req)), req.at, '', '', '', '', '', '']; }

  var isNum = function (v) { return typeof v === 'number' && isFinite(v); };
  var isStrArr = function (v) { return Array.isArray(v) && v.every(function (x) { return typeof x === 'string'; }); };
  /** Check a card's detail JSON by value. Codes: MISSING, WRONG_TYPE, BAD_VALUE. Never returns a cell value. */
  function checkDetail(d) {
    var out = [], bad = function (code, field, msg) { out.push({ code: code, field: field, msg: field + ': ' + msg }); };
    if (!d || typeof d !== 'object' || Array.isArray(d)) return [{ code: 'WRONG_TYPE', field: '', msg: 'detail is not an object' }];
    if (d.kind !== 'idea') bad('BAD_VALUE', 'kind', 'must be "idea"');
    ['intake', 'gate', 'verdict', 'status'].forEach(function (k) { if (!(k in d)) bad('MISSING', k, 'required'); });
    if ('gate' in d && !(isNum(d.gate) && d.gate >= 0 && d.gate <= 3 && d.gate % 1 === 0)) bad('BAD_VALUE', 'gate', 'must be 0, 1, 2 or 3');
    ['verdict', 'status'].forEach(function (k) { if (k in d && ENUMS[k].indexOf(d[k]) < 0) bad('BAD_VALUE', k, 'not one of ' + ENUMS[k].filter(Boolean).join('/')); });
    if (d.intake !== undefined && (!d.intake || typeof d.intake !== 'object' || Array.isArray(d.intake))) bad('WRONG_TYPE', 'intake', 'must be an object');
    if (d.classification !== undefined) {
      if (!d.classification || typeof d.classification !== 'object') bad('WRONG_TYPE', 'classification', 'must be an object');
      else ['product_type', 'buyer', 'branding', 'fulfilment', 'source'].forEach(function (k) {
        var v = d.classification[k]; if (v !== undefined && v !== '' && ENUMS[k].indexOf(v) < 0) bad('BAD_VALUE', 'classification.' + k, 'not one of ' + ENUMS[k].join('/'));
      });
    }
    if (d.margin_est !== undefined) {
      if (!d.margin_est || typeof d.margin_est !== 'object') bad('WRONG_TYPE', 'margin_est', 'must be an object');
      else ['worst', 'expected', 'best'].forEach(function (k) { var v = d.margin_est[k]; if (v !== undefined && v !== null && !isNum(v)) bad('WRONG_TYPE', 'margin_est.' + k, 'must be a number (pence per unit) or null'); });
    }
    ['top3_risks', 'top3_unknowns', 'lines'].forEach(function (k) { if (d[k] !== undefined && !isStrArr(d[k])) bad('WRONG_TYPE', k, 'must be a list of words'); });
    ['top3_risks', 'top3_unknowns'].forEach(function (k) { if (isStrArr(d[k]) && d[k].length > 3) bad('BAD_VALUE', k, 'at most 3'); });
    ['kill_rule', 'next_step', 'dropped_reason', 'sell', 'supplier'].forEach(function (k) { if (d[k] !== undefined && typeof d[k] !== 'string') bad('WRONG_TYPE', k, 'must be words'); });
    ['unit_ex_p', 'unit_inc_p', 'profit_p', 'moq'].forEach(function (k) { if (d[k] !== undefined && d[k] !== null && !isNum(d[k])) bad('WRONG_TYPE', k, 'must be a number'); });
    if (d.terms !== undefined && (!d.terms || typeof d.terms !== 'object' || Array.isArray(d.terms))) bad('WRONG_TYPE', 'terms', 'must be an object');
    if (d.evidence !== undefined) {
      if (!Array.isArray(d.evidence)) bad('WRONG_TYPE', 'evidence', 'must be a list');
      else d.evidence.forEach(function (x, i) {
        var f = 'evidence[' + i + ']';
        if (!x || typeof x.claim !== 'string' || !x.claim) return bad('MISSING', f + '.claim', 'required');
        if (ENUMS.evidence.indexOf(x.status) < 0) bad('BAD_VALUE', f + '.status', 'must be verified or assumed');
        else if (x.status === 'verified' && !str(x.source)) bad('BAD_VALUE', f + '.source', 'a verified claim needs a source');
      });
    }
    if (d.status === 'dropped' && !str(d.dropped_reason)) bad('MISSING', 'dropped_reason', 'a dropped idea needs a reason');
    if (d.verdict === 'no' && d.status !== 'dropped') bad('BAD_VALUE', 'status', 'verdict no means status dropped');
    return out;
  }
  /** Can a Go idea move to New stock? It needs a price and a supplier: the same fields the New stock card reads. */
  function goReady(d) {
    var miss = [];
    if (!d || d.verdict !== 'go') return { ok: false, missing: ['verdict go'] };
    if (!isNum(d.unit_inc_p) || d.unit_inc_p <= 0) miss.push('unit_inc_p');
    if (!isNum(d.profit_p)) miss.push('profit_p');
    if (!str(d.supplier)) miss.push('supplier');
    return { ok: !miss.length, missing: miss };
  }

  return { SECTION: SECTION, V: V, ENUMS: ENUMS, INTAKE_KEYS: INTAKE_KEYS, barcodeOk: barcodeOk, money: money, validateIntake: validateIntake, newId: newId, cardKey: cardKey, fileName: fileName,
    buildRequest: buildRequest, newDetail: newDetail, cardRow: cardRow, checkDetail: checkDetail, goReady: goReady };
});
