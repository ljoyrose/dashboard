/* "Where is everyone?": the daily check, using the existing screen. */
StaffPage.register({ id: 'where', title: 'Where', icon: StaffPage.ctx.icons.dogs, order: 30, open: function (host, c) {
  host.textContent = 'Loading...';
  Promise.all([c.data(), c.readOptional('area_capacity')]).then(function (x) {
    var d = x[0], cap = x[1];
    host.textContent = '';
    if (!d.ok) { host.appendChild(c.h('p', { class: 'msg bad', text: d.message })); return; }
    BLDScreens.locationConfirm(host, { save: c.save, dogs: d.dogs, areas: sleepingRooms(d.areas, cap, c.today()), skipped: d.skipped, offSite: true,
      onMoved: function (id, to) { if (c.noteMove) c.noteMove(to ? { id: 'local-' + Date.now() + '-' + id, subject_id: id, area_id: to, moved_in: c.today() } : { id: 'local-' + Date.now() + '-' + id, subject_id: id, off_site_kind: 'temporary', moved_in: c.today() }); } });
    BLDScreens.locationConfirm(host, { save: c.save, dogs: d.dogs, areas: sleepingRooms(d.areas, cap, c.today()), skipped: d.skipped, offSite: true });
    findDog(host, c);
  });
} });

/* Find a dog (the owner 22 Nov 2026: "otherwise can't find them easily"). Typing shows only the dogs whose name holds the text,
   any case, anywhere in the name, each with its room as before. Clear shows them all again. Only hides cards on this
   phone: nothing is saved or read. While a search is on, "All the rest unmoved" is hidden, because it confirms every dog,
   including the ones the search hides; it comes back when the search is cleared. */
function findDog(host, c) {
  var cards = host.querySelector('.bs-cards');
  if (!cards || !cards.querySelector('[data-dog]')) return;   // no dogs: nothing to find
  var input = c.h('input', { class: 'inp', type: 'search', id: 'where-find', 'aria-label': 'Find a dog', placeholder: 'Find a dog',
    autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'search', style: 'font-size:16px;min-height:48px;width:100%' });
  var clearBtn = c.h('button', { class: 'btn quiet', type: 'button', 'data-where-clear': '1', text: 'Clear', hidden: true, style: 'display:none' });
  var none = c.h('p', { class: 'sub', id: 'where-none', role: 'status', 'aria-live': 'polite', hidden: true });
  cards.parentNode.insertBefore(c.h('div', { class: 'where-find' }, [input, clearBtn, none]), cards);
  function run() {
    var raw = input.value, q = raw.trim().toLowerCase(), shown = 0;
    Array.prototype.forEach.call(cards.querySelectorAll('[data-dog]'), function (card) {
      var n = card.querySelector('.bs-dog-name'), on = !q || (n ? n.textContent : '').toLowerCase().indexOf(q) >= 0;
      card.hidden = !on; if (on) shown++;
    });
    var awayH = cards.querySelector('.bs-away-h');
    if (awayH) awayH.hidden = !!q && !cards.querySelector('.bs-away[data-dog]:not([hidden])');
    none.hidden = !q || shown > 0;
    none.textContent = q && !shown ? "No dog called '" + raw.trim() + "'" : '';
    clearBtn.hidden = !q; clearBtn.style.display = q ? '' : 'none';   // .btn sets display, so hidden alone would not hide it
    var rest = host.querySelector('.bs-sticky'); if (rest) rest.hidden = !!q;
  }
  input.addEventListener('input', run);
  clearBtn.addEventListener('click', function () { input.value = ''; run(); input.focus(); });
}

/* Only sleeping rooms are offered (the owner 12 Nov 2026: "only the rooms on the new cabin list ... not play areas or fields or
   corridors"): a room is offered when it has room-limit rows (BLD-area_capacity) in force today. Read from rows, no list here.
   If the limits cannot be read, every room that takes dogs is offered, rather than none. */
function sleepingRooms(areas, cap, today) {
  if (!cap || !cap.ok || !cap.rows || !cap.rows.length || typeof BLDCapacity === 'undefined') return areas;
  var has = {};
  BLDCapacity.inForce(cap.rows, today, 'from_date').forEach(function (r) { has[r.area_id] = true; });
  return areas.filter(function (a) { return has[a.id]; });
}
