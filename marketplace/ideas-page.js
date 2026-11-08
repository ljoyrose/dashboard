/* Marketplace "Product ideas" page code. Loaded on demand (only when Ideas is opened) together with ideas.js, so the hub's
 * first load stays small. The hub passes in what it owns (rows, helpers, sign-in); nothing here touches anything else.
 * Items to SELL; not the App Factory. Contract: docs/marketplace-ideas/CONTRACT.md. Cards are made by the engine from ONE
 * request file the form writes; this page only reads them and writes answer cells. */
window.MktIdeasPage = function (C) {
  'use strict';
  var detail = C.detail, shown = C.shown, waiting = C.waiting, esc = C.esc, emptyCard = C.emptyCard, linkBtn = C.linkBtn, factsOf = C.factsOf, moneyLines = C.moneyLines,
    npMoney = C.npMoney, hm = C.hm, banner = C.banner, api = C.api, answer = C.answer, find = C.find, render = C.render, DashAuth = C.DashAuth;
  var IDEAS = window.MktIdeas, M = C.M, WRITE = (C.CFG.scopes || {}).write, ideaFilter = 'open', ideaForm = {}, ideaErr = {}, ideaNote = '', ideaBusy = false, pendingAsk = null;
  var IDEA_FIELDS = [['name', 'Name', 'Product name', true], ['barcode', 'Barcode', 'EAN or barcode number'], ['link', 'Link', 'https://'], ['price_seen', 'Price you saw', 'for example 4.50'],
    ['where_seen', 'Where you saw it', 'shop or site'], ['image_link', 'Photo link', 'Drive link, https://'], ['own_audience_fit', 'Who of yours might buy it', 'for example puppy buyers'], ['note', 'Note', 'anything else']];
  var WORDS = { physical: 'Physical', digital: 'Digital', b2c: 'Sells to people', b2b: 'Sells to trade', white_label: 'White label', own_brand: 'My own brand', supplier_brand: 'Supplier\'s brand', resell: 'Resell a branded product',
    hold_stock: 'I hold stock', dropship: 'Dropship', made_to_order: 'Made to order', maker: 'Maker', wholesaler: 'Wholesaler', distributor: 'Distributor', licence: 'Licence',
    new: 'New', screening: 'Screening', researching: 'Researching', testing: 'Testing', launched: 'Launched', dropped: 'Dropped', go: 'Go', maybe: 'Maybe', no: 'No' };
  var word = function (k) { return WORDS[k] || k; };
  var ideaId = function (r) { return r.key.replace(/^IDEA\|/, ''); };
  function ideaRows() { return C.rows().filter(function (r) { return r.section === 'idea' && shown(r); }); }
  function ideaBucket(r) { var d = detail(r); return r.answer === 'Go' ? 'go' : (r.answer === 'No' || d.status === 'dropped') ? 'dropped' : r.answer === 'Maybe' ? 'maybe' : 'open'; }
  function sentList() { try { return JSON.parse(localStorage.getItem('mkt.ideas.sent') || '[]'); } catch (e) { return []; } }
  function sentSave(l) { try { localStorage.setItem('mkt.ideas.sent', JSON.stringify(l.slice(-20))); } catch (e) {} }
  function ideaLine(r) { var d = detail(r); return [word(d.status || 'new'), 'Gate ' + (d.gate || 0), d.verdict ? 'Verdict ' + word(d.verdict) : 'No verdict yet', d.next_step].filter(Boolean).join(' · '); }
  function pageIdeas() {
    if (C.viewArg() === 'add') return pageIdeaAdd();
    var all = ideaRows(), cnt = { open: 0, go: 0, maybe: 0, dropped: 0, all: all.length };
    all.forEach(function (r) { cnt[ideaBucket(r)]++; });
    var seen = {}; C.rows().forEach(function (r) { seen[r.key] = 1; });
    var pend = sentList().filter(function (s) { return !seen[IDEAS.cardKey(s.id)]; });
    var h = '<p class="needs">Ideas: ' + waiting('idea').length + '</p><p class="hint">Items you might sell. Add one; the investigator fills in the rest. Nothing is bought, listed or sent.</p>' +
      '<div class="acts"><a class="btn main" href="#/ideas/add">Add idea</a><a class="btn" href="#/newstock">New stock</a></div>' +
      '<div class="chips" role="group" aria-label="Show ideas">' + [['open', 'Open'], ['go', 'Go'], ['maybe', 'Maybe'], ['dropped', 'Dropped'], ['all', 'All']].map(function (f) {
        return '<button class="chip" type="button" data-ifilter="' + f[0] + '" aria-pressed="' + (ideaFilter === f[0]) + '">' + f[1] + ' ' + cnt[f[0]] + '</button>'; }).join('') + '</div>';
    pend.forEach(function (s) { var late = Date.now() - s.t > 30 * 60000;
      h += '<div class="card"><h2>' + esc(s.name) + '</h2><p class="what">' + (s.dry ? 'Test only: nothing is made until this page is live.' : late ? 'Sent ' + hm(s.t) + ' but no card yet. The engine may be off: ask Steward.' : 'Sent ' + hm(s.t) + '. The card shows in about 10 minutes.') + '</p></div>'; });
    var list = all.filter(function (r) { return ideaFilter === 'all' || ideaBucket(r) === ideaFilter; });
    if (!list.length && !pend.length) return h + emptyCard(all.length ? 'Nothing here' : 'No ideas yet', all.length ? 'Try another filter.' : 'Tap Add idea to start.');
    list.forEach(function (r) { h += '<div class="card row"><div class="txt"><a href="#/idea/' + esc(encodeURIComponent(ideaId(r))) + '"><b>' + esc(r.title) + '</b></a><div class="why">' + esc(ideaLine(r)) + '</div></div></div>'; });
    return h;
  }
  function pageIdeaAdd() {
    var h = '<p class="needs">Add idea</p><p class="hint">Only the name is needed. Add what you have.</p><div class="card">' + (M.live ? '' : '<p class="what">Test mode: the request is marked test and no card is made.</p>');
    IDEA_FIELDS.forEach(function (f) { var id = 'if-' + f[0];
      h += '<p><label for="' + id + '">' + esc(f[1]) + (f[3] ? ' (needed)' : '') + '</label><input class="txtin" id="' + id + '" data-iform="' + f[0] + '" value="' + esc(ideaForm[f[0]] || '') + '" placeholder="' + esc(f[2]) + '" autocomplete="off"' + (ideaErr[f[0]] ? ' aria-invalid="true" aria-describedby="' + id + '-e"' : '') + '>' +
        (ideaErr[f[0]] ? '<span class="why red" id="' + id + '-e" role="alert">' + esc(ideaErr[f[0]]) + '</span>' : '') + '</p>'; });
    return h + (ideaNote ? '<p class="why red" role="alert">' + esc(ideaNote) + '</p>' : '') + '<div class="acts"><button class="btn main yes" type="button" data-action="ideasend"' + (ideaBusy ? ' disabled' : '') + '>' + (ideaBusy ? 'Sending…' : 'Send') + '</button><a class="btn" href="#/ideas">Cancel</a></div></div>';
  }
  function withWrite(go) {
    var s = DashAuth.valid(); if (s && WRITE && DashAuth.hasScope(s, WRITE)) return go();
    pendingAsk = go; C.auth().requestWrite(WRITE);
  }
  // ONE request file per idea, nothing else is written. The id is made once per send.
  function ideaSend() {
    if (ideaBusy) return;
    var v = IDEAS.validateIntake(ideaForm); ideaErr = v.errors; ideaNote = '';
    if (!v.ok) { render(); var first = document.getElementById('if-' + Object.keys(v.errors)[0]); if (first) first.focus(); return; }
    if (!M.ideasRequestsFolderId) { ideaNote = 'Not set up yet: there is no folder for idea requests in config.js. Nothing was sent. Your answers are kept.'; return render(); }
    ideaBusy = true; render();
    withWrite(function () {
      var req = IDEAS.buildRequest(v.clean, Date.now(), C.me(), { dryRun: !M.live }), b = 'mk' + Date.now(), meta = { name: IDEAS.fileName(req.id), parents: [M.ideasRequestsFolderId], mimeType: 'application/json' };
      var body = '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n--' + b + '\r\nContent-Type: application/json\r\n\r\n' + JSON.stringify(req) + '\r\n--' + b + '--';
      return api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body: body }).then(function () {
        var l = sentList(); l.push({ id: req.id, name: req.name, t: Date.now(), dry: req.dry_run }); sentSave(l);
        ideaBusy = false; ideaForm = {}; ideaErr = {}; banner('Sent ' + hm(Date.now()) + (req.dry_run ? ' (test only)' : ''), true); location.hash = '#/ideas';
      }).catch(function (e) { ideaBusy = false; ideaNote = 'Not sent: ' + e.message + '. Your answers are kept.'; render(); });
    });
  }
  var GATE_NAMES = { gate1: 'Gate 1 · Research', gate2: 'Gate 2 · Test plan', gate3: 'Gate 3 · Launch and monitor' };
  function gateBlock(v) {   // free-form: words, a list of words, or label: words
    if (Array.isArray(v)) return '<ul class="asks">' + v.map(function (x) { return '<li>' + esc(typeof x === 'object' ? JSON.stringify(x) : x) + '</li>'; }).join('') + '</ul>';
    if (v && typeof v === 'object') return factsOf(Object.keys(v).map(function (k) { return [k.replace(/_/g, ' '), typeof v[k] === 'object' ? JSON.stringify(v[k]) : v[k]]; }));
    return '<p class="what">' + esc(v) + '</p>';
  }
  function pageIdea() {
    var r = find(IDEAS.cardKey(decodeURIComponent(C.viewArg())));
    var back = '<p><a href="#/ideas">Ideas</a></p>';
    if (!r) return back + emptyCard('Not found', 'This idea is not on the list. It may still be on its way.');
    var d = detail(r), probs = IDEAS.checkDetail(d), c = d.classification || {}, it = d.intake || {}, m = d.margin_est || {}, ready = IDEAS.goReady(d), pd = function (p) { return p === null || p === undefined ? 'unknown' : npMoney(p); };
    var h = back + '<div class="card"><h2>' + esc(r.title) + '</h2><p class="what">' + esc(ideaLine(r)) + '</p>' +
      (r.answer ? '<p class="what"><b>Your answer: ' + esc(r.answer) + '</b>' + (r.note ? ' · ' + esc(r.note) : '') + (r.applied_at ? ' · done' : '') + '</p>' : '') +
      (d.status === 'dropped' ? '<p class="what">Dropped: ' + esc(d.dropped_reason || 'no reason given') + '</p>' : '') +
      (probs.length ? '<p class="why red" role="alert">This card has problems (' + esc(probs.map(function (p) { return p.field || 'detail'; }).join(', ')) + '). Ask Steward.</p>' : '') +
      '<div class="acts">' + linkBtn(it.link, 'Open link') + linkBtn(it.image_link, 'Open photo') + linkBtn(IDEAS.infinityLink(d), 'Open on board') + '</div>' +
      (IDEAS.infinityLink(d) ? '' : '<p class="hint">Board item: not made yet. The engine adds it.</p>') +
      '<h3>What you gave</h3>' + (factsOf([['Barcode', it.barcode], ['Price seen', it.price_seen], ['Where seen', it.where_seen], ['Your buyers', it.own_audience_fit], ['Note', it.note]]) || '<p class="what">Only the name.</p>') +
      '<h3>What it is</h3>' + (factsOf(['product_type', 'buyer', 'branding', 'fulfilment', 'source'].map(function (k) { return [k.replace('_', ' '), c[k] ? word(c[k]) + (d.classification_assumed ? ' (assumed)' : '') : '']; })) || '<p class="what">Not worked out yet.</p>') +
      '<h3>Gate 0 · Quick screen</h3>' + (d.verdict || d.next_step ? factsOf([['Verdict', word(d.verdict)], ['Margin per unit, worst', m.worst === undefined ? '' : pd(m.worst)], ['Expected', m.expected === undefined ? '' : pd(m.expected)], ['Best', m.best === undefined ? '' : pd(m.best)], ['Stop rule', d.kill_rule], ['Next step', d.next_step]]) : '<p class="what">Not screened yet.</p>') +
      ((d.top3_risks || []).length ? '<h3>Biggest risks</h3>' + gateBlock(d.top3_risks) : '') + ((d.top3_unknowns || []).length ? '<h3>Biggest unknowns</h3>' + gateBlock(d.top3_unknowns) : '') +
      ((d.evidence || []).length ? '<h3>Evidence</h3><ul class="asks">' + d.evidence.map(function (e) { return '<li><b>' + (e.status === 'verified' ? 'Verified' : 'Assumed') + '</b>: ' + esc(e.claim) + (e.source ? ' <span class="hint">(' + esc(e.source) + ')</span>' : '') + '</li>'; }).join('') + '</ul>' : '');
    ['gate1', 'gate2', 'gate3'].forEach(function (g) { h += '<h3>' + GATE_NAMES[g] + '</h3>' + (d[g] ? gateBlock(d[g]) : '<p class="what">' + ((d.gate || 0) >= Number(g.slice(4)) ? 'Nothing recorded yet.' : 'Not started. Only after a Go.') + '</p>'); });
    h += (d.unit_inc_p || d.supplier || (d.lines || []).length ? '<h3>Money and supplier</h3>' + factsOf([['Cost each inc VAT', d.unit_inc_p ? npMoney(d.unit_inc_p) : ''], ['Profit each', d.profit_p !== undefined ? pd(d.profit_p) : ''], ['Sells', d.sell], ['Min qty', d.moq], ['Supplier', d.supplier], ['Free postage from', (d.terms || {}).free_over], ['Min order', (d.terms || {}).min_order]]) + moneyLines(d.lines) : '');
    if (r.answer && !r.applied_at) return h + '<div class="acts"><button class="btn" type="button" data-ideaundo="' + esc(r.key) + '">Undo</button></div></div>';
    if (r.answer) return h + '</div>';
    var k = esc(r.key);
    return h + '<h3>Your answer</h3><p><label for="idea-note">Why (needed for No)</label><input class="txtin" id="idea-note" data-note="' + k + '"></p>' +
      (d.verdict === 'go' && !ready.ok ? '<p class="what">To move it to New stock, it still needs: ' + esc(ready.missing.join(', ')) + '.</p>' : '') +
      '<div class="acts"><button class="btn main yes" type="button" data-ideago="' + k + '"' + (ready.ok ? '' : ' disabled') + '>Move to New stock</button><button class="btn" type="button" data-ideamaybe="' + k + '">Maybe</button><button class="btn" type="button" data-ideano="' + k + '">No</button></div></div>';
  }
  function ideaAnswer(key, v, note) { var r = find(key); if (!r) return; if (v === 'Go' && !IDEAS.goReady(detail(r)).ok) return banner('Not ready for New stock yet.'); return answer(r, v, note); }

  /** One tap on a button or link the hub did not handle. Returns true when it was an Ideas tap. */
  function click(t, a) {
    if (a === 'ideasend') { ideaSend(); return true; }
    if (t.hasAttribute('data-ifilter')) { ideaFilter = t.getAttribute('data-ifilter'); render(); return true; }
    if (t.hasAttribute('data-ideago')) { t.disabled = true; ideaAnswer(t.getAttribute('data-ideago'), 'Go', 'to=newstock'); return true; }
    if (t.hasAttribute('data-ideamaybe')) { var mn = document.querySelector('[data-note="' + t.getAttribute('data-ideamaybe') + '"]'); t.disabled = true; ideaAnswer(t.getAttribute('data-ideamaybe'), 'Maybe', mn ? mn.value.trim() : ''); return true; }
    if (t.hasAttribute('data-ideano')) { var nn = document.querySelector('[data-note="' + t.getAttribute('data-ideano') + '"]'), nv = nn ? nn.value.trim() : ''; if (!nv) { banner('Say why in a few words, then tap No.'); return true; } t.disabled = true; ideaAnswer(t.getAttribute('data-ideano'), 'No', nv); return true; }
    if (t.hasAttribute('data-ideaundo')) { t.disabled = true; answer(find(t.getAttribute('data-ideaundo')), '', ''); return true; }
    return false;
  }
  /** Typing in the Add idea form: keep the words, clear that box's error. */
  function input(e) { var f = e.target.getAttribute && e.target.getAttribute('data-iform'); if (f) { ideaForm[f] = e.target.value; if (ideaErr[f]) { delete ideaErr[f]; var er = document.getElementById('if-' + f + '-e'); if (er) er.remove(); e.target.removeAttribute('aria-invalid'); } } }
  /** True while a Drive write permission is being asked for (the hub then skips its spreadsheet-scope check). */
  function pendingWrite() { return !!pendingAsk; }
  /** The hub got a fresh sign-in token: carry on the send that was waiting for the Drive permission. */
  function onToken() {
    if (!pendingAsk) return;
    var go = pendingAsk; pendingAsk = null;
    if (DashAuth.hasScope(DashAuth.valid(), WRITE)) go(); else { ideaBusy = false; ideaNote = 'Saving was not allowed by Google. Tap Send again and choose Allow.'; render(); }
  }
  return { page: function () { return C.view() === 'ideas' ? pageIdeas() : pageIdea(); }, click: click, input: input, pendingWrite: pendingWrite, onToken: onToken };
};
