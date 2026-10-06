/* GREENMINE — diagnostic.js : Moteur de diagnostic (score, classe, priorité), formulaires site/micro-zone, démonstration. */
"use strict";
/* ============================================================
   3. MOTEUR
   ============================================================ */

/* Quotient métal = teneur / valeur guide. Converti en niveau 0-100 par
   paliers : sous la valeur guide on reste bas, au-delà la pénalité monte vite. */
function metalIndex(metals){
  const q = {};
  let max = 0, sum = 0, n = 0;
  METALS.forEach(m => {
    const v = metals ? metals[m.id] : null;
    if(!Number.isFinite(v)) return;
    const quot = v / m.guide;
    q[m.id] = quot; sum += quot; n++;
    if(quot > max) max = quot;
  });
  if(n === 0) return null;
  let deg;
  if(max <= 0.5) deg = max/0.5*20;
  else if(max <= 1) deg = 20 + (max-0.5)/0.5*20;
  else if(max <= 3) deg = 40 + (max-1)/2*35;
  else if(max <= 10) deg = 75 + (max-3)/7*25;
  else deg = 100;
  return {deg:clamp(deg,0,100), quotients:q, max, sum, count:n};
}

function computeZone(values, metals){
  const mi = metalIndex(metals);
  const v = Object.assign({}, values);
  if(mi) v.contam = Math.round(mi.deg); // la mesure prime sur l'estimation

  const provided = INDICATORS.filter(i => Number.isFinite(v[i.id]));
  if(provided.length === 0) return null;

  const total = provided.reduce((s,i) => s + i.weight, 0);
  const contributions = provided.map(i => {
    const deg = clamp(i.degrade(clamp(v[i.id], i.min, i.max)), 0, 100);
    const wn = i.weight/total;
    return {id:i.id, label:i.label, raw:v[i.id], deg, wn, part:wn*deg};
  }).sort((a,b) => b.part - a.part);

  const score = Math.round(clamp(contributions.reduce((s,c) => s + c.part, 0), 0, 100));
  const completeness = Math.round(total*100);
  const confidence = completeness >= 85 ? 'élevée' : completeness >= 60 ? 'moyenne' : 'faible';
  const cls = classify(score, v, contributions[0], mi);
  const priority = score >= 75 ? 1 : score >= 55 ? 2 : score >= 40 ? 3 : 4;

  return {score, completeness, confidence, contributions, cls, priority, values:v, metalIndex:mi};
}

function classify(score, v, dominant, mi){
  const has = k => Number.isFinite(v[k]);
  if(score >= 75) return 'A';
  if(score >= 65 && has('veg') && v.veg < 15) return 'A';
  if(mi && mi.max >= 1) return 'B';
  if(has('contam') && (v.contam >= 50 || (dominant.id === 'contam' && v.contam >= 35))) return 'B';
  if(has('erosion') && (v.erosion >= 60 || (dominant.id === 'erosion' && v.erosion >= 45))) return 'C';
  if((has('veg') && v.veg < 35) || (has('ndvi') && v.ndvi < .25) || (has('compact') && v.compact >= 55)) return 'D';
  return 'E';
}

