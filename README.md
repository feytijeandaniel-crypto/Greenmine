# GREENMINE
Landing (`index.html`) + espace de travail (`app.html`), sans framework. Ouvrir `index.html` (Internet requis : Leaflet, polices).

## Parcours
1 Site et micro-zones → 2 Images (téléphone/drone/satellite) → 3 Carte de priorisation → 4 Analyses de laboratoire → 5 Plan de réhabilitation → 6 Rapport final.

## Où modifier quoi
- Charte : `css/style.css` ; composants app : `css/components.css` ; mobile : `css/responsive.css`
- Référentiels et coûts : `js/data.js` ; diagnostic : `js/diagnostic.js` ; chiffrage : `js/budget.js`
- Images : `js/images.js` ; carte et GeoJSON : `js/cartographie.js` ; labo : `js/laboratoire.js` ; plan et fil d'étapes : `js/plan.js` ; rapport : `js/rapport.js` ; stockage : `js/storage.js`
- Garder l'ordre des `<script>` (variables globales partagées).

## Ce qui n'est PAS fait (volontairement)
Aucune télédétection ni analyse SIG réelle : les images sont conservées, les couches SIG s'importent en GeoJSON (`type` = mine, hydro, zone). Les priorités viennent des indicateurs saisis. Le site « DÉMO » est fictif. Références légales du rapport à faire valider par un juriste.
