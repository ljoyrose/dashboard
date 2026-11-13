# Enquiries in CD Hub

| Date | Stage | What changed | Tests | Result |
| --- | --- | --- | --- | --- |
| 2026-11-13 | 1 Core links | enquiries/core.js 1.15.0: bldLitterFor, bldSubjectFor, plainStage, optional trailing columns, BLD row builders | node --test tests/enquiries/*.test.js | 141 passed, 35 skipped, 0 failed |
| 2026-11-13 | 2 CD Hub section | cdhub/enquiries-view.js, More item, routes #/enquiries/<view>, example rows with the TEST stamp, link from the standalone page | node render of the view | home, litters and the TEST stamp render; write button omitted |
| 2026-11-13 | 3 BLD read | optional person, household, household member, subject owner, sale and match candidate files; litter list and filter; pup links; dog card Assigned or Owner | node render with invented BLD rows | Pair A links, Pup One links to the dog card, unlinked rows say not linked |
| 2026-11-13 | 4 BLD write, off | person, household, household member, subject owner and sale specs, owner only, always waiting; config.cdhub.enquiriesWrites false | node --test cdhub-write/tests/enquiries-bld.test.js and sink.test.js | buyer row queues and does not change the file; staff refused; prospect refused; sink suite passed |
| 2026-11-13 | 5 Look and checks | house classes only, contract headers, invented sample rows, Playwright spec, page-size file | node --test tests/enquiries/*.test.js; npx playwright test --project=mocked --project=phone | enquiries node tests 143 passed, 35 skipped; phone 35 passed; mocked suite re-run after the menu and sample-row fixes |
