/* plan.js : étape 5 — plan de réhabilitation, plantations conditionnelles, calendrier ; fil d'étapes ; blocs du rapport. */
"use strict";
function plantReco(s,z){
  const lab=(s.lab||[]).filter(l=>l.zoneId===z.id), m=z.metals||{};
  const known=METALS.filter(x=>Number.isFinite(m[x.id])), over=known.filter(x=>m[x.id]>=x.guide), ph=z.diag.values.ph;
  if(!lab.length) return 'Non évaluable : aucun résultat de laboratoire enregistré (étape 4) pour cette zone. Prélever et analyser avant toute recommandation de culture.';
  if(over.length) return 'Cultures alimentaires exclues : dépassement des valeurs guides ('+over.map(x=>x.label).join(', ')+'). Végétalisation non alimentaire (phytostabilisation) uniquement.';
  if(known.length<METALS.length) return 'Données incomplètes : As, Hg, Pb et Cd doivent tous être dosés avant d\'envisager une culture alimentaire.';
  if(!Number.isFinite(ph)||ph<5.5||ph>7.5) return 'pH '+(Number.isFinite(ph)?ph:'inconnu')+' hors de la plage indicative 5,5–7,5 : corriger le pH puis refaire une analyse.';
  return 'Métaux sous les valeurs guides et pH compatible : gazon et cultures comme la tomate peuvent être envisagés en essai pilote après traitement, sous validation agronomique et contrôle des produits. Ce n\'est pas une garantie de viabilité.';
}
function phAdvice(z){
  const ph=z.diag.values.ph;
  if(!Number.isFinite(ph)) return 'pH non mesuré : analyse nécessaire avant de choisir les amendements.';
  if(ph<5.5) return 'pH '+ph+' acide : amendement calcique à envisager ; dose à dimensionner d\'après l\'analyse (non calculée ici). Rechercher un drainage minier acide si pH < 5.';
  if(ph>7.5) return 'pH '+ph+' alcalin : apport de matière organique, à valider par un agronome.';
  return 'pH '+ph+' dans la plage indicative 5,5–7,5 : pas de correction prioritaire.';
}
function planHTML(s){
  if(!s||!s.zones.length) return '';
  const zs=s.zones.slice().sort((a,b)=>a.diag.priority-b.diag.priority||b.diag.score-a.diag.score), demo=/DÉMO/.test(s.name);
  const im=s.images||[], lab=s.lab||[];
  let h=demo?'<p class="notice warn">Site de démonstration : données fictives, aucune analyse réelle n\'a été exécutée.</p>':'';
  h+='<h3>Données utilisées</h3><p>'+im.length+' image(s) importée(s)'+(im.length?' ('+esc([...new Set(im.map(i=>i.source))].join(', '))+')':'')+' ; '+lab.length+' résultat(s) de laboratoire ; '+s.zones.length+' micro-zone(s). '+
    (s.geo?'Couches SIG importées.':'Aucune couche SIG importée : la carte est schématique.')+' Aucun traitement de télédétection n\'a été exécuté.</p>';
  if(im.length) h+='<p>'+im.slice(0,4).map(i=>'<img src="'+i.data+'" alt="'+esc(i.name)+'" style="height:90px;border-radius:8px;margin:0 6px 6px 0">').join('')+'</p>';
  h+=reportMapSVG(s);
  h+='<h3>Analyses de laboratoire</h3>'+(lab.length?'<table><thead><tr><th>Date</th><th>Zone</th><th class="num">pH</th><th class="num">As</th><th class="num">Hg</th><th class="num">Pb</th><th class="num">Cd</th></tr></thead><tbody>'+
    lab.map(l=>'<tr><td>'+dateFR(l.date)+'</td><td>'+esc(l.zoneLabel)+'</td>'+['ph','as','hg','pb','cd'].map(k=>'<td class="num">'+(Number.isFinite(l[k])?l[k]:'—')+'</td>').join('')+'</tr>').join('')+'</tbody></table>':'<p class="muted">Aucun résultat de laboratoire saisi.</p>');
  h+='<h3>Plan de réhabilitation et traitements</h3>'+zs.map((z,i)=>{const c=CLASSES[z.diag.cls],q=zoneQuantities(z);
    return '<h4>'+(i+1)+'. '+esc(z.label)+' — zone '+z.diag.cls+', priorité '+z.diag.priority+'</h4><p>'+esc(c.action)+'</p><p><b>pH :</b> '+esc(phAdvice(z))+'</p><p><b>Espèces :</b> '+esc(c.especes)+'</p>'+
      (q.vetiverMax>0?'<p><b>Quantité indicative :</b> '+nf(q.vetiverMin)+' à '+nf(q.vetiverMax)+' plants de vétiver.</p>':'');}).join('');
  h+='<h3>Recommandations de plantation</h3><p class="muted">Conditionnées aux analyses et à la faisabilité environnementale ; seuils indicatifs.</p>'+zs.map(z=>'<p><b>'+esc(z.label)+' :</b> '+esc(plantReco(s,z))+'</p>').join('');
  h+='<h3>Calendrier prévisionnel</h3><p class="muted">Objectif de la réunion : programme d\'assainissement jusqu\'à 6 mois. Les étapes marquées « Non » dépassent 6 mois (végétalisation, entretien, suivi) : l\'objectif n\'est tenu que pour les traitements initiaux.</p><table><thead><tr><th>Zone</th><th>Étape</th><th>Période</th><th>≤ 6 mois</th></tr></thead><tbody>'+
    zs.map(z=>itineraire(z.diag.cls).map(t=>{
      const done=t[0]==='Caractériser'&&(s.lab||[]).some(l=>l.zoneId===z.id), w=done?null:within6(t[2]);
      return '<tr><td>'+esc(z.label)+'</td><td>'+esc(t[0])+'</td><td>'+esc(done?'Réalisé : résultats saisis':t[2])+'</td><td>'+(done?'—':w===true?'Oui':w===false?'Non':'—')+'</td></tr>';}).join('')).join('')+'</tbody></table>';
  return h;
}
function renderPlan(){ const el=$('planOut'); if(el) el.innerHTML=currentSite()&&currentSite().zones.length?planHTML(currentSite()):'<p class="muted">Enregistrez le site et ses micro-zones pour générer le plan.</p>'; }
function renderParcours(){
  const s=currentSite(), el=$('stepbar'); if(!el) return;
  const lab=!!(s&&(s.lab||[]).length);
  const ok=[!!s,!!(s&&(s.images||[]).length),!!(s&&s.zones.some(z=>Number.isFinite(z.lat))),lab,lab,lab]; /* plan et rapport ne sont « complets » qu'avec des résultats de laboratoire */
  const L=[['diagnostic','Site'],['donnees','Images'],['cartographie','Carte'],['laboratoire','Labo'],['plan','Plan'],['rapport','Rapport']];
  el.innerHTML=L.map((l,i)=>'<button onclick="go(\''+l[0]+'\')" class="'+(ok[i]?'done':'')+'"><b>'+(ok[i]?'✓':i+1)+'</b>'+l[1]+'</button>').join('');
}

