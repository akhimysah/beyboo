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
  async function search(query,signal){
    try{
      const response=await fetch('/api/videos/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,lang:en?'en':'fr'}),signal});
      if(!response.ok)throw Error();
      const data=await response.json();
      if(!data.enabled)return {message:tr('Pour ce sujet, ouvre la recherche YouTube ou choisis un film de la sélection.','For this topic, open YouTube search or choose a film from the selection.')};
      const items=data.items;
      return {items,message:items.length?tr('Résultats YouTube · choisis une vidéo.','YouTube results · choose a video.'):tr('Aucun résultat YouTube pour ce sujet.','No YouTube results for that topic.')};
    }catch{return {message:tr('Recherche YouTube indisponible. Les films de la sélection restent accessibles.','YouTube search is unavailable. The selected films are still available.')};}
  }
  function videoControls(panel,button){
    panel.append(el('h4',tr('Que veux-tu regarder ?','What would you like to watch?')));
    const label=document.querySelector('#voice-stage p');
    if(label?.dataset.results){
      panel.append(el('p',label.textContent));
      const results=el('div','');results.className='eye-video-list';
      for(const video of JSON.parse(label.dataset.results)){
        results.append(button(video.title+' · '+video.channel,()=>window.BeybooScreen.run({action:'open_youtube',value:'https://www.youtube.com/watch?v='+video.id})));
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
