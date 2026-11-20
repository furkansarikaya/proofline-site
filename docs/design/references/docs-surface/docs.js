(function () {
  var d = document.documentElement, m = matchMedia('(prefers-color-scheme: dark)'), s;
  try { s = localStorage.getItem('theme'); } catch (e) {}
  d.classList.add('js');
  if (s === 'dark' || s === 'light') d.dataset.theme = s;
  function cur() { return d.dataset.theme || (m.matches ? 'dark' : 'light'); }
  function $(i) { return document.getElementById(i); }
  function name() { var b = $('b-theme'); if (b) b.setAttribute('aria-label', b.getAttribute('data-name-' + cur())); }
  addEventListener('DOMContentLoaded', function () {
    var b = $('b-theme'), l = $('live'), i, n, links = {}, hs, io;
    name();
    if (b) b.addEventListener('click', function () {
      var t = cur() === 'dark' ? 'light' : 'dark';
      d.dataset.theme = t;
      try { localStorage.setItem('theme', t); } catch (e) {}
      name();
    });
    n = document.querySelectorAll('.copy');
    for (i = 0; i < n.length; i++) n[i].addEventListener('click', function (e) {
      var c = e.currentTarget, p = c.parentNode.querySelector('pre');
      function pick() { var r = document.createRange(), g = getSelection(); r.selectNodeContents(p); g.removeAllRanges(); g.addRange(r); l.textContent = c.getAttribute('data-fail'); }
      (navigator.clipboard ? navigator.clipboard.writeText(p.innerText) : Promise.reject()).then(function () { l.textContent = c.getAttribute('data-done'); }, pick);
      c.classList.add('done');
      setTimeout(function () { c.classList.remove('done'); l.textContent = ''; }, 1800);
    });
    n = document.querySelectorAll('[data-menu]');
    for (i = 0; i < n.length; i++) n[i].addEventListener('click', function (e) {
      var c = e.currentTarget, p = $(c.getAttribute('data-menu')), o = !p.classList.contains('open');
      p.classList.toggle('open', o); c.setAttribute('aria-expanded', o);
    });
    addEventListener('keydown', function (e) {
      var t = e.target.tagName, k = e.key;
      if ((k === '/' && t !== 'INPUT' && t !== 'TEXTAREA') || ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'k')) { e.preventDefault(); if ($('b-search')) $('b-search').click(); }
    });
    if ('IntersectionObserver' in window) {
      n = document.querySelectorAll('.toc a'); for (i = 0; i < n.length; i++) links[n[i].getAttribute('href').slice(1)] = n[i];
      io = new IntersectionObserver(function (es) {
        es.forEach(function (x) { if (x.isIntersecting) { for (var k in links) links[k].removeAttribute('aria-current'); if (links[x.target.id]) links[x.target.id].setAttribute('aria-current', 'true'); } });
      }, { rootMargin: '0px 0px -75% 0px' });
      hs = document.querySelectorAll('.prose h2[id],.prose h3[id],.shared[id]');
      for (i = 0; i < hs.length; i++) io.observe(hs[i]);
    }
  });
  if (m.addEventListener) m.addEventListener('change', name);
})();
