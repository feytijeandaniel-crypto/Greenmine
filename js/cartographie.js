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
  choices['Fond blanc (carte thématique)'] = L.layerGroup();
  state.baseLayers.none = choices['Fond blanc (carte thématique)'];
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
                     : 'Carte thématique sur fond blanc, sans imagerie satellite. Sélecteur en haut à droite pour un plan neutre.';
}

function startPick(){
  if(!state.map){ toast('Carte indisponible.', true); return; }
  state.picking = true;
  $('mapMain').classList.add('picking');
  go('cartographie');
  toast('Cliquez sur la carte pour positionner la micro-zone.');
}

function onMapClick(e){
  if(!state.picking){
    const c=(state.cells||[]).find(c=>e.latlng.lat>=c.b[0][0]&&e.latlng.lat<c.b[1][0]&&e.latlng.lng>=c.b[0][1]&&e.latlng.lng<c.b[1][1]);
    if(c) L.popup().setLatLng(e.latlng).setContent((c.zone?'Micro-zone '+c.zone+' (valeur saisie) : '+c.score+'/100':'Score interpolé ≈ '+c.score+'/100')+'<br>'+PRIO_TXT[c.prio]).openOn(state.map);
    return;
  }
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
const PRIO_TXT={1:'Dégradation très élevée, priorité 1 (score ≥ 75)',2:'Dégradation élevée, priorité 2 (55–74)',3:'Dégradation moyenne, priorité 3 (40–54)',4:'Dégradation faible, priorité 4 (< 40)'};
function zoneBounds(z){
  const h=Math.sqrt(Math.max(z.area||500,1))/2, dLat=h/111320, dLon=h/(111320*Math.cos(z.lat*Math.PI/180));
  return [[z.lat-dLat,z.lon-dLon],[z.lat+dLat,z.lon+dLon]];
}
function geoStyle(f){
  const t=String((f.properties&&f.properties.type)||'').toLowerCase();
  const pr=+((f.properties||{}).priority??(f.properties||{}).priorite);
  if(pr>=1&&pr<=4) return {fillColor:PRIO_COL[pr],fillOpacity:1,color:PRIO_COL[pr],weight:.6};
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
/* Grille de priorité : score de chaque cellule interpolé (pondération par l'inverse du carré de la distance)
   à partir des micro-zones saisies. Ce n'est PAS une analyse d'image. Découpée par le polygone « mine » du GeoJSON si importé. */
function priorityGrid(s){
  const zs=s.zones.filter(z=>Number.isFinite(z.lat));
  if(!zs.length) return null;
  const lo0=zs[0].lon, la0=zs[0].lat, k=Math.cos(la0*Math.PI/180)*111320, K=111320;
  const P=zs.map(z=>({z,n:s.zones.indexOf(z)+1,x:(z.lon-lo0)*k,y:(z.lat-la0)*K,r:Math.sqrt(Math.max(z.area||500,1))/2}));
  const polys=[];
  if(s.geo){ (s.geo.type==='FeatureCollection'?s.geo.features:[s.geo]).forEach(f=>{
    if(!f||!f.geometry||!/mine|miniere|emprise/i.test(String((f.properties||{}).type||''))) return;
    const g=f.geometry; (g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[]).forEach(p=>polys.push(p[0])); }); }
  const inPoly=(lo,la)=>polys.some(r=>{ let c=false; for(let i=0,j=r.length-1;i<r.length;j=i++){ const xi=r[i][0],yi=r[i][1],xj=r[j][0],yj=r[j][1];
    if((yi>la)!==(yj>la)&&lo<(xj-xi)*(la-yi)/(yj-yi)+xi) c=!c; } return c; });
  let X0,X1,Y0,Y1;
  if(polys.length){ const pts=[].concat.apply([],polys).map(q=>[(q[0]-lo0)*k,(q[1]-la0)*K]);
    X0=Math.min(...pts.map(q=>q[0]));X1=Math.max(...pts.map(q=>q[0]));Y0=Math.min(...pts.map(q=>q[1]));Y1=Math.max(...pts.map(q=>q[1])); }
  else { const m=o=>Math.max(o.r*2,.55*(P.length>1?P.reduce((t,u)=>t+Math.min(...P.filter(q=>q!==u).map(q=>Math.hypot(u.x-q.x,u.y-q.y))),0)/P.length:0));
    X0=Math.min(...P.map(o=>o.x-m(o)));X1=Math.max(...P.map(o=>o.x+m(o)));Y0=Math.min(...P.map(o=>o.y-m(o)));Y1=Math.max(...P.map(o=>o.y+m(o))); }
  /* Sans polygone importé : rayon d'inclusion = au moins la moitié de l'écart moyen entre zones voisines, pour une carte continue. */
  const gap=P.length>1?P.reduce((t,o)=>t+Math.min(...P.filter(q=>q!==o).map(q=>Math.hypot(o.x-q.x,o.y-q.y))),0)/P.length:0;
  const cs=Math.max(8,Math.max(X1-X0,Y1-Y0)/48), cells=[];
  for(let x=X0;x<X1;x+=cs) for(let y=Y0;y<Y1;y+=cs){
    const cx=x+cs/2, cy=y+cs/2;
    /* Cohérence : toute cellule située dans l'emprise d'une micro-zone (ou contenant son centre) reprend EXACTEMENT sa priorité. */
    let f=null,fd=1e18;
    P.forEach(o=>{ const dx=Math.abs(cx-o.x),dy=Math.abs(cy-o.y);
      if((dx<=o.r&&dy<=o.r)||(dx<=cs/2&&dy<=cs/2)){ const d=Math.hypot(dx,dy); if(d<fd){ fd=d; f=o; } } });
    if(!f&&(polys.length?!inPoly(lo0+cx/k,la0+cy/K):!P.some(o=>Math.hypot(cx-o.x,cy-o.y)<=Math.max(o.r*2,gap*.55)))) continue;
    let sw=0,ss=0; P.forEach(o=>{ const w=1/(Math.pow(Math.hypot(cx-o.x,cy-o.y),2)+Math.pow(o.r*.5,2)); sw+=w; ss+=w*o.z.diag.score; });
    const sc=f?f.z.diag.score:Math.round(ss/sw);
    cells.push({x0:x,x1:x+cs,y0:y,y1:y+cs,score:sc,zone:f?f.n:0,prio:f?f.z.diag.priority:(sc>=75?1:sc>=55?2:sc>=40?3:4),
      b:[[la0+y/K,lo0+x/k],[la0+(y+cs)/K,lo0+(x+cs)/k]]});
  }
  return {cells,zones:P,clipped:polys.length>0};
}
/* Polygones de priorité importés (GeoJSON, propriété priority = 1 à 4) : données SIG réelles, prioritaires sur l'interpolation. */
function priorityPolys(s){
  const out=[]; if(!s.geo) return out;
  (s.geo.type==='FeatureCollection'?s.geo.features:[s.geo]).forEach(f=>{
    const pr=f&&f.properties?+(f.properties.priority??f.properties.priorite):NaN, g=f&&f.geometry;
    if(!g||!(pr>=1&&pr<=4)) return;
    (g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[]).forEach(p=>out.push({prio:pr,rings:p}));
  });
  return out;
}
/* Dessine la grille en fusionnant les cellules voisines de même niveau (canvas, sous les marqueurs). */
function drawCells(cells){
  let run=null;
  const flush=()=>{ if(run) L.rectangle(run.b,{renderer:state.canvas,interactive:false,fillColor:PRIO_COL[run.prio],fillOpacity:1,color:PRIO_COL[run.prio],weight:.6}).addTo(state.layerZones); run=null; };
  cells.forEach(c=>{ if(run&&c.x0===run.x0&&c.prio===run.prio&&Math.abs(c.y0-run.y1)<1e-6){ run.y1=c.y1; run.b=[run.b[0],c.b[1]]; } else { flush(); run={x0:c.x0,y1:c.y1,prio:c.prio,b:[c.b[0],c.b[1]]}; } });
  flush();
}
/* Vérifie que les polygones importés disent la même chose que les micro-zones saisies. */
function polyMismatch(s){
  const pp=priorityPolys(s), out=[];
  const inRing=(r,lo,la)=>{ let c=false; for(let i=0,j=r.length-1;i<r.length;j=i++){ if((r[i][1]>la)!==(r[j][1]>la)&&lo<(r[j][0]-r[i][0])*(la-r[i][1])/(r[j][1]-r[i][1])+r[i][0]) c=!c; } return c; };
  if(!pp.length) return out;
  s.zones.forEach((z,i)=>{ if(!Number.isFinite(z.lat)) return;
    const hit=pp.find(o=>inRing(o.rings[0],z.lon,z.lat));
    if(!hit) out.push((i+1)+'. '+z.label+' : hors des polygones importés');
    else if(hit.prio!==z.diag.priority) out.push((i+1)+'. '+z.label+' : saisie P'+z.diag.priority+', polygone P'+hit.prio); });
  return out;
}
function renderMap(){
  if(!state.map) return;
  state.layerSites.clearLayers(); state.layerZones.clearLayers(); state.cells=[];
  if(!state.map.getPane('cells')) state.map.createPane('cells').style.zIndex=350;
  state.canvas=state.canvas||L.canvas({padding:.5,pane:'cells'});
  state.sites.forEach(s=>{
    if(Number.isFinite(s.lat)) L.marker([s.lat,s.lon]).bindPopup('<b>'+esc(s.name)+'</b><br>'+s.zones.length+' micro-zone(s)').addTo(state.layerSites);
    if(s.geo) L.geoJSON(s.geo,{style:geoStyle}).addTo(state.layerSites);
    if(state.mapMode==='capteurs'){ drawSensors(s); return; }
    const g=priorityPolys(s).length?null:priorityGrid(s);
    if(g){
      state.cells=state.cells.concat(g.cells);
      drawCells(g.cells);
      g.zones.forEach(o=>L.rectangle(zoneBounds(o.z),{color:'#1a1a1a',weight:1.2,dashArray:'4 3',fill:false})
        .bindPopup('<b>'+o.n+'. '+esc(o.z.label)+'</b><br>'+PRIO_TXT[o.z.diag.priority]+'<br>Classe '+o.z.diag.cls+' — score mesuré '+o.z.diag.score+'/100<br>'+(Number.isFinite(o.z.area)?nf(o.z.area)+' m²':'')).addTo(state.layerZones));
    }
  });
  updateBaseNote();
  if(!state.ctl){
    L.control.scale({metric:true,imperial:false,position:'bottomright'}).addTo(state.map);
    const N=L.control({position:'topright'}); N.onAdd=()=>{ const d=L.DomUtil.create('div','northarrow'); d.innerHTML='▲<br>N'; return d; }; N.addTo(state.map); state.ctl=1;
  }
  if(state.legend) state.legend.remove();
  state.legend=L.control({position:'bottomleft'});
  state.legend.onAdd=()=>{ const d=L.DomUtil.create('div','maplegend'); d.innerHTML='<b>'+(state.mapMode==='capteurs'?'État du sol (pH des capteurs)':'Niveau de dégradation')+'</b><br>'+[4,3,2,1].map(k=>'<span style="display:inline-block;width:12px;height:12px;background:'+PRIO_COL[k]+';margin-right:6px;vertical-align:-2px"></span>'+PRIO_TXT[k]).join('<br>'); return d; };
  state.legend.addTo(state.map);
  const sw=(c,t)=>'<span style="display:inline-flex;align-items:center;gap:6px;margin-right:16px"><span style="width:12px;height:12px;background:'+c+';display:inline-block;border-radius:2px"></span>'+t+'</span>';
  $('mapLegend').innerHTML='<b>Légende :</b> '+[1,2,3,4].map(k=>sw(PRIO_COL[k],PRIO_TXT[k])).join('')+sw('#1e88e5','Réseau hydrographique (si importé)')+sw('#5c4c3d','Zone minière (si importée)')+
    '<br>Chaque micro-zone saisie (contour noir en tirets) apparaît exactement dans la couleur de sa priorité. Hors de ces zones, les cellules sont <b>interpolées</b> : ni mesure, ni analyse d\'image. Sans polygone « mine » importé, l\'étendue est approximative.'+
    state.sites.map(s=>{ const m=polyMismatch(s), n=s.zones.filter(z=>!Number.isFinite(z.lat)).length;
      return (n?'<br><b style="color:#b23a2e">'+n+' micro-zone(s) de « '+esc(s.name)+' » sans coordonnées : non représentée(s). Renseignez latitude et longitude de la zone.</b>':'')+
             (m.length?'<br><b style="color:#b23a2e">Incohérence avec les polygones importés : '+esc(m.join(' ; '))+'</b>':''); }).join('');
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