# gate.mjs - App Factory gate checker

Rebuild of the missing `gate.mjs` (job E16-GATE, 16 Oct 2026). Node 18+, no packages.

```
node tools/gate/gate.mjs --list                                  # the unified gate list + open conflicts
node tools/gate/gate.mjs --selftest                              # control cases: the tool must catch known-bad input
node tools/gate/gate.mjs --card card.json --to 3->4              # PASS / FAIL / WAITS-LISA per required gate
node tools/gate/gate.mjs --card card.json --to 3->4 --dry-run    # same report, always exits 0
```

Exit code is 0 only when every required gate is PASS. FAIL, WAITS-LISA and bad input all exit 1.

**Transitions:** `0->1` ... `7->8`, and the after-8 routes `8->rescue`, `rescue->slot`, `8->lock`, `8->recycle`.

**Card (JSON):**
```json
{ "card_id": "X", "ck45_pending": 0, "ck50_open_obligations": 0,
  "gates": { "Lock": { "verdict": "GO", "stamped_by": "lisa" } } }
```
Gate names on a card may be the framework name or any old name (`G1`, `Gate 0`, `Design 4->5`, `G0-CONCEPT` ...).

**Conflicts:** `gates.unified.json` lists conflicts between the four gate sources. A gate with an OPEN conflict reports
`WAITS-LISA` and is never auto-passed. When Lisa rules, change that conflict's `status` to `RESOLVED` (data only).

This tool reads no register and writes nothing. It does not replace `GATES.csv`; changes to that file are proposals in the job slips.
