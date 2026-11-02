// 12 invented emails for the Stage 4 classifier: 6 enquiries and 6 noise. Nobody is real: example.com
// addresses (the sender's role is in the part before the @), Ofcom fiction numbers (07700 900xxx) and made-up text.
'use strict';

const FORM_SENDERS = ['wordpress@example.com', 'myclickfunnels-notify@example.com', 'hubspot-forms@example.com'];
const NOISE_SENDERS = ['ga-petfood-orders@example.com'];

const emails = [
  // ---- enquiries ----
  { id: 'enq-wp', want: { enquiry: true, channel: 'web-form', kind: 'puppy' },
    from: 'WordPress <wordpress@example.com>', subject: 'New submission from Contact Us',
    body: 'Name: Buyer D\nEmail: buyer.d@example.com\nPhone: 07700 900104\nMessage: Hi, do you have any Labradoodle puppies due next year? We have a large garden.\n' },
  { id: 'enq-direct', want: { enquiry: true, channel: 'email', kind: 'puppy' },
    from: 'Buyer E <buyer.e@example.com>', subject: 'Cobberdog puppy',
    body: 'Hello Lisa, we are looking for a Cobberdog puppy for our family in spring. Is there a waiting list? Thank you, Buyer E' },
  { id: 'enq-cf', want: { enquiry: true, channel: 'cf-website-optin', kind: 'puppy' },
    from: 'ClickFunnels <myclickfunnels-notify@example.com>', subject: 'New opt-in on Home',
    body: 'First name: Buyer F\nLast name: Example\nEmail: buyer.f@example.com\nPhone: +44 7700 900106\nHow can we help?: Interested in a chocolate girl\n' },
  { id: 'enq-hubspot', want: { enquiry: true, channel: 'hubspot', kind: 'breeding-set' },
    from: 'HubSpot Forms <hubspot-forms@example.com>', subject: 'New form submission: Breeder enquiry',
    body: 'Email: breeder.g@example.com\nMessage: I am a breeder and would like to buy a breeding set with breeding rights.\n' },
  { id: 'enq-stud', want: { enquiry: true, channel: 'email', kind: 'stud' },
    from: 'Buyer H <buyer.h@example.com>', subject: 'Stud enquiry',
    body: 'Is your boy available at stud this winter? I would like him to cover my girl.' },
  { id: 'enq-adult', want: { enquiry: true, channel: 'email', kind: 'adult-dog' },
    from: 'Buyer J <buyer.j@example.com>', subject: 'Retired girl',
    body: 'I saw you are rehoming a retired breeding girl. We would love to give her a home, is she still available?' },
  // ---- noise ----
  { id: 'noise-invoice', want: { enquiry: false },
    from: 'Accounts <supplier-accounts@example.com>', subject: 'Invoice INV-0042 from Supplier Example Ltd',
    body: 'Please find attached your invoice. Amount due: see attached. VAT number on the invoice. Thank you for your puppy pads order.' },
  { id: 'noise-seo', want: { enquiry: false },
    from: 'Reports <seo-tool-reports@example.com>', subject: 'Your weekly SEO report for your Labradoodle website',
    body: 'Keyword rankings: labradoodle puppies up 2. Backlinks: 14 new. Domain authority 21. Are you available for a call about our premium plan?' },
  { id: 'noise-ga', want: { enquiry: false },
    from: 'GA Orders <ga-petfood-orders@example.com>', subject: 'Updated puppy food range',
    body: 'Do you have space for our new puppy food range? We would love to send samples.' },
  { id: 'noise-promo', want: { enquiry: false }, labels: ['CATEGORY_PROMOTIONS'],
    from: 'Pet Shop <petshop-deals@example.com>', subject: '20% off puppy toys this weekend',
    body: 'Looking for the perfect puppy toy? Shop now. To unsubscribe click here.' },
  { id: 'noise-wordfence', want: { enquiry: false },
    from: 'WordPress <wordpress@example.com>', subject: '[Wordfence Alert] Problems found on your site',
    body: 'Wordfence found the following new issues on your site. Plugin needs an update.' },
  { id: 'noise-calendly', want: { enquiry: false },
    from: 'Calendly <notifications' + '@' + 'calendly.com>'  /* assembled: the real system sender, no person */, subject: 'New Event: Buyer K - 10:00 Fri, 30 Oct - Whatsapp Call',
    body: 'Invitee: Buyer K. How can I help?: Puppies. (The Calendly reader handles these.)' }
];

module.exports = { emails, FORM_SENDERS, NOISE_SENDERS };
