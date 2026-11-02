# lint.mjs - house lint for the static dashboard

Plain Node 22, no packages. Scans tracked `.html .css .js .mjs .yml` files (skips `node_modules`, `tests/fixtures/`, `docs/`, `*.min.js`).

```
npm run lint                                  # same as: node tools/lint/lint.mjs
node tools/lint/lint.mjs --all                # print every finding, known ones too
node tools/lint/lint.mjs --selftest           # planted-fault control cases; must exit 0
node tools/lint/lint.mjs --update-known       # rewrite known.json from today's findings
```

Rules: `DUP-ID`, `IMG-ALT`, `UNCLOSED` (HTML); `COLOUR` (colour literal not defined in `tokens.css`; skips `tests/`, `tools/`);
`CONSOLE-LOG` (shipped page code only); `TRAILING-WS` (all scanned files); and for `.github/workflows/*.yml`:
`WF-PIN` (`owner/repo@<40-hex sha> # vX`), `WF-PERMS` (top-level `permissions:` with only `contents: read`),
`WF-TIMEOUT` (every job has `timeout-minutes:`), `WF-CONCURRENCY` (top-level `concurrency:`).

**Baseline.** `known.json` maps `"RULE|file"` to the number of findings allowed today. The run exits 1 only when a count goes
above its known number, and prints those findings. A count that has dropped prints a hint to lower it. WF-* rules have no
baseline entries on purpose: workflows must pass them outright.
