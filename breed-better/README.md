# Breed Better calculator

Works out one animal's score from rows. It knows no species, breed, test or sheet: every gate, band and point is a row the user enters.

- `score.js`: the calculator. No clock and no network.
- `hub-view.js`: the CD Hub page and dog-card score. Reads rows and draws; writes nothing.
- `../tests/breed-better/`: invented animals only. Run with `node --test tests/breed-better/score.test.js tests/breed-better/hub-view.test.js`.

Rules it always keeps:
- One verdict: any fail is Fail; otherwise anything missing or expired is Unverified; only all clear is Pass.
- Missing evidence can never count as a pass.
- An answer with no matching rule is flagged, never scored 0.
- Dated rules (12 Nov 2026): criterion and answer rows may have `from_date` and `to_date` (inclusive; blank = no limit). Criterion rows sharing a `key` are versions of one check and must not overlap. Today's version decides what is read; each record is graded by the rows in force on its own date (points, pass or fail, how long it lasts, age weighting), so a rule change never makes an old record fail. Target and must-pass use today's rows. Enrolment and scheme rows may have `to_date`; a newer scheme with the same name takes over on its `effective_from`.

This folder holds code and invented test data only. Real animal data never goes in this repository.