/* Itinéraire technique GREENMINE TeC, par classe. */
function itineraire(cls){
  return {
    A:[['Sécuriser la zone','Fermer les excavations, baliser les fronts instables, interdire le pâturage et les cultures, évacuer les eaux stagnantes.','Semaines 1 à 4'],
       ['Reprofiler','Adoucir les pentes, régaler les stériles, rétablir un exutoire hydraulique cohérent.','Mois 1 à 3'],
       ['Reconstituer le support','Travail superficiel sans retournement profond, apport de compost mûr et de biochar, correction du pH.','Mois 3 à 6'],
       ['Végétaliser','Vétiver en lignes puis pionnières et légumineuses de couverture, calé sur l\'entrée de la saison des pluies.','Mois 6 à 9']],
    B:[['Caractériser','Prélèvements en grille 10 m × 10 m sur deux profondeurs (0–20 et 20–50 cm), analyse As, Hg, Pb, Cd, délimitation de l\'emprise contaminée.','Semaines 1 à 6'],
       ['Restreindre les usages','Signalisation, clôture, interdiction de culture alimentaire et d\'abreuvement sur la zone et son aval immédiat.','Immédiat'],
       ['Immobiliser les métaux','Amendements calciques ou phosphatés et biochar selon les analyses, pour réduire la mobilité des éléments.','Mois 2 à 4'],
       ['Phytostabiliser','Couvert dense d\'espèces tolérantes non alimentaires, sans transfert vers la chaîne alimentaire, avec gestion contrôlée des biomasses.','Mois 4 à 12']],
    C:[['Maîtriser les écoulements','Fossés de dérivation, exutoires enherbés, rupture des pentes longues en amont de la zone.','Semaines 1 à 6'],
       ['Construire les ouvrages','Seuils, fascines et cordons pierreux en travers des ravines actives.','Mois 1 à 4'],
       ['Installer le vétiver','Lignes serrées perpendiculaires à la pente, racines jusqu\'à 3 m qui bloquent mécaniquement l\'érosion.','Mois 3 à 6'],
       ['Couvrir le sol','Paillage et semis rapide pour supprimer l\'énergie de la pluie au sol.','Mois 4 à 8']],
    D:[['Décompacter','Scarification ou sous-solage superficiel hors période sèche, sans remonter d\'horizon contaminé.','Mois 1 à 2'],
       ['Amender','Compost mûr et bio-inoculation mycorhizienne, apport localisé aux poquets de plantation.','Mois 2 à 3'],
       ['Végétaliser en assistance','Légumineuses de couverture pour la fixation d\'azote, puis plantation en poquets enrichis.','Mois 3 à 6'],
       ['Entretenir','Regarnissage des manquants, sarclage, protection contre le feu et le bétail.','Mois 6 à 18']],
    E:[['Mettre en défens','Limiter le pâturage, la coupe et le passage des engins sur la zone en régénération.','Mois 1'],
       ['Prévenir le feu','Pare-feu périphérique et sensibilisation des communautés riveraines.','Avant la saison sèche'],
       ['Enrichir ponctuellement','Introduction d\'essences locales là où la reprise reste lacunaire.','Mois 3 à 9'],
       ['Surveiller','Relevés NDVI par drone et contrôles de terrain, sans intervention lourde.','Campagne annuelle']]
  }[cls];
}

function siteSynthesis(site){
  const zones = site.zones;
  if(!zones.length) return null;
  const area = zones.reduce((s,z) => s + (Number.isFinite(z.area) ? z.area : 0), 0);
  const w = z => (area > 0 && Number.isFinite(z.area)) ? z.area/area : 1/zones.length;
  const score = Math.round(zones.reduce((s,z) => s + z.diag.score*w(z), 0));
  const shares = {A:0,B:0,C:0,D:0,E:0};
  zones.forEach(z => { shares[z.diag.cls] += Number.isFinite(z.area) ? z.area : 0; });
  const priority = Math.min.apply(null, zones.map(z => z.diag.priority));
  const areaP1 = zones.filter(z => z.diag.priority === 1).reduce((s,z) => s + (z.area||0), 0);
  const budgets = zones.map(zoneBudget);
  const bmin = budgets.reduce((s,b) => s + b.min, 0);
  const bmax = budgets.reduce((s,b) => s + b.max, 0);
  const completeness = Math.round(zones.reduce((s,z) => s + z.diag.completeness, 0)/zones.length);
  const dominant = Object.keys(shares).sort((a,b) => shares[b] - shares[a])[0];
  return {area, score, shares, priority, areaP1, bmin, bmax, completeness, dominant, count:zones.length};
}

