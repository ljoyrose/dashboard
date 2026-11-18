/* The same Look as the CD Hub: reads Studio's saved choice ('dash-look', read only; this page never writes it). */
(function () {
  var o = {}; try { o = JSON.parse(localStorage.getItem('dash-look') || '{}') || {}; } catch (e) { o = {}; }
  var r = document.documentElement, c = r.classList;
  c.toggle('look-cool', o.bg === 'cool'); c.toggle('sel-soft', o.sel === 'soft');
  c.toggle('text-lg', o.text === 'lg'); c.toggle('text-xl', o.text === 'xl'); c.toggle('space-roomy', o.space === 'roomy');
  if (o.mode === 'light' || o.mode === 'dark') r.setAttribute('data-theme', o.mode);
}());
/* Print in the light look (13 Nov 2026): dark mode printed pale text on white paper. Light for the print only, then
   back. Same in ../index.html. */
(function () {
  var r = document.documentElement, was = null, on = false;
  function light() { if (on) return; on = true; was = r.getAttribute('data-theme'); r.setAttribute('data-theme', 'light'); }
  function back() { if (!on) return; on = false; if (was === null) r.removeAttribute('data-theme'); else r.setAttribute('data-theme', was); }
  window.addEventListener('beforeprint', light); window.addEventListener('afterprint', back);
  if (window.matchMedia) { var mq = window.matchMedia('print'); if (mq.addListener) mq.addListener(function (e) { if (e.matches) light(); else back(); }); }
}());
