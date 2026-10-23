# Course Videos (v1, 23 Oct 2026)
Every course video is a script, not an edit. They render from `course/glossary.json` (names, colours, numbers) and `course/video/scripts/*.json` (scenes and captions). Change a word or a colour, run one command, and every video re-renders. No agent needed (D6).

## The one command
From `course/` (first time only: `npm install`):

```
node video/render.mjs
```

- One video: `node video/render.mjs M00-intro` (or `hero`, `hero-loop`)
- Another brand jacket: `node video/render.mjs --brand ppp` (`ljr7`, `ppp` or `yours`)
- Live preview while editing: `npm run studio`

Output goes to `video/out/<Track>/<id>-<BRAND>-v1.mp4`, with a matching `.srt` caption file. The hero also writes a still PNG for thumbnails.

## What exists now
| Video | Length | Files |
|---|---|---|
| Hero ("factory intelligence") | 30 s | `out/Shared/AF-HERO-LJR7-v1.mp4` (+ PPP), `.srt`, still PNG |
| Hero loop (sales page) | 8 s | `out/Shared/AF-HERO-LOOP-LJR7-v1.mp4` |
| Intro pilot, Module M0 | 103 s (hero + 10 scenes) | `out/Track F/M00-intro-LJR7-v1.mp4` (+ PPP), `.srt` |
| The other 24 lessons | storyboards | `storyboards/<lesson>.md` + `voiceover/<lesson>.txt` |

To turn a storyboard into a video: copy `scripts/M00-intro.json`, fill in the scenes from the storyboard, save it as `scripts/<lesson-id>.json`, then run `node video/render.mjs <lesson-id>`.

## Voice (narration slot, D3)
The videos are silent with captions for now. To add a voice:
1. Record or generate the narration from `voiceover/<id>.txt`. Option A: an AI voice (ElevenLabs or Krea text-to-speech) run by Lisa's assistant. Option B: Lisa records in Descript.
2. Save it as `voiceover/<id>.mp3`. The hero is `AF-HERO.mp3`; the intro is `M00-intro.mp3`.
3. Run the command again. The voice is mixed in automatically. Nothing else changes.

**Udemy needs voice.** Its quality review expects proper audio, so silent videos will likely be refused (TO CHECK on Udemy's official checklist).

## Brand jackets (D8)
There is one master video per lesson. The brand jacket (name and footer owner) comes from `glossary.json` → `brands` and is applied at render time, never by re-editing. This is the same pattern as the separate onboarding-video "live coat" engine (ONBOARDING-ENGINE-AND-MEDIA-PROCESS.md), so the two can merge later. That engine was **not** built or changed here.

## Upload to RoseQuest (by Lisa; nothing was uploaded)
Folder: **Video Drive > App Factory > Course**, with one folder per track (`Track F`, `Track B`, `Shared`). Single videos do not inherit the collection settings, so set each video's own player (RR_KNOWLEDGE_ROSEQUEST.md, section 9):
1. **Branding OFF** on each video's own player. It is ON by default.
2. **No lead capture, email gate, share gate or quiz.**
3. **Accent colour per brand.** The app sets it (`data-skin-color`). Never change the colour on a live video, because that breaks embeds already placed.
4. Comments off, all controls on. Upload the `.srt` file and check the subtitles.
5. Autoplay on, start with sound if possible, and reset to the thumbnail at the end. Use the hero still as the thumbnail.
6. Save, then re-read the player in a fresh tab.
7. In any course page (ClickFunnels, Udemy, ebook), store **only provider + video id + type** (`v` single, `f` interactive). Never a URL or embed code. Course pages use a placeholder slot keyed by lesson id until the ids exist (see `cf-pack/lessons.json`).

## Look rules kept in every frame
Cream page, white cards with a 1 px border, Lexend, Tabler line icons, layer colours only for shelves and rings, a "Vision 2029 · Illustrative" chip on forward-looking frames, and a dark footer band with the date. No film characters, logos or copied assets.
