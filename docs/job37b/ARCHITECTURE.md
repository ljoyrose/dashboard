# ARCHITECTURE: what runs where (dashboard)

*JOB 37b.2 Repo Docs B, 31 Oct 2026. Describes `main` at `e506ab7`. Names only, no values. For the full detail read
[README.md](../../README.md) (owned by JOB 4) and [TESTS.md](../../TESTS.md); this page links to them and does not repeat them.*

## One line

Static pages on GitHub Pages. No server, no build step, no database. Each page reads Google Drive (and two read Google
Sheets) **live in the browser**, with the viewer's own Google sign-in. Nothing private is baked into the repo.

## Hubs (every hub has a line)

| Hub | Folder | Reads | Writes (only on a click) | Published by `pages.yml` |
|---|---|---|---|---|
| Home (Lisa Dashboard) | `index.html` | Shared-drive listings, Changes, Bin, Money tile (via `money/core.js`), Dropbox totals file | Rename to a `ZZ_DELETE_` name; move to bin (`trashed=true`). Never empties a bin | Yes |
| CD Hub | `cdhub/` | `BLD-*.csv` tables in one Drive folder | None (saving is off) | Yes |
| Money Hub | `money/` (+ `money/core.js`) | `MON-*.csv` index files and per-entity ledgers | None (saving is off) | Yes |
| Studio | `studio/` | `studio-state.json`; Owned Tools sheet tab | One request file per click into the requests folder (an Apps Script applies it); Undo trashes it | Yes |
| Factory | `factory/` | `af-state.json` from its logs folder (written by an Apps Script engine) | One request file per click; Undo trashes it | Yes |
| Food hub | `food/` | Its Google Sheet tab and Drive files | Sheet rows (cards) only | Yes |
| Marketplace | `marketplace/` (+ `privacy.html`) | Its Google Sheet tab and a listings CSV | Sheet rows (cards); trash of its own files | Yes |
| Web Estate | `estate/` (`core.js`, `reader.js`, `views.js` + helpers) | A private Google Sheet tab | Add drops one request file | **No, not yet** (open PR #190 adds it) |

App and idea names on any hub appear in docs only as aliases (APP-A, APP-B ...).

## Page flow (every hub)

1. The page loads, in this order: `config.js` → `auth.js` → `toolkit.js` → (`money/core.js` on Home and Money) →
   `tokens.css` → `house.css` → its own inline script and layout.
2. **Signed out:** only a sign-in button and plain links. No tabs, no data.
3. **Sign-in:** `DashAuth` (from `auth.js`) asks Google for a read-only Drive scope. The wider `drive` scope is asked for only
   when a write button (Bin, rename) is used.
4. **Read:** the page calls the Drive (or Sheets) API through `DashKit.googleFetch`, finds files **by folder id and exact
   name**, and refuses a missing or doubled file instead of guessing.
5. **Show:** every panel says where it read from, when (UK time) and whether the read is pending, failed, empty or capped.
6. **Route:** the section lives in the address (`#/bin`, `#/changes/24h` ...), so Back, reload and links work.

## Shared files

| File | Role |
|---|---|
| `config.js` | **The one settings file.** Sets `window.DASH_CONFIG`: the public sign-in client id, Drive scopes, API addresses, and the folder and file ids each hub needs (`money`, `cdhub`, `studio`, `factory`, `food`, `marketplace`, `estate`, `ownedTools`, `binGuard`, `excludedDrives` ...). The only file allowed to hold Drive ids (the privacy guard enforces this). Not a secret store: nothing in it is secret. |
| `auth.js` | `window.DashAuth`: one shared sign-in for every tab. Keeps only the short-lived access token and its expiry under one localStorage key. No refresh token, no secret. Sign-out in one tab signs out all. |
| `toolkit.js` | `window.DashKit`: shared helpers (below). |
| `money/core.js` | `window.MoneyCore`: Money CSV reading and date maths, shared by Home's Money tile and the Money Hub. |
| `tokens.css`, `house.css` | The house look: numbers and colours once (`tokens.css`), shared parts once (`house.css`). |
| `sw.js`, `manifest.webmanifest`, `icons/` | Phone install. The service worker keeps only the site's own page files; never Google traffic, tokens or Drive data. |

### `toolkit.js` helpers (`window.DashKit`)

| Helper | What it does |
|---|---|
| `googleFetch(url, init)` | `fetch` for Google APIs. A GET retries up to 4 tries (about 1 s, 2 s, 4 s plus jitter) on 429, 5xx and rate-limit 403s. Writes never retry. |
| `isBusy(status, reason)`, `BUSY_TEXT`, `TRIES`, `WAITS` | Tell a "Google is busy" answer apart and show one plain message. |
| `applyLook()` | Applies the Look menu choice (stored in `dash-look`) to the page; follows other tabs. |
| `filterButton(id, on)`, `filterOpen(id)` | Shared state for the house Filter button. |
| `search.register / open / run / matches` | One search box (`/`). Each page registers read-only providers; results are grouped by source. |
| `KEYS`, `showKeys()` | Keyboard keys (`g` then `m`, `d`, `b` ...; `?` lists them). |
| `SITE` | The site root, used by the Dashboard button (`data-back-home`). |

## Outside the browser

| Piece | Where it runs |
|---|---|
| Studio / Factory engines, bin guard | Google Apps Script on Lisa's account. Code is on Drive, **not** in this public repo. |
| Tests, gate, privacy guard | GitHub Actions on push and pull request, or by hand in a session. See [RUNBOOK.md](RUNBOOK.md). |

## Data in and out (names only)

- **In:** Drive files and folders named in `config.js`; Google Sheets tabs for Food hub, Marketplace and Owned Tools.
- **Out:** trash (never permanent delete), renames to `ZZ_DELETE_` names, request files for the Apps Script engines, Sheet rows.
- **Never:** emptying a shared-drive bin, reading the excluded drive, storing a refresh token, sending anything to a non-Google address.
