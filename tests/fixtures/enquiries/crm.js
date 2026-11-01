// Invented ClickFunnels and HubSpot shapes for Stage 5. Nobody is real: example.com, Ofcom fiction numbers, made-up ids.
'use strict';

const runs = [
  // Website Optin: 3 real opt-ins
  { id: 'RUN-SAMPLE-1', workflow: 'Website Optin', created_at: '2025-08-14T18:20:00Z', page: 'home',
    contact: { id: 'C-SAMPLE-1', email: 'buyer.m@example.com', phone: '07700 900201', first_name: 'Buyer', last_name: 'M', tags: [] } },
  { id: 'RUN-SAMPLE-2', workflow: 'Website Optin', created_at: '2026-07-31T09:00:00Z', page: 'home',
    contact: { id: 'C-SAMPLE-2', email: 'buyer.n@example.com', first_name: 'Buyer', last_name: 'N', tags: ['Breeder-Email-OptedOut'] } },
  { id: 'RUN-SAMPLE-3', workflow: 'Website Optin', created_at: '2026-08-01T21:10:00Z', page: 'home',
    contact: { id: 'C-SAMPLE-3', email: 'buyer.p@example.com', phone: '+41 79 000 00 03', first_name: 'Buyer', last_name: 'P', tags: ['LD-Breeder-X-DONT-CONTACT'] } },
  // Breeding Cobberdogs: anonymous page views (no contact data) - noise
  { id: 'RUN-SAMPLE-4', workflow: 'Breeding Cobberdogs', created_at: '2025-06-14T10:00:00Z', page: 'breeding', contact: null },
  { id: 'RUN-SAMPLE-5', workflow: 'Breeding Cobberdogs', created_at: '2026-06-07T11:00:00Z', page: 'breeding', contact: { id: 'C-ANON-5', tags: [] } },
  // Breeding Cobberdogs: one real breeder form
  { id: 'RUN-SAMPLE-6', workflow: 'Breeding Cobberdogs', created_at: '2026-05-02T12:00:00Z', page: 'breeding',
    contact: { id: 'C-SAMPLE-6', email: 'breeder.q@example.com', first_name: 'Breeder', last_name: 'Q', tags: ['Breeder'] } }
];

// Page submissions in the same workspace (for OW-0003 matching by page and time).
const submissions = [
  { id: 'SUB-SAMPLE-1', page: 'breeding', created_at: '2026-06-07T11:04:00Z', contact: { email: 'breeder.r@example.com' } },
  { id: 'SUB-SAMPLE-2', page: 'breeding', created_at: '2025-06-14T12:30:00Z', contact: { email: 'breeder.s@example.com' } },  // 2.5 h off: no match
  { id: 'SUB-SAMPLE-3', page: 'home', created_at: '2026-06-07T11:01:00Z', contact: { email: 'buyer.t@example.com' } },          // wrong page
  { id: 'SUB-SAMPLE-4', page: 'breeding', created_at: '2026-06-07T11:02:00Z', contact: null }                                     // probe, no contact
];

const hubspot = [
  { id: 'HS-SAMPLE-1', properties: { email: 'Buyer.M@example.com', firstname: 'Buyer', lastname: 'M', phone: '', createdate: '2026-09-30T10:00:00Z', recent_conversion_event_name: 'Australian Cobberdogs as Therapy Dogs' } },
  { id: 'HS-SAMPLE-2', properties: { email: 'qXwLmZpRtBv@example.com', firstname: 'qXwLmZpRtBv', lastname: '', createdate: '2026-10-02T00:45:00Z' } },
  { id: 'HS-SAMPLE-3', properties: { email: 'a.b.c.d.e.f@example.com', firstname: 'Xhhhgrtq', lastname: '', createdate: '2026-10-02T12:45:00Z' } },
  { id: 'HS-SAMPLE-4', properties: { email: '', firstname: 'No', lastname: 'Contact', createdate: '2026-10-03T12:45:00Z' } },
  { id: 'HS-SAMPLE-5', properties: { email: 'buyer.u@example.com', firstname: 'Buyer', lastname: 'U', phone: '07700 900205', createdate: '2026-10-10T08:00:00Z', hs_email_optout: 'true', message: 'Do you have any puppies?' } }
];

module.exports = { runs, submissions, hubspot };
