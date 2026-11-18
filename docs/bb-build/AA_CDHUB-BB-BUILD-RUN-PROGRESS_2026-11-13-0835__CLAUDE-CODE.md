# Breed Better build to the owner's design: run progress

Rewritten after each stage (not appended). Code words only.

- Branch: claude/serene-curie-pcau08 (PR #526). Job CDHUB-BB-BUILD.2 (18 Nov 2026): main merged in (merge commit, main wins
  where both changed the same thing), then the owner's pieces main lacks re-added on top of main's code.
- Merge order (owner): #491, then #660, then #644, then #526 last. Main is merged in again as each lands.

## Kept from main (main wins)
Back via HubNav ("Back to <dog>" on a dog card), enrol and un-enrol, Checks records with their typed values, final-only checks,
age groups, section icons by band key or the optional `icon` cell, section colour by result, `#hex` band colours, logo header,
previous and next, the house selected look, the dog card section (score always shown, must-pass list folded), Inspector links
under More, species words (the Dogs tab).

## Re-added on top (owner's design)
| Piece | Where |
|---|---|
| Five tabs at the bottom (Score, Evidence, Dogs, Calendar, More), own address per tab under #/breed | breed-better/hub-view.js, cdhub/index.html |
| After a dog card, steps inside Breed Better use HubNav.back.replace, so "Back to <dog>" still returns in one step | breed-better/hub-view.js |
| Calendar: n due in 30 days, Due / Done / All, pager, Monday grid, day buttons, No record yet fold | breed-better/hub-view.js |
| Evidence tab (read only), Checks records read with their typed values | breed-better/hub-view.js |
| Dog page: percent line, Scored on, n of m met / x of y, things to do first, Show done, To prove | breed-better/hub-view.js |
| Judged answers reach the score (judgementsFor) | breed-better/hub-view.js |
| More: My system, Archive, History, DNA panel, Who sees what, Inspector links | breed-better/hub-view.js |
| DNA panel name, grade bands from rows, set-up view (keeps main's pupOdds) | breed-better/dna-panel.js |
| Viewer levels: the owner's two (A records; B records and must-pass words); inspector B, vet and breeder A | cdhub/staff/lib/viewer-levels.js |
| Inspector layout (approved); Fit to Breed reads assessed_on or done_on (main) | cdhub/staff/inspect/* |
| `icon` as an optional score_band column | tests/fixtures/breed-better/headers.json, tests/breed-better/contract.test.js |

## Tests
- node --test tests/breed-better/*.test.js: 122 pass.
- Mocked: bb-design-click-through (360px and 1280px), bb-inspect, breed-better-acceptance, cdhub-dog-card-bb-section: 65 pass.
- Lint: 0 new.

## Next
- Merge main again after #491, #660 and #644 land; History prefers #644's saved scores when its switch is on.
