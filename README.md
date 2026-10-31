# Lisa Dashboard

A single-page Google **shared drives** surface (read-only browsing, plus a Bin), served by GitHub Pages at
<https://ljoyrose.github.io/dashboard/>. It reads Drive live each time it opens. Nothing is baked in.

- **Sections** (one shared header, Map first): Map, Read first, Drive, Bin, Changes (Recent, Last 24h, Last 7 days, Totals).
- **Excluded drive (hard rule 14):** Karen - SHARED (id in `excludedDrives` in `config.js`) is never queried, listed, searched or binned.
- **Drives** (bottom tab, `#/drives`) has one pill row: Shared drives (`#/drives/shared/<driveId>/<folderId>`, with Read first pinned at the top), Work My Drive (`#/drives/work`), Personal Drive (`#/drives/personal-drive`) and Drive check (`#/drives/usb`). Shared drives lists shared drives only (`drives.list`, `corpora=drive`). Work My Drive and Personal Drive are look-only scans; Personal Drive uses its own read-only sign-in (`drive.metadata.readonly`), held in memory only and never used for work calls. Old addresses (`#/drive…`, `#/readfirst`, `#/personal`, `#/usb`) redirect.
- **Bin** (`#/bin`), top to bottom: Needs you now (one line of counts), Ready to bin (one tick list for shared drives and Work My Drive, each line tagged with its place; one **Bin these (n)** button with one short confirm), Check (put back by the bin guard), Not ready yet (no tick boxes; each line says who acts), Already in the bin, Log, and Dropbox (being emptied, folded at the bottom). It lists names starting `ZZ_`. Only a ticked name that starts `ZZ_DELETE_` and has a row in the delete ledger can be moved.
  No ledger row: held, not ticked. Other `ZZ_` names, including retired `ZZ_SUPERSEDED_`, are Rename needed and are never binned.
  `RR_` anywhere in the name, inside an `RR_` folder, or a folder that holds an `RR_` item, is left out. If the ledger cannot be read, nothing is binned.
  Money rollback files are held, never ticked, and never restored, renamed or binned. The label is "Held: money rollback (E02), do not touch until FIX 6 is confirmed". Held anywhere: names matching `ZZ_SUPERSEDED_*_DO-NOT-USE__MON-*` or `ZZ_SUPERSEDED_*CHECK-LOG*`. Held by folder id only: anything in 0.1 - Index (id in `config.js`) or in the 4 - Ops folder that holds CHECK-LOG (id in `config.js`). A different folder with the same name is not held.
  "Move selected (N)" moves only ticked rows that are on screen. Every list has Show more and Show all. Per shared drive bin list (name, date binned, who).
  Moving a file to the bin is the only write. A shared-drive bin is never permanently deleted. Nothing runs automatically.
  The section is in the URL (`#/changes/24h`), so back, reload and links all work.
- **Sign-in:** Google, Drive read-only scope. The full `drive` scope is asked for only when Bin actions are used. One sign-in is shared by the home page, Money Hub and CD Hub, in every tab and the installed app. Only the short-lived access token is kept (localStorage, one key), until it expires or you sign out; signing out in one tab signs out all. No refresh token, no secret.
- **Every panel** shows where it read from and when it was read (UK time). It also shows whether the read
  is pending, failed, empty or capped.
