# GLOSSARY: the dashboard's own words

*JOB 37b.2 Repo Docs B, 31 Oct 2026. Terms as used in this repo. See also [ARCHITECTURE.md](ARCHITECTURE.md) and [RUNBOOK.md](RUNBOOK.md).*

| Term | Meaning |
|---|---|
| Hub | One page of the site with its own folder: Home, CD Hub, Money Hub, Studio, Factory, Food hub, Marketplace, Web Estate. |
| Home | The root page `index.html` (title "Lisa Dashboard"): Map, Drive, Bin, Changes and the hub links. |
| Map | Home's first screen: "Needs you", tiles and Key projects & docs. |
| `DASH_CONFIG` | The settings object set by `config.js`. The only place Drive ids may live. |
| `DashAuth` | The one shared sign-in (`auth.js`), stored under one localStorage key for every tab. |
| `DashKit` | Shared helpers (`toolkit.js`): Google retries, look, filter button, search, keys. |
| `MoneyCore` | Money CSV reading and date maths (`money/core.js`), shared by Home's Money tile and Money Hub. |
| Read-only scope | The Drive scope asked for at sign-in. The wider `drive` scope is asked for only when a write button is used. |
| Excluded drive | A shared drive listed in `excludedDrives` that the site never reads, lists, searches or bins. |
| `ZZ_DELETE_` | Name prefix that marks a file for the bin. Binned only when ticked **and** it has a delete-ledger row. |
| `ZZ_DELETE_DRIVE_` | Prefix PC-Personal adds to a personal-Drive file that already exists byte for byte in a shared drive. |
| `ZZ_SUPERSEDED_` | Retired prefix. Listed under Rename needed; never binned. |
| `RR_` | "Keep" prefix. Anything with `RR_` in its name, inside an `RR_` folder, or a folder holding one, is never binned or renamed. |
| Delete ledger | The Drive sheet of approved deletions. No ledger row, no bin. Unreadable ledger, nothing is binned. |
| Rename needed | Bin list of `ZZ_` names that are not exactly `ZZ_DELETE_`; never binned. |
| Held | A row shown but never tickable (money rollback files, protected folders). |
| 00 CHECK | Drive folder where the bin guard puts back anything wrongly binned. The Bin page only reads it. |
| Bin guard | Apps Script (not in this repo) that runs daily and restores wrongly binned items to 00 CHECK. |
| PC-Personal | Home section (`#/personal`) matching personal-Drive files to shared-drive copies by MD5 and size. |
| Drive check | Home section (`#/usb`) hashing a local folder in the browser to see what is already in shared drives. |
| Request file | A small file a hub writes into a requests folder on a click; an Apps Script engine applies it. Undo trashes it before the engine runs. |
| Engine | An Apps Script on Lisa's account that writes a hub's state file and applies request files (Studio, Factory). Not in this repo. |
| State file | The JSON a hub reads on load (`studio-state.json`, `af-state.json`). Missing means example data and writes off. |
| Example data | Built-in invented data a hub shows when its state file is not there yet. Nothing is sent. |
| Look | The Look menu (mode, tone), stored in `dash-look` and applied by `DashKit.applyLook`. |
| House look | The shared design rules in `tokens.css` and `house.css`, tested on every hub by `house-look.spec.js`. |
| Slot | An LJR7 palette position (0-8) used to colour a hub or a search group. |
| Find bar | The one-row Search · Filter · Sort control on list views. |
| Mocked suite | The Playwright tests with pretend Google and Drive (`--project=mocked`, plus `--project=phone`). |
| Fixture | Invented sample data in `tests/fixtures/`. Never real names or ids. |
| Header contract | The list of column names each hub expects in its Drive files (`tests/contract/`). |
| Teeth check | Breaks one thing on purpose in a temp copy and expects the tests to go red (`tests/teeth/`). |
| Gate (tool) | `tools/gate/gate.mjs`: checks an App Factory card against the unified gate list; prints PASS, FAIL or WAITS-LISA. |
| WAITS-LISA | Gate result for a gate with an open conflict; never auto-passed. |
| Privacy guard | `tools/privacy-guard/privacy_guard.py` and its required CI job: blocks denylist terms, emails, Drive ids outside `config.js`, phone numbers, data paths and non-noreply authors. |
| Denylist | Private list of terms the guard blocks. Never in this repo; CI reads it from a repository secret. |
| Required check | A CI job that must be green before `main` accepts a merge: "Browser tests (pretend Google and Drive)" and "Privacy guard (public repo)". |
| Publish | `pages.yml`: tests first, then copy only the site files to GitHub Pages. |
| Alias | APP-A, APP-B ...: how app and idea names appear in public docs. |
