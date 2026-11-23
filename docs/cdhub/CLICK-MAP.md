# CD Hub click map

Every button, link and tap the click-crawl found, where each one goes and what it does. **Made by a script from the crawl's own results; nothing here is typed by hand.**

- Data: the invented 27-animal set (`tests/fixtures/cdhub-27`): Dog A.., Pup P.., Room N. No real name, id or date. The day is 10 Mar 2026.
- Remake it: `npx playwright test --project=mocked cdhub-crawl` then `node tools/cdhub-click-map/make.js`.
- Copies of one control (one per dog, room or day) are one row with a count. `#` stands for a number.
- A screen that is switched off (Assocs, Table map, Litters, Vet link) is named but not walked.

## Totals

| Where | Screen size | Result |
|---|---|---|
| CD Hub (cdhub/) | desktop, 1280px | visited 1354 of 1361 controls (99.5%) on 39 screens · LOOP 0 · DEAD 0 · ERROR 0 · ESCAPE 0 · WORDING 0 |
| CD Hub (cdhub/) | phone, 360px | visited 1354 of 1361 controls (99.5%) on 39 screens · LOOP 0 · DEAD 0 · ERROR 0 · ESCAPE 0 · WORDING 0 |
| Temperatures page (cdhub/history.html) | desktop, 1280px | visited 52 of 52 controls (100.0%) on 5 screens, plus 102 repeated calendar days sampled · LOOP 0 · DEAD 0 · ERROR 0 · ESCAPE 0 · WORDING 0 |
| Temperatures page (cdhub/history.html) | phone, 360px | visited 52 of 52 controls (100.0%) on 5 screens, plus 102 repeated calendar days sampled · LOOP 0 · DEAD 0 · ERROR 0 · ESCAPE 0 · WORDING 0 |
| Staff page (cdhub/staff/) | desktop, 1280px | visited 102 of 104 controls (98.1%) on 18 screens · LOOP 0 · DEAD 0 · ERROR 0 · ESCAPE 0 · WORDING 0 |
| Staff page (cdhub/staff/) | phone, 360px | visited 102 of 104 controls (98.1%) on 18 screens · LOOP 0 · DEAD 0 · ERROR 0 · ESCAPE 0 · WORDING 0 |

LOOP = goes round to the same screen. DEAD = nothing happens. ERROR = the browser logged an error. ESCAPE = left our pages. WORDING = raw or empty words.

## CD Hub (cdhub/)

