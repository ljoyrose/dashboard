// Page-size budgets, one place for the rule (3 Nov 2026).
// Each page has a BASE number in its spec. A PR that makes a page heavier does NOT edit that number: it adds ONE new file,
// tests/budget-growth/<short-name>.json, like {"home": 3000, "why": "Personal Drive bin, PR 273"}. The budget is the base
// plus every growth file. Two PRs add two different files, so they never conflict (editing the same line did, every time).
// When a page is made smaller, lower its base in the spec and delete the growth files it no longer needs.
const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '..', 'budget-growth');
// Every page named in the two specs; a growth file may name pages from either spec, so a typo is caught here.
const PAGES = ['home', 'cdhub', 'factory', 'food', 'marketplace', 'money', 'studio', 'privacy'];

function withGrowth(base) {
  const out = Object.assign({}, base);
  const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => /\.json$/.test(f)).sort() : [];
  files.forEach((f) => {
    const g = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
    Object.keys(g).forEach((k) => {
      if (k === 'why') return;
      if (PAGES.indexOf(k) < 0) throw new Error('budget-growth/' + f + ': "' + k + '" is not a page (' + PAGES.join(', ') + ')');
      if (typeof g[k] !== 'number' || g[k] < 0) throw new Error('budget-growth/' + f + ': "' + k + '" must be a number of bytes, 0 or more');
      if (k in out) out[k] += g[k];
    });
    if (!g.why) throw new Error('budget-growth/' + f + ': add a "why" (what grew, and the PR)');
  });
  return out;
}

module.exports = { withGrowth, DIR };