- **Look:** Lexend only, LJR7 palette (slot 0 for Read first and Drive, slot 2 Risks for the Bin, slot 7 for Cf overskill), light and dark modes.
- **Money tile** (on Map, Lisa's account only): cash per entity (business and personal kept apart, never summed), stale and runs-dry flags, ready to-dos, and dates overdue or due in the next 14 days. It reads through `money/core.js` and links to `/money/`.
- **Dropbox line** (on Bin, after sign-in only): reads `DROPBOX-TOTALS.json` (counts and GB only, no file names) from the Drive folder set in `DBX_FOLDER_ID`, so nothing about Dropbox is public. Shows how many `ZZ_DELETE_DROPBOX_` files are waiting. Two neutral buttons, folded closed at the bottom of Bin: `DBX_JOB_URL` opens workflow 3 in the private repo (Dropbox only: empty box = dry run, type DELETE), `DBX_TRASH_URL` opens Dropbox Deleted files (cannot be automated on a personal account).
- **Home screen:** Key projects & docs sits at the top. Big links for the MOVE workbook, Money Hub, CD Hub and the other sections. One tap each. Money Hub and CD Hub open in a new tab.
- **Signed out:** a sign-in button and those links. No tabs and no private data. The real protection is that all data is read from Drive with the viewer's own Google sign-in.
- **PC-Personal** (`#/personal`): finds files in the signed-in account's own personal Drive that already exist byte for byte (MD5 + size) in a shared drive; "Rename selected (N)" renames the ticked matches to `ZZ_DELETE_DRIVE_<name>`. "Move selected (N)" bins only ticked personal files that start `ZZ_DELETE_DRIVE_` and have a delete-ledger row. A name containing `RR_` cannot be ticked. Labelled PC-Personal for the business Google account and lisah Personal for the personal Gmail account. Runs in the browser with the viewer's own sign-in; the shared-drive copy is never changed.
- **Writes:** only rename, and move-to-bin (`files.update` with `trashed=true`), from the ticked rows. Shared-drive bins are never emptied.

The repo contains no secrets. The OAuth client ID in `index.html` is public by design and only works from the
authorised origin `https://ljoyrose.github.io`.

## Privacy guard (this repo is PUBLIC)

Everything pushed here (every commit, branch, commit message and Actions log) can be read by anyone, for ever. A force-push does not remove it. So a guard blocks private material before it lands.

- **What it blocks:** a term from the private denylist (in text, file names or commit messages), an email address that is not on the allow list, a Google Drive/Docs id or link outside `config.js`, a UK phone number (Ofcom's fiction numbers such as 07700 900xxx are fine for samples), data paths (sends, runs, regression sets, zips, `.env`, `.pyc`), and a commit author email that is not a noreply address. It prints file:line and the rule, never the private text.
- **Where it runs:** on every pull request and push (workflow "Privacy guard", job **Privacy guard (public repo)**, a required check on `main`), and on your machine through git hooks. Daily and hand-started runs are report-only: counts by rule, nothing uploaded, never red.
- **The denylist is never in this repo.** CI reads it from the repository secret `PRIVACY_DENYLIST` (one term per line). On your machine keep a copy outside the repo, for example `$HOME/.config/repo-privacy/denylist.txt`, and `export PRIVACY_DENYLIST_FILE=$HOME/.config/repo-privacy/denylist.txt`. The master copy stays on Lisa's Drive. With no denylist the guard fails closed (exit 2; in CI: "PRIVACY_DENYLIST secret missing: failing closed").
- **Install the hooks once:** `git config core.hooksPath .githooks`. `pre-commit` checks what you stage; `pre-push` checks every commit you push, so something added then removed is still caught.
- **Run it by hand:** `python3 tools/privacy-guard/privacy_guard.py --staged` (or `--range A..B`, `--tree`, `--history`; add `--report /some/path/outside/the/repo.md` for a report-only run). Self-tests: `python3 tools/privacy-guard/test_privacy_guard.py` (fake data only).
- **On a FAIL:** do not push. Remove the line by a normal edit (Drive ids go in `config.js`; people and app names become aliases such as APP-A). If it was already pushed: stop, do not force-push or delete anything, and tell Lisa; only she decides history rewrites.
- **Allow list:** `tools/privacy-guard/allow.txt` is public and stays tiny (10 lines at most; the one business address, and Drive ids only in `config.js`). A test fails if it grows.

## Design rules (every page, now and future)

- **Dashboard button.** Every page except home has a **Dashboard** button at the top right of the header. Always shown (signed in or out), keyboard reachable, `aria-label`, existing button style. Opened from the dashboard: it brings that tab back and closes itself. Otherwise it goes to the site root.
- **Hub links open a new tab.** Home links to Money Hub, CD Hub (and any future hub) use `target="_blank" rel="opener"` (same site only), so the dashboard is never replaced.
- **One sign-in.** Every page uses `auth.js` (`DashAuth`). Never add a second token store.
- **Wording.** Minimal, concise, direct. Short labels. Bullets, not paragraphs, unless essential. ADHD-friendly. Safety notes stay, in a few words (e.g. "Read-only", "Lisa only").
- Also binding: ADHD-Layout-Standards.md on Drive (spacing scale, Lexend only, LJR7 colour order, S1–S7).

## CD Hub (`/cdhub/`)

<https://ljoyrose.github.io/dashboard/cdhub/> is a read-only web copy of the CurlyCwtch Cobberdog Hub.
After Google sign-in (same OAuth client, Drive read-only scope) it lists the `BLD-app-tables` folder and reads
the `BLD-*.csv` tables live. No data is in the repo. The sign-in is the same one as the rest of the site. Saving (the round,
cabin access, flags) is switched off for now.

## Money Hub (`/money/`)

<https://ljoyrose.github.io/dashboard/money/> is the Money Hub, read-only. After Google sign-in (same OAuth client,
Drive read-only scope) it checks the account is Lisa's, then reads the `MON-*.csv` index files and each entity's
ledger CSVs in the Money Hub shared drive. Files are found by folder and exact title. A missing or duplicate file
is shown as an error, and the page never falls back to an old file id. Entities come from `MON-SUBJECTS.csv` at read time.
The repo holds no figures or names, only the folder ids it needs. `money/core.js` is shared with the dashboard Money tile.
Business and personal entities are shown separately and are never added together. Saving and answers are off.

## Studio (`/studio/`)

<https://ljoyrose.github.io/dashboard/studio/> is the asset hub (slot 7): PDFs, ebooks, lead magnets, slides, scripts, logbooks,
family trees, puppy packs, social graphics, page and email drafts, for every brand. Idea → approved → reused.
- **Tabs (bottom bar, like Marketplace):** Me (everything waiting on Lisa) · Decide (Gates, Review, suggestions) · Do (Tasks, questions and deliveries to send, results to add) · Line (Ideas, In progress, Library) · Kits (Kits, Tools, Brands). + New at the top.
- **Two ladders (v0.2):** WHERE = Group › Business (brand) › Product (Group chips on the find bar). WHAT = Brick › Kit › Pack › Playbook;
  a playbook aims at one outcome (Attract, Convert, Deliver, Keep, Reuse). Style = Framework + Voice + Look. Formats are presets.
  A variant points at its master (refresh, rebrand, reformat, translate, A/B test). Sources carry a rights flag.
- **Tools by capability:** a kit lists what it needs; the engine finds the best owned tool. No tool = a gap on the Tools tab.
- **Reads** `studio-state.json` from the Studio logs folder (`studio` in `config.js`), by folder and exact name, every 5 minutes.
  Not there yet: built-in example data, a banner, and nothing is sent.
- **Writes** one request file per click into the requests folder (approve, redo, bin, gate, idea, set, studio, tool, source, done, check).
  The STUDIO-ENGINE Apps Script applies it. Undo until the engine's next run.
- **Client-ready:** accounts (owner or client) and products; every brand, product, asset, idea and request carries `accountId`.
  Account chips show when there is more than one account. An idea cannot mix two accounts.
- **Look (clear board):** Line and Decide open as a board on a desktop (fixed columns per stage or decision, each scrolling inside itself,
  head and foot with "need you · £ AI", details on the right) and as a list on the phone (one column per screen if Board is picked,
  details under the card). The Board/List switch is kept per page. The palette button (Look) sets Background (Warm clear / Cool clear),
  Selected (Outline / Soft tint), Coloured words, Text size, Spacing and Mode (Device / Light / Dark), kept in `localStorage['dash-look']`
  for the other hubs. No solid colour fills: every edge is 1px; hover and selected turn that edge ink, so nothing thickens or moves.
  Dark frame top and bottom (never black). The find bar is one row (Search · Filter · Sort); Filter opens a panel with every
  filter group, and active filters show as removable chips.
  Stages read "Step N: Name" (no numbers in circles); counts wear one ring; no solid colour fills; one 12px radius
  (`--radius`); two pill sizes; two font weights. On the phone the header keeps the status pills and one More menu.
- **Library** (Kits tab): Playbooks, Packs, Kits and Bricks each have + New and Edit (the Sheet's fields, checked before
  sending; one `library` request) and a Suggest box anyone on the team can use (one `libsuggest` request, waits for Lisa).
  Kits and Packs carry an optional price (ex or inc VAT, shown ex / inc / both by the viewer's choice), a source-files
  add-on and a lead time; VAT rates are listed read-only on Brands.
- **Ownership** in an item's details: Client material (yes/no; client material is never reused) and Source files (kept
  by you / sold to client); one `rights` request.
- **Comments** in an item's details: two threads, never mixed. Team (default, internal) and, for client items, Client
  (every comment labelled "Client", and "Client can see this" above the box). Send writes one `comment` request.
- Same sign-in, find bar and rules as Factory. TEST stamp until `studio.live` and the state's mode are both LIVE.
