# Module Script Brief (for every writer)
App Factory course, Track F (Family Learners): adults and tweens learning how apps are really made. Educational and informative, **not childish**: real words and real codes, explained plainly so a 12-year-old can follow. ADHD-friendly: one idea per beat, short lessons, a recap at the end.

## Output
One JSON file per module: `course/scripts/modules/Mxx.json` (M00 … M10). UTF-8, valid JSON, 2-space indent. Schema:

```json
{
  "id": "M01",
  "stage": 0,
  "title": "Stage 0 · Idea",
  "subtitle": "The Idea Form, The 20 Codes, The Kill Check",
  "summary": "One sentence on what the module covers.",
  "lessons": [
    {
      "id": "M01-L1",
      "title": "Title Case, Max 6 Words",
      "outcome": "You can … (one plain sentence, starts 'You can')",
      "minutes": 6,
      "opener": {"framework": "Epiphany Bridge (light)", "backstory": "1 sentence", "desire": "1 sentence", "wall": "1 sentence", "epiphany": "1 sentence"},
      "beats": [
        {"screen": "On-Screen Words, Title Case, Max 7 Words", "icon": "bulb", "say": "Narration paragraph."}
      ],
      "recap": {"points": ["Title Case Point, Max 9 Words", "…", "…"], "why": "Why It Matters, One Line, Title Case"},
      "quiz": [{"q": "Plain question?", "options": ["A", "B", "C", "D"], "answer": 1, "why": "One sentence explaining the right answer."}],
      "sources": ["AF-CARD-TEMPLATE.md", "…"],
      "vision": false
    }
  ]
}
```

## Lengths
- Each lesson: **7 to 9 beats**. Each `say` is 80 to 110 words. Total narration per lesson: **650 to 850 words** (about 5 to 7 minutes at 130 words a minute). The first beat is the opener story told in narration (the 4 opener lines, spoken naturally). The last beat leads into the recap.
- Quiz: 4 questions per lesson, 4 options each, exactly one right answer, `answer` = index 0-3. Vary the answer position.
- Recap: exactly 3 points + 1 why line.

## Voice and rules (all are checked by a script)
1. UK English (colour, organise, licence as a noun, licensed as a verb). UK dates (23 Oct 2026). Times as UK time, e.g. 06:40 UK time.
2. **No emoji or symbol characters** (no ticks, crosses, stars, arrows). Plain text only. Use "-" for ranges, e.g. "TEN (0-6)".
3. Screen words and recap points in Title Case. Code tokens stay in capitals (TEN, CUST, SEN). Where a code has levels, show its range, e.g. "SEN (0-3)".
4. Plain words, short sentences. Explain every term the first time it's used ("a schema is the plan of the tables that hold the data"). Never childish: no "super", no "awesome", no cartoon voice, no exclamation marks.
5. **Fictional only.** Use only these invented apps and people: Litterline (licence and records hub for dog breeders; resold by the fictional club Northvale Canine Society; breeder Mara Quill), Stayproof (inspection pack for boarding kennels; Hollin Lane Kennels), Trimtable (booking and client desk for dog groomers; groomer Juno Platt, salon The Tidy Paw). Learners in openers: invented first names only (e.g. Ava, Sam, Rory, Isla). Never use any real app, business or idea name.
6. **Live values only** (old values are banned and the checker fails on them): 20 codes in 4 groups (never 13 or 17); kits K00-K08 (9 kits; never "K00-K07"); 101 bricks in BRICK-REGISTRY v0.16 on the 8-shelf colour spine, Bots folded into Body in the registry (never "55 bricks"); the live engine gates (never "12 checkpoints"); 11 rooms; one document organised by stage (never the 7 P-documents).
7. Gates (live engine set): Screen 0-1, Merit 1-2, Base 2-3 (auto), Lock 3-4, Schema 4-5 (auto), Invest 5-6 (auto at 1,500 credits or less), Send 6-7, Launch 7-8; lap gates Trouble (auto), Back to Operate, Retire. Slot, Leak and Live are checks inside gates. A person decides at Screen, Merit, Lock, Invest (unless auto), Send, Launch, Back to Operate, Retire.
8. Anything about the future (about 1,000 apps, one a day, full automation) must say "Vision 2029, illustrative" in the narration and set `"vision": true` on that lesson.
9. No income promises anywhere.
10. Quote real source file names in `sources` (from the list below). Never invent a rule. If a source is unclear, say less.
11. `icon` must be one of these names exactly: alert-triangle archive arrow-back-up arrow-right badge-cc bell bolt book box brain broadcast building-factory-2 building-store building-warehouse bulb calendar cash certificate chart-funnel chart-line check checklist circle-check circle-minus circle-x clipboard-check clock coin currency-pound database dog download droplet eye file-certificate file-text filter flag forms gavel heart-rate-monitor help-circle home-2 hourglass id-badge-2 key layout-dashboard layout-list license lifebuoy link list-check lock login mail map-2 message-code microphone minus palette paw player-play progress puzzle radar recycle robot rocket scale school scissors search send shield-check sparkles stack-2 table-options table-shortcut table target test-pipe trending-up user users-group users video wall wand world-www world x

