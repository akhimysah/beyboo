/* Browser-local demo profile. Never an authentication identity or an AI input. */
(() => {
  'use strict';
  const key='beyboo-profile-v1';
  function validate(value){
    const name=typeof value?.name==='string'?value.name.normalize('NFC').trim().replace(/\s+/g,' '):'';
    const handle=typeof value?.handle==='string'?value.handle.trim().replace(/^@/,'').toLowerCase():'';
    if(!name||name.length>40||!/^\p{L}[\p{L}\p{M} .'’\-]*$/u.test(name))return {ok:false,field:'name',message:'Enter a name using 1 to 40 characters and letters.'};
    if(!/^[a-z0-9][a-z0-9._-]{2,23}$/.test(handle))return {ok:false,field:'handle',message:'Use 3 to 24 characters for your username: letters, numbers, periods, hyphens or underscores, with no spaces.'};
    return {ok:true,profile:{version:1,name,handle}};
  }
  function create(storage){
    let memory=null,loaded=false;
    function read(){
      if(loaded)return memory?{...memory}:null;
      loaded=true;
      try{
        const raw=storage()?.getItem(key);
        if(raw){const value=JSON.parse(raw);const result=validate(value);if(value.version===1&&result.ok)memory=result.profile;}
      }catch{/* Unavailable or malformed storage must not prevent the demo. */}
      return memory?{...memory}:null;
    }
    function save(value){
      const result=validate(value);if(!result.ok)return result;
      memory=result.profile;loaded=true;
      try{const store=storage();if(!store)throw Error('unavailable');store.setItem(key,JSON.stringify(memory));return {...result,persisted:true};}
      catch{return {...result,persisted:false};}
    }
    function remove(){
      try{const store=storage();if(!store)throw Error('unavailable');store.removeItem(key);memory=null;loaded=true;return {ok:true};}
      catch{return {ok:false,message:'Your profile could not be removed. Try again when browser storage is available.'};}
    }
    return {read,save,remove};
  }
  window.BeybooProfileModel={validate,create,key};
})();
