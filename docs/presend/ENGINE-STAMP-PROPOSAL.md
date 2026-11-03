# AF-ENGINE: post the presend stamp on the Sends task (approved, NOT deployed)

Written 23 Oct 2026. **Approved 30 Oct 2026 by Lisa's default A** (go ahead as designed once the Factory Send gate PR merges). Nothing here is pushed to AF-ENGINE by this repo: a session with engine access (the Mac route) pastes it in.

## Ready to paste
`tools/presend/stamp-handler.gs` holds `stamp_` and the one wire-in line for `pickupRequests_`. Tests: `tests/mocked/presend-stamp-handler.spec.js` (pretend ClickUp; a READY and a NOT READY stamp post one plain comment; 10 bad requests throw before any write; a non-Sends or missing task is refused).
The comment is posted with `cu_` directly, not `applyOp_`'s `comment` op: that op adds a "Claude: " prefix, and the Send gate only reads lines that start `presend:`.

### Deploy steps (Mac route)
1. Paste `stamp-handler.gs` into the engine project; add `else if (r.kind === 'stamp') stamp_(s, r);` in `pickupRequests_` before the final `else ask_(s, r);`.
2. Run the TEST below on a TEST- Sends task.
3. Only then switch on the checker's copy to AF › requests (`--to-outbox`, not built yet).

## What exists
- The checker (`tools/presend/prompt-lint.py --presend`) writes `outbox/stamp-<draft>-<time>.json` when the meta file names `clickup_task_id`:
  `{"kind":"stamp","taskId":"<ClickUp id>","line":"presend: READY sha256:<64 hex> 23 Oct 2026 UK","sha256":"…","ready":true,"at":"…","by":"presend checker"}`
- The Factory page already drops request files into AF › requests (the folder id is in config.js; kinds problem, link, factory, check, act). AF-ENGINE turns them into ClickUp writes on its 15-minute run. The ClickUp connector is never used for this.
- The Send gate (factory/index.html `presendOf`) now reads the last `presend:` line in the task description or comments, needs READY dated today, and Copy refuses text whose SHA-256 differs from the stamp.

## What the engine needs (one handler)
1. On a request file with `kind: "stamp"`: check `taskId` is a task in the Sends list and `line` matches `^presend: (READY sha256:[0-9a-f]{64} .+|NOT READY .+)$`. Otherwise throw: `pickupRequests_` renames the file `FAILED-`, logs it and raises an incident, as for every kind. The handler also checks the `ready` flag and `sha256` field agree with the line.
2. Post `line` as a comment on that task (a comment, so every stamp stays visible in order and the latest one wins). Do not touch status, fields or the description.
3. Log `stamp <taskId> <READY|NOT READY> <first 12 of sha>` in af-log as for other kinds.

## Then
- The checker gets `--to-outbox`, which copies the stamp file into AF › requests (Drive upload). It stays off until the handler is live, so no request lands that the engine cannot read.
- Sends tasks drop the typed `inputs-gate: PASS`; the checker runs inputs-gate itself (INPUTS-GATE line).

## Test before turning it on
TEST- Sends task, a NOT READY stamp file, then a READY one: the card shows "Presend NOT READY", then Copy. Edit one character of the prompt doc: Copy says the text is not the one the checker stamped.
