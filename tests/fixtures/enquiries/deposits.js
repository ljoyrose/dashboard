// Invented deposit ledger and Xero invoice export for Stage 11. Nobody here is real: example.com addresses, Ofcom
// fiction numbers (07700 900xxx), made-up refs (xx26-*) and round invented amounts.
'use strict';
const H = ['section', 'ref', 'name', 'status', 'deposit_date', 'deposit', 'balance_due', 'balance_paid', 'collection_date', 'whatsapp', 'email', 'provisional_pup'];
const ledger = [H,
  ['PUPS', 'xx26-01', '', 'open', '', '', '', '', '', '', '', ''],
  ['LITTER-A', 'd1', 'Buyer D1', 'deposit paid', '2026-08-01', '500', '1500', '', '2026-11-20', '07700 900601', 'd1@example.com', 'xx26-03'], // due in 18 days
  ['LITTER-A', 'd2', 'Buyer D2', 'deposit paid', '02/08/2026', '£500.00', '1500', '1500', '2026-11-10', '07700 900602', 'd2@example.com', 'xx26-04'], // balance paid
  ['LITTER-A', 'd3', 'Buyer D3', 'deposit paid', '3 Aug 2026', '1,000', '1000', '', '2026-10-20', '07700 900603', 'd3@example.com', 'xx26-05'], // overdue
  ['LITTER-A', 'd4', 'Buyer D4', 'deposit paid', '2026-08-04', '500', '1500', '', '2027-03-01', '07700 900604', 'd4@example.com', 'xx26-06'], // not due yet
  ['LITTER-A', 'd5', 'Buyer D5', 'deposit paid', '2026-08-05', '500', '', '', '', '07700 900605', 'd5@example.com', ''], // no collection date
  ['LITTER-A', 'd6', 'Buyer D6', 'collected', '2026-06-01', '500', '1500', '1500', '2026-09-01', '07700 900606', 'd6@example.com', 'xx26-07'],
  ['CLOSED', 'c1', 'Buyer C1', 'refunded', '2026-01-01', '500', '', '', '', '07700 900621', 'c1@example.com', ''],
  ['WAITING', 'w1', 'Buyer W1', 'waiting', '', '', '', '', '', '07700 900611', 'w1@example.com', '']
];
// A Xero sales-invoice export: header names as Xero writes them; only email, number, date and amount paid are read.
const xeroCsv = '﻿ContactName,EmailAddress,POAddressLine1,InvoiceNumber,InvoiceDate,DueDate,Total,InvoiceAmountPaid,InvoiceAmountDue,Status\r\n'
  + '"Buyer E, One",e1@example.com,"1 Invented Road, Nowhere",INV-9001,05/10/2026,05/10/2026,500.00,500.00,0.00,Paid\r\n'
  + 'Buyer E Two,e2@example.com,,INV-9002,06/10/2026,06/10/2026,250.00,250.00,0.00,Paid\r\n'
  + 'Buyer E Three,e3@example.com,,INV-9003,07/10/2026,07/10/2026,500.00,0.00,500.00,Awaiting Payment\r\n'
  + 'Stranger,nobody@example.com,,INV-9004,08/10/2026,08/10/2026,500.00,500.00,0.00,Paid\r\n';
module.exports = { ledger, xeroCsv };
