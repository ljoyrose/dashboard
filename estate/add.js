(function (root, factory) {
  'use strict';
  var core = (typeof module === 'object' && module.exports) ? require('./core.js') : root.EstateCore;
  var api = factory(core);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EstateAdd = api;
})(this, function (EstateCore) {
  'use strict';

  var MAX_TEXT = 80;

  function cleanText(v) {
    if (v == null) return '';
    return String(v).replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT).trim();
  }

  function hostIs(host, base) { return host === base || host.slice(-(base.length + 1)) === '.' + base; }

  var FUNNEL_HOSTS = ['myclickfunnels.com', 'clickfunnels.com', 'cf2.com'];
  var APP_HOSTS = ['lovable.app', 'base44.app', 'overskill.app', 'vercel.app', 'netlify.app'];

  // A first guess at the row kind from the address alone. the owner can always pick another kind in the Add box.
  function guessKind(target) {
    var t = typeof target === 'string' || target == null ? EstateCore.normaliseTarget(target) : target;
    if (!t || !t.ok) return 'site';
    var host = t.host, path = String(t.path || '').toLowerCase();
    if (FUNNEL_HOSTS.some(function (b) { return hostIs(host, b); }) || /funnel/.test(path)) return 'funnel';
    if (hostIs(host, 'myshopify.com') || /^\/(products|collections)(\/|$)/.test(path)) return 'shop';
    if (/^apps?\./.test(host) || /^\/apps?(\/|$)/.test(path) || APP_HOSTS.some(function (b) { return hostIs(host, b); })) return 'app';
    return 'site';
  }

  function scanPlan(target) {
    var t = typeof target === 'string' || target == null ? EstateCore.normaliseTarget(target) : target;
    if (!t || !t.ok) return [];
    var plan = ['dns', 'ssl', 'live', 'tags'];
    if (t.bare && !t.path) plan.push('mail');
    return plan;
  }

  function buildRequest(o) {
    o = o || {};
    var t = EstateCore.normaliseTarget(o.input);
    if (!t.ok) return { ok: false, reason: t.reason };
    var company = cleanText(o.company);
    if (!company) return { ok: false, reason: 'company is required' };
    var ms = o.now instanceof Date ? o.now.getTime() : (typeof o.now === 'number' && isFinite(o.now) ? o.now : Date.now());
    var kind = cleanText(o.kind).toLowerCase();
    if (EstateCore.KINDS.indexOf(kind) === -1) kind = guessKind(t);
    return {
      ok: true,
      request: {
        kind: 'estate-add',
        at: new Date(ms).toISOString(),
        by: cleanText(o.by),
        target: { url: t.url, key: t.key, host: t.host, domain: t.domain },
        row_kind: kind,
        company: company,
        brand: cleanText(o.brand),
        client: cleanText(o.client),
        scan: scanPlan(t),
        source: 'Add'
      },
      fileName: 'estate-add-' + ms + '.json'
    };
  }

  function multipartBody(request, folderId, boundary, fileName) {
    var name = fileName || ('estate-add-' + (Date.parse(request && request.at) || Date.now()) + '.json');
    var meta = { name: name, parents: [folderId], mimeType: 'application/json' };
    var b = boundary;
    return '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) +
      '\r\n--' + b + '\r\nContent-Type: application/json\r\n\r\n' + JSON.stringify(request) + '\r\n--' + b + '--';
  }

  return {
    MAX_TEXT: MAX_TEXT,
    cleanText: cleanText,
    guessKind: guessKind,
    scanPlan: scanPlan,
    buildRequest: buildRequest,
    multipartBody: multipartBody
  };
});

