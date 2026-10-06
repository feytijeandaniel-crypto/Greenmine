/* GREENMINE — suivi.js : Suivi M0→M12, courbe NDVI, fichiers et images. */
"use strict";
/* ---------- Suivi ---------- */
function renderFollowups(){
  const s = currentSite();
  const body = $('followups');
  if(!s){
    body.innerHTML = '<tr><td colspan="8" class="empty">Aucun site sélectionné.</td></tr>';
    $('followIntro').textContent = 'Aucun site sélectionné.';
    $('spark').innerHTML = '';
    return;
  }
  $('followIntro').textContent = 'Site « ' + s.name + ' ». L\'état initial sert de référence à toutes les comparaisons.';
  const base = s.followups.find(f => f.baseline);
  body.innerHTML = s.followups.map((f,i) => {
    let delta = '—';
    if(Number.isFinite(f.ndvi) && base && Number.isFinite(base.ndvi) && !f.baseline){
      const dv = f.ndvi - base.ndvi;
      delta = '<span style="color:' + (dv >= 0 ? 'var(--green)' : 'var(--red)') + '">' + (dv >= 0 ? '+' : '') + dv.toFixed(2) + '</span>';
    }
    return `<tr>
      <td>${esc(f.label)}${f.baseline ? ' <span class="pill">référence</span>' : ''}</td>
      <td>${dateFR(f.date)}</td>
      <td class="num">${Number.isFinite(f.ndvi) ? f.ndvi.toFixed(2) : '—'}</td>
      <td class="num">${Number.isFinite(f.surv) ? f.surv + ' %' : '—'}</td>
      <td class="num">${Number.isFinite(f.height) ? f.height + ' cm' : '—'}</td>
      <td class="num">${Number.isFinite(f.ph) ? f.ph.toFixed(1) : '—'}</td>
      <td class="num">${delta}</td>
      <td class="num">${f.baseline ? '' : '<button class="btn sm danger" onclick="removeFollowup(' + i + ')">×</button>'}</td>
    </tr>`;
  }).join('');
  renderSpark(s.followups.filter(f => Number.isFinite(f.ndvi)));
}

function addFollowup(){
  const s = currentSite();
  if(!s){ toast('Sélectionnez ou créez d\'abord un site.', true); return; }
  const label = $('fLabel').value.trim();
  if(!label){ toast('Donnez un intitulé à la campagne.', true); $('fLabel').focus(); return; }
  s.followups.push({label, date:$('fDate').value || new Date().toISOString().slice(0,10),
    ndvi:readField('fNdvi'), surv:readField('fSurv'), height:readField('fHeight'), ph:readField('fPh'),
    note:$('fNote').value.trim()});
  s.followups.sort((a,b) => a.baseline ? -1 : b.baseline ? 1 : String(a.date).localeCompare(String(b.date)));
  ['fLabel','fDate','fNdvi','fSurv','fHeight','fPh','fNote'].forEach(id => $(id).value = '');
  store.save();
  renderFollowups(); renderReport();
  toast('Campagne enregistrée.');
}

function removeFollowup(i){
  const s = currentSite();
  if(!s) return;
  s.followups.splice(i,1);
  store.save();
  renderFollowups(); renderReport();
}

function renderSpark(pts){
  const svg = $('spark');
  if(pts.length < 2){ svg.innerHTML = '<text x="8" y="48" fill="#8a8478" font-size="11">Deux campagnes avec NDVI sont nécessaires pour tracer la courbe.</text>'; return; }
  const W = 320, H = 90, pad = 12;
  const vals = pts.map(p => p.ndvi);
  const min = Math.min.apply(null, vals.concat([0])), max = Math.max.apply(null, vals.concat([0.1]));
  const x = i => pad + i*(W-2*pad)/(pts.length-1);
  const y = v => H-pad - ((v-min)/((max-min) || 1))*(H-2*pad);
  const path = pts.map((p,i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.ndvi).toFixed(1)).join(' ');
  svg.innerHTML = '<line class="ax" x1="' + pad + '" y1="' + (H-pad) + '" x2="' + (W-pad) + '" y2="' + (H-pad) + '"/>' +
    '<path class="ln" d="' + path + '"/>' +
    pts.map((p,i) => '<circle class="pt" cx="' + x(i).toFixed(1) + '" cy="' + y(p.ndvi).toFixed(1) + '" r="3"><title>' + esc(p.label) + ' : ' + p.ndvi.toFixed(2) + '</title></circle>').join('');
}

/* ---------- Fichiers ---------- */
function handleFiles(list){
  let added = 0;
  for(const f of list){
    if(f.size > 30*1024*1024){ toast(f.name + ' dépasse 30 Mo et n\'a pas été ajouté.', true); continue; }
    state.files.push({name:f.name, size:f.size, type:f.type || 'fichier',
      url:(f.type && f.type.indexOf('image/') === 0) ? URL.createObjectURL(f) : null});
    added++;
  }
  if(added) toast(added + ' fichier(s) ajouté(s).');
  renderFiles();
}

function renderFiles(){
  $('fileList').innerHTML = state.files.map((f,i) =>
    `<div class="file"><div><b>${esc(f.name)}</b><br><span class="tag">${esc(f.type)} — ${(f.size/1048576).toFixed(2)} Mo</span></div>
     <button class="btn sm danger" onclick="removeFile(${i})">Retirer</button></div>`).join('');
  $('thumbs').innerHTML = state.files.filter(f => f.url).map(f =>
    `<div class="thumb"><img src="${f.url}" alt="${esc(f.name)}"><span>${esc(f.name)}</span></div>`).join('');
  const el = $('dataCenter');
  el.innerHTML = state.files.length
    ? `<table class="table"><thead><tr><th>Fichier</th><th>Type</th><th class="num">Taille</th></tr></thead><tbody>${
        state.files.map(f => `<tr><td>${esc(f.name)}</td><td>${esc(f.type)}</td><td class="num">${(f.size/1048576).toFixed(2)} Mo</td></tr>`).join('')}</tbody></table>`
    : '<div class="empty">Aucun fichier importé.</div>';
}

function removeFile(i){
  const f = state.files[i];
  if(f && f.url) URL.revokeObjectURL(f.url);
  state.files.splice(i,1);
  renderFiles();
}

