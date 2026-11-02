# JOB 35 audit: accessibility and speed (30 Oct 2026, mocked data)

Method: axe-core (WCAG 2.2 AA tags) on every view at 1280px and 390px; buttons/links under 24px; first load with pretend
Google, Drive and Sheets (requests, bytes, first paint, layout shift, long tasks). First half by JOB 35.2, second half by
JOB 35b (PR #212). Live site UNVERIFIED (JOB 6).

## Accessibility

| Page | View @ width | Rule | Count | Severity | File:line | Owner | Action | Status |
|---|---|---|---|---|---|---|---|---|
| cdhub | shape, areas, litters, buyers (+ vet in CI) @390 | scrollable-region-focusable | 6 (9 in CI) | serious | cdhub/index.html (14 `.scroll` boxes) | JOB 35 scope | FIX HERE | FIXED in PR #214 |
| factory | all @1280 and @390 | empty-table-header | 1 | minor | factory/index.html:1258 | JOB 32 | FIX-REQUEST: `<th></th>` → `<th>Health</th>` (attribute alone does not satisfy axe; tested) | FIX-REQUEST |
| home, factory, food, marketplace | several | links/checkboxes under 24px (17px inline links, 18px checkboxes) | n/a | none | various | n/a | none | KNOWN: WCAG 2.5.8 inline and spacing exceptions; axe target-size passes |
| money | money, e/TESTCO @390 (CI fonts) | scrollable-region-focusable | 2 | serious | money/index.html (11 `.scroll` boxes) | JOB 35 scope | FIX HERE | FIXED in PR #212 |
| studio, marketplace, privacy, home, food | every view, both widths | none | 0 | n/a | n/a | n/a | n/a | CLEAN |

## Speed (first load, own files, mocked)

| Page | Requests | Bytes | First paint | Layout shift | Long task |
|---|---|---|---|---|---|
| home | 8 | 277 KB | 184-216 ms | 0 | 0 |
| cdhub | 7 | 211 KB | 176-196 ms | 0.001-0.005 | 0 |
| factory | 7 | 205 KB | 100-160 ms | 0 | 0 |
| food | 7 | 102 KB | 96-192 ms | 0 | 0 |
| marketplace | 7 | 161 KB | 260-276 ms | 0 | 0 |
| money | 8 | 163 KB | (35b) | 0 | 0 |
| studio | 7 | 300 KB | (35b) | 0 | 0 |
| privacy | 3 | 14 KB | (35b) | 0 | 0 |

Speed findings:
- sw.js kept only 3 of 6 hubs for offline: FIXED in PR #215 (cache v5).
- `defer` on config/toolkit/auth: NOT SAFE (inline page scripts run before deferred scripts and depend on them). KNOWN.
- Fonts already `display=swap`; studio images carry width/height; marketplace/studio thumbs already `loading="lazy"`. No change.
- home loads money/core.js (32 KB) on every visit: KNOWN, JOB 4 to judge if Home needs it at first paint.

## Keyboard

The cdhub scroll boxes were the only keyboard trap axe found. focus-and-headings, access-basics and every-view-access specs
are green on main. A full manual tab walk per view was not done in 35.2: parked for JOB 35.3.

## Guards

- tests/mocked/job35-a11y-budget.spec.js (home, cdhub, factory, food) and tests/mocked/job35b-a11y-budget.spec.js (PR #212).
