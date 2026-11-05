/* Stable character IDs keep existing compositions compatible with Alya and Aaron. */
(() => {
  'use strict';
  const key='beyboo-companion-v1';
  const ids=['noah','elya','izan','mila','rayan','lea','sana','liam','adam','zephyr'];
  const voices=['bulle','piko','lili','zouzou','plume','cosmo','mimo','nino','velours','soleil','sacha','cocon'];
  const validCharacter=id=>ids.includes(id),validVoice=id=>voices.includes(id);
  function create(storage,fallback='noah',legacyVoice='bulle'){
    let state={version:1,character:validCharacter(fallback)?fallback:'noah',voices:{}};
    if(validVoice(legacyVoice))state.voices[state.character]=legacyVoice;
    try{
      const saved=JSON.parse(storage()?.getItem(key)||'null');
      if(saved?.version===1&&validCharacter(saved.character)){
        state={version:1,character:saved.character,voices:{}};
        for(const id of ids)if(validVoice(saved.voices?.[id]))state.voices[id]=saved.voices[id];
      }
    }catch{/* Storage must never prevent the demo from opening. */}
    const read=()=>({...state,voices:{...state.voices}});
    function persist(){try{const store=storage();if(!store)throw Error();store.setItem(key,JSON.stringify(state));return {ok:true,persisted:true};}catch{return {ok:true,persisted:false};}}
    return {read,voice:id=>state.voices[id]||'bulle',select(id){if(!validCharacter(id))return {ok:false};state.character=id;return persist();},setVoice(id,voice){if(!validCharacter(id)||!validVoice(voice))return {ok:false};state.voices[id]=voice;return persist();}};
  }
  // A slow, failed or cancelled image request cannot change the selected companion.
  function createSwitch(load,commit){
    let generation=0;
    return {cancel(){generation++;},async select(value){const token=++generation;try{await load(value);if(token!==generation)return {stale:true};return {ok:true,value:commit(value)};}catch(error){if(token!==generation)return {stale:true};return {ok:false,error};}}};
  }
  window.BeybooCompanionPreferences={key,create,createSwitch};
})();
