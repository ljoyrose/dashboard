# Host prototype A1: Google Cloud Run behind Identity-Aware Proxy (IAP)

Status: PROTOTYPE, switched off. Nothing deploys. No Google Cloud project, no DNS and no repo setting was touched.

## What is in the repo
- `deploy/cloud-run/Dockerfile` and `nginx.conf`: a small web server holding only the published site files.
- `.github/workflows/deploy-cloud-run.yml`: hand-started only. The job is skipped unless the repo variable
  `CLOUD_RUN_DEPLOY` is `ON`. Even then it is a dry run (build and check the container on the runner, deploy nothing)
  unless the person starting it unticks "Dry run".
- No stored key. A real deploy signs in with Workload Identity: GitHub issues a short-lived token for the run and Google
  trusts it for one named service account.

## Checked on 20 Nov 2026 (Google's own documents)
- IAP can be switched on directly on a Cloud Run service, with no load balancer. Cloud Run release notes list it as
  generally available from 13 Mar 2026; one IAP page still carries an older "Preview" banner.
- Google does not charge for IAP itself. A small static service normally stays inside Cloud Run's free tier, but the
  project must have billing switched on.
- IAP covers the whole service. There is no "leave this path open" setting.

## What that means for this site
- Everyone who opens any page needs a Google account on the allow list, and signs in twice on a new device: once at
  IAP's wall, then the dashboard's own Google sign-in for Drive.
- Pages meant for people with no Google sign-in cannot live on this service: `marketplace/privacy.html` (linked from
  the eBay and Etsy developer accounts), `cdhub/staff/guest/`, `cdhub/staff/inspect/`, and staff who open
  `cdhub/staff/` or `cdhub/checks/` with a staff code. They would need a second, public service or another home.
- The phone app (manifest and service worker) is fetched without the IAP cookie unless the manifest link carries
  `crossorigin="use-credentials"`. Not changed here; it must be tested behind the wall before any switch.
- The site is served from the root of the new address (as on Cloudflare), not under `/dashboard/`. The test suite
  already runs both ways (`SITE_BASE=/`).

## Lisa's steps if A1 is chosen (bots prepare everything else)
1. Google Cloud console: create a project, switch billing on.
2. BOT gives the exact commands for: Artifact Registry and Cloud Run APIs on, one service account for deploys, one
   Workload Identity pool and provider limited to this repo, and the IAP allow list (your account first).
3. Repo > Settings > Secrets and variables > Actions > Variables: add `GCP_PROJECT`, `GCP_REGION`,
   `CLOUD_RUN_SERVICE`, `GCP_WIF_PROVIDER`, `GCP_SERVICE_ACCOUNT`, then `CLOUD_RUN_DEPLOY` = `ON`. These are names,
   not keys.
4. Actions > "Deploy to Cloud Run (prototype, off)" > Run workflow with Dry run ticked. Green = the container builds.
5. Run it again with Dry run unticked. Open the run.app address it prints: Google's sign-in wall should appear.
6. Google Cloud console > APIs and services > Credentials > the dashboard's sign-in client: add the run.app address
   under "Authorised JavaScript origins". Without this the dashboard's own sign-in fails on the new address.

## Checked in the session (20 Nov 2026)
- The container was built and run locally from the real site files: home page, `config.js`, `cdhub/`, `cdhub/staff/`
  and `marketplace/privacy.html` answer; `tests/`, `docs/`, `tools/`, `.github/`, `.git/config` and `package.json` all
  answer 404; it runs as a non-root user; image about 95 MB.

## Not checked
- The workflow itself has never run (it only exists on a branch, and hand-started workflows run from main).
- Signing in with Workload Identity and the deploy step (`gcloud run deploy --source ... --iap`) against a real project.
- The base image is not pinned to a digest yet (see the note in the Dockerfile).
