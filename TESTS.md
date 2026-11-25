# TESTS: how we know the dashboard still works

*For Lisa. Plain English. Last updated 15 Oct 2026 (Job 6b).*

## The short version

- A robot opens each dashboard page in a real browser and clicks around.
- It checks the page loads, the buttons and links work, and nothing is broken.
- **It never signs in to your real Google. It never reads your real Drive.** Both are pretend.
- It runs by itself on GitHub every time a change is saved, and every Monday morning.
- **Green tick = good. Red cross = something needs a look.**
- **A change cannot be merged into `main` unless the tick is green** (once you switch that on: see "Make the tick compulsory").
- If the Monday run is red, **GitHub opens one Issue and emails you.** It closes itself when things are green again.

You do not need to do anything day to day. This page just explains what the robot checks.

## What "green" means

Green means all of these are true on all three pages:

1. The page opens (no "page not found").
2. The page shows the right first screen (a sign-in button, nothing private).
3. After a pretend sign-in, the page shows its sections.
4. Every menu link goes where it should.
5. The sample spreadsheets (CSV files) are read and shown correctly.
6. The browser shows **no unexpected errors** in its hidden error log.
7. The page never tries to contact any address we did not plan for.
8. Only the shared sign-in is saved (one key, this browser, every tab). Sign-out clears it in every tab.
9. On a phone-sized screen, each page opens, the menu works and nothing scrolls sideways.
10. The column names the pages expect in your Drive files are still the ones on our list.
11. Dark mode still works, and accessibility and the smallest text size have not got worse.

If any of these breaks, the tick turns red and says which page.

## What is checked, page by page

| Page | Address | Checks |
|---|---|---|
| Main dashboard | `/dashboard/` | 46 |
| CD Hub | `/dashboard/cdhub/` | 51 |
| Money Hub | `/dashboard/money/` | 41 |
| Reading CSV files | both readers | 17 |
| Safety checks | the whole repo | 4 |
| Bin safety (`RR_` archives never taken) | `#/bin` | 10 |
| Never empty the bin | all three pages | 2 |
| PC-Personal and Drive check (rename, then bin) | `#/personal`, `#/usb` | 14 |
| Clean-up safety (keepers, folders, resume) | `#/bin`, `#/personal`, `#/usb`, `#/changes` | 13 |
| Header contract (column names) | list of expected columns | 12 |
| Hub data contracts (Food, Marketplace, Studio: names, types, red/green) | `tests/contract/*.contract.spec.js`, run by `tests/mocked/hub-contracts.spec.js` | 47 |
| Dark mode, accessibility, smallest text | all three pages | 18 |
| Phone-sized screen (390 × 844) | all three pages | 3 |
| Learning loop and alarm wiring (the safety net checks itself) | this file, `.github`, `tests/` | 10 |
| Factory house look (dark frame, bottom tabs, 1px lines, one radius, fixed counts, hover rule, contrast light/dark/warm/cool, empty states, one calm find bar, phone) | `/dashboard/factory/` | 24 |
| Studio (example data, real data, accounts, groups, bottom tabs, Kits, find bar, Review write-back and Undo, new brief, Add tool, gaps, Done, set-up ticks, Tools warnings, clients, results, spec, brand kit, books, feedback, phone, dark, text size, board, Board/List, Look menu, frame, one-row find bar, one line rule, numbers, no solid fills, pill sizes, weights, dark tour, greys follow the background, calm cards, Me summary, who ring, consistency, brand website, no empty counts, brand mark, list bars, comments, library forms, prices and VAT, ownership, protection, save as kit, team role) | `/dashboard/studio/` | 66 |
| Studio plain words and calmer screens (no "Spec lock", "Bricks" or "Engine" on any page; How Studio works fold; Open in Infinity only for an https Infinity card link; two taps from a tab; phone tab bar) | `/dashboard/studio/` | 7 |
| Studio Owned tools (read only after sign-in, with the sign-in token; rows come only from the Owned Tools tab; empty and no-access states; sheet id only in `config.js`; no tool data in the repo) | `/dashboard/studio/#/tools` | 7 |
| House look on every hub (one set of rules from `tokens.css` + `house.css`: 12px radius, 1px lines and 3px bars, Lexend 400/600 at 13px+, no coloured words, one control line (meaning buttons rest on their own colour line), 36/44px buttons, 30 x 22 counts, ringed date pills, deep frame, 12px card padding and gaps, no solid fills, the hover rule, tabs exempt; every view, desktop warm light, phone cool dark and Look › Dark) | all seven hubs | 22 |

The rows above are the main areas. Smaller checks sit in the same run and are included in the total.

That is 668 checks that must pass (mocked + phone, 31 Oct 2026, Studio plain words and Studio Owned tools; before that house look on every hub, CD Hub In whelp fixture test and Bloodline empty states).

**Main dashboard**
- Opens and shows a sign-in button until you sign in. The home screen also shows Key projects & docs (MOVE, Money Hub, CD Hub and the other sections).
- Every menu tab works. The menu is a bar at the bottom (Home, Drive, Bin, Changes, More); Read first, PC-Personal, Drive check and the other hubs open from More. Home starts with "Needs you: N", three big tiles and the one most urgent thing (`tests/mocked/hub-v2-main.spec.js`).
- Links straight to a section work, like `#/changes/24h`, `#/bin` and `#/personal`.
- The Back button works.
- Drive lists the shared drives, opens a folder and has an "Up one level" link.
- The Bin lists other `ZZ_` names under Rename needed. Only a ticked `ZZ_DELETE_` file with a ledger row can be moved, and only after you confirm. An `RR_` file is never listed as movable.
- Nothing permanently deletes a shared-drive bin. There is no button for that, and no page calls Drive to empty one.
- The Dropbox line shows counts only.
- The Money tile shows each entity on its own, never added together.
- The Money tile links open `/money/`, a single entity, and a single to-do.
- Sign-in problems show a clear message (permission refused, window closed, window blocked).

**Studio plain words** (`tests/mocked/studio-plain-words.spec.js`, same invented data)
- No page shows "Spec lock", "Brick(s)" or "Engine" in its text or in what a screen reader says; it reads "Agree the brief", "Parts" and "Studio helper". Code ids stay.
- Me has a closed "How Studio works" fold with 3 lines; one tap opens it.
- "Open in Infinity" shows only when an item has an https startinfinity.com card link, and opens in a new tab.
- Every page is two taps or fewer from a bottom tab. At phone width no tab scrolls sideways and the last button clears the tab bar.

**Studio** (`tests/mocked/studio.spec.js`, data in `tests/fixtures/studio/state.js`)
- No `studio-state.json` on Drive: the example banner shows, example brands show, every write button is off, and nothing is written.
- The real state: TEST stamp, engine On with its last run, budget pill, and Me lists Review, Gates and Tasks. TEST items show only with the TEST switch.
- Every tab opens its own view and lights its tab. A brand chip filters Assets, the address carries it and a reload keeps it.
- Approve writes one `approve` request into the requests folder and shows "✓ HH:MM · applies by HH:MM"; Undo trashes the file. Redo sends its note. A gate verdict and a new idea each write one file.
- Accounts: owner and client stay apart. Account chips filter (hidden with one account); requests carry `accountId`; an idea cannot mix two accounts. The example shows one owner and one client.
- Tools: a meter at 85% shows its warning and the Tools tab counts it.
- Groups: Group chips sit at the top of the find bar and filter (hidden with one group). Brand cards show their group.
- Kits: playbooks in outcome columns, packs, kits with their needs, styles (frameworks, voices, looks), formats.
- Asset rows show framework, format and variant chips, and a Master link on a variant.
- New brief: group filters brands; More holds playbook, kit, style, formats, language, length, variant and sources; Send writes them all. A variant needs a purpose.
- Add tool writes one `tool` request. Gaps list what no owned tool can do. A tool we do not own has no meter.
- Done on a Task writes `done` with the credits used. A set-up tick writes `check` and shows at once.
- A `javascript:` link becomes a dead link, and a double tap on Approve writes only one file.
- An engine that last ran over an hour ago shows a red pill. A failed refresh keeps the page and says "Offline".
- Five bottom tabs (Me, Decide, Do, Line, Kits); every older page opens under its tab with a sub-row of links.
- Books: part progress and Add part (writes `part` with the next order). Feedback: stars and reasons go with Approve. A suggestion is accepted with one `suggestion` request.
- Search and sort everywhere: Decide and Do have the find bar; Tools, Kits and Brands have a search box; Tools sorts by name, most used or resets soon; new sorts (due date, priority, name, results) and Where, Series and Kit filters.
- Board: Line has a column per stage that scrolls inside itself, details open on the right, and the page does not scroll on a desktop; Decide keeps Gates and Review as columns. Board/List is kept per page across a reload; the phone starts on List; a phone board opens details under the card with no sideways scroll. The Look menu changes the page, is stored in `dash-look`, and survives a reload (Mode Dark gives a dark page).
- Find bar is one row (Search · Filter · Sort): every filter group sits in the Filter panel, active filters show as removable chips, the Filter button counts them, Esc/Done/outside click close it and focus returns, Search keeps focus while typing; on the phone the panel is a sheet above the tabs. Every control type hovers with its 1px edge turning ink (selected the same) and nothing moves.
- Steps are words ("Step N: Name"), counts wear one ring (needs-you counts rose), no solid colour fills, two pill sizes (24 / 36 / 44 px), one 12px radius, two font weights (400, 600), empty columns shrink, titles stop at two lines. Phone header has one More menu. Dark mode tour (device and Look › Dark, warm and cool): text 4.5:1, rings 3:1. No warm grey on Cool clear.
- 390px: no sideways scroll on any tab, Kits section, or open form. Dark mode: dark page, every word at least 4.5:1. No text under 13px.

