// A small pretend Google Drive that lives in memory.
// It answers the handful of Drive web calls the dashboard makes, so tests never touch real Drive.
// Understands: about, drives, files list (with the query words the dashboard uses), file read,
// export, trash a file (PATCH) and empty the bin (DELETE /files/trash).

const FOLDER = 'application/vnd.google-apps.folder';

class FakeDrive {
  constructor({ email = 'someone@example.test' } = {}) {
    this.email = email;
    this.drives = []; // {id, name}
    this.files = []; // {id,name,mimeType,parents,driveId,modifiedTime,content,trashed,...}
    this.calls = []; // every request seen, for assertions
    this.unhandled = []; // Drive calls the pretend Drive did not know how to answer (drift check, see summary.js)
    this.failWith = null; // {status, reason, message} makes every files call fail (error-path tests)
    this.failFor = null; // optional: only fail when the URL contains this text
    this._n = 0;
  }

  addDrive(id, name) {
    this.drives.push({ id, name, capabilities: { canTrashChildren: true, canDeleteChildren: true } });
    return this;
  }

  /** Add a folder. */
  folder(id, name, { parents = [], driveId = null, modifiedTime } = {}) {
    this.files.push({ id, name, mimeType: FOLDER, parents, driveId, modifiedTime: modifiedTime || '2026-03-01T09:00:00.000Z', trashed: false });
    return this;
  }

  /** Add a file. `content` is plain text (CSV, JSON...). */
  file(id, name, content, { parents = [], driveId = null, modifiedTime, mimeType = 'text/csv', trashed = false, trashedTime, md5Checksum, size } = {}) {
    this.files.push({
      id, name, mimeType, parents, driveId, content,
      modifiedTime: modifiedTime || '2026-03-05T10:00:00.000Z',
      trashed, trashedTime, md5Checksum, size: size != null ? String(size) : String((content || '').length),
      webViewLink: 'https://drive.google.test/file/' + id,
      lastModifyingUser: { displayName: 'Sample Person', emailAddress: 'sample@example.test' },
    });
    return this;
  }

  byId(id) { return this.files.find((f) => f.id === id); }

  // ----- query language (the small part the dashboard uses) -----
  _match(f, q) {
    if (!q) return true;
    const toks = [];
    const re = /\(|\)|'(?:\\.|[^'\\])*'|[A-Za-z_]+|!=|=|>|</g;
    let m;
    while ((m = re.exec(q))) toks.push(m[0]);
    let i = 0;
    const unq = (s) => s.slice(1, -1).replace(/\\'/g, "'");
    const parseOr = () => { let v = parseAnd(); while (toks[i] === 'or') { i++; const r = parseAnd(); v = v || r; } return v; };
    const parseAnd = () => { let v = parseAtom(); while (toks[i] === 'and') { i++; const r = parseAtom(); v = v && r; } return v; };
    const parseAtom = () => {
      if (toks[i] === '(') { i++; const v = parseOr(); i++; return v; }
      // 'X' in parents / 'me' in owners
      if (toks[i] && toks[i][0] === "'" && toks[i + 1] === 'in') {
        const val = unq(toks[i]); const field = toks[i + 2]; i += 3;
        if (field === 'parents') return (f.parents || []).includes(val);
        if (field === 'owners') return val === 'me' ? f.mine !== false : true;
        return false;
      }
      const field = toks[i++]; const op = toks[i++];
      let val;
      val = toks[i++];
      if (op === 'contains') val = unq(val);
      if (field === 'trashed') return !!f.trashed === (val === 'true');
      if (field === 'name') {
        if (op === 'contains') return f.name.toLowerCase().includes(val.toLowerCase());
        const v = unq(val); return op === '=' ? f.name === v : f.name !== v;
      }
      if (field === 'mimeType') { const v = unq(val); return op === '=' ? f.mimeType === v : f.mimeType !== v; }
      if (field === 'modifiedTime') { const v = unq(val); return op === '>' ? f.modifiedTime > v : f.modifiedTime < v; }
      return true;
    };
    return parseOr();
  }

  _list(params) {
    let out = this.files.filter((f) => this._match(f, params.get('q')));
    if (params.get('corpora') === 'drive' && params.get('driveId')) out = out.filter((f) => f.driveId === params.get('driveId'));
    const order = params.get('orderBy') || '';
    if (/modifiedTime desc/.test(order)) out.sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime));
    else if (/folder,name/.test(order)) out.sort((a, b) => (b.mimeType === FOLDER) - (a.mimeType === FOLDER) || a.name.localeCompare(b.name));
    const size = Number(params.get('pageSize') || 100);
    const start = Number(params.get('pageToken') || 0);
    const page = out.slice(start, start + size);
    const body = { files: page.map(({ content, ...meta }) => meta) };
    if (start + size < out.length) body.nextPageToken = String(start + size);
    return body;
  }

  /** Attach to a Playwright browser context. */
  async install(context) {
    await context.route('https://www.googleapis.com/drive/v3/**', async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const p = url.pathname.replace('/drive/v3', '');
      const params = url.searchParams;
      this.calls.push({ method: req.method(), path: p, query: params.get('q') || '', url: req.url() });
      const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      const auth = req.headers()['authorization'];
      if (auth !== 'Bearer FAKE-TEST-TOKEN') return json(401, { error: { code: 401, message: 'Invalid Credentials', errors: [{ reason: 'authError' }] } });
      if (this.failWith && (p !== '/about' || this.failWith.includeAbout) && (!this.failFor || req.url().includes(this.failFor))) {
        const f = this.failWith;
        return json(f.status, { error: { code: f.status, message: f.message || 'Sample failure', errors: [{ reason: f.reason || 'backendError' }] } });
      }
      if (p === '/about') return json(200, { user: { emailAddress: this.email, displayName: 'Sample Person' } });
      if (p === '/drives') return json(200, { drives: this.drives });
      if (p === '/files' && req.method() === 'GET') return json(200, this._list(params));
      if (p === '/files/trash' && req.method() === 'DELETE') {
        const d = params.get('driveId');
        this.files = this.files.filter((f) => !(f.trashed && f.driveId === d));
        return route.fulfill({ status: 204, body: '' });
      }
      let m = /^\/files\/([^/]+)\/export$/.exec(p);
      if (m) {
        const f = this.byId(decodeURIComponent(m[1]));
        return f ? route.fulfill({ status: 200, contentType: 'text/csv', body: f.content || '' }) : json(404, { error: { code: 404, message: 'File not found' } });
      }
      m = /^\/files\/([^/]+)$/.exec(p);
      if (m) {
        const f = this.byId(decodeURIComponent(m[1]));
        if (!f) return json(404, { error: { code: 404, message: 'File not found', errors: [{ reason: 'notFound' }] } });
        if (req.method() === 'PATCH') {
          const body = JSON.parse(req.postData() || '{}');
          if (body.trashed === true) { f.trashed = true; f.trashedTime = '2026-03-09T12:00:00.000Z'; }
          if (typeof body.name === 'string') f.name = body.name; // rename (PC-Personal step 2)
          return json(200, { id: f.id, name: f.name, trashed: !!f.trashed });
        }
        if (params.get('alt') === 'media') return route.fulfill({ status: 200, contentType: f.mimeType === 'application/json' ? 'application/json' : 'text/plain', body: f.content || '' });
        const { content, ...meta } = f;
        return json(200, meta);
      }
      this.unhandled.push(req.method() + ' ' + p);
      return json(404, { error: { code: 404, message: 'Not handled by the pretend Drive: ' + p } });
    });
  }
}

module.exports = { FakeDrive, FOLDER };
