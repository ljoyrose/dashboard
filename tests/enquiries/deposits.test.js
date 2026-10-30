// Stage 11: deposits and balances report. Run: node --test tests/enquiries/deposits.test.js
// Invented ledger and Xero export only (tests/fixtures/enquiries/deposits.js). Report only: nothing is sent or paid.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../enquiries/core.js');
const F = require('../fixtures/enquiries/deposits.js');

const NOW = '2026-11-02T12:00:00Z';
const ledger = () => C.depositLedgerFrom(F.ledger, { source: 'ALLOC-SAMPLE' });

test('ledger: one row per deposit (pups and the waiting list skipped), dates read, hashed person keys only', () => {
  const rows = ledger();
  assert.equal(rows.length, 7);
  assert.deepEqual(rows.map((r) => r.status), ['held', 'held', 'held', 'held', 'held', 'collected', 'refunded']);
  assert.deepEqual(rows.slice(0, 3).map((r) => r.deposit_date), ['2026-08-01', '2026-08-02', '2026-08-03']);
  assert.ok(rows.every((r) => r.litter_ref === 'xx26' || !r.pup_ref));
  assert.ok(rows.every((r) => /^D-[0-9a-f]{16}$/.test(r.deposit_key) && /^P-[0-9a-f]{16}$/.test(r.person_key)));
  assert.equal(new Set(rows.map((r) => r.deposit_key)).size, rows.length);
  assert.doesNotMatch(JSON.stringify(rows), /Buyer|example\.com|7700/, 'no name, email or number from the sheet');
  for (const k of Object.keys(rows[0])) assert.ok(C.COLUMNS.Deposits.includes(k), k + ' is a Deposits column');
});

test('ACCEPT: held, due-in-30-days and overdue totals (paid balances and undated rows handled)', () => {
  const t = C.depositTotals(ledger(), NOW, { dueDays: 30 });
  assert.deepEqual(t.all, { held_count: 5, held: 3000, due_count: 1, due: 1500, overdue_count: 1, overdue: 1000, undated: 1, unreadable: 0, suggested: 0 });
  assert.equal(t.byLitter.xx26.held_count, 4);
  assert.equal(t.byLitter['(no litter)'].held_count, 1);
  const shorter = C.depositTotals(ledger(), NOW, { dueDays: 10 }).all;
  assert.equal(shorter.due_count, 0, 'a balance 18 days off is not due within 10 days');
  const bad = C.depositTotals([{ status: 'held', deposit: 'five hundred', collection_date: '2026-12-01' }], NOW).all;
  assert.equal(bad.unreadable, 1);
});

test('CSV: quotes, commas inside quotes, CRLF and the BOM', () => {
  const v = C.parseCsv(F.xeroCsv);
  assert.equal(v.length, 5);
  assert.equal(v[0][0], 'ContactName');
  assert.equal(v[1][0], 'Buyer E, One');
  assert.equal(v[1].length, 10);
});

test('Xero export: paid invoices only; only email, date and amount kept', () => {
  const inv = C.xeroInvoicesFrom(C.parseCsv(F.xeroCsv));
  assert.equal(inv.length, 3, 'the awaiting-payment invoice is left out');
  assert.deepEqual(inv[0], Object.assign({}, inv[0], { email: 'e1@example.com', date: '2026-10-05', amount: '500.00' }));
  assert.doesNotMatch(JSON.stringify(inv), /Buyer|Invented Road|INV-9/, 'no name, address or invoice number kept');
});

test('ACCEPT: an invented invoice matches an invented enquiry by email and amount; a different amount is refused', () => {
  const inv = C.xeroInvoicesFrom(C.parseCsv(F.xeroCsv));
  const cands = [{ enquiry_key: 'K-0000000000000001', person_key: 'P-1', email: 'E1@Example.com', litter_ref: 'xx26' },
    { enquiry_key: 'K-0000000000000002', person_key: 'P-2', email: 'e2@example.com', litter_ref: '' }];
  const m = C.matchInvoices(inv, cands, ['500']);
  assert.deepEqual(m.suggested.map((s) => [s.enquiry_key, s.amount, s.date, s.litter_ref]), [['K-0000000000000001', '500.00', '2026-10-05', 'xx26']]);
  assert.deepEqual(m.refused.map((r) => r.enquiry_key), ['K-0000000000000002'], '250 is not a deposit amount');
  assert.equal(m.unmatched, 1, 'an invoice for nobody known is counted, not matched');
  assert.equal(C.matchInvoices(inv, cands, []).suggested.length, 0, 'no deposit amounts set: nothing suggested');
});

test('"deposit paid" request: known key shape only, never an amount', () => {
  const r = C.depositPaidRequest('K-00000000000000ab', '', '2026-11-02T10:00:00.000Z');
  assert.ok(r.ok);
  assert.deepEqual(Object.keys(r.body).sort(), ['at', 'deposit_key', 'enquiry_key', 'kind', 'v']);
  assert.equal(r.body.kind, 'deposit-paid');
  assert.match(r.name, /^ENQ-deposit-paid-\d{14}-000000\.json$/);
  assert.equal(C.depositPaidRequest('nope').ok, false);
  assert.equal(C.depositPaidRequest('K-00000000000000ab', 'D-bad').ok, false);
});
