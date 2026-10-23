// App Factory course videos (Remotion). Everything visible comes from ../../glossary.json (copied to
// generated/ by render.mjs) and the scene scripts in ../scripts. Brand jackets (ljr7, ppp, yours) are a prop:
// one master video per lesson, the jacket applied at render time (D8). Silent with captions (D3); a voice
// file in video/voiceover/<id>.mp3 is mixed in automatically (narration slot).
import React from 'react';
import { registerRoot, Composition, AbsoluteFill, Sequence, Audio, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';
import G from './generated/glossary.json';
import ICONS from './generated/icons.json';
import KITS from './generated/kits.json';

const C = G.colours;
const FPS = 30;
const FACE = `@font-face{font-family:Lexend;font-weight:400;src:url('${staticFile('fonts/Lexend-400.ttf')}')}@font-face{font-family:Lexend;font-weight:600;src:url('${staticFile('fonts/Lexend-600.ttf')}')}@font-face{font-family:Lexend;font-weight:700;src:url('${staticFile('fonts/Lexend-700.ttf')}')}`;
type Brand = { name: string; long_name: string; accent: string };
const brandOf = (k: string): Brand => (G.brands as any)[k] || G.brands.ljr7;

const Icon: React.FC<{ name: string; size?: number; colour?: string; stroke?: number; style?: React.CSSProperties }> = ({ name, size = 48, colour = C.ink, stroke = 1.75, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colour} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style}
    dangerouslySetInnerHTML={{ __html: (ICONS as any)[name] || '' }} />
);

const Card: React.FC<{ x?: number; y?: number; w: number; h: number; accent?: string; style?: React.CSSProperties; children?: React.ReactNode }> = ({ x, y, w, h, accent, style, children }) => (
  <div style={{ position: x === undefined ? 'relative' : 'absolute', left: x, top: y, width: w, height: h, background: C.card, border: `1px solid ${C.border}`, borderRadius: 48, boxShadow: '0 3px 12px rgba(44,44,42,0.08)', overflow: 'hidden', ...style }}>
    {accent ? <div style={{ height: 12, background: accent }} /> : null}
    {children}
  </div>
);

const Chip: React.FC<{ label: string; icon?: string; colour?: string; size?: number; style?: React.CSSProperties }> = ({ label, icon, colour = C.ink, size = 28, style }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, height: size * 1.7, padding: `0 ${size * 0.6}px`, borderRadius: 999, background: C.card, border: `1px solid ${C.border}`, fontWeight: 600, fontSize: size, color: colour, ...style }}>
    {icon ? <Icon name={icon} size={size * 1.05} colour={colour} /> : null}{label}
  </div>
);

// Frame shared by every video: page colour, Vision chip when forward-looking, caption card, dark footer band with date.
const Frame: React.FC<{ brand: Brand; module: string; caption?: string; vision?: boolean; children?: React.ReactNode }> = ({ brand, module, caption, vision, children }) => {
  const f = useCurrentFrame();
  const capIn = interpolate(f, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: C.page, fontFamily: 'Lexend', color: C.ink }}>
      <style>{FACE}</style>
      {children}
      {vision ? <div style={{ position: 'absolute', top: 48, right: 96 }}><Chip label={G.brand.vision_label} icon="sparkles" size={26} /></div> : null}
      {caption ? (
        <div style={{ position: 'absolute', left: 96, right: 96, bottom: 120, display: 'flex', justifyContent: 'center', opacity: capIn }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 36, padding: '18px 36px', fontSize: 40, fontWeight: 600, textAlign: 'center', maxWidth: 1500, boxShadow: '0 3px 12px rgba(44,44,42,0.08)' }}>{caption}</div>
        </div>
      ) : null}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 84, background: C.ink, color: C.footer_text, display: 'flex', alignItems: 'center', padding: '0 96px', gap: 28, fontSize: 24 }}>
        <b style={{ fontSize: 26 }}>{G.brand.course_date}</b><span>{module}</span><span style={{ marginLeft: 'auto', fontWeight: 600 }}>{brand.long_name}</span>
      </div>
    </AbsoluteFill>
  );
};

