const updatedUniverseAssets = {stationery:'stationery-alya-aaron','merch-hero':'merch-hero-alya-aaron'};
'use strict';
const useCases = [
  {id:'youtube-izan',person:'Izan',label:'Vidéos',title:'Regarder une vidéo',caption:'Un voyage dans l’espace sur YouTube, directement dans l’écran. Un toucher pour mettre sur pause, puis repartir.',alt:'Un garçon touche le bouton pause d’une vidéo YouTube de fusée sur l’écran circulaire d’Izan, assis immobile sur la table.'},
  {id:'telephone-noah',person:'Noah',label:'Téléphone',title:'Composer un numéro',caption:'Les chiffres s’affichent dans le regard de Noah. L’enfant compose son numéro sur le clavier tactile.',alt:'Un garçon appuie sur le clavier téléphonique affiché dans l’écran de Noah. Les chiffres et le bouton vert d’appel sont visibles.'},
  {id:'appel-liam',person:'Aaron',label:'Appel vidéo',title:'Faire coucou à mamie',caption:'Mamie apparaît dans l’écran d’Aaron. Un sourire, un signe de la main : le lien prend tout son sens.',alt:'Un garçon fait un signe de la main à sa grand-mère, visible en appel vidéo dans l’écran rond d’Aaron, avec un bouton rouge pour raccrocher.'},
  {id:'histoire-sana',person:'Sana',label:'Histoires',title:'Écouter une aventure',caption:'Au calme, avec Sana, l’enfant découvre L’île des étoiles. La voix raconte, l’écran illustre, l’imagination fait le reste.',alt:'Une petite fille en pyjama écoute une histoire au lit. Sana est posée sur la table de chevet, son écran affiche L’île des étoiles et un bouton pause.'},
  {id:'maths-elya',person:'Alya',label:'Mathématiques',title:'Trouver la bonne réponse',caption:'7 + 5 ? L’enfant choisit 12 sur l’écran d’Alya. Un exercice concret, une réponse au bout du doigt.',alt:'Une petite fille touche la réponse 12 au calcul 7 + 5 sur l’écran d’Alya, qui porte sa casquette en moumoute ivoire.'},
  {id:'jeu-lea',person:'Léa',label:'Jeu éducatif',title:'Apprendre en jouant',caption:'Un cercle, un carré, un triangle… Avec Léa, l’enfant observe, reconnaît la forme et la touche à l’écran.',alt:'Une petite fille sélectionne le triangle orange dans un jeu de reconnaissance des formes sur l’écran de Léa aux deux couettes.'}
];
const merchandise = [
  {id:'keychains',kind:'merch',name:'BEYBOO Mini',type:'Les porte-clés',short:'Un petit compagnon. Partout avec vous.',description:'Noah, Aaron, Mila et Alya en format miniature : des matières douces, un mousqueton et le regard signature. À accrocher à ses clés ou à son sac pour emporter un peu de son univers.',note:'Concept de porte-clés en peluche. Le regard est décoratif, sans écran ni électronique.'},
  {id:'bottles',kind:'merch',name:'BEYBOO Bottle',type:'Les gourdes',short:'La pause fraîcheur a son personnage.',description:'Bleu glacier, ivoire ou rose tendre : une gourde avec anse de transport et base en silicone amovible. Les personnages accompagnent les petits rituels de la journée.',note:'Concept de gourde. Contenance, matériaux et performances à définir. Motifs décoratifs, sans électronique.'},
  {id:'phone',kind:'merch',name:'BEYBOO Everyday',type:'Les essentiels téléphone',short:'Des détails à garder à portée de main.',description:'Coque, support de téléphone dépliable en forme d’œil, dragonne, porte-cartes et bijoux de sac : une famille de petits objets qui associe le bleu glacier au métal argenté.',note:'Concepts d’accessoires. Modèles de téléphone et compatibilités à préciser. Yeux décoratifs, sans écran.'},
  {id:'bags',kind:'merch',name:'BEYBOO Go',type:'Les sacs & trousses',short:'Toutes vos aventures commencent ici.',description:'Un sac à dos, une trousse et un tote bag écru, à personnaliser avec un mini-compagnon. La collection réunit les mêmes matières claires et les mêmes détails bleus.',note:'Concepts de maroquinerie textile. Dimensions à définir. Gourde et porte-clés montrés en mise en scène, à sélectionner séparément.'},
  {id:'lunch',kind:'merch',name:'BEYBOO Lunch',type:'La pause déjeuner',short:'Une bonne histoire se partage à table.',description:'Une boîte à repas à compartiments, des couverts et une pochette de transport. Aaron et Noah donnent leur personnalité à ce rituel du quotidien.',note:'Concept d’ensemble repas. Matériaux et caractéristiques à valider. Gourde illustrée, à sélectionner séparément.'},
  {id:'stationery',kind:'merch',name:'BEYBOO Studio',type:'La papeterie',short:'Une page blanche. Mille aventures.',description:'Carnets de personnages, marque-pages, autocollants et crayons : de quoi inventer la prochaine aventure de Noah, composer avec Aaron ou dessiner avec Alya et Mila.',note:'Concept de papeterie. Formats et contenu des ensembles à définir. Illustrations décoratives.'}
];
const campaigns = [
  {id:'campaign-01',title:'Les petits moments de Mila',person:'Mila',group:'family',caption:'Une enfant, son compagnon et un moment de douceur à la maison.'},
  {id:'campaign-02',title:'Le début d’une aventure',person:'Noah',group:'family',caption:'Un garçon retrouve Noah : un univers à découvrir, un écran à explorer.'},
  {id:'campaign-03',title:'Deux compagnons, mille idées',person:'Noah & Alya',group:'family',caption:'Deux enfants partagent une même curiosité, chacun avec son personnage.'},
  {id:'campaign-04',title:'Les histoires se partagent',person:'Noah',group:'family',caption:'Un père et son enfant prennent le temps d’inventer une aventure ensemble.'},
  {id:'campaign-05',title:'Une touche de Mila',person:'Mila',group:'style',caption:'Un compagnon qui trouve aussi sa place dans un univers mode et lifestyle.'},
  {id:'campaign-06',title:'La première rencontre',person:'Alya',group:'style',caption:'Le plaisir de découvrir Alya et les détails de son écrin.'},
  {id:'campaign-07',title:'Un regard sur votre intérieur',person:'Izan',group:'style',caption:'Izan dans un intérieur contemporain : un objet de caractère et de conversation.'},
  {id:'campaign-08',title:'Chacun sa fréquence',person:'Aaron',group:'style',caption:'Une silhouette urbaine, un casque et Aaron : le même univers, une autre façon de le vivre.'},
  {id:'campaign-09',title:'L’inspiration à vos côtés',person:'Alya',group:'style',caption:'Alya accompagne un moment créatif, à sa place sur le bureau.'},
  {id:'campaign-10',title:'Un lien entre les générations',person:'Aaron',group:'family',caption:'Un petit-fils, sa grand-mère et Aaron : la technologie comme point de rencontre.'}
];

