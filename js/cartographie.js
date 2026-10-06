/* GREENMINE — cartographie.js : Carte Leaflet : fonds, zones, pointage, export image. */
"use strict";
/* ---------- Carte ---------- */
function mapInit(){
  state.map = L.map('mapMain', {scrollWheelZoom:true}).setView([6.989, -5.751], 12);
  const choices = {};
  BASEMAPS.forEach(b => {
    const layer = L.tileLayer(b.url, b.opts);
    layer._gmId = b.id; layer._gmErrors = 0;
    layer.on('tileerror', () => onTileError(layer));
    layer.on('tileload', () => { layer._gmErrors = 0; });
    state.baseLayers[b.id] = layer;
    choices[b.name] = layer;
  });
  choices['Aucun fond'] = L.layerGroup();
  state.baseLayers.none = choices['Aucun fond'];
  state.baseLayers[state.baseId].addTo(state.map);
  L.control.layers(choices, null, {position:'topright', collapsed:true}).addTo(state.map);
  state.map.on('baselayerchange', e => { state.baseId = e.layer._gmId || 'none'; updateBaseNote(); });
  state.map.on('click', onMapClick);
  state.layerSites = L.layerGroup().addTo(state.map);
  state.layerZones = L.layerGroup().addTo(state.map);
  renderMap();
}

function onTileError(layer){
  if(!state.map || !state.map.hasLayer(layer)) return;
  layer._gmErrors++;
  if(layer._gmErrors < 6) return;
  const order = BASEMAPS.map(b => b.id);
  const next = order[order.indexOf(layer._gmId)+1];
  state.map.removeLayer(layer);
  layer._gmErrors = 0;
  if(next){
    state.baseId = next;
    state.baseLayers[next].addTo(state.map);
    toast('Fond de carte indisponible, bascule sur « ' + BASEMAPS.find(b => b.id === next).name + ' ».');
  } else {
    state.baseId = 'none';
    state.baseLayers.none.addTo(state.map);
    toast('Aucun fond de carte accessible. Les repères restent affichés sur fond neutre.', true);
  }
  updateBaseNote();
}

function updateBaseNote(){
  const el = $('baseNote');
  if(!el) return;
  const b = BASEMAPS.find(x => x.id === state.baseId);
  el.textContent = b ? 'Fond affiché : ' + b.name.toLowerCase() + '. Sélecteur en haut à droite de la carte.'
                     : 'Aucun fond de carte : seuls les repères et les emprises sont affichés.';
}

function startPick(){
  if(!state.map){ toast('Carte indisponible.', true); return; }
  state.picking = true;
  $('mapMain').classList.add('picking');
  go('cartographie');
  toast('Cliquez sur la carte pour positionner la micro-zone.');
}

function onMapClick(e){
  if(!state.picking) return;
  state.picking = false;
  $('mapMain').classList.remove('picking');
  $('zLat').value = e.latlng.lat.toFixed(6);
  $('zLon').value = e.latlng.lng.toFixed(6);
  go('diagnostic');
  toast('Position de la zone enregistrée dans le formulaire.');
}

function zoneRadius(z){
  const a = Number.isFinite(z.area) && z.area > 0 ? z.area : 500;
  return clamp(Math.sqrt(a/Math.PI), 8, 600);
}

