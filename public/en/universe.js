'use strict';
const universePhoto = id => `assets/universe/${updatedUniverseAssets[id]||id}.webp`;
const worldPhoto = id => `assets/world/${id}.webp`;
const usagePhoto = id => `assets/usages/${id}.webp`;
function usageVisual(u){
  if(u.id==='youtube-izan')return "<div class=\"film-player\" id=\"film-youtube-izan\"><video data-brand-film controls playsinline preload=\"none\" poster=\"assets/films/youtube-izan-poster.webp\" width=\"898\" height=\"512\" aria-label=\"Izan watches YouTube\"><source src=\"assets/films/youtube-izan.mp4\" type=\"video/mp4\">Your browser cannot play this video. <a href=\"assets/films/youtube-izan.mp4\">Open video</a></video><button type=\"button\" class=\"film-trigger\" aria-label=\"Play video: Izan watches YouTube, with sound\"><span class=\"film-play-symbol\" aria-hidden=\"true\">▶</span><span class=\"film-trigger-label\"><span class=\"film-action\">Play with sound</span><small>10 seconds · BEYBOO</small></span></button><p class=\"film-error\" role=\"status\" hidden>The video didn’t start. <a href=\"assets/films/youtube-izan.mp4\">Open video</a></p></div>";
  return `<button type="button" class="image-open" data-gallery="usage-${u.id}" aria-label="Enlarge ${u.title} with ${u.person}"><img src="${usagePhoto(u.id)}" srcset="${imageVariants[usagePhoto(u.id)]?usagePhoto(u.id+'-640')+' 640w, ':''}${usagePhoto(u.id+'-small')} 836w, ${usagePhoto(u.id)} 1672w" sizes="(max-width:700px) calc(100vw - 40px), (max-width:1150px) calc((100vw - 92px) / 2), 580px" alt="${u.alt}" width="1672" height="941" loading="lazy" decoding="async"><span class="image-zoom" aria-hidden="true">↗</span></button>`;
}
$('#usage-grid').innerHTML=useCases.map((u,i)=>`<article class="usage-card">${usageVisual(u)}<div class="usage-copy"><div class="usage-meta"><span>${u.label} · ${u.person}</span><span class="usage-number">0${i+1} / 06</span></div><h3>${u.title}</h3><p>${u.caption}</p><button type="button" class="text-link" data-gallery="usage-${u.id}" aria-label="View scene: ${u.title}">${u.id==='youtube-izan'?'Enlarge photo':'View scene'} <span aria-hidden="true">↗</span></button></div></article>`).join('');
let worldFilter = 'all';
function renderWorld(){
  const items=worldEditions.filter(e=>worldFilter==='all'||(e.continents||[e.continent]).includes(worldFilter));
  $('#world-count').textContent=`${items.length} edition${items.length===1?'':'s'} to explore`;
  $('#world-grid').innerHTML=items.map(e=>`<article class="world-card"><button type="button" class="image-open" data-gallery="world-${e.id}" aria-label="Enlarge the ${e.country} edition with ${e.person}"><img ${imageAttrs(worldPhoto(e.id),'world')} alt="${e.alt}" width="${e.width}" height="${e.height}" loading="lazy" decoding="async"><span class="image-zoom" aria-hidden="true">↗</span></button><div class="world-copy"><small>${e.person} · WORLD COLLECTION</small><h3>${e.country}</h3><p>${e.caption}</p><strong class="catalog-price">${BeybooShop.priceLabel(BeybooShop.world)}</strong><a class="shop-world-link" href="#compose" data-pick-edition="${e.id}">Choose this edition ↗</a> <button type="button" class="text-link" data-gallery="world-${e.id}" aria-label="View the ${e.country} edition poster">View poster <span aria-hidden="true">↗</span></button></div></article>`).join('');
}
$$('[data-world-filter]').forEach(b=>b.addEventListener('click',()=>{
  worldFilter=b.dataset.worldFilter;
  $$('[data-world-filter]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});
  renderWorld();
}));
let campaignFilter = 'all';
function renderCampaigns(){
  const items=campaigns.filter(c=>campaignFilter==='all'||c.group===campaignFilter);
  $('#campaign-count').textContent=`${items.length} moments to explore`;
  $('#campaign-grid').innerHTML=items.map(c=>`<article class="campaign-card"><button type="button" class="image-open" data-gallery="${c.id}" aria-label="Enlarge: ${c.title}"><img ${imageAttrs(universePhoto(c.id),'campaign')} alt="${c.caption}" width="1120" height="1400" loading="lazy" decoding="async"><span class="image-zoom" aria-hidden="true">↗</span></button><div class="campaign-copy"><small>${c.person}</small><h3>${c.title}</h3></div></article>`).join('');
}
$$('[data-campaign-filter]').forEach(b=>b.addEventListener('click',()=>{
  campaignFilter=b.dataset.campaignFilter;
  $$('[data-campaign-filter]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});
  renderCampaigns();
}));
$('#merch-grid').innerHTML=merchandise.map(m=>`<article class="merch-card"><button type="button" class="image-open" data-gallery="${m.id}" aria-label="Enlarge: ${m.type}"><img ${imageAttrs(universePhoto(m.id),'merch')} alt="${m.type} ${m.name}, collection overview" width="1120" height="1400" loading="lazy" decoding="async"><span class="image-zoom" aria-hidden="true">↗</span></button><div class="merch-copy"><small>${m.type}</small><h3>${m.name}</h3><p>${m.short}</p><strong class="catalog-price">${BeybooShop.familyLabel(m.id)}</strong><button type="button" class="text-link" data-accessory="${m.id}">Explore and select <span aria-hidden="true">↗</span></button></div></article>`).join('');
const galleryCatalog=[
  {id:'app-menu-concept',image:'assets/studio/app-menu-concept.webp',title:'A world inside the eye.',alt:'The full BEYBOO plush beside an enlarged view of its circular app menu.',caption:'Touchscreen concept featuring WhatsApp, YouTube, Spotify, Calls, Camera and Assistant. The logos illustrate possible uses. No partnerships have been announced. WhatsApp and Spotify are not integrated into this demo. The plush stays still.',group:'interface'},
  ...useCases.map(u=>({id:`usage-${u.id}`,image:usagePhoto(u.id),title:`${u.title} · ${u.person}`,alt:u.alt,caption:u.caption+' Concept scene showing a feature in development. The plush stays still while its screen changes.',group:'usages'})),
  ...worldEditions.map(e=>({id:`world-${e.id}`,image:worldPhoto(e.id),title:`${e.country} · ${e.person}`,alt:e.alt,caption:e.caption+' BEYBOO World concept edition. Availability has yet to be announced.',group:'world'})),
  ...campaigns.map(c=>({id:c.id,image:universePhoto(c.id),title:c.title,caption:c.caption+' Campaign concept image.',group:'campaign'})),
  {id:'merch-hero',image:universePhoto('merch-hero'),title:'BEYBOO for everyday life',caption:'An overview of the BEYBOO merchandise concepts.',group:'merch'},
  ...merchandise.map(m=>({id:m.id,image:universePhoto(m.id),title:m.name+' · '+m.type,caption:m.description+' '+m.note,group:'merch'})),
  {id:'sonic-concept',image:universePhoto('sonic-concept'),title:'BEYBOO × Sonic · Creative study',caption:'Visual proposal for a possible collaboration. Unofficial concept, with no announced partnership or product release.',group:'atelier'},
  {id:'clip-sequence',image:photo('clip-sequence'),title:'Line it up. Clip it in. Meet your companion.',caption:'Illustration of the proposed attachment, to be tested on a prototype.',group:'hardware'},
  {id:'eye-rear',image:photo('eye-rear'),title:'BEYBOO One · Back view',caption:'The speaker grille extends across the back and side. The microphone has its own opening on the edge, away from the clips and contacts. The housing must leave these openings clear. The acoustic design still needs prototype testing.',group:'hardware'},
  {id:'eye-module',image:photo('eye-module'),title:'BEYBOO One · Front view',caption:'A standalone circular touchscreen designed to detach from the plush.',group:'hardware'}
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
