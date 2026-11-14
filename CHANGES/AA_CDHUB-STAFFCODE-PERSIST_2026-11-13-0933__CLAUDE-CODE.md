# AA_CDHUB-STAFFCODE-PERSIST 2026-11-13 0933 (UK)

CD Hub: the staff code and the save address now stay set after closing and reopening, and The round's panel shows it.

## 1. Cause (plain English)

The fix in PR 522 did keep the code. But The round's panel **"Saving on this device"** never looked at the kept code: it read only the two old round-card boxes. So it said **off**, with both boxes empty, every time, even when saving worked. Seeing "off", you typed the code again.

The address box was empty for a second reason: the save address read from Drive (`BLD-save-webapp.json`) was held in memory for one visit only, never kept. A Drive read that failed once (for example, signed out for a moment) was not tried again for the rest of the visit.

## 2. Evidence (main at f3754e1)

| Lead | Result | Evidence |
|---|---|---|
| 1. Panel reads legacy keys only | **Confirmed. Main cause.** | `sinkOn()` checked `sinkGet('cdhub.sink.code')`, which falls back to `bld.device.code` only. PR 522 wrote `cdhub.staff.code`, which the panel never read. The address box used `sinkGet('cdhub.sink.url')`, and the Drive address lived only in `CD.saveUrl` (memory). `saveUrlLoad()` kept a failed read for the whole visit. 5 new tests **fail on f3754e1** and pass with this fix. |
| 2. Something clears the keys on load | **Ruled out in code.** | No page calls `localStorage.clear()`. The only removals were a refused code (`noteBadCode`) and a tap on "Switch off here". `#join=` only sets. Sign-out (`auth.js`) removes only its own sign-in key. There is no `Clear-Site-Data` header in the repo. Not checked: what the live Cloudflare logout page sends. |
| 3. Two web addresses | **Real, but not the cause on the laptop.** | github.io and pages.dev each keep their own storage. Set the code once on pages.dev and use only that. No redirect added. |
| 4. Cloudflare Access sheet on phones | **Partly. Android: storage is shared. iPhone: a risk.** | Android Custom Tabs and installed apps use Chrome's storage for the same site, so the sheet does not lose the code. On an iPhone, the Home Screen app keeps storage separate from Safari. See Cloudflare recommendations. |
| 5. Shortcut versus a true app | **Found a blocker. Fixed.** | Browsers fetch the manifest **without cookies** unless the link says `crossorigin="use-credentials"`. Behind Access, the manifest request is sent to the login page, so Chrome cannot read it and can only make a plain Home Screen shortcut. All 9 pages now send the cookie. |
| 6. Cache | **Bumped.** | `sw.js` `ljr-shell-v9` → `ljr-shell-v10`. |

## 3. What changed

1. **One source of truth.** The code is `staffCodeNow()` and the address is `saveAddr()`. The panel, the room move, the temperatures and the photo all read these two.
2. **Kept address.** An address that worked, or that was read from Drive, is kept on the device (`cdhub.save.url`). Drive is still read once each visit, so a new address replaces the old one.
3. **Backup copy.** The code and address are also kept in IndexedDB (`cdhub-keep`). If the browser loses the localStorage copy, the backup puts it back. The page also asks the browser not to clear its storage (`navigator.storage.persist()`).
4. **Panel.** When saving is on, the panel says "on", shows the address, and shows the code as dots only. A new line reads **"This device: app mode yes/no · code kept yes/no · save address yes/no"**. The code is never shown.
5. **Switch off here** now forgets the code and the address on this device, backup included. It also stops the staff page's copy being reused on this device. Before, it left a valid code working.
6. **A refused code** is removed from every copy, so it is not offered again after a reload.
7. **Manifest** sends the Access cookie (all 9 pages), so Android can install a true app.

## 4. Tests

- `tests/mocked/cdhub-staff-code-save.spec.js`, 5 new tests:
  - Panel on after the code is accepted; address filled; code masked; the code is not in the panel HTML.
  - Survives a reload with no config and no Drive address.
  - IndexedDB backup restores the code and address.
  - Switch off forgets everything, backup included.
  - **Persistent browser profile:** set it, close the whole browser, reopen on the same profile with no Drive address. The panel is on and a save sends the kept code with no prompt.