function watchFor(site){
  const w = [];
  const zones = site.zones;
  const syn = siteSynthesis(site);
  if(!syn) return w;
  if(syn.completeness < 60) w.push('Indice de confiance moyen inférieur à 60 % : compléter les mesures avant de chiffrer des travaux fermes.');
  const noMetal = zones.filter(z => !z.diag.metalIndex);
  if(noMetal.length) w.push(noMetal.length + ' zone(s) sans analyse de métaux lourds. Un ancien site minier ne peut pas être déclaré sain sans dosage d\'As, Hg, Pb et Cd.');
  const hot = zones.filter(z => z.diag.metalIndex && z.diag.metalIndex.max >= 1);
  if(hot.length) w.push(hot.length + ' zone(s) au-dessus des valeurs guides pour au moins un métal : usage alimentaire à proscrire, biomasses à gérer en filière contrôlée.');
  const acid = zones.filter(z => Number.isFinite(z.diag.values.ph) && z.diag.values.ph < 5);
  if(acid.length) w.push(acid.length + ' zone(s) à pH inférieur à 5 : rechercher un drainage minier acide et la présence de sulfures avant plantation.');
  const ero = zones.filter(z => z.diag.cls === 'C' || (Number.isFinite(z.diag.values.erosion) && z.diag.values.erosion >= 60));
  if(ero.length) w.push('Zones érosives présentes : toute plantation engagée avant les ouvrages de maîtrise des eaux sera perdue à la première saison des pluies.');
  if(!zones.some(z => Number.isFinite(z.lat))) w.push('Aucune micro-zone n\'est géolocalisée : la carte de priorisation reste indicative.');
  if(!(site.images||[]).length) w.push('Aucune image réelle importée (étape 2) : la carte repose uniquement sur les indicateurs saisis.');
  if(!(site.lab||[]).length) w.push('Aucun résultat de laboratoire (étape 4) : le plan de réhabilitation et les plantations restent non évaluables.');
  if(!w.length) w.push('Aucun point bloquant identifié à partir des données saisies. La validation terrain et laboratoire reste nécessaire.');
  return w;
}

/* ============================================================
   5. FORMULAIRES
   ============================================================ */
function buildForms(){
  $('indicatorForm').innerHTML = INDICATORS.map(i => `
    <div class="field">
      <label for="${i.id}">${esc(i.label)}${i.unit ? ' (' + esc(i.unit) + ')' : ''}</label>
      <input id="${i.id}" type="number" min="${i.min}" max="${i.max}" step="${i.step}" placeholder="${esc(i.ph)}">
      <div class="hint">poids ${Math.round(i.weight*100)} %</div>
    </div>`).join('');

  $('metalForm').innerHTML = METALS.map(m => `
    <div class="field">
      <label for="m_${m.id}">${esc(m.label)}</label>
      <input id="m_${m.id}" type="number" min="0" step="0.01" placeholder="${esc(m.ph)}">
      <div class="hint">valeur guide ${m.guide}</div>
    </div>`).join('');

  INDICATORS.forEach(i => {
    const el = $(i.id);
    el.addEventListener('input', updateCompleteness);
    el.addEventListener('blur', () => {
      const v = readField(i.id);
      if(v !== null && (v < i.min || v > i.max)){
        el.value = clamp(v, i.min, i.max);
        toast(i.label + ' ramené à l\'intervalle ' + i.min + ' – ' + i.max + '.');
      }
    });
  });
  METALS.forEach(m => $('m_' + m.id).addEventListener('input', updateCompleteness));
}

function readZoneValues(){
  const values = {};
  INDICATORS.forEach(i => { const v = readField(i.id); if(v !== null) values[i.id] = clamp(v, i.min, i.max); });
  return values;
}
function readMetals(){
  const m = {};
  let any = false;
  METALS.forEach(x => { const v = readField('m_' + x.id); if(v !== null){ m[x.id] = Math.max(0, v); any = true; } });
  return any ? m : null;
}

function updateCompleteness(){
  const metals = readMetals();
  const mi = metalIndex(metals);
  const note = $('metalNote');
  if(mi){
    const worst = METALS.filter(m => Number.isFinite(metals[m.id]))
      .map(m => ({m, q: metals[m.id]/m.guide})).sort((a,b) => b.q - a.q)[0];
    note.className = 'notice ' + (mi.max >= 1 ? 'bad' : '');
    note.innerHTML = '<b>Indice de contamination calculé : ' + Math.round(mi.deg) + '/100.</b> Quotient le plus élevé : ' +
      esc(worst.m.label) + ' à ' + nf(worst.q, 2) + ' fois la valeur guide' +
      (mi.max >= 1 ? '. Dépassement constaté, la zone sera classée B.' : '. Sous les valeurs guides.');
  } else {
    note.className = 'notice';
    note.innerHTML = 'Aucune teneur saisie. Le risque de contamination sera pris tel que vous l\'estimez ci-dessus.';
  }

  const values = readZoneValues();
  if(mi) values.contam = Math.round(mi.deg);
  const filled = INDICATORS.filter(i => Number.isFinite(values[i.id]));
  const w = Math.round(filled.reduce((s,i) => s + i.weight, 0)*100);
  const cn = $('completenessNote');
  if(!filled.length){
    cn.className = 'notice';
    cn.innerHTML = 'Renseignez au moins trois indicateurs pour obtenir un diagnostic exploitable.';
  } else if(filled.length < 3){
    cn.className = 'notice warn';
    cn.innerHTML = '<b>' + filled.length + ' indicateur(s) renseigné(s)</b> — indice de confiance ' + w + ' %. En dessous de trois indicateurs, le résultat reste indicatif.';
  } else {
    cn.className = 'notice';
    cn.innerHTML = '<b>' + filled.length + ' indicateurs renseignés</b> — indice de confiance ' + w + ' %. Les poids sont recalculés sur ces seules données.';
  }
}

