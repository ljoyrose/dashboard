// The AF-ENGINE stamp handler (tools/presend/stamp-handler.gs), run in a sandbox with a pretend ClickUp.
// Invented ids and text only. Covers: a READY and a NOT READY stamp are posted as one plain comment; every bad request throws before any write.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { test, expect } = require('@playwright/test');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'tools', 'presend', 'stamp-handler.gs'), 'utf8');
const SENDS = '900000000001';
const SHA = crypto.createHash('sha256').update('Invented prompt text.').digest('hex');

function engine(tasks) {
  const calls = [], logs = [];
  const ctx = {
    cu_: (method, url, body) => {
      calls.push({ method, url, body });
      const m = url.match(/^\/task\/(\w+)$/);
      if (method === 'get' && m) { if (!tasks[m[1]]) throw new Error('404'); return { id: m[1], list: { id: tasks[m[1]] } }; }
      return {};
    },
    log_: (...a) => logs.push(a)
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return { run: (r) => ctx.stamp_({ CLICKUP_LIST_SENDS: SENDS }, r), calls, logs, writes: () => calls.filter((c) => c.method !== 'get') };
}
const ready = (o = {}) => ({ kind: 'stamp', taskId: 'abc123', line: 'presend: READY sha256:' + SHA + ' 30 Oct 2026 UK', sha256: SHA, ready: true, at: '2026-10-30T01:00:00Z', by: 'presend checker', ...o });

test.describe('presend stamp handler (AF-ENGINE)', () => {
  test('a READY stamp is posted as one comment, exactly the line, and logged', () => {
    const e = engine({ abc123: SENDS });
    e.run(ready());
    expect(e.writes()).toEqual([{ method: 'post', url: '/task/abc123/comment', body: { comment_text: 'presend: READY sha256:' + SHA + ' 30 Oct 2026 UK' } }]);
    expect(e.logs).toEqual([['stamp', 'OK', 'abc123', 'READY ' + SHA.slice(0, 12)]]);
  });

  test('a NOT READY stamp is posted too (the gate then locks Copy)', () => {
    const e = engine({ abc123: SENDS });
    e.run(ready({ line: 'presend: NOT READY (2 FAIL, 1 NOT RUN) sha256:' + SHA + ' 30 Oct 2026 01:00 UK', ready: false }));
    expect(e.writes()).toHaveLength(1);
    expect(e.writes()[0].body.comment_text).toMatch(/^presend: NOT READY /);
  });

  const bad = {
    'task id with a slash': { taskId: 'abc/123' },
    'no task id': { taskId: '' },
    'line that is not a presend line': { line: 'inputs-gate: PASS 30 Oct' },
    'READY with a short hash': { line: 'presend: READY sha256:' + SHA.slice(1) + ' 30 Oct 2026 UK' },
    'READY with no date': { line: 'presend: READY sha256:' + SHA + ' ' },
    'ready flag false on a READY line': { ready: false },
    'ready flag true on a NOT READY line': { line: 'presend: NOT READY (1 FAIL, 0 NOT RUN) sha256:' + SHA + ' 30 Oct 2026 01:00 UK' },
    'sha256 field differs from the line': { sha256: '0'.repeat(64) },
    'line over 300 characters': { line: 'presend: NOT READY ' + 'x'.repeat(300) , ready: false },
    'line with a second line hidden in it': { line: 'presend: READY sha256:' + SHA + ' 30 Oct 2026 UK\nstatus: done' }
  };
  for (const [name, o] of Object.entries(bad)) {
    test('refused before any write: ' + name, () => {
      const e = engine({ abc123: SENDS, 'abc/123': SENDS });
      expect(() => e.run(ready(o))).toThrow();
      expect(e.writes()).toHaveLength(0);
      expect(e.logs).toHaveLength(0);
    });
  }

  test('a task that is not in the Sends list is refused, nothing posted', () => {
    const e = engine({ abc123: '900000000099' });
    expect(() => e.run(ready())).toThrow(/not a Sends task/);
    expect(e.writes()).toHaveLength(0);
  });

  test('a task ClickUp cannot find is refused, nothing posted', () => {
    const e = engine({});
    expect(() => e.run(ready())).toThrow();
    expect(e.writes()).toHaveLength(0);
  });
});
