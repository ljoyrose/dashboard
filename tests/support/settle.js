// Wait until every CSS transition and animation on an element and inside it has finished, so a check reads the final
// value and never a frame in the middle of a transition (the bottom-tab colour bar widens over .15s on hover; under four
// workers a fixed wait is sometimes not enough). Asking for getAnimations() makes the browser apply a pending hover first,
// so a transition that has only just been triggered is waited for too. Endless animations (spinners) are left out.
// Use: await el.hover(); await settle(el);   (el is a Playwright locator; a page settles its whole body)
async function settle(target) {
  const loc = typeof target.locator === 'function' && typeof target.evaluate === 'function' && !target.mouse ? target : target.locator('body');
  await loc.evaluate((e) => Promise.all([e, ...e.querySelectorAll('*')].flatMap((n) => n.getAnimations())
    .filter((a) => a.effect && a.effect.getComputedTiming().iterations !== Infinity)
    .map((a) => a.finished.catch(() => {}))));
}

module.exports = { settle };
