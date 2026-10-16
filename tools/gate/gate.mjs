#!/usr/bin/env node
// gate.mjs - App Factory gate checker (E16 rebuild). Node >= 18, no dependencies.
//
//   node tools/gate/gate.mjs --card <card.json> --to <transition>   PASS / FAIL / WAITS-LISA per required gate
//   node tools/gate/gate.mjs --list                                 print the unified gate list and open conflicts
//   node tools/gate/gate.mjs --selftest                             run the built-in control cases
//   node tools/gate/gate.mjs --dry-run ...                          same output, but always exits 0
//   optional: --data <gates.json>  --json
//
// Exit code: 0 only when every required gate is PASS. Anything else (FAIL, WAITS-LISA, bad input) exits 1.
// A gate with an OPEN conflict reports WAITS-LISA and is never auto-passed. Only data (a conflict's status) changes that.
// A transition may require a whole gate ("LOCK") or one phase of a phased gate ("LEAK:DESIGN"). A gate with "required": false
// is not a gate yet and is never evaluated. A verdict outside a gate's set, or in its invalid_verdicts, is FAIL.
// The card is a JSON file with invented or real card data. Nothing here reads or writes any register.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_DATA = join(HERE, 'gates.unified.json');

// Underscores and spaces fold together, so "Leak design" and "Leak_design" are one name.
const norm = (s) => String(s).toLowerCase().replace(/→/g, '->').replace(/[_\s]+/g, ' ').trim();

export function loadData(path = DEFAULT_DATA) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// Every name a card might use for a gate (framework name, id, GATES.csv / GATE-LOG alias) -> canonical id.
export function aliasMap(data) {
  const map = new Map();
  for (const g of data.gates) {
    for (const n of [g.id, g.framework_name, ...(g.aliases || [])]) map.set(norm(n), g.id);
  }
  return map;
}

export function normTransition(t) {
  return norm(t).replace(/\s*->\s*/g, '->');
}

// Card keys of phased gates (e.g. Leak_design) -> "GATE:PHASE" requirement id.
function phaseKeyMap(data) {
  const map = new Map();
  for (const g of data.gates) for (const p of g.phases || []) map.set(norm(p.card_key), `${g.id}:${p.id}`);
  return map;
}

// Resolve one entry of a transition's requires list into an evaluable gate, or null when it is not required.
function resolveRequirement(req, data) {
  const [gid, phaseId] = req.split(':');
  const gate = data.gates.find((g) => g.id === gid);
  if (!gate) return null;
  if (gate.required === false) return null;
  if (!phaseId) return gate.phases ? { ...gate, id: req, verdict_set: [], pass_verdicts: [], phased_error: true } : gate;
  const phase = (gate.phases || []).find((p) => p.id === phaseId);
  if (!phase) return { ...gate, id: req, verdict_set: [], pass_verdicts: [], phased_error: true };
  return { ...gate, id: req, verdict_set: phase.verdict_set, pass_verdicts: phase.pass_verdicts, phases: undefined };
}

function openConflictsFor(gate, data) {
  const open = new Set(data.conflicts.filter((c) => c.status === 'OPEN').map((c) => c.id));
  return (gate.conflict_ids || []).filter((id) => open.has(id));
}

function isOpen(id, data) {
  const c = data.conflicts.find((x) => x.id === id);
  return !!c && c.status === 'OPEN';
}

