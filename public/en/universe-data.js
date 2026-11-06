const updatedUniverseAssets = {stationery:'stationery-alya-aaron','merch-hero':'merch-hero-alya-aaron'};
'use strict';
const useCases = [
  {id:'youtube-izan',person:'Izan',label:'Videos',title:'Watch a video',caption:'Take a trip into space on YouTube, right inside the eye. Tap to pause, then tap again to keep watching.',alt:'A boy taps pause on a YouTube rocket video playing in Izan’s round screen. The plush sits still on the table.'},
  {id:'telephone-noah',person:'Noah',label:'Phone',title:'Dial a number',caption:'The digits appear in Noah’s eye as the child taps the on-screen keypad.',alt:'A boy uses the phone keypad on Noah’s screen. The digits and green call button are visible.'},
  {id:'appel-liam',person:'Aaron',label:'Video call',title:'Wave to Grandma',caption:'Grandma appears in Aaron’s screen. A smile and a wave bring them a little closer.',alt:'A boy waves to his grandmother on a video call in Aaron’s round screen. A red end-call button is visible.'},
  {id:'histoire-sana',person:'Sana',label:'Stories',title:'Listen to an adventure',caption:'At bedtime, Sana shares The Island of Stars. A voice tells the story while pictures appear in the eye.',alt:'A little girl in pajamas listens in bed. Sana sits on her bedside table, with The Island of Stars and a pause button on the screen.'},
  {id:'maths-elya',person:'Alya',label:'Math',title:'Find the answer',caption:'What’s 7 + 5? The child taps 12 on Alya’s screen and gets an answer right away.',alt:'A little girl taps 12 as the answer to 7 + 5 on the screen of Alya, who wears an ivory fleece cap.'},
  {id:'jeu-lea',person:'Léa',label:'Learning games',title:'Learn through play',caption:'A circle, a square, a triangle. The child spots the matching shape and taps it on Léa’s screen.',alt:'A little girl selects an orange triangle in a shape-matching game on the screen of Léa, who has two pigtails.'}
];
const merchandise = [
  {id:'keychains',kind:'merch',name:'BOOZZO Mini',type:'Keychains',short:'Your little companion, ready to go.',description:'Miniature Noah, Aaron, Mila and Alya have soft fabric, a clip and their signature eye. Clip one to your keys or bag.',note:'Plush keychain concept with a decorative eye. Contains no screen or electronics.'},
  {id:'bottles',kind:'merch',name:'BOOZZO Bottle',type:'Water bottles',short:'A familiar face at every refill.',description:'Choose ice blue, ivory or soft pink. Each bottle has a carry handle, a removable silicone base and a character to brighten the day.',note:'Water bottle concept. Capacity, materials and performance are under review. The character designs are decorative.'},
  {id:'phone',kind:'merch',name:'BOOZZO Everyday',type:'Phone accessories',short:'Little details close at hand.',description:'Phone cases, folding eye-shaped stands, wrist straps, cardholders and bag charms in ice blue and silver.',note:'Accessory concepts with decorative eyes. Compatible phone models are being determined.'},
  {id:'bags',kind:'merch',name:'BOOZZO Go',type:'Bags and pencil cases',short:'Pack for your next adventure.',description:'An ecru backpack, pencil case and tote to personalize with a mini companion. Pale fabrics and blue details run through the collection.',note:'Fabric bag concepts. Dimensions are under review. The bottle and keychain shown can be selected separately.'},
  {id:'lunch',kind:'merch',name:'BOOZZO Lunch',type:'Lunch sets',short:'A little company at lunchtime.',description:'A divided lunchbox, cutlery and a carrying pouch, with artwork featuring Aaron and Noah.',note:'Lunch set concept. Materials and specifications are under review. The bottle shown can be selected separately.'},
  {id:'stationery',kind:'merch',name:'BOOZZO Studio',type:'Stationery',short:'A blank page for your next adventure.',description:'Character notebooks, bookmarks, stickers and pencils for dreaming up Noah’s next adventure, composing with Aaron or drawing with Alya and Mila.',note:'Stationery concept. Formats and set contents are under review. Character artwork is decorative.'}
];
const campaigns = [
  {id:'campaign-01',title:'Quiet moments with Mila',person:'Mila',group:'family',caption:'A child and her companion share a quiet moment at home.'},
  {id:'campaign-02',title:'An adventure begins',person:'Noah',group:'family',caption:'A boy meets Noah and discovers a little world inside his screen.'},
  {id:'campaign-03',title:'Two companions, a thousand ideas',person:'Noah & Alya',group:'family',caption:'Two children share their curiosity, each with a character of their own.'},
  {id:'campaign-04',title:'Stories to share',person:'Noah',group:'family',caption:'A father and child take a moment to invent an adventure together.'},
  {id:'campaign-05',title:'A touch of Mila',person:'Mila',group:'style',caption:'Mila brings a little personality to an everyday look.'},
  {id:'campaign-06',title:'A first meeting',person:'Alya',group:'style',caption:'Meet Alya and explore the details of her presentation box.'},
  {id:'campaign-07',title:'At home with Izan',person:'Izan',group:'style',caption:'Izan catches the eye in a contemporary interior and sparks a conversation.'},
  {id:'campaign-08',title:'On Aaron’s wavelength',person:'Aaron',group:'style',caption:'A city look, headphones and Aaron, ready for an afternoon of music.'},
  {id:'campaign-09',title:'Inspiration by your side',person:'Alya',group:'style',caption:'Alya keeps an artist company at the desk.'},
  {id:'campaign-10',title:'Across generations',person:'Aaron',group:'family',caption:'A grandson, his grandmother and Aaron share a moment of discovery.'}
];

