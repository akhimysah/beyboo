(() => {
  'use strict';
  const en=document.documentElement.lang==='en';
  const tr=(fr,english)=>en?english:fr;
  const el=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;return node;};
  function displayName(city){return city[en?2:1];}
  function condition(code){
    if(/thunder/.test(code))return ['⛈',tr('Orage','Thunderstorms')];
    if(/snow|sleet/.test(code))return ['❄',tr('Neige ou grésil','Snow or sleet')];
    if(/rain/.test(code))return ['☂',tr('Pluie','Rain')];
    if(/fog/.test(code))return ['≋',tr('Brouillard','Fog')];
    if(/partlycloudy|fair/.test(code))return ['⛅',tr('Éclaircies','Partly cloudy')];
    if(/cloudy/.test(code))return ['☁',tr('Nuageux','Cloudy')];
    if(/clearsky/.test(code))return [code.includes('night')?'☾':'☀',tr('Ciel dégagé','Clear sky')];
    return ['°',tr('Prévision','Forecast')];
  }
  function weatherLabel(text){document.getElementById('eye-weather-label').textContent=text;}
  async function weather(value,isCurrent,signal){
    const city=window.BeybooDevice.cityFor(value);
    if(!city){
      const message=value?tr('Cette ville ne figure pas dans la démo. Choisis une ville de la liste.','That city is outside this demo. Choose a city from the list.'):tr('Choisis une ville pour voir sa météo dans l’œil.','Choose a city to see its weather in the eye.');
      weatherLabel(message);return {ok:true,description:message};
    }
    weatherLabel(tr('Prévision en cours…','Getting forecast…'));
    try {
      const res=await fetch('/api/weather?city='+city[0],{signal});
      if(!res.ok)throw Error();
      const data=await res.json();
      if(!isCurrent())return {ok:false,cancelled:true};
      if(data.city!==city[0]||!Number.isFinite(data.temperature)||!Number.isFinite(Date.parse(data.time)))throw Error();
      const [symbol,sky]=condition(data.symbol);
      document.getElementById('eye-weather-symbol').textContent=symbol;
      document.getElementById('eye-weather-title').textContent=displayName(city)+' · '+data.temperature+' °C';
      const when=new Intl.DateTimeFormat(en?'en-GB':'fr-FR',{dateStyle:'short',timeStyle:'short',timeZone:'UTC'}).format(new Date(data.time))+' UTC';
      const message=sky+' · '+when;weatherLabel(message);
      return {ok:true,description:displayName(city)+' · '+data.temperature+' °C · '+message};
    }catch{
      if(!isCurrent())return {ok:false,cancelled:true};
      const message=tr('Prévision indisponible pour le moment. Réessaie en touchant la ville.','Forecast unavailable right now. Tap the city to try again.');
      weatherLabel(message);return {ok:false,description:message};
    }
  }
  function weatherControls(panel,button){
    const title=document.getElementById('eye-weather-title');
    const note=document.getElementById('eye-weather-label');
    panel.append(el('h4',title.textContent),el('p',note.textContent));
    const cities=el('div','');cities.className='eye-city-list';
    for(const city of window.BeybooDevice.cities)cities.append(button(displayName(city),()=>window.BeybooScreen.run({action:'open_weather',value:city[0]})));
    panel.append(cities);
    const credit=el('small',tr('Prévision horaire arrondie et traduite · ','Hourly forecast, rounded and translated · '));
    const met=el('a','MET Norway');met.href='https://api.met.no/';const license=el('a','CC BY 4.0');license.href='https://creativecommons.org/licenses/by/4.0/';
    for(const link of [met,license]){link.target='_blank';link.rel='noopener noreferrer';}
    credit.append(met,' · ',license);panel.append(credit);
  }
  const SOURCE_LABEL={feeds:tr('Sélection de chaînes BEYBOO','BEYBOO channel selection'),google:tr('Résultats YouTube','YouTube results')};
  const FALLBACK=tr(' Les films de la sélection restent accessibles.',' The selected films are still available.');
  /* Resolves to {items?,message,source?,description?}; message is shown under the eye, spoken, and returned to the assistant. */
  async function search(query,signal){
    if(typeof navigator!=='undefined'&&navigator.onLine===false)return {message:tr('Hors ligne : la recherche attendra le retour d’internet.','Offline: the search will wait for the internet to come back.')+FALLBACK};
    let response;
    try{
      response=await fetch('/api/videos/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,lang:en?'en':'fr'}),signal});
    }catch(error){
      if(error?.name==='AbortError')throw error;
      return {message:tr('Pas de connexion pour chercher. Réessaie dans un instant.','No connection to search. Try again in a moment.')+FALLBACK};
    }
    if(response.status===429)return {message:tr('Trop de recherches pour aujourd’hui.','Too many searches for today.')+FALLBACK};
    if(response.status===401)return {message:tr('Connecte-toi pour chercher des vidéos.','Sign in to search for videos.')+FALLBACK};
    let data;
    try{if(!response.ok)throw Error();data=await response.json();}
    catch{return {message:tr('Recherche vidéo indisponible pour le moment.','Video search is unavailable right now.')+FALLBACK};}
    if(!data.enabled)return {message:tr('Pour ce sujet, ouvre la recherche YouTube ou choisis un film de la sélection.','For this topic, open YouTube search or choose a film from the selection.')};
    const items=Array.isArray(data.items)?data.items.filter(v=>/^[A-Za-z0-9_-]{11}$/.test(v?.id||'')&&typeof v.title==='string').map(v=>({id:v.id,title:v.title,channel:String(v.channel||'')})):[];
    const source=data.source==='google'?'google':'feeds';
    const label=SOURCE_LABEL[source];
    if(!items.length){
      return {items,source,message:source==='feeds'
        ?tr('Aucune vidéo sur « '+query+' » dans la sélection de chaînes BEYBOO. Essaie un autre mot ou choisis un film ci-dessous.','No video about “'+query+'” in the BEYBOO channel selection. Try another word or choose a film below.')
        :tr('Aucun résultat YouTube pour « '+query+' ». Choisis un film ci-dessous.','No YouTube results for “'+query+'”. Choose a film below.')};
    }
    const count=items.length===1?tr('1 vidéo trouvée','1 video found'):items.length+tr(' vidéos trouvées',' videos found');
    const description=label+' · '+count+' : '+items.map(v=>'« '+v.title+' » ('+v.channel+')').join(', ')+'.';
    return {items,source,description,message:label+' · '+count+tr(', choisis-en une sous l’œil.',', choose one under the eye.')};
  }
  function videoControls(panel,button){
    panel.append(el('h4',tr('Que veux-tu regarder ?','What would you like to watch?')));
    const label=document.querySelector('#voice-stage p');
    if(label?.dataset.results){
      panel.append(el('p',label.textContent));
      const results=el('div','');results.className='eye-video-list';
      for(const video of JSON.parse(label.dataset.results)){
        results.append(button(video.title+(video.channel?' · '+video.channel:''),()=>window.BeybooScreen.run({action:'open_youtube',value:'https://www.youtube.com/watch?v='+video.id})));
      }
      panel.append(results);
    }
    const list=el('div','');list.className='eye-video-list';
    list.append(button(tr('Mission Lune · Film BEYBOO','Moon Mission · BEYBOO film'),()=>window.BeybooScreen.run({action:'play_video'})));
    for(const video of window.BeybooDevice.videos){
      list.append(button('Paxi · '+video[en?'en':'fr']+' · ESA ↗',()=>window.BeybooScreen.run({action:'open_youtube',value:'https://www.youtube.com/watch?v='+video.ids[Number(en)]})));
    }
    const search=el('a',tr('Chercher un autre sujet sur YouTube ↗','Search for another topic on YouTube ↗'));
    search.href=document.getElementById('voice-youtube-search').href;search.target='_blank';search.rel='noopener noreferrer';
    panel.append(list,search);
  }
  window.BeybooLibrary={search,weather,weatherControls,videoControls};
})();
