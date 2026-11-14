# AA_WEB-ESTATE-TRAFFIC_2026-11-13-0832 · JOB WEB-ESTATE TRAFFIC 13 Nov

Session: Code cloud. Configured model Opus 5.5; effort was set low, below the usual for a job this size (flagged at start, carried on).
Repo: ljoyrose/dashboard, branch claude/nice-gates-7n1wq6, PR 521 (open, not merged). Aliases only in this file.

## DONE
1. estate/traffic.js 1.0.0 (pure): Traffic tab contract, amber 80%, red 95%, stale after 2 days, Lisa-only setup per host.
2. estate/index.html: every site, shop, funnel and app row shows Use (GB of quota and %), a framed bar, Visits,
   period · source · updated, and a "Traffic details" fold. No stats = "Traffic stats not connected" + Lisa-only step.
   Read-only, behind the existing sign-in, hidden in client view. Bar colours are palette swatches (amber never brown).
3. Example rows carry invented traffic (80%, 0%, 96%, not connected) until the sheet id is in config.js.

## TESTS
- node --test tests/estate/*.test.js: 158/158 (traffic.test.js 10/10).
- tests/mocked/estate-traffic.spec.js: 9/9 (0%, 80%, 96%, not connected, no tab, renamed header; desktop and 360px; signed out).
- All estate browser specs: 37/37. Lint: 40 known, 0 new.
- Full mocked + phone suite: runs in CI on PR 521 (local run too slow for this box).

## CLICK-THROUGH (branch served locally)
The Cloudflare Pages preview exists (branch preview for this PR) but sits behind Cloudflare Access login, so this session
cannot open it. Lisa-only: open the PR's "Branch Preview URL" > estate > All, sign in, open each row's Traffic details.
config.js unchanged, so the page shows the example rows. 8/8 detail clicks PASS (4 web rows x desktop and 360px).
Screenshots: shots/traffic-{desktop,360}-{all,example-com,shop-example-org,app-example-test,funnels-example-net}.png.

## OPEN (Lisa-only)
1. The RR_WEB-ESTATE sheet and engine are not installed (config.js estate.sheetId is empty). Until then no real site shows.
2. Add a Traffic tab with header: key, source, period, visits, used_gb, quota_gb, updated_uk, note.
3. SITE-A (SiteGround nameservers, SiteGround CDN, free 10 GB a month): SiteGround has no read-only stats API.
   Route: type used_gb, visits, quota_gb 10, period, updated_uk weekly from Site Tools > Speed > CDN, and Statistics > Traffic.
4. Cloudflare-hosted sites: read-only token (template "Read analytics and logs") in Script Property ESTATE_CF_TOKEN.
   Shopify: read_reports app token in ESTATE_SHOPIFY_TOKENS. GA4 visits: no token, ESTATE_GA4_PROPERTIES.
5. The engine (private) needs a writer for the Traffic tab from those Script Properties. Not in this repo; not done here.

## BLD SCHEMA RECOMMENDATIONS
n/a (no CD Hub change).

Tools made: none. Library only (estate/traffic.js).
