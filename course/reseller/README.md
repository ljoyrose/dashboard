# Reseller Version (v1, 23 Oct 2026)
The same course, decks, workbook and videos in another brand's jacket. **Made by swapping brand tokens only** (`glossary.json` → `brands`): name, long name, initials, accent and join link. Layout and wording never change (D8, rule 13).

## Worked example: Puppy Classroom (PPP)
| Asset | File |
|---|---|
| Keynote | `slides/AF-KEYNOTE/AF-KEYNOTE-PPP-v1.pptx` and `.pdf` |
| Partner webinar | `slides/AF-PARTNER-WEBINAR/AF-PARTNER-WEBINAR-PPP-v1.pptx` and `.pdf` |
| Track F Module M0 deck | `slides/AF-TRACKF-M00/AF-TRACKF-M00-PPP-v1.pptx` and `.pdf` |
| Workbook | `workbook/WORKBOOK-PPP-v1.pdf`, `.docx`, `.epub` |
| Hero and Intro videos | `video/out/Shared/AF-HERO-PPP-v1.mp4`, `video/out/Track F/M00-intro-PPP-v1.mp4` |
| White-label app screens | `apps/out/white-label-litterline.png` (LJR7, Puppy Classroom, Your Brand Here) |

## The rule to show every reseller
**A reseller brand is never on a Free plan.** The plan is chosen on the landing page and carried through sign-up, e.g. `/join/ppp?plan=plus-yearly`. The server checks that the plan belongs to that brand, refuses a free plan on a reseller brand, records the plan even if checkout is abandoned, and never takes the price from the web address (SLIP-2026-10-04-0630-DECISION-plan-carried-from-landing-page-reseller-never-free.md).

## Make a new reseller jacket ("your brand here")
1. Add a brand to `glossary.json` → `brands` (copy `yours`): name, long_name, initials, accent (a Palette A text colour), join_link, `free_plan_allowed: false`.
2. Run:
   - `python build/deck.py decks/keynote.json --brand <key>`
   - `python build/workbook.py <key>`
   - `node video/render.mjs --brand <key>`
3. Before using the keynote: slides 4-5 tell Lisa's founder story. A reseller replaces them with their own story, or keeps them as "the factory's founder". Speaker notes mark them TO CHECK.

## TO CHECK
- Puppy Classroom accent colour is a placeholder (#0271A4). Check it against the Puppy Classroom Canva brand kit.
- Join links for LJR7 and partner links are TO CONFIRM.
