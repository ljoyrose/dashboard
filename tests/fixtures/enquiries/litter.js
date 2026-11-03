// Invented allocation and sale-sheet shapes for Stage 10. Nobody and no dog here is real: example.com, Ofcom fiction
// numbers (07700 900xxx), made-up pup refs (xx26-*) and dog names.
'use strict';
const H = ['section', 'ref', 'name', 'status', 'deposit_date', 'whatsapp', 'email', 'ppf (colour/gender)', 'notes', 'provisional_pup'];
const current = [H,
  ['PUPS', 'xx26-01', '', 'open', '', '', '', 'chocolate girl', 'medium fleece', ''],
  ['PUPS', 'xx26-02', '', 'open', '', '', '', 'cream boy', 'mini wool', ''],
  ['PUPS', 'xx26-03', '', 'offered', '', '', '', 'caramel girl', '', ''],
  ['PUPS', 'xx26-04', '', 'provisional', '', '', '', 'black boy', '', ''],
  ['PUPS', 'xx26-05', '', 'allocated', '', '', '', 'chocolate boy', '', ''],
  ['PUPS', 'xx26-06', '', 'sold', '', '', '', 'cream girl', '', ''],
  ['PUPS', 'xx26-07', '', 'sold', '', '', '', 'red boy', '', ''],
  ['LITTER-A', 'd1', 'Buyer D1', 'deposit paid', '2026-08-01', '07700 900601', 'd1@example.com', 'chocolate girl', '', ''],
  ['LITTER-A', 'd2', 'Buyer D2', 'deposit paid', '2026-08-02', '07700 900602', 'd2@example.com', 'cream boy', '', ''],
  ['LITTER-A', 'd3', 'Buyer D3', 'deposit paid', '2026-08-03', '07700 900603', 'd3@example.com', 'girl', '', ''],
  ['LITTER-A', 'd4', 'Buyer D4', 'deposit paid', '2026-08-04', '07700 900604', 'd4@example.com', 'caramel girl', '', 'xx26-03'],
  ['LITTER-A', 'd5', 'Buyer D5', 'deposit paid', '2026-08-05', '07700 900605', 'd5@example.com', '', '', 'xx26-04'],
  ['LITTER-A', 'd6', 'Buyer D6', 'deposit paid', '2026-08-06', '07700 900606', 'd6@example.com', '', '', 'xx26-05'],
  ['LITTER-A', 'd7', 'Buyer D7', 'deposit paid', '2026-08-07', '07700 900607', 'd7@example.com', '', '', 'xx26-06'],
  ['LITTER-A', 'd8', 'Buyer D8', 'deposit paid', '2026-08-08', '07700 900608', 'd8@example.com', '', '', 'xx26-07'],
  ['WAITING', 'w1', 'Buyer W1', 'waiting', '', '07700 900611', 'w1@example.com', 'chocolate girl', '', ''],
  ['WAITING', 'w2', 'Buyer D2', 'waiting', '', '07700 900602', 'd2@example.com', 'black girl', '', ''],
  ['WAITING', 'w3', 'Buyer W3', 'waiting', '', '07700 900613', 'w3@example.com', 'red boy', '', ''],
  ['CLOSED', 'c1', 'Buyer C1', 'refunded', '2026-01-01', '07700 900621', 'c1@example.com', 'chocolate girl', '', '']
];
// The sale sheet has a Price column and other columns the hub must never read.
const sale = [['Sale group', 'Name', 'Sex', 'Price', 'COI', 'Colour', 'Status'],
  ['1', 'Dog Alpha', 'F', '9999', '5.1%', 'Apricot', 'For sale'],
  ['1', 'Dog Bravo', 'F', '9999', '4.0%', 'Black', 'For sale'],
  ['1', 'Dog Charlie', 'M', '9999', '3.2%', 'Chocolate', 'Viewing booked'],
  ['2', 'Dog Delta/Echo', 'F', '8888', '6.5%', 'Cream', ''],
  ['Individual (neutered)', 'Dog Foxtrot', 'M', '7777', '2.0%', 'Black', 'Agreed']
];
module.exports = { current, sale };
