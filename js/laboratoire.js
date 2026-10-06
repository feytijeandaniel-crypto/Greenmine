/* laboratoire.js : étape 4 — résultats d'analyses de laboratoire, appliqués au diagnostic de la zone. */
"use strict";
function renderLab(){
  const s=currentSite(), sel=$('lz'); if(!sel) return;
  sel.innerHTML=s&&s.zones.length?s.zones.map(z=>'<option value="'+z.id+'">'+esc(z.label)+'</option>').join(''):'<option value="">Aucune micro-zone</option>';
  const lab=s&&s.lab||[];
  $('labTable').innerHTML=lab.length?'<table class="table"><thead><tr><th>Date</th><th>Zone</th><th>Laboratoire / réf.</th><th class="num">pH</th><th class="num">As</th><th class="num">Hg</th><th class="num">Pb</th><th class="num">Cd</th></tr></thead><tbody>'+
    lab.map(l=>'<tr><td>'+dateFR(l.date)+'</td><td>'+esc(l.zoneLabel)+'</td><td>'+esc(l.labo||'—')+' '+esc(l.ref||'')+'</td>'+['ph','as','hg','pb','cd'].map(k=>'<td class="num">'+(Number.isFinite(l[k])?l[k]:'—')+'</td>').join('')+'</tr>').join('')+'</tbody></table>':'<div class="empty">Aucun résultat saisi. Prélevez d\'abord sur la zone rouge.</div>';
}
function saveLab(){
  const s=currentSite(); if(!s||!s.zones.length){ toast('Créez d\'abord le site et ses micro-zones.',true); return; }
  const z=s.zones.find(x=>x.id===$('lz').value); if(!z) return;
  const r={id:uid('L'),zoneId:z.id,zoneLabel:z.label,date:$('ld').value||new Date().toISOString().slice(0,10),labo:$('ll').value.trim(),ref:$('lr').value.trim(),
    ph:readField('lph'),as:readField('las'),hg:readField('lhg'),pb:readField('lpb'),cd:readField('lcd')};
  if(!['ph','as','hg','pb','cd'].some(k=>r[k]!==null)){ toast('Saisissez au moins une valeur mesurée.',true); return; }
  (s.lab=s.lab||[]).push(r);
  const m=Object.assign({},z.metals||{}); ['as','hg','pb','cd'].forEach(k=>{ if(r[k]!==null) m[k]=Math.max(0,r[k]); });
  const v=Object.assign({},z.diag.values); if(r.ph!==null) v.ph=clamp(r.ph,0,14);
  z.metals=Object.keys(m).length?m:null; z.diag=computeZone(v,z.metals);
  store.save(); ['ld','ll','lr','lph','las','lhg','lpb','lcd'].forEach(id=>$(id).value='');
  renderAll(); toast('Résultats appliqués à « '+z.label+' » : classe '+z.diag.cls+', priorité '+z.diag.priority+'.');
}
