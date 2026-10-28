// A pretend studio-state.json for the Studio page (invented brands, assets and tools; no real names, prices or people).
// Shape: see the comment at the top of studio/index.html. Times are relative to `now`, so the page sees fresh data.
// v0.2: groups, playbooks, packs, kits, bricks, styles (frameworks, voices, looks), formats, sources and gaps.
// Group, framework, look and format ids match the rows STUDIO-ENGINE v0.2 seeds, so the engine harness can reuse this file.
(function (root) {
  function build(now) {
    now = now || Date.now();
    var H = 36e5, D = 864e5;
    var iso = function (o) { return new Date(now + o).toISOString(); };
    var day = function (o) { return new Date(now + o * D).toISOString().slice(0, 10); };
    var a = function (o) {
      return Object.assign({ accountId: 'acc-owner', brandIds: ['sb-north'], productId: null, projectName: 'Sample project', type: 'pdf', recipe: 'Sample recipe', size: 'M', stage: 1, who: 'claude', fit: 'AUTO',
        evergreen: true, dated: false, eventDate: null, provider: 'Claude', cost: 0, rating: null, reviewLink: '', docLink: '', version: 1, priority: null, updated: iso(-D), flags: [], gate: null,
        kitId: null, groupId: 'grp-dogs', playbookId: null, outcome: null, frameworkId: null, voiceId: null, lookId: null, formatIds: [], language: '', length: '',
        masterId: null, purpose: null, test: null, result: null, sourceIds: [] }, o);
    };
    return {
      generated_at: iso(-60e3),
      studio: { on: true, mode: 'TEST', budgetMonth: 50, spentMonth: 20 },
      health: { lastRun: iso(-10 * 60e3), jobs: [{ job: 'syncState', result: 'OK', last: iso(-10 * 60e3), note: 'sample' }] },
      accounts: [{ id: 'acc-owner', name: 'Sample owner', kind: 'owner' }, { id: 'acc-client', name: 'Sample client', kind: 'client' }],
      groups: [{ id: 'grp-dogs', name: 'Dogs' }, { id: 'grp-apps', name: 'Apps' }, { id: 'grp-services', name: 'Client services' }, { id: 'grp-lisa', name: 'Lisa' }],
      products: [
        { id: 'sp-course', accountId: 'acc-owner', brandId: 'sb-north', name: 'Sample course', type: 'course' },
        { id: 'sp-client', accountId: 'acc-client', brandId: 'sb-client', name: 'Sample client book', type: 'book' }
      ],
      brands: [
        { id: 'sb-north', accountId: 'acc-owner', name: 'Sample Brand North', colour: 7, stage: 'Running', setupChecklist: [{ name: 'Name checked', ok: true }, { name: 'Logo', ok: true }, { name: 'Email list', ok: false }], groupId: 'grp-dogs', voiceId: 'vo-warm', lookId: 'look-combination', kit: { canvaKitId: null, canvaKitUrl: null, font: null, colours: ['#A570D1'], fontHeading: 'Lexend', fontBody: null, logoIds: [], logo: 'https://www.example.com/north-logo.png', voice: null, designRoute: null, website: 'https://www.example.com/north' } },
        { id: 'sb-south', accountId: 'acc-owner', name: 'Sample Brand South', colour: 6, stage: 'Tech set-up', setupChecklist: [{ name: 'Name checked', ok: true }], groupId: 'grp-dogs', voiceId: null, lookId: null, kit: { canvaKitId: null, canvaKitUrl: null, font: null, colours: [], fontHeading: null, fontBody: null, logoIds: [], logo: null, voice: null, designRoute: null, website: null } },
        { id: 'sb-client', accountId: 'acc-client', name: 'Sample Client Brand', colour: 5, stage: 'Launch', setupChecklist: [], groupId: 'grp-services', voiceId: null, lookId: null, kit: { canvaKitId: null, canvaKitUrl: null, font: null, colours: [], fontHeading: null, fontBody: null, logoIds: [], logo: null, voice: null, designRoute: null, website: null } }
      ],
      assets: [
        a({ id: 'sa-rev1', title: 'Sample checklist PDF', productId: 'sp-course', stage: 7, reviewLink: 'https://drive.google.com/file/d/1SAMPLEreviewDoc00000000000/view', updated: iso(-H),
          kitId: 'kit-lead', outcome: 'attract', frameworkId: 'fw-pas', formatIds: ['fmt-a4'], language: 'en-GB', sourceIds: ['src-1'] }),
        a({ id: 'sa-rev2', title: 'Sample welcome email', brandIds: ['sb-south'], type: 'email', stage: 7, updated: iso(-2 * H),
          kitId: 'kit-email', outcome: 'keep', frameworkId: 'fw-hso', formatIds: ['fmt-email-header'], masterId: 'sa-lib', purpose: 'refresh', test: 'ab-welcome' }),
        a({ id: 'sa-make', title: 'Sample webclass slides', brandIds: ['sb-north', 'sb-south'], type: 'slides', stage: 5, size: 'L', evergreen: false, dated: true, eventDate: day(14),
          kitId: 'kit-webclass', playbookId: 'pb-launch', outcome: 'convert', frameworkId: 'fw-webinar', formatIds: ['fmt-youtube', 'fmt-reel'] }),
        a({ id: 'sa-gate', title: 'Sample lead magnet', brandIds: ['sb-south'], type: 'lead', stage: 3, who: 'lisa', fit: 'HAND', gate: { question: 'Lock the spec?', at: iso(-3 * H) } }),
        a({ id: 'sa-hand', title: 'Sample social graphic', type: 'social', stage: 4, who: 'lisa', fit: 'HAND', size: 'S', flags: ['needs-input'], kitId: 'kit-social', formatIds: ['fmt-fb-feed'] }),
        a({ id: 'sa-lib', title: 'Sample puppy pack', brandIds: ['sb-south'], type: 'pack', stage: 8, version: 3, rating: 5 }),
        a({ id: 'sa-test', title: 'TEST-Sample logbook', type: 'logbook', stage: 2, who: 'engine' }),
        a({ id: 'sa-client', accountId: 'acc-client', title: 'Sample client ebook', brandIds: ['sb-client'], productId: 'sp-client', type: 'ebook', stage: 2, groupId: 'grp-services',
          kitId: 'kit-social', formatIds: ['fmt-fb-feed'] })
      ],
      ideas: [
        a({ id: 'si-1', title: 'Sample ebook idea', type: 'ebook', stage: 0, who: 'lisa' })
      ],
      playbooks: [
        { id: 'pb-launch', name: 'Sample launch playbook', outcome: 'convert', steps: [{ kind: 'pack', id: 'pk-funnel', text: 'Sample webclass funnel' }, { kind: 'kit', id: 'kit-email', text: 'Sample email kit' }, { kind: 'action', id: null, text: 'Post the replay link' }], notes: '' },
        { id: 'pb-grow', name: 'Sample list builder', outcome: 'attract', steps: [{ kind: 'kit', id: 'kit-lead', text: 'Sample lead magnet kit' }, { kind: 'kit', id: 'kit-social', text: 'Sample social post kit' }], notes: '' }
      ],
      packs: [
        { id: 'pk-funnel', name: 'Sample webclass funnel', kind: 'funnel', kitIds: ['kit-webclass', 'kit-email'], notes: 'Pages and emails' }
      ],
      kits: [
        { id: 'kit-lead', name: 'Sample lead magnet kit', type: 'lead', brickIds: ['br-hook'], needs: ['doc-fill', 'pdf-export'], frameworkId: 'fw-pas', voiceId: null, lookId: null, formatIds: ['fmt-a4'], notes: '' },
        { id: 'kit-email', name: 'Sample email kit', type: 'email', brickIds: [], needs: ['email-draft'], frameworkId: 'fw-hso', voiceId: null, lookId: null, formatIds: ['fmt-email-header'], notes: '' },
        { id: 'kit-webclass', name: 'Sample webclass kit', type: 'slides', brickIds: ['br-hook'], needs: ['slides-fill', 'video-reformat'], frameworkId: 'fw-webinar', voiceId: null, lookId: null, formatIds: ['fmt-youtube', 'fmt-reel'], notes: '' },
        { id: 'kit-social', name: 'Sample social post kit', type: 'social', brickIds: [], needs: ['image-generate'], frameworkId: null, voiceId: null, lookId: null, formatIds: ['fmt-fb-feed'], notes: '' }
      ],
      bricks: [
        { id: 'br-hook', name: 'Sample hook line', kind: 'hook', text: 'Sample hook text', link: '', notes: '' }
      ],
      frameworks: [
        { id: 'fw-hso', name: 'Hook, story, offer', source: 'Sample source', steps: ['Hook', 'Story', 'Offer'], when: 'Short posts and emails', notes: '' },
        { id: 'fw-pas', name: 'Problem, agitate, solve', source: 'Sample source', steps: ['Problem', 'Agitate', 'Solve'], when: 'Lead magnets', notes: '' },
        { id: 'fw-webinar', name: 'Webinar pitch', source: 'Sample source', steps: ['Big promise', 'Three secrets', 'Offer'], when: 'Webclasses', notes: '' }
      ],
      voices: [
        { id: 'vo-warm', name: 'Sample warm expert', brandId: 'sb-north', steps: ['Short sentences', 'Kind, sure'], when: 'Everything for Brand North', notes: '' }
      ],
      looks: [
        { id: 'look-wordmark', name: 'Wordmark', kind: 'logo', steps: ['The name in one typeface'], when: 'Short, clear names', notes: '' },
        { id: 'look-combination', name: 'Combination mark', kind: 'logo', steps: ['Symbol plus name'], when: 'New brands', notes: '' }
      ],
      formats: [
        { id: 'fmt-fb-feed', name: 'Facebook feed', channel: 'Facebook', ratio: '4:5', size: '1080x1350', maxLength: '', safeZone: 'Keep text in the middle', fileType: 'jpg, png, mp4', notes: '' },
        { id: 'fmt-reel', name: 'Reels, TikTok, Shorts', channel: 'Instagram, Facebook, TikTok, YouTube', ratio: '9:16', size: '1080x1920', maxLength: '90s', safeZone: 'Keep the top and bottom clear', fileType: 'mp4', notes: '' },
        { id: 'fmt-youtube', name: 'YouTube', channel: 'YouTube', ratio: '16:9', size: '1920x1080', maxLength: '', safeZone: '', fileType: 'mp4', notes: '' },
        { id: 'fmt-email-header', name: 'Email header', channel: 'Email', ratio: '', size: '600 wide', maxLength: '', safeZone: '', fileType: 'png, jpg', notes: '' },
        { id: 'fmt-a4', name: 'Print A4', channel: 'Print', ratio: '1:1.41', size: '210x297mm + 3mm bleed', maxLength: '', safeZone: '', fileType: 'pdf', notes: 'CMYK-safe colours' }
      ],
      sources: [
        { id: 'src-1', targetId: 'sa-rev1', kind: 'link', url: 'https://example.com/sample-inspiration', fileName: '', note: '', rights: 'inspiration', by: 'sample', at: iso(-2 * D) }
      ],
      tools: [
        { product: 'Sample image tool', thing: 'Credits', unit: 'credits', allowance: 100, period: 'month', resetsOn: day(20), used: 85, left: 15, carriesOver: false, fit: 'AUTO',
          capabilities: ['image-generate', 'background-remove'], inputs: ['text'], outputs: ['fmt-fb-feed', 'fmt-reel'], accountNotes: '', costPerUnit: 0.1, audit: '' },
        { product: 'Sample writing tool', thing: 'Messages', unit: 'messages', allowance: 200, period: 'month', resetsOn: day(25), used: 20, left: 180, carriesOver: true, fit: 'HAND',
          capabilities: ['text-write', 'email-draft', 'doc-fill', 'pdf-export', 'slides-fill'], inputs: ['text'], outputs: [], accountNotes: '', costPerUnit: 0, audit: '' },
        { product: 'Sample video tool', thing: 'Minutes', unit: 'min', allowance: 0, period: 'month', resetsOn: null, used: 0, left: 0, carriesOver: false, fit: 'NOT_OWNED',
          capabilities: ['video-reformat'], inputs: ['mp4'], outputs: ['fmt-reel'], accountNotes: 'Free trial only', costPerUnit: 0, audit: '' }
      ],
      gaps: [
        { capability: 'video-reformat', format: 'fmt-youtube', ratio: '16:9', reason: 'no owned tool can do video-reformat at 16:9', assetIds: ['sa-make'] },
        { capability: 'video-reformat', format: 'fmt-reel', ratio: '9:16', reason: 'no owned tool can do video-reformat at 9:16', assetIds: ['sa-make'] }
      ],
      failed: []
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { build: build };
  else root.STUDIO_FIXTURE = build;
})(this);
