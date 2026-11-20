// Stand-in for the Pagefind Component UI: opens a dialog, filters page titles. Sample only.
(function () {
  var me = document.currentScript, lang = me.getAttribute('data-lang'), none = me.getAttribute('data-none');
  var dlg = document.getElementById('search'), q = document.getElementById('sb-q'), res = document.getElementById('sb-res');
  var en = [['Concepts','Workflow','en-concept-workflow.html'],['Concepts','Gates','#'],['Concepts','Evidence, assumptions and unsupported checks','#'],['Concepts','Failover','#'],['Concepts','Night mode','#'],['Concepts','Roles','#'],['Concepts','Time limits','#'],['Guides','Daily use','#'],['Guides','Prompt catalogue','#'],['Guides','Task templates','#'],['Skills','tdd-proof','en-skill-tdd-proof.html'],['Skills','test-trust','#'],['Skills','verify-proof','#'],['Skills','visual-proof','#'],['Skills','plan-contract','#']];
  var tr = [['Kılavuzlar','Günlük kullanım','tr-guide-gunluk-kullanim.html'],['Kılavuzlar','Prompt kataloğu','#']];
  var data = lang === 'tr' ? tr : en;
  function draw() {
    var v = q.value.trim().toLowerCase(); res.innerHTML = '';
    if (!v) return;
    var hit = data.filter(function (r) { return r[1].toLowerCase().indexOf(v) > -1; });
    if (!hit.length) { res.innerHTML = '<li class="sb-note">' + none + '</li>'; return; }
    hit.forEach(function (r) { var li = document.createElement('li'); li.innerHTML = '<a href="' + r[2] + '"><span class="k"></span><span class="t"></span></a>'; li.querySelector('.k').textContent = r[0]; li.querySelector('.t').textContent = r[1]; res.appendChild(li); });
  }
  Array.prototype.forEach.call(document.querySelectorAll('.js-search'), function (x) { x.addEventListener('click', function () { if (!dlg.open) dlg.showModal(); q.focus(); q.select(); }); });
  q.addEventListener('input', draw);
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
})();
