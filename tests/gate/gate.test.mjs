// Tests for tools/gate/gate.mjs. Run: node --test tests/gate/gate.test.mjs
// Invented fixtures only. No real cards, apps, people or data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadData, evalCard, evalGate, aliasMap, normTransition, selftest, main } from '../../tools/gate/gate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const GATE = join(HERE, '..', '..', 'tools', 'gate', 'gate.mjs');
const data = () => loadData();
const clean = (gates) => ({ card_id: 'TEST-CARD-1', ck45_pending: 0, ck50_open_obligations: 0, gates });
const lisa = (verdict, extra = {}) => ({ verdict, stamped_by: 'lisa', ...extra });
// A copy of the data with every conflict resolved, to prove the gates themselves work once Lisa has ruled.
const resolved = () => { const d = data(); d.conflicts.forEach((c) => { c.status = 'RESOLVED'; }); return d; };

// ---- data integrity -------------------------------------------------------------------------------------------

test('data: 13 gate rows (the 12 plus BASE), 12 transitions, ids unique', () => {
  const d = data();
  assert.equal(d.gates.length, 13);
  assert.equal(d.transitions.length, 12);
  assert.equal(new Set(d.gates.map((g) => g.id)).size, 13);
  assert.equal(d.gates.filter((g) => g.id !== 'BASE').length, 12);
});

test('data: every row has the required fields and a valid confidence', () => {
  for (const g of data().gates) {
    for (const f of ['id', 'framework_name', 'aliases', 'transition', 'guard_type', 'owner', 'verdict_set', 'source_citation', 'confidence', 'conflict_ids']) {
      assert.ok(f in g, `${g.id} lacks ${f}`);
    }
    assert.ok(['HIGH', 'MED', 'LOW'].includes(g.confidence), `${g.id} confidence`);
    assert.ok(['Lisa stamp', 'test', 'Claude lens', 'auto'].includes(g.guard_type), `${g.id} guard_type`);
    assert.ok(g.pass_verdicts.every((v) => g.verdict_set.includes(v)), `${g.id} pass_verdicts are inside verdict_set`);
  }
});

test('data: framework guard split is 5 Lisa stamps, 1 Claude lens, 6 tests/auto among the 12', () => {
  const twelve = data().gates.filter((g) => g.id !== 'BASE');
  assert.equal(twelve.filter((g) => g.guard_type === 'Lisa stamp').length, 5);
  assert.equal(twelve.filter((g) => g.guard_type === 'Claude lens').length, 1);
  assert.equal(twelve.filter((g) => g.guard_type === 'test' || g.guard_type === 'auto').length, 6);
});

test('data: every transition requires only gates that exist', () => {
  const d = data();
  const ids = new Set(d.gates.map((g) => g.id));
  for (const t of d.transitions) for (const r of t.requires) assert.ok(ids.has(r), `${t.id} requires unknown ${r}`);
});

test('data: conflict ids are consistent between gates and conflicts', () => {
  const d = data();
  const cids = new Set(d.conflicts.map((c) => c.id));
  for (const g of d.gates) for (const c of g.conflict_ids) assert.ok(cids.has(c), `${g.id} cites unknown ${c}`);
  for (const c of d.conflicts) {
    const holders = d.gates.filter((g) => g.conflict_ids.includes(c.id)).map((g) => g.id).sort();
    assert.deepEqual([...c.blocks_gates].sort(), holders, `${c.id} blocks_gates disagrees with the gate rows`);
  }
});

// ---- alias mapping --------------------------------------------------------------------------------------------

test('alias: GATES.csv and GATE-LOG names map to the framework gate', () => {
  const m = aliasMap(data());
  const want = {
    'G0-CONCEPT': 'SCREEN', 'G0-CODE': 'SCREEN', 'G0-ASSET': 'SCREEN', 'G0-DEMAND': 'SCREEN', 'G0-RIVAL': 'SCREEN', 'Gate 0': 'SCREEN',
    G1: 'MERIT', 'Gate 1': 'MERIT', 'Merit 1->2': 'MERIT', 'Merit 1→2': 'MERIT',
    G2: 'SLOT', 'Gate 2': 'SLOT', 'Design 4->5': 'SCHEMA', Design: 'SCHEMA', 'Base 2->3': 'BASE', 'Lock 3->4': 'LOCK', lock: 'LOCK',
    Recycle: 'RETIRE', Rescue: 'TROUBLE',
  };
  for (const [name, id] of Object.entries(want)) assert.equal(m.get(name.toLowerCase().replace(/→/g, '->')), id, name);
});

