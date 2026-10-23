# Stage 0 Proposal · App Factory Course
23 Oct 2026 · UK time · branch `course-2026-10-23` · folder `/course`

Read on a phone, top to bottom. One idea per block.

---

## 0. Right place?
- **Claude Code cloud is right for this job.** It's code-heavy: renderers, decks, Remotion video, checker. It saves in stages to the repo and runs while you're on your phone.
- **Cowork would be better at one thing:** editing inside Canva and writing to Drive in bulk. That's a short follow-up job, not the build.

## 1. Sources read
- **Read from Drive (works):** AF-UNDERSTANDING-2026-10-22.md, APP-FACTORY-FRAMEWORK.md, THE-STAGE-TRANSITIONS.md, GATES.csv, TEMPLATE-MIRROR.md (now 236 lines), AF-CARD-TEMPLATE.md, codes-catalogue.json, BRICK-REGISTRY.csv (v0.16, 101 bricks), BRICK-KITS.csv (v1.2, K00-K08), TENANCY-CLASSIFICATION-AND-ISOLATION-RULES.md, OBLIGATIONS.csv, the reseller-never-free SLIP, ClickFunnels-Platform-Reference.md, ClickFunnels ↔ OverSkill Integration, appsumo-products_2026-10-22.csv, LC-VISUAL-STANDARD.md, BRICK-LAYERS-AND-COLOUR-SPINE-2026-09-19.md, LJR7-COLOUR-AND-NUMBERING-SYSTEM.md, RR_KNOWLEDGE_ROSEQUEST.md, ROSEQUEST-THINK-MORE-2026-10-22.md.
- **Could not read:** the Google Form "AF · New idea" (type not supported). I used AF-CARD-TEMPLATE.md for its questions, as you said.
- **App Factory artefacts (claude.ai):** Atlas, Front Door, Stockroom, Factory Cockpit, Control Room, The Board, Document Bench, Base Finder, Hub Pattern, Per-App Board. Superseded ones are used for reference only. Rooms, bricks and code orders are pulled out as data.
- **Left out, as you asked:** Money Hub, CD Hub, Bloodline, BLD, Columbary.
- **Sources stay private.** They're kept in the session scratchpad, never in the repo. This repo is **public**.

## 2. Tools (each one checked working in this session)
| Job | Tool | Why |
|---|---|---|
| Graphics | Python draws SVG from `glossary.json` → PNG via headless Chromium | One look, one data file; SVG opens in Figma, Illustrator or Canva |
| Icons | Tabler line icons (same set as the live dashboard) | No emoji; matches the app |
| Slides | python-pptx (editable .pptx) + vector PDF | Opens in PowerPoint, Keynote, Google Slides, and imports into Canva |
| Video | Remotion 4 (React) + ffmpeg | One command re-renders from glossary + scripts (D6) |
| Dashboard 2029 | The REAL `/factory` page, filled with an invented 1,000-app state using the repo's own test harness | Built from the real thing (D11) |
| Workbook / ebook | HTML → PDF; pandoc → DOCX + EPUB | Kindle takes EPUB best |
| Canva | Connected (Puppy Classroom brand kit seen) | Can't import from a private file; see 4 |
| Font | Lexend (OFL), files kept in `course/assets/fonts` | Same render on any machine |

## 3. What I can and cannot make here
- **CAN:** every graphic, every deck, the dashboard and app screens, scripts, quizzes, the workbook PDF/DOCX/EPUB, the ClickFunnels lesson pack, and silent animated MP4s with captions (.srt).
- **CANNOT: voice.** Each video gets a narration slot and a script file.
  - Route 1 (Recommended): your assistant runs an AI voice (ElevenLabs or Krea text-to-speech) from `video/voiceover/*.txt`.
  - Route 2: you record in Descript from the same script.
- **CANNOT: filmed footage or AI-generated video.** Everything is animated from the course graphics.
- **CANNOT: upload to RoseQuest, or sign in anywhere.** MP4s are named and foldered ready for you to upload.
- **Udemy warning (you might not foresee this):** Udemy's quality review wants proper audio, at least 30 minutes of video and at least 5 lectures (Udemy community and production guide, 23 Oct 2026). **Silent videos will likely fail review.** Add voice before Udemy. TO CHECK against Udemy's official Course Quality Checklist.
- **Kindle:** EPUB is the preferred upload; DOCX is accepted. Use RGB images and keep them small. Test in Kindle Previewer before publishing.

## 4. Editable format per asset
| Asset | Editable source | Also |
|---|---|---|
| Graphic | `.svg` + its Python renderer + JSON data | `.png` 1080 wide |
| Slide deck | `.pptx` (native text and shapes) | `.pdf` |
| Canva copy | Drag the `.pptx` into Canva: 1 minute, fully editable | — |
| Video | Remotion project `course/video/src` + `glossary.json` + script `.json` | `.mp4`, `.srt`, voice-over `.txt` |
| Dashboard / app screens | `.html` + generator `.js` / `.py` | `.png` |
| Workbook | `.md` + `.html` | `.pdf`, `.docx`, `.epub` |
| CF lesson pack | `lessons.json` + per-lesson `.md` | `.csv` for copy-paste |