function validateCoords(){
  const la = readField('lat'), lo = readField('lon');
  const okLa = la !== null && la >= -90 && la <= 90;
  const okLo = lo !== null && lo >= -180 && lo <= 180;
  $('lat').parentElement.classList.toggle('invalid', !okLa);
  $('lon').parentElement.classList.toggle('invalid', !okLo);
  return (okLa && okLo) ? {la, lo} : null;
}

function clearZoneForm(){
  ['zName','zKind','zArea','zSlope','zLat','zLon','zMndwi','zNdti','zHumidity'].forEach(id => { if($(id)) $(id).value = ''; });
  $('zKind').selectedIndex = 0;
  INDICATORS.forEach(i => $(i.id).value = '');
  METALS.forEach(m => $('m_' + m.id).value = '');
  state.editingZoneId = null;
  $('saveZoneBtn').textContent = 'Enregistrer la micro-zone';
  $('zoneFormTitle').textContent = 'Nouvelle micro-zone. Chaque zone est diagnostiquée et chiffrée séparément.';
  updateCompleteness();
}

/* Enregistre le site seul (étape 1), sans exiger de micro-zone : permet d'importer les images (étape 2). */
function saveSite(){
  if(!validateCoords()){ toast('Renseignez des coordonnées GPS valides.', true); $('lat').focus(); return; }
  if(!$('siteName').value.trim()){ toast('Donnez un nom au site.', true); $('siteName').focus(); return; }
  if(!currentSite()){
    const s = {id:uid('S'), zones:[], followups:[], files:[], images:[], lab:[], createdAt:new Date().toISOString()};
    state.sites.push(s); state.currentId = s.id;
  }
  touchSite(); renderAll(); toast('Site enregistré. Étape suivante : images.');
}

function newSite(){
  state.currentId = null;
  ['siteName','operator','lat','lon','history','closure'].forEach(id => $(id).value = '');
  $('mineType').selectedIndex = 0; $('openPit').selectedIndex = 0;
  $('radius').value = 700;
  state.files.forEach(f => { if(f.url) URL.revokeObjectURL(f.url); });
  state.files = [];
  clearZoneForm();
  renderAll();
  go('diagnostic');
  $('siteName').focus();
}

function touchSite(){
  const s = currentSite();
  if(!s) return;
  s.name = $('siteName').value.trim() || s.name;
  s.operator = $('operator').value.trim();
  s.type = $('mineType').value; s.openPit = $('openPit').value;
  s.closure = readField('closure');
  s.history = $('history').value.trim();
  const c = validateCoords();
  if(c){ s.lat = c.la; s.lon = c.lo; }
  s.radius = clamp(readField('radius') ?? 700, 10, 20000);
  s.updatedAt = new Date().toISOString();
  store.save();
  $('currentSite').textContent = s.name;
}

/* ============================================================
   6. ENREGISTREMENT DES ZONES
   ============================================================ */
