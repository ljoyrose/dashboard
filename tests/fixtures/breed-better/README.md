# Breed Better acceptance fixtures

Invented rows only. The three animals are the hub's own invented test dogs in `../bld/BLD-subject.csv`
(`sub-test-dog-1`, `sub-test-dog-2`, `sub-test-pup-1`). No real animal, name, microchip or result goes here.

What these rows should produce (worked out by `breed-better/score.js`):

| Animal | Verdict | Points |
|---|---|---|
| sub-test-dog-1 (Test Dog One, F) | Pass | 15 of 20 |
| sub-test-pup-1 (Test Pup One, F) | Unverified | 0 of 20, 15 unverified (no hips record) |
| sub-test-dog-2 (Test Dog Two, M) | Fail | 0 of 15 (hips Poor; litters check is for F only) |

Used by `tests/mocked/breed-better-acceptance.spec.js`. The spec is in the Drive file
`RR_Breed-Better_CD-Hub_spec-and-acceptance.md` in the Breed Better folder.

`BLD-score_band.csv` also carries the optional look columns `icon_key`, `line_colour`, `icon_light` and `icon_dark`
(invented values; a blank cell falls back to the `colour` word mapped to the house tokens, and a blank `icon_key` draws the
must-pass star on a gate band or a plain mark on any other).