| Screen | Control | What it is | Goes to | What happens | Copies |
|---|---|---|---|---|---|
| #/buyers (old address) | (typed address) |  | Main | opens Main | 1 |
| #/shape (old address) | (typed address) |  | Main | opens Main | 1 |
| #/litters (old address) | (typed address) |  | Main | opens Main | 1 |
| #/vet (old address) | (typed address) |  | Main | opens Main | 1 |
| #/map · Main | Sign out | button | Sign in to see the tables | signs out | 1 |
| #/map · Main [dialog#dashSearch] | Drive file names, Money to-dos and dates, CD Hub dogs and l… | box (search) | same screen | takes what is typed and redraws | 1 |
| #/map · Main [dialog#dashSearch] | Close | button | #/map · Main | closes it | 1 |
| #/map · Main [open:button.btn.house-ib] | Warm clear | button | same screen | moves to button | 1 |
| #/map · Main [open:button.btn.house-ib] | Cool clear | button | same screen | changes this screen | 1 |
| #/map · Main [open:button.btn.house-ib] | Outline | button | same screen | moves to button | 1 |
| #/map · Main [open:button.btn.house-ib] | Soft tint | button | same screen | changes this screen | 1 |
| #/map · Main [open:button.btn.house-ib] | Device | button | same screen | moves to button | 1 |
| #/map · Main [open:button.btn.house-ib] | Light | button | same screen | changes this screen | 1 |
| #/map · Main [open:button.btn.house-ib] | Dark | button | same screen | changes this screen | 1 |
| #/map · Main [open:button.btn.house-ib] | Hidden | button | same screen | moves to button | 1 |
| #/map · Main [open:button.btn.house-ib] | Show help | button | same screen | changes this screen | 1 |
| #/dogs/feb · Dogs | Fold Medicine in Feb # | button | same screen | changes this screen | 1 |
| #/dogs/feb · Dogs | Medicine in Feb # | row or card | same screen | changes this screen | 1 |
| #/dogs/feb · Dogs | D Mon YYYY Dog A.. Not named # tablet Oral | row or card | #/dogs/feb · Dogs [fold.dcs.meds] | opens it | 1 |
| #/dogs/feb · Dogs | Open Dog A..: medicines | button | #/dogs/feb · Dogs [fold.dcs.meds] | opens it | 8 |
| #/dogs/feb · Dogs | D Mon YYYY Dog A.. Not named # ml Oral | row or card | #/dogs/feb · Dogs [fold.dcs.meds] | opens it | 1 |
| #/dogs/feb · Dogs | D Mon YYYY Dog A.. Sample Spot-on # pipette Topical | row or card | #/dogs/feb · Dogs [fold.dcs.meds] | opens it | 6 |
| #/dogs/feb · Dogs | Search dogs | box (search) | same screen | takes what is typed and redraws | 1 |
| #/dogs/feb · Dogs | Filter | button | #/dogs/feb · Dogs [open:button.btn.fbtn] | opens it | 1 |
| #/dogs/feb · Dogs | Sort | list | same screen | changes this screen | 1 |
| #/dogs/feb · Dogs | Edit | button | #/dogs/feb · Dogs [open:button.btn.dedit] | opens it | 1 |
| #/dogs/feb · Dogs | Room N | button | same screen | changes this screen | 17 |
| #/dogs/feb · Dogs | # kg Medium ↑ # · D Mon YYYY BCS # | fold | #/dogs/feb · Dogs [fold.dcs.wtc] | opens it | 1 |
| #/dogs/feb · Dogs | # medications · last D Mon YYYY | fold | #/dogs/feb · Dogs [fold.dcs.meds] | opens it | 1 |
| #/dogs/feb · Dogs | More | fold | #/dogs/feb · Dogs [fold.dcs.more] | opens it | 1 |
| #/dogs/feb · Dogs | Breed Better: Pass, # of #. Testing. Open the Breed Better … | button | #/breed · Breed Better Testing | opens it | 2 |
| #/dogs/feb · Dogs | Must pass All # passed | fold | #/dogs/feb · Dogs [fold.bb-secf.bb-miss] | opens it | 1 |
| #/dogs/feb · Dogs | Edit | button | #/dogs/feb · Dogs [fold.bb-secf.bb-miss, open:button.btn.de… | opens it | 1 |
| #/dogs/feb · Dogs | # kg Medium ↑ # · D Mon YYYY BCS # | fold | #/dogs/feb · Dogs [fold.bb-secf.bb-miss, fold.dcs.wtc] | opens it | 1 |
| #/dogs/feb · Dogs | # medications · last D Mon YYYY | fold | #/dogs/feb · Dogs [fold.bb-secf.bb-miss, fold.dcs.meds] | opens it | 1 |
| #/dogs/feb · Dogs | More | fold | #/dogs/feb · Dogs [fold.bb-secf.bb-miss, fold.dcs.more] | opens it | 1 |
| #/dogs/feb · Dogs | Not in Breed Better Enrol | fold | #/dogs/feb · Dogs [fold.bb-secf, fold.bb-secf.bb-miss] | opens it | 1 |
| #/dogs/feb · Dogs | Edit | button | #/dogs/feb · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, open… | opens it | 15 |
| #/dogs/feb · Dogs | # kg Medium ↑ # · D Mon YYYY BCS # | fold | #/dogs/feb · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold… | opens it | 5 |
| #/dogs/feb · Dogs | # medications · last D Mon YYYY | fold | #/dogs/feb · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold… | opens it | 6 |
| #/dogs/feb · Dogs | More | fold | #/dogs/feb · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold… | opens it | 15 |
| #/dogs/feb · Dogs | Breed Better: Unverified, # of #. Testing. Open the Breed B… | button | #/breed · Breed Better Testing | opens it | 1 |
| #/dogs/feb · Dogs | Must pass # missing | fold | same screen | changes this screen | 1 |
| #/dogs/feb · Dogs | # kg Small ↑ # · D Mon YYYY BCS # | fold | #/dogs/feb · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold… | opens it | 2 |
| #/dogs/feb · Dogs | Not in Breed Better Enrol | fold | same screen | changes this screen | 13 |
| #/dogs/feb · Dogs | # medication · last D Mon YYYY | fold | #/dogs/feb · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold… | opens it | 6 |
| #/dogs/feb · Dogs | # kg Large ↑ # · D Mon YYYY BCS # | fold | #/dogs/feb · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold… | opens it | 1 |
| #/dogs/feb · Dogs | Must pass All # passed | fold | same screen | changes this screen | 1 |
| #/dogs/feb · Dogs | # kg Small ↑ # · D Mon YYYY | fold | #/dogs/feb · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold… | opens it | 7 |
| #/dogs/feb · Dogs | no medications | fold | #/dogs/feb · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold… | opens it | 3 |
| #/dogs/feb · Dogs | no chip recorded | button | #/dogs/feb · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, open… | opens it | 3 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | Fold Medicine in Mar # | button | same screen | changes this screen | 1 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | Medicine in Mar # | row or card | same screen | changes this screen | 1 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | D Mon YYYY Dog A.. Sample Wormer # tablets Oral | row or card | same screen | moves to summary | 1 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | Open Dog A..: medicines | button | same screen | moves to summary | 1 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | Search dogs | box (search) | same screen | takes what is typed and redraws | 1 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | Filter | button | #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold… | opens it | 1 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | Sort | list | same screen | changes this screen | 1 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | Edit | button | #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold… | opens it | 9 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | Room N | button | same screen | changes this screen | 17 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | # kg Medium ↑ # · D Mon YYYY BCS # | fold | #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold… | opens it | 6 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | # medications · last D Mon YYYY | fold | same screen | changes this screen | 7 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | More | fold | #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold… | opens it | 9 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | Breed Better: Pass, # of #. Testing. Open the Breed Better … | button | #/breed · Breed Better Testing | opens it | 2 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | Must pass All # passed | fold | same screen | changes this screen | 1 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | Not in Breed Better Enrol | fold | same screen | changes this screen | 13 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | Breed Better: Unverified, # of #. Testing. Open the Breed B… | button | #/breed · Breed Better Testing | opens it | 1 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | Must pass # missing | fold | same screen | changes this screen | 1 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | # kg Small ↑ # · D Mon YYYY BCS # | fold | #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold… | opens it | 2 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | # medication · last D Mon YYYY | fold | same screen | changes this screen | 6 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | # kg Large ↑ # · D Mon YYYY BCS # | fold | #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold… | opens it | 1 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | # medications · last D Mon YYYY | fold | #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss] | closes it | 1 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | Date | box (date) | same screen | takes what is typed and redraws | 1 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | Product | box (text) | same screen | takes what is typed and redraws | 1 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | Dose | box (text) | same screen | takes what is typed and redraws | 1 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | Route | list | same screen | changes this screen | 1 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | Note (optional) | box (text) | same screen | takes what is typed and redraws | 1 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | Add medication | button | same screen | moves to input | 1 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | Must pass All # passed | fold | #/dogs/mar · Dogs [fold.bb-secf, fold.dcs.meds] | closes it | 1 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | Edit | button | #/dogs/mar · Dogs [fold.bb-secf, fold.dcs.meds, open:button… | opens it | 8 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | # kg Medium ↑ # · D Mon YYYY BCS # | fold | #/dogs/mar · Dogs [fold.bb-secf, fold.dcs.meds, fold.dcs.wt… | opens it | 1 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | More | fold | #/dogs/mar · Dogs [fold.bb-secf, fold.dcs.meds, fold.dcs.mo… | opens it | 8 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | # kg Small ↑ # · D Mon YYYY | fold | #/dogs/mar · Dogs [fold.bb-secf, fold.dcs.meds, fold.dcs.wt… | opens it | 7 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | no medications | fold | same screen | changes this screen | 3 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | no chip recorded | button | #/dogs/mar · Dogs [fold.bb-secf, fold.dcs.meds, open:button… | opens it | 3 |
| #/dogs/mar · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | Not in Breed Better Enrol | fold | #/dogs/mar · Dogs [fold.dcs.meds] | closes it | 1 |
| #/today/bitches · Today: D Mon YYYY | ← Today | link | #/today · Today: D Mon YYYY | opens it | 1 |
| #/today/bitches · Today: D Mon YYYY | Fold Today checklist# of # done | button | same screen | changes this screen | 1 |
| #/today/bitches · Today: D Mon YYYY | Today checklist # of # done | row or card | same screen | changes this screen | 1 |
| #/today/bitches · Today: D Mon YYYY | The round | button | #/round · The round | opens it | 2 |
| #/today/bitches · Today: D Mon YYYY | Fold On site | button | same screen | changes this screen | 1 |
| #/today/bitches · Today: D Mon YYYY | On site | row or card | same screen | changes this screen | 1 |
| #/today/bitches · Today: D Mon YYYY | On site: #. Open the list | link | #/today/here · Today: D Mon YYYY | opens it | 1 |
| #/today/bitches · Today: D Mon YYYY | Adults: #. Open the list | link | #/today/adults · Today: D Mon YYYY | opens it | 1 |
| #/today/bitches · Today: D Mon YYYY | Under # months: #. Open the list | link | #/today/pups · Today: D Mon YYYY | opens it | 1 |
| #/today/bitches · Today: D Mon YYYY | Breeding bitches in law: #. Open the list | link | same screen | scrolls to its place | 1 |
| #/today/bitches · Today: D Mon YYYY | Stud males: #. Open the list | link | #/today/studs · Today: D Mon YYYY | opens it | 1 |
| #/today/bitches · Today: D Mon YYYY | Off site: #. Open the list | link | #/today/offsite · Today: D Mon YYYY | opens it | 1 |
| #/today/bitches · Today: D Mon YYYY | Dogs | button | #/dogs · Dogs | opens it | 1 |
| #/today/bitches · Today: D Mon YYYY | Temperatures today Morning # of # Evening # of # Rooms # wa… | row or card | #/round · The round | opens it | 1 |
| #/today/bitches · Today: D Mon YYYY | Fold Temperatures today | button | same screen | changes this screen | 1 |
| #/today/bitches · Today: D Mon YYYY | Outdoor forecast: next # days | row or card | #/round · The round | opens it | 1 |
| #/today/bitches · Today: D Mon YYYY | Temperature history | link | Temperatures page | opens that page | 1 |
| #/today/bitches · Today: D Mon YYYY | + Thermometer | link | Staff print page | opens that page | 1 |
| #/today/bitches · Today: D Mon YYYY | # of # cabins with a temperature enter on The round | button | #/round · The round | opens it | 1 |
| #/today/bitches · Today: D Mon YYYY | # dogs not yet placed | button | same screen | changes this screen | 1 |
| #/today/bitches · Today: D Mon YYYY | # dogs here | button | same screen | changes this screen | 1 |
| #/today/bitches · Today: D Mon YYYY | # FT # PT staffing # per #, or # per # adults | button | same screen | changes this screen | 1 |
| #/today/bitches · Today: D Mon YYYY | Fold Breeding bitches in law | button | same screen | changes this screen | 1 |
| #/today/bitches · Today: D Mon YYYY | Breeding bitches in law # | row or card | same screen | changes this screen | 1 |
| #/today/bitches · Today: D Mon YYYY | Cabin for Dog A.. | list | same screen | changes this screen | 10 |
| #/today/bitches · Today: D Mon YYYY | Place | button | same screen | changes this screen | 10 |
| #/today/bitches · Today: D Mon YYYY | close | button | same screen | changes this screen | 1 |
| #/today/bitches · Today: D Mon YYYY | # breeding bitches | button | same screen | changes this screen | 1 |
| #/today/bitches · Today: D Mon YYYY | # retired, entire | button | same screen | already showing this list | 1 |
| #/today/bitches · Today: D Mon YYYY | # studs | button | same screen | changes this screen | 1 |
| #/today/bitches · Today: D Mon YYYY | # other | button | same screen | changes this screen | 1 |
| #/today/nochip · Today: D Mon YYYY | ← Today | link | #/today · Today: D Mon YYYY | opens it | 1 |
| #/today/nochip · Today: D Mon YYYY | Fold Today checklist# of # done | button | same screen | changes this screen | 1 |
| #/today/nochip · Today: D Mon YYYY | Today checklist # of # done | row or card | same screen | changes this screen | 1 |
| #/today/nochip · Today: D Mon YYYY | The round | button | #/round · The round | opens it | 2 |
| #/today/nochip · Today: D Mon YYYY | Fold On site | button | same screen | changes this screen | 1 |
| #/today/nochip · Today: D Mon YYYY | On site | row or card | same screen | changes this screen | 1 |
| #/today/nochip · Today: D Mon YYYY | On site: #. Open the list | link | #/today/here · Today: D Mon YYYY | opens it | 1 |
| #/today/nochip · Today: D Mon YYYY | Adults: #. Open the list | link | #/today/adults · Today: D Mon YYYY | opens it | 1 |
| #/today/nochip · Today: D Mon YYYY | Under # months: #. Open the list | link | #/today/pups · Today: D Mon YYYY | opens it | 1 |
| #/today/nochip · Today: D Mon YYYY | Breeding bitches in law: #. Open the list | link | #/today/bitches · Today: D Mon YYYY | opens it | 1 |
| #/today/nochip · Today: D Mon YYYY | Stud males: #. Open the list | link | #/today/studs · Today: D Mon YYYY | opens it | 1 |
| #/today/nochip · Today: D Mon YYYY | Off site: #. Open the list | link | #/today/offsite · Today: D Mon YYYY | opens it | 1 |
| #/today/nochip · Today: D Mon YYYY | Dogs | button | #/dogs · Dogs | opens it | 1 |
| #/today/nochip · Today: D Mon YYYY | Temperatures today Morning # of # Evening # of # Rooms # wa… | row or card | #/round · The round | opens it | 1 |
| #/today/nochip · Today: D Mon YYYY | Fold Temperatures today | button | same screen | changes this screen | 1 |
| #/today/nochip · Today: D Mon YYYY | Outdoor forecast: next # days | row or card | #/round · The round | opens it | 1 |
| #/today/nochip · Today: D Mon YYYY | Temperature history | link | Temperatures page | opens that page | 1 |
| #/today/nochip · Today: D Mon YYYY | + Thermometer | link | Staff print page | opens that page | 1 |
| #/today/nochip · Today: D Mon YYYY | # of # cabins with a temperature enter on The round | button | #/round · The round | opens it | 1 |
| #/today/nochip · Today: D Mon YYYY | # dogs not yet placed | button | same screen | changes this screen | 1 |
| #/today/nochip · Today: D Mon YYYY | # dogs here | button | same screen | changes this screen | 1 |
| #/today/nochip · Today: D Mon YYYY | # FT # PT staffing # per #, or # per # adults | button | same screen | changes this screen | 1 |
| #/today/nochip · Today: D Mon YYYY | Fold No microchip recorded | button | same screen | changes this screen | 1 |
| #/today/nochip · Today: D Mon YYYY | No microchip recorded # | row or card | same screen | changes this screen | 1 |
| #/today/nochip · Today: D Mon YYYY | chip # | box (text) | same screen | takes what is typed and redraws | 4 |
| #/today/nochip · Today: D Mon YYYY | Save | button | same screen | moves to input | 4 |
| #/today/nochip · Today: D Mon YYYY | close | button | same screen | changes this screen | 1 |
| #/today/nochip · Today: D Mon YYYY | # breeding bitches | button | same screen | changes this screen | 1 |
| #/today/nochip · Today: D Mon YYYY | # retired, entire | button | same screen | changes this screen | 1 |
| #/today/nochip · Today: D Mon YYYY | # studs | button | same screen | changes this screen | 1 |
| #/today/nochip · Today: D Mon YYYY | # other | button | same screen | changes this screen | 1 |
| #/today/unplaced · Today: D Mon YYYY | ← Today | link | #/today · Today: D Mon YYYY | opens it | 1 |
| #/today/unplaced · Today: D Mon YYYY | Fold Today checklist# of # done | button | same screen | changes this screen | 1 |
| #/today/unplaced · Today: D Mon YYYY | Today checklist # of # done | row or card | same screen | changes this screen | 1 |
| #/today/unplaced · Today: D Mon YYYY | The round | button | #/round · The round | opens it | 2 |
| #/today/unplaced · Today: D Mon YYYY | Fold On site | button | same screen | changes this screen | 1 |
| #/today/unplaced · Today: D Mon YYYY | On site | row or card | same screen | changes this screen | 1 |
| #/today/unplaced · Today: D Mon YYYY | On site: #. Open the list | link | #/today/here · Today: D Mon YYYY | opens it | 1 |
| #/today/unplaced · Today: D Mon YYYY | Adults: #. Open the list | link | #/today/adults · Today: D Mon YYYY | opens it | 1 |
| #/today/unplaced · Today: D Mon YYYY | Under # months: #. Open the list | link | #/today/pups · Today: D Mon YYYY | opens it | 1 |
| #/today/unplaced · Today: D Mon YYYY | Breeding bitches in law: #. Open the list | link | #/today/bitches · Today: D Mon YYYY | opens it | 1 |
| #/today/unplaced · Today: D Mon YYYY | Stud males: #. Open the list | link | #/today/studs · Today: D Mon YYYY | opens it | 1 |
| #/today/unplaced · Today: D Mon YYYY | Off site: #. Open the list | link | #/today/offsite · Today: D Mon YYYY | opens it | 1 |
| #/today/unplaced · Today: D Mon YYYY | Dogs | button | #/dogs · Dogs | opens it | 1 |
| #/today/unplaced · Today: D Mon YYYY | Temperatures today Morning # of # Evening # of # Rooms # wa… | row or card | #/round · The round | opens it | 1 |
| #/today/unplaced · Today: D Mon YYYY | Fold Temperatures today | button | same screen | changes this screen | 1 |
| #/today/unplaced · Today: D Mon YYYY | Outdoor forecast: next # days | row or card | #/round · The round | opens it | 1 |
| #/today/unplaced · Today: D Mon YYYY | Temperature history | link | Temperatures page | opens that page | 1 |
| #/today/unplaced · Today: D Mon YYYY | + Thermometer | link | Staff print page | opens that page | 1 |
| #/today/unplaced · Today: D Mon YYYY | # of # cabins with a temperature enter on The round | button | #/round · The round | opens it | 1 |
| #/today/unplaced · Today: D Mon YYYY | # dogs not yet placed | button | same screen | already showing this list | 1 |
| #/today/unplaced · Today: D Mon YYYY | # dogs here | button | same screen | changes this screen | 1 |
| #/today/unplaced · Today: D Mon YYYY | # FT # PT staffing # per #, or # per # adults | button | same screen | changes this screen | 1 |
| #/today/unplaced · Today: D Mon YYYY | Fold Dogs not yet placed | button | same screen | changes this screen | 1 |
| #/today/unplaced · Today: D Mon YYYY | Dogs not yet placed # | row or card | same screen | changes this screen | 1 |
| #/today/unplaced · Today: D Mon YYYY | Cabin for Dog A.. | list | same screen | changes this screen | 2 |
| #/today/unplaced · Today: D Mon YYYY | Place | button | same screen | changes this screen | 2 |
| #/today/unplaced · Today: D Mon YYYY | close | button | same screen | changes this screen | 1 |
| #/today/unplaced · Today: D Mon YYYY | # breeding bitches | button | same screen | changes this screen | 1 |
| #/today/unplaced · Today: D Mon YYYY | # retired, entire | button | same screen | changes this screen | 1 |
| #/today/unplaced · Today: D Mon YYYY | # studs | button | same screen | changes this screen | 1 |
| #/today/unplaced · Today: D Mon YYYY | # other | button | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | What was true on | box (date) | same screen | takes what is typed and redraws | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Urgent # | fold | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Room N is over its limit | link | #/areas/ar-N · Areas | opens it | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Requirements | fold | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Findings # | fold | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Inspections | fold | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Fold Data checks | button | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Data checks # failed | row or card | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | ✗ Licence counts fails law says #, your list says # Show | row or card | #/today/bitches · Today: D Mon YYYY | opens it | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Show the dogs: Licence counts | button | #/today/bitches · Today: D Mon YYYY | opens it | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | ✓ Date of birth passes every dog here has one Show | row or card | #/today/nodob · Today: D Mon YYYY | opens it | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Show the dogs: Date of birth | button | #/today/nodob · Today: D Mon YYYY | opens it | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | ✗ Microchip fails # here have no chip recorded Show | row or card | #/today/nochip · Today: D Mon YYYY | opens it | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Show the dogs: Microchip | button | #/today/nochip · Today: D Mon YYYY | opens it | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | ✗ Placed in a cabin fails # here are not in a cabin Show | row or card | #/today/noarea · Today: D Mon YYYY | opens it | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Show the dogs: Placed in a cabin | button | #/today/noarea · Today: D Mon YYYY | opens it | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Needs a look | fold | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Room limits # | fold | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Room N | link | #/areas/ar-N · Areas | opens it | 41 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Open Areas | link | #/areas · Areas | opens it | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Room temperatures # | fold | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | change | link | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Open The round | link | #/round · The round | opens it | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Temperature history | link | Temperatures page | opens that page | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Jobs | fold | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Cleaning | link | #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | # done, open Cleaning | link | #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | same address as "Cleaning" | 2 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | # due, open Cleaning | link | #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | same address as "Cleaning" | 2 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | # late, open Cleaning | link | #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | same address as "Cleaning" | 2 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Cleaning | link | #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | same address as "Cleaning" | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Care Check | link | #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | # done, open Care Check | link | #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | same address as "Care Check" | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | # due, open Care Check | link | #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | same address as "Care Check" | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | # late, open Care Check | link | #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | same address as "Care Check" | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Your rules | fold | #/compliance · Compliance [fold.compfold] | closes it | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Find a rule | box (search) | same screen | takes what is typed and redraws | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Not set only | box (checkbox) | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Breeding # # not set | fold | #/compliance · Compliance [fold.compfold] | closes it | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | i Source: invented | button | #/compliance · Compliance [fold.compfold, fold.rgroup, open… | opens it | 3 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Space and rooms # | fold | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Staffing # | fold | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Dogs # | fold | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Jobs and checks # | fold | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Add a rule or a change | fold | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | choose a rule | list | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | number | box (number) | same screen | takes what is typed and redraws | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | in force from | box (date) | same screen | takes what is typed and redraws | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | source | box (text) | same screen | takes what is typed and redraws | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Save rule | button | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Rehearsal | fold | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Start a rehearsal | button | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | Who has access | fold | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold, fold.rgroup] | The round | link | #/round · The round | same address as "Open The round" | 1 |
| #/areas/ar-N · Areas | ← Areas | link | #/areas · Areas | opens it | 1 |
| #/areas/ar-N · Areas | All cabins | link | #/areas · Areas | same address as "← Areas" | 1 |
| #/areas/ar-N · Areas | # cabins | button | #/areas/cabins · Areas | opens it | 1 |
| #/areas/ar-N · Areas | # m² unconfirmed | button | #/areas/nom# · Areas | opens it | 1 |
| #/areas/ar-N · Areas | #/# have a mode | button | #/areas/nomode · Areas | opens it | 1 |
| #/areas/ar-N · Areas | #/# occupied | button | #/areas/occ · Areas | opens it | 1 |
| #/areas/ar-N · Areas | Search areas | box (search) | same screen | takes what is typed and redraws | 1 |
| #/areas/ar-N · Areas | Sort | list | same screen | changes this screen | 1 |
| #/areas/ar-N · Areas | Fold Room N # m² | button | same screen | changes this screen | 1 |
| #/areas/ar-N · Areas | Room N # m² limited | row or card | same screen | changes this screen | 1 |
| #/areas/ar-N · Areas | flap – Room N # m² limited | list | same screen | changes this screen | 1 |
| #/areas/ar-N · Areas | Print sign | link | Staff print page | opens in a new tab | 1 |
| #/areas/ar-N · Areas | # job record | fold | #/areas/ar-N · Areas [fold.dcs] | opens it | 1 |
| #/areas/ar-N · Areas | All figures | fold | #/areas/ar-N · Areas [fold.allfig] | opens it | 1 |
| #/areas/ar-N · Areas | Temperature history | link | Temperatures page | opens that page | 1 |
| #/areas/ar-N · Areas | Move Dog A.. | button | same screen | changes this screen | 3 |
| #/areas/ar-N · Areas | over its limit | button | same screen | changes this screen | 1 |
| #/today/nodob · Today: D Mon YYYY | ← Today | link | #/today · Today: D Mon YYYY | opens it | 1 |
| #/today/nodob · Today: D Mon YYYY | Fold Today checklist# of # done | button | same screen | changes this screen | 1 |
| #/today/nodob · Today: D Mon YYYY | Today checklist # of # done | row or card | same screen | changes this screen | 1 |
| #/today/nodob · Today: D Mon YYYY | The round | button | #/round · The round | opens it | 2 |
| #/today/nodob · Today: D Mon YYYY | Fold On site | button | same screen | changes this screen | 1 |
| #/today/nodob · Today: D Mon YYYY | On site | row or card | same screen | changes this screen | 1 |
| #/today/nodob · Today: D Mon YYYY | On site: #. Open the list | link | #/today/here · Today: D Mon YYYY | opens it | 1 |
| #/today/nodob · Today: D Mon YYYY | Adults: #. Open the list | link | #/today/adults · Today: D Mon YYYY | opens it | 1 |
| #/today/nodob · Today: D Mon YYYY | Under # months: #. Open the list | link | #/today/pups · Today: D Mon YYYY | opens it | 1 |
| #/today/nodob · Today: D Mon YYYY | Breeding bitches in law: #. Open the list | link | #/today/bitches · Today: D Mon YYYY | opens it | 1 |
| #/today/nodob · Today: D Mon YYYY | Stud males: #. Open the list | link | #/today/studs · Today: D Mon YYYY | opens it | 1 |
| #/today/nodob · Today: D Mon YYYY | Off site: #. Open the list | link | #/today/offsite · Today: D Mon YYYY | opens it | 1 |
| #/today/nodob · Today: D Mon YYYY | Dogs | button | #/dogs · Dogs | opens it | 1 |
| #/today/nodob · Today: D Mon YYYY | Temperatures today Morning # of # Evening # of # Rooms # wa… | row or card | #/round · The round | opens it | 1 |
| #/today/nodob · Today: D Mon YYYY | Fold Temperatures today | button | same screen | changes this screen | 1 |
| #/today/nodob · Today: D Mon YYYY | Outdoor forecast: next # days | row or card | #/round · The round | opens it | 1 |
| #/today/nodob · Today: D Mon YYYY | Temperature history | link | Temperatures page | opens that page | 1 |
| #/today/nodob · Today: D Mon YYYY | + Thermometer | link | Staff print page | opens that page | 1 |
| #/today/nodob · Today: D Mon YYYY | # of # cabins with a temperature enter on The round | button | #/round · The round | opens it | 1 |
| #/today/nodob · Today: D Mon YYYY | # dogs not yet placed | button | same screen | changes this screen | 1 |
| #/today/nodob · Today: D Mon YYYY | # dogs here | button | same screen | changes this screen | 1 |
| #/today/nodob · Today: D Mon YYYY | # FT # PT staffing # per #, or # per # adults | button | same screen | changes this screen | 1 |
| #/today/nodob · Today: D Mon YYYY | Fold No date of birth | button | same screen | changes this screen | 1 |
| #/today/nodob · Today: D Mon YYYY | No date of birth | row or card | same screen | changes this screen | 1 |
| #/today/nodob · Today: D Mon YYYY | close | button | same screen | changes this screen | 1 |
| #/today/nodob · Today: D Mon YYYY | # breeding bitches | button | same screen | changes this screen | 1 |
| #/today/nodob · Today: D Mon YYYY | # retired, entire | button | same screen | changes this screen | 1 |
| #/today/nodob · Today: D Mon YYYY | # studs | button | same screen | changes this screen | 1 |
| #/today/nodob · Today: D Mon YYYY | # other | button | same screen | changes this screen | 1 |
| #/today/noarea · Today: D Mon YYYY | ← Today | link | #/today · Today: D Mon YYYY | opens it | 1 |
| #/today/noarea · Today: D Mon YYYY | Fold Today checklist# of # done | button | same screen | changes this screen | 1 |
| #/today/noarea · Today: D Mon YYYY | Today checklist # of # done | row or card | same screen | changes this screen | 1 |
| #/today/noarea · Today: D Mon YYYY | The round | button | #/round · The round | opens it | 2 |
| #/today/noarea · Today: D Mon YYYY | Fold On site | button | same screen | changes this screen | 1 |
| #/today/noarea · Today: D Mon YYYY | On site | row or card | same screen | changes this screen | 1 |
| #/today/noarea · Today: D Mon YYYY | On site: #. Open the list | link | #/today/here · Today: D Mon YYYY | opens it | 1 |
| #/today/noarea · Today: D Mon YYYY | Adults: #. Open the list | link | #/today/adults · Today: D Mon YYYY | opens it | 1 |
| #/today/noarea · Today: D Mon YYYY | Under # months: #. Open the list | link | #/today/pups · Today: D Mon YYYY | opens it | 1 |
| #/today/noarea · Today: D Mon YYYY | Breeding bitches in law: #. Open the list | link | #/today/bitches · Today: D Mon YYYY | opens it | 1 |
| #/today/noarea · Today: D Mon YYYY | Stud males: #. Open the list | link | #/today/studs · Today: D Mon YYYY | opens it | 1 |
| #/today/noarea · Today: D Mon YYYY | Off site: #. Open the list | link | #/today/offsite · Today: D Mon YYYY | opens it | 1 |
| #/today/noarea · Today: D Mon YYYY | Dogs | button | #/dogs · Dogs | opens it | 1 |
| #/today/noarea · Today: D Mon YYYY | Temperatures today Morning # of # Evening # of # Rooms # wa… | row or card | #/round · The round | opens it | 1 |
| #/today/noarea · Today: D Mon YYYY | Fold Temperatures today | button | same screen | changes this screen | 1 |
| #/today/noarea · Today: D Mon YYYY | Outdoor forecast: next # days | row or card | #/round · The round | opens it | 1 |
| #/today/noarea · Today: D Mon YYYY | Temperature history | link | Temperatures page | opens that page | 1 |
| #/today/noarea · Today: D Mon YYYY | + Thermometer | link | Staff print page | opens that page | 1 |
| #/today/noarea · Today: D Mon YYYY | # of # cabins with a temperature enter on The round | button | #/round · The round | opens it | 1 |
| #/today/noarea · Today: D Mon YYYY | # dogs not yet placed | button | same screen | changes this screen | 1 |
| #/today/noarea · Today: D Mon YYYY | # dogs here | button | same screen | changes this screen | 1 |
| #/today/noarea · Today: D Mon YYYY | # FT # PT staffing # per #, or # per # adults | button | same screen | changes this screen | 1 |
| #/today/noarea · Today: D Mon YYYY | Fold Not in a cabin | button | same screen | changes this screen | 1 |
| #/today/noarea · Today: D Mon YYYY | Not in a cabin # | row or card | same screen | changes this screen | 1 |
| #/today/noarea · Today: D Mon YYYY | Cabin for Dog A.. | list | same screen | changes this screen | 2 |
| #/today/noarea · Today: D Mon YYYY | Place | button | same screen | changes this screen | 2 |
| #/today/noarea · Today: D Mon YYYY | close | button | same screen | changes this screen | 1 |
| #/today/noarea · Today: D Mon YYYY | # breeding bitches | button | same screen | changes this screen | 1 |
| #/today/noarea · Today: D Mon YYYY | # retired, entire | button | same screen | changes this screen | 1 |
| #/today/noarea · Today: D Mon YYYY | # studs | button | same screen | changes this screen | 1 |
| #/today/noarea · Today: D Mon YYYY | # other | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | ← SOPs | link | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Search SOPs | box (search) | same screen | takes what is typed and redraws | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Filter | button | #/sops/Cleaning · SOPs [fold.sopgrp, open:button.btn.fbtn, … | opens it | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Sort | list | #/sops/Cleaning · SOPs [open:button.sopopen] | closes it | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | White – vision # | fold | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Annual: Microchip Audit White | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Annual: Sign-Off White | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Ongoing: Licence Display White | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Ongoing: Record Keeping White | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Ad hoc: Read-and-Sign White | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Breeding: Mating Plan White | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Red – risk and legal # | fold | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Ongoing: Emergency Display Red | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Ongoing: Site Security Red | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Ongoing: Workplace Safety Red | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Ad hoc: Accident Report Red | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Ad hoc: Euthanasia Red | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Ad hoc: Evacuation Red | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Ad hoc: Inspections Red | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Ad hoc: Lost Dog Red | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Ad hoc: Outbreak Response Red | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Orange – money # | fold | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Breeding: Health Screening Orange | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Yellow – operations # | fold | #/sops/Cleaning · SOPs [fold.sopgrp] | closes it | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Daily: Care Rounds Yellow | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Daily: Cleaning Yellow | button | #/sops/Cleaning · SOPs [fold.sopgrp] | closes it | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Daily: Feeding Yellow | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Daily: Health Check Yellow | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Weekly: Deep Clean Yellow | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Weekly: Pest Checks Yellow | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Monthly: Care Check Yellow | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Monthly: Condition Scoring Yellow | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Monthly: Full Clean Yellow | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Annual: Fitness Review Yellow | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Ongoing: Hygiene Yellow | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Ongoing: Medicines Yellow | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Ongoing: Pest Control Yellow | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Per litter: Whelping Yellow | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Ad hoc: Dog Intake Yellow | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Ad hoc: Isolation Yellow | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Ad hoc: Isolation Release Yellow | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Ad hoc: Occupant Clean Yellow | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Ad hoc: Parasites and Zoonoses Yellow | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Ad hoc: Transport Yellow | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Ad hoc: Vaccinations Yellow | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Breeding: Mating and Retirement Yellow | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Breeding: Ovulation Testing Yellow | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Breeding: Season Tracking Yellow | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Green – connection # | fold | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Weekly: Staff Rota Green | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Ongoing: Staff Training Green | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Ongoing: Staffing Ratio and Cover Green | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Ad hoc: Induction Green | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Blue – sales # | fold | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Per litter: Puppy Handover Blue | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Per litter: Puppy Packs Blue | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Per litter: Socialisation Blue | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Ad hoc: Collections Blue | button | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Purple – ideas # | fold | same screen | changes this screen | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Ongoing: Signs/Posters Index Purple | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | ← SOPs | link | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Search SOPs | box (search) | same screen | takes what is typed and redraws | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Filter | button | #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.btn.fbt… | opens it | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Sort | list | #/sops/Care%#Check · SOPs [open:button.sopopen] | closes it | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | White – vision # | fold | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Annual: Microchip Audit White | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Annual: Sign-Off White | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Ongoing: Licence Display White | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Ongoing: Record Keeping White | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Ad hoc: Read-and-Sign White | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Breeding: Mating Plan White | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Red – risk and legal # | fold | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Ongoing: Emergency Display Red | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Ongoing: Site Security Red | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Ongoing: Workplace Safety Red | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Ad hoc: Accident Report Red | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Ad hoc: Euthanasia Red | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Ad hoc: Evacuation Red | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Ad hoc: Inspections Red | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Ad hoc: Lost Dog Red | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Ad hoc: Outbreak Response Red | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Orange – money # | fold | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Breeding: Health Screening Orange | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Yellow – operations # | fold | #/sops/Care%#Check · SOPs [fold.sopgrp] | closes it | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Daily: Care Rounds Yellow | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Daily: Cleaning Yellow | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Daily: Feeding Yellow | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Daily: Health Check Yellow | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Weekly: Deep Clean Yellow | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Weekly: Pest Checks Yellow | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Monthly: Care Check Yellow | button | #/sops/Care%#Check · SOPs [fold.sopgrp] | closes it | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Monthly: Condition Scoring Yellow | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Monthly: Full Clean Yellow | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Annual: Fitness Review Yellow | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Ongoing: Hygiene Yellow | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Ongoing: Medicines Yellow | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Ongoing: Pest Control Yellow | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Per litter: Whelping Yellow | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Ad hoc: Dog Intake Yellow | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Ad hoc: Isolation Yellow | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Ad hoc: Isolation Release Yellow | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Ad hoc: Occupant Clean Yellow | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Ad hoc: Parasites and Zoonoses Yellow | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Ad hoc: Transport Yellow | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Ad hoc: Vaccinations Yellow | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Breeding: Mating and Retirement Yellow | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Breeding: Ovulation Testing Yellow | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Breeding: Season Tracking Yellow | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Green – connection # | fold | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Weekly: Staff Rota Green | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Ongoing: Staff Training Green | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Ongoing: Staffing Ratio and Cover Green | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Ad hoc: Induction Green | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Blue – sales # | fold | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Per litter: Puppy Handover Blue | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Per litter: Puppy Packs Blue | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Per litter: Socialisation Blue | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Ad hoc: Collections Blue | button | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Purple – ideas # | fold | same screen | changes this screen | 1 |
| #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | Ongoing: Signs/Posters Index Purple | button | same screen | changes this screen | 1 |
| #/dogs · Dogs | Search dogs | box (search) | same screen | takes what is typed and redraws | 1 |
| #/dogs · Dogs | Filter | button | #/dogs · Dogs [open:button.btn.fbtn] | opens it | 1 |
| #/dogs · Dogs | Sort | list | same screen | changes this screen | 1 |
| #/dogs · Dogs | Edit | button | #/dogs · Dogs [open:button.btn.dedit] | opens it | 1 |
| #/dogs · Dogs | Room N | button | same screen | changes this screen | 17 |
| #/dogs · Dogs | # kg Medium ↑ # · D Mon YYYY BCS # | fold | #/dogs · Dogs [fold.dcs.wtc] | opens it | 1 |
| #/dogs · Dogs | # medications · last D Mon YYYY | fold | #/dogs · Dogs [fold.dcs.meds] | opens it | 1 |
| #/dogs · Dogs | More | fold | #/dogs · Dogs [fold.dcs.more] | opens it | 1 |
| #/dogs · Dogs | Breed Better: Pass, # of #. Testing. Open the Breed Better … | button | #/breed · Breed Better Testing | opens it | 2 |
| #/dogs · Dogs | Must pass All # passed | fold | #/dogs · Dogs [fold.bb-secf.bb-miss] | opens it | 1 |
| #/dogs · Dogs | Edit | button | #/dogs · Dogs [fold.bb-secf.bb-miss, open:button.btn.dedit] | opens it | 1 |
| #/dogs · Dogs | # kg Medium ↑ # · D Mon YYYY BCS # | fold | #/dogs · Dogs [fold.bb-secf.bb-miss, fold.dcs.wtc] | opens it | 1 |
| #/dogs · Dogs | # medications · last D Mon YYYY | fold | #/dogs · Dogs [fold.bb-secf.bb-miss, fold.dcs.meds] | opens it | 1 |
| #/dogs · Dogs | More | fold | #/dogs · Dogs [fold.bb-secf.bb-miss, fold.dcs.more] | opens it | 1 |
| #/dogs · Dogs | Not in Breed Better Enrol | fold | #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss] | opens it | 1 |
| #/dogs · Dogs | Edit | button | #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, open:but… | opens it | 15 |
| #/dogs · Dogs | # kg Medium ↑ # · D Mon YYYY BCS # | fold | #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs… | opens it | 5 |
| #/dogs · Dogs | # medications · last D Mon YYYY | fold | #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs… | opens it | 6 |
| #/dogs · Dogs | More | fold | #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs… | opens it | 15 |
| #/dogs · Dogs | Breed Better: Unverified, # of #. Testing. Open the Breed B… | button | #/breed · Breed Better Testing | opens it | 1 |
| #/dogs · Dogs | Must pass # missing | fold | same screen | changes this screen | 1 |
| #/dogs · Dogs | # kg Small ↑ # · D Mon YYYY BCS # | fold | #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs… | opens it | 2 |
| #/dogs · Dogs | Not in Breed Better Enrol | fold | same screen | changes this screen | 13 |
| #/dogs · Dogs | # medication · last D Mon YYYY | fold | #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs… | opens it | 6 |
| #/dogs · Dogs | # kg Large ↑ # · D Mon YYYY BCS # | fold | #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs… | opens it | 1 |
| #/dogs · Dogs | Must pass All # passed | fold | same screen | changes this screen | 1 |
| #/dogs · Dogs | # kg Small ↑ # · D Mon YYYY | fold | #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs… | opens it | 7 |
| #/dogs · Dogs | no medications | fold | #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs… | opens it | 3 |
| #/dogs · Dogs | no chip recorded | button | #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, open:but… | opens it | 3 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, open:button.btn.fb… | Sex | list | same screen | changes this screen | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, open:button.btn.fb… | Neutered | list | same screen | changes this screen | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, open:button.btn.fb… | Age | list | #/dogs · Dogs [fold.bb-secf, open:button.btn.fbtn] | closes it | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, open:button.btn.fb… | Colour | list | same screen | changes this screen | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, open:button.btn.fb… | Screening | list | #/dogs · Dogs [fold.bb-secf, open:button.btn.fbtn] | closes it | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, open:button.btn.fb… | Bitch | button | same screen | changes this screen | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, open:button.btn.fb… | Stud | button | same screen | changes this screen | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, open:button.btn.fb… | Training | button | #/dogs · Dogs [open:button.btn.fbtn] | closes it | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, open:button.btn.fb… | Family | button | #/dogs · Dogs [open:button.btn.fbtn] | closes it | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, open:button.btn.fb… | Litter no mum | button | #/dogs · Dogs [open:button.btn.fbtn] | closes it | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, open:button.btn.fb… | Puppy | button | #/dogs · Dogs [fold.bb-secf, open:button.btn.fbtn] | closes it | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, open:button.btn.fb… | Deceased | button | #/dogs · Dogs [open:button.btn.fbtn] | closes it | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, open:button.btn.fb… | Collected | button | #/dogs · Dogs [open:button.btn.fbtn] | closes it | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, open:button.btn.fb… | All | button | same screen | already chosen | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, open:button.btn.fb… | i | button | #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, open:but… | opens it | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, open:button.btn.de… | Name | box (text) | same screen | takes what is typed and redraws | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, open:button.btn.de… | Sex | list | same screen | changes this screen | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, open:button.btn.de… | Date of birth | box (date) | same screen | takes what is typed and redraws | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, open:button.btn.de… | Colour | list | same screen | changes this screen | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, open:button.btn.de… | Neutered | list | same screen | changes this screen | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, open:button.btn.de… | Microchip | box (text) | same screen | takes what is typed and redraws | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, open:button.btn.de… | Size | list | same screen | changes this screen | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, open:button.btn.de… | Save details | button | same screen | changes this screen | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, open:button.btn.de… | Cancel | button | #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss] | closes it | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.wtc] | Date | box (date) | same screen | takes what is typed and redraws | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.wtc] | kg | box (number) | same screen | takes what is typed and redraws | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.wtc] | Body condition score, # to # | list | same screen | changes this screen | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.wtc] | Add weight | button | same screen | changes this screen | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | Date | box (date) | same screen | takes what is typed and redraws | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | Product | box (text) | same screen | takes what is typed and redraws | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | Dose | box (text) | same screen | takes what is typed and redraws | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | Route | list | same screen | changes this screen | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | Note (optional) | box (text) | same screen | takes what is typed and redraws | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.meds] | Add medication | button | same screen | moves to input | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.more] | no documents | fold | #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs… | opens it | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.more] | # health finding | fold | #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs… | opens it | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.more] | # vaccination · last D Mon YYYY due D Mon YYYY | fold | #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs… | opens it | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.more] | PRA clear VWD carrier | fold | #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs… | opens it | 1 |
| #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs.more] | # job record | fold | #/dogs · Dogs [fold.bb-secf, fold.bb-secf.bb-miss, fold.dcs… | opens it | 1 |
| #/staff · Staff | Board Home | link | Staff page | opens that page | 1 |
| #/staff · Staff | Jobs Due today | link | Staff page | opens that page | 1 |
| #/staff · Staff | Scan Room, dog, litter | link | Staff page | opens that page | 1 |
| #/staff · Staff | Temps Room readings | link | Staff page | opens that page | 1 |
| #/staff · Staff | Where Dogs by room | link | Staff page | opens that page | 1 |
| #/staff · Staff | This phone Code, saving | link | Staff page | opens that page | 1 |
| #/staff · Staff | Checks Staff checks | link | Checks page | opens that page | 1 |
| #/staff · Staff | Guest Visitor temps | link | Staff guest page | opens that page | 1 |
| #/staff · Staff | Inspector Link only | link | Staff inspect page | opens that page | 1 |
| #/today · Today: D Mon YYYY | Fold Today checklist# of # done | button | same screen | changes this screen | 1 |
| #/today · Today: D Mon YYYY | Today checklist # of # done | row or card | same screen | changes this screen | 1 |
| #/today · Today: D Mon YYYY | The round | button | #/round · The round | opens it | 2 |
| #/today · Today: D Mon YYYY | Fold On site | button | same screen | changes this screen | 1 |
| #/today · Today: D Mon YYYY | On site | row or card | same screen | changes this screen | 1 |
| #/today · Today: D Mon YYYY | On site: #. Open the list | link | #/today/here · Today: D Mon YYYY | opens it | 1 |
| #/today · Today: D Mon YYYY | Adults: #. Open the list | link | #/today/adults · Today: D Mon YYYY | opens it | 1 |
| #/today · Today: D Mon YYYY | Under # months: #. Open the list | link | #/today/pups · Today: D Mon YYYY | opens it | 1 |
| #/today · Today: D Mon YYYY | Breeding bitches in law: #. Open the list | link | #/today/bitches · Today: D Mon YYYY | opens it | 1 |
| #/today · Today: D Mon YYYY | Stud males: #. Open the list | link | #/today/studs · Today: D Mon YYYY | opens it | 1 |
| #/today · Today: D Mon YYYY | Off site: #. Open the list | link | #/today/offsite · Today: D Mon YYYY | opens it | 1 |
| #/today · Today: D Mon YYYY | Dogs | button | #/dogs · Dogs | opens it | 1 |
| #/today · Today: D Mon YYYY | Temperatures today Morning # of # Evening # of # Rooms # wa… | row or card | #/round · The round | opens it | 1 |
| #/today · Today: D Mon YYYY | Fold Temperatures today | button | same screen | changes this screen | 1 |
| #/today · Today: D Mon YYYY | Outdoor forecast: next # days | row or card | #/round · The round | opens it | 1 |
| #/today · Today: D Mon YYYY | Temperature history | link | Temperatures page | opens that page | 1 |
| #/today · Today: D Mon YYYY | + Thermometer | link | Staff print page | opens that page | 1 |
| #/today · Today: D Mon YYYY | # of # cabins with a temperature enter on The round | button | #/round · The round | opens it | 1 |
| #/today · Today: D Mon YYYY | # dogs not yet placed | button | same screen | changes this screen | 1 |
| #/today · Today: D Mon YYYY | # dogs here | button | same screen | changes this screen | 1 |
| #/today · Today: D Mon YYYY | # FT # PT staffing # per #, or # per # adults | button | same screen | changes this screen | 1 |
| #/today · Today: D Mon YYYY | # breeding bitches | button | same screen | changes this screen | 1 |
| #/today · Today: D Mon YYYY | # retired, entire | button | same screen | changes this screen | 1 |
| #/today · Today: D Mon YYYY | # studs | button | same screen | changes this screen | 1 |
| #/today · Today: D Mon YYYY | # other | button | same screen | changes this screen | 1 |
| #/today/here · Today: D Mon YYYY | ← Today | link | #/today · Today: D Mon YYYY | opens it | 1 |
| #/today/here · Today: D Mon YYYY | Temperatures today Morning # of # Evening # of # Rooms # wa… | row or card | #/round · The round | opens it | 1 |
| #/today/here · Today: D Mon YYYY | Fold Dogs here | button | same screen | changes this screen | 1 |
| #/today/here · Today: D Mon YYYY | Dogs here # | row or card | same screen | changes this screen | 1 |
| #/today/here · Today: D Mon YYYY | Cabin for Dog A.. | list | same screen | changes this screen | 15 |
| #/today/here · Today: D Mon YYYY | Place | button | same screen | changes this screen | 22 |
| #/today/here · Today: D Mon YYYY | Cabin for Pup P.. | list | same screen | changes this screen | 7 |
| #/today/here · Today: D Mon YYYY | close | button | same screen | changes this screen | 1 |
| #/today/adults · Today: D Mon YYYY | ← Today | link | #/today · Today: D Mon YYYY | opens it | 1 |
| #/today/adults · Today: D Mon YYYY | Temperatures today Morning # of # Evening # of # Rooms # wa… | row or card | #/round · The round | opens it | 1 |
| #/today/adults · Today: D Mon YYYY | Fold Adult dogs here | button | same screen | changes this screen | 1 |
| #/today/adults · Today: D Mon YYYY | Adult dogs here # | row or card | same screen | changes this screen | 1 |
| #/today/adults · Today: D Mon YYYY | Cabin for Dog A.. | list | same screen | changes this screen | 15 |
| #/today/adults · Today: D Mon YYYY | Place | button | same screen | changes this screen | 15 |
| #/today/adults · Today: D Mon YYYY | close | button | same screen | changes this screen | 1 |
| #/today/pups · Today: D Mon YYYY | ← Today | link | #/today · Today: D Mon YYYY | opens it | 1 |
| #/today/pups · Today: D Mon YYYY | Temperatures today Morning # of # Evening # of # Rooms # wa… | row or card | #/round · The round | opens it | 1 |
| #/today/pups · Today: D Mon YYYY | Fold Puppies | button | same screen | changes this screen | 1 |
| #/today/pups · Today: D Mon YYYY | Puppies # | row or card | same screen | changes this screen | 1 |
| #/today/pups · Today: D Mon YYYY | Cabin for Pup P.. | list | same screen | changes this screen | 7 |
| #/today/pups · Today: D Mon YYYY | Place | button | same screen | changes this screen | 7 |
| #/today/pups · Today: D Mon YYYY | close | button | same screen | changes this screen | 1 |
| #/today/studs · Today: D Mon YYYY | ← Today | link | #/today · Today: D Mon YYYY | opens it | 1 |
| #/today/studs · Today: D Mon YYYY | Temperatures today Morning # of # Evening # of # Rooms # wa… | row or card | #/round · The round | opens it | 1 |
| #/today/studs · Today: D Mon YYYY | Fold Stud males | button | same screen | changes this screen | 1 |
| #/today/studs · Today: D Mon YYYY | Stud males # | row or card | same screen | changes this screen | 1 |
| #/today/studs · Today: D Mon YYYY | Cabin for Dog A.. | list | same screen | changes this screen | 2 |
| #/today/studs · Today: D Mon YYYY | Place | button | same screen | changes this screen | 2 |
| #/today/studs · Today: D Mon YYYY | close | button | same screen | changes this screen | 1 |
| #/today/offsite · Today: D Mon YYYY | ← Today | link | #/today · Today: D Mon YYYY | opens it | 1 |
| #/today/offsite · Today: D Mon YYYY | Temperatures today Morning # of # Evening # of # Rooms # wa… | row or card | #/round · The round | opens it | 1 |
| #/today/offsite · Today: D Mon YYYY | Fold Off site | button | same screen | changes this screen | 1 |
| #/today/offsite · Today: D Mon YYYY | Off site # | row or card | same screen | changes this screen | 1 |
| #/today/offsite · Today: D Mon YYYY | Cabin for Dog A.. | list | same screen | changes this screen | 2 |
| #/today/offsite · Today: D Mon YYYY | Place | button | same screen | changes this screen | 2 |
| #/today/offsite · Today: D Mon YYYY | close | button | same screen | changes this screen | 1 |
| #/work · Outstanding | Fold Needs you today | button | same screen | changes this screen | 1 |
| #/work · Outstanding | Needs you today # | row or card | same screen | changes this screen | 1 |
| #/work · Outstanding | Room N is over its limit # medium is over the limit. This r… | row or card | #/compliance · Compliance [fold.compfold, fold.rgroup] | opens it | 1 |
| #/work · Outstanding | Open: Room N is over its limit | button | #/compliance · Compliance [fold.compfold, fold.rgroup] | opens it | 1 |
| #/work · Outstanding | Identify the medicine given in February # to name in Feb Sh… | row or card | #/dogs/feb · Dogs | opens it | 1 |
| #/work · Outstanding | Show the record: Identify the medicine given in February | button | #/dogs/feb · Dogs | opens it | 1 |
| #/work · Outstanding | Check the medicine given to Dog A.. in March Already on the… | row or card | #/dogs/mar · Dogs [fold.dcs.meds] | opens it | 1 |
| #/work · Outstanding | Show the record: Check the medicine given to Dog A.. in Mar… | button | #/dogs/mar · Dogs [fold.dcs.meds] | opens it | 1 |
| #/work · Outstanding | Licence counts needs a look law says #, your list says # Op… | row or card | #/today/bitches · Today: D Mon YYYY | opens it | 1 |
| #/work · Outstanding | Open: Licence counts needs a look | button | #/today/bitches · Today: D Mon YYYY | opens it | 1 |
| #/work · Outstanding | Microchip needs a look # here have no chip recorded Open | row or card | #/today/nochip · Today: D Mon YYYY | opens it | 1 |
| #/work · Outstanding | Open: Microchip needs a look | button | #/today/nochip · Today: D Mon YYYY | opens it | 1 |
| #/work · Outstanding | Placed in a cabin needs a look # here are not in a cabin Op… | row or card | #/today/noarea · Today: D Mon YYYY | opens it | 1 |
| #/work · Outstanding | Open: Placed in a cabin needs a look | button | #/today/noarea · Today: D Mon YYYY | opens it | 1 |
| #/work · Outstanding | Room limits needs a look # room is over: Room N (# medium, … | row or card | #/compliance · Compliance [fold.compfold, fold.rgroup] | opens it | 1 |
| #/work · Outstanding | Open: Room limits needs a look | button | #/compliance · Compliance [fold.compfold, fold.rgroup] | opens it | 1 |
| #/work · Outstanding | Show all | button | same screen | changes this screen | 1 |
| #/work · Outstanding | Search to-dos | box (search) | same screen | takes what is typed and redraws | 1 |
| #/work · Outstanding | Sort | list | same screen | changes this screen | 1 |
| #/work · Outstanding | Fold Waiting on you | button | same screen | changes this screen | 1 |
| #/work · Outstanding | Waiting on you # | row or card | same screen | changes this screen | 1 |
| #/work · Outstanding | Show the record | button | #/dogs/feb · Dogs | opens it | 1 |
| #/work · Outstanding | Show the record | button | #/dogs/mar · Dogs [fold.dcs.meds] | opens it | 1 |
| #/work · Outstanding | Fold Waiting on me | button | same screen | changes this screen | 1 |
| #/work · Outstanding | Waiting on me # | row or card | same screen | changes this screen | 1 |
| #/items · Items | Fold Items | button | same screen | changes this screen | 1 |
| #/items · Items | Items | row or card | same screen | changes this screen | 1 |
| #/breed · Breed Better Testing | Find | box (search) | same screen | takes what is typed and redraws | 1 |
| #/breed · Breed Better Testing | Sort | list | same screen | changes this screen | 1 |
| #/breed · Breed Better Testing | All # | button | same screen | scrolls to its place | 1 |
| #/breed · Breed Better Testing | Pass # | button | same screen | changes this screen | 1 |
| #/breed · Breed Better Testing | Below target # | button | same screen | changes this screen | 1 |
| #/breed · Breed Better Testing | Unverified # | button | same screen | changes this screen | 1 |
| #/breed · Breed Better Testing | Fail # | button | same screen | changes this screen | 1 |
| #/breed · Breed Better Testing | Any sex | button | same screen | scrolls to its place | 1 |
| #/breed · Breed Better Testing | Female # | button | same screen | changes this screen | 1 |
| #/breed · Breed Better Testing | Male # | button | same screen | changes this screen | 1 |
| #/breed · Breed Better Testing | Any age | button | same screen | scrolls to its place | 1 |
| #/breed · Breed Better Testing | Puppy # | button | same screen | changes this screen | 1 |
| #/breed · Breed Better Testing | Adult # | button | same screen | changes this screen | 1 |
| #/breed · Breed Better Testing | Dog A.. # Male, # yrs # mths Pass # of # | button | #/breed/score.sub-.. · Breed Better Testing | opens it | 1 |
| #/breed · Breed Better Testing | Dog A.. # Female, # yrs # mths Pass # of # | button | #/breed/score.sub-.. · Breed Better Testing | opens it | 1 |
| #/breed · Breed Better Testing | Dog A.. # Female, # yrs # mth Unverified # of #, # unverifi… | button | #/breed/score.sub-.. · Breed Better Testing | opens it | 1 |
| #/breed/score.sub-.. · Breed Better Testing | Back | button | #/breed/dogs · Breed Better Testing | opens it | 1 |
| #/breed/score.sub-.. · Breed Better Testing | Next: Dog A.. | button | same screen | changes this screen | 1 |
| #/breed/score.sub-.. · Breed Better Testing | Information Male, # yrs # mths | fold | #/breed/score.sub-.. · Breed Better Testing [fold.card.bb-i… | opens it | 1 |
| #/breed/score.sub-.. · Breed Better Testing | DNA panel # Affected or at risk | fold | #/breed/score.sub-.. · Breed Better Testing [fold.card.bb-d… | opens it | 1 |
| #/breed/score.sub-.. · Breed Better Testing | Gates Pass # of # met | fold | #/breed/score.sub-.. · Breed Better Testing [fold.card.bb-b… | opens it | 1 |
| #/breed/score.sub-.. · Breed Better Testing | Health Pass # of # | fold | same screen | changes this screen | 1 |
| #/breed/score.sub-.. · Breed Better Testing | Status Active | fold | same screen | changes this screen | 1 |
| #/areas · Areas | # cabins | button | #/areas/cabins · Areas | opens it | 1 |
| #/areas · Areas | # m² unconfirmed | button | #/areas/nom# · Areas | opens it | 1 |
| #/areas · Areas | #/# have a mode | button | #/areas/nomode · Areas | opens it | 1 |
| #/areas · Areas | #/# occupied | button | #/areas/occ · Areas | opens it | 1 |
| #/areas · Areas | Search areas | box (search) | same screen | takes what is typed and redraws | 1 |
| #/areas · Areas | Sort | list | same screen | changes this screen | 1 |
| #/areas · Areas | Fold Room N # m² | button | same screen | changes this screen | 6 |
| #/areas · Areas | Room N # m² free | row or card | same screen | changes this screen | 5 |
| #/areas · Areas | flap – Room N # m² free | list | same screen | changes this screen | 5 |
| #/areas · Areas | Print sign | link | Staff print page | opens in a new tab | 6 |
| #/areas · Areas | # job records | fold | #/areas · Areas [fold.dcs] | opens it | 2 |
| #/areas · Areas | All figures | fold | #/areas · Areas [fold.allfig] | opens it | 6 |
| #/areas · Areas | Temperature history | link | Temperatures page | opens that page | 6 |
| #/areas · Areas | Move Dog A.. | button | same screen | changes this screen | 13 |
| #/areas · Areas | Room N # m² limited | row or card | same screen | changes this screen | 1 |
| #/areas · Areas | flap – Room N # m² limited | list | same screen | changes this screen | 1 |
| #/areas · Areas | # job record | fold | #/areas · Areas [fold.dcs] | opens it | 4 |
| #/areas · Areas | over its limit | button | same screen | changes this screen | 1 |
| #/areas · Areas | Move Pup P.. | button | same screen | changes this screen | 7 |
| #/areas/cabins · Areas | ← Areas | link | #/areas · Areas | opens it | 1 |
| #/areas/nom# · Areas | ← Areas | link | #/areas · Areas | opens it | 1 |
| #/areas/nom# · Areas | All cabins | link | #/areas · Areas | same address as "← Areas" | 1 |
| #/areas/nomode · Areas | ← Areas | link | #/areas · Areas | opens it | 1 |
| #/areas/nomode · Areas | All cabins | link | #/areas · Areas | same address as "← Areas" | 1 |
| #/areas/occ · Areas | ← Areas | link | #/areas · Areas | opens it | 1 |
| #/areas/occ · Areas | All cabins | link | #/areas · Areas | same address as "← Areas" | 1 |
| #/round · The round | Date | box (date) | same screen | takes what is typed and redraws | 1 |
| #/round · The round | Temperature history | link | Temperatures page | opens that page | 1 |
| #/round · The round | Fold Saving on this device: off | button | same screen | changes this screen | 1 |
| #/round · The round | Saving on this device: off | row or card | same screen | changes this screen | 1 |
| #/round · The round | Save script address | box (url) | same screen | takes what is typed and redraws | 1 |
| #/round · The round | Your staff code | box (password) | same screen | takes what is typed and redraws | 1 |
| #/round · The round | Use these | button | same screen | changes this screen | 1 |
| #/round · The round | Switch off here | button | same screen | scrolls to its place | 1 |
| #/round · The round | Fold Readings | button | same screen | changes this screen | 1 |
| #/round · The round | Readings | row or card | same screen | changes this screen | 1 |
| #/round · The round | Fold #. Room N # m² | button | same screen | changes this screen | 6 |
| #/round · The round | #. Room N # m² free | row or card | same screen | changes this screen | 5 |
| #/round · The round | flap – #. Room N # m² free | list | same screen | changes this screen | 5 |
| #/round · The round | add a dog – #. Room N # m² free | list | same screen | changes this screen | 5 |
| #/round · The round | Move Dog A.. | button | same screen | changes this screen | 13 |
| #/round · The round | present | button | same screen | changes this screen | 20 |
| #/round · The round | not here | button | same screen | changes this screen | 20 |
| #/round · The round | Room N Room N door am min °C | box (text) | same screen | takes what is typed and redraws | 1 |
| #/round · The round | Room N Room N door am max °C | box (text) | same screen | takes what is typed and redraws | 1 |
| #/round · The round | Empty | button | same screen | changes this screen | 11 |
| #/round · The round | Room N Room N door pm min °C | box (text) | same screen | takes what is typed and redraws | 1 |
| #/round · The round | Room N Room N door pm max °C | box (text) | same screen | takes what is typed and redraws | 1 |
| #/round · The round | Room N Room N window am min °C | box (text) | same screen | takes what is typed and redraws | 1 |
| #/round · The round | Room N Room N window am max °C | box (text) | same screen | takes what is typed and redraws | 1 |
| #/round · The round | Room N Room N window pm min °C | box (text) | same screen | takes what is typed and redraws | 1 |
| #/round · The round | Room N Room N window pm max °C | box (text) | same screen | takes what is typed and redraws | 1 |
| #/round · The round | Room N am min °C | box (text) | same screen | takes what is typed and redraws | 5 |
| #/round · The round | Room N am max °C | box (text) | same screen | takes what is typed and redraws | 5 |
| #/round · The round | Room N pm min °C | box (text) | same screen | takes what is typed and redraws | 5 |
| #/round · The round | Room N pm max °C | box (text) | same screen | takes what is typed and redraws | 5 |
| #/round · The round | #. Room N # m² limited | row or card | same screen | changes this screen | 1 |
| #/round · The round | flap – #. Room N # m² limited | list | same screen | changes this screen | 1 |
| #/round · The round | add a dog – #. Room N # m² limited | list | same screen | changes this screen | 1 |
| #/round · The round | over its limit | button | same screen | changes this screen | 1 |
| #/round · The round | Move Pup P.. | button | same screen | changes this screen | 7 |
| #/sops · SOPs [fold.sopgrp] | Search SOPs | box (search) | same screen | takes what is typed and redraws | 1 |
| #/sops · SOPs [fold.sopgrp] | Filter | button | #/sops · SOPs [fold.sopgrp, open:button.btn.fbtn] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Sort | list | #/sops · SOPs | closes it | 1 |
| #/sops · SOPs [fold.sopgrp] | White – vision # | fold | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Annual: Microchip Audit White | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Annual: Sign-Off White | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Ongoing: Licence Display White | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Ongoing: Record Keeping White | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Ad hoc: Read-and-Sign White | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Breeding: Mating Plan White | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Red – risk and legal # | fold | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Ongoing: Emergency Display Red | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Ongoing: Site Security Red | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Ongoing: Workplace Safety Red | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Ad hoc: Accident Report Red | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Ad hoc: Euthanasia Red | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Ad hoc: Evacuation Red | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Ad hoc: Inspections Red | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Ad hoc: Lost Dog Red | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Ad hoc: Outbreak Response Red | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Orange – money # | fold | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Breeding: Health Screening Orange | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Yellow – operations # | fold | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Daily: Care Rounds Yellow | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Daily: Cleaning Yellow | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Daily: Feeding Yellow | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Daily: Health Check Yellow | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Weekly: Deep Clean Yellow | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Weekly: Pest Checks Yellow | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Monthly: Care Check Yellow | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Monthly: Condition Scoring Yellow | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Monthly: Full Clean Yellow | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Annual: Fitness Review Yellow | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Ongoing: Hygiene Yellow | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Ongoing: Medicines Yellow | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Ongoing: Pest Control Yellow | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Per litter: Whelping Yellow | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Ad hoc: Dog Intake Yellow | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Ad hoc: Isolation Yellow | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Ad hoc: Isolation Release Yellow | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Ad hoc: Occupant Clean Yellow | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Ad hoc: Parasites and Zoonoses Yellow | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Ad hoc: Transport Yellow | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Ad hoc: Vaccinations Yellow | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Breeding: Mating and Retirement Yellow | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Breeding: Ovulation Testing Yellow | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Breeding: Season Tracking Yellow | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Green – connection # | fold | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Weekly: Staff Rota Green | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Ongoing: Staff Training Green | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Ongoing: Staffing Ratio and Cover Green | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Ad hoc: Induction Green | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Blue – sales # | fold | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Per litter: Puppy Handover Blue | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Per litter: Puppy Packs Blue | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Per litter: Socialisation Blue | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Ad hoc: Collections Blue | button | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Purple – ideas # | fold | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Ongoing: Signs/Posters Index Purple | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp, open:button.btn.fbtn] | Colour | list | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp, open:button.btn.fbtn] | Frequency | list | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp, open:button.btn.fbtn] | Category | list | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp, open:button.btn.fbtn] | Role | list | same screen | changes this screen | 1 |

