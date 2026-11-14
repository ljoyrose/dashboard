# Private settings file (DASH_CONFIG.json)

The dashboard's settings live in `config.js`. This adds a second, private place for them: one JSON file on Google Drive,
read after Google sign-in. `config.js` keeps working on its own and is always the fallback.

Status today: **shipped in dry run**. The loader finds and checks the file and changes nothing.

## What happens on a page

1. `config.js` runs first, as before. With dry run off, values checked on an earlier visit are put in before any page
   code reads a setting.
2. After sign-in the loader looks in Drive for one file named `DASH_CONFIG.json`: one look per page load, and once
   private values are in use, at most one look every 15 minutes.
3. Trusted file only:
   - a My Drive file owned by the signed-in person, or
   - a file in a shared drive that Google limits to its own domain (`domainUsersOnly`).
   A file shared in by someone else is ignored and never opened. Two trusted files = neither is used.
4. Dry run on: the file is checked and counted. Nothing changes, nothing private is kept in the browser.
5. Dry run off: the checked values are kept in this browser (cleared on sign-out). If they differ from what the page
   started with, the page reloads once, and never while someone is typing or tapping (then they start on the next load).

No file, a broken file, a slow answer (8 seconds), a Drive error or no sign-in = the values in `config.js`.

## What the file may change

Only settings that already have a place in `config.js`, and only these kinds:

| Kind | Which settings | Rule |
|---|---|---|
| id | names ending `Id`, and `money.folders.*` | letters, digits, `-` and `_` only |
| address | names ending `Url`, and `urls.moveSheet` | `https://` on docs.google.com, script.google.com, drive.google.com or forms.gle |
| owner address | `money.owner` | one email address |
| name | names ending `Name` or `File`, and `tab` | plain text, up to 200 characters |
| never-read drives | `cleanup.excludedDrives` | entries are **added**; the built-in ones can never be removed |

Never, whatever the file says: `clientId`, `scopes`, the Google API addresses (`urls.files`, `urls.drives`,
`urls.driveApi`), `privateConfig`, `personalBin`, `tidyApps`, every `live` and `dryRun` switch, numbers and lists.
An empty value never replaces a filled one. Keys starting with `_` are notes for people and are skipped.

## File shape (invented values)

```json
{
  "_note": "Private settings for the dashboard. Same shape as DASH_CONFIG in config.js.",
  "home": { "ledgerFileId": "made-up-ledger-id", "runLogFolderId": "made-up-folder-id" },
  "money": { "owner": "someone@example.com", "folders": { "ops": "made-up-ops-id" } },
  "cleanup": { "excludedDrives": [{ "id": "made-up-drive-id", "name": "Invented drive name" }] }
}
```

## Checking it (no values are ever shown)

In the browser console on any dashboard page, signed in:

```js
await DashConfigLoader.refresh(true)
```

It answers with counts and setting names only:

| state | Meaning |
|---|---|
| `absent` | no file found; running on `config.js` |
| `checked` | dry run: file found, trusted and readable. `values` + `drives` = what it holds, `wouldChange` = how many differ from `config.js`, `skipped` = setting names it may not change, with the reason |
| `in-use` | dry run off: the private values are in use |
| `untrusted` | a file with that name exists but is not trusted (see step 3) |
| `ambiguous` | more than one trusted file |
| `unreadable` | not JSON, not a settings object, too big (64 KB) or a Drive error |
| `slow` | Drive did not answer in time |
| `signed-out`, `off` | nothing was looked for |

## Switches (in `config.js`, `privateConfig`)

- `enabled: false` = never look.
- `dryRun: true` = check only. Switching it off is Lisa's call, in its own pull request.

## Before any real value is removed from `config.js` (a later pull request)

- Put the file on Drive, check `state` is `checked`, `wouldChange` is 0 and `skipped` is empty.
- Switch `dryRun` off and check `state` is `in-use` on each device that uses the dashboard.
- Keep the never-read drive entry in `config.js`. On a device's first visit the private values arrive a moment after
  the page starts, so a never-read drive that lives only in the private file would not be protected for that moment.
- Pages read their settings when they start, so a first visit shows "not set up" for a moment, then reloads once.

Tests: `tests/mocked/private-config-rails.spec.js`, `private-config.spec.js`, `private-config-same-as-today.spec.js`.
