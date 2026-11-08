/* "Where is everyone?": the daily check, using the existing screen. */
StaffPage.register({ id: 'where', title: 'Where is everyone?', desc: 'Daily check of every dog', icon: StaffPage.ctx.icons.dogs, order: 30, open: function (host, c) {
  host.textContent = 'Loading...';
  c.data().then(function (d) {
    host.textContent = '';
    if (!d.ok) { host.appendChild(c.h('p', { class: 'msg bad', text: d.message })); return; }
    BLDScreens.locationConfirm(host, { save: c.save, dogs: d.dogs, areas: d.areas, skipped: d.skipped });
  });
} });
