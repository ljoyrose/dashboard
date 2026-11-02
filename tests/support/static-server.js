// Tiny static web server for the tests. No packages needed.
// It serves this repo under /dashboard/ (GitHub Pages) or, with SITE_BASE=/, at the root (Cloudflare Pages):
//   http://127.0.0.1:4173/dashboard/        -> index.html
//   http://127.0.0.1:4173/dashboard/cdhub/  -> cdhub/index.html
//   http://127.0.0.1:4173/dashboard/money/  -> money/index.html
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const { BASE: PREFIX } = require('./site');
const PORT = Number(process.env.PORT || 4173);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};
// Only the website files are served. Test tooling, git data and dependencies stay private.
const BLOCKED = /^(\.git|node_modules|tests|test-results|playwright-report|\.github|docs|_site)(\/|$)/;

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let p = decodeURIComponent(url.pathname);
    if (p === '/' && PREFIX !== '/') {
      res.writeHead(302, { Location: PREFIX });
      return res.end();
    }
    if (!p.startsWith(PREFIX)) {
      res.writeHead(404);
      return res.end('Not found');
    }
    let rel = p.slice(PREFIX.length);
    if (BLOCKED.test(rel)) {
      res.writeHead(404);
      return res.end('Not found');
    }
    let file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      if (!p.endsWith('/')) {
        res.writeHead(301, { Location: p + '/' });
        return res.end();
      }
      file = path.join(file, 'index.html');
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end('Not found');
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    });
  })
  .listen(PORT, '127.0.0.1', () => console.log('Serving ' + ROOT + ' at http://127.0.0.1:' + PORT + PREFIX));
