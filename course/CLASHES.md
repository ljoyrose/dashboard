# Clashes For Lisa
23 Oct 2026. Nothing here was resolved silently. The course follows the column marked **Course uses** until you decide. Every name lives in `glossary.json`, so a change is one edit.

## Names
| # | Clash | Files | Course uses |
|---|---|---|---|
| 1 | Gate names. Rule books: Screen, Merit, (Base), Lock, Schema, Slot, Invest, Leak, Launch 6→7, Live 7→8, Trouble, Return, Retire. Engine: Send 6→7, Launch 7→8 ("Leak + Launch + Live in one move") | APP-FACTORY-FRAMEWORK.md, GATES.csv vs TEMPLATE-MIRROR.md, AF-UNDERSTANDING-2026-10-22.md | Live engine set. Slot, Leak, Live shown as checks inside gates |
| 2 | Gate count: 12 (framework) vs 13 with Base (GATES.csv); every GATES.csv row still PROPOSED | APP-FACTORY-FRAMEWORK.md, GATES.csv | 8 road gates + 3 lap gates |
| 3 | Who stamps: framework says Merit, Lock, Invest, Launch, Retire are Lisa's; engine auto-passes Invest at 1,500 credits or less, and Screen and Merit if in AUTO_GATES | GATES.csv vs AF-UNDERSTANDING Part 3 | Engine, with the auto-pass named |
| 4 | Shelves: 8-shelf colour spine (BASICS, Boundaries, Bucks, Body, Brand, Boost, Brains, Bots) vs 9 shelves (0 Basics, 1 Brief, 2 Boundaries, 3 Bucks, 4 Body, 5 Bridges, 6 Boost, 7 Brains, 8 Bin) | LC-VISUAL-STANDARD.md, BRICK-LAYERS-AND-COLOUR-SPINE vs BRICK-KITS.csv | Colour spine (as you said) |
| 5 | BRICK-REGISTRY stores `Bricks` for Body (53 rows), plus 10 `Body`; Brand is a value that is not one of the 9 shelves; Bots folded into Body in BRICK-KITS but is a shelf on the spine | BRICK-REGISTRY.csv v0.16, BRICK-KITS.csv v1.2 | Body = Bricks + Body |
| 6 | Where the app is first created: Drive folder clone at Base (1→2 / 2→3) vs on the platform at 3→4 | APP-FACTORY-FRAMEWORK §7A vs THE-STAGE-TRANSITIONS | Folder at Base, platform app at Lock (explained as two things) |
| 7 | Rescue from any stage (Lisa 18 Oct) is only a PROPOSAL; the engine rescues stage-8 apps only | AF-UNDERSTANDING Part 4.4 | Stage-8 rescue, with a "proposed" note |
| 8 | Retire trigger: 2 losing months (engine, 20 Oct) vs the Return threshold R02 (rule books) | AF-UNDERSTANDING Part 4.3 | Engine (2 losing months); Return taught as a rule |
| 9 | OBLIGATIONS.csv uses old tokens (TEN>=2, BRD, USR1) vs the frozen 20-part code | OBLIGATIONS.csv v0.6 vs AF-CARD-TEMPLATE.md | 20-part code |
| 10 | S3 isolation tests A-E are named but not defined in any file read | APP-FACTORY-FRAMEWORK.md | Taught as "five named tests", TO CHECK STANDARD S3 |
| 11 | Wall numbering: 3 walls (owner, business, customer) in the tenancy rules vs W1-W8 in codes-catalogue.json | TENANCY-CLASSIFICATION-AND-ISOLATION-RULES.md vs codes-catalogue.json | W1-W8 (graphics carry W in title); the 3 walls taught as the simple picture |
| 12 | Engine room map: stages 2-3 in "Research", 4-5 in "Rig"; the FLOOR's Ready Room is unused | AF-UNDERSTANDING Part 4.10 | Engine rooms |

