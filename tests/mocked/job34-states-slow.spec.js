const { test, expect, HUBS, SHEETS, DRIVE, fixture } = require('../fixtures/job34/load');
const H = fixture('states', 'hubs.json');
const HOLD = 3000;

test.describe.configure({ timeout: 60_000 });

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
  const orig = page.route.bind(page);
  page.route = (re, fn, o) => orig(re, async (route) => { if (/googleapis\.com/.test(route.request().url())) await handler({ fallback: () => {} }); return fn(route); }, o);
  return seen;
}
const showsLoading = (hub, s) => !!s && (s.busy || s.signInDisabled || new RegExp(H[hub].loading).test(s.text));

const NO_LOADING = {};

for (const hub of Object.keys(HUBS)) {
  test(`${hub}: data calls held 3 s${NO_LOADING[hub] ? '' : ', a loading state shows'}, then the page loads`, async ({ page, guard }) => {
    const seen = await holdData(page);
    const t = Date.now();
    await HUBS[hub].open(page, guard);
    expect(seen.t0, `${hub} made no data call`).toBeGreaterThan(0);
    expect(Date.now() - t, `${hub} loaded before the hold ended`).toBeGreaterThanOrEqual(HOLD - 200);
    if (!NO_LOADING[hub]) expect(showsLoading(hub, seen.snap), `${hub}: nothing says it is loading: "${seen.snap && seen.snap.text.slice(0, 200)}"`).toBe(true);
  });
}