// Country-inspired concept editions; no commercial availability is implied.
const worldEditions = [
  {
    "id": "turquie",
    "country": "Türkiye",
    "continent": "europe",
    "continents": ["europe", "asia"],
    "person": "Rayan",
    "caption": "Red and ivory, a crescent and a star, for a stop in Istanbul.",
    "alt": "Rayan, a brown plush with a hazel eye and visible white sclera, wears a red cap, a red and ivory varsity jacket with the Turkish flag, red trousers and matching sneakers.",
    "width": 1122,
    "height": 1402
  },
  {
    "id": "maroc",
    "country": "Morocco",
    "continent": "africa",
    "person": "Rayan",
    "caption": "An ivory djellaba, green accents and a red fez.",
    "alt": "Rayan, a brown plush with a green eye, wears an ivory djellaba, a red fez and traditional slippers.",
    "width": 1122,
    "height": 1402
  },
  {
    "id": "algerie",
    "country": "Algeria",
    "continent": "africa",
    "person": "Léa",
    "caption": "An emerald karakou, gold embroidery and two pigtails.",
    "alt": "Léa, a tan plush with two pigtails and a blue eye, wears a green and gold karakou with ivory sarouel trousers.",
    "width": 1122,
    "height": 1402
  },
  {
    "id": "senegal",
    "country": "Senegal",
    "continent": "africa",
    "person": "Sana",
    "caption": "A flowing blue and gold boubou catches the light.",
    "alt": "Sana, a dark-skinned plush with a violet eye, wears a blue and gold grand boubou, a headwrap and a braid.",
    "width": 1122,
    "height": 1402
  },
  {
    "id": "usa",
    "country": "United States",
    "continent": "americas",
    "person": "Izan",
    "caption": "A varsity jacket, denim and a baseball cap for campus days.",
    "alt": "Izan, a brown plush with a blue eye, wears a backward red cap, a navy and ivory varsity jacket and jeans.",
    "width": 1122,
    "height": 1402
  },
  {
    "id": "france",
    "country": "France",
    "continent": "europe",
    "person": "Mila",
    "caption": "A beret, a striped sailor shirt and a touch of red.",
    "alt": "Mila, an ivory plush with straight blond hair and an amber eye, wears a navy beret, a striped sailor shirt, a beige trench coat and a red scarf.",
    "width": 1122,
    "height": 1402
  },
  {
    "id": "ecosse",
    "country": "Scotland",
    "continent": "europe",
    "person": "Noah",
    "caption": "A tartan kilt, a sporran and a matching beret.",
    "alt": "Noah, an ivory plush with red hair and an amber eye, wears a red and green kilt, a sporran, a black jacket and a green beret.",
    "width": 1122,
    "height": 1402
  },
  {
    "id": "bresil",
    "country": "Brazil",
    "continent": "americas",
    "person": "Sana",
    "caption": "Yellow, green and blue celebrate the joy of football.",
    "alt": "Sana, a dark-skinned plush with a violet eye, wears a yellow and green jersey, blue shorts and a green ribbon.",
    "width": 1122,
    "height": 1402
  },
  {
    "id": "argentine",
    "country": "Argentina",
    "continent": "americas",
    "person": "Izan",
    "caption": "A sky-blue and ivory poncho inspired by gaucho dress.",
    "alt": "Izan, a brown plush with a blue eye, wears a navy beret, a sky-blue and ivory poncho, beige trousers and brown boots.",
    "width": 1122,
    "height": 1402
  },
  {
    "id": "mexique",
    "country": "Mexico",
    "continent": "americas",
    "person": "Léa",
    "caption": "A charro outfit, silver details and a sombrero.",
    "alt": "Léa, a tan plush with a blue eye and two pigtails, wears a cream sombrero, a black and silver charro suit and a red bow.",
    "width": 1122,
    "height": 1402
  },
  {
    "id": "angleterre",
    "country": "England",
    "continent": "europe",
    "person": "Mila",
    "caption": "A red duffle coat and a bowler hat for a day in London.",
    "alt": "Mila, an ivory plush with straight blond hair and an amber eye, wears a navy bowler hat and a red duffle coat.",
    "width": 1122,
    "height": 1402
  },
  {
    "id": "australie",
    "country": "Australia",
    "continent": "oceania",
    "person": "Noah",
    "caption": "A wide-brimmed hat and a field jacket for the great outdoors.",
    "alt": "Noah, an ivory plush with an amber eye, wears a wide-brimmed hat, an olive jacket, a plaid shirt and beige trousers.",
    "width": 1122,
    "height": 1402
  }
];

