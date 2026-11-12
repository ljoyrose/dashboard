/* "Where is everyone?": the daily check, using the existing screen. */
StaffPage.register({ id: 'where', title: 'Where', icon: StaffPage.ctx.icons.dogs, order: 30, open: function (host, c) {
  host.textContent = 'Loading...';
  Promise.all([c.data(), c.readOptional('area_capacity')]).then(function (x) {
    var d = x[0], cap = x[1];
    host.textContent = '';
    if (!d.ok) { host.appendChild(c.h('p', { class: 'msg bad', text: d.message })); return; }
    BLDScreens.locationConfirm(host, { save: c.save, dogs: d.dogs, areas: sleepingRooms(d.areas, cap, c.today()), skipped: d.skipped, offSite: true });
  });
} });

/* Only sleeping rooms are offered (Lisa 12 Nov 2026: "only the rooms on the new cabin list ... not play areas or fields or
   corridors"): a room is offered when it has room-limit rows (BLD-area_capacity) in force today. Read from rows, no list here.
   If the limits cannot be read, every room that takes dogs is offered, rather than none. */
function sleepingRooms(areas, cap, today) {
  if (!cap || !cap.ok || !cap.rows || !cap.rows.length || typeof BLDCapacity === 'undefined') return areas;
  var has = {};
  BLDCapacity.inForce(cap.rows, today, 'from_date').forEach(function (r) { has[r.area_id] = true; });
  return areas.filter(function (a) { return has[a.id]; });
}
