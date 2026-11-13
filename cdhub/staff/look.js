/* The same Look as the CD Hub: reads Studio's saved choice ('dash-look', read only; this page never writes it). */
(function () {
  var o = {}; try { o = JSON.parse(localStorage.getItem('dash-look') || '{}') || {}; } catch (e) { o = {}; }
  var r = document.documentElement, c = r.classList;
  c.toggle('look-cool', o.bg === 'cool'); c.toggle('sel-soft', o.sel === 'soft');
  c.toggle('text-lg', o.text === 'lg'); c.toggle('text-xl', o.text === 'xl'); c.toggle('space-roomy', o.space === 'roomy');
  if (o.mode === 'light' || o.mode === 'dark') r.setAttribute('data-theme', o.mode);
}());
