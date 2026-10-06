/* GREENMINE — app.js : Navigation, tableau de bord, rendu général et initialisation. */
"use strict";
/* ============================================================
   4. NAVIGATION
   ============================================================ */
function go(id){
  document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s.id === id));
  document.querySelectorAll('#nav button').forEach(b => {
    if(b.dataset.go === id) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current');
  });
  const active = document.querySelector('#nav button[aria-current="page"] span:nth-child(2)');
  $('crumb').textContent = active ? active.textContent : id;
  if(id === 'cartographie') setTimeout(() => { if(state.map) state.map.invalidateSize(); }, 60);
  window.scrollTo(0,0);
}

function currentSite(){ return state.sites.find(s => s.id === state.currentId) || null; }

/* ============================================================
   7. RENDU
   ============================================================ */
function renderAll(){
  renderDashboard(); renderZoneList(); renderClasses(); renderTec();
  renderBudget(); renderFollowups(); renderReport(); renderMap(); renderFiles(); renderImages(); renderLab(); renderPlan(); renderParcours();
  const s = currentSite();
  $('currentSite').textContent = s ? s.name + ' — ' + s.zones.length + ' zone(s)' : 'Aucun site sélectionné';
  $('navSites').textContent = state.sites.length;
}

function sharesBar(shares, total){
  if(!total) return '';
  const bar = Object.keys(CLASSES).filter(k => shares[k] > 0)
    .map(k => '<i style="width:' + (shares[k]/total*100).toFixed(1) + '%;background:' + CLASSES[k].color + '"></i>').join('');
  const leg = Object.keys(CLASSES).filter(k => shares[k] > 0).map(k =>
    '<span><b style="color:' + CLASSES[k].color + '">' + k + '</b> ' + nf(shares[k]/10000, 2) + ' ha (' + Math.round(shares[k]/total*100) + ' %)</span>').join('');
  return '<div class="shares">' + bar + '</div><div class="shares-leg">' + leg + '</div>';
}

