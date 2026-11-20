# CD Hub click map

Every button, link and tap the click-crawl found, where each one goes and what it does. **Made by a script from the crawl's own results; nothing here is typed by hand.**

- Data: the invented 27-animal set (`tests/fixtures/cdhub-27`): Dog A.., Pup P.., Room N. No real name, id or date. The day is 10 Mar 2026.
- Remake it: `npx playwright test --project=mocked cdhub-crawl` then `node tools/cdhub-click-map/make.js`.
- Copies of one control (one per dog, room or day) are one row with a count. `#` stands for a number.
- A screen that is switched off (Assocs, Table map, Litters, Vet link) is named but not walked.

## Totals

| Where | Screen size | Result |
|---|---|---|
| CD Hub (cdhub/) | desktop, 1280px | visited 884 of 884 controls (100.0%) on 42 screens · LOOP 0 · DEAD 0 · ERROR 0 · ESCAPE 0 · WORDING 0 |
| CD Hub (cdhub/) | phone, 360px | visited 884 of 884 controls (100.0%) on 42 screens · LOOP 0 · DEAD 0 · ERROR 0 · ESCAPE 0 · WORDING 0 |
| Temperatures page (cdhub/history.html) | desktop, 1280px | visited 40 of 40 controls (100.0%) on 4 screens, plus 98 repeated calendar days sampled · LOOP 0 · DEAD 0 · ERROR 0 · ESCAPE 0 · WORDING 0 |
| Temperatures page (cdhub/history.html) | phone, 360px | visited 40 of 40 controls (100.0%) on 4 screens, plus 98 repeated calendar days sampled · LOOP 0 · DEAD 0 · ERROR 0 · ESCAPE 0 · WORDING 0 |
| Staff page (cdhub/staff/) | desktop, 1280px | visited 78 of 78 controls (100.0%) on 16 screens · LOOP 0 · DEAD 0 · ERROR 0 · ESCAPE 0 · WORDING 0 |
| Staff page (cdhub/staff/) | phone, 360px | visited 75 of 75 controls (100.0%) on 14 screens · LOOP 0 · DEAD 0 · ERROR 0 · ESCAPE 0 · WORDING 0 |

LOOP = goes round to the same screen. DEAD = nothing happens. ERROR = the browser logged an error. ESCAPE = left our pages. WORDING = raw or empty words.

## CD Hub (cdhub/)