**CD Hub**
- Opens, asks for sign-in, then reads the sample `BLD-*` tables.
- Dated hiding in the save script's read (Lisa 15 Nov 2026, Q3): optional visibility columns row_id, role_code, from_date, to_date and source. A row_id row hides one record (field *) or one cell (sent blank), and can never show more; a dated row counts only from .. to, both days included; an unreadable date keeps a hide in force and a show out; role_code names the role when audience_id is blank; the person's and the role's hides both apply. With no new columns the read is unchanged. (`cdhub-write/tests/read-role.test.js`)
- All ten sections open (Live feed, Outstanding, Table map, Today, The round, Dogs, Areas, Litters, Vet link, Buyers).
- Dogs, cabins, litters and weights from the sample files join up correctly.
- BFFs / Fren. (Lisa 13 Nov 2026): a dog card and its kennel print card show the dogs it likes to sleep with and the dogs it does not mix with, from dated BLD-subject_link rows read both ways (an ended link does not show); the words come from link_kind.* rule rows. No link file: nothing shows and the page still loads. (`tests/mocked/cdhub-dog-card-room.spec.js`, `tests/mocked/cdhub-litter-print-card.spec.js`, `cdhub/staff/lib/test/links.test.mjs`)
- Edit, archive and delete with a code (Lisa 15 Nov 2026, Q1/Q2): OFF until RECORD_EDIT_ON, listed in the status. Who may is BLD-permission rows (person beats role, ended rows do not count), else owner edits and archives and nobody deletes. Every edit writes one change-log row with old and new values, unless the rule row edit.log is no or the person may edit_unlogged; edit.reason_required asks for a reason; with no change-log file nothing changes. Archive sets the end date and keeps the row; delete is refused while the row is inside its kept period (the owner's retention row for the section, else the fallback years) and otherwise logs the row's last values first, then removes it. The change log can never be removed this way. (`cdhub-write/tests/area-link.test.js`)
- One file store, file_add (14 Nov 2026): behind TABLE_ON_files; who may add is the owner rule row file.who_may (roles and/or person:<code id>; blank = owner only; the owner always may); a photo or upload is stored in the FILES_FOLDER_ID folder under a neutral name with one BLD-files row (sha256; set_on = London day, created_at UTC, set_by = the code's public id); the bytes must match the claimed type; links are https only; the same bytes are not stored twice; a link needs no folder; allowed types and the size limit come from owner rows file.types / file.max_bytes (none set = refused). (`cdhub-write/tests/files.test.js`)
- Save practice run (15 Nov 2026, "get all saving on"): for every write path in the save inventory, with only that path's switch on, one invented save lands only in the files it should, every other file is unchanged, a staff read with no visibility rows gets nothing, and a wrong or missing code is refused with nothing written; the owner-page code register and the staff table (still refused) are checked too. The new `?status=1` status lists every switch by name, applies no waiting room move and writes nothing; `adminCountQueued` counts waiting rows and writes nothing. One test records that a waiting dog-left row is applied by a plain status read (not fixed yet). The inventory table in `cdhub-write/AA_SAVE-INVENTORY_*` must match the code. (`cdhub-write/tests/practice-run.test.js`)
- BLD schema v2 tables, written down only (15 Nov 2026): parties, products, lots, stock movements, courses, doses, prescriptions, product dose bands, certificate kinds and certificates are known to the save script but refused whatever their switch says; the checks are ready for when one is moved in: names and kind keys in the plain lower-case form, an end date never before the start, a dose's lot must be of the same product, a course step within the course, owner-only adds except stock movements and doses (owner and staff). (`cdhub-write/tests/schema-v2.test.js`)
- Print dates (Lisa 13 Nov 2026): kennel and litter print cards show dates as `2 Mar 2026` (one format everywhere), never DD/MM/YY; DOB is checked on the kennel card. (`tests/mocked/cdhub-litter-print-card.spec.js`)
- Dog photos, main + gallery (Lisa 13 Nov 2026): the dog card's main photo is the `main` link row in force (the old photo cell only as fallback); **Photos (n)** lists open gallery links newest first (photos, uploaded files, links with safe addresses only) and ended ones under Ended (n); pictures load only when their list is opened; the kennel print card uses the main link. Words from link_kind.<role> rule rows. No files or link tables: nothing changes. (`tests/mocked/cdhub-dog-gallery.spec.js`, `tests/mocked/cdhub-litter-print-card.spec.js`, `cdhub/staff/lib/test/photos.test.mjs`)
- New row ids (Lisa 15 Nov 2026, Q4): every row the save script adds gets its table prefix and 8 random letters (e.g. `rdg-7k2q9xbm`), never a date or a name; a new dog's id no longer comes from its name; existing ids are kept. 5,000 ids in a row are all different. (`cdhub-write/tests/dogcard.test.js`, `sink.test.js`, `v3.test.js`)
- Add in place on the dog card (Lisa 15 Nov 2026): tapping **no weight** opens the weight section with Add weight inside the card (no panel at the top, no reload, no jump); the save ticks there and the new weight shows at once; each weighing shows its change from the one before; **no chip recorded** opens Edit at the microchip box. (`tests/mocked/cdhub-dog-card-add-in-place.spec.js`, `tests/mocked/cdhub-dog-card-1112.spec.js`, `tests/mocked/job34-cdhub-views.spec.js`)
- A dog or pup with no room has Place on its card; the cabin picker lists cabins with space (a pup with its dam counts once, against the dam's '+ pups' row) and Off-site for a dog in a cabin; a move is one occupancy or occupancy_out row through the save script and the card shows "moved ✓". (`tests/mocked/cdhub-dog-card-room.spec.js`)
- The weighings panel shows date, weight, change and BCS only; the sheet's source column is not shown. (`tests/mocked/job34-cdhub-views.spec.js`)
- Litter print cards look like kennel cards (band in the dam's size colour, Born, Sire, Pups, Room, one large code, 1, 2 or 4 per A4) and list only litters still on site; room cards show the footer line. No print-out shows an address: no printed text holds the site address, and the print page margin is 0 so the browser cannot add its own header or footer. (`tests/mocked/cdhub-litter-print-card.spec.js`)
- Print any item (20 Nov 2026, `tests/mocked/cdhub-print-item-card.spec.js`): **Item cards** prints one card per item (a correction row is the same item, showing its latest values) in the dog card layout. Each value prints under its label; the name has none, and an empty value prints nothing. The fields come from the owner's dated `print.fields.item(.<kind_key>)` rows (newest in force wins; one item type can differ), and labels from `print.label.<column>` rows. A choice ticked on the page is used at once and can be saved as a new dated rule row. An existing tag is reused, and an item without one gets one saved first. In print: two per A4, a QR of 60 mm or more, the photo fitted whole (contain), and the picker never prints.
- Dog card v4 (Lisa's approved 15 Nov design, re-confirmed 20 Nov 2026; `tests/mocked/cdhub-print-dog-card-v4.spec.js`): 2 per A4, cards about 194 x 138 mm with a dashed cut line between. The name is large with no label; Sex and Date of birth are labelled; the Size tile top lines up with the photo top; the QR prints 62 mm of black squares, its bottom lines up with the photo bottom and its white border stays clear of the tile; the microchip is labelled under the photo. No tag code, room or access text; Chrome's PDF has 2 cards a page.
- QR on add (20 Nov 2026, `cdhub-write/tests/qr-on-add.test.js`): adding a dog, an item or a thermometer writes one qr_tag row in the same save when the owner's `qr.on_add.<kind>` row says yes. It writes none when the row says no, when there is no row, or when `TABLE_ON_qr_tag` is off. A newer effective_from wins, a row not yet started or already ended changes nothing, one item type can differ, a correction row keeps the first row's code, and an existing tag is kept. The save script and the browser helper agree. The back-fill dry run prints counts only, writes nothing, and adds 0 the second time.
- Lisa's room and dog cards (18 Nov 2026). Room card: name, a colour line, Access / Room size / Mum + pups (S/M/L), then Small, Medium, Large each with a dog per place and `= n` in the size colour, a dashed "No large dogs" at 0, the code, and the footer (owner row `room_card.footer`, else "Unsure? Don't Move. Ask."). Limits come from the area_capacity rows in force for the room's access today (the latest access row by from_date); no rows says "No limits set" instead of numbers. Dog card, two per A4 with a cut line: name, Sex with its sign, Date of birth, photo framed in the size colour, "Size: Medium" block (owner size_label rows), one large code, microchip in threes. Codes are saved to BLD-qr_tag before any card is drawn. (`tests/mocked/cdhub-core-rooms-dogs.spec.js`, `tests/mocked/cdhub-size-midpoint.spec.js`, `tests/mocked/staff-setup-qr.spec.js`)
- Printed QRs open the public staff page (Lisa 18 Nov 2026: staff, guests, vets and inspectors have no Cloudflare sign-in): the owner's `qr.base_url` rule row in force (https, ending `/`), else `https://ljoyrose.github.io/dashboard/cdhub/staff/`; never the address of the page doing the printing. Dog, room and set-up QRs alike; no address printed on the card. (`tests/mocked/print-qr-base.spec.js`)
- Show help (Lisa 18 Nov 2026, demo de-clutter): help and explanation lines carry class `help` and are hidden, not deleted, until the person turns on Show help (off by default). On the staff page the switch is on This phone (`role=switch`, kept on that phone with the Look); on the hub it is the Look menu's Help row. One class on the page, `.show-help`; data and empty-state lines are never `help`. (`tests/mocked/show-help.spec.js`, `tests/mocked/show-help-hub.spec.js`)
- Scans (Lisa 18 Nov 2026): a room scan shows "Here now", the dogs in the room, each opening that dog's jobs; Move dogs stays below. Jobs list daily first, then less often (a group by its most frequent job), as needed last, A-Z within, from the owner's every_days. (`tests/mocked/staff-jobs.spec.js`)
- Print card size (18 Nov 2026, `tests/mocked/cdhub-print-size-word.spec.js`): the kennel card shows the size word only (Small, Medium, Large), never a kg range, in the size colour from the `size_colour.*` rows. Size comes from the one helper the CD Hub dog page also uses (`BLDCapacity.sizeForDog`): an owner size override, else the latest weight, else the middle of a typed kg range, against the dated `size_from_kg.*` rows. Checked: 9.9 kg small, 10 kg medium, 24.9 kg medium, 25 kg large and 25.1 kg large (25 kg and above is large: live row and Lisa 20 Nov 2026); no weight and nothing typed prints no size; a newer `effective_from` beats an older row and a row not yet started changes nothing.
- Print pick list (22 Nov 2026, `tests/mocked/cdhub-print-pick.spec.js`): after Room, Dog, Litter or Thermometer cards, one tick box per card, all ticked to start, with Select all and Unselect all (shared helper `cdhub/staff/lib/pick-list.js`). Only ticked cards draw, print and can get a new code saved; nothing ticked prints nothing and says so; the list never prints. `?sign=<area id>` ticks only that room.
- An Areas room card shows today's temperature in The round's words (one line per thermometer when a room has two or more), an out-of-range reading as a ring, the limit from the band rows, and a Temperature history link; a room with no thermometer has no line.
- A dog card shows the weight change (↑ 0.3 · 12/01/26), the last medication date, DNA as clear / carrier / affected pills, and litters as dam with the last one; the litters line opens Litters for that dam. The card header shows DOB (DD/MM/YY) and the colour (no 'Colour' word), the room icon stays small on a phone, and the status chips sit inside Filter so the first dog shows on a phone. Size comes only from the latest weight using Lisa's `size_from_kg.medium` / `size_from_kg.large` rows (each needs a source; a future row is not in force); each row starts its size, so 25 kg and above is large (Lisa 20 Nov 2026: small under 10, medium 10 to under 25, large 25 and above); no rows or no weight means no size. The size words are the owner's `size_label.*` rows (newest in force), else Small / Medium / Large. The photo has a 3px frame in the size colour (small orange, medium green, large blue unless Lisa's `size_colour.*` rows say otherwise), the size word sits beside the weight, and the room check uses the same size. Vaccinations show the count, the last date and the next due date written on the card (marked when it has passed). (`tests/mocked/cdhub-dog-card-summary.spec.js`)
- A dog card shows the picture in the subject `photo` cell when that cell holds a Drive file id or a Drive file URL, and the paw when the cell is empty or the picture will not load. Take photo opens the camera (the phone's camera app; on a laptop the page's own camera view) and Upload photo opens the library or files; both accept images. Before save the picture can be cropped, rotated and made lighter or darker or given more or less contrast, and the sheet shows the saved size (always 800 x 800 within 350,000 characters) (`tests/mocked/cdhub-dog-photo-take.spec.js`, `tests/phone/cdhub-dog-photo-crop.spec.js`). A successful upload sends that dog's id to the save script and the card keeps the new file id. A failed upload says so on the card and leaves the card as it was. (`tests/mocked/cdhub-dog-photos.spec.js`)
- Dog card, 12 Nov 2026: the photo opens a square crop step (drag, pinch, Rotate 90°, Use photo, Cancel) and always sends an 800x800 JPEG of 350,000 base64 characters or less; Cancel sends nothing; a HEIC picture says to try a screenshot. (`tests/mocked/cdhub-dog-photo-crop.spec.js`, `tests/phone/cdhub-dog-photo-crop.spec.js`)
- Dog card, 12 Nov 2026: a small weight graph on the card and a labelled one in the weighings panel; Add weight saves as action `weighing` and every size mark follows the new weight; vaccine codes read as words; Add vaccination; on any vaccination the owner may Archive (hidden, kept, listed under Archived) or Delete forever (asks first, cannot be undone; owner only in the save script, `cdhub-write/tests/dogcard.test.js`) (Lisa 17 Nov 2026); no role badge or code letters; the microchip is a plain line; Edit details sends only the changed fields as `dog_details`; the licence counts are one bar; Place on the Today lists saves a move through the save script; a saved reading shows at once in the Round count and Kept readings; Empty marks a cabin slot `room_empty`; the staff page's saved address and code are reused. (`tests/mocked/cdhub-dog-card-1112.spec.js`)
- Dog card, 12 Nov 2026: the Breed Better section has the logo, verdict, score bar against the target and the four must-pass checks, and opens the dog's Breed Better page. (`tests/mocked/cdhub-dog-card-bb-section.spec.js`)
- There is no Vet link page and no Animana patient id on screen (Lisa, 12 Nov 2026: not relevant); an old #/vet address falls back to the Map.
- Dated limits: room limits and size cut-offs are read as at the day being checked (from_date / to_date, to_date included, blank = open), with the weight on or before that day, so a later rule never makes an old placement look wrong.
- Dog card layout A (Lisa, 12 Nov 2026): weight, medications and chip show on the card; health findings, vaccinations, DNA, litters, Moxiclear Rx and job history sit behind More, closed by default (`tests/mocked/cdhub-dog-card-summary.spec.js`).
- Dog card Documents (Lisa, 17 Nov 2026): under More, a dog's documents are the files linked from the dog (BLD-links to BLD-files), labelled by the BLD-doc_type row whose code is the link's role, newest first, each opening in Drive. Photos (main, gallery), ended links, future links and other dogs' files are not listed; no documents says so. (`cdhub-write/tests/docs-view.test.js`, `tests/mocked/cdhub-dog-documents.spec.js`)
- SOPs (Lisa, 25 Nov 2026): every SOP has a way to record it and a Print records link. A check whose SOP column matches, or whose type name is the known one for that SOP, keeps the job form. An SOP with no such check, including a licence or notice that is only looked at, has Checked today (one whole-site row; the check type is added the first time). Print records prints this month from Yearly print for that SOP's records (the check log and the tables Yearly print already covers). A SOP Yearly print does not cover uses the Checks register. (`tests/mocked/cdhub-sop-records.spec.js`)
- Print on A4 (13 Nov 2026), checked on Chrome's own PDF on desktop and phone: The round prints as a two-column round sheet (no bars, menus or buttons; blank am/pm min/max boxes; 16 cabins on 3 pages); Dogs prints two whole cards a row with each photo filling its square box; dog cards print Full A4 (one a page), 2 per A4 (two on a portrait sheet, one above the other with a cut line: Lisa's design, 18 Nov 2026) and 4 per A4 with nothing clipped, the QR at least 66, 55 and 35 mm, and the status line off the paper; room cards two a sheet, each whole, QR at least 50 mm. A device in dark mode or Look > Dark prints dark text on a white page and goes back to dark after. (`tests/mocked/cdhub-print-a4.spec.js`, `tests/phone/cdhub-print-a4.spec.js`; `CDHUB_PRINT_PDF=<folder>` keeps the PDFs.)
- A dog's room is its occupancy row with the latest moved_in, even when an older row comes later in the file. A move row with a blank classification keeps the dog's licence label from its latest labelled row, so the dog stays on site (`tests/mocked/cdhub-compliance-urgent.spec.js`).
- Staff room lists (Where, moves, checks) run by each area's group_sort, then its code in natural order (3B.4/5 before 3B.9/10); no list in code (`cdhub/staff/lib/test/room-order.test.mjs`).
- Where is everyone? offers only sleeping rooms (rooms with room-limit rows in force today, read from BLD-area_capacity), labelled by code only; Off-site is its own button, beside Save move (`tests/mocked/staff-where-rooms.spec.js`).
- Two files with the same name are refused, not guessed.
- Missing files are reported, not hidden.
- Saving stays switched off.
- Sign out forgets everything.
- Temperatures today keeps Morning, Evening, Rooms and Outside today as rows. The next outdoor days sit in one sideways strip (weekday, min–max, Cold / OK / Hot, rain none / light / wet, and Windy only from 40 km/h). Today is named Today. Outside uses the phrase only. The hub page does not scroll sideways. The history page is titled Temperatures. The round is the first tab: indoor tiles, then a short °C table in kennel walk order, then Outside. It does not show Source or the reading kind. Year chips run 2026, 2025, 2024, with 2026 open. Archive is its own page. (`tests/mocked/cdhub.spec.js`, `tests/mocked/history-area-sheet.spec.js`)

**CD Hub click-crawl, The Round and the hover rule** (13 Nov 2026; invented 27-animal set in `tests/fixtures/cdhub-27`, written by its `make.js`: Dog A01..A20, Pup P01..P07, Room 1..8; the clock is pinned to 10 Mar 2026)
- Click-crawl (`tests/mocked/cdhub-crawl.spec.js`, engine `tests/support/click-crawl.js`): on a desktop and on a 360px phone it taps every visible, enabled control on every hub screen (the screens come from the bottom bar and the More list), on the Temperatures page and on the staff page, breadth first, and into the panels a tap opens. Each tap is filed as LOOP (round to the same screen, or one item followed for 2 to 4 taps comes back), DEAD (nothing changed, nothing said), ERROR (browser error), ESCAPE (an address that is not ours), WORDING (empty heading, "undefined", a raw key, a bare code, a doubled word, no name, sideways scroll) or fine. It must find none, and must have visited at least 95% of the controls it could reach; it prints the number. Calendar days are sampled (the first two and the last of each kind) and counted apart.
- The screens Lisa hid (Assocs, Table map, Litters, Vet link) are never walked. Their old addresses open Main once PR 472 lands; until then they are noted as switched off. The answer is the same before and after.
- The click map (`docs/cdhub/CLICK-MAP.md`: screen, control, where it goes, what happens) is written by `node tools/cdhub-click-map/make.js` from the crawl's own results.
- The Round (`tests/mocked/cdhub-round.spec.js`): every button on the staff temperature round and on scan and move, with the save script pretend. Each save is tried with the script answering OK, out of reach, and refusing. A card ticks only after the reply is OK; a failed save says so, keeps what was typed and can be pressed again without saving twice.
- Hover (`tests/mocked/cdhub-hover.spec.js`): one of every kind of control on every hub screen is hovered and pressed, and what the browser draws is read: the house pale grey fill, no line, 12px corners. One known exception is parked for Lisa (Main's Next card, shared by every hub).
- Small controls (`tests/mocked/cdhub-taps.spec.js`): an (i) says its words when tapped; Clear filters is off until there is something to clear; headings still fold after Skip to content; Compliance and The round do not scroll sideways at 360px; a switched-off screen is not offered.
- What the crawl cannot judge: a form with a required box is only pressed empty (the filled save paths are in The Round spec and the dog-card tests); a list row with no hand cursor is not treated as a control.

**Money Hub**
- Opens, then needs a sign-in.
- Only Lisa's account gets in. Any other account is turned away and **no figures are read**.
- All six sections open (Now, Money, Dates, To-do, Accountant, Control).
- "← Dashboard" goes back to the main dashboard.
- Sample ledgers show the right cash, overdue items, dates and to-dos.
- A missing, doubled or wrongly-shaped file shows as an error. It never quietly uses an old one.

**Bin safety**
- A folder with an `RR_` item anywhere inside is **left alone**, with a note saying why.
- A `ZZ_DELETE_` folder is binned only when every item inside is junk or itself marked (exact prefix plus a ledger row). Anything else, including an ordinary file, is left alone and the note says why.
- A file inside an `RR_` folder is **left alone**.
- A zero-byte file is **UNSURE** and is never ticked or binned. An odd prefix spelling (different case, spaces or hyphens) is listed under Rename needed and is never binned.
- The bin button shows a dry-run count and asks you to confirm. Trash only. Before anything is binned, the page reads it again and skips it if it changed, is already in the bin, or (on My Drive) is owned by someone else.
- A name containing `RR_`, a `ZZ_DELETE_` file with no ledger row, and a retired `ZZ_SUPERSEDED_` name cannot be ticked.
- A name that merely contains `ZZ_DELETE_` in the middle is not listed.
- If the delete ledger or a pending slip cannot be read, nothing is binned.
- Move selected acts only on ticked rows that are on screen. On a list of 52 with 50 shown, Select all moves 50. Show all, then Select all, can reach all 52.
- A personal `ZZ_DELETE_DRIVE_` file is binned only when it is ticked and has a ledger row. `RR_` in the name is left out.
- A money rollback file is labelled "Held: money rollback (E02), do not touch until FIX 6 is confirmed" and is not ticked or binned, even with a ledger row and Select all. The two filename patterns are held anywhere. Files in 0.1 - Index or the CHECK-LOG 4 - Ops folder are held by those folder ids only. A ledger-backed `ZZ_DELETE_` file in another folder named 4 - Ops, or in a differently id'd folder named 0.1 - Index, is still binned.

**Never empty the bin**
- Each page is opened (main dashboard, CD Hub, Money Hub, and their sections).
- The check fails if any request permanently deletes a bin (a DELETE to a trash address).
- The check fails if a page's source contains the old empty-bin wording.
- The same wording is also searched for in the page files themselves, without opening a browser.

**PC-Personal and Drive check (these rename and bin real files, so they matter most)**
- Every write goes to a pretend Drive or a pretend plugged-in drive that only exists in memory. Nothing real can be renamed or binned.
- PC-Personal "Rename selected": with nothing ticked, nothing happens. It asks for the extra permission, then asks you to confirm. Cancel changes nothing. Confirm renames **only** the ticked files that match a live kept copy in a shared drive, adds `ZZ_DELETE_DRIVE_`, and never touches the shared copy, a file with no match, a zero-byte file, or a name containing `RR_`. A shared copy does not count when its name is a `ZZ_` variant, when a `ZZ_` or `AA_HOLD_` folder sits above it, when it is a shortcut or a Google file with no checksum, or when it is on an excluded drive (matched by id or by the drive's name).
- PC-Personal "Move selected": finds files starting `ZZ_DELETE_DRIVE_`, and moves only the ticked ones that have a ledger row (never deletes). A folder is included only when every item inside is verified or junk. A name containing `RR_` cannot be ticked. A file owned by someone else is skipped.
- If a shared drive cannot be read, the scan finishes, says that drive was not used as proof, and Continue reads just that drive again.
- Drive check uses the same kept-copy rules. It ignores tiny and system files, counts zero-byte files as UNSURE, lists odd prefix spellings, and renames only the ticked matches (`ZZ_DELETE_LOCAL_`). A name containing `RR_` cannot be ticked. Deletes nothing. If the shared-drive read was incomplete, the "only on this drive" line says so, and Continue tries the missed drives again.

**Header contract**
- The file `tests/contract/expected-headers.json` lists the **column names** (names only, no figures) each Drive file should have.
- The robot checks that the sample files, the page code and that list all agree, and that the pages still read the columns they read before. A column renamed in the page or in the samples turns the tick red.
- This is how a renamed column gets noticed even though the pretend Drive can never rename one. To check your **real** files, see "Check your real column names".

**Food Hub card notes** (`tests/mocked/food.spec.js`, `tests/mocked/job34-food-states.spec.js`, invented rows)
- A note typed on a card is written in column H when the card is marked done: answer, note, time, and whoever is signed in.
- Save note with no answer appends one row on the Comments tab: at, key, title, text, by.
- An empty note writes nothing. Save note stays off until there is text.
- A missing Comments tab shows the usual missing-tab notice and the page stays up.

**Hub data contracts (Food, Marketplace, Studio)**
- `tests/contract/expected-headers.json` also lists the RR_FOOD tabs and the Marketplace Open work tab and RR_LISTINGS.csv. `tests/contract/expected-state.json` lists the field names and types inside `studio-state.json` and the Marketplace wake file.
- Each hub has invented sample data. If an engine drops, renames or adds a column or field, puts the wrong kind of value in it, or writes an empty file, the robot names the kind of change: MISSING, RENAMED, EXTRA, WRONG_TYPE or EMPTY.
- The checks run each page's own reading code on the samples. `CONTRACT_PROVE_RED=1` flips every failure case, so you can see each one go red.
- Product ideas (card detail and request file): `tests/contract/marketplace-ideas.contract.spec.js`, field lists in `tests/contract/expected-ideas.json`, rules in `marketplace/ideas.js`. See `docs/marketplace-ideas/CONTRACT.md`.
- Rebuild the lists after a deliberate change: `node tests/contract/make-expected.js`, then read the diff.

**Reading CSV files**
- Commas inside quotes, quotes inside quotes, line breaks inside quotes.
- Windows line endings, a blank last line, short rows, empty files.
- A hidden marker at the start of a file (a "BOM"), including in front of the "CURRENT: 3 rows held" line.
- The first line the Money files carry ("CURRENT: 3 rows held"), and a warning when the count is wrong.

**Safety checks**
- No passwords, keys or tokens in the files.
- The sample CSVs are invented (only `example.test` email addresses).
- The pages only load Google sign-in and Google Fonts by themselves.

## What is pretend and what is real

| Thing | In the tests |
|---|---|
| Google sign-in | **Pretend.** A stand-in answers "signed in" instantly. No Google window opens. |
| Google Drive | **Pretend.** A small fake Drive lives in memory and answers the same questions. |
| Spreadsheets (CSV) | **Invented samples** in `tests/fixtures/`. Fake names, fake figures. |
| Your Google account | **Never used.** No password or key is needed. |
| The web pages themselves | **Real.** The actual files in this repo, served on the test machine. |
| The browser | **Real.** A genuine Chrome-type browser. |
| Google Fonts (the look) | Answered empty, so the tests need no internet. |

Because Drive is pretend, a green tick does **not** prove your real Drive folders are in order. It proves the pages behave correctly when Drive gives them the right kind of answer.

## When does it run?

- **On every pull request**, and again each time a change is pushed to it (a newer push cancels the older run).
- **On every push to main**, as the gate of "Publish site (after tests)": nothing is published unless it passes.
- **Every night about 03:17 UTC**, unless main has had no new commit for 26 hours.
- **Whenever you press the button:** GitHub > the **Actions** tab > **Dashboard tests** > **Run workflow**.

Each run writes a short table at the top of its page in the Actions tab: one line per page, with passed and failed counts.

There is also a small **optional** check of the three live web addresses. It opens them signed out and confirms they are up. It runs **a minute or so after every publish to the live site** (so a bad merge is noticed in minutes), on Mondays, and on the button. It never blocks anything, because GitHub Pages can have a slow day. It also checks that **what is live is exactly the file that was merged** (compared byte for byte, waiting up to 90 seconds for GitHub Pages to finish). It has run after the last two publishes and passed.

Every Tuesday a separate **"teeth check"** breaks things on purpose in a throw-away copy (a wrong link, a lost safety rule, a renamed column, a page too wide for a phone, and so on) and makes sure the tests go red each time. If one slips through, it turns red and opens an Issue. It cannot block a merge.

## How to run it on your own computer (optional)

You need **Node.js** (the free program that runs the tests) version 22.

1. Open a terminal in the `dashboard` folder.
2. Install the tools. Do this once:
   ```
   npm ci
   npx playwright install chromium
   ```
3. Run the tests:
   ```
   npm test
   ```
4. Read the pretty report:
   ```
   npm run report
   ```
5. To watch the browser work, use `npm run test:headed`.
6. To also check the live site, use `npm run test:live`.

It takes about 90 seconds.

## If something goes red

1. Open the failed run in the Actions tab.
2. Read the table at the top. It names the page.
3. Download **playwright-report** at the bottom. It has a screenshot and a replay of each failure.
4. Send the link to your builder. It is not urgent unless it is the Money Hub or the Bin.

**The Issue rule (one short paragraph).** When the Monday run (or any scheduled or hand-started run on `main`) goes red, the robot opens **one** GitHub Issue named "Dashboard tests are red: " plus the failing page, and GitHub emails you. If it is still red next time, it updates that same Issue (no second one). When a run on `main` is green again, it closes the Issue by itself. The branch-protection watch ("Branch protection needs a look") also has its own single Issue. The live-site check has its own single Issue ("Live site check is red") and the teeth check has its own ("Teeth check failed"), so a Pages hiccup never hides a real test failure. To prove the alarm really works, press **Actions > Alarm fire drill > Run workflow** once: it opens, re-uses and closes a clearly-labelled TEST issue (expect about 3 emails headed "FIRE DRILL", all safe to ignore). Nothing here uses Slack, webhooks or any new secret.

## Make the tick compulsory (branch protection)

This is what turns the tests from "advice" into "protection". It needs your admin rights on GitHub, so it is one thing for you to click (the robot that built this was not allowed to change repository settings). **Status: it is ON (checked 16 Oct 2026 against GitHub itself).** If you ever need to redo it, the steps are below. A weekly "protection watch" re-checks it every Monday and opens one Issue if it is ever switched off.

1. GitHub > the **dashboard** repository > **Settings** (top row).
2. Left side: **Branches**. Click **Add branch protection rule** (or **Add classic branch protection rule**).
3. **Branch name pattern:** type `main`.
4. Tick **Require a pull request before merging**. Leave "Required approvals" at **0** (you are the only person, so you could not approve your own).
5. Tick **Require status checks to pass before merging**. In the search box type `Browser tests` and pick **Browser tests (pretend Google and Drive)**. (It only appears in the list because it has run recently. If you cannot find it, open the Actions tab, run "Dashboard tests" once, then try again.) Then type `Privacy guard` and also pick **Privacy guard (public repo)** (the check that blocks private material; this repo is public). **Status of this second check: not yet added (waits for Lisa's settings visit, after the PRIVACY_DENYLIST secret is saved).** Until it is added, the weekly protection watch reports it.
6. Tick **Do not allow bypassing the above settings** (this makes it apply to you too).
7. Leave **Allow force pushes** and **Allow deletions** **unticked**.
8. Click **Create** (or **Save changes**).

What changes for you: nothing can go straight into `main`; every change comes as a pull request, and the green **Merge** button only lights up when the tests are green. A red tick means "fix it first". If you ever need to bypass it in an emergency, untick step 6 for a moment.

Do not rename the job "Browser tests (pretend Google and Drive)" in `tests.yml`, or "Privacy guard (public repo)" in `privacy-guard.yml`. If it is renamed, merges stick on "Expected, waiting for status" and the rule must be edited to the new name.

## Publishing waits for the tests

**The problem it fixes:** GitHub Pages publishes every merge to `main` straight away, at the same time as the tests run, and it publishes the whole repo (`docs/`, zips, `TESTS.md`, test fixtures, gate rules), so they can all be read on the web.

**What was built** (finishing the Job 6d branch): a workflow called "Publish site (after tests)". On every merge to `main` it runs the same tests as the required check first. It publishes only if they all pass, and it publishes only `index.html`, `auth.js`, `config.js`, `toolkit.js`, `tokens.css`, `cdhub/` and `money/`. Tests check this, including deliberate breaks that prove they would catch a publish that skips the tests or includes too much. A test also fails if a page refers to a file that would not be published.

**Lisa: one click, once.** GitHub > **dashboard** > **Settings** > **Pages** > **Build and deployment** > **Source** = **GitHub Actions**. Then press **Actions > Publish site (after tests) > Run workflow** once. Until you click, the workflow does nothing harmful: its summary says "Waiting for Lisa's one click", and the old branch publishing carries on.

**To undo it:** Settings > Pages > Source > **Deploy from a branch** > `main` > `/ (root)` > Save.

**Also needs one click:** GitHub Issues are switched off on this repo (checked 18 Oct 2026), so the alarm can't open an Issue. Settings > General > Features > tick **Issues**. The Monday protection watch reports it until then.

## Check your real column names (optional, on your computer only)

The pretend Drive cannot tell us if a column was renamed in your real files. This little script can, without any sign-in:

1. In Google Drive, download the files to check (for example the Money index files and the `BLD-app-tables` files) into one folder on your computer.
2. In a terminal in the `dashboard` folder: `node tests/contract/check-real-headers.js /path/to/that/folder`
3. It prints `ok` or `PROBLEM` per file and names any missing or renamed column. It reads only the top of each file, prints column names only, never values, and sends nothing anywhere.
4. Food, Marketplace and Studio too: download each RR_FOOD tab as CSV (`RR_FOOD - Orders.csv` and so on), the Open work tab (`… - Marketplace.csv`), `RR_LISTINGS.csv`, `MKT-WAKE-WEBAPP.json` and `studio-state.json` into the same folder. Add `--counts` to print counts only. `--dry-run` tries it on the invented samples.

GitHub does not run this one, on purpose: it would need a Google key stored in GitHub, and none is stored.

## Decisions you have made

**PC-Personal leaves `RR_` names alone (decided 17 Oct 2026).** A personal file whose name contains `RR_` is not renamed and is not binned, even when it is an exact copy of a shared-drive file and even when its id is in the delete ledger. The same rule applies on the Bin page and on Drive check. A test pins this, so a later change has to be discussed first.

## Known gaps in looks and reading (not new, now written down)

- **Colour contrast** (text hard to read against its background) is flagged by the accessibility check in some places: main dashboard 7 spots, CD Hub up to 8.
- **Small text:** the CD Hub has text as small as 10.5 px; the other two pages start at 13 px.
- **Heading order** on the main dashboard and CD Hub skips a level.
The check only fails if these get **worse**. When one is fixed, the number in `tests/mocked/look-and-access.spec.js` is lowered so it can never creep back.

## Caught after merge (and how to add to it)

Each line is a bug that got past the tests once, and the test that now stops it. These tests have `@regression` in their name, and every run's summary counts them.

| Date | What went wrong | Test that now guards it |
|---|---|---|
| 8 Oct 2026 | CD Hub: the Litters page crashed, and occupancy was read from the wrong column (commit `2242bac`) | "joined tables work: cabins show their dogs, litters show dam and sire…" (covers Litters and occupancy; the Animana record choice is **not** yet covered) |
| 15 Oct 2026 | (found by the teeth check, not a live bug) a hidden marker in front of the "CURRENT" line made the row-count warning disappear; and the rules that stop a `ZZ_` folder holding an `RR_` item being binned had no test | "a BOM in front of the…" (the "CURRENT: n rows held" line test), and the two Bin safety tests |
| 17 Oct 2026 | A bulk move could still change rows hidden past Showing 50 of 52 | "Select all on a list of 52 with 50 shown" |
| 17 Oct 2026 | Signing in on one page asked again on Money and again on the way back | "one sign-in is shared, and an expired token does ask again" |
| 18 Oct 2026 | (found in review) CD Hub did not clean quote marks and let any link through, so a table cell could run code in the signed-in page | "CD Hub cleans quote marks and refuses javascript: links from the tables" |
| 18 Oct 2026 | (found in review) Signing out while on the Bin and signing back in broke the Bin (the Dropbox slot was forgotten) | "signing out on the Bin and back in draws the Bin with no errors" |
| 18 Oct 2026 | (found in review) The 5-minute refresh silently unticked everything you had ticked | "the 5-minute refresh keeps your ticks and waits while you have any" |
| 18 Oct 2026 | Live Bin said "The delete ledger could not be read" because the ledger now starts with a "COUNT: n rows" note line above the header | "a ledger that starts with a COUNT note line above the header is still read" |
| 18 Oct 2026 | A Google "too many requests" (429) answer failed the read straight away instead of trying again | "home: two 429 answers in a row are retried and the page still reads normally" |
| 18 Oct 2026 | Every Money reread downloaded every file again (27 Drive calls each time), even when nothing had changed | "Reread with nothing changed downloads no file at all, and stays inside the Drive call budget" |
| 18 Oct 2026 | The teeth check showed the "RR_ item inside a ZZ_ folder" guard could be removed without any test noticing (a second, wider check hid it) | "an RR_ item deep inside a ZZ_DELETE_ folder keeps the whole folder out of the bin, even with Select all" |
| 18 Oct 2026 | Same for the "ZZ_ item inside an RR_ folder" guard | "a ZZ_DELETE_ item anywhere below an RR_ folder is left alone, even with a ledger row" |
| 18 Oct 2026 | Changing screen left keyboard focus on the old menu item, so screen readers did not say where you were | "home: clicking a menu item puts focus on the screen title" |
| 18 Oct 2026 | The Map led with links and counts, so what needed Lisa today was spread over several cards | "shows at most 5 rows, overdue (red) first, each row a link, and the tab title carries the count" |
| 18 Oct 2026 | Money only said "runs dry on X" in words, so a forecast dip was easy to miss | "a forecast that goes below zero marks the runs-dry date in red" |
| 20 Oct 2026 | Factory: a send named "Links · …" for the app "LJR7 Links" was filed under "Factory", so Lisa could not find it in Do | "a send named Links · P5 sits under its app Sample Links…" |
| 20 Oct 2026 | Factory: the selected tab and chip showed a double line (a focus ring around the tab, an inner shadow inside the chip). House look, 28 Oct: a selected chip is the 1px line drawn inside, the tab only widens its bar, focus is a 2px ring | "after clicking a tab and a chip: selected chips wear the 1px inside line, the tab only its wider bar; focus is 2px" |
| 18 Oct 2026 | Phone install needs a kept copy of the site, and it must never hold Drive data or the sign-in | "after signing in and reading, the kept copy holds only the page files" |
| 18 Oct 2026 | There was no way to find a file, to-do or dog without opening each page and scrolling | "home: / opens search; it finds Drive file names per shared drive and Money to-dos, each a link" |
| 19 Oct 2026 | Lisa still signed in twice: the sign-in lived in one tab only, so Money in a new tab or window, or the installed app, asked again | "sign in on home, open Money Hub and CD Hub: each opens in a new tab already signed in, no prompt" |
| 19 Oct 2026 | CD Hub Today: "0 of 23 cabins with a temperature" did nothing when clicked (a button with no action) | "CD Hub Today: the temperature tile opens The round, where temperatures are entered" |
| 19 Oct 2026 | Hard rule 14: the Bin (and Drive, Changes, search) listed Karen - SHARED | "is in config, never queried and never shown on Map, Drive, Bin, Changes, PC-Personal or search" |
| 25 Oct 2026 | Main dashboard: the selected menu pill had lost its colour fill and showed an odd left edge, and the "You are here" title showed a square focus box after each screen change | "the selected view under More has one clean edge and the pale grey selected fill (Lisa, 12 Nov 2026); the "You are here" title has no box" (renamed 2 Nov 2026: Lisa's tab picks drop the fill) |
| 25 Oct 2026 | Marketplace V2: the bottom tab bar covered the last button on long pages (the page's bottom space was lost to the `.wrap` rule) | "the last button on a long page can always be scrolled clear of the bottom tab bar @regression" |
| 29 Oct 2026 | Marketplace: the public pages (hub and privacy policy) showed a personal email address (sign-in hint, Gmail link, contact) | "public pages hold no email address: no "@" address, no login_hint, no authuser (Stage 0A, D1 = B) @regression" |
| 29 Oct 2026 | Marketplace: the same check on what the page actually shows (text and links), signed out, on every tab and on the privacy page | "signed out, signed in on every tab, and the privacy page: no email address in the shown text or any link @regression" |
| 30 Oct 2026 | Phone install: Factory, Food and Marketplace were not on the service worker list, so they did not open offline | "@regression every published hub page is on the service worker list" (tests/mocked/pwa-and-keys.spec.js) |
| 30 Oct 2026 | Money Hub on a phone: sideways-scrolling tables could not be reached by keyboard (axe scrollable-region-focusable; CI fonts made the table overflow) | "@regression Money Hub 390px: every sideways-scroll box can be reached by keyboard" (tests/mocked/job35-money-scroll.spec.js) |
| 12 Nov 2026 | (found by the Breed Better property tests, JOB BB-FIN.1) an answer no rule knew was scored 0, or made a must-pass check Fail, through the missing-record setting | "Breed Better calculator tests pass" (tests/mocked/breed-better-calculator.spec.js), which runs the node tests '@regression an unmatched gate answer is Unverified, never Fail' and '@regression an unmatched points answer with when_missing zero is held' in tests/breed-better/score.property.test.js |
| 12 Nov 2026 | (same) points with decimals drifted (0.1 + 0.2 + 0.3 showed 0.6000000000000001), and 100% of 0.6 points needed 1 point | "Breed Better calculator tests pass" (node test '@regression tenths add up to tidy totals') |
| 12 Nov 2026 | (same) the Breed Better page kept old scores when a table was read again with the same number of rows | "Breed Better calculator tests pass" (node test '@regression the hub view re-scores when a row value changes') |
| 12 Nov 2026 | (found in review, JOB BB-FIN.1) a must-pass check set to skip would drop out when its record was missing, so an animal could Pass without it (no live row did this) | "Breed Better calculator tests pass" (node test '@regression a must-pass check set to skip is refused') |
| 30 Oct 2026 | CD Hub on a phone: sideways-scrolling tables and the table map could not be reached by keyboard (axe scrollable-region-focusable) | "@regression CD Hub 390px: every sideways-scroll box can be reached by keyboard" (tests/mocked/job35-cdhub-scroll.spec.js) |
| 3 Nov 2026 | Search dialog (390px screenshot, Dashboard): "Type at least 2 letters." still showed after typing "invoice" (it changed only when the search ran), and Close wore the browser's own button style | "the hint follows every key: shown under 2 letters, gone from the 2nd letter on…" and "${scheme}: Close is a house button: 1px line, 12px corners, Lexend 14px/600, no fill; hover and keyboard focus a 1px line inside @regression" (tests/mocked/house-rose-broken.spec.js) |
| 5 Nov 2026 | Home Apps tile header opened Factory Rooms (`factory/`) instead of Main, and the Food ✓ XML tick opened unfiltered orders | "Apps tile header opens Factory Main, and" |
| 5 Nov 2026 | Main hub tiles: only the name was a link, so a tap on the rest of the square did nothing | "the whole hub tile opens the hub; numbers and the Food tick keep their own pages @regression" |
| 5 Nov 2026 | CD Hub boot said it was reading tables from Drive and waited on each file in turn | "boot stays friendly and present files are read together @regression" |
| 5 Nov 2026 | CD Hub Temperatures today showed "Saving off." again, and Temperature history did not open (a bare data-skip blocked the link) | "Temperatures today: no saving-off notice, and Temperature history opens history.html @regression" (tests/mocked/cdhub.spec.js) |
| 6 Nov 2026 | Temperatures showed "Source:" and the reading kind, including the word actual, on history and on Outside today when the phrase was empty | "Outside today does not show the reading kind when the phrase is empty @regression" and "year chips run current first, and a day detail does not show Source or the reading kind @regression" |
| 8 Nov 2026 | Food Reorder due listed customers who had already reordered (the page could not tell customers apart; Lisa) | "reorder due with engine v1.15.3 keys: a customer who ordered again…" |
| 8 Nov 2026 | Dashboard Food tile showed "✓ XML" and nothing waiting while paid order #5400 waited for its Send tap (Lisa) | "Food tile: an order waiting for its Send tap…" |
| 11 Nov 2026 | CD Hub: a medicine ask such as "identify the medicine given in February" opened Outstanding, and the same button opened Outstanding again. The round also stopped if a cabin already had its flap set | "Identify the medicine given in February opens that dog’s February record, and a second click does not return to Outstanding @regression" and "date, saving, flap, move, temperatures and history each finish or explain @regression" (tests/mocked/cdhub-round-paths.spec.js) |
| 13 Nov 2026 | Staff page: the owner's Sensor CSV button stopped at its title (an error: "thermos is not defined"), so no sensor file could be imported. Found by the click-crawl | "Sensor CSV opens for an owner: room picker and file box; a sensor file is read and saved one day at a time @regression" (tests/mocked/staff-temperature.spec.js) |
| 12 Nov 2026 | The Board's not-set-up screen could only scan a QR, and Staff checks did not say who to ask | "a typed set-up code follows the QR: a good one opens the staff code, a bad one is refused @regression" and "a typed private set-up code follows the QR: a good code is kept, a refused code is not @regression" (tests/mocked/staff-setup-qr.spec.js) |
| 12 Nov 2026 | CD Hub could sit on Getting things ready with no way on, and a failed record read did not say what went wrong | "boot hangs about 15s then shows Retry @regression" and "a failed Drive read shows the message @regression" (tests/mocked/cdhub.spec.js) |
| 13 Nov 2026 | CD Hub: tapping a February medicine item kept returning to the same view. With two or more dogs in the list nothing was opened, and the rows of the list could not be tapped (Lisa, 12 Nov) | "February medicine for two dogs: tapping a row opens that dog’s medicines, it does not leave the view as it was @regression" (tests/mocked/cdhub-round-paths.spec.js) |
| 12 Nov 2026 | Marketplace: a refund card showed only a raw ISO sale date in red, with no site, order link, amount or refund date, and had no "Item not received" reason | "refund card says the site, order (linked), UK sale date…" and "an old refund card with no platform, url or options does not break…" |
| 13 Nov 2026 | CD Hub chip and occupancy saves wrote to retired file ids. A missing folder file still saved, instead of stopping | "saveChip and saveArea write the folder file and refuse when it is missing @regression" (tests/mocked/cdhub-listed-saves.spec.js) |
| 13 Nov 2026 | CD Hub dog card refused a room move and a photo unless this browser had already been set up, and Breed Better Open on a check returned to the dog list | "staff code River saves a room and a photo from empty storage @regression", "an invalid staff code is refused and nothing is saved @regression" and "dog card, Breed Better, Open on Fit to Breed lands on add/edit, and Back returns to that dog @regression" |
| 13 Nov 2026 | CD Hub kept an accepted staff code for the tab only, so a phone asked again after the tab or the Home Screen app was closed | "an accepted staff code is kept on this device and not asked again in a new tab @regression" (tests/mocked/cdhub-staff-code-save.spec.js) |
| 15 Nov 2026 | CD Hub dog card said "could not reach the save script": the save address was held in memory only, and an empty first read was never tried again | "save address: an empty first read is tried again, and the found address is kept for the next visit @regression" (tests/mocked/cdhub-staff-code-save.spec.js) |
| 15 Nov 2026 | CD Hub Find only found dogs and litters; a view, area or SOP name found nothing, so Lisa could not jump to anything by name | "CD Hub Find: a view name goes there; an …" |
| 15 Nov 2026 | CD Hub: each page ended in a "Next: X →" button that guessed where you wanted to go, so reaching a section's other views took several taps | "chips at the top of a section reach each" |
| 15 Nov 2026 | CD Hub Back left the app or landed at the top of the list instead of where you were, and detail pages had no visible way back | "into a record and back: the phone Back and" |
| 15 Nov 2026 | Caught after merge (PR 522 live retest, 13 Nov): The round's "Saving on this device" panel said off with an empty code box although the kept code saved fine (it never read the kept code); and the manifest was fetched without the Cloudflare sign-in cookie, so Android could only make a shortcut | "after a code is accepted, The round panel says on and masks the code @regression", "closing and reopening the browser keeps saving on: the panel says on and a save asks for no code @regression" (persistent browser profile; tests/mocked/cdhub-staff-code-save.spec.js) and the manifest check in tests/mocked/pwa-and-keys.spec.js |
| 22 Nov 2026 | Live staff Scan and move: a dog moved to a new room still showed its old room until a full page reload (a long wait) | "a saved move shows the dog in its new room and out of the old one, with no read of the lists @regression" (tests/mocked/cdhub-round.spec.js) |
| 22 Nov 2026 | Lisa, live staff Jobs: a multi-dog job (Health check: all dogs) showed its ticks but no button to save them, so the card stayed Due | "a whole-site dog job: the Done N dogs button by the ticks saves the ticked dogs and the card says N of M dogs @regression" (tests/mocked/staff-jobs.spec.js) |
| 22 Nov 2026 | Lisa, live staff Jobs: "Bedding washed" (As needed) saved but showed no tick, so a second Yes was refused as a repeat with only a red line | "an as-needed job done today stays on the site list with its tick when the screen opens again @regression", "an as-needed job refused as a repeat shows the tick, not only a red line @regression" (tests/mocked/staff-jobs.spec.js) |
| 16 Nov 2026 | Lisa 15 Nov: Assocs, Table map, Litters, Vet and Enquiries were still on the live menus after she asked for them hidden (PR 472 never landed) | "with no rows, Assocs, Table map, Litters, Vet and Enquiries are off every menu and their addresses open Main @regression" (tests/mocked/cdhub-hidden-views.spec.js) |
| 16 Nov 2026 | Live check (Chrome, 390px): the Records chip row scrolled sideways, hiding The round, SOPs and Temps | "phone: every Records chip is on screen at the top, no sideways scroll @regression" (tests/mocked/cdhub-chips-wrap.spec.js) |
| 20 Nov 2026 | Print job (Lisa 15 Nov): an item (e.g. a fire extinguisher) had no card on the print page, and QR codes were made only when Print was pressed | "default fields, each under its label; the name has no label; one card per item; the existing tag is reused @regression" (tests/mocked/cdhub-print-item-card.spec.js) |
| 20 Nov 2026 | Lisa 20 Nov: the printed dog card did not match her approved 15 Nov v4 design (Size tile and QR not lined up with the photo, tag text printed, labels missing) | "dog card v4, 2 per A4: photo, Size tile and 62 mm QR line up as approved; labels; no tag text @regression" (tests/mocked/cdhub-print-dog-card-v4.spec.js) |
| 13 Nov 2026 | CD Hub print on A4: The round printed bars, menus and buttons and split cabins across 6 pages; Dogs split cards; kennel cards printed a blank first page, clipped the QR at 4 per A4 and wasted a third of the sheet at 2 per A4; a device in dark mode printed pale text | "the round prints as a two-column round sheet", "the Dogs page prints two whole cards a row", "kennel cards print whole, nothing clipped", "room cards print two a sheet, each whole, QR at least 50 mm (Lisa 18 Nov 2026)" and "the round sheet and kennel cards print dark text" (tests/mocked/cdhub-print-a4.spec.js) |
| 18 Nov 2026 | Lisa 15 Nov: the print kennel card showed the typed size cell with its kg range ("Medium" over "17–22 kg") instead of the size worked out from weight; it also ignored an owner size override | "kennel cards: size word only, colour from size_colour rows, no kg anywhere; no weight and no size prints none @regression" (tests/mocked/cdhub-print-size-word.spec.js) |
| 20 Nov 2026 | Caught after merge (click-crawl, JOB CDH-HT.1): Sign out pressed while the hub was still reading left an error card ("Sign in again") or a blank page where the sign-in card should be; the unfinished read carried on after Sign out | "Sign out while the hub is still reading: the sign-in card stays and nothing is read back in @regression" (tests/mocked/cdhub-taps.spec.js) |
| 20 Nov 2026 | Caught after merge (click-crawl in CI, JOB CDH-HT.1): on a 360px phone The round scrolled sideways (32px) because the "add a dog…" list grew as wide as its longest dog or litter name | "The round at 360px: a long name in the "add a dog" list does not make the page scroll sideways @regression" (tests/mocked/cdhub-round-360.spec.js) |
| 22 Nov 2026 | Caught after merge (main red 21 Nov 09:00 UTC): the food growth tiles put the red ring on a 0 when orders were down on the 30 days before or under MIN_ORDERS_MONTH, against the house rule that a 0 has no ring | "growth tiles: a 0 never shows the red ring, even when down on the 30 days before or under the aim (22 Nov 2026) @regression" (tests/mocked/food.spec.js) |
| 21 Nov 2026 | Caught after merge (area prints, overseer check): a room's "Print sign" in CD Hub opened the print page with no room picked, so staff had to press Room cards and find it again | "sign mode (?sign=<area id>): only that room card, its saved code reused; a missing code is made once (owner only; staff and a second open write nothing); an unknown room says so @regression" (tests/mocked/staff-setup-qr.spec.js) and the link check in tests/mocked/cdhub-dog-card-summary.spec.js |
| 22 Nov 2026 | Caught after merge (Lisa, live print page, Mac Chrome): no photo on any dog card; the print page loaded photos from drive.google.com/thumbnail, which needs Google's cookies, and Chrome blocks them on other sites | "signed in to CD Hub: the photo comes from the Drive thumbnail link, asked for with the sign-in, never the cookie address @regression" (tests/mocked/cdhub-print-photo-signin.spec.js) |
| 22 Nov 2026 | github.io (where the printed QR codes point) stopped updating on 20 Nov 22:47: the publish gate's 35-minute limit cut off every run once the suite ran past it, so #715 to #765 never went live there | "the publish gate has at least as long as the required check to run the suite @regression" (tests/mocked/ci-guards.spec.js) |
| 25 Nov 2026 | Lisa, live SOPs: a due check (annual microchip audit, 27 dogs) listed what was expected and gave no way to record it as done | "Mark all saves each ticked dog, and a litter check saves litter_id @regression" (tests/mocked/cdhub-jobs.spec.js) |
| 25 Nov 2026 | Lisa, live SOPs: Sign-Off, Licence Display and the other SOPs with no linked check had no way to record them, and no SOP had Print records | "an SOP with no linked check still records Checked today and prints @regression" (tests/mocked/cdhub-sop-records.spec.js) |
| 25 Nov 2026 | Lisa, live SOPs: Feeding and Health Check had a check in the sheet but the SOP column was blank, so the SOPs tab showed no record control | "a check whose SOP name was left blank still shows its record control @regression" (tests/mocked/cdhub-sop-records.spec.js) |
| 25 Nov 2026 | Daily records Import: a row 7 days or older was refused even though the page already sends confirm_unusual=yes. The whole-site save rebuilt the fields and dropped that flag | cdhub-write/tests/site-import-age.test.js (refused without the flag, saved when confirm_unusual is yes) |
| 25 Nov 2026 | Daily records: done days were grey buttons, so the green / orange / red / blue key did not show on the calendar | "daily records: done, part done and missed look different (not by colour alone), the key matches, and the cross reads in light and dark @regression" (tests/mocked/cdhub-job-calendar.spec.js) |
| 25 Nov 2026 | A save the records refused (no code, or a field error such as a date over 7 days) was sent again every minute and each failure added another notice | "a validation failure with no code is not retried; one job is one notice, with Clear all and Show what is wrong @regression" (tests/mocked/cdhub-never-lose.spec.js) |
| 25 Nov 2026 | #582's merge left the published staff copy of bld-save.js on a 5-hour outbox while the client copy was 23 hours | "the two bld-save.js copies are the same file @regression" (tests/mocked/bld-save-copies.spec.js; the write-path suite runs the same check in cdhub-write/tests/bld-save-copies.test.js) |
| 25 Nov 2026 | The round left 16 not sent yet because each Present tap read every column of the job log (about 5,000 rows) while holding the lock, and Send now sent them one at a time | "Send now sends the kept round taps as one list, not one at a time @regression" (tests/mocked/cdhub-never-lose.spec.js). The save itself is checked in cdhub-write/tests/check-log-fast-append.test.js |
| 25 Nov 2026 | Exercise and play yearly grid left January to October blank and ignored round rows | "exercise rows on another type and round rows still fill the year grid @regression" (tests/mocked/cdhub-yearly-print.spec.js) |
| 25 Nov 2026 | The exercise grid listed litter puppies such as "Marble x Sammy 2026 - Black male 1" | "a litter puppy is left off the exercise grid @regression" (tests/mocked/cdhub-yearly-print.spec.js) |
| 25 Nov 2026 | Every yearly print page said "Kennel not recorded" | "the yearly print header uses the kennel name and never says Kennel not recorded @regression" (tests/mocked/cdhub-yearly-print.spec.js) |
| 25 Nov 2026 | Room temperatures in the yearly print were a long list, so one month became many pages | "room temperatures print as one daily min and max sheet a month @regression" (tests/mocked/cdhub-yearly-print.spec.js) |
| 25 Nov 2026 | Empty medicine months printed as blank pages, and optional fields said "not recorded" | "an empty medicines month says no records and optional fields stay blank @regression" (tests/mocked/cdhub-yearly-print.spec.js) |
| 25 Nov 2026 | SOP Print records printed the SOP list straight away and froze the page | "SOP Print records opens the print view and does not print the list @regression" (tests/mocked/cdhub-sop-records.spec.js) |
| 25 Nov 2026 | A SOP link opened the previous site copy as a full page load of index.html with a hash. The tab ran out of memory | "an old-host SOP address stays on this site and opens that SOP @regression" (tests/mocked/route-crawl.spec.js) |
| 25 Nov 2026 | The yearly print page wrote errors to the console | "the yearly print page loads with no console errors @regression" (tests/mocked/cdhub-yearly-print.spec.js) |

**Recipe when a bug is fixed:**
1. Write a test that **fails** on the broken page and **passes** on the fixed one.
2. Put `@regression` at the end of its name.
3. Add a row to the table above (date, what went wrong, test name).
4. Tick "Bug fix? Regression test added?" in the pull request. If the pull request is called a fix and changes nothing under `tests/`, the robot adds a yellow warning (it never blocks).

## What is not covered (honest list)

- The real Google consent screen.
- Real Drive speed, limits and permissions.
- Whether the numbers in your real files are right. That is the job of the Control page in the Money Hub.
- Your real column names in CI (use the local script above).
- Phone sizes beyond one Pixel-sized screen, and only a short list of checks on it.
- A real USB stick or real renaming on a disk (the Drive check is tested against a pretend plugged-in drive).

## Settings file and Google retries

All ids and addresses (the public sign-in id, the Drive folder and file ids, the Google addresses) are written once, in `config.js`. The three pages and the tests read them from there. A test fails if the sign-in id is copied anywhere else.

`toolkit.js` holds the shared Google reader. When Google says "too many requests" (429 or a rate-limit 403) or has a hiccup (5xx), a read tries again by itself: up to 4 tries, about 1, 2 and 4 seconds apart, plus a little random extra. A plain refusal (no access, folder not found) is not retried, and a change to Drive (the Bin buttons) is never retried. If all 4 tries fail, each page says: "Google is busy right now (too many requests). The dashboard tried 4 times. Wait a minute, then try again." Tests: `tests/mocked/google-retries.spec.js`.

## Money reads only what changed

Money keeps a copy of each file **in memory only** (never in the browser's storage), with the "last changed" time Drive gave for it. On Reread, and on the 10-minute timed reread, it still asks Drive for the folder listings, but it downloads a file again only if its "last changed" time is different. Sign-out forgets the copy. A test caps the Drive calls: a first read of the sample drive may use at most 40 (today 27), and a reread with nothing changed at most 8 (today 6) with no downloads. Tests: `tests/mocked/money-cache.spec.js`.

## Money chart and worked-out deadlines

Each entity page draws its `FORECAST.csv` as a line, with a dashed £0 line, the start point and, if the forecast goes below zero, a red dot labelled "Runs dry". The same facts are in the chart's spoken label and in a note under it. The Dates page and each entity page also list **deadlines worked out from the usual UK rules**: Self Assessment (31 January and 31 July) for personal entities; Companies House accounts (9 months), Corporation Tax payment (9 months and 1 day) and CT600 (12 months) for companies with a `year_end`; VAT (1 month and 7 days after each quarter) where `vat_quarter_end` is set. Every row says **check with accountant**; it is not tax advice. A date already in MON-DATES for the same entity (within 5 days) is not repeated. Tests: `tests/mocked/money-forecast-deadlines.spec.js`.

## One sign-in for every tab, and the Dashboard button

- One sign-in covers home, Money Hub and CD Hub in every tab, window and the installed app (one key, `ljr-dash-auth`, in this browser).
- Only the short-lived access token and its expiry. No refresh token, no secret. Expired = not reused.
- Sign out in one tab = signed out in all. Sign in in one tab = the others pick it up.
- Money Hub and CD Hub links on home open in a new tab.
- Every page except home has a **Dashboard** button, top right. Opened from the dashboard: it brings that tab back and closes itself. Otherwise it goes home.
- Home links the MOVE workbook once (the tile).
- Tests: `tests/mocked/one-sign-in-tabs.spec.js`.

## Every click works

- `tests/mocked/every-click.spec.js` opens every screen of home (11), Money Hub (8) and CD Hub (10) with pretend data.
- Every visible button, tile and link: has a label; internal links answer 200; outside links are https and open a new tab.
- Each one is clicked on a fresh copy of the screen. It must go somewhere, open a tab, change the page or ask a question. A dead click fails.
- Not clicked: Sign out and the skip link (own tests). Outside links are checked, not opened.
- Temperature history on CD Hub Today is a real page link. The crawl follows it. That page's spreadsheet export is answered with an empty CSV so the click stays inside the pretend network.
- A link that opens a new tab (like "Sample task ready now" on the Map, which opens Money Hub) waits for that tab to open, however long it takes under four workers. It used to give it 700ms and sometimes called it a dead click.

## The house look, once

- The agreed rules (Lisa, 28 Oct 2026) are written once: the numbers and colours in `tokens.css` (including Look › Dark), the shared parts in `house.css` (buttons, pills, counts, date pills, the hover rule, bottom tabs, bars, cards, the phone Filter button). Every hub loads `tokens.css`, then `house.css`, then its own layout.
- `tests/mocked/house-look.spec.js` holds every hub to the same rules by computed style, on every view. `HOUSE_AUDIT=<file>` runs every combination (light and dark, warm and cool, 1280 and 390, Look › Dark) and writes each deviation to that file instead of failing.
- Type (Lisa, 2 Nov 2026): one font (Lexend), weights 400 / 500 / 600, and only three sizes, as tokens in `tokens.css`: 18px headings, card titles, big numbers and the hub name; 15px body; 14px everything else (labels, tabs, counts, pills, tables, menus). Every ringed number is 14px in one box (30 x 24 on the page, 24 x 24 on a bottom tab), ring only. `tests/mocked/fonts.spec.js` reads every word on all 8 pages at 1280 and 390, on a few views and the open More and Look menus.
- Text contrast (Lisa, 3 Nov 2026): every word holds 4.5:1 or better on what it actually sits on, not just the white card. The `--ljr-N-text` tokens aim for 4.6:1 on paper, canvas and soft in both looks. `tests/mocked/house-text-contrast.spec.js` reads every visible word on all 8 pages, every view, at 1280 and 390, in all four looks; the background is the first solid colour up through the parents. Disabled controls and aria-hidden text are skipped. `CONTRAST_AUDIT=<file>` lists findings instead of failing; `CONTRAST_MIN=4.6` raises the bar for a look-around (never lower than 4.5).
- One line, inside (Lisa, 3 Nov 2026): every line is 1px and drawn inside the element; hover, focus, press and selected recolour that line or draw a 1px line inside (offset -1px). Keyboard focus is a 1px ink line inside; typing boxes on focus change only their border colour. `tests/mocked/house-lines.spec.js` keyboard-focuses every control and hovers one of each kind on all 8 pages, every view, at 1280 and 390: the box must not move, the outline must be 1px or less at offset 0 or below, and no box-shadow may appear. Skip links are exempt (they are meant to appear on focus). `LINES_AUDIT=<file>` lists findings instead of failing.
- Checks that read a value after a hover use one shared helper, `tests/support/settle.js`, which waits for the colour-bar transition to finish instead of a fixed pause.

## Phone install and keyboard keys

`manifest.webmanifest`, the icon in `icons/` and `sw.js` let you add the dashboard to your phone's home screen. It opens full screen. The service worker keeps **only the site's own page files**, so the pages open fast and still open offline (they then say a read failed, because nothing from Drive is kept). It never touches Google addresses, never keeps a request that carries a sign-in, and keeps no Drive data or token. A test signs in, reads, and then checks every kept file is a page file. The rest of the suite runs with service workers switched off, so every test starts clean.

Keyboard keys on all three pages (from `toolkit.js`): `g` then `m` Map, `d` Drive, `b` Bin, `c` Changes, `f` Money Hub, `h` CD Hub; `r` read again; `/` search; `?` shows the list. Keys do nothing while you type in a box. Tests: `tests/mocked/pwa-and-keys.spec.js`.

## Search

Press `/` (or the Search button) on any page. One box, results grouped by where they came from, each group in its colour:
- **Home:** Drive file names in each shared drive (one read-only name search per shared drive, at most 12 drives, never My Drive), plus the Money to-dos and dates the page has already read.
- **Money Hub:** to-dos, dates and accountant questions already read (no extra Drive calls).
- **CD Hub:** dogs (name, chip, id) and litters already read. Picking a dog opens Dogs filtered to it.

A quote in the words is escaped before it reaches Drive. Signed out, nothing is searched. Tests: `tests/mocked/search.spec.js`.

## Bin guard: 00 CHECK on the Bin page

A Google Apps Script owned by the business account (the "bin guard", code kept in Drive, not in this public repo) looks in the bins every day at about 8am UK. Anything whose name does not start `ZZ_DELETE_` or `ZZ_SUPERSEDED_` is taken back out and put in **LD > *00 Current > 00 CHECK**. It never deletes for good and never empties a bin.

The Bin page shows 00 CHECK ("Check: put back by the bin guard") with ticks, **Select all**, **Clear**, **Approve binning** and **Ask the AI to sort**. The page only **reads** 00 CHECK. The two buttons open the guard's own Google page (a web app that only puppyclassroom.com accounts can open, and only Lisa can use) with the ticked ids; nothing changes until Lisa presses the button there. RR_ names have no tick box. Until the web app exists the card shows **Waiting for the tidy bot** instead of the buttons: it writes its address into `BIN-GUARD-WEBAPP.json` in *00 Current the first time Lisa opens it, or you can put the address in `config.js` (`binGuard.webAppUrl`). Only a `https://script.google.com/.../exec` address is accepted. Tests: `tests/mocked/bin-guard.spec.js`.

## Web Estate DNS and mail checks

The estate page only reads. It never changes DNS, a registrar or a mailbox. Every name in these tests is invented (`example.com`, `example.co.uk`, `example.net`, `other.test`). DNS answers are pretend `dns.google` JSON. Registrar answers are pretend RDAP JSON. A forwarding chain is an optional `forward_chain` field on the private sheet; when the field is absent the page does not invent one.

| Check | What is flagged | Test |
|---|---|---|
| DKIM | Google Workspace MX and no answer at `google._domainkey` or the other small selector list | `DKIM missing is flagged for Google Workspace MX when no allow-listed selector answers` in `tests/estate/mail.test.js` |
| DMARC missing | No `v=DMARC1` record (already checked; still flagged) | `DMARC policies, missing, two records` in `tests/estate/mail.test.js` |
| DMARC weak | `p=none` and no `rua` | `DMARC weak: p=none with no rua is flagged; p=none with rua stays a note` in `tests/estate/mail.test.js` |
| SPF count | More than one `v=spf1` record (already checked; still never shown as passing) | `ACCEPT: two SPF records is NEVER shown as passing` in `tests/estate/mail.test.js` |
| SPF syntax | Unknown mechanism, missing `all`, or more than 10 lookups | `SPF broken: unknown mechanism, missing all, more than 10 lookups` in `tests/estate/mail.test.js` |
| MX | Present or none, with a provider name (Google, Microsoft, Namecheap email forwarding and other forwarders). No MX is flagged | `MX: lowest preference wins, provider words` in `tests/estate/mail.test.js` |
| Forward hops | The chain and the hop count. More than one hop is flagged. A forwarder with no recorded target says "target unknown, needs registrar export" | `forward chain: hop count, flag over one hop, unknown target, absent field` in `tests/estate/mail.test.js` |
| Certificate | Inside 30 days is listed (already). 7 days or less, or already passed, is red; 8 to 30 stays amber | `certificate red tier: 7 days or less is red, 8 to 30 stays amber` in `tests/estate/alerts.test.js` |
| Nameservers and registrar | RDAP nameservers and registrar name. A nameserver change is flagged only when a previous set is known | `RDAP: nameservers and registrar from a mocked response, including a nested name` and `nameserverChange flags only when a previous set is known and different` in `tests/estate/status.test.js` |

The same flags are listed on Needs a look: `mail flags: weak DMARC, broken SPF, missing Google DKIM, no MX, forward hops, unknown target` and `nameservers changed only when a previous value is available` in `tests/estate/alerts.test.js`. The page shows them in the browser: `DNS and mail flags show on the property and in Needs a look` in `tests/mocked/estate-mail-flags.spec.js` (1 check).

## Where things live

| What | Where |
|---|---|
| The tests | `tests/mocked/` (desktop), `tests/phone/` (phone) |
| The pretend Google and Drive | `tests/support/` |
| The invented sample files | `tests/fixtures/` |
| Expected column names | `tests/contract/` |
| The "teeth" check | `tests/teeth/` |
| The robot's schedule | `.github/workflows/` (`tests.yml`, `live-after-deploy.yml`, `teeth.yml`, `fix-needs-test.yml`) |
| Weekly update nudges (never auto-merged) | `.github/dependabot.yml` |
| Settings | `playwright.config.js`, `package.json` |

Nothing in the dashboard pages themselves was changed to add these tests (Job 6 or Job 6b).

## Bin page order (TidyUp stage 5)

`tests/mocked/bin-page.spec.js` checks the Bin page follows the job file's section 8: Needs you now, Ready to bin (first card, open), Check, Not ready yet, Already in the bin, Log, Dropbox (closed, last). Only **Bin these** is red; no disabled tick boxes; no internal names (ZZ_, ledger, RR_, E02, UNSURE, lcme-grok) in the visible text outside file names, tooltips and the "why" fold; one confirm of at most 40 words bins a shared-drive row and a Work My Drive row together, and Cancel bins nothing.

## Bin page Log reads RUN-LOG (TidyUp stage 7)

`tests/mocked/bin-log.spec.js` checks the Log reads `RUN-LOG.csv` from the folder in `config.js` and shows only the last 7 days of runs, newest first, with the time in UK time (GMT or BST, including a `date_uk` cell with no offset), the engine, Dry run or Live, the counts and the result, plus the distinct lessons. A Google Sheet of the same name is read the same way. With the shipped placeholder (no folder id), no file, only old runs, or no `date_uk` column it says "No runs logged yet". A failed read shows the same neutral text, counts no problem, and Bin these still bins. The page only reads the file.

RUN-LOG.csv column contract (the private repo writes it; header row first; columns matched by name in any order; extra columns ignored):

| Column | What goes in it |
|---|---|
| `date_uk` | When the run ended, ISO 8601. With an offset (`2026-10-30T14:05:00+00:00` or `Z`) preferred; without one it is read as UK time. Required. |
| `job` (or `engine`) | Which engine ran, e.g. `bin-engine`, `bin-guard`. |
| `place` | The shared drive, Work My Drive or Dropbox the run looked at. |
| `mode` | `dry` for a dry run; `mark`, `trash` or `live` for a live run. |
| `found` | Candidates looked at (whole number). |
| `changed` | Items renamed or binned (whole number; 0 on a dry run). |
| `ledger_rows_added` | Delete-ledger rows written (whole number). |
| `errors` | Errors in the run (whole number). |
| `result` | `ok`, `partial` or `failed`. Blank = ok when errors is 0, else partial. |
| `lesson` | One short line, or blank. |

## Dropbox, iCloud and Mac pages (TidyUp stage 9)

`tests/mocked/coverage-pages.spec.js` checks the three look-only Drives pills (Dropbox, iCloud, Mac): each page opens with one purpose line, marks its own pill current, has no bin, move or rename button (only "← Dashboard"), and says "No report yet." (not a failure) until its engine writes a dry-run report. With a report, it shows the counts and "Nothing was renamed or moved." Dropbox reads the same DROPBOX-TOTALS.json as the Bin Dropbox fold; its delete steps stay in Bin. No page makes a write call
- Admin's phone set-up QR opens the public staff page (Lisa 18 Nov 2026: staff phones have no Cloudflare sign-in): the owner's `qr.base_url` rule row in force, else `https://ljoyrose.github.io/dashboard/cdhub/staff/`; the Phone and Print cards name that address, not the address Admin is open on. (`tests/mocked/cdhub-admin.spec.js`).
