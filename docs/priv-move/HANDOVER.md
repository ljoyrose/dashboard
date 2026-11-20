# JOB PRIV-MOVE.1 handover (updated 20 Nov 2026)

Read `RUN-PROGRESS.md` first. Private detail (scan, decision pack, link list, slips) is on Drive in 00 AI Commons > CHANGES.

## Open PRs from this job (all for Lisa's merge card)
- Loader: PR 497, branch `claude/sweet-johnson-13bvh1`. Ships in dry run. Touches `config.js` and `auth.js`, so every page
  that loads them boots it (13 pages on 20 Nov, including the staff Board, print and checks pages).
- CI minutes trim: PR 730. Host prototypes: PR 729. Both touch workflows: Lisa only.

## Built since (20 Nov 2026)
- CI minutes trim, first cut: PR 730 (`claude/priv-move-ci-trim`). Browser suite on pull requests, nightly and by hand;
  no plain push; main no longer runs it twice; gate and lint once per pull request push. About 17% fewer minutes.
- Host prototypes: PR 729 (`claude/priv-move-host-prototypes`). Cloud Run container and a switched-off deploy workflow,
  plus Cloudflare notes (`docs/priv-move/HOST-A1-CLOUD-RUN.md`, `HOST-A2-CLOUDFLARE.md` in that PR).
- Guard fixture rule: PR 495, merged.

## Left to build (needs Lisa's choices first)
### A. The private-repo CI cut
Measured on 12 Nov: about 53,000 runner-minutes per 30 days; PR 730 takes that to about 44,000. A private repo gets
about 2,000. Two routes, structurally different, so nothing more is built until Lisa picks:
- One combined check job (lint + gate checker + privacy guard + the no-browser specs) that runs only once a pull request
  carries the merge-ready label, plus the nightly full run. Each job is billed as at least a minute, so four small
  workflows per push cannot fit; one job can.
- A runner on the Steward's box. Check GitHub's billing page first: a per-minute charge for self-hosted runners was
  announced for 2026 and may count toward the allowance.
`tests/mocked/ci-guards.spec.js` pins the required check name and the private-repo rules: read it before any change.

### B. Before any host switch
- `<link rel="manifest">` needs `crossorigin="use-credentials"` behind a login wall, and the service worker must cope
  with a login redirect. Test on a protected Cloudflare preview.
- Pages with no Google sign-in (`marketplace/privacy.html`, `cdhub/staff/guest/`, `cdhub/staff/inspect/`, staff-code
  use of `cdhub/staff/` and `cdhub/checks/`) must stay reachable. Print QR cards builds links from the address it is
  opened at.
- Cloudflare pull-request previews are public today and serve `config.js`. Switching on the preview access policy
  closes that and is undoable.

### C. Later PRs for Lisa's card (not this job)
1. `privateConfig.dryRun: false` (own PR). The CD Hub "one key in this browser" test must then allow the second key.
2. Remove real values from `config.js`. Keep the never-read drive entry there: on a device's first visit the private
   values arrive a moment after the page starts. `DashConfigLoader.ready` is the hook if a page must wait.
3. Bump `CACHE` in `sw.js` when `config.js` or `auth.js` change on the live site.

## Known test noise (seen on untouched main too, under 4 workers)
- `fold.spec.js` "home: every fold button..." and `every-click.spec.js` "./#/bin" fail on main under load. Not from this job.

## A point to settle before dry run is switched off
The loader trusts a My Drive file because the signed-in person owns it. So a different person who signs in can supply
their own file for their own session (for example their own address as `money.owner`). They still only reach what Drive
already shares with them, and the rails still hold, but the Money Hub "for Lisa only" screen is a looks-only gate and
would let them past. If that matters, keep `money.owner` in `config.js`, or trust the domain-only shared drive alone.

## Not checked
- The loader against real Drive (only the pretend Drive). In particular `corpora=allDrives` search and the
  `domainUsersOnly` restriction on a real shared drive.
- The privacy guard DENY rule (the denylist is a CI secret).
