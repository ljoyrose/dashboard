// FACTORY DATA CONTRACT (JOB 31b). No browser, no Google. Names and types only.
// The page (factory/index.html) reads one file, af-state.json, written by AF-ENGINE. This file only reads that shape:
// if the engine changes it, the engine's PR updates tests/fixtures/factory/state.js and reruns tests/contract/make-expected-factory.js.
// Each failure case proves itself: CONTRACT_PROVE_RED=1 flips it to expect "no problem", so it must go red.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, expect } = require('@playwright/test');
const { extractFn, checkState, codes } = require('./shape');
const { REPO } = require('./headers');

const E = require('./expected-factory.json').factory['af-state.json'];
const RED = !!process.env.CONTRACT_PROVE_RED;
const caught = (problems, code) => (RED ? expect(problems).toEqual([]) : expect(codes(problems)).toEqual([code]));
const { build } = require('../fixtures/factory/state.js');
const state = () => JSON.parse(JSON.stringify(build(Date.now())));
const check = (s) => checkState('af-state.json', E, s);

/** The page's own list readers (allTasks, apps, mine, decisions), run on a state in a sandbox. */
function pageLists(s) {
  const html = fs.readFileSync(path.join(REPO, 'factory', 'index.html'), 'utf8');
  const names = ['allTasks', 'apps', 'isOpen', 'mine', 'decisions', 'queuedN', 'stuck'];
  const ctx = vm.createContext({ Date, JSON, String, Object, Array, S: s });
  vm.runInContext(names.map((n) => extractFn(html, n)).join('\n') + '\nthis.__fns = {' + names.join(',') + '};', ctx);
  return ctx.__fns;
}

test.describe('Factory contract: the invented state matches the list @contract', () => {
  test('af-state.json: every key has the expected type and every required key is there', () => { expect(check(state())).toEqual([]); });
  test("the page's own list readers read it without an error and keep every task", () => {
    const s = state();
    const n = Object.keys(s.lists).filter((k) => k !== 'template').reduce((t, k) => t + s.lists[k].length, 0);
    const f = pageLists(s);
    expect(f.allTasks().length).toBe(n);
    expect(f.apps().length).toBe(s.lists.apps.filter((t) => !t.parent).length);
    expect(Array.isArray(f.mine())).toBe(true);
    expect(f.decisions().length + f.queuedN()).toBeLessThanOrEqual(s.lists.decisions.length);
    s.lists.apps.forEach((t) => expect(typeof f.stuck(t)).toBe('boolean'));
  });
  test('a real-style task with parent, priority and due filled in also passes', () => {
    const s = state();
    Object.assign(s.lists.work[0], { parent: 'wrk000001', pri: { p: 'high', c: '#ffcc00' }, due: Date.now() });
    expect(check(s)).toEqual([]);
  });
});

test.describe('Factory contract: each kind of change gives a named failure @contract', () => {
  test('missing key: the file loses "lists" (the page would crash)', () => { const s = state(); delete s.lists; caught(check(s), 'MISSING'); });
  test('missing list: "decisions" is gone (the Decide view would go silently empty)', () => { const s = state(); delete s.lists.decisions; caught(check(s), 'MISSING'); });
  test('missing field: a send loses "tags" (mine() would crash)', () => { const s = state(); delete s.lists.sends[0].tags; caught(check(s), 'MISSING'); });
  test('renamed key: "generated_at" becomes "generatedAt"', () => { const s = state(); s.generatedAt = s.generated_at; delete s.generated_at; caught(check(s), 'RENAMED'); });
  test('renamed list: "work" becomes "tasks"', () => { const s = state(); s.lists.tasks = s.lists.work; delete s.lists.work; caught(check(s), 'RENAMED'); });
  test('renamed field: an app "status" becomes "stage"', () => { const s = state(); s.lists.apps[0].stage = s.lists.apps[0].status; delete s.lists.apps[0].status; caught(check(s), 'RENAMED'); });
  test('extra key: the file gains "newThing"', () => { const s = state(); s.newThing = {}; caught(check(s), 'EXTRA'); });
  test('wrong type: a task "updated" is an ISO date text (stuck() would never fire)', () => { const s = state(); s.lists.apps[0].updated = new Date().toISOString(); caught(check(s), 'WRONG_TYPE'); });
  test('wrong type: "tags" is one text, not a list', () => { const s = state(); s.lists.work[0].tags = 'who-lisa'; caught(check(s), 'WRONG_TYPE'); });
  test('wrong type: "lists" is a list, not an object', () => { const s = state(); s.lists = [].concat(s.lists.apps); caught(check(s), 'WRONG_TYPE'); });
  test('empty file: {}', () => { caught(check({}), 'EMPTY'); });
  test('empty file: null', () => { caught(check(null), 'EMPTY'); });
});
