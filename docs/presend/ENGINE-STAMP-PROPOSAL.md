# AF-ENGINE: post the presend stamp on the Sends task (proposal, NOT deployed)

Written 23 Oct 2026. Nothing here is pushed to AF-ENGINE. Lisa approves, then a session with engine access adds it.

## What exists
- The checker (`tools/presend/prompt-lint.py --presend`) writes `outbox/stamp-<draft>-<time>.json` when the meta file names `clickup_task_id`:
  `{"kind":"stamp","taskId":"<ClickUp id>","line":"presend: READY sha256:<64 hex> 23 Oct 2026 UK","sha256":"…","ready":true,"at":"…","by":"presend checker"}`
- The Factory page already drops request files into AF › requests (`1Z1Iuc_rRFq7cy12ELM0seZ-onpCSfDQ2`, kinds problem, link, factory, check, act). AF-ENGINE turns them into ClickUp writes on its 15-minute run. The ClickUp connector is never used for this.
- The Send gate (factory/index.html `presendOf`) now reads the last `presend:` line in the task description or comments, needs READY dated today, and Copy refuses text whose SHA-256 differs from the stamp.

## What the engine needs (one handler)
1. On a request file with `kind: "stamp"`: check `taskId` is a task in the Sends list and `line` matches `^presend: (READY sha256:[0-9a-f]{64} .+|NOT READY .+)$`. Otherwise move the file to `failed/` and log it.
2. Post `line` as a comment on that task (comments, because the engine cannot edit descriptions yet). Do not touch status or fields.
3. Log `stamp <taskId> <READY|NOT READY> <first 12 of sha>` in af-log as for other kinds.

## Then
- The checker gets `--to-outbox`, which copies the stamp file into AF › requests (Drive upload). It stays off until the handler is live, so no request lands that the engine cannot read.
- Sends tasks drop the typed `inputs-gate: PASS`; the checker runs inputs-gate itself (INPUTS-GATE line).

## Test before turning it on
TEST- Sends task, a NOT READY stamp file, then a READY one: the card shows "Presend NOT READY", then Copy. Edit one character of the prompt doc: Copy says the text is not the one the checker stamped.
