// Marketplace "Product ideas": the data contract (stage 1). ONE row per idea in the "Ideas" tab of the Marketplace
// data sheet (the same workbook as the Marketplace tab, id in config.js). The page reads A2:Y by POSITION, so the
// order below is the order of the columns in the sheet. Items to sell only (not apps). No ids or data in this file.
(function (root) {
  'use strict';
  var TAB = 'Ideas';
  var COLS = ['id', 'created', 'name', 'link', 'barcode', 'price_seen', 'where_seen', 'note', 'image_link',
    'product_type', 'buyer', 'branding', 'fulfilment', 'source', 'status', 'gate', 'verdict', 'margin_est',
    'risk_top3', 'unknowns_top3', 'kill_rule', 'next_step', 'owner', 'updated', 'dropped_reason'];
  // Allowed words for the pick-lists. Empty is always allowed (Lisa fills what she knows; the investigator labels the rest as assumed).
  var ENUMS = {
    product_type: ['physical', 'digital'],
    buyer: ['b2c', 'b2b'],
    branding: ['white_label', 'own_brand', 'supplier_brand', 'resell'],
    fulfilment: ['hold_stock', 'dropship', 'made_to_order', 'digital'],
    source: ['maker', 'wholesaler', 'distributor', 'licence'],
    status: ['new', 'screening', 'research', 'test', 'launched', 'dropped'],
    gate: ['0', '1', '2', '3'],
    verdict: ['go', 'maybe', 'no']
  };
  var DEFAULTS = { status: 'new', gate: '0' };
  // Letter of the last column, for the range (A..Y for 25 columns).
  function lastLetter(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  var RANGE = TAB + '!A2:' + lastLetter(COLS.length);

  var api = { TAB: TAB, COLS: COLS, ENUMS: ENUMS, DEFAULTS: DEFAULTS, RANGE: RANGE };
  root.MarketplaceIdeas = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
