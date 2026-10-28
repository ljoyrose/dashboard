// A pretend studio-state.json for the Studio page (invented brands, assets and tools; no real names, prices or people).
// Shape: see the comment at the top of studio/index.html. Times are relative to `now`, so the page sees fresh data.
(function (root) {
  function build(now) {
    now = now || Date.now();
    var H = 36e5, D = 864e5;
    var iso = function (o) { return new Date(now + o).toISOString(); };
    var day = function (o) { return new Date(now + o * D).toISOString().slice(0, 10); };
    var a = function (o) {
      return Object.assign({ accountId: 'acc-owner', brandIds: ['sb-north'], productId: null, projectName: 'Sample project', type: 'pdf', recipe: 'Sample recipe', size: 'M', stage: 1, who: 'claude', fit: 'AUTO',
        evergreen: true, dated: false, eventDate: null, provider: 'Claude', cost: 0, rating: null, reviewLink: '', docLink: '', version: 1, priority: null, updated: iso(-D), flags: [], gate: null }, o);
    };
    return {
      generated_at: iso(-60e3),
      studio: { on: true, mode: 'TEST', budgetMonth: 50, spentMonth: 20 },
      health: { lastRun: iso(-10 * 60e3), jobs: [{ job: 'syncState', result: 'OK', last: iso(-10 * 60e3), note: 'sample' }] },
      accounts: [{ id: 'acc-owner', name: 'Sample owner', kind: 'owner' }, { id: 'acc-client', name: 'Sample client', kind: 'client' }],
      products: [
        { id: 'sp-course', accountId: 'acc-owner', brandId: 'sb-north', name: 'Sample course', type: 'course' },
        { id: 'sp-client', accountId: 'acc-client', brandId: 'sb-client', name: 'Sample client book', type: 'book' }
      ],
      brands: [
        { id: 'sb-north', accountId: 'acc-owner', name: 'Sample Brand North', colour: 7, stage: 'Running', setupChecklist: [{ name: 'Name checked', ok: true }, { name: 'Logo', ok: true }, { name: 'Email list', ok: false }] },
        { id: 'sb-south', accountId: 'acc-owner', name: 'Sample Brand South', colour: 6, stage: 'Tech set-up', setupChecklist: [{ name: 'Name checked', ok: true }] },
        { id: 'sb-client', accountId: 'acc-client', name: 'Sample Client Brand', colour: 5, stage: 'Launch', setupChecklist: [] }
      ],
      assets: [
        a({ id: 'sa-rev1', title: 'Sample checklist PDF', productId: 'sp-course', stage: 7, reviewLink: 'https://drive.google.com/file/d/1SAMPLEreviewDoc00000000000/view', updated: iso(-H) }),
        a({ id: 'sa-rev2', title: 'Sample welcome email', brandIds: ['sb-south'], type: 'email', stage: 7, updated: iso(-2 * H) }),
        a({ id: 'sa-make', title: 'Sample webclass slides', brandIds: ['sb-north', 'sb-south'], type: 'slides', stage: 5, size: 'L', evergreen: false, dated: true, eventDate: day(14) }),
        a({ id: 'sa-gate', title: 'Sample lead magnet', brandIds: ['sb-south'], type: 'lead', stage: 3, who: 'lisa', fit: 'HAND', gate: { question: 'Lock the spec?', at: iso(-3 * H) } }),
        a({ id: 'sa-hand', title: 'Sample social graphic', type: 'social', stage: 4, who: 'lisa', fit: 'HAND', size: 'S', flags: ['needs-input'] }),
        a({ id: 'sa-lib', title: 'Sample puppy pack', brandIds: ['sb-south'], type: 'pack', stage: 8, version: 3, rating: 5 }),
        a({ id: 'sa-test', title: 'TEST-Sample logbook', type: 'logbook', stage: 2, who: 'engine' }),
        a({ id: 'sa-client', accountId: 'acc-client', title: 'Sample client ebook', brandIds: ['sb-client'], productId: 'sp-client', type: 'ebook', stage: 2 })
      ],
      ideas: [
        a({ id: 'si-1', title: 'Sample ebook idea', type: 'ebook', stage: 0, who: 'lisa' })
      ],
      tools: [
        { product: 'Sample image tool', thing: 'Credits', unit: 'credits', allowance: 100, period: 'month', resetsOn: day(20), used: 85, left: 15, carriesOver: false, fit: 'AUTO' },
        { product: 'Sample writing tool', thing: 'Messages', unit: 'messages', allowance: 200, period: 'month', resetsOn: day(25), used: 20, left: 180, carriesOver: true, fit: 'HAND' }
      ],
      failed: []
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { build: build };
  else root.STUDIO_FIXTURE = build;
})(this);
