/* GREENMINE — budget.js : Chiffrage par micro-zone, quantités, itinéraires GREENMINE TeC. */
"use strict";
/* Effet d'échelle : le coût au mètre carré décroît au-delà de la parcelle pilote. */
function scaleFactor(areaM2){
  const ha = Math.max(areaM2, 1)/10000;
  return ha <= 0.1 ? 1 : Math.pow(ha/0.1, -0.12);
}

function zoneBudget(zone){
  const area = Number.isFinite(zone.area) ? zone.area : 0;
  const units = area/1000;
  const f = scaleFactor(area);
  const cls = zone.diag.cls;
  const lines = POSTES.map(p => {
    const c = p.coef[cls];
    return {id:p.id, label:p.label, min:p.min*c*units*f, max:p.max*c*units*f};
  }).filter(l => l.max > 0);
  const min = lines.reduce((s,l) => s + l.min, 0);
  const max = lines.reduce((s,l) => s + l.max, 0);
  return {lines, min, max, factor:f, units};
}

function zoneQuantities(zone){
  const units = (Number.isFinite(zone.area) ? zone.area : 0)/1000;
  const d = VETIVER[zone.diag.cls];
  const b = zoneBudget(zone);
  const compost = b.lines.find(l => l.id === 'compost');
  return {
    vetiverMin: Math.round(d[0]*units), vetiverMax: Math.round(d[1]*units),
    compostMin: compost ? Math.round(compost.min/PRIX_COMPOST_KG) : 0,
    compostMax: compost ? Math.round(compost.max/PRIX_COMPOST_KG) : 0
  };
}

function renderTec(){
  const s = currentSite();
  if(!s || !s.zones.length){
    $('tecIntro').textContent = 'Aucun site sélectionné.';
    $('tecZones').innerHTML = '<div class="empty">Enregistrez au moins une micro-zone.</div>';
    $('tecWatch').innerHTML = '<div class="empty">Aucun diagnostic.</div>';
    return;
  }
  const ordered = s.zones.slice().sort((a,b) => a.diag.priority - b.diag.priority || b.diag.score - a.diag.score);
  $('tecIntro').textContent = 'Site « ' + s.name + ' » — les zones sont présentées dans l\'ordre d\'engagement des travaux.';
  $('tecZones').innerHTML = ordered.map((z,i) => {
    const q = zoneQuantities(z);
    const cl = CLASSES[z.diag.cls];
    return `<div class="card" style="border-color:${cl.color}">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center">
        <div><span class="pill p${z.diag.priority}">Ordre ${i+1} — priorité ${z.diag.priority}</span>
          <h2 style="margin:9px 0 2px">${esc(z.label)} <span style="color:${cl.color}">— zone ${z.diag.cls}</span></h2>
          <div class="sub" style="margin:0">${esc(z.kind)} • ${Number.isFinite(z.area) ? nf(z.area) + ' m²' : 'surface non renseignée'} • score ${z.diag.score}/100</div></div>
        <div class="sub" style="margin:0;text-align:right">${esc(PRIORITIES[z.diag.priority].horizon)}</div>
      </div>
      <div class="stack" style="margin-top:14px">${itineraire(z.diag.cls).map((st,j) =>
        `<div class="step"><div class="n">${j+1}</div><div><h3>${esc(st[0])}</h3><p>${esc(st[1])}</p><div class="when">${esc(st[2])}</div></div></div>`).join('')}</div>
      <h3>Espèces et quantités</h3>
      <div class="sub" style="margin:0">${esc(cl.especes)}</div>
      <div class="sub" style="margin:8px 0 0">${q.vetiverMax > 0 ? 'Vétiver : ' + nf(q.vetiverMin) + ' à ' + nf(q.vetiverMax) + ' plants. ' : 'Pas de plantation de vétiver sur cette classe. '}
        ${q.compostMax > 0 ? 'Compost mûr : ' + nf(q.compostMin) + ' à ' + nf(q.compostMax) + ' kg.' : ''}</div>
    </div>`;
  }).join('');
  $('tecWatch').innerHTML = watchFor(s).map(w =>
    `<div class="notice ${w.startsWith('Aucun point') ? '' : 'warn'}" style="margin-bottom:9px">${esc(w)}</div>`).join('');
}

function renderBudget(){
  const s = currentSite();
  if(!s || !s.zones.length){
    $('budgetIntro').textContent = 'Aucun site sélectionné.';
    $('budgetZones').innerHTML = '<div class="empty">Enregistrez au moins une micro-zone.</div>';
    $('budgetDetail').innerHTML = '';
    return;
  }
  const syn = siteSynthesis(s);
  $('budgetIntro').textContent = 'Site « ' + s.name + ' » — ' + nf(syn.area/10000, 2) + ' ha diagnostiqués.';

  const rows = s.zones.map(z => {
    const b = zoneBudget(z);
    return `<tr>
      <td><b>${esc(z.label)}</b></td>
      <td><b style="color:${CLASSES[z.diag.cls].color}">${z.diag.cls}</b></td>
      <td class="num">${Number.isFinite(z.area) ? nf(z.area) : '—'}</td>
      <td class="num">${b.factor.toFixed(2)}</td>
      <td class="num">${nf(b.min/1e6, 2)}</td>
      <td class="num">${nf(b.max/1e6, 2)}</td>
    </tr>`;
  }).join('');
  $('budgetZones').innerHTML = `<table class="table"><thead><tr><th>Zone</th><th>Classe</th><th class="num">Surface m²</th><th class="num">Coefficient d'échelle</th><th class="num">Bas (M FCFA)</th><th class="num">Haut (M FCFA)</th></tr></thead>
    <tbody>${rows}</tbody><tfoot><tr><td colspan="4">Total site</td><td class="num">${nf(syn.bmin/1e6, 2)}</td><td class="num">${nf(syn.bmax/1e6, 2)}</td></tr></tfoot></table>`;

  const agg = {};
  s.zones.forEach(z => zoneBudget(z).lines.forEach(l => {
    if(!agg[l.id]) agg[l.id] = {label:l.label, min:0, max:0};
    agg[l.id].min += l.min; agg[l.id].max += l.max;
  }));
  const detail = POSTES.filter(p => agg[p.id]).map(p =>
    `<tr><td>${esc(agg[p.id].label)}</td><td class="num">${nf(fcfa(agg[p.id].min))}</td><td class="num">${nf(fcfa(agg[p.id].max))}</td></tr>`).join('');
  $('budgetDetail').innerHTML = `<table class="table"><thead><tr><th>Poste</th><th class="num">Estimation basse (FCFA)</th><th class="num">Estimation haute (FCFA)</th></tr></thead>
    <tbody>${detail}</tbody><tfoot><tr><td>Total indicatif</td><td class="num">${nf(fcfa(syn.bmin))}</td><td class="num">${nf(fcfa(syn.bmax))}</td></tr></tfoot></table>`;
}