| Screen | Control | What it is | Goes to | What happens | Copies |
|---|---|---|---|---|---|
| #/map · Main | Skip to content | link | same screen | moves to #main | 1 |
| #/map · Main | Dashboard | link | Dashboard (home) | opens that page | 1 |
| #/map · Main | Search | button | #/map · Main [dialog#dashSearch] | opens it | 1 |
| #/map · Main | Refresh | button | same screen | reads the tables again | 1 |
| #/map · Main | Look | button | #/map · Main [open:button.btn.house-ib] | opens it | 1 |
| #/map · Main | Sign out | button |  | not tapped here: signing out ends the walk (it has its own check belo… | 1 |
| #/map · Main | Next | row or card | #/compliance · Compliance [fold.compfold] | opens it | 1 |
| #/map · Main | Fold Next | button | same screen | changes this screen | 1 |
| #/map · Main | Room N is over its limit | link | #/compliance · Compliance [fold.compfold] | opens it | 1 |
| #/map · Main | Compliance: Room N is over its limit | link | #/compliance · Compliance [fold.compfold] | opens it | 2 |
| #/map · Main | Needs you # | row or card | same screen | changes this screen | 1 |
| #/map · Main | Needs you: #. Open Do | link | #/work · Outstanding | opens it | 1 |
| #/map · Main | # need you, some late. Open Do | link | #/work · Outstanding | same address as "Needs you: #. Open Do" | 1 |
| #/map · Main | Fold Needs you | button | same screen | changes this screen | 1 |
| #/map · Main | Room N is over its limit # medium is over the limit. This r… | row or card | #/compliance · Compliance [fold.compfold] | opens it | 1 |
| #/map · Main | Room N is over its limit | link | #/compliance · Compliance [fold.compfold] | same address as "Room N is over its limit" | 1 |
| #/map · Main | Identify the medicine given in February # to name in Feb Sh… | row or card | #/dogs/feb · Dogs | opens it | 1 |
| #/map · Main | Identify the medicine given in February | link | #/dogs/feb · Dogs | opens it | 1 |
| #/map · Main | Show the record: Identify the medicine given in February | link | #/dogs/feb · Dogs | opens it | 1 |
| #/map · Main | Check the medicine given to Dog A.. in March Already on the… | row or card | #/dogs/mar · Dogs [fold.dcs.meds] | opens it | 1 |
| #/map · Main | Check the medicine given to Dog A.. in March | link | #/dogs/mar · Dogs [fold.dcs.meds] | opens it | 1 |
| #/map · Main | Show the record: Check the medicine given to Dog A.. in Mar… | link | #/dogs/mar · Dogs [fold.dcs.meds] | opens it | 1 |
| #/map · Main | Licence counts needs a look law says #, your list says # Sh… | row or card | #/today/bitches · Today: DD/MM/YY | opens it | 1 |
| #/map · Main | Licence counts needs a look | link | #/today/bitches · Today: DD/MM/YY | opens it | 1 |
| #/map · Main | Show the dogs: Licence counts needs a look | link | #/today/bitches · Today: DD/MM/YY | opens it | 1 |
| #/map · Main | Microchip needs a look # here have no chip recorded Show th… | row or card | #/today/nochip · Today: DD/MM/YY | opens it | 1 |
| #/map · Main | Microchip needs a look | link | #/today/nochip · Today: DD/MM/YY | opens it | 1 |
| #/map · Main | Show the dogs: Microchip needs a look | link | #/today/nochip · Today: DD/MM/YY | opens it | 1 |
| #/map · Main | +# more | link | #/work · Outstanding | opens it | 1 |
| #/map · Main | Temps: # of # cabins have a temperature today. Open The rou… | link | #/round · The round | opens it | 1 |
| #/map · Main | Unplaced: #. Open the list | link | #/today/unplaced · Today: DD/MM/YY | opens it | 1 |
| #/map · Main | Bitches: # late. Open the list | link | #/today/bitches · Today: DD/MM/YY | opens it | 1 |
| #/map · Main | Next: Today → | button | #/today · Today: DD/MM/YY | opens it | 1 |
| #/map · Main | Next: Outstanding → | button | #/work · Outstanding | opens it | 1 |
| #/map · Main | Main, # late | button | same screen | moves to h# | 1 |
| #/map · Main | Do, # waiting | button | #/work · Outstanding | opens it | 1 |
| #/map · Main | Today | button | #/today · Today: DD/MM/YY | opens it | 1 |
| #/map · Main | Dogs | button | #/dogs · Dogs | opens it | 1 |
| #/map · Main | SOPs | button | #/sops · SOPs [fold.sopgrp] | opens it | 1 |
| #/map · Main | More | button | #/map · Main [open:button.ht] | opens it | 1 |
| #/work · Outstanding | Fold Needs you today | button | same screen | changes this screen | 1 |
| #/work · Outstanding | Needs you today # | row or card | same screen | changes this screen | 1 |
| #/work · Outstanding | Room N is over its limit # medium is over the limit. This r… | row or card | #/compliance · Compliance [fold.compfold] | opens it | 1 |
| #/work · Outstanding | Open: Room N is over its limit | button | #/compliance · Compliance [fold.compfold] | opens it | 1 |
| #/work · Outstanding | Identify the medicine given in February # to name in Feb Sh… | row or card | #/dogs/feb · Dogs | opens it | 1 |
| #/work · Outstanding | Show the record: Identify the medicine given in February | button | #/dogs/feb · Dogs | opens it | 1 |
| #/work · Outstanding | Check the medicine given to Dog A.. in March Already on the… | row or card | #/dogs/mar · Dogs [fold.dcs.meds] | opens it | 1 |
| #/work · Outstanding | Show the record: Check the medicine given to Dog A.. in Mar… | button | #/dogs/mar · Dogs [fold.dcs.meds] | opens it | 1 |
| #/work · Outstanding | Licence counts needs a look law says #, your list says # Op… | row or card | #/today/bitches · Today: DD/MM/YY | opens it | 1 |
| #/work · Outstanding | Open: Licence counts needs a look | button | #/today/bitches · Today: DD/MM/YY | opens it | 1 |
| #/work · Outstanding | Microchip needs a look # here have no chip recorded Open | row or card | #/today/nochip · Today: DD/MM/YY | opens it | 1 |
| #/work · Outstanding | Open: Microchip needs a look | button | #/today/nochip · Today: DD/MM/YY | opens it | 1 |
| #/work · Outstanding | Placed in a cabin needs a look # here are not in a cabin Op… | row or card | #/today/noarea · Today: DD/MM/YY | opens it | 1 |
| #/work · Outstanding | Open: Placed in a cabin needs a look | button | #/today/noarea · Today: DD/MM/YY | opens it | 1 |
| #/work · Outstanding | Room limits needs a look # room is over: Room N (# medium, … | row or card | #/compliance · Compliance [fold.compfold] | opens it | 1 |
| #/work · Outstanding | Open: Room limits needs a look | button | #/compliance · Compliance [fold.compfold] | opens it | 1 |
| #/work · Outstanding | Show all | button | same screen | changes this screen | 1 |
| #/work · Outstanding | Fold Waiting on you | button | same screen | changes this screen | 1 |
| #/work · Outstanding | Waiting on you # | row or card | same screen | changes this screen | 1 |
| #/work · Outstanding | Show the record | button | #/dogs/feb · Dogs | opens it | 1 |
| #/work · Outstanding | Show the record | button | #/dogs/mar · Dogs [fold.dcs.meds] | opens it | 1 |
| #/work · Outstanding | Fold Waiting on me | button | same screen | changes this screen | 1 |
| #/work · Outstanding | Waiting on me # | row or card | same screen | changes this screen | 1 |
| #/work · Outstanding | Fold Done | button | same screen | changes this screen | 1 |
| #/work · Outstanding | Done # | row or card | same screen | changes this screen | 1 |
| #/work · Outstanding | Next: Today → | button | #/today · Today: DD/MM/YY | opens it | 1 |
| #/work · Outstanding | Next: Dogs → | button | #/dogs · Dogs | opens it | 1 |
| #/today · Today: DD/MM/YY | Fold Today checklist# of # done | button | same screen | changes this screen | 1 |
| #/today · Today: DD/MM/YY | Today checklist # of # done | row or card | same screen | changes this screen | 1 |
| #/today · Today: DD/MM/YY | The round | button | #/round · The round | opens it | 2 |
| #/today · Today: DD/MM/YY | Fold On site | button | same screen | changes this screen | 1 |
| #/today · Today: DD/MM/YY | On site | row or card | same screen | changes this screen | 1 |
| #/today · Today: DD/MM/YY | On site: #. Open the list | link | #/today/here · Today: DD/MM/YY | opens it | 1 |
| #/today · Today: DD/MM/YY | Adults: #. Open the list | link | #/today/adults · Today: DD/MM/YY | opens it | 1 |
| #/today · Today: DD/MM/YY | Under # months: #. Open the list | link | #/today/pups · Today: DD/MM/YY | opens it | 1 |
| #/today · Today: DD/MM/YY | Breeding bitches in law: #. Open the list | link | #/today/bitches · Today: DD/MM/YY | opens it | 1 |
| #/today · Today: DD/MM/YY | Stud males: #. Open the list | link | #/today/studs · Today: DD/MM/YY | opens it | 1 |
| #/today · Today: DD/MM/YY | Off site: #. Open the list | link | #/today/offsite · Today: DD/MM/YY | opens it | 1 |
| #/today · Today: DD/MM/YY | Dogs | button | #/dogs · Dogs | opens it | 1 |
| #/today · Today: DD/MM/YY | Temperatures today Morning # of # Evening # of # Rooms # to… | row or card | #/round · The round | opens it | 1 |
| #/today · Today: DD/MM/YY | Fold Temperatures today | button | same screen | changes this screen | 1 |
| #/today · Today: DD/MM/YY | Outdoor forecast: next # days | row or card | #/round · The round | opens it | 1 |
| #/today · Today: DD/MM/YY | Temperature history | link | Temperatures page | opens that page | 1 |
| #/today · Today: DD/MM/YY | + Thermometer | link | Staff print page | opens that page | 1 |
| #/today · Today: DD/MM/YY | # of # cabins with a temperature enter on The round | button | #/round · The round | opens it | 1 |
| #/today · Today: DD/MM/YY | # dogs not yet placed | button | same screen | changes this screen | 1 |
| #/today · Today: DD/MM/YY | # dogs here | button | same screen | changes this screen | 1 |
| #/today · Today: DD/MM/YY | # FT # PT staffing # per #, or # per # adults (invented; in… | button | same screen | changes this screen | 1 |
| #/today · Today: DD/MM/YY | # breeding bitches | button | same screen | changes this screen | 1 |
| #/today · Today: DD/MM/YY | # retired, entire | button | same screen | changes this screen | 1 |
| #/today · Today: DD/MM/YY | # studs | button | same screen | changes this screen | 1 |
| #/today · Today: DD/MM/YY | # other | button | same screen | changes this screen | 1 |
| #/today · Today: DD/MM/YY | Next: The round → | button | #/round · The round | opens it | 1 |
| #/today · Today: DD/MM/YY | Next: Dogs → | button | #/dogs · Dogs | opens it | 1 |
| #/dogs · Dogs | Search dogs | box (search) | same screen | takes what is typed and redraws | 1 |
| #/dogs · Dogs | Filter | button | #/dogs · Dogs [open:button.btn.fbtn] | opens it | 1 |
| #/dogs · Dogs | Sort | list | same screen | changes this screen | 1 |
| #/dogs · Dogs | Edit | button | #/dogs · Dogs [open:button.btn.dedit] | opens it | 17 |
| #/dogs · Dogs | Room N | button | same screen | changes this screen | 17 |
| #/dogs · Dogs | # kg Medium ↑ # · DD/MM/YY BCS # | row or card | same screen | changes this screen | 7 |
| #/dogs · Dogs | # kg Medium ↑ # · DD/MM/YY BCS # | fold | #/dogs · Dogs [fold.dcs.wtc] | opens it | 7 |
| #/dogs · Dogs | # medications · last DD/MM/YY | fold | #/dogs · Dogs [fold.dcs.meds] | opens it | 8 |
| #/dogs · Dogs | More | fold | #/dogs · Dogs [fold.dcs.more] | opens it | 17 |
| #/dogs · Dogs | Breed Better: Pass, # of #. Testing: trial scores, not yet … | button | #/breed · Breed Better Testing | opens it | 2 |
| #/dogs · Dogs | Breed Better: Unverified, # of #. Testing: trial scores, no… | button | #/breed · Breed Better Testing | opens it | 1 |
| #/dogs · Dogs | # kg Toy/Mini ↑ # · DD/MM/YY BCS # | row or card | same screen | changes this screen | 2 |
| #/dogs · Dogs | # kg Toy/Mini ↑ # · DD/MM/YY BCS # | fold | #/dogs · Dogs [fold.dcs.wtc] | opens it | 2 |
| #/dogs · Dogs | # medication · last DD/MM/YY | fold | #/dogs · Dogs [fold.dcs.meds] | opens it | 6 |
| #/dogs · Dogs | # kg Standard ↑ # · DD/MM/YY BCS # | row or card | same screen | changes this screen | 1 |
| #/dogs · Dogs | # kg Standard ↑ # · DD/MM/YY BCS # | fold | #/dogs · Dogs [fold.dcs.wtc] | opens it | 1 |
| #/dogs · Dogs | # kg Toy/Mini ↑ # · DD/MM/YY | row or card | same screen | changes this screen | 7 |
| #/dogs · Dogs | # kg Toy/Mini ↑ # · DD/MM/YY | fold | #/dogs · Dogs [fold.dcs.wtc] | opens it | 7 |
| #/dogs · Dogs | no medications | fold | #/dogs · Dogs [fold.dcs.meds] | opens it | 3 |
| #/dogs · Dogs | Next: Litters → | button | #/litters · Litters | opens a screen that is switched off for now | 1 |
| #/dogs · Dogs | Next: Areas → | button | #/areas · Areas | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Search SOPs | box (search) | same screen | takes what is typed and redraws | 1 |
| #/sops · SOPs [fold.sopgrp] | Filter | button | #/sops · SOPs [fold.sopgrp, open:button.btn.fbtn] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Sort | list | #/sops · SOPs | closes it | 1 |
| #/sops · SOPs [fold.sopgrp] | White – vision # | fold | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Annual: Microchip Audit White | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Annual: Sign-Off White | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Ongoing: Licence Display White | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Ongoing: Record Keeping White | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Ad hoc: Read-and-Sign White | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Breeding: Mating Plan White | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Red – risk and legal # | fold | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Ongoing: Emergency Display Red | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Ongoing: Site Security Red | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Ongoing: Workplace Safety Red | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Ad hoc: Accident Report Red | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Ad hoc: Euthanasia Red | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Ad hoc: Evacuation Red | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Ad hoc: Inspections Red | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Ad hoc: Lost Dog Red | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Ad hoc: Outbreak Response Red | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Orange – money # | fold | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Breeding: Health Screening Orange | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Yellow – operations # | fold | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Daily: Care Rounds Yellow | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Daily: Cleaning Yellow | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Daily: Feeding Yellow | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Daily: Health Check Yellow | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Weekly: Deep Clean Yellow | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Weekly: Pest Checks Yellow | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Monthly: Care Check Yellow | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Monthly: Condition Scoring Yellow | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Monthly: Full Clean Yellow | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Annual: Fitness Review Yellow | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Ongoing: Hygiene Yellow | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Ongoing: Medicines Yellow | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Ongoing: Pest Control Yellow | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Per litter: Whelping Yellow | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Ad hoc: Dog Intake Yellow | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Ad hoc: Isolation Yellow | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Ad hoc: Isolation Release Yellow | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Ad hoc: Occupant Clean Yellow | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Ad hoc: Parasites and Zoonoses Yellow | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Ad hoc: Transport Yellow | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Ad hoc: Vaccinations Yellow | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Breeding: Mating and Retirement Yellow | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Breeding: Ovulation Testing Yellow | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Breeding: Season Tracking Yellow | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Green – connection # | fold | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Weekly: Staff Rota Green | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Ongoing: Staff Training Green | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Ongoing: Staffing Ratio and Cover Green | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Ad hoc: Induction Green | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Blue – sales # | fold | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Per litter: Puppy Handover Blue | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Per litter: Puppy Packs Blue | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Per litter: Socialisation Blue | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Ad hoc: Collections Blue | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Purple – ideas # | fold | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp] | Ongoing: Signs/Posters Index Purple | button | #/sops · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Next: Dogs → | button | #/dogs · Dogs | opens it | 1 |
| #/sops · SOPs [fold.sopgrp] | Next: Assocs → | button | #/buyers · Assocs | opens a screen that is switched off for now | 1 |
| #/compliance · Compliance [fold.compfold] | What was true on | box (date) | same screen | takes what is typed and redraws | 1 |
| #/compliance · Compliance [fold.compfold] | Urgent # | fold | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold] | Room N is over its limit | link | #/areas/ar-N · Areas | opens it | 1 |
| #/compliance · Compliance [fold.compfold] | Room N is outside its temperature band | link | #/areas/ar-N · Areas | opens it | 1 |
| #/compliance · Compliance [fold.compfold] | Requirements | fold | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold] | Findings # | fold | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold] | Inspections | fold | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold] | Fold Data checks | button | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold] | Data checks # failed | row or card | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold] | ✗ Licence counts fails law says #, your list says # Show | row or card | #/today/bitches · Today: DD/MM/YY | opens it | 1 |
| #/compliance · Compliance [fold.compfold] | Show the dogs: Licence counts | button | #/today/bitches · Today: DD/MM/YY | opens it | 1 |
| #/compliance · Compliance [fold.compfold] | ✓ Date of birth passes every dog here has one Show | row or card | #/today/nodob · Today: DD/MM/YY | opens it | 1 |
| #/compliance · Compliance [fold.compfold] | Show the dogs: Date of birth | button | #/today/nodob · Today: DD/MM/YY | opens it | 1 |
| #/compliance · Compliance [fold.compfold] | ✗ Microchip fails # here have no chip recorded Show | row or card | #/today/nochip · Today: DD/MM/YY | opens it | 1 |
| #/compliance · Compliance [fold.compfold] | Show the dogs: Microchip | button | #/today/nochip · Today: DD/MM/YY | opens it | 1 |
| #/compliance · Compliance [fold.compfold] | ✗ Placed in a cabin fails # here are not in a cabin Show | row or card | #/today/noarea · Today: DD/MM/YY | opens it | 1 |
| #/compliance · Compliance [fold.compfold] | Show the dogs: Placed in a cabin | button | #/today/noarea · Today: DD/MM/YY | opens it | 1 |
| #/compliance · Compliance [fold.compfold] | Needs a look | fold | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold] | Room limits # | fold | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold] | i Room N — # medium is over the limit. This room takes # sm… | button | #/compliance · Compliance [fold.compfold, open:span.info] | opens it | 1 |
| #/compliance · Compliance [fold.compfold] | Open Areas | link | #/areas · Areas | opens it | 1 |
| #/compliance · Compliance [fold.compfold] | Room temperatures # | fold | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold] | change | link | same screen | scrolls to its place | 1 |
| #/compliance · Compliance [fold.compfold] | Room N | link | #/areas/ar-N · Areas | opens it | 43 |
| #/compliance · Compliance [fold.compfold] | Open The round | link | #/round · The round | opens it | 1 |
| #/compliance · Compliance [fold.compfold] | Temperature history | link | Temperatures page | opens that page | 1 |
| #/compliance · Compliance [fold.compfold] | Jobs | fold | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold] | Cleaning | link | #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/compliance · Compliance [fold.compfold] | # done, open Cleaning | link | #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | same address as "Cleaning" | 2 |
| #/compliance · Compliance [fold.compfold] | # due, open Cleaning | link | #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | same address as "Cleaning" | 2 |
| #/compliance · Compliance [fold.compfold] | # late, open Cleaning | link | #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | same address as "Cleaning" | 2 |
| #/compliance · Compliance [fold.compfold] | Cleaning | link | #/sops/Cleaning · SOPs [fold.sopgrp, open:button.sopopen] | same address as "Cleaning" | 1 |
| #/compliance · Compliance [fold.compfold] | Care Check | link | #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | opens it | 1 |
| #/compliance · Compliance [fold.compfold] | # done, open Care Check | link | #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | same address as "Care Check" | 1 |
| #/compliance · Compliance [fold.compfold] | # due, open Care Check | link | #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | same address as "Care Check" | 1 |
| #/compliance · Compliance [fold.compfold] | # late, open Care Check | link | #/sops/Care%#Check · SOPs [fold.sopgrp, open:button.sopopen] | same address as "Care Check" | 1 |
| #/compliance · Compliance [fold.compfold] | Your breeding rules | fold | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold] | Add a rule or a change | fold | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold] | choose a rule | list | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold] | number | box (number) | same screen | takes what is typed and redraws | 1 |
| #/compliance · Compliance [fold.compfold] | in force from | box (date) | same screen | takes what is typed and redraws | 1 |
| #/compliance · Compliance [fold.compfold] | source | box (text) | same screen | takes what is typed and redraws | 1 |
| #/compliance · Compliance [fold.compfold] | Save rule | button | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold] | Rehearsal | fold | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold] | Start a rehearsal | button | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold] | Who has access | fold | same screen | changes this screen | 1 |
| #/compliance · Compliance [fold.compfold] | The round | link | #/round · The round | same address as "Open The round" | 1 |
| #/compliance · Compliance [fold.compfold] | Next: Litters → | button | #/litters · Litters | opens a screen that is switched off for now | 1 |
| #/compliance · Compliance [fold.compfold] | Next: Dogs → | button | #/dogs · Dogs | opens it | 1 |
| #/round · The round | Date | box (date) | same screen | takes what is typed and redraws | 1 |
| #/round · The round | Temperature history | link | Temperatures page | opens that page | 1 |
| #/round · The round | Fold Saving on this device: off | button | same screen | changes this screen | 1 |
| #/round · The round | Saving on this device: off | row or card | same screen | changes this screen | 1 |
| #/round · The round | Save script address | box (url) | same screen | takes what is typed and redraws | 1 |
| #/round · The round | Your staff code | box (password) | same screen | takes what is typed and redraws | 1 |
| #/round · The round | Use these | button | same screen | changes this screen | 1 |
| #/round · The round | Switch off here | button | same screen | scrolls to its place | 1 |
| #/round · The round | Fold Kept readings | button | same screen | changes this screen | 1 |
| #/round · The round | Kept readings | row or card | same screen | changes this screen | 1 |
| #/round · The round | Fold #. Room N # m² | button | same screen | changes this screen | 6 |
| #/round · The round | #. Room N # m² free | row or card | same screen | changes this screen | 5 |
| #/round · The round | flap – #. Room N # m² free | list | same screen | changes this screen | 5 |
| #/round · The round | add a dog – #. Room N # m² free | list | same screen | changes this screen | 5 |
| #/round · The round | Move Dog A.. | button | same screen | changes this screen | 13 |
| #/round · The round | present | button | same screen | changes this screen | 20 |
| #/round · The round | not here | button | same screen | changes this screen | 20 |
| #/round · The round | Room N am min °C | box (text) | same screen | takes what is typed and redraws | 6 |
| #/round · The round | Room N am max °C | box (text) | same screen | takes what is typed and redraws | 6 |
| #/round · The round | Empty | button | question box | asks before doing it | 9 |
| #/round · The round | Room N pm min °C | box (text) | same screen | takes what is typed and redraws | 6 |
| #/round · The round | Room N pm max °C | box (text) | same screen | takes what is typed and redraws | 6 |
| #/round · The round | #. Room N # m² limited | row or card | same screen | changes this screen | 1 |
| #/round · The round | flap – #. Room N # m² limited | list | same screen | changes this screen | 1 |
| #/round · The round | add a dog – #. Room N # m² limited | list | same screen | changes this screen | 1 |
| #/round · The round | over its limit | button | same screen | changes this screen | 1 |
| #/round · The round | Move Pup P.. | button | same screen | changes this screen | 7 |
| #/round · The round | Next: Areas → | button | #/areas · Areas | opens it | 1 |
| #/round · The round | Next: Dogs → | button | #/dogs · Dogs | opens it | 1 |
| #/areas · Areas | # cabins | button | #/areas/cabins · Areas | opens it | 1 |
| #/areas · Areas | # m² unconfirmed | button | #/areas/nom# · Areas | opens it | 1 |
| #/areas · Areas | #/# have a mode | button | #/areas/nomode · Areas | opens it | 1 |
| #/areas · Areas | #/# occupied | button | #/areas/occ · Areas | opens it | 1 |
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
| #/areas · Areas | Next: Today → | button | #/today · Today: DD/MM/YY | opens it | 1 |
| #/areas · Areas | Next: Litters → | button | #/litters · Litters | opens a screen that is switched off for now | 1 |
| #/breed · Breed Better Testing | Find a dog | box (search) | same screen | takes what is typed and redraws | 1 |
| #/breed · Breed Better Testing | Sort | list | same screen | changes this screen | 1 |
| #/breed · Breed Better Testing | All # | button | same screen | scrolls to its place | 1 |
| #/breed · Breed Better Testing | Pass # | button | same screen | changes this screen | 1 |
| #/breed · Breed Better Testing | Below target # | button | same screen | changes this screen | 1 |
| #/breed · Breed Better Testing | Unverified # | button | same screen | changes this screen | 1 |
| #/breed · Breed Better Testing | Fail # | button | same screen | changes this screen | 1 |
| #/breed · Breed Better Testing | Dog A.. # Male, # yrs # mths Pass # of # | button | same screen | changes this screen | 1 |
| #/breed · Breed Better Testing | Dog A.. # Female, # yrs # mths Pass # of # | button | same screen | changes this screen | 1 |
| #/breed · Breed Better Testing | Dog A.. # Female, # yrs # mth Unverified # of #, # unverifi… | button | same screen | changes this screen | 1 |
| #/breed · Breed Better Testing | Next: Dogs → | button | #/dogs · Dogs | opens it | 1 |
| #/breed · Breed Better Testing | Next: Litters → | button | #/litters · Litters | opens a screen that is switched off for now | 1 |
| #/map · Main [dialog#dashSearch] | Drive file names, Money to-dos and dates, CD Hub dogs and l… | box (search) | same screen | takes what is typed and redraws | 1 |
| #/map · Main [dialog#dashSearch] | Close | button | #/map · Main | closes it | 1 |
| #/map · Main [open:button.btn.house-ib] | Warm clear | button | same screen | moves to button | 1 |
| #/map · Main [open:button.btn.house-ib] | Cool clear | button | same screen | changes this screen | 1 |
| #/map · Main [open:button.btn.house-ib] | Outline | button | same screen | moves to button | 1 |
| #/map · Main [open:button.btn.house-ib] | Soft tint | button | same screen | changes this screen | 1 |
| #/map · Main [open:button.btn.house-ib] | Device | button | same screen | moves to button | 1 |
| #/map · Main [open:button.btn.house-ib] | Light | button | same screen | changes this screen | 1 |
| #/map · Main [open:button.btn.house-ib] | Dark | button | same screen | changes this screen | 1 |
| #/dogs/feb · Dogs | Fold Medicine in Feb # | button | same screen | changes this screen | 1 |
| #/dogs/feb · Dogs | Medicine in Feb # | row or card | same screen | changes this screen | 1 |
| #/dogs/feb · Dogs | DD/MM/YY Dog A.. Not named # tablet Oral | row or card | #/dogs/feb · Dogs [fold.dcs.meds] | opens it | 1 |
| #/dogs/feb · Dogs | Open Dog A..: medicines | button | #/dogs/feb · Dogs [fold.dcs.meds] | opens it | 8 |
| #/dogs/feb · Dogs | DD/MM/YY Dog A.. Not named # ml Oral | row or card | #/dogs/feb · Dogs [fold.dcs.meds] | opens it | 1 |
| #/dogs/feb · Dogs | DD/MM/YY Dog A.. Sample Spot-on # pipette Topical | row or card | #/dogs/feb · Dogs [fold.dcs.meds] | opens it | 6 |
| #/dogs/mar · Dogs [fold.dcs.meds] | Fold Medicine in Mar # | button | same screen | changes this screen | 1 |
| #/dogs/mar · Dogs [fold.dcs.meds] | Medicine in Mar # | row or card | same screen | changes this screen | 1 |
| #/dogs/mar · Dogs [fold.dcs.meds] | DD/MM/YY Dog A.. Sample Wormer # tablets Oral | row or card | same screen | moves to summary | 1 |
| #/dogs/mar · Dogs [fold.dcs.meds] | Open Dog A..: medicines | button | same screen | moves to summary | 1 |
| #/dogs/mar · Dogs [fold.dcs.meds] | Date | box (date) | same screen | takes what is typed and redraws | 1 |
| #/dogs/mar · Dogs [fold.dcs.meds] | Product | box (text) | same screen | takes what is typed and redraws | 1 |
| #/dogs/mar · Dogs [fold.dcs.meds] | Dose | box (text) | same screen | takes what is typed and redraws | 1 |
| #/dogs/mar · Dogs [fold.dcs.meds] | Route | list | same screen | changes this screen | 1 |
| #/dogs/mar · Dogs [fold.dcs.meds] | Note (optional) | box (text) | same screen | takes what is typed and redraws | 1 |
| #/dogs/mar · Dogs [fold.dcs.meds] | Add medication | button | same screen | moves to input | 1 |
| #/today/bitches · Today: DD/MM/YY | Adults: #. Open the list | link | #/today/adults · Today: DD/MM/YY | opens it | 1 |
| #/today/bitches · Today: DD/MM/YY | Under # months: #. Open the list | link | #/today/pups · Today: DD/MM/YY | opens it | 1 |
| #/today/bitches · Today: DD/MM/YY | Breeding bitches in law: #. Open the list | link | same screen | scrolls to its place | 1 |
| #/today/bitches · Today: DD/MM/YY | Stud males: #. Open the list | link | #/today/studs · Today: DD/MM/YY | opens it | 1 |
| #/today/bitches · Today: DD/MM/YY | Off site: #. Open the list | link | #/today/offsite · Today: DD/MM/YY | opens it | 1 |
| #/today/bitches · Today: DD/MM/YY | Temperatures today Morning # of # Evening # of # Rooms # to… | row or card | #/round · The round | opens it | 1 |
| #/today/bitches · Today: DD/MM/YY | Outdoor forecast: next # days | row or card | #/round · The round | opens it | 1 |
| #/today/bitches · Today: DD/MM/YY | Fold Breeding bitches in law | button | same screen | changes this screen | 1 |
| #/today/bitches · Today: DD/MM/YY | Breeding bitches in law # | row or card | same screen | changes this screen | 1 |
| #/today/bitches · Today: DD/MM/YY | Cabin for Dog A.. | list | same screen | changes this screen | 10 |
| #/today/bitches · Today: DD/MM/YY | Place | button | same screen | changes this screen | 10 |
| #/today/bitches · Today: DD/MM/YY | close | button | same screen | changes this screen | 1 |
| #/today/nochip · Today: DD/MM/YY | Adults: #. Open the list | link | #/today/adults · Today: DD/MM/YY | opens it | 1 |
| #/today/nochip · Today: DD/MM/YY | Under # months: #. Open the list | link | #/today/pups · Today: DD/MM/YY | opens it | 1 |
| #/today/nochip · Today: DD/MM/YY | Breeding bitches in law: #. Open the list | link | #/today/bitches · Today: DD/MM/YY | opens it | 1 |
| #/today/nochip · Today: DD/MM/YY | Stud males: #. Open the list | link | #/today/studs · Today: DD/MM/YY | opens it | 1 |
| #/today/nochip · Today: DD/MM/YY | Off site: #. Open the list | link | #/today/offsite · Today: DD/MM/YY | opens it | 1 |
| #/today/nochip · Today: DD/MM/YY | Temperatures today Morning # of # Evening # of # Rooms # to… | row or card | #/round · The round | opens it | 1 |
| #/today/nochip · Today: DD/MM/YY | Outdoor forecast: next # days | row or card | #/round · The round | opens it | 1 |
| #/today/nochip · Today: DD/MM/YY | Fold No microchip recorded | button | same screen | changes this screen | 1 |
| #/today/nochip · Today: DD/MM/YY | No microchip recorded # | row or card | same screen | changes this screen | 1 |
| #/today/nochip · Today: DD/MM/YY | chip # | box (text) | same screen | takes what is typed and redraws | 4 |
| #/today/nochip · Today: DD/MM/YY | Save | button | same screen | moves to input | 4 |
| #/today/nochip · Today: DD/MM/YY | close | button | same screen | changes this screen | 1 |
| #/today/noarea · Today: DD/MM/YY | Adults: #. Open the list | link | #/today/adults · Today: DD/MM/YY | opens it | 1 |
| #/today/noarea · Today: DD/MM/YY | Under # months: #. Open the list | link | #/today/pups · Today: DD/MM/YY | opens it | 1 |
| #/today/noarea · Today: DD/MM/YY | Breeding bitches in law: #. Open the list | link | #/today/bitches · Today: DD/MM/YY | opens it | 1 |
| #/today/noarea · Today: DD/MM/YY | Stud males: #. Open the list | link | #/today/studs · Today: DD/MM/YY | opens it | 1 |
| #/today/noarea · Today: DD/MM/YY | Off site: #. Open the list | link | #/today/offsite · Today: DD/MM/YY | opens it | 1 |
| #/today/noarea · Today: DD/MM/YY | Temperatures today Morning # of # Evening # of # Rooms # to… | row or card | #/round · The round | opens it | 1 |
| #/today/noarea · Today: DD/MM/YY | Outdoor forecast: next # days | row or card | #/round · The round | opens it | 1 |
| #/today/noarea · Today: DD/MM/YY | Fold Not in a cabin | button | same screen | changes this screen | 1 |
| #/today/noarea · Today: DD/MM/YY | Not in a cabin # | row or card | same screen | changes this screen | 1 |
| #/today/noarea · Today: DD/MM/YY | Cabin for Dog A.. | list | same screen | changes this screen | 2 |
| #/today/noarea · Today: DD/MM/YY | Place | button | same screen | changes this screen | 2 |
| #/today/noarea · Today: DD/MM/YY | close | button | same screen | changes this screen | 1 |
| #/today/here · Today: DD/MM/YY | Adults: #. Open the list | link | #/today/adults · Today: DD/MM/YY | opens it | 1 |
| #/today/here · Today: DD/MM/YY | Under # months: #. Open the list | link | #/today/pups · Today: DD/MM/YY | opens it | 1 |
| #/today/here · Today: DD/MM/YY | Breeding bitches in law: #. Open the list | link | #/today/bitches · Today: DD/MM/YY | opens it | 1 |
| #/today/here · Today: DD/MM/YY | Stud males: #. Open the list | link | #/today/studs · Today: DD/MM/YY | opens it | 1 |
| #/today/here · Today: DD/MM/YY | Off site: #. Open the list | link | #/today/offsite · Today: DD/MM/YY | opens it | 1 |
| #/today/here · Today: DD/MM/YY | Temperatures today Morning # of # Evening # of # Rooms # to… | row or card | #/round · The round | opens it | 1 |
| #/today/here · Today: DD/MM/YY | Outdoor forecast: next # days | row or card | #/round · The round | opens it | 1 |
| #/today/here · Today: DD/MM/YY | Fold Dogs here | button | same screen | changes this screen | 1 |
| #/today/here · Today: DD/MM/YY | Dogs here # | row or card | same screen | changes this screen | 1 |
| #/today/here · Today: DD/MM/YY | Cabin for Dog A.. | list | same screen | changes this screen | 15 |
| #/today/here · Today: DD/MM/YY | Place | button | same screen | changes this screen | 22 |
| #/today/here · Today: DD/MM/YY | Cabin for Pup P.. | list | same screen | changes this screen | 7 |
| #/today/here · Today: DD/MM/YY | close | button | same screen | changes this screen | 1 |
| #/today/adults · Today: DD/MM/YY | Adults: #. Open the list | link | same screen | scrolls to its place | 1 |
| #/today/adults · Today: DD/MM/YY | Under # months: #. Open the list | link | #/today/pups · Today: DD/MM/YY | opens it | 1 |
| #/today/adults · Today: DD/MM/YY | Breeding bitches in law: #. Open the list | link | #/today/bitches · Today: DD/MM/YY | opens it | 1 |
| #/today/adults · Today: DD/MM/YY | Stud males: #. Open the list | link | #/today/studs · Today: DD/MM/YY | opens it | 1 |
| #/today/adults · Today: DD/MM/YY | Off site: #. Open the list | link | #/today/offsite · Today: DD/MM/YY | opens it | 1 |
| #/today/adults · Today: DD/MM/YY | Temperatures today Morning # of # Evening # of # Rooms # to… | row or card | #/round · The round | opens it | 1 |
| #/today/adults · Today: DD/MM/YY | Outdoor forecast: next # days | row or card | #/round · The round | opens it | 1 |
| #/today/adults · Today: DD/MM/YY | Fold Adult dogs here | button | same screen | changes this screen | 1 |
| #/today/adults · Today: DD/MM/YY | Adult dogs here # | row or card | same screen | changes this screen | 1 |
| #/today/adults · Today: DD/MM/YY | Cabin for Dog A.. | list | same screen | changes this screen | 15 |
| #/today/adults · Today: DD/MM/YY | Place | button | same screen | changes this screen | 15 |
| #/today/adults · Today: DD/MM/YY | close | button | same screen | changes this screen | 1 |
| #/today/pups · Today: DD/MM/YY | Adults: #. Open the list | link | #/today/adults · Today: DD/MM/YY | opens it | 1 |
| #/today/pups · Today: DD/MM/YY | Under # months: #. Open the list | link | same screen | scrolls to its place | 1 |
| #/today/pups · Today: DD/MM/YY | Breeding bitches in law: #. Open the list | link | #/today/bitches · Today: DD/MM/YY | opens it | 1 |
| #/today/pups · Today: DD/MM/YY | Stud males: #. Open the list | link | #/today/studs · Today: DD/MM/YY | opens it | 1 |
| #/today/pups · Today: DD/MM/YY | Off site: #. Open the list | link | #/today/offsite · Today: DD/MM/YY | opens it | 1 |
| #/today/pups · Today: DD/MM/YY | Temperatures today Morning # of # Evening # of # Rooms # to… | row or card | #/round · The round | opens it | 1 |
| #/today/pups · Today: DD/MM/YY | Outdoor forecast: next # days | row or card | #/round · The round | opens it | 1 |
| #/today/pups · Today: DD/MM/YY | Fold Puppies | button | same screen | changes this screen | 1 |
| #/today/pups · Today: DD/MM/YY | Puppies # | row or card | same screen | changes this screen | 1 |
| #/today/pups · Today: DD/MM/YY | Cabin for Pup P.. | list | same screen | changes this screen | 7 |
| #/today/pups · Today: DD/MM/YY | Place | button | same screen | changes this screen | 7 |
| #/today/pups · Today: DD/MM/YY | close | button | same screen | changes this screen | 1 |
| #/today/studs · Today: DD/MM/YY | Adults: #. Open the list | link | #/today/adults · Today: DD/MM/YY | opens it | 1 |
| #/today/studs · Today: DD/MM/YY | Under # months: #. Open the list | link | #/today/pups · Today: DD/MM/YY | opens it | 1 |
| #/today/studs · Today: DD/MM/YY | Breeding bitches in law: #. Open the list | link | #/today/bitches · Today: DD/MM/YY | opens it | 1 |
| #/today/studs · Today: DD/MM/YY | Stud males: #. Open the list | link | same screen | scrolls to its place | 1 |
| #/today/studs · Today: DD/MM/YY | Off site: #. Open the list | link | #/today/offsite · Today: DD/MM/YY | opens it | 1 |
| #/today/studs · Today: DD/MM/YY | Temperatures today Morning # of # Evening # of # Rooms # to… | row or card | #/round · The round | opens it | 1 |
| #/today/studs · Today: DD/MM/YY | Outdoor forecast: next # days | row or card | #/round · The round | opens it | 1 |
| #/today/studs · Today: DD/MM/YY | Fold Stud males | button | same screen | changes this screen | 1 |
| #/today/studs · Today: DD/MM/YY | Stud males # | row or card | same screen | changes this screen | 1 |
| #/today/studs · Today: DD/MM/YY | Cabin for Dog A.. | list | same screen | changes this screen | 2 |
| #/today/studs · Today: DD/MM/YY | Place | button | same screen | changes this screen | 2 |
| #/today/studs · Today: DD/MM/YY | close | button | same screen | changes this screen | 1 |
| #/today/offsite · Today: DD/MM/YY | Adults: #. Open the list | link | #/today/adults · Today: DD/MM/YY | opens it | 1 |
| #/today/offsite · Today: DD/MM/YY | Under # months: #. Open the list | link | #/today/pups · Today: DD/MM/YY | opens it | 1 |
| #/today/offsite · Today: DD/MM/YY | Breeding bitches in law: #. Open the list | link | #/today/bitches · Today: DD/MM/YY | opens it | 1 |
| #/today/offsite · Today: DD/MM/YY | Stud males: #. Open the list | link | #/today/studs · Today: DD/MM/YY | opens it | 1 |
| #/today/offsite · Today: DD/MM/YY | Off site: #. Open the list | link | same screen | scrolls to its place | 1 |
| #/today/offsite · Today: DD/MM/YY | Temperatures today Morning # of # Evening # of # Rooms # to… | row or card | #/round · The round | opens it | 1 |
| #/today/offsite · Today: DD/MM/YY | Outdoor forecast: next # days | row or card | #/round · The round | opens it | 1 |
| #/today/offsite · Today: DD/MM/YY | Fold Off site | button | same screen | changes this screen | 1 |
| #/today/offsite · Today: DD/MM/YY | Off site # | row or card | same screen | changes this screen | 1 |
| #/today/offsite · Today: DD/MM/YY | Cabin for Dog A.. | list | same screen | changes this screen | 2 |
| #/today/offsite · Today: DD/MM/YY | Place | button | same screen | changes this screen | 2 |
| #/today/offsite · Today: DD/MM/YY | close | button | same screen | changes this screen | 1 |
| #/dogs · Dogs [open:button.btn.fbtn] | Sex | list | same screen | changes this screen | 1 |
| #/dogs · Dogs [open:button.btn.fbtn] | Neutered | list | same screen | changes this screen | 1 |
| #/dogs · Dogs [open:button.btn.fbtn] | Age | list | same screen | changes this screen | 1 |
| #/dogs · Dogs [open:button.btn.fbtn] | Colour | list | same screen | changes this screen | 1 |
| #/dogs · Dogs [open:button.btn.fbtn] | Screening | list | same screen | changes this screen | 1 |
| #/dogs · Dogs [open:button.btn.fbtn] | Bitch | button | same screen | changes this screen | 1 |
| #/dogs · Dogs [open:button.btn.fbtn] | Stud | button | same screen | changes this screen | 1 |
| #/dogs · Dogs [open:button.btn.fbtn] | Training | button | same screen | changes this screen | 1 |
| #/dogs · Dogs [open:button.btn.fbtn] | Family | button | same screen | changes this screen | 1 |
| #/dogs · Dogs [open:button.btn.fbtn] | Litter no mum | button | same screen | changes this screen | 1 |
| #/dogs · Dogs [open:button.btn.fbtn] | Puppy | button | same screen | changes this screen | 1 |
| #/dogs · Dogs [open:button.btn.fbtn] | Deceased | button | same screen | changes this screen | 1 |
| #/dogs · Dogs [open:button.btn.fbtn] | Collected | button | same screen | changes this screen | 1 |
| #/dogs · Dogs [open:button.btn.fbtn] | All | button | same screen | already chosen | 1 |
| #/dogs · Dogs [open:button.btn.fbtn] | i | button | #/dogs · Dogs [open:button.btn.fbtn, open:span.info] | opens it | 1 |
| #/dogs · Dogs [open:button.btn.dedit] | Name | box (text) | same screen | takes what is typed and redraws | 1 |
| #/dogs · Dogs [open:button.btn.dedit] | Sex | list | same screen | changes this screen | 1 |
| #/dogs · Dogs [open:button.btn.dedit] | Date of birth | box (date) | same screen | takes what is typed and redraws | 1 |
| #/dogs · Dogs [open:button.btn.dedit] | Colour | list | same screen | changes this screen | 1 |
| #/dogs · Dogs [open:button.btn.dedit] | Neutered | list | same screen | changes this screen | 1 |
| #/dogs · Dogs [open:button.btn.dedit] | Microchip | box (text) | same screen | takes what is typed and redraws | 1 |
| #/dogs · Dogs [open:button.btn.dedit] | Size | list | same screen | changes this screen | 1 |
| #/dogs · Dogs [open:button.btn.dedit] | Save details | button | same screen | changes this screen | 1 |
| #/dogs · Dogs [open:button.btn.dedit] | Cancel | button | #/dogs · Dogs | closes it | 1 |
| #/dogs · Dogs [fold.dcs.wtc] | Fold Dog A..: weighings | button | same screen | changes this screen | 1 |
| #/dogs · Dogs [fold.dcs.wtc] | Dog A..: weighings # | row or card | same screen | changes this screen | 1 |
| #/dogs · Dogs [fold.dcs.wtc] | Date | box (date) | same screen | takes what is typed and redraws | 1 |
| #/dogs · Dogs [fold.dcs.wtc] | kg | box (number) | same screen | takes what is typed and redraws | 1 |
| #/dogs · Dogs [fold.dcs.wtc] | Body condition score, # to # | list | same screen | changes this screen | 1 |
| #/dogs · Dogs [fold.dcs.wtc] | Add weight | button | same screen | changes this screen | 1 |
| #/dogs · Dogs [fold.dcs.wtc] | close | button | same screen | changes this screen | 1 |
| #/dogs · Dogs [fold.dcs.wtc] | # kg Medium ↑ # · DD/MM/YY BCS # DD/MM/YY # kg BCS # DD/MM/… | row or card | same screen | scrolls to its place | 1 |
| #/dogs · Dogs [fold.dcs.meds] | Date | box (date) | same screen | takes what is typed and redraws | 1 |
| #/dogs · Dogs [fold.dcs.meds] | Product | box (text) | same screen | takes what is typed and redraws | 1 |
| #/dogs · Dogs [fold.dcs.meds] | Dose | box (text) | same screen | takes what is typed and redraws | 1 |
| #/dogs · Dogs [fold.dcs.meds] | Route | list | same screen | changes this screen | 1 |
| #/dogs · Dogs [fold.dcs.meds] | Note (optional) | box (text) | same screen | takes what is typed and redraws | 1 |
| #/dogs · Dogs [fold.dcs.meds] | Add medication | button | same screen | moves to input | 1 |
| #/dogs · Dogs [fold.dcs.more] | # health finding | fold | #/dogs · Dogs [fold.dcs, fold.dcs.more] | opens it | 1 |
| #/dogs · Dogs [fold.dcs.more] | # vaccination · last DD/MM/YY due DD/MM/YY | fold | #/dogs · Dogs [fold.dcs.more, fold.dcs.vacc] | opens it | 1 |
| #/dogs · Dogs [fold.dcs.more] | PRA clear VWD carrier | fold | #/dogs · Dogs [fold.dcs.dnac, fold.dcs.more] | opens it | 1 |
| #/dogs · Dogs [fold.dcs.more] | # litter · last DD/MM/YY | link | #/litters/sub-.. · Litters | opens a screen that is switched off for now | 1 |
| #/dogs · Dogs [fold.dcs.more] | # job record | fold | #/dogs · Dogs [fold.dcs, fold.dcs.more] | opens it | 1 |
| #/sops · SOPs [fold.sopgrp, open:button.btn.fbtn] | Colour | list | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp, open:button.btn.fbtn] | Frequency | list | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp, open:button.btn.fbtn] | Category | list | same screen | changes this screen | 1 |
| #/sops · SOPs [fold.sopgrp, open:button.btn.fbtn] | Role | list | same screen | changes this screen | 1 |
| #/areas/ar-N · Areas | All cabins | link | #/areas · Areas | opens it | 1 |
| #/today/nodob · Today: DD/MM/YY | Adults: #. Open the list | link | #/today/adults · Today: DD/MM/YY | opens it | 1 |
| #/today/nodob · Today: DD/MM/YY | Under # months: #. Open the list | link | #/today/pups · Today: DD/MM/YY | opens it | 1 |
| #/today/nodob · Today: DD/MM/YY | Breeding bitches in law: #. Open the list | link | #/today/bitches · Today: DD/MM/YY | opens it | 1 |
| #/today/nodob · Today: DD/MM/YY | Stud males: #. Open the list | link | #/today/studs · Today: DD/MM/YY | opens it | 1 |
| #/today/nodob · Today: DD/MM/YY | Off site: #. Open the list | link | #/today/offsite · Today: DD/MM/YY | opens it | 1 |
| #/today/nodob · Today: DD/MM/YY | Temperatures today Morning # of # Evening # of # Rooms # to… | row or card | #/round · The round | opens it | 1 |
| #/today/nodob · Today: DD/MM/YY | Outdoor forecast: next # days | row or card | #/round · The round | opens it | 1 |
| #/today/nodob · Today: DD/MM/YY | Fold No date of birth | button | same screen | changes this screen | 1 |
| #/today/nodob · Today: DD/MM/YY | No date of birth | row or card | same screen | changes this screen | 1 |
| #/today/nodob · Today: DD/MM/YY | close | button | same screen | changes this screen | 1 |
| #/areas/nom# · Areas | All cabins | link | #/areas · Areas | opens it | 1 |
| #/areas/nomode · Areas | All cabins | link | #/areas · Areas | opens it | 1 |
| #/areas/occ · Areas | All cabins | link | #/areas · Areas | opens it | 1 |
| #/dogs/feb · Dogs [fold.dcs.meds] | Date | box (date) | same screen | takes what is typed and redraws | 1 |
| #/dogs/feb · Dogs [fold.dcs.meds] | Product | box (text) | same screen | takes what is typed and redraws | 1 |
| #/dogs/feb · Dogs [fold.dcs.meds] | Dose | box (text) | same screen | takes what is typed and redraws | 1 |
| #/dogs/feb · Dogs [fold.dcs.meds] | Route | list | same screen | changes this screen | 1 |
| #/dogs/feb · Dogs [fold.dcs.meds] | Note (optional) | box (text) | same screen | takes what is typed and redraws | 1 |
| #/dogs/feb · Dogs [fold.dcs.meds] | Add medication | button | same screen | moves to input | 1 |
| #/buyers (old address) | (typed address) |  | still wired until PR # lands | switched off for now: not walked | 1 |
| #/shape (old address) | (typed address) |  | still wired until PR # lands | switched off for now: not walked | 1 |
| #/litters (old address) | (typed address) |  | still wired until PR # lands | switched off for now: not walked | 1 |
| #/vet (old address) | (typed address) |  | Main | opens Main | 1 |
| #/map · Main | Sign out | button | Sign in to see the tables | signs out | 1 |