## Colours
| # | Clash | Course uses |
|---|---|---|
| 13 | Brick-layer hexes (paste rule 5, LC-VISUAL-STANDARD) vs the dashboard's Palette A Clear (tokens.css) | **Your call 23 Oct: both, by job.** Bricks, shelves, walls, codes = layer hexes. Dashboard and app screens = Palette A |
| 14 | Palette A text hexes in your 23 Oct image (#D93732, #AD6202, #877402, #258631, #027BB5, #915CBC) differ from live tokens.css (#C32924, #9E5802, #817002, #217A2D, #0271A4, #8850B6) | tokens.css (the live one, passes contrast) |
| 15 | No status hexes are locked. Proposed from tokens.css: Solid #217A2D, Fragile #9E5802, Not Built #2C2C2A, Not Needed #756E65; risk word High #C32924 | Proposed set, in glossary.json |
| 16 | BASICS layer hex #2C2C2A is also the ink colour, so "a layer colour is never reused" can't hold for ink | Ink allowed; BASICS shown with icon + word |
| 17 | Muted text: paste #756E65 vs dashboard #6B645C | #756E65 in course graphics, #6B645C inside dashboard mockups |
| 18 | LJR7 spine says Brains blue-purple #7A6BA8 and Bots purple #8D6B9C; the older spine had one purple for Ideas | Layer hexes as locked |

## New items (D11)
Anything in the Vision 2029 screens that extends an existing panel is listed here as **NEW - TO CHECK** (added as built).

## Found in the artefacts (23 Oct)
| # | Clash | Course uses |
|---|---|---|
| 19 | Atlas teaches 12 gates (Screen, Merit, Lock, Schema, Slot, Invest, Leak, Launch, Live, Trouble, Return, Retire) and 11 rooms; Atlas tiles say "12 checkpoints" | Live engine gate set; all 11 rooms |
| 20 | Atlas lists 17 tenancy tokens ("13 + 4 proposed") and kits K00-K07; the frozen card has 20 codes and BRICK-KITS has K08 | 20 codes, K00-K08 |
| 21 | Stockroom (16 Sep snapshot) shows 55 bricks with 17 Bots; BRICK-REGISTRY v0.16 has 101 bricks and folds Bots into Body | Registry v0.16 counts |
| 22 | The 7 P-documents (Passport, Pitch, Proposal, Parts, Promote, Progress, Payoff) in Atlas were replaced by one document organised by stage (PR1167) | One document by stage |
| 23 | Factory Cockpit uses its own vivid palette and other fonts (Bricolage, Atkinson) | Not used as a style reference |

## Vision 2029 screens: NEW - TO CHECK (D11)
| # | Item | Built from | Status |
|---|---|---|---|
| 24 | **Pulse tab** on the factory page: number strip (live apps, decide queue, leak probe, rescue), credits bar, money line, rooms with app counts, engine jobs | Extends the Factory Cockpit 4-number strip (decide, steps, credits, routines) and Atlas rooms; engine job names and times from AF-UNDERSTANDING | NEW - TO CHECK |
| 25 | **App Detail page** (vision, pain, verdict, 20 codes, kits and bricks, keywords, market, gates passed, competitor table) | The one document organised by stage (THE-DOCUMENT) shown as a page | NEW - TO CHECK |
| 26 | **Automated launch and operate** page (domain, sales page, funnels, brand jackets, boosts, leak monitor, launch checks) | Stage 7 and 8 template lines (TEMPLATE-MIRROR.md) and OBLIGATIONS OB-P14, OB-P22 | NEW - TO CHECK |
| 27 | **Scaling gap found:** the real Rooms tab lists every app as a chip; at about 1,300 apps it becomes a 57,000 px wall | Real factory/index.html with the 2029 state | Needs a grouped view before scale |
| 28 | Card language: the live ADHD standard says 4 px LEFT stripe and 16 px corners; LC-VISUAL-STANDARD and paste rule 1 say thin TOP band | Graphics and slides follow the paste (top band, 16 pt corners); dashboard mockups follow the live page (no band, 12 px corners, 1.5 px line) | Follows both by job |

## Renderer and sources (23 Oct)
| # | Clash | Course uses |
|---|---|---|
| 29 | SRC_render_codes_card.py draws status as text glyphs (tick, warning, cross) in DejaVu Sans and uses its own hexes (#1F1D1B, #2E7D46, #95661B) | Same layout and row order ported to SVG with Lexend, line icons and glossary hexes (build/g_codes_card.py) |
| 30 | AF-WALLS v4 shows the real Links app with a BLD (Bloodline) comparison row | Not reused; re-rendered for invented apps (Litterline, Stayproof, Trimtable) |
| 31 | walls_render.py and RUN-PROGRESS-WALLS.md: not found on Drive (23 Oct 03:00) | AF-WALLS v5 not available; codes cards drawn with the ported renderer |
| 32 | The plan-from-landing-page rule (SLIP-2026-10-04-0630) is still PENDING-CONFIRM | Taught as the decision on record |
| 33 | Domain and DNS: the template buys the domain and sets DNS in Stages 3-4; Stage 7 only checks them from outside | Lessons say so; the Launch Kit graphic groups them for the learner |
| 34 | Puppy Classroom accent colour in app screens is a placeholder (#0271A4, Palette A slot 6 text) | TO CHECK against the Puppy Classroom Canva brand kit |
