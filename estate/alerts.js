// Web Estate Hub, Stage 11: alerts and suggested open-work rows. Pure: no network, no Drive, no DOM.
// Suggested rows are for the slip only; code never writes them anywhere. Reuses estate/core.js.
(function (root, factory) {
  'use strict';
  var core = (typeof module === 'object' && module.exports) ? require('./core.js') : root.EstateCore;
  var api = factory(core);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EstateAlerts = api;
})(this, function (E) {
  'use strict';

  var WITHIN = 30; // days; 30 is inside, 31 is not
  var RED_WITHIN = 7; // an expiry this close (or passed) is red
  var TAGS = [['ga4', 'GA4'], ['gtm', 'GTM'], ['meta_pixel', 'Meta pixel']];

  function label(r) { return r.url_or_domain || r.key; }
  function dayWords(d) {
    if (d < 0) return 'passed ' + (-d) + ' day' + (d === -1 ? '' : 's') + ' ago';
    if (d === 0) return 'expires today';
    return 'expires in ' + d + ' day' + (d === 1 ? '' : 's');
  }

  // rows, today ('2026-10-29' or a Date), previousRows (last scan, optional) -> [{ key, kind, level, text }].
  // Red first, then amber; inside a level the row order is kept.
  function alerts(rows, today, previousRows) {
    var out = [], prev = {};
    (previousRows || []).forEach(function (p) { if (p && p.key) prev[p.key] = p; });
    (rows || []).forEach(function (r) {
      var add = function (kind, level, text) { out.push({ key: r.key, kind: kind, level: level, text: label(r) + ': ' + text }); };
      if (E.statusOf(r) === 'down') add('down', 'red', 'down' + (r.live_status ? ' (' + r.live_status + ')' : ''));
      [['ssl_expires', 'ssl', 'certificate'], ['domain_expires', 'domain', 'domain']].forEach(function (x) {
        var d = E.daysUntil(r[x[0]], today);
        if (d !== null && d <= WITHIN) add(x[1], d <= RED_WITHIN ? 'red' : 'amber', x[2] + ' ' + dayWords(d));
      });
      var mail = E.emailProblems(r);
      if (mail.indexOf('DMARC missing') !== -1) add('dmarc', 'amber', 'DMARC missing');
      if (mail.indexOf('two SPF records') !== -1) add('spf', 'amber', 'two SPF records (mail can fail)');
      var p = prev[r.key];
      if (p) TAGS.forEach(function (t) {
        if (/^found/i.test(String(p[t[0]] || '')) && String(r[t[0]] || '') === 'not found in page source') {
          add('tag-lost', 'amber', t[1] + ' tag lost since last scan');
        }
      });
    });
    return out.filter(function (a) { return a.level === 'red'; }).concat(out.filter(function (a) { return a.level === 'amber'; }));
  }

  // alerts -> suggested RR_OPEN-WORK rows for the slip. One row per key and kind.
  function openWorkRows(list, todayUk) {
    var seen = {};
    return (list || []).filter(function (a) {
      var k = a.key + '|' + a.kind;
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    }).map(function (a) {
      return {
        title: a.text,
        area: 'Web Estate',
        priority: a.level === 'red' ? 'high' : 'medium',
        note: 'Estate alert (' + a.kind + ')' + (todayUk ? ' seen ' + todayUk : '') + '. Suggested only; check before adding.',
        suggested_by: 'estate engine'
      };
    });
  }

  return { WITHIN: WITHIN, RED_WITHIN: RED_WITHIN, alerts: alerts, openWorkRows: openWorkRows };
});
