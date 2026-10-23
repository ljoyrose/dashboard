# M03 · Stage 2 · Base
Picking A Base, Bricks, Shelves And Kits · Track F · v1 · 23 Oct 2026

How the factory picks a proven base to start from, and the bricks, shelves and kits every app is assembled from.

## M03-L1 · Picking A Base
**Outcome:** You can explain how the factory picks a base, copies the template and passes the Base gate.  
**Length:** 810 words · about 6.2 min · Today

**Opener (Epiphany Bridge (light)):** Backstory: Rory had a grooming app idea that had just passed the Merit gate. · Desire: He wanted the first screens working by the weekend. · Wall: Starting from a blank project, he spent the whole weekend rebuilding sign-in, menus and a cookie notice he had built before. · Epiphany: Starting from a base that already works means only the new parts need building.

| # | On Screen | Narration |
|---|---|---|
| 1 | Starting From Nothing Is Slow | Meet Rory. He had an idea for a booking desk for dog groomers, a bit like our sample app Trimtable, and it had just passed the Merit gate. He wanted the first screens working by the weekend, so he opened a blank project and started typing. By Sunday he had rebuilt a sign-in page, a menu and a cookie notice, all things he had built before, and not one part that was new. Then it clicked. If you start from a base that already works, you only build the parts that make your app different. That is Stage 2. |
| 2 | Stage 2 Is Called Base | Stage 2 in the factory is called Base. A base is the starting app you copy before you add anything new. Stage 2 sits in the Research room, the same room as Stages 1 and 3, and it is free: no build credits are spent here. Credits are the units the build platform charges for each paid building turn. The job of this stage is short and strict. Choose a base, copy the template folder, save a backup, check for duplicates, list the bricks, and prove the base is safe. Then the Base gate opens by itself. |
| 3 | Remix Or Rebuild | The first choice is remix or rebuild. To remix means to start from an existing base app that the factory already owns, kept on a shelf of bases, and change it. To rebuild means to start fresh, because no base fits. The factory records a fresh start as BESPOKE, which means made to order. A rebuild is never chosen on a whim. It has to come with the result of a dedup check that proved nothing suitable already exists. Most of the time a remix wins, because the floor of the app, meaning sign-in, menus and legal pages, is already built and tested. |
| 4 | The Dedup Check Looks For Twins | Dedup is short for de-duplication, which means removing copies. The dedup check is run live on the build platform, not from memory. It asks a simple question: does something we already own do this job, or most of it? If the answer is yes, that is the base. If an earlier base was looked at and turned down, its name is written down with the reason, so nobody suggests it again next month. This one habit saves a lot of money later, because building the same thing twice costs twice, and the second copy has to be tested and looked after as well. |
| 5 | Copy The Template, Then Save A Backup | Next, the factory clones the template app folder. To clone means to make an exact copy. Every app gets its own folder made from the same template, so every app's papers sit in the same places. Be clear about one thing: this is a folder of documents, not the live app. The app itself is created on the build platform later, when the feature list is frozen at the Lock gate. The moment a base is chosen, an Export ZIP is taken. A ZIP is one packed file holding a full copy, so there is always a safe point to go back to. |
| 6 | Bricks, Kits And Colours Listed Once | Then comes the brick list. A brick is one reusable part, such as booking or invoices, and a kit is a named bundle of bricks that ship together. The list includes the kits, by their ids, and every brick's status is quoted word for word, never guessed. One rule from the checklist is worth remembering: never say there are no bricks for something until you have searched the kits and the design notes. The colours are settled here too. They live in one place only, as rows in the app's palette table, never typed into the code. You will meet bricks properly in the next lesson. |
| 7 | A Security Vet With Two Accounts | A base can look fine and still leak. A leak is when one person or business can see data that belongs to someone else. So the base gets a security vet, which means a careful check, using two separate test accounts. Each account signs in and tries to see the other's records. If either can, the base fails, however good it looks. This matters even more for a reseller app like Litterline, where a club such as Northvale Canine Society sits above many breeders. A copy of a leaky base copies the leak into every app built on it. |
| 8 | The Base Gate Opens By Itself | Now the gate. The Base gate sits between Stage 2 and Stage 3, and it asks one question: is the base named, and has the vet passed? It is an auto gate, which means no person has to click yes. When every Stage 2 checklist line is ticked, the engine moves the app on by itself. Compare that with Screen and Merit, where a person decides. Base can be automatic because its questions have plain answers: a name is written or it is not, and a test passed or it did not. Let us recap what makes a good base. |

