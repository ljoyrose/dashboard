// Vision 2029 · Illustrative. An INVENTED af-state.json for the REAL factory page (factory/index.html),
// filled forward to about 1,000 live apps (D11: same pages, panels and names, only more data).
// Counts come from course/glossary.json "vision2029". Every app, person and figure is fictional.
// Shape copied from tests/fixtures/factory/state.js (the page's own test fixture).
const fs = require('fs');
const path = require('path');
const G = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'glossary.json'), 'utf8'));
const V = G.vision2029;

// Invented name parts (animal, regulatory and service themes). Real idea names are never used (D5).
const A = ['Kennel', 'Paddock', 'Litter', 'Stable', 'Whisker', 'Feather', 'Hoof', 'Burrow', 'Meadow', 'Harbour', 'Clover', 'Willow', 'Bramble', 'Copper', 'Linden', 'Saffron', 'Juniper', 'Pebble', 'Thistle', 'Rowan', 'Hazel', 'Marlow', 'Quill', 'Tansy', 'Fennel'];
const B = ['ledger', 'line', 'proof', 'desk', 'book', 'track', 'gate', 'log', 'hub', 'pass', 'board', 'note', 'mark', 'post', 'keep', 'check', 'room', 'path', 'list', 'well'];
const FAM = ['fam-breeder', 'fam-kennel', 'fam-groom', 'fam-vet', 'fam-equine', 'fam-trainer', 'fam-rescue', 'fam-farm', 'fam-club', 'fam-clinic'];
const FEATURED = [['Litterline', 'fam-breeder'], ['Stayproof', 'fam-kennel'], ['Trimtable', 'fam-groom']];

function build(now) {
  now = now || Date.now();
  const H = 36e5, D = 864e5;
  let seq = 0;
  const id = (p) => p + (100000 + seq++).toString(36);
  const task = (o) => Object.assign({ status: 'to do', color: '#756E65', tags: [], url: '', updated: now - H, created: now - D, parent: null, desc: '', links: {}, pri: null, due: null, who: [], chk: [], est: 0, spent: 0, cm: [], files: [] }, o);
  const names = new Set();
  const name = (i) => {
    let n = A[i % A.length] + B[Math.floor(i / A.length) % B.length];
    if (names.has(n)) n += ' ' + (Math.floor(i / (A.length * B.length)) + 2);
    names.add(n);
    return n;
  };
  const STATUS = { 0: '0 idea', 1: '1 research', 2: '2 base', 3: '3 features', 4: '4 schema', 5: '5 data', 6: '6 prompts', 7: '7 launch', 8: '8 operate' };
  const apps = [];
  let k = 0;
  FEATURED.forEach(([n, fam], i) => apps.push(task({ id: id('869v'), name: n, status: [STATUS[8], STATUS[7], STATUS[6]][i], tags: ['st-' + [8, 7, 6][i], fam], created: now - (400 - i * 90) * D })));
  for (const [st, count] of Object.entries(V.per_stage)) {
    const left = count - apps.filter((a) => a.status === STATUS[st]).length;
    for (let i = 0; i < left; i++, k++) {
      apps.push(task({ id: id('869v'), name: name(k), status: STATUS[st], tags: ['st-' + st, FAM[k % FAM.length]], created: now - ((k * 7) % 1090) * D, updated: now - ((k * 13) % 72) * H }));
    }
  }
  for (let i = 0; i < V.rescue; i++, k++) apps.push(task({ id: id('869v'), name: name(k), status: 'rescue', tags: ['st-8', 'rescue', FAM[k % FAM.length]] }));
  for (let i = 0; i < V.retired; i++, k++) apps.push(task({ id: id('869v'), name: name(k), status: 'retired', tags: [FAM[k % FAM.length]], updated: now - 30 * D }));

  const dec = (n, g, ask, yes, no, hrs) => task({ id: id('dec'), name: `${n} · ${ask}`, tags: ['gate'], created: now - hrs * H, desc: `Deciding: ${ask}\nYes = ${yes}\nNo = ${no}\nGate: ${g}` });
  const decisions = [
    dec('Hazelproof', 'Screen', 'Start work on this idea?', 'open research', 'park it', 1),
    dec('Quillgate', 'Merit', 'Is it worth building?', 'go to Base', 'hold', 3),
    dec('Copperbook', 'Lock', 'Freeze the feature list?', 'lock 14 bricks', 'reshape', 4),
    dec('Rowanpass', 'Invest', 'Spend 2,140 credits?', 'send the build', 'wait for Happy Hour', 5),
    dec('Stayproof', 'Launch', 'Open it to real users?', 'go live', 'one more walk', 6),
    dec('Fennelcheck', 'Back to Operate', 'Is the fix proved live?', 'back to Radar', 'keep in Rescue', 8),
    dec('Marlowlog', 'Retire', 'Switch it off and archive it?', 'retire, parts to Reserve', 'keep one more month', 20)
  ];
  const sends = [
    task({ id: id('snd'), name: 'Trimtable · P4 · Booking reminders · send 1 of 2', tags: ['st-6'], created: now - 2 * H, desc: 'Send 1 of 2.\nLast turn: proved live from outside\nAFTER SEND YOU MUST: run the leak tests' }),
    task({ id: id('snd'), name: 'Trimtable · P3 · Client portal · send 2 of 2', tags: ['st-6'], created: now - 5 * H, status: 'done' })
  ];
  const work = [
    task({ id: id('wrk'), name: 'Litterline · Monthly money line (in 1,840 out 410)', tags: ['who-lisa', 'st-8'], created: now - 2 * H }),
    task({ id: id('wrk'), name: 'Stayproof · Launch walk on phone', tags: ['who-claude', 'line', 'st-7'], created: now - 3 * H }),
    task({ id: id('wrk'), name: 'Copperbook · Table tests 4.4', tags: ['who-claude', 'line', 'st-4'], created: now - 4 * H }),
    task({ id: id('wrk'), name: 'Weekly security check · 1,004 apps', tags: ['who-grok', 'st-8'], created: now - 6 * H })
  ];
  const incidents = Array.from({ length: V.rescue }, (_, i) => task({ id: id('inc'), name: ['Checkout link timed out', 'Reminder bot missed a run', 'Slow report on one brand'][i], tags: ['incident', 'who-claude'], created: now - (i + 1) * 5 * H }));
  const iso = (ms) => new Date(now - ms).toISOString();
  return {
    generated_at: iso(60e3), mode: 'LIVE', factory: 'ON', budget: { month_credits: V.credits_month, stop_line: V.credits_stop_line }, failed: [], statuses: {}, cards: [], spend: {},
    health: [
      { job: 'syncState', result: 'OK', last: iso(60e3), schedule: 'every 15 min' },
      { job: 'leakProbe', result: 'OK · All clear · ' + V.tables_probed.toLocaleString('en-GB') + ' tables', last: iso(3 * H), schedule: 'daily 06:40' },
      { job: 'staleCheck', result: 'OK', last: iso(3.5 * H), schedule: 'daily 06:10' },
      { job: 'dailyDigest', result: 'OK', last: iso(2 * H), schedule: 'weekdays 07:30' },
      { job: 'weeklyBackup', result: 'OK', last: iso(2 * D), schedule: 'Mondays 05:20' }
    ],
    lists: { apps, decisions, incidents, claude: [], template: [], sends, work, families: [] }
  };
}
module.exports = { build };