function renderDashboard(){
  const n = state.sites.length;
  $('kSites').textContent = n;
  const allZones = state.sites.reduce((a,s) => a.concat(s.zones), []);
  $('kZones').textContent = allZones.length ? allZones.length + ' micro-zones' : 'aucune micro-zone';

  const totalArea = allZones.reduce((s,z) => s + (z.area || 0), 0);
  $('kArea').textContent = totalArea ? nf(totalArea/10000, 2) : '—';
  const p1 = allZones.filter(z => z.diag.priority === 1).reduce((s,z) => s + (z.area || 0), 0);
  $('kP1').textContent = allZones.length ? nf(p1/10000, 2) + ' ha' : '—';
  const bmin = allZones.reduce((s,z) => s + zoneBudget(z).min, 0);
  $('kBudget').textContent = allZones.length ? nf(bmin/1e6, 1) : '—';

  const shares = {A:0,B:0,C:0,D:0,E:0};
  allZones.forEach(z => { shares[z.diag.cls] += z.area || 0; });
  $('globalShares').innerHTML = totalArea ? sharesBar(shares, totalArea) : '<div class="empty">Aucune zone diagnostiquée.</div>';

  if(!n){ $('siteTable').innerHTML = '<div class="empty">Aucun site. Créez un site ou chargez la démonstration.</div>'; return; }
  const rows = state.sites.map(s => {
    const syn = siteSynthesis(s);
    return `<tr onclick="openSite('${s.id}')" style="cursor:pointer">
      <td><b>${esc(s.name)}</b><br><span style="color:var(--muted-2);font-size:11px">${esc(s.type)}</span></td>
      <td class="num">${s.zones.length}</td>
      <td>${syn ? '<span class="pill p' + syn.priority + '">P' + syn.priority + '</span>' : '—'}</td>
      <td class="num">${syn ? syn.score : '—'}</td>
      <td class="num">${syn ? nf(syn.area/10000, 2) : '—'}</td>
      <td class="num">${syn ? nf(syn.bmin/1e6, 1) + ' – ' + nf(syn.bmax/1e6, 1) : '—'}</td>
      <td class="num"><button class="btn sm danger" onclick="deleteSite('${s.id}',event)">Supprimer</button></td>
    </tr>`;
  }).join('');
  $('siteTable').innerHTML = `<table class="table"><thead><tr><th>Site</th><th class="num">Zones</th><th>Priorité</th><th class="num">Score</th><th class="num">Surface (ha)</th><th class="num">Budget (M FCFA)</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderZoneList(){
  const s = currentSite();
  if(!s || !s.zones.length){
    $('zoneListSub').textContent = s ? 'Site « ' + s.name +' » — aucune zone enregistrée.' : 'Aucun site en cours.';
    $('zoneTable').innerHTML = '<div class="empty">Aucune micro-zone enregistrée.</div>';
    $('siteSynth').innerHTML = '<div class="empty">La synthèse apparaît dès la première zone enregistrée.</div>';
    return;
  }
  $('zoneListSub').textContent = 'Site « ' + s.name + ' » — ' + s.zones.length + ' micro-zone(s).';
  const rows = s.zones.map(z => `<tr>
    <td><b>${esc(z.label)}</b><br><span style="color:var(--muted-2);font-size:11px">${esc(z.kind)}</span></td>
    <td><b style="color:${CLASSES[z.diag.cls].color}">${z.diag.cls}</b></td>
    <td><span class="pill p${z.diag.priority}">P${z.diag.priority}</span></td>
    <td class="num">${z.diag.score}</td>
    <td class="num">${z.diag.completeness} %</td>
    <td class="num">${Number.isFinite(z.area) ? nf(z.area) : '—'}</td>
    <td class="num">${nf(zoneBudget(z).min/1000)} k</td>
    <td class="num"><button class="btn sm" onclick="editZone('${z.id}')">Modifier</button>
      <button class="btn sm danger" onclick="deleteZone('${z.id}',event)">×</button></td>
  </tr>`).join('');
  $('zoneTable').innerHTML = `<table class="table"><thead><tr><th>Zone</th><th>Classe</th><th>Priorité</th><th class="num">Score</th><th class="num">Confiance</th><th class="num">Surface m²</th><th class="num">Budget bas</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;

  const syn = siteSynthesis(s);
  $('siteSynth').innerHTML = `
    <div class="score">
      <svg class="gauge" id="gauge" viewBox="0 0 120 120" role="img" aria-label="Score pondéré du site"></svg>
      <div class="verdict">
        <div class="sub" style="margin:0">Score pondéré par les surfaces</div>
        <b>Priorité ${syn.priority}</b>
        <div class="lbl">${esc(PRIORITIES[syn.priority].label)} — ${esc(PRIORITIES[syn.priority].horizon)}</div>
        <div class="tagline"><i style="background:${syn.completeness >= 85 ? 'var(--green)' : syn.completeness >= 60 ? 'var(--amber)' : 'var(--red)'}"></i>
        Confiance moyenne ${syn.completeness} %</div>
      </div>
    </div>
    ${sharesBar(syn.shares, syn.area)}
    <div class="sub" style="margin-top:10px">Surface diagnostiquée ${nf(syn.area/10000, 2)} ha, dont ${nf(syn.areaP1/10000, 2)} ha en priorité 1. Chiffrage indicatif ${nf(syn.bmin/1e6, 1)} à ${nf(syn.bmax/1e6, 1)} millions FCFA.</div>`;
  renderGauge(syn.score);
}

function renderGauge(score){
  const el = $('gauge');
  if(!el) return;
  const r = 48, c = 2*Math.PI*r;
  const col = score >= 75 ? 'var(--cA)' : score >= 55 ? 'var(--cB)' : score >= 40 ? 'var(--cC)' : 'var(--cE)';
  el.innerHTML = `<circle cx="60" cy="60" r="${r}" fill="none" stroke="#e4e0d6" stroke-width="11"/>
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="${col}" stroke-width="11" stroke-linecap="round"
      stroke-dasharray="${(c*score/100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 60 60)"/>
    <text x="60" y="57" text-anchor="middle" font-size="26" font-weight="700" fill="#1a1a1a">${score}</text>
    <text x="60" y="76" text-anchor="middle" font-size="10" fill="#6b6558">sur 100</text>`;
}

