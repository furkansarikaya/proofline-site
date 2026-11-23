(function () {
  var d = document.documentElement, m = matchMedia('(prefers-color-scheme: dark)'), s, t;
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
      function end() { clearTimeout(t); t = setTimeout(function () { c.classList.remove('done'); l.className = 'sr'; l.textContent = ''; }, 1800); }
      function ok() { c.classList.add('done'); l.className = 'sr'; l.textContent = c.getAttribute('data-done'); end(); }
      function no() {
        var r = document.createRange(), g = getSelection();
        r.selectNodeContents(p); g.removeAllRanges(); g.addRange(r);
        c.classList.remove('done'); l.className = 'msg'; l.textContent = c.getAttribute('data-fail'); end();
      }
      new Promise(function (y) { y(navigator.clipboard.writeText(p.innerText)); }).then(ok, no);
    });
  });
  if (m.addEventListener) m.addEventListener('change', name);
})();