function within6(p){
  const m=/Mois (\d+)(?: à (\d+))?/.exec(p); if(m) return +(m[2]||m[1])<=6;
  return /Semaines?|Immédiat/.test(p)?true:null;
}
/* Carte schématique des zones par priorité (pas un levé SIG) pour le plan et le rapport. */
function reportMapSVG(s){
  const zs=s.zones.map((z,i)=>({z,i})).filter(o=>Number.isFinite(o.z.lat));
  if(!zs.length) return '<h3>Carte de priorisation</h3><p class="muted">Aucune micro-zone géolocalisée : carte non générée.</p>';
  const la0=zs[0].z.lat, lo0=zs[0].z.lon, k=Math.cos(la0*Math.PI/180)*111320;
  const R=zs.map(o=>{const h=Math.sqrt(Math.max(o.z.area||500,1))/2,x=(o.z.lon-lo0)*k,y=-(o.z.lat-la0)*111320;return{o,x0:x-h,x1:x+h,y0:y-h,y1:y+h};});
  const X0=Math.min(...R.map(r=>r.x0)),X1=Math.max(...R.map(r=>r.x1)),Y0=Math.min(...R.map(r=>r.y0)),Y1=Math.max(...R.map(r=>r.y1));
  const sc=Math.min(520/(X1-X0||1),340/(Y1-Y0||1)), W=(X1-X0)*sc+40, H=(Y1-Y0)*sc+40;
  const rects=R.map(r=>'<rect x="'+((r.x0-X0)*sc+20).toFixed(1)+'" y="'+((r.y0-Y0)*sc+20).toFixed(1)+'" width="'+((r.x1-r.x0)*sc).toFixed(1)+'" height="'+((r.y1-r.y0)*sc).toFixed(1)+'" fill="'+PRIO_COL[r.o.z.diag.priority]+'" fill-opacity=".75" stroke="#fff"/><text x="'+(((r.x0+r.x1)/2-X0)*sc+20).toFixed(1)+'" y="'+(((r.y0+r.y1)/2-Y0)*sc+24).toFixed(1)+'" text-anchor="middle" font-size="12" font-weight="700" fill="#111">'+(r.o.i+1)+'</text>').join('');
  const leg=[1,2,3,4].map(p=>'<span style="margin-right:14px"><span style="display:inline-block;width:11px;height:11px;background:'+PRIO_COL[p]+'"></span> '+PRIO_TXT[p]+'</span>').join('');
  return '<h3>Carte de priorisation (schématique)</h3><svg viewBox="0 0 '+W.toFixed(0)+' '+H.toFixed(0)+'" style="max-width:100%;width:'+Math.min(W,560).toFixed(0)+'px;background:#f1efe8;border-radius:8px" role="img" aria-label="Carte de priorisation">'+rects+'</svg><p>'+leg+'</p><p class="muted">Numéros = ordre des micro-zones saisies. Priorités issues des indicateurs saisis, non d\'une analyse d\'image. Carré à la surface déclarée, position approximative : pas un levé SIG.</p>';
}
