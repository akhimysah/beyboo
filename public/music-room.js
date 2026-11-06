(() => {
  const en = document.documentElement.lang === 'en';
  const t = (fr,eng) => en ? eng : fr;
  const tracks = [
    ['boom-bap',t('La rue des comètes','Comet Street'),'Rap boom-bap'],
    ['trap',t('Néons de poche','Pocket Neon'),'Trap'],
    ['afro-pop',t('Soleil en baskets','Sunshine Sneakers'),'Afro-pop'],
    ['lo-fi',t('Minuit tout doux','Soft Midnight'),'Lo-fi'],
    ['lights',t('Les petites lumières','Little Lights'),t('Mélodie','Melody')]
  ];
  let root, report, audio, track, status, errorMessage, serial=0, ducked=false;
  function state() {
    return {track:track?.[0],title:track?.[1],genre:track?.[2],media:status};
  }
  function stop() {
    ++serial;
    if (audio) {
      audio.onended=audio.onerror=null;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    audio=null;track=null;root=null;report=null;status='idle';errorMessage='';
  }
  function label() {
    if (status === 'blocked') return t('Touche Lire pour activer le son.','Tap Play to enable sound.');
    if (status === 'error') return errorMessage;
    if (status === 'paused') return t('En pause','Paused');
    if (status === 'ended') return t('Morceau terminé','Track finished');
    if (status === 'playing') return t('En lecture','Playing');
    return t('Prêt à écouter','Ready to play');
  }
  function paint() {
    if (!root) return;
    const i=tracks.indexOf(track), playing=status==='playing';
    root.innerHTML='<div class="music-eye tune-'+i+'"><div class="bey-record'+(playing?' turning':'')+'" aria-hidden="true"><i></i></div><small>'+track[2]+'</small><h4>'+track[1]+'</h4><div class="music-transport"><button type="button" data-song-button="play" aria-label="'+(playing?t('Pause','Pause'):t('Lire','Play'))+'">'+(playing?'Ⅱ':'▶')+'</button><button type="button" data-song-button="next" aria-label="'+t('Morceau suivant','Next track')+'">▶|</button></div><span>'+label()+'</span></div>';
    root.querySelector('[data-song-button="play"]').onclick=()=>playing?pause():play();
    root.querySelector('[data-song-button="next"]').onclick=()=>window.BeybooScreen.run({action:'play_music',value:tracks[(i+1)%tracks.length][0]});
  }
  function change(next) {
    status=next;
    paint();
    report?.(status,track[1]+' · '+label());
  }
  function open(stage,value,notify) {
    stop();
    const selected=tracks.find(item=>item[0]===value);
    track=selected||tracks[0];root=stage;report=notify;
    audio=new Audio('/assets/music/'+track[0]+'.mp3');
    audio.preload='metadata';
    audio.volume=ducked ? .22 : .72;
    const mine=audio;
    audio.onended=()=>{if(audio===mine)change('ended');};
    audio.onerror=()=>{
      if(audio!==mine)return;
      errorMessage=t('Morceau indisponible. Réessaie ou choisis un autre titre.','Track unavailable. Retry or choose another track.');
      change('error');
    };
    change('ready');
    return value==='catalog'?Promise.resolve(state()):play();
  }
  async function play() {
    if(!audio)return;
    const token=++serial;
    if(status==='ended')audio.currentTime=0;
    if(status==='error')audio.load();
    try {
      await audio.play();
      if(token===serial)change('playing');
    } catch(err) {
      if(token!==serial)return;
      errorMessage=t('Lecture impossible. Essaie un autre titre.','Could not play. Try another track.');
      change(err?.name==='NotAllowedError'?'blocked':'error');
    }
    return state();
  }
  function pause() {
    if(audio){++serial;audio.pause();change('paused');}
  }
  function duck(on) {ducked=on;if(audio)audio.volume=on ? .22 : .72;}
  function controls(panel) {
    const head=document.createElement('h4');head.textContent=t('Musique BOOZZO','BOOZZO Music');
    const desc=document.createElement('p');desc.textContent=t('5 instrumentaux originaux à écouter gratuitement.','5 original instrumentals. Free to play.');
    const list=document.createElement('div');list.className='music-library';
    tracks.forEach(([id,title,genre],i)=>{
      const b=document.createElement('button');b.type='button';b.dataset.track=id;b.className='music-row tune-'+i;
      const current=track?.[0]===id,playing=current&&status==='playing';
      b.setAttribute('aria-label',(playing?'Pause · ':t('Lire · ','Play · '))+title+' · '+genre);
      b.setAttribute('aria-pressed',String(playing));
      b.innerHTML='<i class="music-art" aria-hidden="true"></i><span><b>'+title+'</b><small>'+genre+'</small></span><em aria-hidden="true">'+(playing?'Ⅱ':'▷')+'</em>';
      b.onclick=()=>{if(playing)pause();else if(current)play();else window.BeybooScreen.run({action:'play_music',value:id});};
      list.append(b);
    });
    panel.append(head,desc,list);
  }
  window.BeybooMusic={open,play,pause,stop,duck,state,controls};
})();