// Country-inspired concept editions; no commercial availability is implied.
const worldEditions = [
  {
    "id": "turquie",
    "country": "Turquie",
    "continent": "europe",
    "continents": ["europe", "asia"],
    "person": "Rayan",
    "caption": "Rouge, ivoire, croissant et étoile : une escale à Istanbul.",
    "alt": "Rayan, peluche brune au regard noisette et au blanc de l’œil visible, en casquette rouge, veste varsity rouge et ivoire avec drapeau turc, pantalon rouge et baskets assorties.",
    "width": 1122,
    "height": 1402
  },
  {
    "id": "maroc",
    "country": "Maroc",
    "continent": "africa",
    "person": "Rayan",
    "caption": "Une djellaba ivoire, des détails verts et un fez rouge.",
    "alt": "Rayan, peluche brune au regard vert, en djellaba ivoire, fez rouge et babouches.",
    "width": 1122,
    "height": 1402
  },
  {
    "id": "algerie",
    "country": "Algérie",
    "continent": "africa",
    "person": "Léa",
    "caption": "Un karakou vert émeraude, des broderies dorées et deux couettes.",
    "alt": "Léa, peluche mate aux deux couettes et au regard bleu, en karakou vert et doré avec sarouel ivoire.",
    "width": 1122,
    "height": 1402
  },
  {
    "id": "senegal",
    "country": "Sénégal",
    "continent": "africa",
    "person": "Sana",
    "caption": "Un grand boubou bleu et or, une allure lumineuse.",
    "alt": "Sana, peluche à la peau foncée et au regard violet, en grand boubou bleu et or avec coiffe et tresse.",
    "width": 1122,
    "height": 1402
  },
  {
    "id": "usa",
    "country": "États-Unis",
    "continent": "americas",
    "person": "Izan",
    "caption": "Veste varsity, denim et casquette : l’esprit campus.",
    "alt": "Izan, peluche brune au regard bleu, casquette rouge à l’envers, veste varsity marine et ivoire et jean.",
    "width": 1122,
    "height": 1402
  },
  {
    "id": "france",
    "country": "France",
    "continent": "europe",
    "person": "Mila",
    "caption": "Un béret, une marinière et une touche de rouge.",
    "alt": "Mila, peluche ivoire aux cheveux blonds raides et au regard ambré, béret marine, marinière, trench beige et foulard rouge.",
    "width": 1122,
    "height": 1402
  },
  {
    "id": "ecosse",
    "country": "Écosse",
    "continent": "europe",
    "person": "Noah",
    "caption": "Un kilt en tartan, un sporran et un béret assorti.",
    "alt": "Noah, peluche ivoire aux cheveux roux et au regard ambré, en kilt rouge et vert, sporran, veste noire et béret vert.",
    "width": 1122,
    "height": 1402
  },
  {
    "id": "bresil",
    "country": "Brésil",
    "continent": "americas",
    "person": "Sana",
    "caption": "Jaune, vert et bleu : l’énergie du football.",
    "alt": "Sana, peluche à la peau foncée et au regard violet, maillot jaune et vert, short bleu et ruban vert.",
    "width": 1122,
    "height": 1402
  },
  {
    "id": "argentine",
    "country": "Argentine",
    "continent": "americas",
    "person": "Izan",
    "caption": "Un poncho ciel et ivoire, inspiré de l’univers gaucho.",
    "alt": "Izan, peluche brune au regard bleu, béret marine, poncho bleu ciel et ivoire, pantalon beige et bottes brunes.",
    "width": 1122,
    "height": 1402
  },
  {
    "id": "mexique",
    "country": "Mexique",
    "continent": "americas",
    "person": "Léa",
    "caption": "Une tenue de charro, des détails argentés et un sombrero.",
    "alt": "Léa, peluche mate au regard bleu et aux deux couettes, sombrero crème, tenue de charro noire et argentée et nœud rouge.",
    "width": 1122,
    "height": 1402
  },
  {
    "id": "angleterre",
    "country": "Angleterre",
    "continent": "europe",
    "person": "Mila",
    "caption": "Un duffle-coat rouge et un chapeau melon pour Londres.",
    "alt": "Mila, peluche ivoire aux cheveux blonds raides et au regard ambré, chapeau melon marine et duffle-coat rouge.",
    "width": 1122,
    "height": 1402
  },
  {
    "id": "australie",
    "country": "Australie",
    "continent": "oceania",
    "person": "Noah",
    "caption": "Un chapeau à large bord, une veste de terrain et l’appel du grand air.",
    "alt": "Noah, peluche ivoire au regard ambré, chapeau à large bord, veste olive, chemise à carreaux et pantalon beige.",
    "width": 1122,
    "height": 1402
  }
];

