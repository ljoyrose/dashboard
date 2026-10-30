# Pre-send checker: box run kit (SYS-CD)

Run on SYS-CD's own box before any paid builder prompt is presented. Real inputs never enter this repo.

## 1. One-time set-up
```sh
git clone https://github.com/ljoyrose/dashboard.git && cd dashboard   # code only
mkdir -p ~/presend-data/data ~/presend-data/sends                     # data: OUTSIDE the repo
export PRESEND_DATA=~/presend-data                                    # the checker refuses a folder inside the repo
python3 tools/presend/prompt-lint.py --selftest                       # invented inputs only; must end "0 silent"
python3 tools/presend/inputs-gate.py --selftest                       # must say "selftest: OK"
```
Fill `$PRESEND_DATA` from Drive (the checker run log lists which Drive file fills which):
`PROMPT-LESSONS.csv` · `APPS.csv` (columns: tools/presend/APPS.example.csv) · `data/CK56-PATTERN.txt` · `data/OB-LESSON-MAP.csv` · `data/<inputs>.json` · `data/<app document>.md` · `data/<snags file>.md` · `data/<roadmap file>.md`.
With the real lessons in place, run `--selftest` again: it then also checks every real lesson row.

## 2. Each send
1. Put the exact send text in `$PRESEND_DATA/sends/<APP>-<P>-v<N>.txt`: the same words Copy will take from the prompt doc (when the doc holds several sections P1, P2 …, just that section). The stamp hashes the text with blank lines and spaces at the start and end removed, and so does Copy. A newline at the end does not matter; any change inside the text does.
2. Write `<same name>.meta.json` beside it:
```json
{"app":"<APPS.csv key>","send_id":"P1","clickup_task_id":"<Sends task id>",
 "clickup_pulled_at":"<ISO time>","register_read_at":"<ISO time>",
 "credit_estimate":[3300,5900],"ledger_stop":8850,
 "fold_in_decided":["<snag ids with an in/out decision>"],
 "dashboard_lines":["<line for the Dashboard>"]}
```
3. Run:
```sh
python3 tools/presend/prompt-lint.py --presend "$PRESEND_DATA/sends/<APP>-<P>-v<N>.txt"
echo $?            # 0 = READY, 1 = NOT READY
```

## 3. Reading the result
One line per check (`PASS`, `FAIL`, `NOT RUN`, `N/A`), then the last line:
- `READY · stamp sha256:<64 hex>`: every check is PASS or N/A.
- `NOT READY · <n> FAIL, <m> NOT RUN · no stamp`: fix each FAIL, supply what each NOT RUN needs, then run again.

**NOT RUN is never PASS.** A check that could not run (a missing lessons, snags, ledger, inputs or pattern file) blocks READY exactly like a FAIL. Never write READY by hand, and never tell anyone a check passed when it did not run.

## 4. Where the stamp goes
- Run report: `$PRESEND_DATA/runs/RUN-<draft>-<YYYYMMDD-HHMM>.md`. Its `presend:` line is the stamp:
  `presend: READY sha256:<hash of the exact text> <DD Mon YYYY> UK`.
- Engine request: when the meta names `clickup_task_id`, `$PRESEND_DATA/outbox/stamp-<draft>-<time>.json` (`kind: stamp`). It stays in the outbox until the engine has a stamp handler (docs/presend/ENGINE-STAMP-PROPOSAL.md). Until then the line is put on the Sends task as a comment by the usual route. This session posts nothing.
- The Factory Send gate reads the last `presend:` line on the task. Copy shows only for READY dated today (UK). When clicked, Copy hashes the text and refuses it if the hash differs from the stamp.
- Check a stamp against a file at any time (exit 0 only when READY and the hash matches):
```sh
python3 tools/presend/prompt-lint.py --verify "$PRESEND_DATA/sends/<draft>.txt" "<the presend: line>"
```
Any edit to the text changes the hash: run the checker again.

## 5. Rules
- Runs, stamps, send texts, lessons, inputs and regression sets are private. They never go in the repo; the privacy guard's PATH rule blocks them.
- A stamp is good for the UK day it was written. The next day the gate says "Checker stamp not today".
- FRESHNESS fails 6 h after the code read, ClickUp pull or register read. INPUTS-GATE fails 6 h after the inputs file check.