- `cdhub-dog-card-1112.spec.js`: the address box is now expected to be shown filled, not hidden.
- `TESTS.md`: a "Caught after merge" row.

## 5. Desktop retest (5 steps; never type the code anywhere except the Staff code box; never share it)

1. After merge, open https://dashboard-eyo.pages.dev/cdhub/ in your usual Chrome. Press Cmd+Shift+R once (Ctrl+Shift+R on Windows) to load the new version.
2. Open **The round**. Read the line under the heading. If it says "code kept no", make one save (for example a flap) and type your code in the **Staff code** box when it asks.
3. The panel should now say **"Saving on this device: on"**. The address box is filled, the code box shows dots, and the line reads **"code kept yes · save address yes"**.
4. Quit the browser fully (Cmd+Q). Reopen it, then go to CD Hub → The round. It should still say **on**, with the same line.
5. Make one save. You should see **saved ✓** with no code box. If you also use Safari, repeat steps 2 to 5 there once: Safari keeps its own copy.

## 6. Phone retest (5 steps; same rule about the code)

1. **Android:** in **Chrome** (not Samsung Internet, not a link inside another app), open https://dashboard-eyo.pages.dev/ and sign in.
2. Remove the old Home Screen icon. Then Chrome ⋮ → **Install app**. If Chrome offers only "Add to Home screen", report it: that is still a shortcut.
3. Open the new app → CD Hub → The round. The line should read **"app mode yes"**. Make one save and type the code once when asked.
4. Swipe the app away from recent apps and reopen it. The round should say **on**, with **"code kept yes · save address yes"**.
5. Make one save: **saved ✓**, with no code box. **iPhone:** Safari → Share → **Add to Home Screen**. Open the app from the icon and enter the code once **inside the app**, because Safari's copy does not carry over. Then close and reopen the app and check the same line.

Note: the installed app starts on the main Dashboard (start_url is the site root). To reach CD Hub, long-press the icon and pick **CD Hub**, or tap through.

## 7. Cloudflare Access recommendations (not changed; recommend only)

1. **Session duration:** set the CD Hub/dashboard Access application to a long session (for example 1 month). The Access login sheet then appears rarely in the phone app. Each time it appears is a chance for an iPhone Home Screen app to lose the sign-in.
2. **Bypass for install files only:** add a Bypass policy for `/manifest.webmanifest` and `/icons/*`. These hold no data (they are already public in this repo). This is belt and braces for Android's app installer, in case a device fetches them without the cookie.
3. Leave `/cdhub/` and every data path behind Access as now.

## 8. BLD SCHEMA RECOMMENDATIONS (CD Hub quirk: the same setting lives under several names)

| Item | Exact field / key | Allowed values | Naming / note |
|---|---|---|---|
| Save address file (Drive) | `BLD-save-webapp.json` → `url` | `https://script.google.com/macros/s/<id>/exec` or `/a/macros/<domain>/s/<id>/exec` | Keep the single field `url`. Add `set_at` (ISO date) and `set_by` (role, not a name) so a changed address can be told from an old one. |
| Device: staff code (kept) | `cdhub.staff.code` | a code the save script accepted | One key from now on. The old keys `cdhub.sink.code`, `bld.staffCode` and `bld.device.code` are still read (in that order) for old set-ups. Retire them at the next stage. |
| Device: save address (kept) | `cdhub.save.url` | same pattern as `url` | Typed address `cdhub.sink.url` and the staff page's `bld.scriptUrl` win over it. Retire `cdhub.sink.url` at the next stage. |
| Device: switched off | `cdhub.sink.off` | `1` or absent | Rename to `cdhub.save.off` at the next stage (one prefix: `cdhub.save.*`). |
| Device backup | IndexedDB `cdhub-keep` / store `kv` / keys `code`, `url` | as above | Mirror only; localStorage stays the first copy. |

Stage names (plain): **now** = this PR, which reads old and new keys. **Next stage** = the staff page writes `cdhub.staff.code`/`cdhub.save.url` too. **Last stage** = drop the old keys.

## 9. Not checked / open

- I did not open the live site. The cause is shown by code and by tests that fail on the old code.
- The Cloudflare logout page and the iPhone Access sheet behaviour were not tested live.
- One test that was already failing on main before this change (`job34b-home-gaps` keyboard test) is unrelated.