test('alias: a card keyed by an old name is read as the canonical gate', () => {
  const r = evalCard(clean({ 'Design 4→5': { verdict: 'PASS', stamped_by: 'claude' } }), '4->5', data());
  assert.equal(r.result, 'PASS');
});

test('transition: arrows and spacing are normalised', () => {
  assert.equal(normTransition('3 → 4'), '3->4');
  assert.equal(evalCard(clean({ Lock: lisa('GO') }), '3→4', data()).transition, '3->4');
});

// ---- each gate passes when its conflicts are resolved -----------------------------------------------------------

const PASS_CASES = [
  ['0->1', { Screen: { verdict: 'PASS', stamped_by: 'claude' } }],
  ['1->2', { Merit: lisa('GO') }],
  ['2->3', { Base: { verdict: 'GO', stamped_by: 'claude' } }],
  ['3->4', { Lock: lisa('GO') }],
  ['4->5', { Schema: { verdict: 'PASS', stamped_by: 'claude' } }],
  ['5->6', { Invest: lisa('GO'), Slot: { verdict: 'OPEN', stamped_by: 'claude' } }],
  ['6->7', { Launch: lisa('GO') }],
  ['7->8', { Leak: { verdict: 'PASS', stamped_by: 'claude' }, Live: { verdict: 'PASS', stamped_by: 'claude' } }],
  ['8->rescue', { Trouble: { verdict: 'DETECTED', stamped_by: 'claude' } }],
  ['rescue->slot', { Slot: { verdict: 'OPEN', stamped_by: 'claude' } }],
  ['8->lock', { Lock: lisa('GO') }],
  ['8->recycle', { Retire: lisa('STAMPED') }],
];
for (const [to, gates] of PASS_CASES) {
  test(`transition ${to}: passes with correct verdicts once conflicts are resolved`, () => {
    const r = evalCard(clean(gates), to, resolved());
    assert.equal(r.result, 'PASS', JSON.stringify(r.rows));
  });
}

// ---- conflicts: WAITS-LISA, never PASS --------------------------------------------------------------------------

const CONFLICT_CASES = [
  ['C2', '2->3', { Base: lisa('GO') }],
  ['C4', '7->8', { Leak: { verdict: 'PASS', stamped_by: 'claude' }, Live: { verdict: 'PASS', stamped_by: 'claude' } }],
  ['C6/C8', '5->6', { Invest: lisa('GO'), Slot: { verdict: 'OPEN', stamped_by: 'claude' } }],
  ['C6/C8', 'rescue->slot', { Slot: { verdict: 'OPEN', stamped_by: 'claude' } }],
];
for (const [cid, to, gates] of CONFLICT_CASES) {
  test(`conflict ${cid} at ${to}: reports WAITS-LISA, never PASS`, () => {
    const r = evalCard(clean(gates), to, data());
    assert.equal(r.result, 'WAITS-LISA');
    assert.ok(r.rows.some((x) => x.status === 'WAITS-LISA'));
  });
}

test('conflict C3: a RECYCLE verdict at MERIT waits; GO still passes', () => {
  assert.equal(evalCard(clean({ Merit: lisa('RECYCLE') }), '1->2', data()).result, 'WAITS-LISA');
  assert.equal(evalCard(clean({ 'Gate 1': lisa('GO') }), '1->2', data()).result, 'PASS');
});

test('conflict C7: the GL008-style literal verdict waits at LOCK', () => {
  const r = evalCard(clean({ Lock: lisa('REFINED TO TEN4 - GO WITH CONDITIONS', { conditions: ['x'] }) }), '3->4', data());
  assert.equal(r.result, 'WAITS-LISA');
});

