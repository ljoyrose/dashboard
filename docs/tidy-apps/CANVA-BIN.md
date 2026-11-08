# Canva bin: file contract (TidyUp Apps stage 1)

The Bin page's **Canva: designs marked to delete** card. The page never calls Canva: a public page holds no Canva
token, and Canva has no trash API. The page reads one private state file and writes two kinds of small file. A
bot listed in the scripts register (CANVA-BIN) does the Canva side. Lisa empties Canva Trash herself.

All three files live in the folder `CFG.canvaBin.folderId` (config.js). Account labels come from
`CFG.canvaBin.accounts` (`main`, `book`). No emails, design titles or ids are kept in this repo.

## Safety

- `CFG.canvaBin.dryRun` is `true` by default. In a dry run the card lists designs, says "Dry run: N would move to the
  bin folder" and writes nothing. Only Lisa switches it off.
- A design can only move when its title starts `ZZ_DELETE_` **and** it has a ledger row. Any other `ZZ_` title means
  "Name needs fixing" and is never moved.
- Hydration check: Canva exposes no size or checksum, so the check is **last-modified time + page count**. Both are
  written into the ledger row. The page holds a design whose state-file values differ from its row. The bot checks
  them again, live, before each move.
- The bot only **moves** designs into a folder named `ZZ_BIN` in that account. It never trashes or deletes anything.
  Canva Trash keeps designs for 30 days, and only Lisa empties it.

## 1. `CANVA-BIN-STATE.json` (the bot writes it; the page reads it)

```json
{
  "v": 1,
  "accounts": {
    "main": {
      "generated": "2026-10-30T13:15:00Z",
      "zz_bin_folder": null,
      "items": [
        { "title": "ZZ_DELETE_Example design 1", "design_id": "DAEXAMPLE0001", "type": "Presentation",
          "pages": 1, "last_modified": "2026-10-01T10:00:00Z", "folder": "Example folder", "ledger": "none" }
      ]
    },
    "book": { "generated": "…", "zz_bin_folder": "FAEXAMPLEBIN1", "items": [] }
  }
}
```

| Field | Meaning |
|---|---|
| `generated` | When the bot listed that account (ISO 8601). |
| `zz_bin_folder` | Canva folder id of `ZZ_BIN` in that account, or `null` if it does not exist yet. |
| `items[]` | Every design whose title starts `ZZ_`. |
| `title`, `design_id`, `type`, `pages`, `last_modified`, `folder` | As Canva reports them. |
| `ledger` | The bot's own note (`none`, `slip`, `ledger`). Informational: the page decides from the ledger itself. |

A label missing from `accounts` shows as "Not in the list yet". No file shows "No Canva list published yet".

## 2. Ledger slip `AA_DELETE-LEDGER-ROWS_<YYYY-MM-DD-HHMM UK>_01.csv` (the page writes it)

This uses the existing slip prefix, which the ledger reader already reads. Columns: the ledger's columns plus `surface`.

```
date,old_name,file_id,merged_into,agent,surface
"2026-11-03","ZZ_DELETE_Example design 1","DAEXAMPLE0001","Canva ZZ_BIN (bot move), then Canva trash by Lisa (30 days); check: modified=2026-10-01T10:00:00Z; pages=1","dashboard Canva card","canva-main"
```

`surface` is `canva-<label>`. Readers match columns by header name, so the extra column is safe.

## 3. `CANVA-BIN-REQUEST_<YYYY-MM-DD-HHMM UK>.json` (the page writes it, dryRun off, after a confirm)

There is one file per account. When ticks span both accounts, the file name ends `_<label>`.

```json
{ "kind": "CANVA-BIN-REQUEST", "v": 1, "action": "move to ZZ_BIN", "account": "main",
  "requested_at": "2026-11-03T14:05:00.000Z",
  "items": [ { "design_id": "DAEXAMPLE0001", "title": "ZZ_DELETE_Example design 1",
               "last_modified": "2026-10-01T10:00:00Z", "pages": 1 } ] }
```

The bot then:

1. creates `ZZ_BIN` if it is missing;
2. re-reads each design live, and moves it only if the title still starts `ZZ_DELETE_` and the last-modified time and
   page count still match the ledger row;
3. rewrites the state file.

## Links (UNVERIFIED)

Canva publishes no web-address scheme. "Step 2: Trash in Canva" opens `https://www.canva.com/folder/<zz_bin_folder>`
when the bot has made the folder, else `https://www.canva.com/projects`. Both follow what the Canva web app shows and
have not been checked against Canva's docs.
