async function settle(target) {
  const loc = typeof target.locator === 'function' && typeof target.evaluate === 'function' && !target.mouse ? target : target.locator('body');
  await loc.evaluate((e) => Promise.all([e, ...e.querySelectorAll('*')].flatMap((n) => n.getAnimations())
    .filter((a) => a.effect && a.effect.getComputedTiming().iterations !== Infinity)
    .map((a) => a.finished.catch(() => {}))));
}

module.exports = { settle };

