#!/usr/bin/env node
// lint.mjs - house lint for the static dashboard (JOB 38 stage 3). Node 22, ESM, no packages: node: built-ins only.
//
//   node tools/lint/lint.mjs                 lint tracked files; exit 1 only when a rule|file count goes above known.json
//   node tools/lint/lint.mjs --all           also print every finding (known ones too)
//   node tools/lint/lint.mjs --update-known  rewrite known.json from today's findings
//   node tools/lint/lint.mjs --selftest      planted-fault control cases; exit 1 if any rule fails to fire (or fires on clean input)
//
// Every rule is a pure function (text, file, ctx) -> [{rule, file, line, msg}], so the selftest feeds it in-memory strings.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const KNOWN = join(HERE, 'known.json');

// ---------- helpers ----------
const ext = (f) => (f.match(/\.([a-z0-9]+)$/i) || [, ''])[1].toLowerCase();
const finding = (rule, file, line, msg) => ({ rule, file, line, msg });

function lineIndex(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  return (off) => {
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= off) lo = mid; else hi = mid - 1; }
    return lo + 1;
  };
}

// Replace a span with spaces but keep newlines, so offsets and line numbers stay true.
const blank = (s) => s.replace(/[^\n]/g, ' ');

// HTML with comments and <script>/<style> contents blanked: what the tag-level rules see.
export function htmlMarkup(text) {
  return text
    .replace(/<!--[\s\S]*?(-->|$)/g, blank)
    .replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script\s*>)/gi, (m, a, b, c) => a + blank(b) + c)
    .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi, (m, a, b, c) => a + blank(b) + c);
}

