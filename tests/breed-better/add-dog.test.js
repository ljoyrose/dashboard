'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Add = require('../../breed-better/add-dog.js');

/* a pretend adapter: records what it was asked to write */
function adapter(can) {
  const log = [];
  return {
    log,
    canWrite: () => can,
    listCandidates: () => [{ id: 'a1', name: 'Alpha', sex: 'Female', photo: 'PHOTOID1' }, { id: 'a2', name: 'Beta' }],
    species: () => [{ id: 'sp-dog', name: 'Dog', sexes: ['Female', 'Male'] }, { id: 'sp-horse', name: 'Horse', sexes: ['Mare', 'Stallion'] }],
    photoUrl: (p) => 'https://example.test/' + p,
    createSubject: (f, photo) => { log.push(['create', f, photo]); return Promise.resolve({ id: 'new1' }); },
    enrol: (id, scheme, from) => { log.push(['enrol', id, scheme, from]); return Promise.resolve(); }
  };
}
const opts = { schemeId: 's1', today: '2026-11-13' };

test('without a save route the form says so and Save is off', () => {
  const html = Add.html(adapter(false), opts, {});
  assert.match(html, /data-ad-save="1" disabled/);
  assert.match(html, /Saving is not set up yet/);
});

test('picking an animal already on file shows its own photo, linked, and enrols it', async () => {
  const a = adapter(true);
  const html = Add.html(a, opts, { mode: 'pick' });
  assert.match(html, /src="https:\/\/example\.test\/PHOTOID1"/);
  const id = await Add.save(a, opts, { mode: 'pick', picked: 'a1' });
  assert.equal(id, 'a1');
  assert.deepEqual(a.log, [['enrol', 'a1', 's1', '2026-11-13']]);
});

test('a new animal is created with its photo file, then enrolled', async () => {
  const a = adapter(true);
  const photo = { name: 'p.jpg' };
  const id = await Add.save(a, opts, { mode: 'new', fields: { name: 'Gamma', species: 'sp-dog', sex: 'Female', dob: '2026-01-02' } }, photo);
  assert.equal(id, 'new1');
  assert.equal(a.log[0][0], 'create');
  assert.equal(a.log[0][2], photo);
  assert.deepEqual(a.log[1], ['enrol', 'new1', 's1', '2026-11-13']);
});

test('sex words come from the species row', () => {
  const html = Add.html(adapter(true), opts, { mode: 'new', fields: { species: 'sp-horse' } });
  assert.match(html, /<option>Mare<\/option><option>Stallion<\/option>/);
});

test('a pup carries its litter; a name is needed and a birth date cannot be in the future', async () => {
  const a = adapter(true);
  await Add.save(a, Object.assign({ litterId: 'lit1' }, opts), { mode: 'new', fields: { name: 'Pup', sex: 'Male' } });
  assert.equal(a.log[0][1].birth_litter_id, 'lit1');
  assert.equal(a.log[0][1].species, 'sp-dog');
  await assert.rejects(Add.save(a, opts, { mode: 'new', fields: { dob: '2027-01-01', species: 'sp-dog' } }), (e) => !!(e.fields.name && e.fields.dob && e.fields.sex));
});
