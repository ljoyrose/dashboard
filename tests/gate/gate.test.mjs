// Tests for tools/gate/gate.mjs. Run: node --test tests/gate/gate.test.mjs
// Invented fixtures only. No real cards, apps, people or data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadData, evalCard, evalGate, aliasMap, normTransition, selftest, main, withOpenConflict } from '../../tools/gate/gate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const GATE = join(HERE, '..', '..', 'tools', 'gate', 'gate.mjs');
const data = () => loadData();
const clean = (gates) => ({ card_id: 'TEST-CARD-1', ck45_pending: 0, ck50_open_obligations: 0, gates });
const lisa = (verdict, extra = {}) => ({ verdict, stamped_by: 'lisa', ...extra });
// Every conflict was ruled on 16 Oct 2026, so the shipped data has none open. These cards pass every gate they need.
const resolved = () => data();
const ok = (verdict) => ({ verdict, stamped_by: 'claude' });
const LEAK_7_8 = { Leak_monitor: ok('CLEAR'), Leak_post: ok('PASS'), Live: ok('PASS') };
const GOOD_5_6 = { Invest: lisa('GO'), Slot: ok('OPEN'), Leak_design: ok('READY') };

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
    for (const f of ['id', 'framework_name', 'aliases', 'transition', 'guard_type', 'owner', g.phases ? 'phases' : 'verdict_set', 'source_citation', 'confidence', 'conflict_ids']) {
      assert.ok(f in g, `${g.id} lacks ${f}`);
    }
    assert.ok(['HIGH', 'MED', 'LOW'].includes(g.confidence), `${g.id} confidence`);
    if (g.required === false) { assert.match(g.guard_type, /^not a gate/, `${g.id} guard_type`); continue; }
    assert.ok(['Lisa stamp', 'test', 'Claude lens', 'auto'].includes(g.guard_type), `${g.id} guard_type`);
    const sets = g.phases ? g.phases : [g];
    for (const x of sets) {
      assert.ok(x.verdict_set.length > 0, `${g.id}/${x.id ?? ''} verdict_set`);
      assert.ok(x.pass_verdicts.every((v) => x.verdict_set.includes(v)), `${g.id} pass_verdicts are inside verdict_set`);
    }
  }
});

test('data: LEAK has three phases with the ruled card keys, verdicts and positions', () => {
  const leak = data().gates.find((g) => g.id === 'LEAK');
  assert.deepEqual(leak.phases.map((p) => [p.id, p.card_key, p.required_at]), [['DESIGN', 'Leak_design', '5->6'], ['MONITOR', 'Leak_monitor', '7->8'], ['POST', 'Leak_post', '7->8']]);
  assert.deepEqual(leak.phases.map((p) => [p.verdict_set, p.pass_verdicts]), [[['READY', 'MISSING'], ['READY']], [['CLEAR', 'LEAK-SEEN'], ['CLEAR']], [['PASS', 'FAIL'], ['PASS']]]);
});

test('data: transitions require the leak phases where ruled; 6->7 requires LAUNCH only; no bare LEAK', () => {
  const d = data();
  const req = (id) => d.transitions.find((t) => t.id === id).requires;
  assert.deepEqual(req('5->6'), ['INVEST', 'SLOT', 'LEAK:DESIGN']);
  assert.deepEqual(req('6->7'), ['LAUNCH']);
  assert.deepEqual(req('7->8'), ['LEAK:MONITOR', 'LEAK:POST', 'LIVE']);
  for (const t of d.transitions) assert.ok(!t.requires.includes('LEAK'), `${t.id} requires bare LEAK`);
});

test('data: C1-C10 are all RESOLVED with a ruling line; RETIRE keeps STAMPED marked UNCHECKED', () => {
  const d = data();
  assert.equal(d.conflicts.length, 10);
  for (const c of d.conflicts) { assert.equal(c.status, 'RESOLVED', c.id); assert.ok(c.ruling, `${c.id} ruling`); }
  const r = d.gates.find((g) => g.id === 'RETIRE');
  assert.deepEqual(r.verdict_set, ['STAMPED']);
  assert.match(r.source_citation, /UNCHECKED/);
});

