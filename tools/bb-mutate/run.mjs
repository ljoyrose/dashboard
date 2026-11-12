#!/usr/bin/env node
// Breed Better mutation check (JOB BB-FIN.1). SCRIPT. Copies breed-better/ and tests/breed-better/ to a temp
// folder, flips one key condition in score.js at a time, and runs the node tests there. Each mutant must turn a
// test red ("killed"). Nothing in the repo is changed. Run: node tools/bb-mutate/run.mjs   (exit 1 if a mutant lives)
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MUTANTS = [
  ['any fail = Fail becomes "two fails"', "var gateResult = gates.fail ?", "var gateResult = gates.fail > 1 ?"],
  ['to_date stops being inclusive', "return (!f || f <= d) && (!t || t >= d);", "return (!f || f <= d) && (!t || t > d);"],
  ['a record is out of date on its last valid day', "if (dueDate < asOf) {", "if (dueDate <= asOf) {"],
  ['unknown points that could reach the target are ignored', "verdict = earned + unverified >= target ? 'unverified' : 'below_target';", "verdict = 'below_target';"],
  ['overlapping dated versions are no longer refused', "if (overlaps(o, c)) errors.push", "if (false && overlaps(o, c)) errors.push"],
  ['an unmatched gate answer follows when_missing fail', "else if (when === 'fail' && ev.reason) outcome = 'fail';", "else if (when === 'fail') outcome = 'fail';"],
  ['records dated after the scoring date are read', "(!dateField || !isDate(r[dateField]) || r[dateField] <= asOf);", "true;"],
  ['lapsed_affects_verdict FALSE is read the wrong way round', "if (!/^false$/i.test(text(g.lapsed_affects_verdict)))", "if (/^false$/i.test(text(g.lapsed_affects_verdict)))"],
  ['an unmatched points answer is scored 0 under when_missing zero', "} else if (ev.reason && (when === 'zero' || when === 'fail')) {", "} else if (when === 'zero' || when === 'fail') {"],
  ['a must-pass check may be skipped again', "if (when === 'skip' && band.kind === 'gate') errors.push", "if (false) errors.push"],
  ['a record is graded by today\'s rules, not the rules then', "var g = recDate ? (versionOn(versions[k], recDate) || c) : c;", "var g = c;"]
];

const src = readFileSync(join(ROOT, 'breed-better/score.js'), 'utf8');
let lived = 0;
const rows = [];
for (const [name, from, to] of MUTANTS) {
  const n = src.split(from).length - 1;
  if (n !== 1) { rows.push(['NOT FOUND', name]); lived++; continue; }
  const tmp = mkdtempSync(join(tmpdir(), 'bb-mut-'));
  mkdirSync(join(tmp, 'tests'), { recursive: true });
  cpSync(join(ROOT, 'breed-better'), join(tmp, 'breed-better'), { recursive: true });
  cpSync(join(ROOT, 'tests/breed-better'), join(tmp, 'tests/breed-better'), { recursive: true });
  writeFileSync(join(tmp, 'breed-better/score.js'), src.replace(from, to));
  const files = ['hub-view.test.js', 'inspect.test.js', 'score.test.js', 'score.property.test.js', 'contract.test.js']
    .map((f) => join(tmp, 'tests/breed-better', f)).filter((f) => { try { readFileSync(f); return true; } catch { return false; } });
  const r = spawnSync(process.execPath, ['--test', ...files], { encoding: 'utf8' });
  const fails = (/# fail (\d+)/.exec(r.stdout) || [])[1] || '?';
  const killed = r.status !== 0;
  if (!killed) lived++;
  rows.push([killed ? 'KILLED' : 'LIVED', name, fails + ' test(s) red']);
  rmSync(tmp, { recursive: true, force: true });
}
for (const r of rows) console.log(r.join('  |  '));
console.log(lived ? lived + ' mutant(s) not caught' : 'all ' + MUTANTS.length + ' mutants caught');
process.exit(lived ? 1 : 0);
