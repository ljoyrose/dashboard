// Draws fake min/max thermometer screens as grey pixels, for testing the reader without any photo.
// Layout like the kennel units: big current reading on the left, MAX top right, MIN bottom right.
const SEG = { // segment boxes in a 10 x 18 digit cell: [x0, y0, x1, y1]
  a: [1.5, 0, 8.5, 1.6], b: [8.4, 1.2, 10, 8.6], c: [8.4, 9.4, 10, 16.8], d: [1.5, 16.4, 8.5, 18],
  e: [0, 9.4, 1.6, 16.8], f: [0, 1.2, 1.6, 8.6], g: [1.5, 8.2, 8.5, 9.8]
};
const DIGIT = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g' };

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function screen({ max, min, now = '20.1', W = 480, H = 300, slant = 0.12, ink = 40, paper = 190, glare = 40, noise = 10, seed = 1, labels = true, bezel = true, invert = false }) {
  const R = rng(seed), img = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) img[y * W + x] = paper - glare * (x / W) + glare * 0.5 * (y / H);
  const fill = (x0, y0, x1, y1, v, sl, yb) => {
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(H, Math.ceil(y1)); y++) {
      const dx = sl * (yb - y);
      for (let x = Math.max(0, Math.floor(x0 + dx)); x < Math.min(W, Math.ceil(x1 + dx)); x++) img[y * W + x] = v;
    }
  };
  const number = (text, x, y, size) => {
    const k = size / 18, cellW = 10 * k, gap = 3.2 * k, yb = y + size;
    let cx = x;
    for (const ch of text) {
      if (ch === '.') { fill(cx - gap * 0.5 - 0.9 * k, yb - 1.8 * k, cx - gap * 0.5 + 0.9 * k, yb, ink, 0, yb); continue; }
      if (ch === '1') { // the "1" sits on the right side of its cell
        for (const s of 'bc') { const [a0, b0, a1, b1] = SEG[s]; fill(cx + a0 * k, y + b0 * k, cx + a1 * k, y + b1 * k, ink, slant, yb); }
        cx += cellW + gap; continue;
      }
      for (const s of DIGIT[ch] || '') { const [a0, b0, a1, b1] = SEG[s]; fill(cx + a0 * k, y + b0 * k, cx + a1 * k, y + b1 * k, ink, slant, yb); }
      cx += cellW + gap;
    }
  };
  if (bezel) { fill(0, 0, W, 6, 20, 0, 0); fill(0, H - 6, W, H, 20, 0, 0); fill(0, 0, 6, H, 20, 0, 0); fill(W - 6, 0, W, H, 20, 0, 0); }
  number(now, W * 0.04, H * 0.32, H * 0.3);
  if (labels) { // "MAX" / "MIN" as small marks to the left of each number
    for (const yy of [H * 0.1, H * 0.58]) for (let i = 0; i < 3; i++) fill(W * 0.52 + i * 8, yy, W * 0.52 + i * 8 + 5, yy + 9, ink, 0, 0);
    fill(W * 0.93, H * 0.12, W * 0.95, H * 0.15, ink, 0, 0); // degree sign
  }
  number(max, W * 0.58, H * 0.14, H * 0.22);
  number(min, W * 0.58, H * 0.62, H * 0.22);
  const g = new Uint8Array(W * H);
  for (let i = 0; i < g.length; i++) { let v = img[i] + (R() - 0.5) * 2 * noise; if (invert) v = 255 - v; g[i] = Math.max(0, Math.min(255, Math.round(v))); }
  return { g, W, H };
}
