# LJR7 Course Design System (v1, 23 Oct 2026)
One file holds every name, hex and number: `course/glossary.json`. Everything below is generated from it.

## Parts
| Part | Where | Rule |
|---|---|---|
| Page | cream `page` | Warm off-white, never white |
| Card | `build/lj.py card()` / `deck.py Parts.card` | White, 1 px `border`, radius 16 pt, soft shadow, colour only as a 4 pt top band |
| Header | `header()` / `frame()` | Dark title + one muted line + thin dark rule. No coloured band |
| Footer | `footer()` | Dark band: date bold, module and version, small source line |
| Key | `key_block()` / `key_row()` | Every symbol explained, just above the footer |
| Chip | `chip()` | Neutral pill; wall chips (W4) are plain |
| Status | `status_chip()` | Colour + icon + word: Solid, Fragile, Not Built, Not Needed |
| Attention | `attention()` | Sunk tint, dark left edge, only the risk word coloured |
| Icons | `design/icons/*.svg` | Tabler outline (MIT), same set as the live dashboard, stroke 1.75 |
| Vision chip | `vision_chip()` | "Vision 2029 · Illustrative" on every forward-looking item |

## Colour jobs (Lisa, 23 Oct: both, by job)
- **Brick-layer hexes:** bricks, shelves, walls, codes graphics, slides.
- **Palette A Clear:** dashboard mockups and sample app screens only.

## Spacing
ADHD-Layout-Standards: 4 / 8 / 12 / 16 / 24 / 32. Canvases are drawn at 3x, so the values on a 1080 graphic or 1920 slide are 12 / 24 / 36 / 48 / 72 / 96.

## Type
Lexend only (files in `assets/fonts`). Graphic 1080: title 72, group 48, name 46, body 30, nothing under 22. Slide 1920: title 84, statement 72, body 40, nothing under 22 (footer source line).

## Build
- `python build/g_road.py` and similar draw a graphic → `node build/shoot.mjs file.svg` → PNG
- `python build/deck.py decks/<deck>.json [--brand ppp]` → SVG, PNG, PPTX, PDF
- `python build/tokens.py` → `design/tokens.css`
- `bash build.sh` runs everything