**Recap**
- Remix An Owned Base Or Rebuild As BESPOKE
- Dedup Check And Export ZIP Come First
- Base Gate Is Auto Once Base Named And Vetted
- Why it matters: A Proven Base Means Only New Parts Get Built

**Quiz**
1. What does it mean to remix at Stage 2? A) Start fresh with a blank project · B) Start from an existing base the factory owns · C) Copy another company's app · D) Skip the Base stage · **Answer B**: To remix is to start from a base app the factory already owns and change it.
2. What must come with a decision to rebuild as BESPOKE? A) A dedup check that proved nothing suitable exists · B) A paid build prompt · C) A finished sales page · D) A signed letter from the club · **Answer A**: A fresh start is only recorded with the dedup run that proved no base fits.
3. Who moves the app through the Base gate? A) A person always clicks yes · B) The customer · C) The engine, automatically, when every line is done · D) The reseller club · **Answer C**: Base is an auto gate: when every Stage 2 line is done, the engine moves the app on.
4. Why is an Export ZIP taken as soon as the base is chosen? A) To send it to customers · B) To make the app faster · C) To publish the app · D) To keep a safe copy to go back to · **Answer D**: The Export ZIP is a full packed copy, so there is always a safe point to return to.

Sources: TEMPLATE-MIRROR.md, THE-STAGE-TRANSITIONS.md, AF-UNDERSTANDING-2026-10-22.md, APP-FACTORY-FRAMEWORK.md

## M03-L2 · Bricks, Shelves And Kits
**Outcome:** You can explain what bricks, shelves and kits are, and why K00 sits under every app.  
**Length:** 762 words · about 5.9 min · Today

**Opener (Epiphany Bridge (light)):** Backstory: Isla tried to plan Litterline by writing down every feature she could think of. · Desire: She wanted a full parts list she could trust. · Wall: An hour later she had sixty loose items, and half of them were repeats under different names. · Epiphany: Picking a few named kits, each a known bundle of bricks, gave her a clean list in minutes.

