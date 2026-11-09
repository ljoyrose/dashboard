# Breed Better calculator

Works out one animal's score from rows. It knows no species, breed, test or sheet: every gate, band and point is a row the user enters.

- `score.js`: the calculator. No clock and no network.
- `hub-view.js`: the CD Hub page and dog-card score. Reads rows and draws; writes nothing.
- `tests/`: invented animals only. Run with `node --test breed-better/tests/score.test.js breed-better/tests/hub-view.test.js`.

Rules it always keeps:
- One verdict: any fail is Fail; otherwise anything missing or expired is Unverified; only all clear is Pass.
- Missing evidence can never count as a pass.
- An answer with no matching rule is flagged, never scored 0.

This folder holds code and invented test data only. Real animal data never goes in this repository.