## 5. Graphics: reuse, re-render, new
**Reuse as they are (linked from Drive, never redrawn):**
- AF-WALLS-2026-10-22-v4.png
- atlas-MAIN-factory-map-road.png
- atlas-overview-factory-road.png
- atlas-stages.png
- atlas-floor-plan.png
- atlas-floor-plan-rooms-gates.png
- front-door.png
- factory-cockpit.png
- control-room.png
- AF-REDESIGN-2026-10-22.png

**Re-render with the existing renderer:**
- the 20 Codes card per sample app (SRC_render_codes_card.py, catalogue JSON). One JSON per fictional app, no new drawing code.
- AF-WALLS v5, if tonight's walls job lands. I'll check RUN-PROGRESS-WALLS.md.

**New, only where nothing exists (12):**
1. Factory Road, stages and gates
2. Idea Form flow: vision, who pays, pain → 20 codes → 3 kill questions → verdict and data role
3. Verdict and Data Role card
4. Shelves and Kits: 8 shelves, K00-K08
5. Tables Assemble, schema from codes
6. Test Identities and the Tenant Matrix
7. Leak Test explained, W walls
8. After Every Paid Turn, 6 steps
9. Launch Kit: sales page, domain, funnels, boosts
10. Operate Lap: probe, money line, rescue, retire, recycle
11. Fully Automated Flow Map, person icon only at gates (Vision 2029)
12. Value Ladder: course → app service → reseller → partner

**Colours (your call, 23 Oct):** brick-layer hexes for bricks, shelves, walls and codes. Palette A Clear for dashboard and app screens.

## 6. Modules (one master course, 3 cuts)
**Track F, Family Learners: 11 modules, 24 lessons, 5-8 min each (about 2.6 h)**
| Mod | Title | Lessons |
|---|---|---|
| M0 | What Is An App Factory | 2 |
| M1 | Stage 0 · Idea: The Idea Form, The 20 Codes, Kill Check And Verdict | 3 |
| M2 | Stage 1 · Research And The Merit Gate | 2 |
| M3 | Stage 2 · Base: Bricks, Shelves And Kits | 2 |
| M4 | Stage 3 · Features: Choosing Kits, Who Sees What, Lock | 2 |
| M5 | Stage 4 · Schema: How The System Makes The Tables | 2 |
| M6 | Stage 5 · Data: Test Identities, Leak And Tenant Tests | 2 |
| M7 | Stage 6 · Prompts: How Build Prompts Are Written And Proved | 2 |
| M8 | Stage 7 · Launch: Sales Page, Domain, Funnels, Boosts | 2 |
| M9 | Stage 8 · Operate: Probe, Money Line, Rescue, Retire, Recycle | 3 |
| M10 | Your First Idea | 2 |

**Track B, Business Talk:** 22-slide keynote, about 22 min, Perfect Webinar structure. Also a 10-slide partner-webinar cut and an Epiphany Bridge email.

**Reseller version:** the same course and deck with a brand jacket swap (LJR7 → Puppy Classroom → Your Brand Here). Tokens only.

## 7. Order, time and risk
Highest value first (D2). Commit after every deck, module and graphic set.
| Step | Output | Estimate |
|---|---|---|
| 1 | Design system + sample slide and graphic | 40 min |
| 2 | Keynote deck + partner cut + framework map | 60 min |
| 3 | Vision 2029 dashboard + D11 screens | 70 min |
| 4 | 11 module scripts + quizzes + recap cards | 90 min |
| 5 | New graphics (12) | 60 min |
| 6 | Sample apps × 3 (one in 2 brands) | 45 min |
| 7 | Track F decks | 40 min |
| 8 | Video: hero (30 s) + Intro pilot (90 s) + storyboards | 60 min |
| 9 | Workbook + CF pack + reseller jacket | 45 min |
| 10 | INDEX + checker + fixes | 30 min |

Usage: high (about 8-9 hours of agent time). If usage runs out, RUN-PROGRESS.md says exactly where to resume.

**Risks**
1. The repo is public, so the course is visible free on GitHub before you sell it (see Q1).
2. Udemy needs voice.
3. Gate and shelf names clash between files. All are listed in CLASHES.md, and the course follows the live engine set.
4. The client idea door is **not built** (checklist A7 FAIL). The course invites people to a form that doesn't exist yet (see Q3).

## 8. Questions
In `course/QUESTIONS.md`. Three, each with options and a Recommended one.

## 9. Onboarding video engine (D8)
Not built and not touched. No jacket files were found in the sources read. Course videos use the same idea: one master video per lesson, with brand jackets applied from `glossary.json` brands by the render script.
