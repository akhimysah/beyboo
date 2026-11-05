'use strict';
const bouquetImage = document.querySelector('#hero-bouquet');
const bouquetStage = document.querySelector('#hero-bouquet-stage');
const replayArrival = document.querySelector('#arrival-replay');
const reducedArrival = window.matchMedia('(prefers-reduced-motion: reduce)');
let arrivalTimer;
function finishArrival(){
  clearTimeout(arrivalTimer);
  bouquetImage.classList.remove('is-arriving');
  bouquetStage.classList.remove('is-arriving');
  replayArrival.disabled=false;
}
function playArrival(){
  finishArrival();
  bouquetImage.classList.add('is-ready');
  if(reducedArrival.matches)return;
  void bouquetImage.offsetWidth;
  bouquetImage.classList.add('is-arriving');
  bouquetStage.classList.add('is-arriving');
  replayArrival.disabled=true;
  arrivalTimer=setTimeout(finishArrival,3900);
}
replayArrival.addEventListener('click',playArrival);
reducedArrival.addEventListener('change',()=>{if(reducedArrival.matches)finishArrival();});
function initialArrival(){
  if(document.documentElement.classList.contains('intro-pending')||document.documentElement.classList.contains('intro-open')){bouquetImage.classList.add('is-ready');return;}
  playArrival();
}
if(bouquetImage.complete&&bouquetImage.naturalWidth)initialArrival();
else bouquetImage.addEventListener('load',initialArrival,{once:true});
document.addEventListener('beyboo-intro-end',event=>{if(event.detail?.opening===false)return;if(bouquetImage.complete&&bouquetImage.naturalWidth)playArrival();});
bouquetImage.addEventListener('error',()=>{bouquetImage.classList.add('is-ready');replayArrival.hidden=true;},{once:true});

const clipTrack=document.querySelector('#clip-steps');
const clipCards=[...clipTrack.querySelectorAll('.clip-step')];
const clipButtons=[...document.querySelectorAll('[data-clip-step]')];
function markClipStep(index){
  clipButtons.forEach((button,i)=>{button.classList.toggle('active',i===index);button.setAttribute('aria-pressed',String(i===index));});
  clipCards.forEach((card,i)=>card.classList.toggle('active',i===index));
}
clipButtons.forEach((button,index)=>button.addEventListener('click',()=>{
  markClipStep(index);
  const distance=clipCards[index].getBoundingClientRect().left-clipTrack.getBoundingClientRect().left+clipTrack.scrollLeft-1;
  clipTrack.scrollTo({left:distance,behavior:reducedArrival.matches?'instant':'smooth'});
}));
let clipFrame;
clipTrack.addEventListener('scroll',()=>{
  cancelAnimationFrame(clipFrame);
  clipFrame=requestAnimationFrame(()=>{
    if(clipTrack.scrollWidth<=clipTrack.clientWidth+2)return;
    const atEnd=clipTrack.scrollLeft>=clipTrack.scrollWidth-clipTrack.clientWidth-5;
    const step=clipCards[1].offsetLeft-clipCards[0].offsetLeft;
    markClipStep(atEnd?2:Math.min(2,Math.round(clipTrack.scrollLeft/step)));
  });
},{passive:true});