test('conflict C9: RETURN cannot auto-pass even with a PASS verdict', () => {
  const d = data();
  const g = d.gates.find((x) => x.id === 'RETURN');
  assert.equal(evalGate(g, { verdict: 'PASS' }, d).status, 'WAITS-LISA');
});

test('resolving a conflict is data only: flipping C2 lets BASE pass', () => {
  const d = data();
  d.conflicts.find((c) => c.id === 'C2').status = 'RESOLVED';
  assert.equal(evalCard(clean({ Base: lisa('GO') }), '2->3', d).result, 'PASS');
});

test('a FAIL outranks a WAITS-LISA in the overall result', () => {
  const r = evalCard(clean({ Invest: lisa('KILL') }), '5->6', data());
  assert.equal(r.result, 'FAIL');
});

// ---- failure paths ----------------------------------------------------------------------------------------------

test('missing verdict fails', () => assert.equal(evalCard(clean({}), '3->4', data()).result, 'FAIL'));
test('empty verdict fails', () => assert.equal(evalCard(clean({ Lock: lisa('') }), '3->4', data()).result, 'FAIL'));
test('verdict outside the gate set fails (RESHAPE is not a Lock verdict)', () => assert.equal(evalCard(clean({ Lock: lisa('RESHAPE') }), '3->4', data()).result, 'FAIL'));
test('REFINE is a Lock verdict but does not let the card move', () => assert.equal(evalCard(clean({ Lock: lisa('REFINE') }), '3->4', data()).result, 'FAIL'));
test('KILL and HOLD never pass', () => {
  for (const v of ['KILL', 'HOLD']) assert.equal(evalCard(clean({ Lock: lisa(v) }), '3->4', data()).result, 'FAIL', v);
});
test('a Lisa-stamp gate stamped by Claude fails', () => assert.equal(evalCard(clean({ Lock: { verdict: 'GO', stamped_by: 'claude' } }), '3->4', data()).result, 'FAIL'));
test('a Lisa-stamp gate with no stamper fails', () => assert.equal(evalCard(clean({ Lock: { verdict: 'GO' } }), '3->4', data()).result, 'FAIL'));
test('BASE may be stamped by Claude (resolved), but not by a stranger', () => {
  assert.equal(evalCard(clean({ Base: { verdict: 'GO', stamped_by: 'claude' } }), '2->3', resolved()).result, 'PASS');
  assert.equal(evalCard(clean({ Base: { verdict: 'GO', stamped_by: 'someone' } }), '2->3', resolved()).result, 'FAIL');
});
test('GO WITH CONDITIONS needs conditions recorded', () => {
  assert.equal(evalCard(clean({ Lock: lisa('GO WITH CONDITIONS') }), '3->4', data()).result, 'FAIL');
  assert.equal(evalCard(clean({ Lock: lisa('GO WITH CONDITIONS', { conditions: ['named payer confirmed'] }) }), '3->4', data()).result, 'PASS');
});
test('SCREEN accepts FAIL:CODE verdicts as a fail', () => {
  const r = evalCard(clean({ Screen: { verdict: 'FAIL:FRAGILE,ONESHOT', stamped_by: 'claude' } }), '0->1', data());
  assert.equal(r.result, 'FAIL');
});
test('verdict matching ignores case', () => assert.equal(evalCard(clean({ Lock: lisa('go') }), '3->4', data()).result, 'PASS'));

test('CK45 outstanding fails; CK50 outstanding fails', () => {
  assert.equal(evalCard({ ...clean({ Lock: lisa('GO') }), ck45_pending: 1 }, '3->4', data()).result, 'FAIL');
  assert.equal(evalCard({ ...clean({ Lock: lisa('GO') }), ck50_open_obligations: 3 }, '3->4', data()).result, 'FAIL');
});
test('CK45/CK50 fields missing or not whole numbers fail', () => {
  const base = clean({ Lock: lisa('GO') });
  delete base.ck45_pending;
  assert.equal(evalCard(base, '3->4', data()).result, 'FAIL');
  assert.equal(evalCard({ ...clean({ Lock: lisa('GO') }), ck50_open_obligations: '0' }, '3->4', data()).result, 'FAIL');
  assert.equal(evalCard({ ...clean({ Lock: lisa('GO') }), ck50_open_obligations: -1 }, '3->4', data()).result, 'FAIL');
});

