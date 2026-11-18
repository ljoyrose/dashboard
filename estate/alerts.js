// Web Estate Hub, Stage 11: alerts and suggested open-work rows. Pure: no network, no Drive, no DOM.
// Suggested rows are for the slip only; code never writes them anywhere. Reuses estate/core.js.
// Nothing here changes DNS, a registrar or a mailbox.
(function (root, factory) {
  'use strict';
  var core = (typeof module === 'object' && module.exports) ? require('./core.js') : root.EstateCore;
  var status = (typeof module === 'object' && module.exports) ? require('./status.js') : root.EstateStatus;
  var mail = (typeof module === 'object' && module.exports) ? require('./mail.js') : root.EstateMail;
  var api = factory(core, status, mail);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EstateAlerts = api;
})(this, function (E, S, M) {
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

  function bare(r) {
    return String(r.url_or_domain || r.key || '').trim().toLowerCase().replace(/^https?:\/\//, '').split(/[\/?#]/)[0].replace(/^www\./, '');
  }
  function mailRow(r) { return r.kind === 'email-domain' || r.spf || r.dmarc || r.dkim || r.mx; }

  // rows, today ('2026-10-29' or a Date), previousRows (last scan, optional), mailMap (Mail map rows that passed the
  // header contract, optional) -> [{ key, kind, level, text }]. Red first, then amber; inside a level the row order is kept.
  // With a Mail map: no MX is only flagged on a domain that has addresses on it (2.5), and each address on a mail
  // domain is followed (2.6): a loop is red, an unknown target or 3 or more stops is amber.
  function alerts(rows, today, previousRows, mailMap) {
    var out = [], prev = {};
    (previousRows || []).forEach(function (p) { if (p && p.key) prev[p.key] = p; });
    (rows || []).forEach(function (r) {
      var add = function (kind, level, text) { out.push({ key: r.key, kind: kind, level: level, text: label(r) + ': ' + text }); };
      if (E.statusOf(r) === 'down') add('down', 'red', 'down' + (r.live_status ? ' (' + r.live_status + ')' : ''));
      [['ssl_expires', 'ssl', 'certificate'], ['domain_expires', 'domain', 'domain']].forEach(function (x) {
        var d = E.daysUntil(r[x[0]], today);
        if (d !== null && d <= WITHIN) add(x[1], d <= RED_WITHIN ? 'red' : 'amber', x[2] + ' ' + dayWords(d));
      });
      var chains = (mailMap && M && M.domainHops && mailRow(r)) ? M.domainHops(bare(r), mailMap) : [];
      var mr = r;
      if (mailMap && mailRow(r)) { mr = {}; Object.keys(r).forEach(function (k) { mr[k] = r[k]; }); mr.mail_addresses = chains.length; }
      var mail = E.emailProblems(mr);
      if (mail.indexOf('DMARC missing') !== -1) add('dmarc', 'amber', 'DMARC missing');
      if (mail.indexOf('DMARC weak') !== -1) add('dmarc', 'amber', 'DMARC weak (p=none, no report address)');
      if (mail.indexOf('two SPF records') !== -1) add('spf', 'amber', 'two SPF records (mail can fail)');
      if (mail.indexOf('SPF broken') !== -1) add('spf', 'amber', 'SPF broken');
      if (mail.indexOf('DKIM missing') !== -1) add('dkim', 'amber', 'DKIM missing (Google Workspace)');
      if (mail.indexOf('no MX') !== -1) add('mx', 'amber', 'no MX');
      if (mail.indexOf('more than one forward hop') !== -1) {
        var chain = M && M.forwardChain ? M.forwardChain(r) : null;
        add('forward', 'amber', chain && chain.text ? chain.text : 'more than one forward hop');
      }
      if (mail.indexOf('target unknown, needs registrar export') !== -1) add('forward', 'amber', 'target unknown, needs registrar export');
      chains.forEach(function (c) {
        if (c.loop) add('forward-loop', 'red', c.text);
        else if (c.unknown) add('forward', 'amber', c.address + ': target unknown: needs Namecheap export');
        else if (c.hops >= 2) add('forward', 'amber', c.text);
      });
      var p = prev[r.key];
      if (S) {
        var prevNs = (p && S.nameserverList(p.nameservers).length) ? p.nameservers : (S.nameserverList(r.nameservers_previous).length ? r.nameservers_previous : '');
        if (prevNs) {
          var ch = S.nameserverChange(r.nameservers, prevNs);
          if (ch && ch.changed) add('ns', 'amber', 'nameservers changed from ' + ch.previous.join(', '));
        }
      }
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
