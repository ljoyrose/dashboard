/*!
 * BLDQr - makes a QR code (byte mode, error correction M, versions 1-10) and draws it as SVG. No network.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDQr = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // version: [total codewords, ec per block, group 1 blocks, group 1 data, group 2 blocks, group 2 data]
  var V = [null, [26, 10, 1, 16, 0, 0], [44, 16, 1, 28, 0, 0], [70, 26, 1, 44, 0, 0], [100, 18, 2, 32, 0, 0], [134, 24, 2, 43, 0, 0], [172, 16, 4, 27, 0, 0], [196, 18, 4, 31, 0, 0], [242, 22, 2, 38, 2, 39], [292, 22, 3, 36, 2, 37], [346, 26, 4, 43, 1, 44]];
  var ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
  var EXP = new Array(512), LOG = new Array(256);
  (function () { var x = 1; for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 285; } for (i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; }());
  function mul(a, b) { return a && b ? EXP[LOG[a] + LOG[b]] : 0; }
  function genPoly(n) { var p = [1]; for (var i = 0; i < n; i++) { var q = new Array(p.length + 1).fill(0); for (var j = 0; j < p.length; j++) { q[j] ^= p[j]; q[j + 1] ^= mul(p[j], EXP[i]); } p = q; } return p; }
  function ecBytes(data, n) { var g = genPoly(n), r = data.concat(new Array(n).fill(0)); for (var i = 0; i < data.length; i++) { var f = r[i]; if (f) for (var j = 0; j < g.length; j++) r[i + j] ^= mul(f, g[j]); } return r.slice(data.length); }
  function utf8(s) { return Array.prototype.slice.call(new TextEncoder().encode(s)); }
  function bchRem(v, poly, deg) { var d = v << deg; for (var i = 31; i >= deg; i--) if ((d >>> i) & 1) d ^= poly << (i - deg); return d; }

  function encode(text) {
    var bytes = utf8(text), ver = 0;
    for (var v = 1; v <= 10; v++) { var cap = V[v][2] * V[v][3] + V[v][4] * V[v][5]; if (bytes.length + (v < 10 ? 2 : 3) <= cap) { ver = v; break; } }
    if (!ver) throw new Error('That is too long for a QR code here.');
    var I = V[ver], dataCap = I[2] * I[3] + I[4] * I[5], bits = [];
    function put(val, n) { for (var i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    put(4, 4); put(bytes.length, ver < 10 ? 8 : 16); bytes.forEach(function (b) { put(b, 8); });
    put(0, Math.min(4, dataCap * 8 - bits.length));
    while (bits.length % 8) bits.push(0);
    var cw = []; for (var i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    for (var pad = 0; cw.length < dataCap; pad++) cw.push(pad % 2 ? 17 : 236);
    var blocks = [], pos = 0, k;
    for (k = 0; k < I[2] + I[4]; k++) { var len = k < I[2] ? I[3] : I[5]; var d = cw.slice(pos, pos + len); pos += len; blocks.push({ d: d, e: ecBytes(d, I[1]) }); }
    var out = [], maxD = Math.max(I[3], I[5]);
    for (i = 0; i < maxD; i++) blocks.forEach(function (b) { if (i < b.d.length) out.push(b.d[i]); });
    for (i = 0; i < I[1]; i++) blocks.forEach(function (b) { out.push(b.e[i]); });

    var size = 17 + 4 * ver, M = [], F = [];
    for (i = 0; i < size; i++) { M.push(new Array(size).fill(0)); F.push(new Array(size).fill(false)); }
    function set(r, c, v) { if (r >= 0 && c >= 0 && r < size && c < size) { M[r][c] = v ? 1 : 0; F[r][c] = true; } }
    function finder(r0, c0) { for (var r = -1; r <= 7; r++) for (var c = -1; c <= 7; c++) { var inO = r >= 0 && r <= 6 && (c === 0 || c === 6) || c >= 0 && c <= 6 && (r === 0 || r === 6), inC = r >= 2 && r <= 4 && c >= 2 && c <= 4; set(r0 + r, c0 + c, inO || inC); } }
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
    for (i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    var A = ALIGN[ver];
    var L = A.length - 1;
    A.forEach(function (r, ri) { A.forEach(function (c, ci) { if ((ri === 0 && ci === 0) || (ri === 0 && ci === L) || (ri === L && ci === 0)) return; for (var y = -2; y <= 2; y++) for (var x = -2; x <= 2; x++) set(r + y, c + x, Math.max(Math.abs(x), Math.abs(y)) !== 1); }); });
    set(size - 8, 8, 1);
    for (i = 0; i < 9; i++) { if (!F[8][i]) { F[8][i] = true; } if (!F[i][8]) { F[i][8] = true; } }
    for (i = 0; i < 8; i++) { F[8][size - 1 - i] = true; F[size - 1 - i][8] = true; }
    if (ver >= 7) { for (i = 0; i < 6; i++) for (k = 0; k < 3; k++) { F[i][size - 11 + k] = true; F[size - 11 + k][i] = true; } }
    var path = [], up = true;
    for (var col = size - 1; col > 0; col -= 2) { if (col === 6) col--; for (var n = 0; n < size; n++) { var row = up ? size - 1 - n : n; for (k = 0; k < 2; k++) if (!F[row][col - k]) path.push([row, col - k]); } up = !up; }
    var dataBits = []; out.forEach(function (b) { for (var j = 7; j >= 0; j--) dataBits.push((b >>> j) & 1); });
    var MASK = [function (r, c) { return (r + c) % 2 === 0; }, function (r) { return r % 2 === 0; }, function (r, c) { return c % 3 === 0; }, function (r, c) { return (r + c) % 3 === 0; }, function (r, c) { return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; }, function (r, c) { return r * c % 2 + r * c % 3 === 0; }, function (r, c) { return (r * c % 2 + r * c % 3) % 2 === 0; }, function (r, c) { return ((r + c) % 2 + r * c % 3) % 2 === 0; }];
    function build(m) {
      var G = M.map(function (r) { return r.slice(); });
      path.forEach(function (p, idx) { var b = idx < dataBits.length ? dataBits[idx] : 0; G[p[0]][p[1]] = MASK[m](p[0], p[1]) ? b ^ 1 : b; });
      var fmt = ((0 << 3) | m), bitsF = ((fmt << 10) | bchRem(fmt, 0x537, 10)) ^ 0x5412;   // level M = 00
      for (var i = 0; i < 15; i++) {
        var b = (bitsF >>> i) & 1;
        if (i < 6) G[i][8] = b; else if (i < 8) G[i + 1][8] = b; else G[size - 15 + i][8] = b;
        if (i < 8) G[8][size - 1 - i] = b; else if (i < 9) G[8][7] = b; else G[8][14 - i] = b;
      }
      if (ver >= 7) { var vb = (ver << 12) | bchRem(ver, 0x1F25, 12); for (i = 0; i < 18; i++) { var t = (vb >>> i) & 1, a = Math.floor(i / 3), c = i % 3; G[a][size - 11 + c] = t; G[size - 11 + c][a] = t; } }
      return G;
    }
    function penalty(G) {
      var s = 0, r, c, run, dark = 0;
      for (var pass = 0; pass < 2; pass++) for (r = 0; r < size; r++) { run = 1; for (c = 1; c <= size; c++) { var same = c < size && (pass ? G[c][r] === G[c - 1][r] : G[r][c] === G[r][c - 1]); if (same) run++; else { if (run >= 5) s += run - 2; run = 1; } } }
      for (r = 0; r < size - 1; r++) for (c = 0; c < size - 1; c++) if (G[r][c] === G[r][c + 1] && G[r][c] === G[r + 1][c] && G[r][c] === G[r + 1][c + 1]) s += 3;
      var P = '10111010000', Q = '00001011101';
      for (r = 0; r < size; r++) { var h = G[r].join(''), w = G.map(function (x) { return x[r]; }).join(''); [h, w].forEach(function (l) { for (var i = 0; i + 11 <= l.length; i++) { var sub = l.substr(i, 11); if (sub === P || sub === Q) s += 40; } }); dark += G[r].reduce(function (a, b) { return a + b; }, 0); }
      s += Math.floor(Math.abs(dark * 100 / (size * size) - 50) / 5) * 10;
      return s;
    }
    var best = null, bestS = Infinity;
    for (var m = 0; m < 8; m++) { var G = build(m), p = penalty(G); if (p < bestS) { bestS = p; best = G; } }
    return { size: size, version: ver, modules: best };
  }
  /** An SVG string with a white quiet zone, always black on white so it scans in any theme. */
  function svg(text, label) {
    var q = encode(text), z = 4, n = q.size + z * 2, d = '';
    for (var r = 0; r < q.size; r++) for (var c = 0; c < q.size; c++) if (q.modules[r][c]) d += 'M' + (c + z) + ' ' + (r + z) + 'h1v1h-1z';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + n + ' ' + n + '" shape-rendering="crispEdges" role="img" aria-label="' + (label || 'QR code') + '"><rect width="' + n + '" height="' + n + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }
  return { encode: encode, svg: svg };
}));
