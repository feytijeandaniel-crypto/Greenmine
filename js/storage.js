/* GREENMINE — storage.js : Utilitaires, stockage navigateur (localStorage), import/export JSON et CSV. */
"use strict";
const $ = id => document.getElementById(id);
/* ============================================================
   2. UTILITAIRES
   ============================================================ */
const clamp = (v,a,b) => Math.min(b, Math.max(a, v));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = p => (p||'X') + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
const nf = (v,d=0) => Number.isFinite(v) ? v.toLocaleString('fr-FR',{minimumFractionDigits:d, maximumFractionDigits:d}) : '—';
const fcfa = v => Number.isFinite(v) ? Math.round(v/1000)*1000 : 0;

function toast(msg, isError){
  const t = $('toast');
  t.textContent = msg;
  t.classList.toggle('err', !!isError);
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3400);
}

function readField(id){
  const el = $(id);
  if(!el) return null;
  const raw = String(el.value).trim();
  if(raw === '') return null;
  const v = parseFloat(raw.replace(',','.'));
  return Number.isFinite(v) ? v : null;
}

function dateFR(iso){
  if(!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? esc(iso) : d.toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'});
}

const store = {
  save(){ try{ localStorage.setItem('greenmine.v4', JSON.stringify({sites:state.sites, currentId:state.currentId})); }catch(e){ toast('Stockage du navigateur plein : exportez le portefeuille (JSON).', true); } },
  load(){ try{ const r = localStorage.getItem('greenmine.v4'); return r ? JSON.parse(r) : null; }catch(e){ return null; } },
  clear(){ try{ localStorage.removeItem('greenmine.v4'); }catch(e){} }
};

/* ---------- Import / export ---------- */
function download(filename, content, mime){
  const blob = new Blob([content], {type:mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function exportProject(){
  if(!state.sites.length){ toast('Rien à exporter.', true); return; }
  download('greenmine-portefeuille.json', JSON.stringify({version:4, exportedAt:new Date().toISOString(), sites:state.sites}, null, 2), 'application/json');
  toast('Portefeuille exporté.');
}

function exportCSV(){
  const rows = [];
  state.sites.forEach(s => s.zones.forEach(z => {
    const b = zoneBudget(z);
    rows.push([s.name, s.type, s.lat, s.lon, z.label, z.kind, z.area ?? '', z.diag.cls, z.diag.priority,
      z.diag.score, z.diag.completeness, Math.round(b.min), Math.round(b.max)]);
  }));
  if(!rows.length){ toast('Rien à exporter.', true); return; }
  const head = ['Site','Type','Lat','Lon','Zone','Nature','Surface m2','Classe','Priorite','Score','Confiance %','Budget bas FCFA','Budget haut FCFA'];
  const csv = [head].concat(rows).map(r => r.map(v => '"' + String(v).replace(/"/g,'""') + '"').join(';')).join('\n');
  download('greenmine-zones.csv', '\ufeff' + csv, 'text/csv;charset=utf-8');
  toast('Tableau exporté.');
}

function importProject(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const data = JSON.parse(reader.result);
      if(!data || !Array.isArray(data.sites)) throw new Error('format');
      const valid = data.sites.filter(s => s && Array.isArray(s.zones) && Number.isFinite(s.lat));
      if(!valid.length) throw new Error('vide');
      valid.forEach(s => {
        s.id = s.id || uid('S');
        s.followups = Array.isArray(s.followups) ? s.followups : [];
        s.zones.forEach(z => { z.id = z.id || uid('Z'); });
      });
      state.sites = state.sites.concat(valid);
      state.currentId = valid[0].id;
      store.save();
      renderAll();
      toast(valid.length + ' site(s) importé(s).');
    }catch(e){ toast('Fichier illisible : attendu un export GREENMINE au format JSON.', true); }
  };
  reader.onerror = () => toast('Lecture du fichier impossible.', true);
  reader.readAsText(file);
}

