#!/usr/bin/env node
// Fast syntax check (about a minute in CI). Plain Node, no packages, no network, read-only.
// Catches a broken "keep both sides" merge (doubled lines, an unclosed function) in seconds instead of
// after 30 minutes of red browser shards (27 Nov 2026: #835, #817, #819).
//   1. every tracked .js / .mjs / .cjs file: node --check
//   2. every tracked .gs file (Apps Script): parsed as a classic script (vm.Script)
//   3. every inline <script> in a tracked .html file: parsed as a script, or as a module for type="module"
// Line numbers are the file's own (inline scripts are padded so the line matches the .html line).
// Spec files are loaded (not run) by `npx playwright test --list` in the workflow, a separate step.
//   node tools/syntax-check/check.mjs            check the repo
//   node tools/syntax-check/check.mjs --selftest prove each check can still fail
import { execFileSync, execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'syntax-check-'));

/** Inline scripts of an HTML text: [{ code, line (1-based line of the first code line), module }]. */
export function inlineScripts(html) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const type = (/\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs) || [])[1] || '';
    const module = /^module$/i.test(type);
    if (type && !module && !/^(text|application)\/(javascript|ecmascript)$/i.test(type)) continue; // JSON, templates
    const start = m.index + m[0].indexOf('>') + 1;
    out.push({ code: m[2], line: html.slice(0, start).split('\n').length, module });
  }
  return out;
}

/** Parse as a classic script; returns null or "line: message". */
export function scriptError(code, lineOffset = 0, filename = 'inline') {
  try {
    new vm.Script(code, { filename, lineOffset });
    return null;
  } catch (e) {
    const at = /:(\d+)\s*$/m.exec(String(e.stack).split('\n')[0]) || [];
    return `${at[1] || '?'}: ${e.message}`;
  }
}

/** node --check on a file; returns null or "line: message". */
async function nodeCheck(file, shownAs) {
  try {
    await run(process.execPath, ['--check', file]);
    return null;
  } catch (e) {
    const err = String(e.stderr || e.message);
    const line = (new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':(\\d+)').exec(err) || [])[1] || '?';
    const msg = (err.split('\n').find((l) => /Error:/.test(l)) || err.split('\n')[0]).trim();
    return `${line}: ${msg}`.replace(file, shownAs);
  }
}

async function checkModule(code, firstLine, shownAs) {
  const f = path.join(TMP, `m${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, '\n'.repeat(firstLine - 1) + code);
  return nodeCheck(f, shownAs);
}

async function pool(items, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

export async function checkFiles(files, read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8')) {
  const problems = [];
  const jobs = [];
  for (const f of files) {
    if (/\.(m|c)?js$/.test(f)) jobs.push(async () => { const e = await nodeCheck(path.join(ROOT, f), f); if (e) problems.push(`${f}:${e}`); });
    else if (/\.gs$/.test(f)) { const e = scriptError(read(f), 0, f); if (e) problems.push(`${f}:${e}`); }
    else if (/\.html?$/.test(f)) {
      for (const s of inlineScripts(read(f))) {
        if (s.module) jobs.push(async () => { const e = await checkModule(s.code, s.line, f); if (e) problems.push(`${f}:${e.replace(/^\?/, String(s.line))}`); });
        else { const e = scriptError(s.code, s.line - 1, f); if (e) problems.push(`${f}:${e}`); }
      }
    }
  }
  await pool(jobs, Math.max(2, os.cpus().length), (j) => j());
  return problems.sort();
}

async function selftest() {
  // Each check must still fail on a known break, or the check itself is broken.
  const cases = [
    ['a.gs', 'function f() {\n  return 1;\n', /^a\.gs:\d+: /],
    ['b.html', '<p>x</p>\n<script>\nfunction g() {\n  if (1) {\n}\n</script>', /^b\.html:\d+: /],
    ['c.html', '<script type="module">\nimport x from "./x.js";\nexport const y = ;\n</script>', /^c\.html:3: /],
    ['d.html', '<script type="application/json">{ not js }</script>', null],
    ['e.html', '<script src="x.js"></script>', null],
  ];
  const bad = [];
  for (const [name, text, want] of cases) {
    const got = await checkFiles([name], () => text);
    if (want ? !(got.length === 1 && want.test(got[0])) : got.length) bad.push(`${name}: expected ${want || 'no problem'}, got ${JSON.stringify(got)}`);
  }
  const js = path.join(TMP, 'broken.js');
  fs.writeFileSync(js, 'test("a", () => {\n  expect(1);\ntest("a", () => {\n');
  if (!(await nodeCheck(js, 'broken.js'))) bad.push('node --check did not catch an unclosed function');
  if (bad.length) { console.error('Self-test FAILED:\n' + bad.join('\n')); process.exit(1); }
  console.log(`Self-test OK (${cases.length + 1} cases).`);
}

const main = async () => {
  if (process.argv.includes('--selftest')) return selftest();
  const files = execFileSync('git', ['ls-files', '*.js', '*.mjs', '*.cjs', '*.gs', '*.html', '*.htm'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  const t = Date.now();
  const problems = await checkFiles(files);
  const summary = `Syntax check: ${files.length} files, ${problems.length} problem(s), ${((Date.now() - t) / 1000).toFixed(1)} s`;
  if (problems.length) {
    console.error(problems.map((p) => '::error::' + p).join('\n'));
    console.error(summary);
    process.exit(1);
  }
  console.log(summary);
};

main().finally(() => fs.rmSync(TMP, { recursive: true, force: true }));