// Evaluate one gate for one card. Returns { gate, status: PASS|FAIL|WAITS-LISA, reasons: [] }.
export function evalGate(gate, entry, data) {
  const out = (status, ...reasons) => ({ gate: gate.id, status, reasons });
  if (gate.phased_error) return out('FAIL', 'requirement names a phased gate without a valid phase');
  const open = openConflictsFor(gate, data);
  if (open.length) return out('WAITS-LISA', `open conflict ${open.join(', ')} - Lisa must rule before this gate can pass`);
  if (!entry || typeof entry !== 'object') return out('FAIL', 'no verdict recorded on the card for this gate');
  const verdict = typeof entry.verdict === 'string' ? entry.verdict.trim() : '';
  if (!verdict) return out('FAIL', 'verdict missing');
  if ((gate.invalid_verdicts || []).some((v) => norm(v) === norm(verdict.split(':')[0]))) {
    return out('FAIL', `verdict "${verdict}" is not allowed at ${gate.id}`);
  }
  const waits = gate.waits_verdicts && Object.keys(gate.waits_verdicts).find((k) => norm(k) === norm(verdict));
  if (waits && gate.waits_verdicts[waits].some((id) => isOpen(id, data))) {
    return out('WAITS-LISA', `verdict "${verdict}" is outside the agreed set (conflict ${gate.waits_verdicts[waits].join(', ')})`);
  }
  // SCREEN-style verdicts may carry codes: "FAIL:CODE1,CODE2"
  const base = verdict.split(':')[0].trim();
  const match = gate.verdict_set.find((v) => norm(v) === norm(base));
  if (!match) return out('FAIL', `verdict "${verdict}" is not in this gate's set (${gate.verdict_set.join(' / ')})`);
  if (!gate.pass_verdicts.some((v) => norm(v) === norm(match))) return out('FAIL', `verdict ${match} does not let the card move`);
  if (norm(match) === 'go with conditions') {
    const c = entry.conditions;
    if (!(Array.isArray(c) ? c.length : typeof c === 'string' && c.trim())) {
      return out('FAIL', 'GO WITH CONDITIONS needs a dated entry in the Conditions Register (conditions missing)');
    }
  }
  if (gate.guard_type === 'Lisa stamp') {
    const by = norm(entry.stamped_by || '');
    const allowed = ['lisa', gate.stamp_exception].filter(Boolean);
    if (!allowed.includes(by)) return out('FAIL', `a ${gate.id} stamp must be given by ${allowed.join(' or ')}, not "${entry.stamped_by ?? 'nobody'}"`);
  }
  return out('PASS', `verdict ${match}`);
}

// Evaluate a card against one transition. Returns { transition, result, rows, universal }.
export function evalCard(card, toRaw, data) {
  const t = data.transitions.find((x) => normTransition(x.id) === normTransition(toRaw));
  if (!t) {
    const err = new Error(`unknown transition "${toRaw}" (known: ${data.transitions.map((x) => x.id).join(', ')})`);
    err.code = 'BAD_TRANSITION';
    throw err;
  }
  if (!card || typeof card !== 'object' || Array.isArray(card)) {
    const err = new Error('card must be a JSON object');
    err.code = 'BAD_CARD';
    throw err;
  }
  const aliases = aliasMap(data);
  const phaseKeys = phaseKeyMap(data);
  const entries = new Map();
  for (const [name, entry] of Object.entries(card.gates || {})) {
    const id = phaseKeys.get(norm(name)) || aliases.get(norm(name));
    if (id) entries.set(id, entry); // later alias for the same gate overwrites; last one wins
  }
  const rows = t.requires
    .map((req) => ({ req, gate: resolveRequirement(req, data) }))
    .filter((x) => x.gate)
    .map((x) => evalGate(x.gate, entries.get(x.req), data));
  const universal = data.universal_checks.map((u) => {
    const v = card[u.card_field];
    if (!Number.isInteger(v) || v < 0) return { gate: u.id, status: 'FAIL', reasons: [`card field ${u.card_field} missing or not a whole number`] };
    if (v > 0) return { gate: u.id, status: 'FAIL', reasons: [`${v} outstanding (${u.rule})`] };
    return { gate: u.id, status: 'PASS', reasons: ['0 outstanding'] };
  });
  const all = [...rows, ...universal];
  const result = all.some((r) => r.status === 'FAIL') ? 'FAIL' : all.some((r) => r.status === 'WAITS-LISA') ? 'WAITS-LISA' : 'PASS';
  return { transition: t.id, label: t.label, result, rows, universal };
}

export function formatReport(rep) {
  const lines = [`TRANSITION ${rep.transition}  ${rep.label}`];
  for (const r of [...rep.rows, ...rep.universal]) lines.push(`  ${r.status.padEnd(10)} ${r.gate.padEnd(8)} ${r.reasons.join('; ')}`);
  lines.push(`RESULT: ${rep.result}`);
  return lines.join('\n');
}

export function formatList(data) {
  const lines = [`${data.gates.length} gates, ${data.transitions.length} transitions, ${data.conflicts.length} conflicts`, ''];
  for (const g of data.gates) {
    const open = openConflictsFor(g, data);
    lines.push(`${g.id.padEnd(8)} ${g.guard_type.padEnd(11)} ${String(g.transition).slice(0, 28).padEnd(28)} ${g.confidence.padEnd(4)} ${open.length ? 'WAITS-LISA ' + open.join(',') : ''}`.trimEnd());
  }
  lines.push('', 'Open conflicts:');
  for (const c of data.conflicts.filter((x) => x.status === 'OPEN')) lines.push(`  ${c.id}  ${c.title}`);
  return lines.join('\n');
}