test('data: guard split among the 12 is 5 Lisa stamps, 1 Claude lens, 5 tests/auto, and Return (not a gate yet)', () => {
  const twelve = data().gates.filter((g) => g.id !== 'BASE');
  assert.equal(twelve.filter((g) => g.guard_type === 'Lisa stamp').length, 5);
  assert.equal(twelve.filter((g) => g.guard_type === 'Claude lens').length, 1);
  assert.equal(twelve.filter((g) => g.guard_type === 'test' || g.guard_type === 'auto').length, 5);
  assert.deepEqual(twelve.filter((g) => g.required === false).map((g) => g.id), ['RETURN']);
});

test('data: every transition requires only gates that exist', () => {
  const d = data();
  const ids = new Set(d.gates.map((g) => g.id));
  for (const t of d.transitions) for (const r of t.requires) assert.ok(ids.has(r.split(':')[0]), `${t.id} requires unknown ${r}`);
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
  ['5->6', GOOD_5_6],
  ['6->7', { Launch: lisa('GO') }],
  ['7->8', LEAK_7_8],
  ['8->rescue', { Trouble: { verdict: 'DETECTED', stamped_by: 'claude' } }],
  ['rescue->slot', { Slot: { verdict: 'OPEN', stamped_by: 'claude' } }],
  ['8->lock', { Lock: lisa('GO') }],
  ['8->recycle', { Retire: lisa('STAMPED') }],
];
for (const [to, gates] of PASS_CASES) {
  test(`transition ${to}: passes with the correct verdicts`, () => {
    const r = evalCard(clean(gates), to, resolved());
    assert.equal(r.result, 'PASS', JSON.stringify(r.rows));
  });
}

// ---- rulings of 16 Oct 2026 (DE62) ------------------------------------------------------------------------------

test('leak DESIGN: 5->6 FAILs with Leak_design MISSING, passes with READY, FAILs when absent', () => {
  assert.equal(evalCard(clean({ ...GOOD_5_6, Leak_design: ok('MISSING') }), '5->6', data()).result, 'FAIL');
  assert.equal(evalCard(clean(GOOD_5_6), '5->6', data()).result, 'PASS');
  const { Leak_design, ...without } = GOOD_5_6;
  assert.equal(evalCard(clean(without), '5->6', data()).result, 'FAIL');
});
test('leak MONITOR: 7->8 FAILs with Leak_monitor LEAK-SEEN', () => {
  const r = evalCard(clean({ ...LEAK_7_8, Leak_monitor: ok('LEAK-SEEN') }), '7->8', data());
  assert.equal(r.result, 'FAIL');
  assert.equal(r.rows.find((x) => x.gate === 'LEAK:MONITOR').status, 'FAIL');
});
test('leak POST: 7->8 FAILs with Leak_post FAIL', () => {
  const r = evalCard(clean({ ...LEAK_7_8, Leak_post: ok('FAIL') }), '7->8', data());
  assert.equal(r.result, 'FAIL');
  assert.equal(r.rows.find((x) => x.gate === 'LEAK:POST').status, 'FAIL');
});
test('leak: 7->8 needs both MONITOR and POST (either one missing FAILs)', () => {
  assert.equal(evalCard(clean({ Leak_post: ok('PASS'), Live: ok('PASS') }), '7->8', data()).result, 'FAIL');
  assert.equal(evalCard(clean({ Leak_monitor: ok('CLEAR'), Live: ok('PASS') }), '7->8', data()).result, 'FAIL');
});
test('leak: a phase verdict from another phase FAILs (POST PASS is not a MONITOR verdict)', () => {
  assert.equal(evalCard(clean({ ...LEAK_7_8, Leak_monitor: ok('PASS') }), '7->8', data()).result, 'FAIL');
});
test('leak: the old single "Leak" entry no longer satisfies 7->8', () => {
  assert.equal(evalCard(clean({ Leak: ok('PASS'), Live: ok('PASS') }), '7->8', data()).result, 'FAIL');
});
test('leak: spaced names fold onto the phase card keys', () => {
  const five = evalCard(clean({ Invest: lisa('GO'), Slot: ok('OPEN'), 'Leak design': ok('READY') }), '5->6', data());
  assert.equal(five.result, 'PASS');
  assert.equal(five.rows.find((x) => x.gate === 'LEAK:DESIGN').status, 'PASS');
  assert.equal(evalCard(clean({ Invest: lisa('GO'), Slot: ok('OPEN'), 'Leak design': ok('MISSING') }), '5->6', data()).result, 'FAIL');
  const seven = evalCard(clean({ 'Leak monitor': ok('CLEAR'), 'Leak post': ok('PASS'), Live: ok('PASS') }), '7->8', data());
  assert.equal(seven.result, 'PASS');
  assert.equal(seven.rows.find((x) => x.gate === 'LEAK:MONITOR').status, 'PASS');
  assert.equal(seven.rows.find((x) => x.gate === 'LEAK:POST').status, 'PASS');
});
test('leak: 6->7 requires LAUNCH only (no leak phase)', () => {
  const r = evalCard(clean({ Launch: lisa('GO') }), '6->7', data());
  assert.equal(r.result, 'PASS');
  assert.deepEqual(r.rows.map((x) => x.gate), ['LAUNCH']);
});

test('Slot: FULL FAILs at 5->6 and at rescue->slot; OPEN passes', () => {
  assert.equal(evalCard(clean({ ...GOOD_5_6, Slot: ok('FULL') }), '5->6', data()).result, 'FAIL');
  assert.equal(evalCard(clean({ Slot: ok('FULL') }), 'rescue->slot', data()).result, 'FAIL');
  assert.equal(evalCard(clean({ Slot: ok('OPEN') }), 'rescue->slot', data()).result, 'PASS');
});
test('Base (ruled C2): passes at 2->3 for Lisa or Claude, no longer waits', () => {
  assert.equal(evalCard(clean({ Base: lisa('GO') }), '2->3', data()).result, 'PASS');
  assert.equal(evalCard(clean({ Base: ok('GO') }), '2->3', data()).result, 'PASS');
});
test('verdict words (ruled C3): RECYCLE at Merit FAILs, not WAITS-LISA; GO still passes', () => {
  const r = evalCard(clean({ Merit: lisa('RECYCLE') }), '1->2', data());
  assert.equal(r.result, 'FAIL');
  assert.match(r.rows[0].reasons.join(), /not allowed at MERIT/);
  assert.equal(evalCard(clean({ 'Gate 1': lisa('GO') }), '1->2', data()).result, 'PASS');
});
test('verdict words: REFINE at Merit FAILs as outside the set', () => {
  const r = evalCard(clean({ Merit: lisa('REFINE') }), '1->2', data());
  assert.equal(r.result, 'FAIL');
  assert.match(r.rows[0].reasons.join(), /not in this gate's set/);
});
test('verdict words: RESHAPE at Lock FAILs as outside the set; RESHAPE at Merit is a valid verdict that does not pass', () => {
  const r = evalCard(clean({ Lock: lisa('RESHAPE') }), '3->4', data());
  assert.equal(r.result, 'FAIL');
  assert.match(r.rows[0].reasons.join(), /not in this gate's set/);
  const m = evalCard(clean({ Merit: lisa('RESHAPE') }), '1->2', data());
  assert.equal(m.result, 'FAIL');
  assert.doesNotMatch(m.rows[0].reasons.join(), /not in this gate's set/);
});
test('verdict words: REFINE at Lock is accepted as a valid verdict but does not pass (same as HOLD)', () => {
  const refine = evalCard(clean({ Lock: lisa('REFINE') }), '3->4', data());
  const hold = evalCard(clean({ Lock: lisa('HOLD') }), '3->4', data());
  assert.equal(refine.result, 'FAIL');
  assert.doesNotMatch(refine.rows[0].reasons.join(), /not in this gate's set/);
  assert.match(refine.rows[0].reasons.join(), /does not let the card move/);
  assert.deepEqual(refine.rows[0].reasons.map((x) => x.replace('REFINE', 'X')), hold.rows[0].reasons.map((x) => x.replace('HOLD', 'X')));
});
test('verdict words (ruled C7): the old GL008 literal verdict now FAILs at Lock; REFINE carries the TEN4 note in the data', () => {
  const r = evalCard(clean({ Lock: lisa('REFINED TO TEN4 - GO WITH CONDITIONS', { conditions: ['x'] }) }), '3->4', data());
  assert.equal(r.result, 'FAIL');
  assert.match(data().gates.find((g) => g.id === 'LOCK').notes, /REFINE with note TEN4/);
});
test('Return (ruled C9): never required at any transition, and a card without it still passes', () => {
  const d = data();
  for (const t of d.transitions) {
    const r = evalCard(clean({}), t.id, d);
    assert.ok(!r.rows.some((x) => x.gate === 'RETURN'), `${t.id} evaluates RETURN`);
  }
  // even a transition that (wrongly) listed RETURN would skip it
  const d2 = structuredClone(d);
  d2.transitions.find((t) => t.id === '3->4').requires.push('RETURN');
  assert.equal(evalCard(clean({ Lock: lisa('GO') }), '3->4', d2).result, 'PASS');
});
test('Retire keeps the STAMPED verdict', () => {
  assert.equal(evalCard(clean({ Retire: lisa('STAMPED') }), '8->recycle', data()).result, 'PASS');
  assert.equal(evalCard(clean({ Retire: lisa('GO') }), '8->recycle', data()).result, 'FAIL');
});

// ---- WAITS-LISA path, kept for any conflict still OPEN (synthetic conflict) ---------------------------------------------

test('open conflict: a synthetic OPEN conflict on BASE reports WAITS-LISA, never PASS', () => {
  const r = evalCard(clean({ Base: lisa('GO') }), '2->3', withOpenConflict(data()));
  assert.equal(r.result, 'WAITS-LISA');
  assert.ok(r.rows.some((x) => x.status === 'WAITS-LISA'));
});
test('open conflict: resolving it is data only and lets BASE pass', () => {
  const d = withOpenConflict(data());
  d.conflicts.find((c) => c.id === 'CX').status = 'RESOLVED';
  assert.equal(evalCard(clean({ Base: lisa('GO') }), '2->3', d).result, 'PASS');
});
test('open conflict: a waits_verdicts entry waits only while its conflict is open', () => {
  const d = withOpenConflict(data());
  d.gates.find((g) => g.id === 'LOCK').waits_verdicts = { 'REFINED TO TEN4': ['CX'] };
  assert.equal(evalCard(clean({ Lock: lisa('REFINED TO TEN4') }), '3->4', d).result, 'WAITS-LISA');
  d.conflicts.find((c) => c.id === 'CX').status = 'RESOLVED';
  assert.equal(evalCard(clean({ Lock: lisa('REFINED TO TEN4') }), '3->4', d).result, 'FAIL');
});

test('a FAIL outranks a WAITS-LISA in the overall result', () => {
  const d = withOpenConflict(data());
  d.gates.find((g) => g.id === 'SLOT').conflict_ids = ['CX'];
  const r = evalCard(clean({ Invest: lisa('KILL'), Slot: ok('OPEN'), Leak_design: ok('READY') }), '5->6', d);
  assert.equal(r.rows.find((x) => x.gate === 'SLOT').status, 'WAITS-LISA');
  assert.equal(r.result, 'FAIL');
});

// ---- failure paths ----------------------------------------------------------------------------------------------

test('missing verdict fails', () => assert.equal(evalCard(clean({}), '3->4', data()).result, 'FAIL'));
test('empty verdict fails', () => assert.equal(evalCard(clean({ Lock: lisa('') }), '3->4', data()).result, 'FAIL'));
test('KILL and HOLD never pass', () => {
  for (const v of ['KILL', 'HOLD']) assert.equal(evalCard(clean({ Lock: lisa(v) }), '3->4', data()).result, 'FAIL', v);
});
test('a Lisa-stamp gate stamped by Claude fails', () => assert.equal(evalCard(clean({ Lock: { verdict: 'GO', stamped_by: 'claude' } }), '3->4', data()).result, 'FAIL'));
test('a Lisa-stamp gate with no stamper fails', () => assert.equal(evalCard(clean({ Lock: { verdict: 'GO' } }), '3->4', data()).result, 'FAIL'));
test('BASE may be stamped by Claude, but not by a stranger', () => {
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
test('cli: a gate with a synthetic OPEN conflict exits 1 with RESULT: WAITS-LISA', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gate-data-'));
  try {
    const f = join(dir, 'data.json');
    writeFileSync(f, JSON.stringify(withOpenConflict(data())));
    const r = cli(['--to', '2->3', '--data', f], clean({ Base: lisa('GO') }));
    assert.equal(r.code, 1);
    assert.match(r.out, /RESULT: WAITS-LISA/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('cli: the real data has no open conflict, so Base GO exits 0', () => {
  const r = cli(['--to', '2->3'], clean({ Base: lisa('GO') }));
  assert.equal(r.code, 0);
});
test('cli: 7->8 with Leak_post FAIL exits 1 and names LEAK:POST', () => {
  const r = cli(['--to', '7->8'], clean({ ...LEAK_7_8, Leak_post: ok('FAIL') }));
  assert.equal(r.code, 1);
  assert.match(r.out, /FAIL\s+LEAK:POST/);
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
