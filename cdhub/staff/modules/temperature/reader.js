/*!
 * BLDTempReader - reads the MAX and MIN numbers off a min/max thermometer's LCD, on the phone.
 *
 * No outside service, no AI, no limit, free. It works on grey pixel numbers taken from ONE live camera frame at a
 * time; the caller throws the frame away straight after. Nothing here can store, encode or send a picture: it only
 * ever returns numbers as text.
 *
 * How it reads a seven-segment number:
 *   1. light the box evenly (local threshold), so shadows and glare do not count as ink;
 *   2. find the tallest line of ink in the box (the digits; small labels like MAX or C are shorter);
 *   3. undo the LCD's slant (try a few, keep the one where the strokes stand straightest);
 *   4. cut the line into characters at the gaps, and test each of the 7 segment places for a bar.
 * A result only counts when it looks like a temperature with 1 decimal place (e.g. 21.4, 9.8, -2.0) and is
 * between -30 and 60. Anything else is "not read": the person types it instead.
 *
 * Browser: window.BLDTempReader.  Node (tests): module.exports.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDTempReader = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // segments a b c d e f g  ->  digit
  var PATTERNS = {
    '1111110': '0', '0110000': '1', '1101101': '2', '1111001': '3', '0110011': '4',
    '1011011': '5', '1011111': '6', '1110000': '7', '1111111': '8', '1111011': '9'
    // no "variant" shapes: a digit with a segment missing (glare, a dead segment) is never guessed
  };
  var SHEARS = [-0.1, -0.05, 0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3];
  var LOW = -30, HIGH = 60, UNSURE = [0.35, 0.55];

  /** RGBA bytes -> grey bytes (one per pixel). */
  function toGray(rgba, w, h) {
    var g = new Uint8Array(w * h);
    for (var i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (rgba[j] * 77 + rgba[j + 1] * 150 + rgba[j + 2] * 29) >> 8;
    return g;
  }

  /** Copy one box (x, y, w, h in pixels) out of a grey image. */
  function crop(gray, W, H, r) {
    var x0 = Math.max(0, Math.round(r.x)), y0 = Math.max(0, Math.round(r.y));
    var w = Math.min(W - x0, Math.round(r.w)), h = Math.min(H - y0, Math.round(r.h));
    var out = new Uint8Array(Math.max(0, w * h));
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) out[y * w + x] = gray[(y0 + y) * W + x0 + x];
    return { g: out, w: w, h: h };
  }

  /**
   * Ink (1) or not (0). Sauvola local threshold with a window wider than a segment is thick, so a thick
   * segment's middle still counts as ink. invert=true reads light digits on a dark screen.
   */
  function binarise(g, w, h, invert) {
    var n = w * h, ii = new Float64Array((w + 1) * (h + 1)), i2 = new Float64Array((w + 1) * (h + 1));
    var x, y, v;
    for (y = 0; y < h; y++) {
      var rs = 0, rs2 = 0;
      for (x = 0; x < w; x++) {
        v = invert ? 255 - g[y * w + x] : g[y * w + x];
        rs += v; rs2 += v * v;
        ii[(y + 1) * (w + 1) + x + 1] = ii[y * (w + 1) + x + 1] + rs;
        i2[(y + 1) * (w + 1) + x + 1] = i2[y * (w + 1) + x + 1] + rs2;
      }
    }
    var gm = ii[n ? (h) * (w + 1) + w : 0] / Math.max(1, n);
    var gs = Math.sqrt(Math.max(0, i2[(h) * (w + 1) + w] / Math.max(1, n) - gm * gm));
    var rad = Math.max(6, Math.round(Math.min(w, h) * 0.35)), out = new Uint8Array(n);
    for (y = 0; y < h; y++) {
      var ya = Math.max(0, y - rad), yb = Math.min(h, y + rad + 1);
      for (x = 0; x < w; x++) {
        var xa = Math.max(0, x - rad), xb = Math.min(w, x + rad + 1), cnt = (yb - ya) * (xb - xa);
        var s = ii[yb * (w + 1) + xb] - ii[ya * (w + 1) + xb] - ii[yb * (w + 1) + xa] + ii[ya * (w + 1) + xa];
        var s2 = i2[yb * (w + 1) + xb] - i2[ya * (w + 1) + xb] - i2[yb * (w + 1) + xa] + i2[ya * (w + 1) + xa];
        var m = s / cnt, sd = Math.sqrt(Math.max(0, s2 / cnt - m * m));
        v = invert ? 255 - g[y * w + x] : g[y * w + x];
        var t = m * (1 + 0.2 * (sd / 128 - 1));
        out[y * w + x] = (v < t && v < gm + 0.25 * gs && (m - v) > Math.max(6, 0.15 * gs)) ? 1 : 0;
      }
    }
    return { b: out, contrast: gs };
  }

  /** Connected ink blobs (4-way). Drops dust and anything touching the box edge (bezel, shadow). */
  function blobs(b, w, h, cutOff) {
    var lab = new Int32Array(w * h), list = [], stack = [], minArea = Math.max(3, Math.round(w * h * 0.0004));
    for (var p = 0; p < b.length; p++) {
      if (!b[p] || lab[p]) continue;
      var id = list.length + 1, o = { x0: w, y0: h, x1: -1, y1: -1, n: 0, px: [], edge: false };
      lab[p] = id; stack.push(p);
      while (stack.length) {
        var q = stack.pop(), x = q % w, y = (q - x) / w;
        o.n++; o.px.push(q);
        if (x < o.x0) o.x0 = x; if (x > o.x1) o.x1 = x; if (y < o.y0) o.y0 = y; if (y > o.y1) o.y1 = y;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) o.edge = true;
        if (x > 0 && b[q - 1] && !lab[q - 1]) { lab[q - 1] = id; stack.push(q - 1); }
        if (x < w - 1 && b[q + 1] && !lab[q + 1]) { lab[q + 1] = id; stack.push(q + 1); }
        if (y > 0 && b[q - w] && !lab[q - w]) { lab[q - w] = id; stack.push(q - w); }
        if (y < h - 1 && b[q + w] && !lab[q + w]) { lab[q + w] = id; stack.push(q + w); }
      }
      list.push(o);
    }
    return list.filter(function (o) {
      var bw = o.x1 - o.x0 + 1, bh = o.y1 - o.y0 + 1;
      if (o.n < minArea) return false;                             // dust
      if (o.edge) { if (cutOff) cutOff.push(o); return false; }    // the screen's edge: the number must sit wholly inside the box
      if (bw > 4 * bh && bw > 0.35 * w) return false;              // a printed dividing line
      return true;
    });
  }

  /** Stack blobs that sit one above another into glyphs (a 1 is two separate bars), then group glyphs that
   *  share height into lines; return the line whose glyphs are tallest. */
  function tallestLine(list) {
    var glyphs = list.map(function (o) { return { x0: o.x0, x1: o.x1, y0: o.y0, y1: o.y1, items: [o] }; });
    function xov(A, B) { return Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0) + 1; }
    function yov(A, B) { return Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0) + 1; }
    function join(arr, test) {
      var again = true;
      while (again) {
        again = false;
        for (var i = 0; i < arr.length && !again; i++) for (var j = i + 1; j < arr.length && !again; j++) {
          if (test(arr[i], arr[j])) {
            var A = arr[i], B = arr[j];
            A.items = A.items.concat(B.items); A.x0 = Math.min(A.x0, B.x0); A.x1 = Math.max(A.x1, B.x1); A.y0 = Math.min(A.y0, B.y0); A.y1 = Math.max(A.y1, B.y1);
            arr.splice(j, 1); again = true;
          }
        }
      }
      return arr;
    }
    join(glyphs, function (A, B) {
      var gap = Math.max(A.y0, B.y0) - Math.min(A.y1, B.y1);
      return xov(A, B) >= 0.5 * Math.min(A.x1 - A.x0 + 1, B.x1 - B.x0 + 1) && gap < 0.35 * Math.max(A.y1 - A.y0 + 1, B.y1 - B.y0 + 1);
    });
    var lines = join(glyphs, function (A, B) { return yov(A, B) > 0.3 * Math.min(A.y1 - A.y0 + 1, B.y1 - B.y0 + 1); });
    // the line's height is set by its tallest glyph, so a label lying across two lines cannot win
    lines.forEach(function (L) { L.top = 0; L.items.forEach(function (o) { L.top = Math.max(L.top, o.y1 - o.y0 + 1); }); });
    lines.sort(function (a, b) { return (b.y1 - b.y0) - (a.y1 - a.y0); });
    return lines[0] || null;
  }

  /** The slant at which the strokes stand straightest (columns most concentrated). */
  function bestShear(px, w, yc) {
    var best = 0, bestScore = -Infinity;
    SHEARS.forEach(function (s) {
      var col = {}, score = 0;
      px.forEach(function (q) { var x = q % w, y = (q - x) / w, c = Math.round(x + s * (y - yc)); col[c] = (col[c] || 0) + 1; });
      // fewest columns with ink wins (strokes upright and gaps between digits open); ties go to tighter columns
      var used = Object.keys(col);
      used.forEach(function (k) { score += col[k] * col[k]; });
      score = -used.length * 1e9 + score;
      if (score > bestScore) { bestScore = score; best = s; }
    });
    return best;
  }

  /** Bar strength of one segment place: the best single row (or column) fill inside its zone. */
  function zone(grid, cw, chH, u0, u1, v0, v1, horiz) {
    var xa = Math.floor(u0 * cw), xb = Math.max(xa + 1, Math.ceil(u1 * cw)), ya = Math.floor(v0 * chH), yb = Math.max(ya + 1, Math.ceil(v1 * chH));
    var best = 0, x, y, c;
    if (horiz) {
      for (y = ya; y < yb; y++) { c = 0; for (x = xa; x < xb; x++) c += grid[y * cw + x] || 0; best = Math.max(best, c / (xb - xa)); }
    } else {
      for (x = xa; x < xb; x++) { c = 0; for (y = ya; y < yb; y++) c += grid[y * cw + x] || 0; best = Math.max(best, c / (yb - ya)); }
    }
    return best;
  }

  function classify(grid, cw, chH) {
    var z = [
      zone(grid, cw, chH, 0.25, 0.75, 0.0, 0.2, true),    // a
      zone(grid, cw, chH, 0.62, 1.0, 0.12, 0.45, false),  // b
      zone(grid, cw, chH, 0.62, 1.0, 0.55, 0.88, false),  // c
      zone(grid, cw, chH, 0.25, 0.75, 0.8, 1.0, true),    // d
      zone(grid, cw, chH, 0.0, 0.38, 0.55, 0.88, false),  // e
      zone(grid, cw, chH, 0.0, 0.38, 0.12, 0.45, false),  // f
      zone(grid, cw, chH, 0.25, 0.75, 0.38, 0.62, true)   // g
    ];
    var key = z.map(function (v) { return v > 0.5 ? '1' : '0'; }).join('');
    var sure = z.reduce(function (s, v) { return s + Math.abs(v - 0.5); }, 0) / 7;
    // a faint or half-lit segment is not guessed: a 0 with faint left side would otherwise read as a 7
    var unsure = z.some(function (v) { return v > UNSURE[0] && v < UNSURE[1]; });
    var d = PATTERNS[key];
    return { d: unsure || d === undefined || d === '' ? null : d, key: key, sure: sure, z: z };
  }

  /** Read the tallest number in one grey box. {ok, value, text, sure} or {ok:false, reason}. */
  function readBox(g, w, h, invert, dbg, opts) {
    dbg = dbg || {}; opts = opts || {};
    if (w < 16 || h < 12) return { ok: false, reason: 'too small' };
    var bin = binarise(g, w, h, invert);
    if (bin.contrast < 8) return { ok: false, reason: 'too dark or too flat' };
    var cutOff = [], line = tallestLine(blobs(bin.b, w, h, cutOff));
    if (!line) return { ok: false, reason: 'no digits seen' };
    var H = line.y1 - line.y0 + 1;
    dbg.line = { y0: line.y0, y1: line.y1, glyphs: line.items.map(function (o) { return [o.x0, o.y0, o.x1, o.y1]; }) };
    if (H < 10) return { ok: false, reason: 'digits too small: move closer' };
    // the decimal point: a small squarish dot sitting on the bottom of the line
    var dots = line.items.filter(function (o) {
      var bw = o.x1 - o.x0 + 1, bh = o.y1 - o.y0 + 1;
      return bh <= 0.22 * H && bw <= 0.22 * H && bw <= 2.2 * bh && bh <= 2.2 * bw && o.y1 >= line.y1 - 0.12 * H && o.n >= 0.4 * bw * bh;
    });
    var ink = line.items.filter(function (o) { return dots.indexOf(o) < 0; });
    var px = []; ink.forEach(function (o) { px = px.concat(o.px); });
    if (!px.length) return { ok: false, reason: 'no digits seen' };
    var yc = (line.y0 + line.y1) / 2, s = bestShear(px, w, yc);
    function sx(q) { var x = q % w, y = (q - x) / w; return Math.round(x + s * (y - yc)); }
    var pts = px.map(function (q) { var x = q % w, y = (q - x) / w; return { x: sx(q), y: y - line.y0 }; });
    var minX = Infinity, maxX = -Infinity;
    pts.forEach(function (p) { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; });
    var LW = maxX - minX + 1, grid = new Uint8Array(LW * H), colN = new Int32Array(LW);
    pts.forEach(function (p) { var i = p.y * LW + (p.x - minX); if (!grid[i]) { grid[i] = 1; colN[p.x - minX]++; } });
    // characters: runs of ink columns, joining gaps thinner than a stroke
    var runs = [], gapMax = Math.max(1, Math.round(H * 0.025)), x = 0;
    while (x < LW) {
      if (!colN[x]) { x++; continue; }
      var a = x, gap = 0, end = x;
      while (x < LW && gap <= gapMax) { if (colN[x]) { end = x; gap = 0; } else gap++; x++; }
      runs.push({ x0: a, x1: end });
    }
    // each run (column of ink) and the pieces stacked in it
    var cut = Math.max(2, Math.round(H * 0.05));
    var chars = runs.map(function (r) {
      var rows = [], pieces = [], yy, xx;
      for (yy = 0; yy < H; yy++) { var any = 0; for (xx = r.x0; xx <= r.x1; xx++) any += grid[yy * LW + xx]; rows.push(any); }
      var y = 0;
      while (y < H) {
        if (!rows[y]) { y++; continue; }
        var top = y, bot = y, gap2 = 0;
        while (y < H && gap2 < cut) { if (rows[y]) { bot = y; gap2 = 0; } else gap2++; y++; }
        var x0 = r.x1, x1 = r.x0;
        for (var y3 = top; y3 <= bot; y3++) for (var x3 = r.x0; x3 <= r.x1; x3++) if (grid[y3 * LW + x3]) { if (x3 < x0) x0 = x3; if (x3 > x1) x1 = x3; }
        pieces.push({ x0: x0, x1: x1, y0: top, y1: bot, w: x1 - x0 + 1, h: bot - top + 1 });
      }
      var c = { x0: r.x0, x1: r.x1, w: r.x1 - r.x0 + 1, pieces: pieces, y0: pieces[0].y0, y1: pieces[pieces.length - 1].y1 };
      c.h = c.y1 - c.y0 + 1;
      return c;
    });
    dbg.H = H; dbg.chars = chars; dbg.LW = LW; dbg.grid = Array.from(grid);
    var tall = chars.filter(function (c) { return c.h >= 0.7 * H; });
    if (!tall.length) return { ok: false, reason: 'no digits seen' };
    // a number running off the box (a digit cut by its edge) is never read: it could lose a leading digit
    var lx0 = tall[0].x0 + minX, lx1 = tall[tall.length - 1].x1 + minX;
    var cut = cutOff.filter(function (o) {
      var oh = o.y1 - o.y0 + 1, ov = Math.min(o.y1, line.y1) - Math.max(o.y0, line.y0) + 1;
      if (oh > 0.9 * h || (o.x1 - o.x0) > 0.6 * w) return false;    // the screen's frame, not a digit
      if (o.x0 === 0 && ov > 0.5 * Math.min(oh, H)) return o.x1 >= lx0 - 0.6 * H;            // a leading digit cut at the left
      if (o.y0 === 0 || o.y1 === h - 1) return o.x1 >= lx0 && o.x0 <= lx1 && ov > 0.5 * oh;    // a digit cut at the top or bottom
      return false;
    });
    dbg.cut = cut.map(function (o) { return [o.x0, o.y0, o.x1, o.y1]; }); dbg.lx = [lx0, lx1, line.y0, line.y1, w, h];
    if (cut.length) return { ok: false, reason: 'number runs off the box: move back a little' };
    var wide = tall.filter(function (c) { return c.w > 0.3 * H; }).map(function (c) { return c.w; }).sort(function (p, q) { return p - q; });
    var Wd = wide.length ? wide[Math.floor(wide.length / 2)] : 0.55 * H;
    var num = '', neg = false, sure = 0.5, centres = [], keys = [], tenths = '';
    function readPiece(c, y0, hh) {
      var cw = c.w, sub = new Uint8Array(cw * hh);
      for (var y2 = 0; y2 < hh; y2++) for (var x2 = 0; x2 < cw; x2++) sub[y2 * cw + x2] = grid[(y0 + y2) * LW + c.x0 + x2];
      var k = classify(sub, cw, hh);
      keys.push(k.key); sure = Math.min(sure, k.sure);
      return k.d;
    }
    /** On these units the tenths digit is half height, at the bottom of the last column, under the C sign. */
    function smallTenths(c) {
      var low = c.pieces.filter(function (p) { return p.y0 >= 0.4 * H; }), high = c.pieces.filter(function (p) { return p.y0 < 0.4 * H; });
      if (!low.length || (!high.length && c.h >= 0.7 * H)) return '';
      var y0 = low[0].y0, y1 = low[low.length - 1].y1, x0 = c.x1, x1 = c.x0;
      low.forEach(function (p) { if (p.x0 < x0) x0 = p.x0; if (p.x1 > x1) x1 = p.x1; });
      var hh = y1 - y0 + 1, ww = x1 - x0 + 1;
      if (y1 < 0.85 * H || hh < 0.3 * H || hh > 0.66 * H) return '';
      return ww < 0.3 * hh ? '1' : (readPiece({ x0: x0, w: ww }, y0, hh) || '');
    }
    for (var i = 0; i < chars.length; i++) {
      var c = chars[i], d;
      if (num && i === chars.length - 1 && (tenths = smallTenths(c))) break;
      if (c.h >= 0.7 * H) {
        d = c.w < 0.5 * Wd ? '1' : readPiece(c, 0, H);
        if (!d) return { ok: false, reason: 'a digit could not be read', keys: keys };
        num += d; centres.push((c.x0 + c.x1) / 2 + minX);
      } else if (!num && c.w >= 0.25 * H && c.h <= 0.3 * H && c.y0 > 0.3 * H && c.y1 < 0.7 * H) neg = true;   // minus sign
      // anything else (labels, the degree sign, C) is not part of the number
    }
    if (opts.tenths === 'small' && !tenths) return { ok: false, reason: 'small tenths digit not seen', num: num };
    if (tenths) num += tenths;
    var dpAfter = tenths ? num.length - 1 : -1;
    if (!tenths) dots.forEach(function (o) {
      var cxd = sx(Math.round((o.y0 + o.y1) / 2) * w + Math.round((o.x0 + o.x1) / 2));
      var left = centres.filter(function (cx) { return cx < cxd; }).length;
      if (left > 0 && left < centres.length) dpAfter = left;
    });
    var text;
    if (dpAfter > 0) {
      if (num.length - dpAfter !== 1) return { ok: false, reason: 'not 1 decimal place' };
      text = num.slice(0, dpAfter) + '.' + num.slice(dpAfter);
    } else if (num.length === 3) text = num.slice(0, 2) + '.' + num.slice(2);
    else return { ok: false, reason: 'decimal point not seen', num: num };
    text = (neg ? '-' : '') + text.replace(/^0(\d)/, '$1');
    var v = parseFloat(text);
    if (!/^-?\d{1,2}\.\d$/.test(text) || isNaN(v) || v < LOW || v > HIGH) return { ok: false, reason: 'not a room temperature', num: text };
    return { ok: true, value: v.toFixed(1), text: text, sure: sure };
  }

  /** Read one box, trying dark-on-light first, then light-on-dark. */
  function readRegion(gray, W, H, rect, opts) {
    var c = crop(gray, W, H, rect);
    var r = readBox(c.g, c.w, c.h, false, null, opts);
    if (r.ok) return r;
    var r2 = readBox(c.g, c.w, c.h, true, null, opts);
    return r2.ok ? r2 : r;
  }

  /**
   * Both numbers. layout gives each box as fractions of the image: {max:{x,y,w,h}, min:{x,y,w,h}}.
   * Default: these units show MAX top right and MIN bottom right.
   */
  /**
   * The kennel's units (2026): MAX top right, MIN bottom right; whole digits full height and the tenths digit
   * half height under the C sign. Boxes are fractions of the lit LCD window. tenths 'small' = only that shape counts.
   */
  var LAYOUT = { window: true, tenths: 'small', max: { x: 0.6, y: 0.0, w: 0.4, h: 0.52 }, min: { x: 0.6, y: 0.48, w: 0.4, h: 0.52 } };

  /** The lit LCD window inside the camera's box: the longest run of bright rows, then of bright columns. */
  function findWindow(gray, W, H) {
    function run(vals) {
      var s = vals.slice().sort(function (p, q) { return p - q; }), lo = s[Math.floor(s.length * 0.02)], hi = s[Math.floor(s.length * 0.9)];
      if (lo > 0.6 * hi) return [0, vals.length];             // no dark frame in view: use it all
      var t = (lo + hi) / 2, best = null, start = -1, dip = 0, tol = Math.max(2, Math.round(vals.length * 0.08));
      for (var i = 0; i <= vals.length; i++) {
        var lit = i < vals.length && vals[i] > t;
        if (lit) { if (start < 0) start = i; dip = 0; }
        else if (start >= 0 && (i === vals.length || ++dip > tol)) {
          var end = i - (i === vals.length ? dip : dip - 1);
          if (!best || end - start > best[1] - best[0]) best = [start, end];
          start = -1; dip = 0;
        }
      }
      return best;
    }
    var rows = [], cols = [], x, y, sum;
    for (y = 0; y < H; y++) { sum = 0; for (x = Math.floor(W * 0.1); x < Math.ceil(W * 0.9); x++) sum += gray[y * W + x]; rows.push(sum / (W * 0.8)); }
    var r = run(rows);
    if (!r || r[1] - r[0] < H * 0.3) return { x: 0, y: 0, w: W, h: H };
    for (x = 0; x < W; x++) { sum = 0; for (y = r[0]; y < r[1]; y++) sum += gray[y * W + x]; cols.push(sum / (r[1] - r[0])); }
    var c = run(cols);
    if (!c || c[1] - c[0] < W * 0.3) return { x: 0, y: r[0], w: W, h: r[1] - r[0] };
    return { x: c[0], y: r[0], w: c[1] - c[0], h: r[1] - r[0] };
  }

  function readDisplay(gray, W, H, layout) {
    layout = layout || LAYOUT;
    var win = layout.window ? findWindow(gray, W, H) : { x: 0, y: 0, w: W, h: H };
    function px(b) { return { x: win.x + b.x * win.w, y: win.y + b.y * win.h, w: b.w * win.w, h: b.h * win.h }; }
    var o = { tenths: layout.tenths || 'any' };
    var mx = readRegion(gray, W, H, px(layout.max), o), mn = readRegion(gray, W, H, px(layout.min), o);
    var both = mx.ok && mn.ok && parseFloat(mn.value) <= parseFloat(mx.value);
    return { ok: both, max: mx, min: mn, window: win, reason: both ? '' : (mx.ok && mn.ok ? 'MIN is above MAX' : (mx.ok ? mn.reason : mx.reason)) };
  }

  /** Only trust a pair once the same pair has been read `need` frames in a row. */
  function Steady(need) {
    need = need || 3;
    var last = '', count = 0;
    return {
      feed: function (r) {
        if (!r || !r.ok) { count = 0; last = ''; return null; }
        var key = r.max.value + '|' + r.min.value;
        if (key === last) count++; else { last = key; count = 1; }
        return count >= need ? { max: r.max.value, min: r.min.value } : null;
      },
      reset: function () { last = ''; count = 0; }
    };
  }

  return { _binarise: binarise, findWindow: findWindow, toGray: toGray, readRegion: readRegion, readDisplay: readDisplay, readBox: readBox, Steady: Steady, LAYOUT: LAYOUT, PATTERNS: PATTERNS };
}));
