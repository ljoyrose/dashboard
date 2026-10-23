// The ONE command for every course video (D6). Renders from ../glossary.json + scripts/<id>.json.
//   node video/render.mjs                 -> renders everything (hero, hero loop, still, every script)
//   node video/render.mjs M00-intro       -> one script
//   node video/render.mjs --brand ppp     -> the Puppy Classroom jacket (ljr7 | ppp | yours)
// Output: video/out/<track>/<id>-<brand>-v1.mp4 + .srt, plus the hero still PNG.
// Voice: drop video/voiceover/<id>.mp3 and re-run; it is mixed in automatically (narration slot).
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const G = JSON.parse(fs.readFileSync(path.join(ROOT, 'glossary.json'), 'utf8'));
const args = process.argv.slice(2);
const brand = args.includes('--brand') ? args[args.indexOf('--brand') + 1] : 'ljr7';
const only = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--brand');

// 1. icons -> generated JSON the bundle can import (no file reads in the browser)
const icons = {};
for (const f of fs.readdirSync(path.join(ROOT, 'design', 'icons')).filter((x) => x.endsWith('.svg'))) {
  const s = fs.readFileSync(path.join(ROOT, 'design', 'icons', f), 'utf8');
  icons[f.replace('.svg', '')] = s.replace(/[\s\S]*?<svg[^>]*>/, '').replace('</svg>', '').replace(/<path stroke="none"[^>]*\/>/, '').trim();
}
fs.writeFileSync(path.join(HERE, 'src', 'generated', 'icons.json'), JSON.stringify(icons));
fs.writeFileSync(path.join(HERE, 'src', 'generated', 'glossary.json'), JSON.stringify(G));
const kits = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'bricks-kits.json'), 'utf8'));
fs.writeFileSync(path.join(HERE, 'src', 'generated', 'kits.json'), JSON.stringify(kits));

function chrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const base = '/opt/pw-browsers';
  if (!fs.existsSync(base)) return undefined;
  const d = fs.readdirSync(base).filter((x) => x.startsWith('chromium_headless_shell-')).sort().reverse()[0];
  return d ? path.join(base, d, 'chrome-linux', 'headless_shell') : undefined;
}

const srtTime = (t) => { const ms = Math.round(t * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, r = ms % 1000; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(r).padStart(3, '0')}`; };

const scripts = fs.readdirSync(path.join(HERE, 'scripts')).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(HERE, 'scripts', f), 'utf8')));
const HERO_S = G.video.hero_seconds;
const jobs = [];
if (!only.length || only.includes('hero')) jobs.push({ id: 'AF-HERO', comp: 'Hero', props: {}, track: 'Shared', captions: G.video.hero_captions });
if (!only.length || only.includes('hero-loop')) jobs.push({ id: 'AF-HERO-LOOP', comp: 'HeroLoop', props: {}, track: 'Shared', captions: [] });
for (const sc of scripts) if (!only.length || only.includes(sc.id)) jobs.push({ id: sc.id, comp: 'Lesson', props: { script: sc }, track: sc.track === 'B' ? 'Track B' : 'Track F', script: sc });

const serveUrl = await bundle({ entryPoint: path.join(HERE, 'src', 'index.tsx'), publicDir: path.join(ROOT, 'assets') });
for (const j of jobs) {
  const voice = path.join(HERE, 'voiceover', `${j.id}.mp3`);
  const inputProps = { ...j.props, brand, voice: fs.existsSync(voice) ? `voiceover/${j.id}.mp3` : null };
  const composition = await selectComposition({ serveUrl, id: j.comp, inputProps, browserExecutable: chrome() });
  const dir = path.join(HERE, 'out', j.track);
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `${j.id}-${brand.toUpperCase()}-v1.mp4`);
  await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: out, inputProps, browserExecutable: chrome(), concurrency: 2 });
  // captions (.srt) from the same words
  let cues = [];
  if (j.script) {
    let t = j.script.hero_first ? HERO_S : 0;
    if (j.script.hero_first) G.video.hero_captions.forEach((c) => cues.push([c.from, c.to, c.text]));
    for (const s of j.script.scenes) { cues.push([t, t + s.s, s.caption]); t += s.s; }
  } else cues = (j.captions || []).map((c) => [c.from, c.to, c.text]);
  if (cues.length) fs.writeFileSync(out.replace('.mp4', '.srt'), cues.map((c, i) => `${i + 1}\n${srtTime(c[0])} --> ${srtTime(c[1])}\n${c[2]}\n`).join('\n'));
  fs.writeFileSync(path.join(dir, 'SOURCE.txt'), `Footer date on every frame and still: ${G.brand.course_date}\nEditable source: course/video/src/index.tsx + course/glossary.json + course/video/scripts/*.json\nRe-render: node course/video/render.mjs [id] [--brand ljr7|ppp|yours]\n`);
  console.log('video', out);
  if (j.comp === 'Hero') {
    const still = path.join(dir, `AF-HERO-STILL-${brand.toUpperCase()}-v1.png`);
    await renderStill({ composition, serveUrl, output: still, frame: Math.round(HERO_S * 30) - 20, inputProps, browserExecutable: chrome() });
    console.log('still', still);
  }
}
