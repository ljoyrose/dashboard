// JOB 32: invented apps for the next-step marker and the per-stage checks (APP-A, APP-B, APP-C; no real names or data).
// Adds to a state from ./state.js build(now): APP-A has its own lines (pass, fail, not run), APP-B waits on a decision,
// APP-C has nothing recorded. The Step 6 template holds 53 rule lines, as the live data did.
(function (root) {
  function add(s, now) {
    now = now || Date.now();
    var H = 36e5;
    var task = function (o) {
      return Object.assign({ status: 'to do', color: '#87909e', tags: [], url: 'https://app.clickup.com/t/' + o.id, updated: now - H, created: now - 9 * H, parent: null, desc: '', links: {}, pri: null, due: null, who: [], chk: [], est: 0, spent: 0, cm: [], files: [] }, o);
    };
    s.lists.apps.push(
      task({ id: 'appa00001', name: 'APP-A', status: '4 schema', tags: ['st-4'] }),
      task({ id: 'appb00001', name: 'APP-B', status: '1 research', tags: ['st-1'] }),
      task({ id: 'appc00001', name: 'APP-C', status: '0 idea', tags: ['st-0'] }));
    var L = function (id, st, name, o) { return task(Object.assign({ id: id, name: 'APP-A · ' + name, tags: ['line', 'st-' + st, 'app-appa00001'] }, o)); };
    s.lists.work.push(
      L('alin00001', 3, 'Features locked', { status: 'done' }),
      L('alin00002', 3, 'Rival check', { status: 'failed' }),
      L('alin00003', 4, 'Tables named', { status: 'done' }),
      L('alin00004', 4, 'Write the schema notes', { tags: ['line', 'st-4', 'app-appa00001', 'who-claude'], created: now - 8 * H }),
      L('alin00005', 4, 'Check the row rules', { created: now - 7 * H }),
      L('alin00006', 5, 'Seed the sample rows', { created: now - 6 * H }));
    s.lists.decisions.push(task({ id: 'decb00001', name: 'APP-B · Research merit OK?', tags: ['who-lisa'], desc: 'GATE: appb00001 merit' }));
    s.lists.template = s.lists.template || [];
    for (var i = 1; i <= 53; i++) s.lists.template.push(task({ id: 'tpl6' + ('0000' + i).slice(-5), name: '6 · Rule line ' + i, parent: 'tplroot', tags: ['st-6', 'who-claude'] }));
    s.lists.template.push(task({ id: 'tpl400001', name: '4 · Schema rule', parent: 'tplroot', tags: ['st-4'] }));
    return s;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { add: add };
  else root.AF_NEXT = add;
})(this);
