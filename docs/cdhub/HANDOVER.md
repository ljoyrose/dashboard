# JOB CDH-HT.1 · handover

For whoever touches the CD Hub click-crawl next. Rewritten after each stage. Last rewrite: 20 Nov 2026 (second session).

## In one line

The hub walk and the hover test run again on the hub as it is today, on desktop and on a 360px phone, with no test switched off. Three faults they found are fixed and merged. Nothing is waiting for a successor.

## PRs (all on `ljoyrose/dashboard`, base `main`)

| PR | State | What |
|---|---|---|
| 506, 512, 515, 516, 641 | merged | first session: the kit and its first fixes |
| 718 | merged 20 Nov | Compliance: the "choose a rule" list shows the grey fill on hover |
| 725 | merged 20 Nov | Sign out stops a read that is still under way (it used to leave an error card or a blank page) |
| 726 | merged 20 Nov | The round at 360px: the "add a dog" list stays inside the screen |
| 715 | see `RUN-PROGRESS.md` | the walk itself: opens deep screens by address, every wait capped, one walk per start screen, hover test stall fixed |

## What was wrong with the walk (all in the test kit, none in the hub)

1. It replayed taps to get back to a screen one tap in, and got lost. Now a screen with its own address (`#/dogs/mar`, `#/today/adults`) is opened by that address.
2. It recognised a control partly by its id. The shared fold kit gives controls a made-up id that is renumbered at every redraw (`hfp-31`, then `hfp-71`), so controls "vanished". The number is now ignored.
3. It read a screen before the hub's later tables had arrived; the hub then drew the screen again and the walk's marks went with the old drawing. It now waits for the later tables, and when a control has gone it finds it again.
4. Nothing in `crawl()` had a time limit. Every question to the page and every wait now has one; a tap the page never answers is reported as ERROR and the walk goes on.
5. "Nothing happened" (DEAD) is only believed on a second tap from a fresh load.
6. The hover test waited for ever for a control the redraw had removed. Same cure. It takes about 25 seconds.

## How the hub walk is laid out now

- One test per start screen: "the hub, start screen N". Start screens are read from the page (bottom bar and More list), never listed by hand. `SLOTS` in `cdhub-crawl.spec.js` is only the most there may be (16); today there are 11 and the spare slots skip. If the hub ever offers more than 16, slot 1 fails with "raise SLOTS".
- A screen that is another walk's start screen is not walked twice.
- Old addresses of switched-off screens and Sign out have their own short test.
- Each walk writes `test-results/cdhub-crawl/hub-<size>-<slot>.json`; `tools/cdhub-click-map/make.js` adds them up and counts a shared screen once.

## How to run things

The live site is Cloudflare Pages (the site sits at the root). Run the walk in that layout:

```bash
SITE_BASE=/ npx playwright test --project=mocked cdhub-crawl cdhub-hover --workers=1
```

```bash
node tools/cdhub-click-map/make.js
```

In a cloud session the pinned Playwright browser is not installed: use a wrapper config that sets `launchOptions.executablePath` to `/opt/pw-browsers/chromium` (as `tools/ci-local/run-all.sh` does), and pass `--trace off`.

Switches: `CRAWL_LOG=<file>` one timed line per tap plus `LOST`, `FLAG`, `WAIT`, `ADDR`, `AGAIN`, `HUNG` lines; `CRAWL_DEBUG=1` says why a control was lost; `CRAWL_ROOTS=dogs,today`; `CRAWL_MAX=<n>`; `HOVER_LOG=1` times each screen of the hover test. `CRAWL_HUB` is gone: nothing is switched off.

## Things that will bite

1. Other sessions merge CD Hub changes all day (about 100 commits a day). Merge `origin/main` in; never rebase a pushed branch, never force-push.
2. One Playwright job at a time in one container: two at once gives false findings.
3. The live site is behind a sign-in gate. A cloud session cannot and must not walk it. The walk runs a copy of the repo's pages with pretend Google and invented dogs.
4. The "load within 10%" tests for other hubs (factory, marketplace, money, studio) fail in a cloud container and pass in CI. Trust CI for those.
5. CI's fallback font is wider than a cloud container's. A 360px overflow can show in CI only (PR 726 was found that way). To see it locally, force a wide font (`*{font-family:"DejaVu Sans" !important}`) and look for what ends past 360px.
6. Breed Better's chips on the dog card keep their own hover look (thin coloured line, 8px corners). The hover test leaves them out (`OWN_LOOK`). Lisa's to decide.
7. The staff walk accepts `MAX` and `MIN` as box labels (the words on the thermometer).
8. A new `@regression` test must be listed under "Caught after merge" in `TESTS.md` or `ci-guards` fails. Two PRs adding a row there on the same day conflict: keep both rows.
9. The fixture set's "today" is 10 Mar 2026 (`tests/support/cdhub27.js`).

## Not covered (known gaps)

- Enquiries and Admin are not in the bottom bar or More list for the invented data set, so they are not start screens and are not walked.
- Filled-in save forms on the dog card are only pressed empty.
- The two "Set up this phone" boxes on the staff page (102 of 104).
- Repeated calendar days on the Temperatures page are sampled (first two and last of each kind).
- The live site with a real sign-in and real data: Lisa's phone check only.