function saveZone(){
  const c = validateCoords();
  if(!c){ toast('Renseignez d\'abord les coordonnées GPS du site.', true); $('lat').focus(); return; }
  if(!$('siteName').value.trim()){ toast('Donnez un nom au site.', true); $('siteName').focus(); return; }

  if(readField('zArea') === null){ toast('Renseignez la surface de la zone (m²) : indispensable au chiffrage.', true); $('zArea').focus(); return; }
  const values = readZoneValues();
  const metals = readMetals();
  const diag = computeZone(values, metals);
  if(!diag){ toast('Renseignez au moins un indicateur mesuré pour cette zone.', true); return; }

  let site = currentSite();
  if(!site){
    site = {id:uid('S'), zones:[], followups:[], files:[], images:[], lab:[], createdAt:new Date().toISOString()};
    state.sites.push(site);
    state.currentId = site.id;
  }
  site.name = $('siteName').value.trim();
  site.operator = $('operator').value.trim();
  site.type = $('mineType').value; site.openPit = $('openPit').value;
  site.closure = readField('closure');
  site.history = $('history').value.trim();
  site.lat = c.la; site.lon = c.lo;
  site.radius = clamp(readField('radius') ?? 700, 10, 20000);
  site.files = state.files.map(f => ({name:f.name, size:f.size, type:f.type}));
  site.updatedAt = new Date().toISOString();

  const zLat = readField('zLat'), zLon = readField('zLon');
  const zone = {
    id: state.editingZoneId || uid('Z'),
    label: $('zName').value.trim() || ('Zone ' + (site.zones.length + 1)),
    kind: $('zKind').value,
    area: readField('zArea'),
    slope: readField('zSlope'),
    lat: (zLat !== null && zLat >= -90 && zLat <= 90) ? zLat : null,
    lon: (zLon !== null && zLon >= -180 && zLon <= 180) ? zLon : null,
    mndwi: readField('zMndwi'), ndti: readField('zNdti'), humidity: readField('zHumidity'),
    metals, diag
  };

  const i = site.zones.findIndex(z => z.id === zone.id);
  if(i >= 0) site.zones[i] = zone; else site.zones.push(zone);

  if(!site.followups.length){
    site.followups.push({label:'État initial', date:site.createdAt.slice(0,10),
      ndvi: Number.isFinite(values.ndvi) ? values.ndvi : null, surv:null, height:null,
      ph: Number.isFinite(values.ph) ? values.ph : null, note:'Diagnostic de référence', baseline:true});
  }

  store.save();
  clearZoneForm();
  renderAll();
  toast('Zone « ' + zone.label + ' » enregistrée : priorité ' + zone.diag.priority + ', classe ' + zone.diag.cls + '.');
}

function editZone(zid){
  const s = currentSite();
  if(!s) return;
  const z = s.zones.find(x => x.id === zid);
  if(!z) return;
  state.editingZoneId = z.id;
  $('zName').value = z.label; $('zKind').value = z.kind;
  $('zArea').value = z.area ?? ''; $('zSlope').value = z.slope ?? '';
  $('zLat').value = z.lat ?? ''; $('zLon').value = z.lon ?? '';
  $('zMndwi').value = z.mndwi ?? ''; $('zNdti').value = z.ndti ?? ''; $('zHumidity').value = z.humidity ?? '';
  INDICATORS.forEach(i => $(i.id).value = Number.isFinite(z.diag.values[i.id]) ? z.diag.values[i.id] : '');
  METALS.forEach(m => $('m_' + m.id).value = (z.metals && Number.isFinite(z.metals[m.id])) ? z.metals[m.id] : '');
  $('saveZoneBtn').textContent = 'Mettre à jour la micro-zone';
  $('zoneFormTitle').textContent = 'Modification de « ' + z.label + ' ».';
  updateCompleteness();
  go('diagnostic');
  $('zName').focus();
}

function deleteZone(zid, ev){
  if(ev) ev.stopPropagation();
  const s = currentSite();
  if(!s) return;
  const z = s.zones.find(x => x.id === zid);
  if(!z || !confirm('Supprimer la micro-zone « ' + z.label + ' » et ses résultats de laboratoire ?')) return;
  s.zones = s.zones.filter(x => x.id !== zid);
  s.lab = (s.lab || []).filter(l => l.zoneId !== zid);
  if(state.editingZoneId === zid) clearZoneForm();
  store.save();
  renderAll();
  toast('Micro-zone supprimée.');
}

function openSite(id){
  const s = state.sites.find(x => x.id === id);
  if(!s) return;
  state.currentId = id;
  $('siteName').value = s.name; $('operator').value = s.operator || '';
  $('mineType').value = s.type; $('openPit').value = s.openPit || 'Ne sait pas'; $('closure').value = s.closure ?? '';
  $('lat').value = s.lat; $('lon').value = s.lon;
  $('radius').value = s.radius; $('history').value = s.history || '';
  clearZoneForm();
  renderAll();
  go('diagnostic');
}