function renderClasses(){
  const s = currentSite();
  const present = {};
  if(s) s.zones.forEach(z => { present[z.diag.cls] = (present[z.diag.cls] || 0) + 1; });
  $('classCards').innerHTML = Object.entries(CLASSES).map(([k,z]) => `
    <div class="card" style="border-color:${present[k] ? z.color : 'var(--line)'}">
      <span class="pill" style="background:transparent;border-color:${z.color};color:${z.color}">Zone ${k}${present[k] ? ' — ' + present[k] + ' sur ce site' : ''}</span>
      <h2 style="margin-top:11px">${esc(z.etat)}</h2>
      <div class="sub" style="margin-bottom:0"><b>Problématique dominante :</b> ${esc(z.problem)}</div>
      <div class="sub" style="margin:8px 0 0"><b>Orientation TeC :</b> ${esc(z.action)}</div>
      <div class="sub" style="margin:8px 0 0"><b>Espèces :</b> ${esc(z.especes)}</div>
    </div>`).join('');

  $('rulesTable').innerHTML = '<thead><tr><th>Ordre</th><th>Condition</th><th>Classe</th><th>Justification</th></tr></thead><tbody>' +
    RULES.map(r => `<tr><td>${r[0]}</td><td>${esc(r[1])}</td><td><b style="color:${CLASSES[r[2]].color}">${r[2]}</b></td><td>${esc(r[3])}</td></tr>`).join('') + '</tbody>';

  $('metalRef').innerHTML = '<thead><tr><th>Élément</th><th class="num">Valeur guide (mg/kg)</th><th>Lecture du quotient</th></tr></thead><tbody>' +
    METALS.map(m => `<tr><td>${esc(m.label)}</td><td class="num">${m.guide}</td><td>quotient = teneur mesurée / ${m.guide}</td></tr>`).join('') +
    '<tr><td colspan="3" style="color:var(--muted)">Quotient ≥ 1 sur un seul élément suffit à classer la zone en B.</td></tr></tbody>';
}

/* ============================================================
   8. INITIALISATION
   ============================================================ */
function init(){
  buildForms();
  updateCompleteness();
  document.querySelectorAll('#nav button').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));

  const drop = $('drop');
  $('files').addEventListener('change', e => { handleFiles(e.target.files); e.target.value = ''; });
  ['dragenter','dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('drag'); }));
  ['dragleave','drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('drag'); }));
  drop.addEventListener('drop', e => handleFiles(e.dataTransfer.files));
  $('importFile').addEventListener('change', e => { if(e.target.files[0]) importProject(e.target.files[0]); e.target.value = ''; });
  ['lat','lon'].forEach(id => $(id).addEventListener('blur', validateCoords));

  const saved = store.load();
  if(saved && Array.isArray(saved.sites) && saved.sites.length){
    state.sites = saved.sites;
    state.currentId = saved.currentId || saved.sites[0].id;
    const s = currentSite();
    if(s){
      $('siteName').value = s.name; $('operator').value = s.operator || '';
      $('mineType').value = s.type; $('closure').value = s.closure ?? '';
      $('lat').value = s.lat; $('lon').value = s.lon; $('radius').value = s.radius;
      $('history').value = s.history || '';
    }
  }

  if(typeof L !== 'undefined') mapInit();
  else $('mapMain').innerHTML = '<div class="empty">Carte indisponible : la bibliothèque Leaflet n\'a pas pu être chargée.</div>';

  renderAll();
}
window.addEventListener('load', init);


/* Lancement depuis la landing : app.html?demo=1#section */
window.addEventListener('load',()=>{
  if(location.search.includes('demo=1')&&!state.sites.length) loadDemo();
  const h=location.hash.slice(1); if(h&&document.getElementById(h)) go(h);
});