/* Couleurs de priorité : rouge = à traiter en premier, vert = priorité faible. */
const PRIO_COL={1:'#c62828',2:'#ef7d1a',3:'#f2c200',4:'#2e9e4f'};
const PRIO_TXT={1:'Priorité très élevée (à traiter en premier)',2:'Priorité élevée',3:'Priorité moyenne',4:'Priorité faible'};
function zoneBounds(z){
  const h=Math.sqrt(Math.max(z.area||500,1))/2, dLat=h/111320, dLon=h/(111320*Math.cos(z.lat*Math.PI/180));
  return [[z.lat-dLat,z.lon-dLon],[z.lat+dLat,z.lon+dLon]];
}
function geoStyle(f){
  const t=String((f.properties&&f.properties.type)||'').toLowerCase();
  if(/hydro|eau|riv|cours/.test(t)) return {color:'#1e88e5',weight:3,fillOpacity:.35};
  if(/mine|miniere|emprise/.test(t)) return {color:'#5c4c3d',weight:2.5,dashArray:'8 5',fillOpacity:0};
  return {color:'#ffffff',weight:1.5,fillOpacity:.08};
}
function importGeo(file){
  const s=currentSite(); if(!s){ toast('Créez d\'abord un site.',true); return; }
  const r=new FileReader();
  r.onload=()=>{ try{
    const g=JSON.parse(r.result); if(!g||!(g.type==='FeatureCollection'||g.type==='Feature')) throw 0;
    s.geo=g; store.save(); renderMap(); renderParcours(); toast('Couches SIG importées.');
    if(state.map) state.map.fitBounds(L.geoJSON(g).getBounds());
  }catch(e){ toast('GeoJSON illisible. Propriété "type" conseillée : mine, hydro, zone.',true); } };
  r.readAsText(file);
}
function renderMap(){
  if(!state.map) return;
  state.layerSites.clearLayers(); state.layerZones.clearLayers();
  state.sites.forEach(s=>{
    if(Number.isFinite(s.lat)) L.marker([s.lat,s.lon]).bindPopup('<b>'+esc(s.name)+'</b><br>'+s.zones.length+' micro-zone(s)').addTo(state.layerSites);
    if(s.geo) L.geoJSON(s.geo,{style:geoStyle}).addTo(state.layerSites);
    s.zones.forEach(z=>{
      if(!Number.isFinite(z.lat)) return;
      const col=PRIO_COL[z.diag.priority];
      L.rectangle(zoneBounds(z),{color:'#fff',weight:1.5,fillColor:col,fillOpacity:.65})
        .bindTooltip(esc(z.label)+' — P'+z.diag.priority)
        .bindPopup('<b>'+esc(z.label)+'</b><br>'+PRIO_TXT[z.diag.priority]+'<br>Classe '+z.diag.cls+' — score '+z.diag.score+'/100<br>'+(Number.isFinite(z.area)?nf(z.area)+' m²':'')).addTo(state.layerZones);
    });
  });
  updateBaseNote();
  const sw=(c,t)=>'<span style="display:inline-flex;align-items:center;gap:6px;margin-right:16px"><span style="width:12px;height:12px;background:'+c+';display:inline-block;border-radius:2px"></span>'+t+'</span>';
  $('mapLegend').innerHTML='<b>Légende :</b> '+[1,2,3,4].map(k=>sw(PRIO_COL[k],PRIO_TXT[k])).join('')+sw('#1e88e5','Réseau hydrographique (si importé)')+sw('#5c4c3d','Zone minière (si importée)')+
    '<br>Priorités issues des indicateurs saisis, non d\'une analyse d\'image. Carré à la surface déclarée de la zone : position et forme schématiques, pas un levé.';
}
window.addEventListener('load',()=>{ $('geoFile').addEventListener('change',e=>{ if(e.target.files[0]) importGeo(e.target.files[0]); e.target.value=''; }); });

function locate(){
  const c = validateCoords();
  if(!c){ toast('Entrez des coordonnées GPS valides.', true); return; }
  touchSite();
  renderMap();
  if(state.map) state.map.setView([c.la, c.lo], 15);
  go('cartographie');
}

function fitAll(){
  if(!state.map) return;
  const pts = [];
  state.sites.forEach(s => {
    if(Number.isFinite(s.lat)) pts.push([s.lat, s.lon]);
    s.zones.forEach(z => { if(Number.isFinite(z.lat)) pts.push([z.lat, z.lon]); });
  });
  if(!pts.length){ toast('Aucun point à cadrer.'); return; }
  state.map.fitBounds(L.latLngBounds(pts).pad(.35));
}

function downloadMap(){
  if(typeof html2canvas === 'undefined'){ toast('Bibliothèque d\'export indisponible hors connexion.', true); return; }
  toast('Génération de l\'image en cours...');
  html2canvas($('mapMain'), {useCORS:true, backgroundColor:'#ffffff', logging:false}).then(canvas => {
    const a = document.createElement('a');
    a.download = 'greenmine-carte-priorisation.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
    toast('Carte exportée.');
  }).catch(() => toast('Export impossible : les tuiles bloquent la capture dans ce navigateur.', true));
}