function deleteSite(id, ev){
  if(ev) ev.stopPropagation();
  const s = state.sites.find(x => x.id === id);
  if(!s || !confirm('Supprimer définitivement « ' + s.name + ' » et ses ' + s.zones.length + ' zone(s) ?')) return;
  state.sites = state.sites.filter(x => x.id !== id);
  if(state.currentId === id) state.currentId = state.sites.length ? state.sites[0].id : null;
  store.save();
  renderAll();
  toast('Site supprimé.');
}

function clearAll(){
  if(!state.sites.length){ toast('Le portefeuille est déjà vide.'); return; }
  if(!confirm('Supprimer les ' + state.sites.length + ' site(s) du portefeuille ?')) return;
  state.sites = []; state.currentId = null;
  store.clear(); store.save();
  renderAll();
  toast('Portefeuille vidé.');
}

/* ---------- Démonstration ---------- */
function loadDemo(){
  const created = new Date().toISOString();
  const site = {
    id:uid('S'), name:'Ancien site aurifère de Bouaflé (DÉMO)', type:'Mine d\'or', openPit:'Oui',
    operator:'Coopérative locale', closure:2027, lat:6.989, lon:-5.751, radius:900,
    history:'Fosses ouvertes en partie centrale, haldes de stériles au nord, aire de lavage abandonnée en bordure de bas-fond, pistes de roulage fortement tassées.',
    zones:[], followups:[], files:[], images:[], lab:[], createdAt:created, updatedAt:created
  };
  const defs = [
    {label:'Fosse principale et abords', kind:'Fosse et abords', area:6500, slope:18, dlat:.0012, dlon:-.0014,
     v:{veg:6, ndvi:.04, erosion:86, compact:78, soil:14, ph:4.9}, metals:{as:9, pb:52, cd:0.7}, mndwi:-.22, ndti:.31, humidity:22},
    {label:'Aire de lavage', kind:'Aire de traitement ou de lavage', area:2200, slope:4, dlat:-.0009, dlon:.0011,
     v:{veg:28, ndvi:.19, erosion:34, compact:52, soil:26, ph:4.3}, metals:{as:26, hg:9.1, pb:96, cd:1.9}, mndwi:.12, ndti:.18, humidity:44},
    {label:'Halde de stériles nord', kind:'Halde de stériles', area:4800, slope:26, dlat:.0021, dlon:.0006,
     v:{veg:22, ndvi:.17, erosion:74, compact:44, soil:30, ph:5.6}, metals:{as:7, pb:38, cd:0.4}, mndwi:-.31, ndti:.24, humidity:19},
    {label:'Piste de roulage est', kind:'Piste de roulage', area:1500, slope:6, dlat:-.0004, dlon:.0026,
     v:{veg:41, ndvi:.28, erosion:31, compact:81, soil:38, ph:6.1}, metals:null, mndwi:-.28, ndti:.15, humidity:25},
    {label:'Périphérie sud en reprise', kind:'Zone périphérique', area:7200, slope:9, dlat:-.0026, dlon:-.0008,
     v:{veg:66, ndvi:.51, erosion:24, compact:29, soil:61, ph:6.4}, metals:{as:5, pb:24, cd:0.2}, mndwi:-.18, ndti:.09, humidity:39}
  ];
  defs.forEach(d => {
    const diag = computeZone(d.v, d.metals);
    site.zones.push({id:uid('Z'), label:d.label, kind:d.kind, area:d.area, slope:d.slope,
      lat:site.lat + d.dlat, lon:site.lon + d.dlon, mndwi:d.mndwi, ndti:d.ndti, humidity:d.humidity,
      metals:d.metals, diag});
  });
  site.followups.push({label:'État initial', date:created.slice(0,10), ndvi:.04, surv:null, height:null, ph:4.9,
    note:'Diagnostic de référence', baseline:true});

  state.sites.push(site);
  state.currentId = site.id;
  store.save();
  openSite(site.id);
  fitAll();
  toast('Site de démonstration chargé : 5 micro-zones.');
}

