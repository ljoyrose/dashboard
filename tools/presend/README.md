# Pre-send checker (tools/presend)

One command before any paid builder prompt is presented:

    export PRESEND_DATA=/path/outside/the/repo                   # every real file lives here (see Data)
    python3 prompt-lint.py --presend "$PRESEND_DATA/sends/<draft>.txt"   # reads <draft>.meta.json beside it

One plain line per check, then `READY` or `NOT READY`. Exit 0 only on READY. Anything that could not run says `NOT RUN` and blocks READY.

| Check | FAIL when |
|---|---|
| LESSONS | any FAIL row in PROMPT-LESSONS.csv trips |
| CK56 | an internal term is in the text (pattern in data/CK56-PATTERN.txt; NOT RUN without it) |
| FILESCOPE | the "Change no file other than" list, the files the items name, the scope-of-reading list and the "Re-read all N" count disagree; or a sign-out/log-out button is asked for by kind while another one lives in a file outside the list (APPS.csv ui_controls) |
| OOSCLASH | an item asks for something the out-of-scope line lists |
| FOLD-IN | an open snag (or roadmap) row on the same files has no in/out decision in the meta file; NOT RUN without the snags or roadmap file |
| FRESHNESS | code read (the prompt's "read live on ... UK time" line), ClickUp pull or register read is missing or over 6 h old |
| INPUTS-GATE | inputs-gate.py I1-I6 fail (I6: any value marked CARRIED from an older inputs file), or the inputs file is over 6 h old |
| COST | no credit estimate, or the ledger stop is not 1.5 x the top of it |
| CK51 | an Obligations row due at this send is OPEN/PART or its lesson fails; NOT RUN if the ledger is missing or a RULE row has no lesson that tests it (data/OB-LESSON-MAP.csv). Never PASS by quoting alone |
| CK57 | server code is added and the table register has no Role gate, or a table it reads has a blank/none gate; N/A only when no server code is added |
| NEWER-DRAFT | a higher -vN of the same draft is in the folder |
| DASHBOARD | the meta file has no Dashboard lines |

On READY the run report in `$PRESEND_DATA/runs/` carries `presend: READY sha256:<hash of the text, trimmed at both ends> <UK date>`. Any edit inside the text changes the hash: re-run. `--verify FILE "LINE"` is the Send gate's test (exit 0 only when the line is READY and the hash matches). If the meta file names `clickup_task_id`, a request file `$PRESEND_DATA/outbox/stamp-*.json` (`kind: stamp`) is written for the engine; it is not copied to the engine's request folder until the engine has a `stamp` handler (docs/presend/ENGINE-STAMP-PROPOSAL.md).

Other modes: `prompt-lint.py PROMPT.txt` (lessons only), `--selftest` (lesson controls + pre-send controls on invented text; needs no data, and also checks the real lessons file when `PRESEND_DATA` is set), `--regress`, `--split` (Drive bundles PROMPT-REGRESSION-SET*.txt into regression/*.txt + .expect; `+presend` in an .expect switches on CK56/FILESCOPE/OOSCLASH for that case).

## Data (never in this public repo)
Only code lives here. Every file with real content (app names, prompt texts, lessons, app documents, inputs, run reports, stamps) lives in the folder named by `PRESEND_DATA`, which must be outside the repo: the checker refuses to run otherwise. `.gitignore` and the privacy guard's PATH rule are a second fence. The checker run log on Drive lists which Drive file fills which of these:

`PROMPT-LESSONS.csv` · `APPS.csv` (shape: APPS.example.csv) · `data/CK56-PATTERN.txt` · `data/OB-LESSON-MAP.csv` · `data/<inputs>.json` · `data/<app document>.md` · `data/<snags file>.md` · `PROMPT-REGRESSION-SET*.txt` then `--split` · `sends/<draft>.txt` + `.meta.json`.
