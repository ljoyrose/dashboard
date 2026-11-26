(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../client/bld-save.js'), require('../client/drive-lookups.js'), require('../screens/screens.js'));
  else root.BLDBoard = factory(root.BLDSave, root.BLDLookups, root.BLDScreens);
}(typeof self !== 'undefined' ? self : this, function (BLDSave, BLDLookups, BLDScreens) {
  'use strict';
  function create(cfg) {
    cfg = cfg || {};
    var save = cfg.save || BLDSave.create({ scriptUrl: cfg.scriptUrl });
    var L = BLDLookups.fromTables(cfg.tables || {}, cfg.today || new Date().toISOString().slice(0, 10));
    save.setLookups({ area: L.areas, person: L.people, subject: L.subjects });
    function open(moduleId, el) {
      save.checkStatus().then(function () { draw(); });
      draw();
      function draw() {
        if (moduleId === 'temp') BLDScreens.temperatureEntry(el, { save: save, areas: L.areas, bandForArea: L.bandForArea, actionFor: L.actionFor, document: cfg.document });
        else if (moduleId === 'staff') BLDScreens.staffInput(el, { save: save, people: L.people, document: cfg.document });
      }
    }
    return { open: open, save: save, lookups: L };
  }
  return { create: create };
}));