### CD Hub (cdhub/): on the phone only (or different on the phone)

| Screen | Control | What it is | Goes to | What happens | Copies |
|---|---|---|---|---|---|
| #/map · Main [open:button.btn.house-ib] | Sign out | button |  | not tapped here: signing out ends the walk (it has its own check) | 1 |
| #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | Per litter: Puppy Handover Blue | button | same screen | scrolls to its place | 1 |

## Temperatures page (cdhub/history.html)

| Screen | Control | What it is | Goes to | What happens | Copies |
|---|---|---|---|---|---|
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:The round] | Skip to content | link | same screen | scrolls to its place | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:The round] | CD Hub | link | CD Hub | opens that page | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:The round] | Close Temperatures | link | CD Hub | opens that page | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:The round] | Outdoor temps | button | same screen | already chosen | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:The round] | Compliance | button | (start) · Temperatures [lit:#, lit:Compliance, lit:The roun… | opens it | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:The round] | # | button | same screen | already chosen | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:The round] | # | button | same screen | changes this screen | 2 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:The round] | Archive | link | Temperatures archive page | opens that page | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:The round] | The round | button | same screen | already chosen | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:The round] | Heat map | button | (start) · Temperatures [lit:#, lit:Heat map, lit:Outdoor te… | opens it | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:The round] | Year strip | button | (start) · Temperatures [lit:#, lit:Outdoor temps, lit:Year … | opens it | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:The round] | Month cards | button | (start) · Temperatures [lit:#, lit:Month cards, lit:Outdoor… | opens it | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:The round] | Back to the round | link | CD Hub | opens that page | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:The round] | Date | box (date) | same screen | takes what is typed and redraws | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:The round] | Fold Indoors °C | button | same screen | changes this screen | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:The round] | Indoors °C | row or card | same screen | changes this screen | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:The round] | Fold Outside | button | same screen | changes this screen | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:The round] | Outside | row or card | same screen | changes this screen | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:The round] | Main | link | CD Hub | opens that page | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:The round] | Compliance | link | CD Hub | opens that page | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:The round] | Records | link | CD Hub | opens that page | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:The round] | People | link | CD Hub | opens that page | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:The round] | More | button | (start) · Temperatures [lit:#, lit:Outdoor temps, lit:The r… | opens it | 1 |
| (start) · Temperatures [lit:#, lit:Heat map, lit:Outdoor temps] | Fold Indoors | button | same screen | changes this screen | 1 |
| (start) · Temperatures [lit:#, lit:Heat map, lit:Outdoor temps] | Indoors | row or card | same screen | changes this screen | 1 |
| (start) · Temperatures [lit:#, lit:Heat map, lit:Outdoor temps] | D Mon YYYY Missed | button | same screen | changes this screen | 3 |
| (start) · Temperatures [lit:#, lit:Heat map, lit:Outdoor temps] | D Mon YYYY Warm: cooling action | button | same screen | changes this screen | 1 |
| (start) · Temperatures [lit:#, lit:Heat map, lit:Outdoor temps] | D Mon YYYY Mild | button | same screen | changes this screen | 2 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:Year strip] | Fold Indoors | button | same screen | changes this screen | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:Year strip] | Indoors | row or card | same screen | changes this screen | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:Year strip] | # Jan indoors — Missed | row or card | same screen | changes this screen | 2 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:Year strip] | # Mar indoors — Warm: cooling action | row or card | same screen | changes this screen | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:Year strip] | # Mar indoors — Missed | row or card | same screen | changes this screen | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:Year strip] | # Mar out — Mild | row or card | same screen | changes this screen | 2 |
| (start) · Temperatures [lit:#, lit:Month cards, lit:Outdoor temps] | Mar # #% in limit # in limit # outside # warm (cooling acti… | button | (start) · Temperatures [lit:#, lit:Heat map, lit:Outdoor te… | opens it | 1 |
| (start) · Temperatures [lit:#, lit:Month cards, lit:Outdoor temps] | Feb # #% in limit # in limit # outside # missed High # Room… | button | (start) · Temperatures [lit:#, lit:Heat map, lit:Outdoor te… | opens it | 1 |
| (start) · Temperatures [lit:#, lit:Month cards, lit:Outdoor temps] | Jan # #% in limit # in limit # outside # missed High # Room… | button | (start) · Temperatures [lit:#, lit:Heat map, lit:Outdoor te… | opens it | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:The round, open… | Today | link | CD Hub | opens that page | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:The round, open… | Do | link | CD Hub | opens that page | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:The round, open… | Items | link | CD Hub | opens that page | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:The round, open… | Litters | link | CD Hub | opens that page | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:The round, open… | Areas | link | CD Hub | opens that page | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:The round, open… | The round | link | CD Hub | opens that page | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:The round, open… | SOPs | link | CD Hub | opens that page | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:The round, open… | Temps | link | same screen | changes this screen | 1 |
| (start) · Temperatures [lit:#, lit:Outdoor temps, lit:The round, open… | Enquiries | link | CD Hub | opens that page | 1 |

## Staff page (cdhub/staff/)

| Screen | Control | What it is | Goes to | What happens | Copies |
|---|---|---|---|---|---|
| #home · The Board | Not you? Switch | button | #home · Set up this phone | opens it | 1 |
| #home · The Board | Jobs | button | #m/jobs · Today | opens it | 1 |
| #home · The Board | Scan | button | #m/moves · Scan a room sign | opens it | 1 |
| #home · The Board | Temps | button | #m/temperature · Room temperatures | opens it | 1 |
| #home · The Board | Where | button | #m/where · Where is everyone? | opens it | 1 |
| #home · The Board | Checks | link | Checks page | opens that page | 1 |
| #home · The Board | Home | button | same screen | changes this screen | 1 |
| #home · The Board | Scan | button | #scan · Scan a room sign | opens it | 1 |
| #home · The Board | Problem | button | #m/report · Report | opens it | 1 |
| #home · The Board | Phone | button | #device · This phone | opens it | 1 |
| #m/temperature · Room temperatures | ← Home | button | #home · The Board | opens it | 1 |
| #m/temperature · Room temperatures | Room N · Room N door Due | button | #m/temperature · Room N · Room N door | opens it | 1 |
| #m/temperature · Room temperatures | Room N · Room N window Due | button | #m/temperature · Room N · Room N window | opens it | 1 |
| #m/temperature · Room temperatures | Room N Done #:# · #–# | button | #m/temperature · Room N | opens it | 2 |
| #m/temperature · Room temperatures | Room N Done #:# · Room empty | button | #m/temperature · Room N | opens it | 1 |
| #m/temperature · Room temperatures | Room N Due | button | #m/temperature · Room N | opens it | 1 |
| #m/temperature · Room temperatures | Room N Due | button | #m/temperature · Room N [fold.tg-spot] | opens it | 1 |
| #m/temperature · Room temperatures | Earlier | button | #m/temperature · Earlier reading | opens it | 1 |
| #m/temperature · Room temperatures | Report | button | #m/temperature · Report | opens it | 1 |
| #m/temperature · Room temperatures | Import | button | #m/temperature · Sensor back-up import | opens it | 1 |
| #m/moves · Scan a room sign | ← Home | button | #home · The Board | opens it | 1 |
| #m/where · Where is everyone? | ← Home | button | #home · The Board | opens it | 1 |
| #m/where · Where is everyone? | Dog A.. new room | list | same screen | changes this screen | 2 |
| #m/where · Where is everyone? | Off-site | button | same screen | changes this screen | 2 |
| #m/where · Where is everyone? | Moved | button | same screen | changes this screen | 20 |
| #m/jobs · Today | ← Home | button | #home · The Board | opens it | 1 |
| #m/jobs · Today | Yes, done: Wash the bowls | button | same screen | changes this screen | 1 |
| #m/jobs · Today | Problem: Wash the bowls | button | same screen | changes this screen | 1 |
| #m/jobs · Today | Earlier: Wash the bowls | button | same screen | changes this screen | 1 |
| #m/jobs · Today | Earlier: several days | button | same screen | changes this screen | 1 |
| #m/report · Report | ← Home | button | #home · The Board | opens it | 1 |
| #m/report · Report | Dog | list | same screen | changes this screen | 1 |
| #m/report · Report | Room | list | same screen | changes this screen | 1 |
| #m/report · Report | What happened? | box (text) | same screen | takes what is typed and redraws | 1 |
| #m/report · Report | Send | button | same screen | changes this screen | 1 |
| #scan · Scan a room sign | ← Home | button | #home · The Board | opens it | 1 |
| #device · This phone | Show help | button | same screen | changes this screen | 1 |
| #device · This phone | Remove my code from this phone | button |  | not tapped here: it un-sets the phone (it has its own test) | 1 |
| #home · Set up this phone | Owner: sign in with Google | button | #home · The Board | opens it | 1 |
| #m/temperature · Room N · Room N door | ← Rooms | button | #m/temperature · Room temperatures | opens it | 1 |
| #m/temperature · Room N · Room N door | Read with camera | button | same screen | changes this screen | 1 |
| #m/temperature · Room N · Room N door | Room empty | box (checkbox) | same screen | changes this screen | 1 |
| #m/temperature · Room N · Room N door | MAX | box (text) | same screen | takes what is typed and redraws | 1 |
| #m/temperature · Room N · Room N door | MIN | box (text) | same screen | takes what is typed and redraws | 1 |
| #m/temperature · Room N · Room N door | Bed spot reading (optional) | fold | #m/temperature · Room N · Room N door [fold.tg-spot] | opens it | 1 |
| #m/temperature · Room N · Room N door | Save | button | same screen | changes this screen | 1 |
| #m/temperature · Room N · Room N window | ← Rooms | button | #m/temperature · Room temperatures | opens it | 1 |
| #m/temperature · Room N · Room N window | Read with camera | button | same screen | changes this screen | 1 |
| #m/temperature · Room N · Room N window | Room empty | box (checkbox) | same screen | changes this screen | 1 |
| #m/temperature · Room N · Room N window | MAX | box (text) | same screen | takes what is typed and redraws | 1 |
| #m/temperature · Room N · Room N window | MIN | box (text) | same screen | takes what is typed and redraws | 1 |
| #m/temperature · Room N · Room N window | Bed spot reading (optional) | fold | #m/temperature · Room N · Room N window [fold.tg-spot] | opens it | 1 |
| #m/temperature · Room N · Room N window | Save | button | same screen | changes this screen | 1 |
| #m/temperature · Room N | ← Rooms | button | #m/temperature · Room temperatures | opens it | 1 |
| #m/temperature · Room N | Read with camera | button | same screen | changes this screen | 1 |
| #m/temperature · Room N | Room empty | box (checkbox) | same screen | changes this screen | 1 |
| #m/temperature · Room N | MAX | box (text) | same screen | takes what is typed and redraws | 1 |
| #m/temperature · Room N | MIN | box (text) | same screen | takes what is typed and redraws | 1 |
| #m/temperature · Room N | Bed spot reading (optional) | fold | #m/temperature · Room N [fold.tg-spot] | opens it | 1 |
| #m/temperature · Room N | Save | button | same screen | changes this screen | 1 |
| #m/temperature · Room N [fold.tg-spot] | ← Rooms | button | #m/temperature · Room temperatures | opens it | 1 |
| #m/temperature · Room N [fold.tg-spot] | Read with camera | button | same screen | changes this screen | 1 |
| #m/temperature · Room N [fold.tg-spot] | Room empty | box (checkbox) | same screen | changes this screen | 1 |
| #m/temperature · Room N [fold.tg-spot] | MAX | box (text) | same screen | takes what is typed and redraws | 1 |
| #m/temperature · Room N [fold.tg-spot] | MIN | box (text) | same screen | takes what is typed and redraws | 1 |
| #m/temperature · Room N [fold.tg-spot] | Bed spot reading (puppies under # weeks: #–# C) | fold | #m/temperature · Room N | closes it | 1 |
| #m/temperature · Room N [fold.tg-spot] | Bed spot | box (text) | same screen | takes what is typed and redraws | 1 |
| #m/temperature · Room N [fold.tg-spot] | Save | button | same screen | changes this screen | 1 |
| #m/temperature · Earlier reading | ← Rooms | button | #m/temperature · Room temperatures | opens it | 1 |
| #m/temperature · Earlier reading | Day | box (date) | same screen | takes what is typed and redraws | 1 |
| #m/temperature · Earlier reading | Morning or afternoon | list | same screen | changes this screen | 1 |
| #m/temperature · Report | ← Rooms | button | #m/temperature · Room temperatures | opens it | 1 |
| #m/temperature · Report | Room | list | same screen | changes this screen | 1 |
| #m/temperature · Report | Year | list | same screen | changes this screen | 1 |
| #m/temperature · Report | Open report | button | same screen | changes this screen | 1 |
| #m/temperature · Sensor back-up import | ← Rooms | button | #m/temperature · Room temperatures | opens it | 1 |
| #m/temperature · Sensor back-up import | Room | list | same screen | changes this screen | 1 |
| #m/temperature · Sensor back-up import | Sensor name | box (text) | same screen | takes what is typed and redraws | 1 |
| #m/temperature · Room N · Room N door [fold.tg-spot] | Bed spot | box (text) | same screen | takes what is typed and redraws | 1 |
| #m/temperature · Room N · Room N window [fold.tg-spot] | Bed spot | box (text) | same screen | takes what is typed and redraws | 1 |
