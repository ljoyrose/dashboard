// Puppy Enquiries Hub: the invented example rows the page shows until the sheet id is in config.js (JOB 13 Stage 13).
// EVERY row here is made up: example.test addresses, 07700 900xxx numbers, no real person, message or pup.
// Times are built from "now" so the example always has a call tomorrow, enquiries today and a follow-up due.
(function (root) {
  'use strict';
  var Core = root.EnquiriesCore || (typeof require === 'function' ? require('./core.js') : null);
  var K = function (n) { return 'K-a' + String(n).padStart(15, '0'); };
  var F = function (n) { return 'F-f' + String(n).padStart(15, '0'); };

  // build(now) -> { Enquiries, People, Events, Drafts, FollowUps, Litters, 'Sale Replies', Deposits, Sources, Log, Results } as page rows.
  function build(now) {
    var t = now == null ? Date.now() : Core.toMs(now);
    var uk = function (hours) { return Core.toUk(t + hours * 3600000); };
    var day = function (days, hhmm) { return Core.toUk(t + days * 864e5).slice(0, 10) + 'T' + hhmm + ':00'; };
    var today = function (mins) { var s = Core.toUk(t), d = s.slice(0, 10), back = Core.toUk(t - mins * 60000); return back.slice(0, 10) === d ? back : d + 'T00:01:00'; };
    var row = function (n, o) {
      return Object.assign({ key: K(n), person_key: 'P-x' + n, source: 'Example', source_ref: '', received_uk: uk(-72), channel: 'email', kind: 'puppy',
        brand: 'Cobberdogs', country: 'United Kingdom', country_basis: 'stated', breed_interest: 'Cobberdog', size: '', colour: '', coat: '', sex: '',
        timing: '', household_flags: '', question_summary: '', score: 0, band: 'cool', stage: 'new', next_step: '', next_due_uk: '', owner: 'Lisa',
        do_not_contact: '', consent: 'ok', litter_ref: '', pup_ref: '', lost_reason: '', flag: '', ref: 'E-000' + n, score_reasons: '', updated_uk: uk(-1) }, o);
    };
    var person = function (n, o) {
      return Object.assign({ person_key: 'P-x' + n, ref: 'E-000' + n, name: 'Example' + n, email: 'buyer' + n + '@example.test', phone_e164: '+44770090010' + n,
        country: 'United Kingdom', country_basis: 'stated', sources: 'email', first_contact_uk: uk(-72), last_touch_uk: uk(-2), touches: 1,
        repeat_buyer: '', past_deposit: '', do_not_contact: '', consent: 'ok', match_confidence: 'exact', check: '', updated_uk: uk(-1) }, o);
    };
    var draft = function (n, kase, text) {
      return { draft_key: 'DR-x' + n + kase, enquiry_key: K(n), person_key: 'P-x' + n, case: kase, version: 1, text: text,
        links: 'https://doc.labradoodles.co.uk/breed', made_uk: uk(-1), status: 'ready', blocked_by: '' };
    };
    var info = 'https://doc.labradoodles.co.uk/breed';
    return {
      Enquiries: [
        row(1, { channel: 'calendly', source: 'Calendly', stage: 'call-booked', next_step: 'WhatsApp call', next_due_uk: day(1, '11:00'), score: 78, band: 'hot',
          question_summary: 'Hoping for a girl, medium size, caramel, home in about 2 months. We have a garden and I work from home.', litter_ref: 'L-EX1',
          score_reasons: 'Booked a call (+25) | Wants a pup within 3 months (+20) | 1 open pup fits what they asked (+20)' }),
        row(2, { received_uk: today(30), country: 'Spain', score: 22, band: 'cool', question_summary: 'Do you send puppies to Spain? Just looking for now.',
          score_reasons: 'Simple import (Spain) (+5)' }),
        row(3, { channel: 'cf-waiting-list', source: 'ClickFunnels', stage: 'replied', received_uk: uk(-120), score: 55, band: 'warm', litter_ref: 'L-EX1',
          question_summary: 'On the waiting list for a boy next year.', score_reasons: 'Home and dog experience sound right (+10)' }),
        row(4, { channel: 'web-form', source: 'Website', received_uk: today(10), score: 71, band: 'hot', question_summary: 'Ready for a deposit, wanting a puppy by spring.',
          score_reasons: 'Talks about a deposit or reserving (+20) | Wants a pup within 3 months (+20) | Lives in the UK (+10)' }),
        row(5, { received_uk: today(20), score: 40, band: 'warm', do_not_contact: 'yes', consent: 'do-not-contact', question_summary: 'Asked us not to write again.',
          score_reasons: 'Lives in the UK (+10)' }),
        row(6, { kind: 'adult-dog', channel: 'hubspot', source: 'HubSpot', stage: 'asked', received_uk: uk(-30), score: 30, band: 'cool',
          question_summary: 'Interested in group 2 from the adult-dog sale.', score_reasons: 'Lives in the UK (+10)' })
      ],
      People: [person(1, { sources: 'calendly' }), person(2, { country: 'Spain' }), person(3), person(4), person(5, { do_not_contact: 'yes', consent: 'do-not-contact' }), person(6)],
      Events: [
        { event_key: 'V-x1', enquiry_key: K(1), person_key: 'P-x1', at_uk: uk(-72), channel: 'calendly', type: 'booked', detail: '', source_ref: '' },
        { event_key: 'V-x3', enquiry_key: K(3), person_key: 'P-x3', at_uk: uk(-96), channel: 'email', type: 'replied', detail: '', source_ref: '' }
      ],
      Drafts: [
        draft(2, 'first-abroad', 'Hi Example2,\n\nThank you for getting in touch about our puppies. I\'d love to help.\n\n' + info + '\n\nKind regards,\n\nLisa'),
        draft(4, 'first-uk', 'Hi Example4,\n\nThank you for getting in touch about our puppies. I\'d love to help.\n\n' + info + '\n\nKind regards,\n\nLisa'),
        draft(5, 'first-uk', 'Hi Example5, this draft must never show. ' + info)
      ],
      FollowUps: [
        { followup_key: F(3), enquiry_key: K(3), person_key: 'P-x3', rule: 'first-reply', try: 1, due_uk: uk(-2), status: 'due', snoozed_to_uk: '', draft_key: '', updated_uk: uk(-2) },
        { followup_key: F(5), enquiry_key: K(5), person_key: 'P-x5', rule: 'first-reply', try: 1, due_uk: uk(-2), status: 'due', snoozed_to_uk: '', draft_key: '', updated_uk: uk(-2) }
      ],
      Litters: [
        { litter_key: 'L-p1', litter_ref: 'L-EX1', pup_ref: 'L-EX1-1', sex: 'female', colour: 'caramel', size: 'medium', coat: '', status: 'open', list: 'pups', person_key: '' },
        { litter_key: 'L-p2', litter_ref: 'L-EX1', pup_ref: 'L-EX1-2', sex: 'male', colour: 'black', size: 'standard', coat: '', status: 'open', list: 'pups', person_key: '' },
        { litter_key: 'L-p3', litter_ref: 'L-EX1', pup_ref: 'L-EX1-3', sex: 'male', colour: 'chocolate', size: 'medium', coat: '', status: 'reserved', list: 'pups', person_key: '' },
        { litter_key: 'L-w1', litter_ref: 'L-EX1', pup_ref: 'L-EX1-3', status: 'deposit', list: 'deposit list', list_order: 1, person_key: 'P-x7', deposit_date: day(-20, '10:00').slice(0, 10) },
        { litter_key: 'L-w2', litter_ref: 'L-EX1', pup_ref: '', status: 'waiting', list: 'waiting list', list_order: 1, person_key: 'P-x3', deposit_date: '' }
      ],
      'Sale Replies': [
        { reply_key: 'R-x6', group_ref: 'Group 2', dog_ref: 'Sample dog', enquiry_key: K(6), person_key: 'P-x6', reply_kind: 'reply', at_uk: uk(-30), sale_status: 'available' }
      ],
      Deposits: [
        { deposit_key: 'D-x7', litter_ref: 'L-EX1', pup_ref: 'L-EX1-3', person_key: 'P-x7', deposit_date: day(-20, '10:00').slice(0, 10), deposit: '500', balance_due: '1500',
          balance_paid: '', collection_date: day(14, '10:00').slice(0, 10), status: 'held', basis: 'example', check: '' }
      ],
      // Stage 15: invented Sources and engine Log rows, so the Alerts card has a silent source and a blank run to show.
      Sources: [
        { source: 'Calendly', lands_where: 'Calendly', machine_readable: 'yes', reader: 'calendly', last_read_uk: uk(-1), last_count: 0, status: 'live', note: '' },
        { source: 'Website', lands_where: 'Email', machine_readable: 'yes', reader: 'gmail', last_read_uk: uk(-1), last_count: 0, status: 'live', note: '' },
        { source: 'Pets4Homes', lands_where: 'Email', machine_readable: 'yes', reader: 'gmail', last_read_uk: uk(-1), last_count: 0, status: 'live', note: '' }
      ],
      Log: [
        { at_uk: uk(-1), level: 'INFO', step: 'run', message: 'start, DRY_RUN=false', count: '', dry_run: false, engine_version: 'example' },
        { at_uk: uk(-1), level: 'INFO', step: 'calendly', message: '0 calls, 0 enquiries', count: 0, dry_run: false, engine_version: 'example' },
        { at_uk: uk(-1), level: 'INFO', step: 'gmail', message: '0 threads read, 0 enquiries', count: 0, dry_run: false, engine_version: 'example' },
        { at_uk: uk(-1), level: 'INFO', step: 'run', message: 'done in 9s', count: '', dry_run: false, engine_version: 'example' }
      ],
      // Stage 14: invented history counts (as the one-off HubSpot import writes them), before the live months.
      Results: [
        { result_key: 'R-2026-03-hubspot-legacy-hubspot-history', month: '2026-03', source: 'hubspot-legacy', basis: 'hubspot-history', enquiries: 10, calls_booked: 6,
          calls_held: 4, offers: 1, deposits: 2, balances: 1, collected: 1, lost: 3, junk: 4, adult_sale: 0, median_reply_h: '', lost_reasons: 'timing:2 | went elsewhere:1', made_uk: uk(-1) },
        { result_key: 'R-2026-04-deposit-list-deposit-list', month: '2026-04', source: 'deposit-list', basis: 'deposit-list', enquiries: 0, calls_booked: 0,
          calls_held: 0, offers: 0, deposits: 3, balances: 0, collected: 0, lost: 0, junk: 0, adult_sale: 0, median_reply_h: '', lost_reasons: '', made_uk: uk(-1) }
      ]
    };
  }

  var api = { build: build, K: K, F: F };
  root.EnquiriesExamples = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