### CD Hub (cdhub/): on the phone only (or different on the phone)

| Screen | Control | What it is | Goes to | What happens | Copies |
|---|---|---|---|---|---|
| #/map · Main [open:button.btn.house-ib] | Sign out | button |  | not tapped here: signing out ends the walk (it has its own check belo… | 1 |
| #/today/bitches · Today: DD/MM/YY | Cabin for Dog A.. | list | same screen | scrolls to its place | 10 |
| #/today/nochip · Today: DD/MM/YY | chip # | box (text) | same screen | takes what is typed | 4 |
| #/today/noarea · Today: DD/MM/YY | Cabin for Dog A.. | list | same screen | scrolls to its place | 2 |
| #/today/here · Today: DD/MM/YY | Cabin for Dog A.. | list | same screen | scrolls to its place | 15 |
| #/today/here · Today: DD/MM/YY | Cabin for Pup P.. | list | same screen | scrolls to its place | 7 |
| #/today/adults · Today: DD/MM/YY | Cabin for Dog A.. | list | same screen | scrolls to its place | 15 |
| #/today/pups · Today: DD/MM/YY | Cabin for Pup P.. | list | same screen | scrolls to its place | 7 |
| #/today/studs · Today: DD/MM/YY | Cabin for Dog A.. | list | same screen | scrolls to its place | 2 |
| #/today/offsite · Today: DD/MM/YY | Cabin for Dog A.. | list | same screen | scrolls to its place | 2 |

