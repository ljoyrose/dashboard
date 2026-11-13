# Breed Better build to the owner's design: run progress

Rewritten after each stage (not appended). Code words only.

- Started from main 9ca0866 (13 Nov 2026). Branch: claude/serene-curie-pcau08.
- Stage now: S11. Pull request #526 open (draft until CI is green on the head commit). Main merged in (f3754e1).

## Done
| Stage | What | Files |
|---|---|---|
| S1 | Five tabs at the bottom (Score, Evidence, Dogs, Calendar, More), always shown, above the house bar; each tab has its own address (#/breed/calendar, #/breed/score.<id>) | breed-better/hub-view.js, cdhub/index.html (keeps the #/breed sub-address) |
| S2 | Calendar: Due / Done / All with counts (All = Due + Done), month pager, Monday grid, today outlined, coloured dots, tappable days and a clear control, rows open the Score tab at that section | breed-better/hub-view.js |
| S3 | Subtle look on every screen; name 16px as a Breed Better size; weights 400/500/600; section icons and colours from score_band rows (icon_key, line_colour, icon_light, icon_dark; fall back to the colour word) | breed-better/hub-view.js, tests/fixtures/breed-better/BLD-score_band.csv |
| S4 | Dog page: percent line worked out from the scheme row, Scored on, "n of m met" and "x of y" headers, things to do first, done lines under Show done, a "To prove" line on each unverified check; judged answers now reach the score | breed-better/hub-view.js |
| S5 | Dog card: one folded line that unfolds to grouped checks; each line opens the Score tab at that section | breed-better/hub-view.js |
| S6 | Evidence tab (read only), More: My system, Archive, History (worked out on load), DNA panel, Who sees what | breed-better/hub-view.js, cdhub/staff/lib/viewer-levels.js |
| S7 | DNA Kit renamed DNA panel (file moved with its test); grade-to-colour bands from rows; read-only set-up view | breed-better/dna-panel.js |
| S8 | Inspector page laid out to the inspector design; must-pass words only when a summary is sent and the viewer level shows them; litters against the rule row | cdhub/staff/inspect/* |

| S9 | Kept live behaviour listed in the pull request side-by-side table | (pull request text) |
| S10 | tests/mocked/bb-design-click-through.spec.js: every Breed Better button and tab at 360px and 1280px; unit tests tests/breed-better/hub-design.test.js; house button rule skips Breed Better buttons (class bb-...) | tests, cdhub/index.html |

## Tests
- node --test tests/breed-better/*.test.js: 99 pass.
- Mocked browser specs: click-through (26), acceptance, dog card, inspector (7): pass locally.

## Next
- Mark #526 ready when CI is green on its head commit. Live signed-in click-through: done by the owner's hub steward, on the preview and after merge.
- Open for the owner: inspector view approval, viewer level names, the inspector must-pass summary from the save script, when evidence counts.
