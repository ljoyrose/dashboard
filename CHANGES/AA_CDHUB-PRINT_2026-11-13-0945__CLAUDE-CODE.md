# CD Hub print on A4: round sheet and dog cards

13 Nov 2026, 09:45 UK. Claude Code. Code only; every row used to check it is invented.

## What was wrong (seen on the live code, signed out, and in Chrome's own PDF)

1. **The round (hub)**: no print rules at all. Top bar and tab bar printed on every page; flap and add-a-dog menus, present / not here and Empty buttons, and the save box printed; cabins split across pages. 16 cabins took 6 pages.
2. **Dogs page (hub)**: same bars and buttons (Edit, Change photo); cards split across pages.
3. **Kennel cards (`cdhub/staff/print/`)**:
   - Full A4: the "N cards ready" line printed alone on page 1 (a blank first page); QR small with empty space under it.
   - 2 per A4: cards 190 mm tall on a 297 mm page; a third of every sheet wasted.
   - 4 per A4: QR, microchip and jobs cut off at the bottom of each card.
4. **Dark mode (not asked, found)**: a phone or Mac in dark mode, or Look > Dark, printed pale grey names and values, and a black margin.

## What changed

| File | Change |
|---|---|
| `cdhub/index.html` | Print-only rules. Round: two cabins a row, blank am/pm min/max boxes, no menus or buttons, cabins kept whole (16 cabins: 3 pages). Dogs: two whole cards a row, photo stays cropped square. Bars, buttons and forms off the paper on every page. `#main` now carries `data-view` so each page has its own print rules. Cabins sit in one `.rcabins` box. Light look while printing. |
| `cdhub/staff/print/print.css` | Full A4 = one card a page; 2 per A4 = two A5 cards on a landscape sheet; 4 per A4 = four A6 cards. Each card has a fixed height a little under its share of the page; the QR takes the height that is left, so nothing is clipped. Room signs two a row. |
| `cdhub/staff/print/print.js` | The status line keeps `noprint` (it lost it on every update). |
| `cdhub/staff/look.js` | Light look while printing (staff pages and print page). |
| Tests | `tests/mocked/cdhub-print-a4.spec.js`, `tests/phone/cdhub-print-a4.spec.js`, `tests/support/print-a4.js`. 11 desktop and 3 phone checks. They fail on the old code (checked). |
| `tests/budget-growth/cdhub-print-a4.json` | CD Hub page +5,000 bytes (it grew 4.9 KB). |
| `TESTS.md` | One line under CD Hub. |

The on-screen dog card is not changed. Print rules only, plus the light look during printing.

## How it was checked

- Chrome's own PDF output (the engine behind both Print and Save as PDF), A4, background graphics off (Chrome's default), desktop and phone (Pixel 5 size). Page counts prove no card was split.
- Each PDF looked at by eye.
- Not checked: a live print from the signed-in hub with real rows (no sign-in or owner code here, and no real data may be used). Safari on Mac or iPhone (no Safari engine here). The layout uses inline blocks, not grid, and leaves a few mm spare per card, so Safari's own margins should not push cards to the next page, but that is unproven.

## For Lisa to check (one live print each)

1. The round: Print, then Save as PDF, from the Mac and the phone.
2. Kennel cards: each of Full A4, 2 per A4, 4 per A4.
3. With the phone in dark mode once.

## Decision taken (change if wrong)

- **2 per A4 now prints on a landscape sheet** (two A5 cards). Safari may ignore landscape: then it prints two cards side by side on portrait, as before.
- Round sheet hides present / not here and Empty buttons; on paper a cabin is "empty" if its boxes are left blank.
- Kennel card photo stays the "Photo" box to stick a print on. The print page has no Google sign-in, so it cannot fetch Drive photos.
