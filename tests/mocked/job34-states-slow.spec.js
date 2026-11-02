// JOB 34 state matrix (group E): SLOW NETWORK, every hub. Every Drive and Sheets data call is held until 3 s after the
// first one. One second into the hold the page must show a loading state (its own "Reading…" wording, a busy marker or a
// disabled sign-in), and once the calls go through the hub opens normally (HUBS.<hub>.open, the same invented data).
const { test, expect, HUBS, SHEETS, DRIVE, fixture } = require('../fixtures/job34/load');
const H = fixture('states', 'hubs.json');
const HOLD = 3000;

test.describe.configure({ timeout: 60_000 });

// Hold every data call until HOLD ms after the first; one second in, note what the page shows.
async function holdData(page) {
  const seen = { t0: 0, snap: null };
  let release;
  const gate = new Promise((r) => { release = r; });
  const handler = async (route) => {
    if (!seen.t0) {
      seen.t0 = Date.now();
      setTimeout(async () => {
        seen.snap = await page.evaluate(() => ({
          text: document.body.innerText.replace(/\s+/g, ' '),
          busy: !!document.querySelector('[aria-busy="true"], .st-loading, .loading:not(.hidden)'),
          signInDisabled: [...document.querySelectorAll('[data-action="signin"], #signInBtn, #signinbtn')].some((b) => b.getClientRects().length && b.disabled),
        })).catch(() => null);
      }, 1000);
      setTimeout(release, HOLD);
    }
    await gate;
    return route.fallback();
  };
  await page.route(DRIVE, handler);
  await page.route(SHEETS, handler);
  // Routes the hub's own open() adds later (its pretend Sheets) answer first, so they wait at the same gate.
  const orig = page.route.bind(page);
  page.route = (re, fn, o) => orig(re, async (route) => { if (/googleapis\.com/.test(route.request().url())) await handler({ fallback: () => {} }); return fn(route); }, o);
  return seen;
}
const showsLoading = (hub, s) => !!s && (s.busy || s.signInDisabled || new RegExp(H[hub].loading).test(s.text));

// Hubs whose sign-in screen stays exactly as it was while the first data call is held (no loading state at all).
const NO_LOADING = { food: 'J34-F81', marketplace: 'J34-F82', factory: 'J34-F83', studio: 'J34-F84' };

for (const hub of Object.keys(HUBS)) {
  test(`${hub}: data calls held 3 s${NO_LOADING[hub] ? '' : ', a loading state shows'}, then the page loads`, async ({ page, guard }) => {
    const seen = await holdData(page);
    const t = Date.now();
    await HUBS[hub].open(page, guard); // the hub's own "loaded" check, after the hold
    expect(seen.t0, `${hub} made no data call`).toBeGreaterThan(0);
    expect(Date.now() - t, `${hub} loaded before the hold ended`).toBeGreaterThanOrEqual(HOLD - 200);
    if (!NO_LOADING[hub]) expect(showsLoading(hub, seen.snap), `${hub}: nothing says it is loading: "${seen.snap && seen.snap.text.slice(0, 200)}"`).toBe(true);
  });
}

// FIX-REQUEST J34-F81..F84: after Sign in is pressed and while the first data call is held, these hubs keep showing the
// signed-out sign-in screen unchanged (enabled Sign in button, no "Reading…", no busy marker) for the whole hold.
for (const [hub, id] of Object.entries(NO_LOADING)) {
  // DECISION NEEDED: fix the page (see FIX-REQUEST above) or accept it. OWNER: Lisa. BY 2026-11-06
  test.fixme(`${id} ${hub}: while data calls are held a loading state shows`, async ({ page, guard }) => {
    const seen = await holdData(page);
    await HUBS[hub].open(page, guard);
    expect(showsLoading(hub, seen.snap)).toBe(true);
  });
}