// ---- bad input --------------------------------------------------------------------------------------------------

test('unknown transition throws BAD_TRANSITION', () => assert.throws(() => evalCard(clean({}), '9->10', data()), { code: 'BAD_TRANSITION' }));
test('non-object card throws BAD_CARD', () => {
  for (const bad of [null, 'x', 5, []]) assert.throws(() => evalCard(bad, '3->4', data()), { code: 'BAD_CARD' });
});
test('unknown gate names on the card are ignored, not trusted', () => {
  assert.equal(evalCard(clean({ 'Totally Made Up': lisa('GO') }), '3->4', data()).result, 'FAIL');
});

// ---- control + CLI ----------------------------------------------------------------------------------------------

test('selftest: every built-in control behaves', () => {
  const res = selftest(data());
  assert.ok(res.length >= 6);
  assert.ok(res.every((r) => r.ok), JSON.stringify(res.filter((r) => !r.ok)));
});

test('main(): captured output for list and selftest, exit codes', () => {
  const out = [];
  const io = { out: (s) => out.push(s), err: (s) => out.push('ERR ' + s) };
  assert.equal(main(['--list'], io), 0);
  assert.ok(out.join('\n').includes('Open conflicts:'));
  out.length = 0;
  assert.equal(main(['--selftest'], io), 0);
  assert.ok(out.join('\n').includes('SELFTEST: all controls behaved'));
  out.length = 0;
  assert.equal(main(['--bogus'], io), 1);
  assert.ok(out.join('\n').includes('ERROR'));
});

function cli(args, card) {
  const dir = mkdtempSync(join(tmpdir(), 'gate-test-'));
  try {
    const a = [GATE, ...args];
    if (card) { const f = join(dir, 'card.json'); writeFileSync(f, typeof card === 'string' ? card : JSON.stringify(card)); a.push('--card', f); }
    const r = spawnSync(process.execPath, a, { encoding: 'utf8' });
    return { code: r.status, out: r.stdout, err: r.stderr };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('cli: PASS card exits 0 and prints RESULT: PASS', () => {
  const r = cli(['--to', '3->4'], clean({ Lock: lisa('GO') }));
  assert.equal(r.code, 0);
  assert.match(r.out, /RESULT: PASS/);
});
test('cli: FAIL card exits 1', () => {
  const r = cli(['--to', '3->4'], clean({}));
  assert.equal(r.code, 1);
  assert.match(r.out, /RESULT: FAIL/);
});
test('cli: conflicted gate exits 1 with RESULT: WAITS-LISA', () => {
  const r = cli(['--to', '2->3'], clean({ Base: lisa('GO') }));
  assert.equal(r.code, 1);
  assert.match(r.out, /RESULT: WAITS-LISA/);
});
test('cli: --dry-run forces exit 0 but still reports the real result', () => {
  const r = cli(['--to', '3->4', '--dry-run'], clean({}));
  assert.equal(r.code, 0);
  assert.match(r.out, /RESULT: FAIL/);
  assert.match(r.out, /DRY-RUN/);
});
test('cli: --json prints parseable JSON', () => {
  const r = cli(['--to', '3->4', '--json'], clean({ Lock: lisa('GO') }));
  assert.equal(JSON.parse(r.out).result, 'PASS');
});
test('cli: unreadable or invalid card JSON exits 1 with ERROR', () => {
  const r = cli(['--to', '3->4'], '{not json');
  assert.equal(r.code, 1);
  assert.match(r.err, /ERROR/);
});
test('cli: no arguments prints usage and exits 1', () => {
  const r = cli([]);
  assert.equal(r.code, 1);
  assert.match(r.out, /usage/);
});
test('cli: --list and --selftest exit 0', () => {
  assert.equal(cli(['--list']).code, 0);
  assert.equal(cli(['--selftest']).code, 0);
});