// A copy of the data with one synthetic OPEN conflict (CX) holding BASE. Used to keep the WAITS-LISA path tested.
export function withOpenConflict(data) {
  const d = structuredClone(data);
  d.conflicts.push({ id: 'CX', status: 'OPEN', title: 'synthetic open conflict (test only)', blocks_gates: ['BASE'] });
  d.gates.find((g) => g.id === 'BASE').conflict_ids = ['CX'];
  return d;
}

// Control cases (rule: every check runs its own control). Returns [{name, ok, detail}].
export function selftest(data) {
  const good = {
    ck45_pending: 0,
    ck50_open_obligations: 0,
    gates: { Lock: { verdict: 'GO', stamped_by: 'lisa' } },
  };
  const cases = [
    ['clean card passes LOCK', () => evalCard(good, '3->4', data).result === 'PASS'],
    ['dirty card (no verdict) FAILS', () => evalCard({ ...good, gates: {} }, '3->4', data).result === 'FAIL'],
    ['wrong stamper FAILS', () => evalCard({ ...good, gates: { Lock: { verdict: 'GO', stamped_by: 'claude' } } }, '3->4', data).result === 'FAIL'],
    ['outstanding CK45 FAILS', () => evalCard({ ...good, ck45_pending: 2 }, '3->4', data).result === 'FAIL'],
    ['open conflict WAITS, never passes (synthetic conflict on BASE)', () => evalCard({ ...good, gates: { 'Base 2->3': { verdict: 'GO', stamped_by: 'lisa' } } }, '2->3', withOpenConflict(data)).result === 'WAITS-LISA'],
    ['leak POST FAIL stops 7->8', () => evalCard({ ...good, gates: { Leak_monitor: { verdict: 'CLEAR' }, Leak_post: { verdict: 'FAIL' }, Live: { verdict: 'PASS' } } }, '7->8', data).result === 'FAIL'],
    ['all three leak phases + Live let 7->8 pass', () => evalCard({ ...good, gates: { Leak_monitor: { verdict: 'CLEAR' }, Leak_post: { verdict: 'PASS' }, Live: { verdict: 'PASS' } } }, '7->8', data).result === 'PASS'],
    ['unknown transition is rejected', () => { try { evalCard(good, '9->10', data); return false; } catch (e) { return e.code === 'BAD_TRANSITION'; } }],
  ];
  return cases.map(([name, fn]) => {
    let ok = false;
    let detail = '';
    try { ok = fn(); } catch (e) { detail = e.message; }
    return { name, ok, detail };
  });
}

function parseArgs(argv) {
  const a = { flags: new Set(), card: null, to: null, data: null };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--card') a.card = argv[++i];
    else if (x === '--to') a.to = argv[++i];
    else if (x === '--data') a.data = argv[++i];
    else if (['--list', '--selftest', '--dry-run', '--json', '--help'].includes(x)) a.flags.add(x);
    else throw new Error(`unknown argument "${x}"`);
  }
  return a;
}

const USAGE = 'usage: gate.mjs --card <file.json> --to <transition> | --list | --selftest   [--dry-run] [--json] [--data <gates.json>]';

export function main(argv, io = { out: (s) => process.stdout.write(s + '\n'), err: (s) => process.stderr.write(s + '\n') }) {
  let exit = 1;
  try {
    const a = parseArgs(argv);
    if (a.flags.has('--help') || (!a.flags.has('--list') && !a.flags.has('--selftest') && !(a.card && a.to))) {
      io.out(USAGE);
      return a.flags.has('--help') ? 0 : 1;
    }
    const data = loadData(a.data || DEFAULT_DATA);
    if (a.flags.has('--list')) {
      io.out(formatList(data));
      exit = 0;
    } else if (a.flags.has('--selftest')) {
      const res = selftest(data);
      for (const r of res) io.out(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.detail ? ' (' + r.detail + ')' : ''}`);
      exit = res.every((r) => r.ok) ? 0 : 1;
      io.out(exit === 0 ? 'SELFTEST: all controls behaved' : 'SELFTEST: a control failed - every verdict from this tool is untrustworthy');
    } else {
      let card;
      try { card = JSON.parse(readFileSync(a.card, 'utf8')); } catch (e) { throw new Error(`cannot read card ${a.card}: ${e.message}`); }
      const rep = evalCard(card, a.to, data);
      io.out(a.flags.has('--json') ? JSON.stringify(rep, null, 2) : formatReport(rep));
      exit = rep.result === 'PASS' ? 0 : 1;
    }
  } catch (e) {
    io.err(`ERROR: ${e.message}`);
    exit = 1;
  }
  if (argv.includes('--dry-run')) {
    io.out('DRY-RUN: exit forced to 0 (real exit would have been ' + exit + ')');
    return 0;
  }
  return exit;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2));
}
