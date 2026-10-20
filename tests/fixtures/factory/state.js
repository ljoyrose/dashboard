// A pretend af-state.json for the Factory page (invented apps and tasks; ids shaped like ClickUp's).
// 869fk9d1r is the send that hid under "Factory" on 20 Oct: its name starts "Links ·" but the app is "Sample Links";
// only its app- tag ties them. Times are relative to `now`, so the page sees fresh data.
(function (root) {
  function build(now) {
    now = now || Date.now();
    var H = 36e5, D = 864e5;
    var task = function (o) {
      return Object.assign({ status: 'to do', color: '#87909e', tags: [], url: 'https://app.clickup.com/t/' + o.id, updated: now - H, created: now - D, parent: null, desc: '', links: {}, pri: null, due: null, who: [], chk: [], est: 0, spent: 0, cm: [], files: [] }, o);
    };
    var apps = [
      task({ id: '869fjxpc2', name: 'Sample Links', status: '4 schema', tags: ['st-4', 'who-claude', 'app-links'], desc: 'overskill: https://overskill.example.test/p/1' }),
      task({ id: '869fk9834', name: 'Kennel Book', status: '4 schema', tags: ['fam-breeder'] }),
      task({ id: '869fk8geg', name: 'TEST-Kennel Book', status: '2 base', tags: ['app-869fk8geg', 'st-2', 'fam-breeder'] }),
      task({ id: '869fjxpc9', name: 'Vet Converter', status: '0 idea', tags: ['st-0', 'who-lisa'] }),
      task({ id: '869fka369', name: 'TEST-Door Check', status: '1 research', tags: ['st-1', 'app-869fka369'] })
    ];
    var sends = [
      task({ id: '869fk9d1r', name: 'Links · P5-GATE-v11 (lock 38 tables) · send 2 of 2', tags: ['app-869fjxpc2', 'app-links'], created: now - 2 * H,
        desc: 'Send 2 of 2.\nPrompt text: https://drive.google.com/file/d/1SAMPLEpromptDocId00000000000/view\nApp: Sample Links.' }),
      task({ id: '869fk9d1n', name: 'Links · P5-READ-v13 (read-only check) · send 1 of 2', tags: ['app-869fjxpc2', 'app-links'], created: now - 3 * H, status: 'done' }),
      task({ id: '869fk6k00', name: 'Kennel Book · P2 · Dogs list', tags: ['app-869fk9834'], created: now - 5 * H }),
      task({ id: '869fk6jzc', name: 'TEST-Kennel Book · P1 · Tenant roles', tags: ['app-869fk8geg'], created: now - 6 * H })
    ];
    var decisions = [
      task({ id: 'dec000001', name: 'Sample Links · Lock the 38 tables?', tags: ['gate'], created: now - H, desc: 'Deciding: lock the tables now\nYes = send the lock prompt\nNo = wait a day' }),
      task({ id: 'dec000002', name: 'Kennel Book · Research merit OK?', tags: ['st-1'], created: now - 4 * H, pri: { p: 'high', c: '#ffcc00' } }),
      task({ id: 'dec000003', name: 'TEST-Door Check · Screen the idea?', tags: ['gate'], created: now - 7 * H }),
      task({ id: 'dec000004', name: 'Keep 12px corners on every card?', created: now - 8 * H, pri: { p: 'urgent', c: '#f50000' } })
    ];
    var work = [
      task({ id: 'wrk000001', name: 'Vet Converter · Test the import on 3 files', tags: ['who-lisa'], created: now - 30 * 60e3, due: now - 2 * D }),
      task({ id: 'wrk000002', name: 'Kennel Book · Fix the pedigree PDF', tags: ['who-lisa'], created: now - 9 * H }),
      task({ id: 'wrk000003', name: 'Sample Links · Write schema notes', tags: ['who-grok'], created: now - 10 * H }),
      task({ id: 'wrk000004', name: 'Kennel Book · Schema check', tags: ['who-claude', 'line', 'st-4', 'app-869fk9834'], created: now - 11 * H })
    ];
    return {
      generated_at: new Date(now - 60e3).toISOString(), mode: 'TEST', factory: 'ON', budget: {}, failed: [], statuses: {}, cards: [], spend: {},
      health: [{ job: 'syncState', result: 'OK', last: new Date(now - 60e3).toISOString(), schedule: 'every 15 min' }],
      lists: { apps: apps, decisions: decisions, incidents: [task({ id: 'inc000001', name: 'Live check failed', tags: ['incident', 'who-claude'] })], claude: [], template: [], sends: sends, work: work, families: [] }
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { build: build };
  else root.AF_FIXTURE = build;
})(this);
