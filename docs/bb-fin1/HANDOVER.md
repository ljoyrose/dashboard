# HANDOVER: JOB BB-FIN.1

Rewritten after each stage.

- Branch (dashboard): claude/youthful-gates-6b4jct, calculator hardening. Further themes on claude/bb-fin-* branches.
- Branch (breed-better, private): claude/bb-fin-1, contract notes and go-live kit.
- Run the checks: `node --test tests/breed-better/*.test.js`, `node tools/bb-mutate/run.mjs`,
  `npx playwright test --project=mocked breed-better bb-inspect` (in a cloud session, point Playwright at /opt/pw-browsers/chromium).
- Next: gap audit against the spec (Drive, read-only), then gap fixes, contract test, go-live kit.
