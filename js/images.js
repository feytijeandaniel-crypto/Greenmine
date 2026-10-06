/* images.js : étape 2 — images réelles du site (téléphone, drone, satellite), conservées dans le projet. */
"use strict";
function addImages(list){
  const s=currentSite();
  if(!s){ toast('Enregistrez d\'abord le site et une micro-zone (étape 1).',true); return; }
  const src=$('imgSource').value; s.images=s.images||[];
  [...list].filter(f=>f.type.indexOf('image/')===0).forEach(f=>{
    const r=new FileReader();
    r.onload=()=>{ const im=new Image(); im.onload=()=>{
      const k=Math.min(1,1200/Math.max(im.width,im.height)), c=document.createElement('canvas');
      c.width=Math.round(im.width*k); c.height=Math.round(im.height*k);
      c.getContext('2d').drawImage(im,0,0,c.width,c.height);
      s.images.push({id:uid('I'),name:f.name,source:src,date:new Date().toISOString().slice(0,10),data:c.toDataURL('image/jpeg',.8)});
      store.save(); renderImages(); renderParcours(); toast('Image ajoutée : '+src+'.');
    }; im.src=r.result; };
    r.readAsDataURL(f);
  });
}
function removeImage(id){ const s=currentSite(); if(!s) return; s.images=(s.images||[]).filter(i=>i.id!==id); store.save(); renderImages(); renderParcours(); }
function renderImages(){
  const s=currentSite(), el=$('imgGrid'); if(!el) return;
  const im=s&&s.images||[];
  el.innerHTML=im.length?im.map(i=>'<div class="thumb"><img src="'+i.data+'" alt="'+esc(i.name)+'" style="height:150px"><span><b>'+esc(i.source)+'</b> · '+esc(i.name)+
    ' <button class="btn sm danger" onclick="removeImage(\''+i.id+'\')">×</button></span></div>').join(''):'<div class="empty">Aucune image importée pour ce site.</div>';
}
window.addEventListener('load',()=>{ $('imgFile').addEventListener('change',e=>{ addImages(e.target.files); e.target.value=''; }); });
