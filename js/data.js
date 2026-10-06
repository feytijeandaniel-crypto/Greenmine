/* GREENMINE — data.js : Référentiels : indicateurs, classes A–E, règles, postes de coût, fonds de carte. Modifier ici pour changer la méthode. */
"use strict";
/* ============================================================
   1. REFERENTIEL
   ============================================================ */

/* Indicateurs scorés. Chaque fonction convertit une mesure en niveau de
   dégradation 0-100. Les poids sont renormalisés sur les seuls indicateurs
   renseignés, de sorte qu'un champ vide n'est jamais lu comme un zéro. */
const INDICATORS = [
  {id:'veg',     label:'Couvert végétal',          unit:'%',    weight:.16, min:0,  max:100, step:1,   ph:'12',   degrade:v=>100-v},
  {id:'ndvi',    label:'NDVI moyen',               unit:'',     weight:.10, min:-1, max:1,   step:.01, ph:'0.08', degrade:v=>100-((v+1)/2*100)},
  {id:'erosion', label:'Érosion',                  unit:'/100', weight:.22, min:0,  max:100, step:1,   ph:'80',   degrade:v=>v},
  {id:'contam',  label:'Risque de contamination',  unit:'/100', weight:.20, min:0,  max:100, step:1,   ph:'40',   degrade:v=>v},
  {id:'compact', label:'Compaction du sol',        unit:'/100', weight:.13, min:0,  max:100, step:1,   ph:'70',   degrade:v=>v},
  {id:'soil',    label:'Fertilité du sol',         unit:'/100', weight:.11, min:0,  max:100, step:1,   ph:'20',   degrade:v=>100-v},
  {id:'ph',      label:'pH du sol',                unit:'',     weight:.08, min:0,  max:14,  step:.1,  ph:'5.0',  degrade:v=>clamp(Math.abs(v-6.5)/2.5*100,0,100)}
];

/* Valeurs guides indicatives pour un usage agricole (mg/kg de sol sec). */
const METALS = [
  {id:'as', label:'Arsenic (As)',  guide:12,  ph:'18'},
  {id:'hg', label:'Mercure (Hg)',  guide:6.6, ph:'2.4'},
  {id:'pb', label:'Plomb (Pb)',    guide:70,  ph:'85'},
  {id:'cd', label:'Cadmium (Cd)',  guide:1.4, ph:'0.9'}
];

const CLASSES = {
  A:{title:'Dégradation majeure', color:'var(--cA)',
     etat:'Très fortement dégradée',
     problem:'Sol dénudé, excavations, sol stérile.',
     action:'Réhabilitation lourde prioritaire : sécurisation, reprofilage, reconstitution d\'un support de sol avant toute plantation.',
     especes:'Vétiver (Chrysopogon zizanioides) en lignes, Acacia auriculiformis et Cassia siamea en pionnières, Stylosanthes en couverture.'},
  B:{title:'Contamination dominante', color:'var(--cB)',
     etat:'Risque de contamination',
     problem:'Présence ou concentration de métaux lourds.',
     action:'Phytostabilisation et amendements spécialisés. Aucune culture alimentaire, aucun pâturage sur la zone.',
     especes:'Vétiver dense, Acacia mangium, Paspalum spp. Strictement non alimentaires tant que les teneurs ne sont pas rentrées dans les valeurs guides.'},
  C:{title:'Érosion forte', color:'var(--cC)',
     etat:'Érosion forte',
     problem:'Ruissellement intense, ravinement.',
     action:'Ouvrages anti-érosion et vétiver en lignes suivant les courbes de niveau, avant toute autre intervention.',
     especes:'Vétiver en haies serrées, Andropogon gayanus, Bambusa vulgaris en pied de ravine.'},
  D:{title:'Faible reprise végétale', color:'var(--cD)',
     etat:'Faible reprise végétale',
     problem:'Végétation clairsemée, sol tassé.',
     action:'Restauration assistée et amendement léger : décompaction superficielle puis végétalisation en poquets enrichis.',
     especes:'Légumineuses de couverture (Mucuna, Pueraria, Stylosanthes), Acacia auriculiformis, essences locales en enrichissement.'},
  E:{title:'Régénération naturelle', color:'var(--cE)',
     etat:'Régénération naturelle',
     problem:'Couverts végétaux spontanés résilients.',
     action:'Mise en défens et surveillance passive, enrichissement ponctuel seulement.',
     especes:'Essences locales en complément de la régénération : Terminalia superba, Ceiba pentandra, fruitiers en périphérie.'}
};

const PRIORITIES = {
  1:{label:'Intervention immédiate', horizon:'engagement sous 3 mois'},
  2:{label:'Intervention planifiée', horizon:'engagement sous 12 mois'},
  3:{label:'Traitement différé',     horizon:'engagement sous 24 mois'},
  4:{label:'Surveillance',           horizon:'campagne annuelle'}
};

