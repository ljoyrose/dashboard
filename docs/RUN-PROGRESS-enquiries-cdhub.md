# Enquiries in CD Hub

| Date | Stage | What changed | Tests | Result |
| --- | --- | --- | --- | --- |
| 2026-11-13 | 1 Core links | enquiries/core.js 1.15.0: bldLitterFor, bldSubjectFor, plainStage, optional trailing columns, BLD row builders | node --test tests/enquiries/*.test.js | 141 passed, 35 skipped, 0 failed |
| 2026-11-13 | 2 CD Hub section | cdhub/enquiries-view.js, More item, routes #/enquiries/<view>, example rows with the TEST stamp, link from the standalone page | node render of the view | home, litters and the TEST stamp render; write button omitted |
| 2026-11-13 | 3 BLD read | optional person, household, household member, subject owner, sale and match candidate files; litter list and filter; pup links; dog card Assigned or Owner | node render with invented BLD rows | Pair A links, Pup One links to the dog card, unlinked rows say not linked |
