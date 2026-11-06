'use strict';
const universePhoto = id => `assets/universe/${updatedUniverseAssets[id]||id}.webp`;
const worldPhoto = id => `assets/world/${id}.webp`;
const usagePhoto = id => `assets/usages/${id}.webp`;
function usageVisual(u){
  if(u.id==='youtube-izan')return "<div class=\"film-player\" id=\"film-youtube-izan\"><video data-brand-film controls playsinline preload=\"none\" poster=\"assets/films/youtube-izan-poster.webp\" width=\"898\" height=\"512\" aria-label=\"Izan et la vidéo YouTube\"><source src=\"assets/films/youtube-izan.mp4\" type=\"video/mp4\">Votre navigateur ne peut pas lire cette vidéo. <a href=\"assets/films/youtube-izan.mp4\">Ouvrir la vidéo</a></video><button type=\"button\" class=\"film-trigger\" aria-label=\"Lire la vidéo : Izan et la vidéo YouTube, avec le son\"><span class=\"film-play-symbol\" aria-hidden=\"true\">▶</span><span class=\"film-trigger-label\"><span class=\"film-action\">Lire avec le son</span><small>10 secondes · BOOZZO</small></span></button><p class=\"film-error\" role=\"status\" hidden>La lecture n’a pas démarré. <a href=\"assets/films/youtube-izan.mp4\">Ouvrir la vidéo</a></p></div>";
  return `<button type="button" class="image-open" data-gallery="usage-${u.id}" aria-label="Agrandir : ${u.title} avec ${u.person}"><img src="${usagePhoto(u.id)}" srcset="${imageVariants[usagePhoto(u.id)]?usagePhoto(u.id+'-640')+' 640w, ':''}${usagePhoto(u.id+'-small')} 836w, ${usagePhoto(u.id)} 1672w" sizes="(max-width:700px) calc(100vw - 40px), (max-width:1150px) calc((100vw - 92px) / 2), 580px" alt="${u.alt}" width="1672" height="941" loading="lazy" decoding="async"><span class="image-zoom" aria-hidden="true">↗</span></button>`;
}
$('#usage-grid').innerHTML=useCases.map((u,i)=>`<article class="usage-card">${usageVisual(u)}<div class="usage-copy"><div class="usage-meta"><span>${u.label} · ${u.person}</span><span class="usage-number">0${i+1} / 06</span></div><h3>${u.title}</h3><p>${u.caption}</p><button type="button" class="text-link" data-gallery="usage-${u.id}" aria-label="Voir la scène : ${u.title}">${u.id==='youtube-izan'?'Agrandir la photo':'Voir la scène'} <span aria-hidden="true">↗</span></button></div></article>`).join('');
let worldFilter = 'all';
function renderWorld(){
  const items=worldEditions.filter(e=>worldFilter==='all'||(e.continents||[e.continent]).includes(worldFilter));
  $('#world-count').textContent=`${items.length} édition${items.length>1?'s':''} à découvrir`;
  $('#world-grid').innerHTML=items.map(e=>`<article class="world-card"><button type="button" class="image-open" data-gallery="world-${e.id}" aria-label="Agrandir l’édition ${e.country} avec ${e.person}"><img ${imageAttrs(worldPhoto(e.id),'world')} alt="${e.alt}" width="${e.width}" height="${e.height}" loading="lazy" decoding="async"><span class="image-zoom" aria-hidden="true">↗</span></button><div class="world-copy"><small>${e.person} · WORLD COLLECTION</small><h3>${e.country}</h3><p>${e.caption}</p><strong class="catalog-price">${BeybooShop.priceLabel(BeybooShop.world)}</strong><a class="shop-world-link" href="#compose" data-pick-edition="${e.id}">Choisir cette édition ↗</a> <button type="button" class="text-link" data-gallery="world-${e.id}" aria-label="Voir l’affiche de l’édition ${e.country}">Voir l’affiche <span aria-hidden="true">↗</span></button></div></article>`).join('');
}
$$('[data-world-filter]').forEach(b=>b.addEventListener('click',()=>{
  worldFilter=b.dataset.worldFilter;
  $$('[data-world-filter]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});
  renderWorld();
}));
let campaignFilter = 'all';
function renderCampaigns(){
  const items=campaigns.filter(c=>campaignFilter==='all'||c.group===campaignFilter);
  $('#campaign-count').textContent=`${items.length} instants à découvrir`;
  $('#campaign-grid').innerHTML=items.map(c=>`<article class="campaign-card"><button type="button" class="image-open" data-gallery="${c.id}" aria-label="Agrandir : ${c.title}"><img ${imageAttrs(universePhoto(c.id),'campaign')} alt="${c.caption}" width="1120" height="1400" loading="lazy" decoding="async"><span class="image-zoom" aria-hidden="true">↗</span></button><div class="campaign-copy"><small>${c.person}</small><h3>${c.title}</h3></div></article>`).join('');
}
$$('[data-campaign-filter]').forEach(b=>b.addEventListener('click',()=>{
  campaignFilter=b.dataset.campaignFilter;
  $$('[data-campaign-filter]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});
  renderCampaigns();
}));
$('#merch-grid').innerHTML=merchandise.map(m=>`<article class="merch-card"><button type="button" class="image-open" data-gallery="${m.id}" aria-label="Agrandir : ${m.type}"><img ${imageAttrs(universePhoto(m.id),'merch')} alt="${m.type} ${m.name}, planche de collection" width="1120" height="1400" loading="lazy" decoding="async"><span class="image-zoom" aria-hidden="true">↗</span></button><div class="merch-copy"><small>${m.type}</small><h3>${m.name}</h3><p>${m.short}</p><strong class="catalog-price">${BeybooShop.familyLabel(m.id)}</strong><button type="button" class="text-link" data-accessory="${m.id}">Découvrir et sélectionner <span aria-hidden="true">↗</span></button></div></article>`).join('');
const galleryCatalog=[
  {id:'app-menu-concept',image:'assets/studio/app-menu-concept.webp',title:'Dans son œil. Tout son univers.',alt:'La peluche BOOZZO entière et son menu d’applications circulaire agrandi.',caption:'Concept d’interface tactile : WhatsApp, YouTube, Spotify, Appels, Photo et Assistant. Les logos illustrent des usages envisagés, sans partenariat annoncé. WhatsApp et Spotify ne sont pas intégrés à cette démo. La peluche reste immobile.',group:'interface'},
  ...useCases.map(u=>({id:`usage-${u.id}`,image:usagePhoto(u.id),title:`${u.title} · ${u.person}`,alt:u.alt,caption:u.caption+' Mise en scène conceptuelle d’un usage en développement. La peluche reste immobile ; seul l’écran est destiné à s’animer.',group:'usages'})),
  ...worldEditions.map(e=>({id:`world-${e.id}`,image:worldPhoto(e.id),title:`${e.country} · ${e.person}`,alt:e.alt,caption:e.caption+' Édition BOOZZO World imaginée pour la collection. Visuel de conception, sans disponibilité commerciale annoncée.',group:'world'})),
  ...campaigns.map(c=>({id:c.id,image:universePhoto(c.id),title:c.title,caption:c.caption+' Visuel de campagne conceptuel.',group:'campaign'})),
  {id:'merch-hero',image:universePhoto('merch-hero'),title:'L’univers BOOZZO, au quotidien',caption:'Vue d’ensemble de la collection de produits dérivés. Concepts de collection.',group:'merch'},
  ...merchandise.map(m=>({id:m.id,image:universePhoto(m.id),title:m.name+' · '+m.type,caption:m.description+' '+m.note,group:'merch'})),
  {id:'sonic-concept',image:universePhoto('sonic-concept'),title:'BOOZZO × Sonic · Étude créative',caption:'Proposition visuelle de collaboration. Concept non officiel, sans partenariat annoncé et non commercialisé.',group:'atelier'},
  {id:'clip-sequence',image:photo('clip-sequence'),title:'Aligner. Clipser. Retrouver son compagnon.',caption:'Illustration du principe de fixation envisagé, à valider sur prototype.',group:'hardware'},
  {id:'eye-rear',image:photo('eye-rear'),title:'BOOZZO One · Face arrière',caption:'Grille de haut-parleur arrière et latérale, entrée micro distincte sur la tranche, clips et contacts. Le logement devra laisser les ouvertures dégagées. Concept acoustique à tester sur prototype.',group:'hardware'},
  {id:'eye-module',image:photo('eye-module'),title:'BOOZZO One · Face avant',caption:'Un module circulaire tactile indépendant, imaginé pour se détacher de la peluche.',group:'hardware'}
];
let lightboxItems=[],lightboxIndex=0;
function renderLightbox(){
  const item=lightboxItems[lightboxIndex];
  setImage($('#gallery-image'),item.image,'gallery');$('#gallery-image').alt=item.alt||item.title;
  $('#gallery-title').textContent=item.title;$('#gallery-caption').textContent=item.caption;
  $('#gallery-position').textContent=`${lightboxIndex+1} / ${lightboxItems.length}`;
  $('#gallery-previous').disabled=lightboxItems.length<2;$('#gallery-next').disabled=lightboxItems.length<2;
}
function openGallery(id){
  const selected=galleryCatalog.find(i=>i.id===id);if(!selected)return;
  lightboxItems=galleryCatalog.filter(i=>i.group===selected.group);
  lightboxIndex=lightboxItems.findIndex(i=>i.id===id);renderLightbox();
  $('#gallery-dialog').showModal();
}
function turnGallery(direction){lightboxIndex=(lightboxIndex+direction+lightboxItems.length)%lightboxItems.length;renderLightbox();}
$('#gallery-previous').addEventListener('click',()=>turnGallery(-1));
$('#gallery-next').addEventListener('click',()=>turnGallery(1));
$('#gallery-dialog').addEventListener('keydown',e=>{if(e.key==='ArrowRight')turnGallery(1);if(e.key==='ArrowLeft')turnGallery(-1);});
document.addEventListener('click',e=>{const b=e.target.closest('[data-gallery]');if(b)openGallery(b.dataset.gallery);});
$('#hardware-enlarge').addEventListener('click',()=>openGallery($('#hardware-image').src.includes('eye-rear')?'eye-rear':'eye-module'));
renderCampaigns();
renderWorld();
