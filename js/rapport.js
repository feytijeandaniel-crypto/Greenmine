/* GREENMINE — rapport.js : Rapport imprimable. */
"use strict";
/* ---------- Rapport ---------- */
function renderReport(){
  const s = currentSite();
  if(!s || !s.zones.length){
    $('report').innerHTML = '<h2>GREENMINE — rapport de diagnostic</h2><p class="muted">Enregistrez au moins une micro-zone pour générer le rapport.</p>';
    return;
  }
  const syn = siteSynthesis(s);
  const author = $('author') ? $('author').value.trim() : '';
  const ordered = s.zones.slice().sort((a,b) => a.diag.priority - b.diag.priority || b.diag.score - a.diag.score);

  const zoneRows = ordered.map((z,i) => {
    const b = zoneBudget(z);
    return `<tr><td class="num">${i+1}</td><td>${esc(z.label)}</td><td>${esc(z.kind)}</td><td>${z.diag.cls}</td>
      <td class="num">P${z.diag.priority}</td><td class="num">${z.diag.score}</td><td class="num">${z.diag.completeness} %</td>
      <td class="num">${Number.isFinite(z.area) ? nf(z.area) : '—'}</td>
      <td class="num">${nf(b.min/1e6, 2)} – ${nf(b.max/1e6, 2)}</td></tr>`;
  }).join('');

  const zoneDetail = ordered.map(z => {
    const q = zoneQuantities(z);
    const ind = z.diag.contributions.map(c =>
      `<tr><td>${esc(c.label)}</td><td class="num">${nf(c.raw, (c.id === 'ndvi' || c.id === 'ph') ? 2 : 0)}</td><td class="num">${Math.round(c.deg)}</td><td class="num">${Math.round(c.wn*100)} %</td><td class="num">${Math.round(c.part)}</td></tr>`).join('');
    const mi = z.diag.metalIndex;
    const metalTable = mi ? `<h4>Métaux lourds</h4><table><thead><tr><th>Élément</th><th class="num">Teneur (mg/kg)</th><th class="num">Valeur guide</th><th class="num">Quotient</th></tr></thead><tbody>${
      METALS.filter(m => Number.isFinite(z.metals[m.id])).map(m => {
        const qt = z.metals[m.id]/m.guide;
        return `<tr><td>${esc(m.label)}</td><td class="num">${nf(z.metals[m.id], 2)}</td><td class="num">${m.guide}</td><td class="num"><b>${nf(qt, 2)}</b></td></tr>`;
      }).join('')}</tbody></table><p class="muted">Indice de contamination retenu : ${Math.round(mi.deg)}/100, à partir du quotient le plus élevé (${nf(mi.max, 2)}).</p>`
      : '<p class="muted">Aucun dosage de métaux lourds fourni pour cette zone.</p>';
    const ctx = [];
    if(Number.isFinite(z.slope)) ctx.push('pente ' + z.slope + ' %');
    if(Number.isFinite(z.humidity)) ctx.push('humidité ' + z.humidity + ' %');
    if(Number.isFinite(z.mndwi)) ctx.push('MNDWI ' + z.mndwi);
    if(Number.isFinite(z.ndti)) ctx.push('NDTI ' + z.ndti);
    return `<h4>${esc(z.label)} — zone ${z.diag.cls}, priorité ${z.diag.priority}</h4>
      <p class="muted">${esc(z.kind)} • ${Number.isFinite(z.area) ? nf(z.area) + ' m²' : 'surface non renseignée'} •
        ${Number.isFinite(z.lat) ? z.lat.toFixed(5) + ', ' + z.lon.toFixed(5) : 'non géolocalisée'}${ctx.length ? ' • ' + esc(ctx.join(', ')) : ''}</p>
      <table><thead><tr><th>Indicateur</th><th class="num">Valeur</th><th class="num">Dégradation /100</th><th class="num">Poids retenu</th><th class="num">Apport</th></tr></thead>
      <tbody>${ind}<tr><th colspan="4">Score de la zone</th><th class="num">${z.diag.score}</th></tr></tbody></table>
      ${metalTable}
      <p><b>Itinéraire technique :</b> ${esc(CLASSES[z.diag.cls].action)}</p>
      <p><b>Espèces :</b> ${esc(CLASSES[z.diag.cls].especes)}</p>
      ${q.vetiverMax > 0 ? `<p><b>Quantités :</b> ${nf(q.vetiverMin)} à ${nf(q.vetiverMax)} plants de vétiver, ${nf(q.compostMin)} à ${nf(q.compostMax)} kg de compost mûr.</p>` : ''}`;
  }).join('');

  const agg = {};
  s.zones.forEach(z => zoneBudget(z).lines.forEach(l => {
    if(!agg[l.id]) agg[l.id] = {label:l.label, min:0, max:0};
    agg[l.id].min += l.min; agg[l.id].max += l.max;
  }));
  const budgetRows = POSTES.filter(p => agg[p.id]).map(p =>
    `<tr><td>${esc(agg[p.id].label)}</td><td class="num">${nf(fcfa(agg[p.id].min))}</td><td class="num">${nf(fcfa(agg[p.id].max))}</td></tr>`).join('');

  const follow = s.followups.map(f =>
    `<tr><td>${esc(f.label)}</td><td>${dateFR(f.date)}</td><td class="num">${Number.isFinite(f.ndvi) ? f.ndvi.toFixed(2) : '—'}</td>
     <td class="num">${Number.isFinite(f.surv) ? f.surv + ' %' : '—'}</td><td class="num">${Number.isFinite(f.height) ? f.height + ' cm' : '—'}</td>
     <td class="num">${Number.isFinite(f.ph) ? f.ph.toFixed(1) : '—'}</td><td>${esc(f.note || '')}</td></tr>`).join('');

  $('report').innerHTML = `
    <h2>GREENMINE — rapport de réhabilitation</h2>
    <p><span class="pill">Priorité ${syn.priority} — ${esc(PRIORITIES[syn.priority].label)}</span>
       <span class="pill">Classe la plus étendue : ${syn.dominant}</span>
       <span class="pill">${syn.count} micro-zone(s)</span></p>
    <h3>${esc(s.name)}</h3>
    <p class="muted">${esc(s.type)}${s.openPit ? ' — à ciel ouvert : ' + esc(s.openPit) : ''}${s.operator ? ' — ' + esc(s.operator) : ''}${Number.isFinite(s.closure) ? ' — fermeture prévue en ' + s.closure : ''}<br>
      Coordonnées du site : ${s.lat.toFixed(6)}, ${s.lon.toFixed(6)} — emprise affichée de ${nf(s.radius)} m de rayon<br>
      Surface diagnostiquée : ${nf(syn.area)} m² (${nf(syn.area/10000, 2)} ha)<br>
      Rapport établi le ${dateFR(new Date().toISOString())}${author ? ' par ' + esc(author) : ''}</p>
    <hr>

    <h3>Conclusion</h3>
    <p>Le site se décompose en <b>${syn.count} micro-zones homogènes d'intervention</b>. Son score de dégradation pondéré par les surfaces s'établit à <b>${syn.score} sur 100</b>, et la zone la plus urgente impose une <b>priorité ${syn.priority}</b> (${esc(PRIORITIES[syn.priority].horizon)}).</p>
    <p>Répartition des surfaces : ${Object.keys(CLASSES).filter(k => syn.shares[k] > 0).map(k => 'zone ' + k + ' ' + nf(syn.shares[k]/10000, 2) + ' ha').join(', ')}.
       ${syn.areaP1 > 0 ? nf(syn.areaP1/10000, 2) + ' ha relèvent d\'une intervention immédiate.' : 'Aucune surface ne relève d\'une intervention immédiate.'}</p>
    <p>Le chiffrage indicatif de l'ensemble des itinéraires techniques s'établit entre <b>${nf(syn.bmin/1e6, 1)} et ${nf(syn.bmax/1e6, 1)} millions de FCFA</b>.</p>
    <p class="muted">Indice de confiance moyen : ${syn.completeness} % des indicateurs attendus sont renseignés.</p>
    ${s.history ? '<p><b>Observations de terrain :</b> ' + esc(s.history) + '</p>' : ''}

    <h3>Micro-zonation et ordre d'engagement</h3>
    <table><thead><tr><th class="num">Ordre</th><th>Zone</th><th>Nature</th><th>Classe</th><th class="num">Priorité</th><th class="num">Score</th><th class="num">Confiance</th><th class="num">Surface m²</th><th class="num">Budget M FCFA</th></tr></thead><tbody>${zoneRows}</tbody></table>

    <h3>Détail par micro-zone</h3>
    <p class="muted">Le score est une moyenne pondérée des niveaux de dégradation. Les poids sont recalculés sur les seuls indicateurs renseignés : un champ vide est exclu du calcul et n'est jamais traité comme une valeur nulle.</p>
    ${zoneDetail}

    <h3>Chiffrage indicatif</h3>
    <p class="muted">Extrapolé du budget de pré-faisabilité établi pour une parcelle pilote de 1 000 m², modulé par classe puis corrigé d'un coefficient d'échelle décroissant avec la surface. Hors terrassement lourd, études réglementaires, taxes et aléas. Prélèvements et analyses proportionnels à la surface : à remplacer par un devis fondé sur le nombre d'échantillons.</p>
    <table><thead><tr><th>Poste</th><th class="num">Estimation basse (FCFA)</th><th class="num">Estimation haute (FCFA)</th></tr></thead>
    <tbody>${budgetRows}</tbody><tfoot><tr><th>Total indicatif</th><th class="num">${nf(fcfa(syn.bmin))}</th><th class="num">${nf(fcfa(syn.bmax))}</th></tr></tfoot></table>

    ${planHTML(s)}
    <h3>Points de vigilance</h3>
    <ul>${watchFor(s).map(w => '<li>' + esc(w) + '</li>').join('')}</ul>

    <h3>Suivi M0 → M3 → M6 → M12</h3>
    <table><thead><tr><th>Campagne</th><th>Date</th><th class="num">NDVI</th><th class="num">Survie</th><th class="num">Hauteur</th><th class="num">pH</th><th>Observation</th></tr></thead><tbody>${follow}</tbody></table>

    <h3>Cadre réglementaire</h3>
    <p>La réhabilitation des sites miniers, la mise en œuvre d'un plan de fermeture et le suivi environnemental après fermeture sont imposés par la <b>loi n°2014-138 du 24 mars 2014 portant Code minier</b>, ainsi que par ses textes d'application (articles et décrets exacts : à faire valider par un juriste avant diffusion). Le présent document constitue une pièce technique d'aide à la décision ; il ne se substitue pas au plan de fermeture ni aux pièces exigées par l'autorité compétente.</p>

    <h3>Pièces jointes</h3>
    <p>${s.files && s.files.length ? esc(s.files.map(f => f.name).join(', ')) : 'Aucune pièce jointe enregistrée.'}</p>

    <h3>Portée et limites</h3>
    <p class="muted">Le classement repose sur un moteur de règles explicites appliqué aux données saisies : il oriente la décision mais ne remplace ni les analyses de laboratoire, ni le dimensionnement des ouvrages, ni le contrôle réglementaire. Les valeurs guides des métaux sont indicatives pour un usage agricole et doivent être confrontées aux exigences de l'autorité compétente. Le NDVI, le MNDWI et le NDTI doivent provenir de données multispectrales calibrées ; leur calcul automatique à partir d'images Sentinel-2 ou d'orthomosaïques drone, ainsi que le tracé des polygones de micro-zonation, supposent un moteur géospatial serveur qui n'est pas embarqué dans ce prototype.</p>

    <div class="sig"><div>Établi par<br><b>${author ? esc(author) : '.........................................'}</b></div><div>Visa du client<br><b>.........................................</b></div></div>`;
}

function printReport(){
  const s = currentSite();
  if(!s || !s.zones.length){ toast('Aucun diagnostic à imprimer.', true); return; }
  go('rapport');
  setTimeout(() => window.print(), 250);
}