## Facts (read before writing)
- **`course/glossary.json`**: all names: stages, rooms, gates, codes with levels, walls W1-W8, shelves, kill questions, verdicts, data roles, sample apps with their 20-code values, the vision2029 figures.
- **`course/data/bricks-kits.json`**: the 9 kits with their bricks and tables; the 101 bricks with shelves.
- **`course/CLASHES.md`**: where files disagree, use the "Course uses" column.
- Source texts (read-only, private; quote file names only, never copy long passages): `/tmp/claude-0/-home-user-dashboard/dd99ab97-eaaf-5b42-b479-cc90e52a2b40/scratchpad/src/` holds AF-UNDERSTANDING-2026-10-22.md (the whole factory in plain words; best single source), TEMPLATE-MIRROR.md (checklist lines per stage), THE-STAGE-TRANSITIONS.md, GATES.csv, APP-FACTORY-FRAMEWORK.md, TENANCY-CLASSIFICATION-AND-ISOLATION-RULES.md, OBLIGATIONS.csv, codes-catalogue.json, BRICK-KITS.csv, BRICK-REGISTRY.csv, ClickFunnels-Platform-Reference.md, "ClickFunnels ↔ OverSkill — Integration (CURRENT 13 Sep 2026).md", SLIP-2026-10-04-0630-DECISION-plan-carried-from-landing-page-reseller-never-free.md, REGULATION-WATCH.csv. **Do not read or use** anything about Bloodline, BLD, Links, Money Hub, CD Hub or Columbary, and never put any real app or idea name in the course.

## Module plan (who writes what is in your task message)
| Module | Stage | Lessons (title idea → must cover) |
|---|---|---|
| M00 What Is An App Factory | - | L1 What An App Is Made Of (screens, tables, rules, people; why most apps are hand-made) · L2 The Road, Rooms And Gates (9 stages, 11 rooms, gates, a person decides at some) |
| M01 Stage 0 · Idea | 0 | L1 The Idea Form (customer fills vision, who pays, pain; four idea doors) · L2 The 20 Codes (4 groups, word plus number, 6 required, "?" allowed on 14) · L3 Kill Check, Verdict And Data Role (FRAGILE, ONESHOT, NOHOOK; PASS/HOLD/KILL; SEN 2-3 = HOLD; CONTROLLER/PROCESSOR/BOTH/NONE; Screen gate) |
| M02 Stage 1 · Research | 1 | L1 The Research Sweep (competitors, customer words, gap matrix, market size, rules flag, rank) · L2 The Merit Gate (GO/HOLD/KILL/RESHAPE; why a person decides; DPIA hold) |
| M03 Stage 2 · Base | 2 | L1 Picking A Base (remix or rebuild, clone the template, dedup check, Base gate auto) · L2 Bricks, Shelves And Kits (101 bricks, 8 shelves, 9 kits K00-K08, K00 floor on every app) |
| M04 Stage 3 · Features | 3 | L1 Choosing Kits And Bricks (who sees what, content as data, launch-minimum scope, mockup) · L2 Duties And The Lock Gate (obligations ledger, named payer, legal check, freezing the list) |
| M05 Stage 4 · Schema | 4 | L1 How The System Makes The Tables (codes plus kits decide tables and columns; tables built by hand; access modes; table register) · L2 Walls And Table Tests (W1-W8; brand-wall read, user-wall read, anonymous read returns 401; field-level test on shared tables; Schema gate auto) |
| M06 Stage 5 · Data | 5 | L1 Test Identities And Test Tenants (2 contrasting test tenants, 2 test members per brand with own mailbox, no Google SSO, agents never create accounts) · L2 The Leak And Tenant Tests (test plan with negative cases, test matrix: every table x signed-out / brand A / brand B / owner; leak = stop; credit estimate; Invest gate and Slot check) |
| M07 Stage 6 · Prompts | 6 | L1 How Build Prompts Are Written (one surface per prompt, walls block, each prompt carries its test and a rollback step; the only paid stage) · L2 After Every Paid Turn (record, spend and refund check, publish, re-probe every table, member tests, sends done; Send gate: proved live, 2 fresh sign-ins) |
| M08 Stage 7 · Launch | 7 | L1 Sales Page, Domain And Funnels (sales page, DNS and domain in plain words, ClickFunnels funnels, plan carried from the landing page, reseller never free) · L2 The Launch Walk And Boosts (leak test every table, launch walk desktop and phone, user-switch test, checkout test, support route, Launch gate, weekly boost as PROPOSED) |
| M09 Stage 8 · Operate | 8 | L1 Watching Every Day (daily leak probe 06:40 UK time, weekly security check, monitoring, engine jobs) · L2 The Money Line (monthly money line "in X out Y", Return rule R02, two losing months asks Retire) · L3 Rescue, Retire And Recycle (Trouble gate, Back to Operate, Retire, parts to Reserve, Recovery for killed ideas, re-imagine) |
| M10 Your First Idea | - | L1 Filling In Your First Idea Form (walk through Litterline as a worked example, then the learner's own idea) · L2 Where To Go Next (Vision 2029 illustrative picture; value ladder: course, idea form, app built, reseller plan never free, partner link TO CONFIRM; no income promises) |

When you finish, run `python3 -c "import json;json.load(open('<file>'))"` on each file and count narration words per lesson (must be 650-850). Fix before reporting. Report only: files written, words per lesson, any fact you were unsure of.