## Temperatures page (cdhub/history.html)

| Screen | Control | What it is | Goes to | What happens | Copies |
|---|---|---|---|---|---|
| (start) · Temperatures [lit:#, lit:The round] | Skip to content | link | same screen | already here | 1 |
| (start) · Temperatures [lit:#, lit:The round] | CD Hub | link | CD Hub | opens that page | 1 |
| (start) · Temperatures [lit:#, lit:The round] | Sign out | button |  | not tapped here: signing out ends the walk (checked on the hub) | 1 |
| (start) · Temperatures [lit:#, lit:The round] | # | button | same screen | already chosen | 1 |
| (start) · Temperatures [lit:#, lit:The round] | # | button | same screen | changes this screen | 2 |
| (start) · Temperatures [lit:#, lit:The round] | Archive | link | Temperatures archive page | opens that page | 1 |
| (start) · Temperatures [lit:#, lit:The round] | The round | button | same screen | already chosen | 1 |
| (start) · Temperatures [lit:#, lit:The round] | Heat map | button | (start) · Temperatures [lit:#, lit:Heat map] | opens it | 1 |
| (start) · Temperatures [lit:#, lit:The round] | Year strip | button | (start) · Temperatures [lit:#, lit:Year strip] | opens it | 1 |
| (start) · Temperatures [lit:#, lit:The round] | Month cards | button | (start) · Temperatures [lit:#, lit:Month cards] | opens it | 1 |
| (start) · Temperatures [lit:#, lit:The round] | Back to the round | link | CD Hub | opens that page | 1 |
| (start) · Temperatures [lit:#, lit:The round] | Date | box (date) | same screen | takes what is typed and redraws | 1 |
| (start) · Temperatures [lit:#, lit:The round] | Fold Indoors °C | button | same screen | changes this screen | 1 |
| (start) · Temperatures [lit:#, lit:The round] | Indoors °C | row or card | same screen | changes this screen | 1 |
| (start) · Temperatures [lit:#, lit:The round] | Fold Outside | button | same screen | changes this screen | 1 |
| (start) · Temperatures [lit:#, lit:The round] | Outside | row or card | same screen | changes this screen | 1 |
| (start) · Temperatures [lit:#, lit:Heat map] | Fold Indoors | button | same screen | changes this screen | 1 |
| (start) · Temperatures [lit:#, lit:Heat map] | Indoors | row or card | same screen | changes this screen | 1 |
| (start) · Temperatures [lit:#, lit:Heat map] | D Mon YYYY Missed | button | same screen | changes this screen | 3 |
| (start) · Temperatures [lit:#, lit:Heat map] | D Mon YYYY Check | button | same screen | changes this screen | 3 |
| (start) · Temperatures [lit:#, lit:Heat map] | D Mon YYYY Mild | button | same screen | changes this screen | 2 |
| (start) · Temperatures [lit:#, lit:Year strip] | Fold Indoors | button | same screen | changes this screen | 1 |
| (start) · Temperatures [lit:#, lit:Year strip] | Indoors | row or card | same screen | changes this screen | 1 |
| (start) · Temperatures [lit:#, lit:Year strip] | # Jan indoors — Missed | row or card | same screen | changes this screen | 2 |
| (start) · Temperatures [lit:#, lit:Year strip] | # Mar indoors — Check | row or card | same screen | changes this screen | 2 |
| (start) · Temperatures [lit:#, lit:Year strip] | # Feb indoors — Check | row or card | same screen | changes this screen | 1 |
| (start) · Temperatures [lit:#, lit:Year strip] | # Mar indoors — Missed | row or card | same screen | changes this screen | 1 |
| (start) · Temperatures [lit:#, lit:Year strip] | # Mar out — Mild | row or card | same screen | changes this screen | 2 |
| (start) · Temperatures [lit:#, lit:Month cards] | Mar # #% in limit # in limit # outside # missed High # Room… | button | (start) · Temperatures [lit:#, lit:Heat map] | opens it | 1 |
| (start) · Temperatures [lit:#, lit:Month cards] | Feb # #% in limit # in limit # outside # missed High # Room… | button | (start) · Temperatures [lit:#, lit:Heat map] | opens it | 1 |
| (start) · Temperatures [lit:#, lit:Month cards] | Jan # #% in limit # in limit # outside # missed High # Room… | button | (start) · Temperatures [lit:#, lit:Heat map] | opens it | 1 |

### Temperatures page (cdhub/history.html): on the phone only (or different on the phone)

| Screen | Control | What it is | Goes to | What happens | Copies |
|---|---|---|---|---|---|
| (start) · Temperatures [lit:#, lit:The round] | Skip to content | link | same screen | scrolls to its place | 1 |

## Staff page (cdhub/staff/)

| Screen | Control | What it is | Goes to | What happens | Copies |
|---|---|---|---|---|---|
| #home · The Board | Jobs | button | #m/jobs · Today | opens it | 1 |
| #home · The Board | Scan | button | #m/moves · Scan a room sign | opens it | 1 |
| #home · The Board | Temps | button | #m/temperature · Room temperatures | opens it | 1 |
| #home · The Board | Where | button | #m/where · Where is everyone? | opens it | 1 |
| #home · The Board | Checks | link | Checks page | opens that page | 1 |
| #home · The Board | Home | button | same screen | scrolls to its place | 1 |
| #home · The Board | Scan | button | #scan · Scan a room sign | opens it | 1 |
| #home · The Board | Report | button | #m/report · Report | opens it | 1 |
| #home · The Board | Phone | button | #device · This phone | opens it | 1 |
| #m/temperature · Room temperatures | ← Home | button | #home · The Board | opens it | 1 |
| #m/temperature · Room temperatures | Room N · Room N door Due | button | #m/temperature · Room N · Room N door | opens it | 1 |
| #m/temperature · Room temperatures | Room N · Room N window Due | button | #m/temperature · Room N · Room N window | opens it | 1 |
| #m/temperature · Room temperatures | ✓ Room N #–# | button | #m/temperature · Room N | opens it | 1 |
| #m/temperature · Room temperatures | ✓ Room N Outside #–# | button | #m/temperature · Room N | opens it | 1 |
| #m/temperature · Room temperatures | ✓ Room N Room empty | button | #m/temperature · Room N | opens it | 1 |
| #m/temperature · Room temperatures | Room N Due | button | #m/temperature · Room N | opens it | 2 |
| #m/temperature · Room temperatures | Add earlier reading | button | #m/temperature · Add earlier reading | opens it | 1 |
| #m/temperature · Room temperatures | Year report | button | #m/temperature · Year report | opens it | 1 |
| #m/temperature · Room temperatures | Sensor CSV | button | #m/temperature · Sensor back-up import | opens it | 1 |
| #m/moves · Scan a room sign | ← Home | button | #home · The Board | opens it | 1 |
| #m/where · Where is everyone? | ← Home | button | #home · The Board | opens it | 1 |
| #m/where · Where is everyone? | Dog A.. new room | list | same screen | changes this screen | 2 |
| #m/where · Where is everyone? | Off-site | button | same screen | changes this screen | 2 |
| #m/where · Where is everyone? | Moved | button | same screen | changes this screen | 20 |
| #m/jobs · Today | ← Home | button | #home · The Board | opens it | 1 |
| #m/jobs · Today | Yes, done: Wash the bowls | button | same screen | changes this screen | 1 |
| #m/jobs · Today | Problem: Wash the bowls | button | same screen | changes this screen | 1 |
| #m/report · Report | ← Home | button | #home · The Board | opens it | 1 |
| #m/report · Report | Dog | list | same screen | changes this screen | 1 |
| #m/report · Report | Room | list | same screen | changes this screen | 1 |
| #m/report · Report | What happened? | box (text) | same screen | takes what is typed and redraws | 1 |
| #m/report · Report | Send | button | same screen | changes this screen | 1 |
| #scan · Scan a room sign | ← Home | button | #home · The Board | opens it | 1 |
| #device · This phone | Remove my code from this phone | button |  | not tapped here: it un-sets the phone (it has its own test) | 1 |
| #m/temperature · Room N · Room N door | ← Rooms | button | #m/temperature · Room temperatures | opens it | 1 |
| #m/temperature · Room N · Room N door | Read with camera | button | same screen | changes this screen | 1 |
| #m/temperature · Room N · Room N door | Type it | button | same screen | changes this screen | 1 |
| #m/temperature · Room N · Room N door | Room empty | box (checkbox) | same screen | changes this screen | 1 |
| #m/temperature · Room N · Room N window | ← Rooms | button | #m/temperature · Room temperatures | opens it | 1 |
| #m/temperature · Room N · Room N window | Read with camera | button | same screen | changes this screen | 1 |
| #m/temperature · Room N · Room N window | Type it | button | same screen | changes this screen | 1 |
| #m/temperature · Room N · Room N window | Room empty | box (checkbox) | same screen | changes this screen | 1 |
| #m/temperature · Room N | ← Rooms | button | #m/temperature · Room temperatures | opens it | 1 |
| #m/temperature · Room N | Read with camera | button | same screen | changes this screen | 1 |
| #m/temperature · Room N | Type it | button | same screen | changes this screen | 1 |
| #m/temperature · Room N | Room empty | box (checkbox) | same screen | changes this screen | 1 |
| #m/temperature · Add earlier reading | ← Rooms | button | #m/temperature · Room temperatures | opens it | 1 |
| #m/temperature · Add earlier reading | Day | box (date) | same screen | takes what is typed and redraws | 1 |
| #m/temperature · Add earlier reading | Morning or afternoon | list | same screen | changes this screen | 1 |
| #m/temperature · Year report | ← Rooms | button | #m/temperature · Room temperatures | opens it | 1 |
| #m/temperature · Year report | Room | list | same screen | changes this screen | 1 |
| #m/temperature · Year report | Year | list | same screen | changes this screen | 1 |
| #m/temperature · Year report | Open report | button | same screen | changes this screen | 1 |
| #m/temperature · Sensor back-up import | ← Rooms | button | #m/temperature · Room temperatures | opens it | 1 |
| #m/temperature · Sensor back-up import | Room | list | same screen | changes this screen | 1 |
| #m/temperature · Sensor back-up import | Sensor name | box (text) | same screen | takes what is typed and redraws | 1 |

### Staff page (cdhub/staff/): on the phone only (or different on the phone)

| Screen | Control | What it is | Goes to | What happens | Copies |
|---|---|---|---|---|---|
| #home · The Board | Scan | button | #m/moves · (no heading) | opens it | 1 |
| #home · The Board | Temps | button | #m/temperature · (no heading) | opens it | 1 |
