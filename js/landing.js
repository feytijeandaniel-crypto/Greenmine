/* GREENMINE — landing.js : menu mobile et démo interactive (réutilise le moteur computeZone) */
"use strict";
(function(){
  let step=1;
  const $=id=>document.getElementById(id);
  function show(n){
    step=n;
    document.querySelectorAll('.dstep').forEach(e=>e.hidden=+e.dataset.s!==n);
    document.querySelectorAll('.tabs span').forEach(e=>e.classList.toggle('on',+e.dataset.s===n));
    $('dBack').hidden=n===1; $('dNext').hidden=n===3;
  }
  window.demoBack=()=>show(step-1);
  window.demoNext=function(){
    if(step===1&&!$('dName').value.trim()){ $('dName').focus(); return; }
    if(step===2){
      const v={};
      [['veg','dVeg'],['erosion','dEro'],['ph','dPh']].forEach(([k,id])=>{ const x=parseFloat($(id).value); if(isFinite(x)) v[k]=x; });
      const d=computeZone(v,null);
      if(!d){ $('dVeg').focus(); return; }
      const c=CLASSES[d.cls];
      $('dOut').innerHTML='<p class="eyebrow">Diagnostic simulé — démonstration</p><h3>'+esc($('dName').value)+'</h3>'+
        '<p class="big">Score '+d.score+'/100 · Zone '+d.cls+' · Priorité '+d.priority+'</p>'+
        '<p><b>'+esc(c.etat)+'.</b> '+esc(c.action)+'</p>'+
        '<p class="muted">Confiance '+d.completeness+' %. Résultat indicatif du moteur de règles, pas une mesure.</p>';
    }
    show(step+1);
  };
  show(1);
  $('burger').addEventListener('click',()=>$('menu').classList.toggle('open'));
  $('menu').addEventListener('click',()=>$('menu').classList.remove('open'));
})();