const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
const ATTR_RE = /([^\s"'>\/=]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g;
function attrs(src) {
  const out = [];
  for (const m of src.matchAll(ATTR_RE)) {
    let v = m[2];
    if (v != null && /^["']/.test(v)) v = v.slice(1, -1);
    out.push({ name: m[1].toLowerCase(), value: v, index: m.index });
  }
  return out;
}

// ---------- 1. DUP-ID ----------
export function ruleDupId(text, file) {
  if (ext(file) !== 'html') return [];
  const md = htmlMarkup(text), at = lineIndex(text), seen = new Map(), out = [];
  for (const t of md.matchAll(TAG_RE)) {
    if (t[1]) continue;
    for (const a of attrs(t[3])) {
      if (a.name !== 'id' || !a.value || /\$\{|\{\{/.test(a.value)) continue;
      const line = at(t.index);
      if (seen.has(a.value)) out.push(finding('DUP-ID', file, line, `id="${a.value}" already used on line ${seen.get(a.value)}`));
      else seen.set(a.value, line);
    }
  }
  return out;
}

// ---------- 2. IMG-ALT ----------
export function ruleImgAlt(text, file) {
  if (ext(file) !== 'html') return [];
  const md = htmlMarkup(text), at = lineIndex(text), out = [];
  for (const t of md.matchAll(TAG_RE)) {
    if (t[1] || t[2].toLowerCase() !== 'img') continue;
    if (!attrs(t[3]).some((a) => a.name === 'alt')) out.push(finding('IMG-ALT', file, at(t.index), '<img> has no alt attribute'));
  }
  return out;
}

// ---------- 3. UNCLOSED ----------
const VOID = new Set('area base br col embed hr img input link meta source track wbr'.split(' '));
const OPTIONAL_END = new Set('p li td th tr option optgroup thead tbody tfoot dt dd html head body colgroup caption rt rp'.split(' '));
// Opening one of these implicitly closes an open sibling of the listed kinds.
const AUTO_CLOSE = { li: ['li'], dt: ['dt', 'dd'], dd: ['dt', 'dd'], tr: ['tr', 'td', 'th'], td: ['td', 'th'], th: ['td', 'th'],
  option: ['option'], thead: ['tbody', 'tfoot', 'tr', 'td', 'th'], tbody: ['thead', 'tbody', 'tr', 'td', 'th'], tfoot: ['thead', 'tbody', 'tr', 'td', 'th'] };
export function ruleUnclosed(text, file) {
  if (ext(file) !== 'html') return [];
  const md = htmlMarkup(text), at = lineIndex(text), stack = [], out = [];
  for (const t of md.matchAll(TAG_RE)) {
    const name = t[2].toLowerCase(), line = at(t.index);
    if (VOID.has(name)) continue;
    if (!t[1]) {
      if (/\/\s*$/.test(t[3])) continue; // <x/> (svg)
      const ac = AUTO_CLOSE[name];
      if (ac) while (stack.length && ac.includes(stack[stack.length - 1].name)) stack.pop();
      stack.push({ name, line });
      continue;
    }
    const idx = stack.map((e) => e.name).lastIndexOf(name);
    if (idx < 0) { out.push(finding('UNCLOSED', file, line, `</${name}> closes nothing that is open`)); continue; }
    const between = stack.slice(idx + 1).filter((e) => !OPTIONAL_END.has(e.name));
    if (between.length) {
      const e = between[between.length - 1];
      out.push(finding('UNCLOSED', file, line, `</${name}> while <${e.name}> from line ${e.line} is still open`));
    }
    stack.length = idx;
  }
  for (const e of stack) if (!OPTIONAL_END.has(e.name)) out.push(finding('UNCLOSED', file, e.line, `<${e.name}> is never closed`));
  return out;
}

// ---------- 4. COLOUR ----------
const HEX_RE = /(?<![\w&#])#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![\w-])/g;
const FN_RE = /\b(rgba?|hsla?)\(\s*([^()]*)\)/gi;
export function normColour(c) {
  c = c.toLowerCase().replace(/\s+/g, '');
  const m = c.match(/^#([0-9a-f]+)$/);
  if (m && (m[1].length === 3 || m[1].length === 4)) return '#' + [...m[1]].map((x) => x + x).join('');
  return c;
}
// Colour literals in a string, as [{value, offset}] relative to the string.
export function colourLiterals(s) {
  const out = [];
  for (const m of s.matchAll(HEX_RE)) out.push({ value: m[0], offset: m.index });
  for (const m of s.matchAll(FN_RE)) if (!/var\(|\$\{|calc\(/i.test(m[2]) && /\d/.test(m[2])) out.push({ value: m[0], offset: m.index });
  return out.sort((a, b) => a.offset - b.offset);
}
export function tokenColours(tokensText) {
  return new Set(colourLiterals(tokensText.replace(/\/\*[\s\S]*?\*\//g, blank)).map((c) => normColour(c.value)));
}
// String-literal spans of JS source (comments skipped). Regex literals are not understood; ' and " strings end at a newline.
export function jsStrings(src) {
  const spans = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const start = i + 1;
      i++;
      while (i < n && src[i] !== c) {
        if (src[i] === '\\') i++;
        else if (c !== '`' && src[i] === '\n') break;
        i++;
      }
      spans.push({ start, text: src.slice(start, i) });
      i++;
      continue;
    }
    i++;
  }
  return spans;
}
function colourFileApplies(file) {
  return !/^(tests|tools)\//.test(file) && file !== 'tokens.css' && ['css', 'html', 'js', 'mjs'].includes(ext(file));
}
export function ruleColour(text, file, ctx) {
  if (!colourFileApplies(file)) return [];
  const at = lineIndex(text), spans = [], e = ext(file);
  if (e === 'css') spans.push({ start: 0, text: text.replace(/\/\*[\s\S]*?\*\//g, blank) });
  else if (e === 'html') {
    for (const m of text.matchAll(/(<style\b[^>]*>)([\s\S]*?)<\/style\s*>/gi)) {
      spans.push({ start: m.index + m[1].length, text: m[2].replace(/\/\*[\s\S]*?\*\//g, blank) });
    }
    const md = htmlMarkup(text);
    for (const t of md.matchAll(TAG_RE)) {
      if (t[1]) continue;
      const base = t.index + 1 + t[2].length;
      for (const m of t[3].matchAll(/(\sstyle\s*=\s*)("([^"]*)"|'([^']*)')/gi)) {
        spans.push({ start: base + m.index + m[1].length + 1, text: m[3] ?? m[4] });
      }
    }
  } else spans.push(...jsStrings(text));
  const out = [];
  for (const s of spans) {
    for (const c of colourLiterals(s.text)) {
      if (ctx.tokens.has(normColour(c.value))) continue;
      out.push(finding('COLOUR', file, at(s.start + c.offset), `${c.value} is not a value in tokens.css`));
    }
  }
  return out;
}

// ---------- 5. CONSOLE-LOG ----------
export function consoleLogApplies(file) {
  if (!['html', 'js', 'mjs'].includes(ext(file))) return false;
  if (/^(tests|tools|\.github)\//.test(file)) return false;
  if (file.split('/').slice(0, -1).some((d) => /^(scripts?|dev|bin|build)$/i.test(d))) return false;
  return !/\.config\.(m?js)$/.test(file);
}
export function ruleConsoleLog(text, file) {
  if (!consoleLogApplies(file)) return [];
  const out = [];
  text.split('\n').forEach((l, i) => {
    if (/\bconsole\.log\s*\(/.test(l.replace(/\/\/.*$/, ''))) out.push(finding('CONSOLE-LOG', file, i + 1, 'console.log( in shipped page code'));
  });
  return out;
}

// ---------- 6. TRAILING-WS ----------
export function ruleTrailingWs(text, file) {
  const out = [];
  text.split('\n').forEach((l, i) => {
    if (/[ \t]+$/.test(l.replace(/\r$/, ''))) out.push(finding('TRAILING-WS', file, i + 1, 'trailing spaces or tabs'));
  });
  return out;
}

// ---------- 7-10. workflows ----------
const isWorkflow = (file) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(file);
const stripComment = (l) => l.replace(/(^|\s)#.*$/, '').replace(/\s+$/, '');
function topLevel(lines) {
  const keys = [];
  lines.forEach((l, i) => { const m = l.match(/^([A-Za-z_][\w-]*)\s*:(.*)$/); if (m) keys.push({ key: m[1], rest: stripComment(m[2]).trim(), line: i }); });
  return keys;
}
function blockBody(lines, from) {
  const body = [];
  for (let i = from + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^\S/.test(l) && !/^#/.test(l)) break;
    if (stripComment(l).trim()) body.push({ text: l, line: i });
  }
  return body;
}

export function ruleWfPin(text, file) {
  if (!isWorkflow(file)) return [];
  const out = [];
  text.split('\n').forEach((l, i) => {
    const m = l.match(/^\s*(?:-\s+)?uses\s*:\s*(.*)$/);
    if (!m) return;
    const raw = m[1].replace(/\r$/, '');
    const val = raw.replace(/\s+#.*$/, '').trim().replace(/^["']|["']$/g, '');
    if (val.startsWith('./')) return;
    if (!/^[\w.-]+\/[\w.\/-]+@[0-9a-f]{40}$/.test(val)) out.push(finding('WF-PIN', file, i + 1, `uses: ${val} is not pinned to a 40-hex commit sha`));
    else if (!/\s#\s*v\d/.test(raw)) out.push(finding('WF-PIN', file, i + 1, `uses: ${val} has no "# vX" version comment`));
  });
  return out;
}
export function ruleWfPerms(text, file) {
  if (!isWorkflow(file)) return [];
  const lines = text.split('\n').map((l) => l.replace(/\r$/, ''));
  const k = topLevel(lines).find((x) => x.key === 'permissions');
  if (!k) return [finding('WF-PERMS', file, 1, 'no top-level permissions: block')];
  if (k.rest) return [finding('WF-PERMS', file, k.line + 1, `top-level permissions: ${k.rest} (must be a block with only contents: read)`)];
  const body = blockBody(lines, k.line).map((b) => stripComment(b.text).trim());
  if (body.length === 1 && /^contents\s*:\s*read$/.test(body[0])) return [];
  return [finding('WF-PERMS', file, k.line + 1, `top-level permissions must be only contents: read (found: ${body.join(', ') || 'nothing'})`)];
}
export function ruleWfTimeout(text, file) {
  if (!isWorkflow(file)) return [];
  const lines = text.split('\n').map((l) => l.replace(/\r$/, ''));
  const k = topLevel(lines).find((x) => x.key === 'jobs');
  if (!k) return [];
  const body = blockBody(lines, k.line), out = [];
  const jobs = body.filter((b) => /^  [A-Za-z_][\w-]*\s*:\s*$/.test(stripComment(b.text)));
  jobs.forEach((j, n) => {
    const end = n + 1 < jobs.length ? jobs[n + 1].line : (body.length ? body[body.length - 1].line + 1 : j.line + 1);
    const own = body.filter((b) => b.line > j.line && b.line < end).map((b) => b.text);
    if (own.some((l) => /^    uses\s*:/.test(l))) return; // reusable-workflow call: timeout-minutes is not allowed there
    if (!own.some((l) => /^    timeout-minutes\s*:/.test(l))) {
      out.push(finding('WF-TIMEOUT', file, j.line + 1, `job ${j.text.trim().replace(/:.*$/, '')} has no timeout-minutes`));
    }
  });
  return out;
}
export function ruleWfConcurrency(text, file) {
  if (!isWorkflow(file)) return [];
  const lines = text.split('\n').map((l) => l.replace(/\r$/, ''));
  return topLevel(lines).some((x) => x.key === 'concurrency') ? [] : [finding('WF-CONCURRENCY', file, 1, 'no top-level concurrency: block')];
}

export const RULES = [ruleDupId, ruleImgAlt, ruleUnclosed, ruleColour, ruleConsoleLog, ruleTrailingWs, ruleWfPin, ruleWfPerms, ruleWfTimeout, ruleWfConcurrency];
export const lintText = (text, file, ctx) => RULES.flatMap((r) => r(text, file, ctx));

// ---------- repo run ----------
export function scannedFiles(root = ROOT) {
  return execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
    .split('\n').filter(Boolean)
    .filter((f) => /\.(html|css|js|mjs|yml)$/i.test(f))
    .filter((f) => !/(^|\/)node_modules\//.test(f) && !/^tests\/fixtures\//.test(f) && !/^docs\//.test(f) && !/\.min\.js$/i.test(f));
}
export function lintRepo(root = ROOT) {
  const tokPath = join(root, 'tokens.css');
  const ctx = { tokens: existsSync(tokPath) ? tokenColours(readFileSync(tokPath, 'utf8')) : new Set() };
  const out = [];
  for (const f of scannedFiles(root)) {
    const p = join(root, f);
    if (!existsSync(p)) continue;
    out.push(...lintText(readFileSync(p, 'utf8'), f, ctx));
  }
  return out;
}
const key = (f) => `${f.rule}|${f.file}`;
export function countByKey(findings) {
  const m = {};
  for (const f of findings) m[key(f)] = (m[key(f)] || 0) + 1;
  return Object.fromEntries(Object.keys(m).sort().map((k) => [k, m[k]]));
}
export function compare(findings, known) {
  const now = countByKey(findings), excess = [], stale = [];
  let knownN = 0;
  for (const [k, n] of Object.entries(now)) {
    const allowed = known[k] || 0;
    knownN += Math.min(n, allowed);
    if (n > allowed) excess.push({ key: k, now: n, known: allowed, findings: findings.filter((f) => key(f) === k) });
  }
  for (const [k, allowed] of Object.entries(known)) if ((now[k] || 0) < allowed) stale.push({ key: k, now: now[k] || 0, known: allowed });
  return { excess, stale, total: findings.length, known: knownN, fresh: findings.length - knownN };
}
const show = (f) => `${f.file}:${f.line} ${f.rule} ${f.msg}`;

// ---------- selftest ----------
export function selftest() {
  const ctx = { tokens: tokenColours(':root { --a: #123456; --b: #abc; --c: rgba(0, 0, 0, 0.5); }') };
  const cleanHtml = '<!doctype html>\n<html><head><title>t</title>\n<style>.x { color: #123456; background: #AABBCC; }</style></head>\n'
    + '<body><div id="a"><img src="x.png" alt=""><p>one<p>two</div>\n<ul><li>a<li>b</ul><br><svg><path d="M0"/></svg>\n'
    + '<span id="${x}"></span><span id="${x}"></span>\n<script>const s = "<div>"; console.warn("ok");</script>\n<!-- <div id="a"> -->\n</body></html>\n';
  const cleanJs = 'const c = "#123456"; // #ff0000 in a comment\nconsole.error("x");\n';
  const cleanWf = 'name: ok\non: push\npermissions:\n  contents: read\nconcurrency:\n  group: g\njobs:\n  a:\n    runs-on: ubuntu-24.04\n'
    + '    timeout-minutes: 5\n    steps:\n      - uses: actions/checkout@' + 'a'.repeat(40) + ' # v4\n      - uses: ./local\n'
    + '  b:\n    uses: ./.github/workflows/reuse.yml\n';
  const badWf = 'name: bad\non: push\npermissions:\n  contents: read\n  pull-requests: read\njobs:\n  a:\n    runs-on: ubuntu-24.04\n'
    + '    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@' + 'b'.repeat(40) + '\n';
  const cases = [
    { name: 'duplicate id', rule: 'DUP-ID', file: 'p/index.html', text: '<div id="a"></div>\n<span id="a"></span>\n', want: 1 },
    { name: 'img without alt', rule: 'IMG-ALT', file: 'p/index.html', text: '<p><img src="x.png"></p>\n', want: 1 },
    { name: 'unclosed div', rule: 'UNCLOSED', file: 'p/index.html', text: '<main>\n<div>\n<span>x</span>\n</main>\n', want: 1 },
    { name: 'stray close', rule: 'UNCLOSED', file: 'p/index.html', text: '<div></div></span>\n', want: 1 },
    { name: 'colour not in tokens (css)', rule: 'COLOUR', file: 'p/a.css', text: '.x { color: #654321; border-color: #abc; }\n', want: 1 },
    { name: 'colour not in tokens (style attr)', rule: 'COLOUR', file: 'p/index.html', text: '<div style="color: rgb(1, 2, 3)"></div>\n', want: 1 },
    { name: 'colour not in tokens (js string)', rule: 'COLOUR', file: 'p/a.js', text: 'el.style.color = "#FEDCBA";\n', want: 1 },
    { name: 'colour rule skips tools/', rule: 'COLOUR', file: 'tools/x.js', text: 'const c = "#654321";\n', want: 0 },
    { name: 'console.log', rule: 'CONSOLE-LOG', file: 'p/a.js', text: 'console.log("x");\n', want: 1 },
    { name: 'console.log exempt in tests/', rule: 'CONSOLE-LOG', file: 'tests/a.js', text: 'console.log("x");\n', want: 0 },
    { name: 'trailing whitespace', rule: 'TRAILING-WS', file: 'a.yml', text: 'a: 1 \nb: 2\t\nc: 3\n', want: 2 },
    { name: 'unpinned action + missing version comment', rule: 'WF-PIN', file: '.github/workflows/bad.yml', text: badWf, want: 2 },
    { name: 'wrong permissions', rule: 'WF-PERMS', file: '.github/workflows/bad.yml', text: badWf, want: 1 },
    { name: 'permissions read-all', rule: 'WF-PERMS', file: '.github/workflows/bad.yml', text: 'permissions: read-all\njobs: {}\n', want: 1 },
    { name: 'missing timeout', rule: 'WF-TIMEOUT', file: '.github/workflows/bad.yml', text: badWf, want: 1 },
    { name: 'missing concurrency', rule: 'WF-CONCURRENCY', file: '.github/workflows/bad.yml', text: badWf, want: 1 },
    { name: 'clean html', rule: '*', file: 'p/index.html', text: cleanHtml, want: 0 },
    { name: 'clean js', rule: '*', file: 'p/a.js', text: cleanJs, want: 0 },
    { name: 'clean workflow', rule: '*', file: '.github/workflows/ok.yml', text: cleanWf, want: 0 },
  ];
  let failed = 0;
  for (const c of cases) {
    const got = lintText(c.text, c.file, ctx).filter((f) => c.rule === '*' || f.rule === c.rule);
    const ok = got.length === c.want;
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${c.name}: ${c.rule} expected ${c.want}, got ${got.length}${ok ? '' : '\n       ' + got.map(show).join('\n       ')}`);
  }
  console.log(`selftest: ${cases.length - failed}/${cases.length} control cases passed`);
  return failed === 0;
}

// ---------- CLI ----------
function main(argv) {
  if (argv.includes('--selftest')) return selftest() ? 0 : 1;
  const t0 = Date.now();
  const findings = lintRepo();
  if (argv.includes('--update-known')) {
    writeFileSync(KNOWN, JSON.stringify(countByKey(findings), null, 2) + '\n');
    console.log(`lint: wrote ${KNOWN.slice(ROOT.length + 1)} (${findings.length} findings)`);
    return 0;
  }
  const known = existsSync(KNOWN) ? JSON.parse(readFileSync(KNOWN, 'utf8')) : {};
  if (argv.includes('--all')) for (const f of findings) console.log(show(f));
  const r = compare(findings, known);
  for (const e of r.excess) {
    console.log(`NEW ${e.key}: ${e.now} now, ${e.known} known`);
    for (const f of e.findings) console.log('  ' + show(f));
  }
  for (const s of r.stale) console.log(`hint: ${s.key} is down to ${s.now} (known ${s.known}); lower it in known.json or run --update-known`);
  console.log(`lint: ${r.total} findings, ${r.known} known, ${r.fresh} new (${Date.now() - t0} ms)`);
  return r.excess.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
