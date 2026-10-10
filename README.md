# Lisa Dashboard

A single-page Google **shared drives** surface (read-only browsing, plus a Bin), served by GitHub Pages at
<https://ljoyrose.github.io/dashboard/>. It reads Drive live each time it opens. Nothing is baked in.

- **Sections** (one shared header, Map first): Map, Read first, Drive, Bin, Changes (Recent, Last 24h, Last 7 days, Totals).
- **Drive** lists shared drives only (`drives.list`, `corpora=drive`), with a picker and folder browsing (`#/drive/<driveId>/<folderId>`). My Drive is never listed.
- **Bin** (`#/bin`): ZZ_ sweep (names starting `ZZ_`; never `RR_`, nothing inside an `RR_` folder, no `ZZ_` folder that holds an `RR_` item),
  then one "Move all to bin" button behind a confirm. Per shared drive bin list (name, date binned, who) and an "Empty bin" button
  that needs `EMPTY` typed (Manager role). Nothing runs automatically.
  The section is in the URL (`#/changes/24h`), so back, reload and links all work. Browser storage is not used.
- **Sign-in:** Google, Drive read-only scope. The full `drive` scope is asked for only when Bin actions are used. The access token is kept in memory and never saved.
- **Every panel** shows where it read from and when it was read (UK time). It also shows whether the read
  is pending, failed, empty or capped.
- **Look:** Lexend only, LJR7 palette (slot 0 for Read first and Drive, slot 2 Risks for the Bin, slot 7 for Cf overskill), light and dark modes.
- **Money tile** (on Map, Lisa's account only): cash per entity (business and personal kept apart, never summed), stale and runs-dry flags, ready to-dos, and dates overdue or due in the next 14 days. It reads through `money/core.js` and links to `/money/`.
- **Dropbox line** (on Bin, after sign-in only): reads `DROPBOX-TOTALS.json` (counts and GB only, no file names) from the Drive folder set in `DBX_FOLDER_ID`, so nothing about Dropbox is public. Shows how many `ZZ_DELETE_DROPBOX_` files are waiting. Two buttons: `DBX_JOB_URL` opens workflow 3 in the private repo (Dropbox only: empty box = dry run, type DELETE), `DBX_TRASH_URL` opens Dropbox Deleted files (cannot be automated on a personal account).
- **Signed out:** only a sign-in button is shown (no tabs, labels or data). This is a display choice; the real protection is that all data is read from Drive with the viewer's own Google sign-in.
- **Writes:** only from the Bin buttons (files.update trashed=true; files.emptyTrash per shared drive).

The repo contains no secrets. The OAuth client ID in `index.html` is public by design and only works from the
authorised origin `https://ljoyrose.github.io`.

## CD Hub (`/cdhub/`)

<https://ljoyrose.github.io/dashboard/cdhub/> is a read-only web copy of the CurlyCwtch Cobberdog Hub.
After Google sign-in (same OAuth client, Drive read-only scope) it lists the `BLD-app-tables` folder and reads
the `BLD-*.csv` tables live. No data is in the repo, nothing is kept in the browser, and saving (the round,
cabin access, flags) is switched off for now.

## Money Hub (`/money/`)

<https://ljoyrose.github.io/dashboard/money/> is the Money Hub, read-only. After Google sign-in (same OAuth client,
Drive read-only scope) it checks the account is Lisa's, then reads the `MON-*.csv` index files and each entity's
ledger CSVs in the Money Hub shared drive. Files are found by folder and exact title. A missing or duplicate file
is shown as an error, and the page never falls back to an old file id. Entities come from `MON-SUBJECTS.csv` at read time.
The repo holds no figures or names, only the folder ids it needs. `money/core.js` is shared with the dashboard Money tile.
Business and personal entities are shown separately and are never added together. Saving and answers are off.
