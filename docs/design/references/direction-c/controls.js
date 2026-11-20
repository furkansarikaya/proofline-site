(function () {
  var d = document.documentElement, m = matchMedia('(prefers-color-scheme: dark)'), s;
  try { s = localStorage.getItem('theme'); } catch (e) {}
  d.classList.add('js');
  if (s === 'dark' || s === 'light') d.dataset.theme = s;
  function cur() { return d.dataset.theme || (m.matches ? 'dark' : 'light'); }
  function $(i) { return document.getElementById(i); }
  function name() { var b = $('b-theme'); if (b) b.setAttribute('aria-label', b.getAttribute('data-name-' + cur())); }
  addEventListener('DOMContentLoaded', function () {
    var b = $('b-theme'), c = $('b-copy');
    name();
    if (b) b.addEventListener('click', function () {
      var n = cur() === 'dark' ? 'light' : 'dark';
      d.dataset.theme = n;
      try { localStorage.setItem('theme', n); } catch (e) {}
      name();
    });
    if (c) c.addEventListener('click', function () {
      var p = $('cmd'), l = $('live');
      function pick() { var r = document.createRange(), g = getSelection(); r.selectNodeContents(p); g.removeAllRanges(); g.addRange(r); l.textContent = c.getAttribute('data-fail'); }
      (navigator.clipboard ? navigator.clipboard.writeText(p.innerText) : Promise.reject()).then(function () { l.textContent = c.getAttribute('data-done'); }, pick);
      c.classList.add('done');
      setTimeout(function () { c.classList.remove('done'); l.textContent = ''; }, 1800);
    });
  });
  if (m.addEventListener) m.addEventListener('change', name);
})();