// ---- Responsive images -------------------------------------------------------
// `imageVariants` maps each original picture that has a 640 px sibling
// (<name>-640.webp) to the original's width. It is generated by
// scripts/make-image-variants.py (npm run images:variants): do not edit by hand.
// @generated image-variants start
const imageVariants = {"assets/studio/adam.webp":1254,"assets/studio/app-menu-concept.webp":1536,"assets/studio/case.webp":1254,"assets/studio/clip-sequence-v2.webp":2172,"assets/studio/dock.webp":1254,"assets/studio/elya-v2.webp":1254,"assets/studio/eye-module.webp":1254,"assets/studio/eye-rear-audio.webp":1254,"assets/studio/headphones.webp":1254,"assets/studio/hero-bouquet.webp":1254,"assets/studio/izan-brun.webp":1254,"assets/studio/izan.webp":1254,"assets/studio/lea-brun-clair.webp":1254,"assets/studio/lea-v2.webp":1254,"assets/studio/liam.webp":1254,"assets/studio/mila-v2.webp":1254,"assets/studio/noah-socket.webp":1254,"assets/studio/noah.webp":1254,"assets/studio/rayan-brun-dore.webp":1254,"assets/studio/rayan.webp":1254,"assets/studio/sana-brun-profond.webp":1254,"assets/studio/sana.webp":1254,"assets/studio/watch.webp":1254,"assets/studio/zephyr.webp":1254,"assets/world/algerie.webp":1122,"assets/world/angleterre.webp":1122,"assets/world/argentine.webp":1122,"assets/world/australie.webp":1122,"assets/world/bresil.webp":1122,"assets/world/ecosse.webp":1122,"assets/world/france.webp":1122,"assets/world/maroc.webp":1122,"assets/world/mexique.webp":1122,"assets/world/senegal.webp":1122,"assets/world/turquie.webp":1122,"assets/world/usa.webp":1122,"assets/universe/bags.webp":1120,"assets/universe/bottles.webp":1120,"assets/universe/brand.webp":1800,"assets/universe/campaign-01.webp":1120,"assets/universe/campaign-02.webp":1120,"assets/universe/campaign-03.webp":1120,"assets/universe/campaign-04.webp":1120,"assets/universe/campaign-05.webp":1120,"assets/universe/campaign-06.webp":1120,"assets/universe/campaign-07.webp":1120,"assets/universe/campaign-08.webp":1120,"assets/universe/campaign-09.webp":1120,"assets/universe/campaign-10.webp":1120,"assets/universe/keychains.webp":1120,"assets/universe/lunch.webp":1120,"assets/universe/merch-hero-alya-aaron.webp":1672,"assets/universe/phone.webp":1120,"assets/universe/sonic-concept.webp":1120,"assets/universe/stationery-alya-aaron.webp":1121,"assets/usages/appel-liam.webp":1672,"assets/usages/histoire-sana.webp":1672,"assets/usages/jeu-lea.webp":1672,"assets/usages/maths-elya.webp":1672,"assets/usages/telephone-noah.webp":1672,"assets/usages/youtube-izan.webp":1672};
// @generated image-variants end
// Rendered widths of each <img> slot, derived from the CSS grids, so the browser
// can pick the 640 px variant on phones and the original on large screens.
const imageSizes = {
  people:'(max-width:700px) calc((100vw - 52px) / 2), (max-width:900px) calc((100vw - 98px) / 3), 230px',
  accessory:'(max-width:900px) calc((100vw - 76px) / 2), 306px',
  companion:'(max-width:700px) calc((100vw - 90px) / 5), 85px',
  story:'(max-width:700px) calc(100vw - 24px), 480px',
  selection:'(max-width:900px) calc(100vw - 90px), 420px',
  detail:'(max-width:700px) calc(100vw - 74px), 460px',
  hardware:'(max-width:700px) calc(100vw - 40px), 520px',
  world:'(max-width:520px) calc(100vw - 40px), (max-width:900px) calc((100vw - 84px) / 2), (max-width:1150px) calc((100vw - 104px) / 3), 408px',
  campaign:'(max-width:700px) calc((100vw - 55px) / 2), (max-width:900px) calc((100vw - 94px) / 3), (max-width:1100px) calc((100vw - 118px) / 4), 242px',
  merch:'(max-width:370px) calc(100vw - 40px), (max-width:700px) calc((100vw - 56px) / 2), (max-width:900px) calc((100vw - 88px) / 2), 410px',
  gallery:'(max-width:700px) calc(100vw - 24px), min(100vw - 176px, 1008px)'
};
// srcset for a catalogue picture, or '' when no 640 px variant is available.
const imageSrcset=src=>imageVariants[src]?`${src.replace(/\.webp$/,'-640.webp')} 640w, ${src} ${imageVariants[src]}w`:'';
// Attributes for an <img> built in a template: always src, plus srcset/sizes when a variant exists.
function imageAttrs(src,slot){const set=imageSrcset(src);return `src="${src}"`+(set?` srcset="${set}" sizes="${imageSizes[slot]}"`:'');}
// Same for an existing <img> whose picture changes (dialogs, previews, lightbox).
function setImage(img,src,slot){const set=imageSrcset(src);if(set){img.sizes=imageSizes[slot];img.srcset=set;}else{img.removeAttribute('srcset');img.removeAttribute('sizes');}img.src=src;}
