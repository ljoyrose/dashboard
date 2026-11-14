# RUN-PROGRESS · JOB WEB-ESTATE TRAFFIC (13 Nov 2026)

Aliases only. No traffic numbers here: they load at run time, behind the sign-in, from the private RR_WEB-ESTATE sheet.

## Stage 1 · code (done)
- estate/traffic.js 1.0.0: pure logic. Traffic tab contract (key, source, period, visits, used_gb, quota_gb, updated_uk, note),
  amber from 80%, red from 95%, stale after 2 days, Lisa-only setup step per host. No upgrade prompt.
- estate/index.html: reads the optional Traffic tab (same read-only path as Shops and Keywords). Every site, shop, funnel and
  app row shows Use (number and %), a framed bar, Visits, period · source · updated, and a "Traffic details" fold.
  No row or no tab = "stats not connected" plus the Lisa-only step. Client view hides it. Example rows carry invented
  traffic (80%, 0%, 96%, not connected).
- Tests: tests/estate/traffic.test.js (10), tests/mocked/estate-traffic.spec.js (9: desktop and 360px).

## Stage 2 · verify (next)
- Full mocked + phone suite, privacy scan of the range, push, PR, click-through on a local serve of the branch.
- Done: bar colours moved to palette swatches (amber was rendering brown). Click-through 8/8 PASS, screenshots in shots/.
  PR 521 open, CI pending. Slip: AA_WEB-ESTATE-TRAFFIC_2026-11-13-0832__CLAUDE-CODE.md.
- Correction: a Cloudflare Pages preview exists but is behind Cloudflare Access; preview click-through is Lisa-only. CI privacy guard (real denylist) green.
