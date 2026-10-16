// The deliberate breaks for the weekly teeth check (see run-teeth.js).
// tests/mocked/ci-guards.spec.js checks on every push that each `find` text still appears exactly once in its file.
// find: exact text that must appear exactly once in `file` (if not, this list is out of date: reported, not ignored)
const BREAKS = [
  { id: 'back-link', what: 'Money Hub "← Dashboard" link goes to the wrong place', file: 'money/index.html',
    find: '<a class="back" href="../">', replace: '<a class="back" href="../nowhere/">', project: 'mocked', spec: 'main-dashboard' },
  { id: 'write-scope', what: 'Main dashboard asks Google for more than read-only access', file: 'index.html',
    find: "var SCOPE = 'https://www.googleapis.com/auth/drive.readonly';", replace: "var SCOPE = 'https://www.googleapis.com/auth/drive';", project: 'mocked', spec: 'main-dashboard' },
  { id: 'rr-inside-folder', what: 'Bin stops noticing an RR_ item inside a ZZ_ folder', file: 'index.html',
    find: "if (isArchiveName(r.files[i].name)) return true;", replace: "", project: 'mocked', spec: 'bin-safety' },
  { id: 'rr-folder-chain', what: 'Bin stops protecting ZZ_ items that sit inside an RR_ folder', file: 'index.html',
    find: "if (chain.some(isArchiveName)) {", replace: "if (false) {", project: 'mocked', spec: 'bin-safety' },
  { id: 'rename-prefix', what: 'PC-Personal rename stops adding the ZZ_DELETE_DRIVE_ prefix', file: 'index.html',
    find: "{ name: PCP_PREFIX + f.name }", replace: "{ name: f.name }", project: 'mocked', spec: 'personal-and-drive-check' },
  { id: 'bom', what: 'Money CSV reader stops ignoring the hidden start-of-file marker', file: 'money/core.js',
    find: ".replace(/^\\uFEFF/, '')", replace: "", project: 'mocked', spec: 'csv-parsing' },
  { id: 'renamed-column', what: 'Money page starts reading "income_vs_avg" instead of the Drive column "income_vs_avg_pct"', file: 'money/index.html',
    find: "income_vs_avg_pct", replace: "income_vs_avg", project: 'mocked', spec: 'header-contract' },
  { id: 'sideways-scroll', what: 'Money Hub becomes wider than a phone screen', file: 'money/index.html',
    find: '</head>', replace: '<style>body{min-width:700px}</style></head>', project: 'phone', spec: 'phone' },
];

module.exports = { BREAKS };
