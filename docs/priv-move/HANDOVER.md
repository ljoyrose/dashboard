# JOB PRIV-MOVE.1 handover (12 Nov 2026) - successor: PRIV-MOVE 2

Read `RUN-PROGRESS.md` first. Private detail (scan, decision pack, link list, slips) is on Drive in 00 AI Commons > CHANGES.

## Open PRs from this job (none merged; all for Lisa's merge card)
- Loader: branch `claude/sweet-johnson-13bvh1`. Ships in dry run. Touches `config.js` and `auth.js`, so every page boots it.
- Guard fixture rule: PR 495, branch `claude/priv-move-guard-fixtures`. Touches the privacy guard: Lisa only.

## Left to build (in this order)
### A. CI minutes trim (scope 2) - workflow PR, open and do not merge
Measured on 12 Nov (runner minutes, counts only):
- 3,682 runs in 7.87 days; about 14,000 runner-minutes in that time; about 53,000 per 30 days at this pace. Private allowance: 2,000.
- Browser suite: 24.8 minutes median per run. It runs in `tests.yml` on every push AND again in `pages.yml` (gate) on every
  push to main. Together about 78% of all minutes. A cancelled run still burns what it ran (one sampled: 10 minutes).
- Small jobs (lint, gate checker, privacy guard, fix-needs-test): about 0.2 minutes each but billed as 1; about 2,800 runs a
  week. Gate checker and privacy guard run on both `push` and `pull_request` for the same commit.
- Already in place: `tools/ci-local/docs-only.sh` skips the browser on pushes and PRs when the repo is private
  (`REPO_PRIVATE`), and `pages.yml` skips its gate when private. `tests/mocked/ci-guards.spec.js` pins this behaviour and
  the required check name: read it before changing a workflow.
- A full browser run on every PR cannot fit: about 650 merges a month x 25 minutes. Design that fits (about 1,400 a month):
  1. One "quick checks" job (lint + gate checker + privacy guard + the two no-browser specs) instead of four workflows.
  2. Run it on `pull_request` only (drop the duplicate `push` runs), with `cancel-in-progress` per PR, and skip it for
     docs-only changes. When private, run it only once the PR carries the merge-ready label.
  3. Browser suite: `pull_request` (while public), a nightly run on main only when main changed, and by hand. Never on a
     plain branch push. Keep the job name: branch protection requires it.
  4. Optional per-area filter for PR runs: only the specs that mention the changed hub folder; anything shared
     (`config.js`, `auth.js`, `toolkit.js`, css, `tests/support`, package files) runs everything. Nightly stays full.
  5. Measure after from the Actions API on the PR's own runs, and put before/after in the PR.
- Alternative for Lisa (decision pack, decision 2): a self-hosted runner on the Steward's box, no minute limit.

### B. Host prototypes behind flags, dry run only (scope 4)
- A1: `Dockerfile` (static files only, the same list as the `cp -r` line in `pages.yml`) and a Cloud Run deploy workflow
  with Workload Identity (no keys), disabled unless a repo variable says ON. No GCP change.
- A2: notes only. The Cloudflare Pages build already exists (`tools/build-site/build.sh`). Check: Access on the production
  pages.dev address, leaving chosen paths open, the 500 builds a month limit.
- Both hosts sit behind a login wall, so check: `<link rel="manifest">` needs `crossorigin="use-credentials"`, and the
  service worker must cope with a login redirect.
- Pages with no Google sign-in (`marketplace/privacy.html`, `cdhub/staff/**`, `cdhub/checks/`) must stay reachable for
  people outside the business. Print QR cards builds its links from the address it is opened at.

### C. Later PRs for Lisa's card (not this job)
1. `privateConfig.dryRun: false` (own PR). The CD Hub "one key in this browser" test must then allow the second key.
2. Remove real values from `config.js`. Keep the never-read drive entry there: on a device's first visit the private
   values arrive a moment after the page starts. `DashConfigLoader.ready` is the hook if a page must wait.
3. Bump `CACHE` in `sw.js` when `config.js` or `auth.js` change on the live site.

## Known test noise (seen on untouched main too, under 4 workers)
- `fold.spec.js` "home: every fold button..." and `every-click.spec.js` "./#/bin" fail on main under load. Not from this job.

## Not checked
- The loader against real Drive (only the pretend Drive). In particular `corpora=allDrives` search and the
  `domainUsersOnly` restriction on a real shared drive.
- The privacy guard DENY rule (the denylist is a CI secret).
