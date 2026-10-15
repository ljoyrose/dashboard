'use strict';
// Writes the FAKE fixtures to tests/fixtures/*.csv so a person can open them.
const fs = require('node:fs');
const path = require('node:path');
const fx = require('./fixtures');

const dir = path.join(__dirname, 'fixtures');
fs.mkdirSync(dir, { recursive: true });
const files = fx.csvFiles();
files['BLD-area_reading.csv'] = fx.headerOnly(fx.AREA_READING_HEADER);
files['BLD-_pending.csv'] = fx.headerOnly(fx.PENDING_HEADER);
files['BLD-staff.csv'] = fx.headerOnly(fx.STAFF_HEADER);
Object.keys(files).forEach((n) => fs.writeFileSync(path.join(dir, n), files[n]));
console.log('wrote', Object.keys(files).length, 'fake fixture files to', dir);