// ---------- HERO: codes light up, bricks fly into kits, tables assemble, prompts write, tests tick, app goes live ----------
const sp = (f: number, start: number, cfg = {}) => spring({ frame: f - start, fps: FPS, config: { damping: 18, stiffness: 120, ...cfg } });

const Trail: React.FC<{ x1: number; y1: number; x2: number; y2: number; t: number }> = ({ x1, y1, x2, y2, t }) => {
  const k = Math.max(0, Math.min(1, t));
  return (
    <svg style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} width={1920} height={1080}>
      <line x1={x1} y1={y1} x2={x1 + (x2 - x1) * k} y2={y1 + (y2 - y1) * k} stroke={C.muted} strokeOpacity={0.35} strokeWidth={2} strokeDasharray="6 10" />
      <circle cx={x1 + (x2 - x1) * k} cy={y1 + (y2 - y1) * k} r={6} fill={C.muted} fillOpacity={k < 1 ? 0.6 : 0} />
    </svg>
  );
};

const CodesScene: React.FC = () => {
  const f = useCurrentFrame();
  const codes = G.codes as any[];
  const app = (G.sample_apps as any).litterline;
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 96, top: 64, fontSize: 64, fontWeight: 700 }}>20 Answers</div>
      <div style={{ position: 'absolute', left: 96, top: 150, fontSize: 32, color: C.muted }}>{app.name} · {app.what}</div>
      <div style={{ position: 'absolute', left: 96, top: 230, width: 1740, display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        {codes.map((c, i) => {
          const on = sp(f, 6 + i * 5);
          const ring = (C.rings as any)[String(c.group)];
          return (
            <div key={c.code} style={{ width: 330, height: 116, borderRadius: 36, background: C.card, border: `1px solid ${C.border}`, overflow: 'hidden', opacity: 0.25 + 0.75 * on, transform: `scale(${0.92 + 0.08 * on})`, boxShadow: on > 0.5 ? `0 0 ${24 * on}px rgba(190,106,93,${0.25 * on})` : 'none' }}>
              <div style={{ height: 12, background: ring, opacity: on }} />
              <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <span style={{ fontSize: 40, fontWeight: 700 }}>{c.code}{on > 0.6 ? app.codes[c.code] : ''}</span>
                <span style={{ fontSize: 22, color: C.muted }}>(0-{c.max})</span>
              </div>
              <div style={{ padding: '0 24px', fontSize: 22, color: C.muted }}>{c.what}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const BricksScene: React.FC = () => {
  const f = useCurrentFrame();
  const kitIds = (G.sample_apps as any).litterline.kits as string[];
  const kits = (KITS as any).kits.filter((k: any) => kitIds.includes(k.id));
  const shelfOf: Record<string, string> = {};
  (KITS as any).bricks.forEach((b: any) => (shelfOf[b.id] = b.shelf));
  let n = 0;
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 96, top: 64, fontSize: 64, fontWeight: 700 }}>Bricks Snap Into Kits</div>
      <div style={{ position: 'absolute', left: 96, top: 150, fontSize: 32, color: C.muted }}>101 Bricks · 8 Shelves · Kits K00-K08</div>
      {kits.map((k: any, ci: number) => {
        const x = 96 + ci * 440;
        return (
          <div key={k.id} style={{ position: 'absolute', left: x, top: 230, width: 410 }}>
            <div style={{ fontSize: 30, fontWeight: 700, marginBottom: 12 }}>{k.id} · {k.name.replace(/\b\w/g, (m: string) => m.toUpperCase())}</div>
            {k.mandatory.map((b: string, bi: number) => {
              const i = n++;
              const t = sp(f, 4 + i * 4, { damping: 14 });
              const fromX = (i % 2 ? 1 : -1) * 700, fromY = -300 + (i % 3) * 200;
              const shelf = shelfOf[b] || 'Body';
              return (
                <div key={b} style={{ height: 62, marginBottom: 10, borderRadius: 36, background: C.card, border: `1px solid ${C.border}`, overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 14, padding: '0 20px', transform: `translate(${fromX * (1 - t)}px, ${fromY * (1 - t)}px)`, opacity: Math.min(1, t * 1.5), boxShadow: '0 3px 12px rgba(44,44,42,0.08)', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 12, background: (C.layers as any)[shelf] }} />
                  <span style={{ marginLeft: 12, fontSize: 26, fontWeight: 600 }}>{b.replace('BR-', '').replace(/-/g, ' ').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase())}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 22, color: C.muted }}>{shelf}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const TablesScene: React.FC = () => {
  const f = useCurrentFrame();
  const tables = [
    { name: 'subject', cols: ['id', 'tenant_id', 'name', 'born_on', 'sire_id', 'dam_id'] },
    { name: 'health_records', cols: ['id', 'tenant_id', 'subject_id', 'kind', 'date', 'result'] },
    { name: 'breeding_events', cols: ['id', 'tenant_id', 'subject_id', 'event', 'date', 'note'] },
  ];
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 96, top: 64, fontSize: 64, fontWeight: 700 }}>Tables Build Themselves</div>
      <div style={{ position: 'absolute', left: 96, top: 150, fontSize: 32, color: C.muted }}>Kit K06 Tables · Every Row Carries Its Business (tenant_id)</div>
      {tables.map((t, ti) => {
        const x = 96 + ti * 590;
        const head = sp(f, ti * 14);
        return (
          <div key={t.name} style={{ position: 'absolute', left: x, top: 240, width: 550, opacity: head, transform: `translateY(${30 * (1 - head)}px)` }}>
            <Card w={550} h={560}>
              <div style={{ padding: '24px 28px', fontSize: 32, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>{t.name}</div>
              {t.cols.map((c, ci) => {
                const on = sp(f, ti * 14 + 10 + ci * 6);
                return (
                  <div key={c} style={{ padding: '14px 28px', fontSize: 26, display: 'flex', gap: 12, alignItems: 'center', opacity: on, transform: `translateX(${-40 * (1 - on)}px)`, borderBottom: `1px solid ${C.border}`, fontWeight: c === 'tenant_id' ? 700 : 400 }}>
                    <Icon name={c === 'tenant_id' ? 'wall' : 'table'} size={28} colour={c === 'tenant_id' ? C.layers.Boundaries : C.muted} />{c}
                  </div>
                );
              })}
            </Card>
            {ti < 2 ? <Trail x1={550} y1={300} x2={590} y2={300} t={interpolate(f, [ti * 14 + 40, ti * 14 + 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} /> : null}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const PromptScene: React.FC = () => {
  const f = useCurrentFrame();
  const text = 'Build one surface: the Litter Register. Use only the subject and breeding_events tables. Every read and write is scoped to the signed-in member\'s business (W1 Brand Wall). Test after: a member of Brand A cannot see Brand B. Rollback: restore the last export.';
  const shown = text.slice(0, Math.floor(interpolate(f, [6, 120], [0, text.length], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })));
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 96, top: 64, fontSize: 64, fontWeight: 700 }}>Prompts Write Themselves</div>
      <div style={{ position: 'absolute', left: 96, top: 150, fontSize: 32, color: C.muted }}>One Surface Per Prompt · Each Carries Its Test And A Rollback</div>
      <Card x={96} y={240} w={1728} h={480}>
        <div style={{ padding: '32px 40px', display: 'flex', gap: 20 }}>
          <Icon name="message-code" size={56} />
          <div style={{ fontSize: 38, lineHeight: 1.45, fontWeight: 400 }}>{shown}<span style={{ opacity: Math.floor(f / 8) % 2 ? 1 : 0 }}>|</span></div>
        </div>
      </Card>
    </AbsoluteFill>
  );
};

const TestsScene: React.FC = () => {
  const f = useCurrentFrame();
  const tests = ['Signed-Out Read Returns 401', 'Brand A Cannot See Brand B', 'Member Cannot See Another Member', 'New Member Does The Core Action', 'Owner Sees Every Brand', 'Leak Probe: Every Table'];
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 96, top: 64, fontSize: 64, fontWeight: 700 }}>Every Test Passes</div>
      <div style={{ position: 'absolute', left: 96, top: 150, fontSize: 32, color: C.muted }}>Tested From Outside, After Every Paid Step</div>
      <div style={{ position: 'absolute', left: 96, top: 240, width: 1728, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {tests.map((t, i) => {
          const on = sp(f, 8 + i * 12);
          return (
            <div key={t} style={{ height: 120, borderRadius: 36, background: C.card, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 20, padding: '0 32px', fontSize: 32, fontWeight: 600 }}>
              <div style={{ transform: `scale(${on})` }}><Icon name="circle-check" size={52} colour={C.status.solid} stroke={2} /></div>
              <span style={{ flex: 1 }}>{t}</span>
              <span style={{ color: C.status.solid, opacity: on }}>Solid</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const LiveScene: React.FC<{ brand: Brand }> = ({ brand }) => {
  const f = useCurrentFrame();
  const n = Math.round(interpolate(f, [20, 60], [G.vision2029.live_apps - 1, G.vision2029.live_apps], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  const pop = sp(f, 30);
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 96, top: 64, fontSize: 64, fontWeight: 700 }}>Live On The Dashboard</div>
      <div style={{ position: 'absolute', left: 96, top: 150, fontSize: 32, color: C.muted }}>{brand.long_name} · Factory Pulse</div>
      <div style={{ position: 'absolute', left: 96, top: 240, display: 'flex', gap: 24 }}>
        {[['Live Apps', n.toLocaleString('en-GB'), 'radar'], ['Leak Probe', G.vision2029.leak_probe, 'shield-check'], ['Decide Queue', `${G.vision2029.decide_open} of ${G.vision2029.decide_cap}`, 'user']].map(([l, v, ic]) => (
          <Card key={l} w={540} h={230}><div style={{ padding: '28px 36px' }}><div style={{ fontSize: 26, color: C.muted, display: 'flex', gap: 10, alignItems: 'center' }}><Icon name={ic} size={30} colour={C.muted} />{l}</div><div style={{ fontSize: 72, fontWeight: 700, color: ic === 'shield-check' ? C.status.solid : C.ink }}>{v}</div></div></Card>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 96, top: 520, transform: `scale(${0.9 + 0.1 * pop})`, opacity: pop, transformOrigin: 'left center' }}>
        <Card w={1728} h={150}><div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '40px 40px' }}><Icon name="rocket" size={64} /><span style={{ fontSize: 48, fontWeight: 700 }}>Litterline</span><span style={{ fontSize: 30, color: C.muted }}>Licence And Records Hub For Dog Breeders</span><span style={{ marginLeft: 'auto' }}><Chip label="Live" icon="circle-check" colour={C.status.solid} size={30} /></span></div></Card>
      </div>
    </AbsoluteFill>
  );
};

const HERO_SCENES = [[0, 5, CodesScene], [5, 11, BricksScene], [11, 17, TablesScene], [17, 22, PromptScene], [22, 26, TestsScene], [26, 30, LiveScene]] as const;

const HeroBody: React.FC<{ brand: Brand; captions?: boolean }> = ({ brand, captions = true }) => (
  <>
    {HERO_SCENES.map(([a, b, Comp], i) => {
      const cap = (G.video.hero_captions as any[])[i];
      return (
        <Sequence key={i} from={a * FPS} durationInFrames={(b - a) * FPS}>
          <Frame brand={brand} module="App Factory · Hero · v1" caption={captions ? cap.text : undefined} vision>
            <Fade dur={(b - a) * FPS}><Comp brand={brand} /></Fade>
          </Frame>
        </Sequence>
      );
    })}
  </>
);

const Fade: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 8, dur - 8, dur], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

const Hero: React.FC<{ brand: string; voice?: string | null }> = ({ brand, voice }) => (
  <AbsoluteFill>{voice ? <Audio src={staticFile(voice)} /> : null}<HeroBody brand={brandOf(brand)} /></AbsoluteFill>
);

// 8 s loop: bricks scene then tests scene, silent, no captions (for sales page and thumbnails)
const HeroLoop: React.FC<{ brand: string }> = ({ brand }) => (
  <AbsoluteFill>
    <Sequence from={0} durationInFrames={4 * FPS}><Frame brand={brandOf(brand)} module="App Factory · Hero Loop · v1" vision><Fade dur={4 * FPS}><BricksScene /></Fade></Frame></Sequence>
    <Sequence from={4 * FPS} durationInFrames={4 * FPS}><Frame brand={brandOf(brand)} module="App Factory · Hero Loop · v1" vision><Fade dur={4 * FPS}><TestsScene /></Fade></Frame></Sequence>
  </AbsoluteFill>
);

// ---------- LESSON: scenes from scripts/<id>.json ----------
const STAGE_ROW: React.FC<{ f: number; highlightGates?: boolean; people?: boolean }> = ({ f, highlightGates, people }) => (
  <div style={{ position: 'absolute', left: 96, top: 330, width: 1728, display: 'flex', gap: 12 }}>
    {(G.stages as any[]).map((s, i) => {
      const on = sp(f, i * 4);
      const g = (G.gates as any[]).find((x) => x.from === s.n);
      return (
        <div key={s.n} style={{ flex: 1, opacity: on, transform: `translateY(${30 * (1 - on)}px)` }}>
          <div style={{ height: 220, borderRadius: 36, background: C.card, border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <span style={{ fontSize: 24, color: C.muted, fontWeight: 700 }}>{s.n}</span><Icon name={s.icon} size={52} /><span style={{ fontSize: 24, fontWeight: 700 }}>{s.name}</span>
          </div>
          {g && (highlightGates || people) ? (
            <div style={{ marginTop: 16, textAlign: 'center', fontSize: 22, fontWeight: 600, color: g.human ? C.ink : C.muted, opacity: sp(f, 30 + i * 4) }}>
              <Icon name={people ? (g.human ? 'user' : 'robot') : g.icon} size={28} colour={g.human ? C.ink : C.muted} /><div>{g.name}</div>
            </div>
          ) : null}
        </div>
      );
    })}
  </div>
);

const LessonVisual: React.FC<{ v: string; icon: string }> = ({ v, icon }) => {
  const f = useCurrentFrame();
  const pop = sp(f, 4);
  if (v === 'road') return <STAGE_ROW f={f} />;
  if (v === 'gates') return <STAGE_ROW f={f} highlightGates />;
  if (v === 'person') return <STAGE_ROW f={f} people />;
  if (v === 'rooms') {
    const rooms = (G.rooms as any).list;
    return <div style={{ position: 'absolute', left: 96, top: 330, width: 1728, display: 'flex', flexWrap: 'wrap', gap: 20 }}>{rooms.map((r: any, i: number) => <div key={r.name} style={{ opacity: sp(f, i * 4) }}><Chip label={r.name} icon="building-warehouse" size={34} /></div>)}</div>;
  }
  if (v === 'parts') {
    const parts = [['layout-dashboard', 'Screens'], ['table', 'Tables'], ['gavel', 'Rules'], ['users', 'People']];
    return <div style={{ position: 'absolute', left: 96, top: 330, width: 1728, display: 'flex', gap: 32 }}>{parts.map(([ic, l], i) => <div key={l} style={{ flex: 1, opacity: sp(f, i * 6), transform: `scale(${0.9 + 0.1 * sp(f, i * 6)})` }}><Card w={408} h={300}><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, paddingTop: 60 }}><Icon name={ic} size={96} /><span style={{ fontSize: 40, fontWeight: 700 }}>{l}</span></div></Card></div>)}</div>;
  }
  if (v === 'bricks') {
    const shelves = G.shelves as any[];
    return <div style={{ position: 'absolute', left: 96, top: 320, width: 1728, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>{shelves.map((s, i) => <div key={s.name} style={{ opacity: sp(f, i * 4), transform: `translateY(${40 * (1 - sp(f, i * 4))}px)` }}><Card w={417} h={150} accent={(C.layers as any)[s.name]}><div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '28px 28px' }}><Icon name={s.icon} size={52} /><span style={{ fontSize: 34, fontWeight: 700 }}>{s.name}</span></div></Card></div>)}</div>;
  }
  if (v === 'walls') {
    const walls = Object.entries(G.walls as any) as [string, string][];
    return <div style={{ position: 'absolute', left: 96, top: 320, width: 1728, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>{walls.map(([k, n], i) => <div key={k} style={{ opacity: sp(f, i * 4) }}><Card w={417} h={150} accent={C.layers.Boundaries}><div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '28px 28px' }}><Icon name="wall" size={44} /><span style={{ fontSize: 30, fontWeight: 700 }}>{k} {n}</span></div></Card></div>)}</div>;
  }
  // title, handmade, recap and default: one big icon
  return <div style={{ position: 'absolute', left: 0, right: 0, top: 320, display: 'flex', justifyContent: 'center', opacity: pop, transform: `scale(${0.85 + 0.15 * pop})` }}><Icon name={icon} size={300} /></div>;
};

const Lesson: React.FC<{ script: any; brand: string; voice?: string | null }> = ({ script, brand, voice }) => {
  const b = brandOf(brand);
  const heroF = script.hero_first ? G.video.hero_seconds * FPS : 0;
  let t = heroF;
  return (
    <AbsoluteFill style={{ background: C.page }}>
      {voice ? <Audio src={staticFile(voice)} /> : null}
      {script.hero_first ? <Sequence from={0} durationInFrames={heroF}><HeroBody brand={b} /></Sequence> : null}
      {script.scenes.map((s: any, i: number) => {
        const from = t;
        t += s.s * FPS;
        return (
          <Sequence key={i} from={from} durationInFrames={s.s * FPS}>
            <Frame brand={b} module={`${script.module} · ${script.title} · v1`} caption={s.caption} vision={!!s.vision}>
              <Fade dur={s.s * FPS}>
                <div style={{ position: 'absolute', left: 96, top: 72, display: 'flex', alignItems: 'center', gap: 24 }}><Icon name={s.icon} size={72} /><span style={{ fontSize: 72, fontWeight: 700 }}>{s.screen}</span></div>
                <div style={{ position: 'absolute', left: 96, right: 96, top: 196, height: 2, background: C.ink }} />
                <LessonVisual v={s.visual} icon={s.icon} />
              </Fade>
            </Frame>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

const lessonFrames = (p: any) => ((p.script?.hero_first ? G.video.hero_seconds : 0) + (p.script?.scenes || []).reduce((a: number, s: any) => a + s.s, 0)) * FPS || FPS;

const Root: React.FC = () => (
  <>
    <Composition id="Hero" component={Hero as any} durationInFrames={G.video.hero_seconds * FPS} fps={FPS} width={1920} height={1080} defaultProps={{ brand: 'ljr7', voice: null }} />
    <Composition id="HeroLoop" component={HeroLoop as any} durationInFrames={G.video.loop_seconds * FPS} fps={FPS} width={1920} height={1080} defaultProps={{ brand: 'ljr7' }} />
    <Composition id="Lesson" component={Lesson as any} durationInFrames={FPS} fps={FPS} width={1920} height={1080} defaultProps={{ script: { scenes: [] }, brand: 'ljr7', voice: null }}
      calculateMetadata={({ props }) => ({ durationInFrames: lessonFrames(props) })} />
  </>
);
registerRoot(Root);