const RULES = [
  ['1','Score ≥ 75, ou score ≥ 65 avec un couvert végétal < 15 %','A','Sol décapé ou dégradation généralisée : reconstituer le support prime sur tout le reste.'],
  ['2','Quotient métal ≥ 1, contamination ≥ 50, ou contamination dominante et ≥ 35','B','Le risque sanitaire commande l\'itinéraire : phytostabilisation, pas de valorisation alimentaire.'],
  ['3','Érosion ≥ 60, ou érosion dominante et ≥ 45','C','La perte de matériau doit être arrêtée avant toute végétalisation.'],
  ['4','Couvert végétal < 35 %, NDVI < 0,25, ou compaction ≥ 55','D','Le milieu ne se referme pas seul : assistance nécessaire.'],
  ['5','Aucune règle précédente déclenchée','E','La dynamique naturelle est engagée.']
];

/* Postes de dépense, en FCFA pour 1 000 m², d'après le budget de
   pré-faisabilité du pilote, avec un coefficient par classe. */
const POSTES = [
  {id:'carto',   label:'Prélèvements de sol sur grille et cartographie initiale', min:100000, max:200000, coef:{A:1,   B:1.2, C:1,   D:0.8, E:0.6}},
  {id:'labo',    label:'Analyses initiales de sol en laboratoire',                min:500000, max:1000000,coef:{A:1,   B:1.6, C:0.9, D:0.7, E:0.4}},
  {id:'secur',   label:'Sécurisation, reprofilage léger et rigoles de dérivation',min:300000, max:600000, coef:{A:1,   B:0.5, C:0.8, D:0.2, E:0}},
  {id:'prep',    label:'Préparation du terrain et travaux d\'aménagement',        min:150000, max:300000, coef:{A:1,   B:0.9, C:1,   D:0.7, E:0}},
  {id:'antiero', label:'Ouvrages anti-érosifs (seuils, fascines, cordons)',       min:200000, max:450000, coef:{A:0.6, B:0.3, C:1,   D:0.2, E:0}},
  {id:'vetiver', label:'Plants de vétiver',                                       min:150000, max:300000, coef:{A:1,   B:0.9, C:1.3, D:0.6, E:0}},
  {id:'compost', label:'Amendements organiques (compost mûr)',                    min:200000, max:400000, coef:{A:1,   B:0.9, C:0.8, D:0.6, E:0}},
  {id:'biochar', label:'Biochar et amendement minéral complémentaire',            min:100000, max:250000, coef:{A:1,   B:1.3, C:0.7, D:0.5, E:0}},
  {id:'mo',      label:'Main-d\'œuvre de plantation et traçage des lignes',       min:150000, max:300000, coef:{A:1,   B:1,   C:1.1, D:0.7, E:0}},
  {id:'entret',  label:'Entretien, arrosage initial et suivi (6 à 12 mois)',      min:150000, max:300000, coef:{A:1,   B:1,   C:1,   D:0.8, E:0.3}},
  {id:'suiviLab',label:'Analyses de suivi en laboratoire (M3, M6, M12)',          min:500000, max:1000000,coef:{A:1,   B:1.5, C:0.8, D:0.6, E:0.4}},
  {id:'biomasse',label:'Gestion contrôlée des biomasses contaminées',             min:100000, max:250000, coef:{A:0.8, B:1.5, C:0.4, D:0.3, E:0}},
  {id:'defens',  label:'Mise en défens (clôture, pare-feu, signalisation)',       min:100000, max:200000, coef:{A:0.8, B:1.2, C:0.6, D:0.6, E:1}}
];

/* Densité de plantation de vétiver, en plants pour 1 000 m². */
const VETIVER = {A:[2500,3000], B:[2000,2500], C:[2800,3500], D:[1200,1800], E:[0,0]};
const PRIX_COMPOST_KG = 200; // 10 000 FCFA le sac de 50 kg

const BASEMAPS = [
  {id:'sat',   name:'Imagerie satellite', url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
   opts:{maxZoom:19, crossOrigin:true, attribution:'Imagerie Esri, Maxar, Earthstar Geographics'}},
  {id:'plan',  name:'Plan', url:'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
   opts:{maxZoom:19, subdomains:'abcd', crossOrigin:true, attribution:'© OpenStreetMap, © CARTO'}},
  {id:'sombre',name:'Fond sombre', url:'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png',
   opts:{maxZoom:19, subdomains:'abcd', crossOrigin:true, attribution:'© OpenStreetMap, © CARTO'}}
];

const state = {
  sites: [], currentId: null, editingZoneId: null, files: [],
  map:null, layerSites:null, layerZones:null, baseLayers:{}, baseId:'sat', picking:false
};