// ---- Responsive images -------------------------------------------------------
// `imageVariants` maps each original picture that has a 640 px sibling
// (<name>-640.webp) to the original's width. It is generated by
// scripts/make-image-variants.py (npm run images:variants): do not edit by hand.
// @generated image-variants start
const imageVariants = {"assets/studio/adam.webp":1254,"assets/studio/app-menu-concept.webp":1536,"assets/studio/case.webp":1254,"assets/studio/clip-sequence-v2.webp":2172,"assets/studio/dock.webp":1254,"assets/studio/elya-v2.webp":1254,"assets/studio/eye-module.webp":1254,"assets/studio/eye-rear-audio.webp":1254,"assets/studio/headphones.webp":1254,"assets/studio/hero-bouquet.webp":1254,"assets/studio/izan-brun.webp":1254,"assets/studio/izan.webp":1254,"assets/studio/lea-brun-clair.webp":1254,"assets/studio/lea-v2.webp":1254,"assets/studio/liam.webp":1254,"assets/studio/mila-v2.webp":1254,"assets/studio/noah-socket.webp":1254,"assets/studio/noah.webp":1254,"assets/studio/rayan-brun-dore.webp":1254,"assets/studio/rayan.webp":1254,"assets/studio/sana-brun-profond.webp":1254,"assets/studio/sana.webp":1254,"assets/studio/watch.webp":1254,"assets/studio/zephyr.webp":1254,"assets/world/algerie.webp":1122,"assets/world/angleterre.webp":1122,"assets/world/argentine.webp":1122,"assets/world/australie.webp":1122,"assets/world/bresil.webp":1122,"assets/world/ecosse.webp":1122,"assets/world/france.webp":1122,"assets/world/maroc.webp":1122,"assets/world/mexique.webp":1122,"assets/world/senegal.webp":1122,"assets/world/turquie.webp":1122,"assets/world/usa.webp":1122,"assets/universe/bags.webp":1120,"assets/universe/bottles.webp":1120,"assets/universe/brand-boozzo.webp":1800,"assets/universe/campaign-01.webp":1120,"assets/universe/campaign-02.webp":1120,"assets/universe/campaign-03.webp":1120,"assets/universe/campaign-04.webp":1120,"assets/universe/campaign-05.webp":1120,"assets/universe/campaign-06.webp":1120,"assets/universe/campaign-07.webp":1120,"assets/universe/campaign-08.webp":1120,"assets/universe/campaign-09.webp":1120,"assets/universe/campaign-10.webp":1120,"assets/universe/keychains.webp":1120,"assets/universe/lunch.webp":1120,"assets/universe/merch-hero-alya-aaron.webp":1672,"assets/universe/packaging-boozzo.webp":1536,"assets/universe/phone.webp":1120,"assets/universe/sonic-concept.webp":1120,"assets/universe/stationery-alya-aaron.webp":1121,"assets/usages/appel-liam.webp":1672,"assets/usages/histoire-sana.webp":1672,"assets/usages/jeu-lea.webp":1672,"assets/usages/maths-elya.webp":1672,"assets/usages/telephone-noah.webp":1672,"assets/usages/youtube-izan.webp":1672};
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