| # | On Screen | Narration |
|---|---|---|
| 1 | Sixty Loose Parts, Half Of Them Repeats | Isla was planning Litterline, our sample licence and records hub for dog breeders. She sat down and wrote every feature she could think of: dog records, health notes, litters, reminders, forms, invoices. She wanted a full parts list she could trust. An hour later she had sixty loose items, and half of them were the same thing under different names. Bookings, appointments and reservations were all one idea. Then she saw how the factory does it. It picks a few named kits, each a known bundle of parts, and the list is clean in minutes. |
| 2 | A Brick Is One Reusable Part | A brick is one reusable part of an app that does one job. Booking is a brick. Documents is a brick. Sign on the screen is a brick. Each brick has an id that starts with BR, such as BR-BOOKING, plus a name, the tables it needs and a status. The factory keeps them all in one list called BRICK-REGISTRY, and the version in use, v0.16, holds 101 bricks. A table, by the way, is a grid of rows and columns that stores one kind of record, a bit like one tab in a spreadsheet. |
| 3 | Eight Shelves On A Colour Spine | Bricks sit on shelves, and the shelves are sorted on a colour spine, which is a fixed order where each shelf has its own colour. There are 8 shelves. BASICS is the floor: sign-in, menus and basic records. Boundaries holds walls, roles, security and legal. Bucks holds plans, invoices and payment rails. Body holds the parts you see, like booking and records. Brand holds the name, colours, logo and domain for each brand. Boost holds public pages, reviews and funnels. Brains holds scoring, matching and reports. Bots holds reminders, sequences and imports that run on their own. |
| 4 | Most Bricks Live In Body | If you count the registry, the shelves are not even. Body is by far the biggest, with 63 of the 101 bricks. That is partly because the registry folds the Bots shelf into Body: a bot is a way of doing something, not a separate thing, so bot bricks are filed under Body. After Body come Brains with 11, Bucks with 10, Boundaries with 9, Boost with 4, Brand with 3, and BASICS with just one brick, BR-BASICS. You do not need to remember the numbers. Remember that the shelf tells you what kind of job a brick does. |
| 5 | A Kit Is A Named Bundle | A kit is a named bundle of bricks that ship together, so one idea is picked as one thing with a known cost, not as fifteen loose picks. There are 9 kits, numbered K00-K08. K01 is a client portal. K02 is booking and appointments. K03 is selling a thing with a single seller. K04 is quiz to lead to report. K05 is a membership community. K06 is a breeding and livestock record. K07 is field service and job operations. K08 is own rules and checklists. Each kit names an anchor brick, the main part everything else hangs from. |
| 6 | K00 Is The Floor Under Every App | K00 is different. It is called the floor, and it is forced onto every app. You cannot pick it and you cannot remove it. It holds three bricks: BR-BASICS for sign-in, menus and simple records, BR-TENANCY for keeping each business's data apart, and BR-LEGAL for consent and data protection. Between them they bring seven tables, including tenants, roles, permissions and consents. Because every kit sits on the floor, those three bricks are counted inside every kit, never added on top. K02, for example, has four bricks: the floor's three plus BR-BOOKING. |
| 7 | Litterline Picks Four Kits | Here is how it looks for Litterline. It uses K00, the floor, like every app. Its main kit is K06, breeding and livestock record, which brings pedigree, clinical record and breeding events. A pedigree is the record of an animal's parents and ancestors. It adds K08, own rules and checklists, so a breeder can track licence conditions as rows. And it adds K01, the client portal, so puppy buyers can see their own records. Four kits, and a clear list. Trimtable, the grooming desk, picks K00, K02, K01 and K03 instead. |
| 8 | Kits First, Then Loose Bricks | Kits do not stop you adding single bricks. Each kit lists optional members too, such as reminders added to booking to cut no-shows. But the order matters. Start with the floor, choose the kits that match the idea, then add any loose bricks the kits do not cover. This keeps two apps that need the same thing building it the same way, and it means a part proved in one app can be reused in the next. In the next stage you will choose exactly which kits and bricks make the first version. First, a recap. |

**Recap**
- A Brick Is One Reusable Part With An Id
- 101 Bricks Sit On 8 Colour Spine Shelves
- 9 Kits K00-K08, With K00 Under Every App
- Why it matters: Named Kits Turn Loose Wishes Into A Clean List

**Quiz**
1. How many bricks are in BRICK-REGISTRY v0.16? A) 88 · B) 101 · C) 63 · D) 20 · **Answer B**: The registry in use, v0.16, holds 101 bricks.
2. What is K00? A) An optional booking kit · B) A kit only for resellers · C) A retired kit · D) The floor, forced onto every app · **Answer D**: K00 is the floor: it cannot be picked or removed and sits under every app.
3. Which three bricks make up K00? A) BR-BASICS, BR-TENANCY and BR-LEGAL · B) BR-BOOKING, BR-FORMS and BR-DOCS · C) BR-PEDIGREE, BR-CLINICAL and BR-LITTERS · D) BR-REVIEWS, BR-GALLERY and BR-CHAT · **Answer A**: The floor is BR-BASICS, BR-TENANCY and BR-LEGAL, counted inside every kit.
4. Why does the Body shelf hold the most bricks? A) Body bricks are cheaper · B) Body is the only free shelf · C) The registry files bot bricks under Body · D) Every kit lives on Body · **Answer C**: The registry folds Bots into Body, so bot bricks are counted there.

Sources: BRICK-REGISTRY.csv, BRICK-KITS.csv, AF-UNDERSTANDING-2026-10-22.md, TEMPLATE-MIRROR.md
