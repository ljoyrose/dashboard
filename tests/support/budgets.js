const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '..', 'budget-growth');
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

