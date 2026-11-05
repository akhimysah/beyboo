import assert from 'node:assert/strict';
import test from 'node:test';
import {handleVoiceRequest,VOICE_PREVIEW_TEXT} from '../lib/voice-api.mjs';

for(const locale of ['fr','en']){
  for(const preview of [false,true]){
    test(locale+' '+(preview?'sample':'conversation'),async()=>{
      const sdp='v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n';
      const url='https://demo.example';
      const request=new Request(url+'/api/voice/session',{method:'POST',headers:{Origin:url,'oai-authenticated-user-id':'demo','Content-Type':'application/json'},body:JSON.stringify({character:'noah',voiceProfile:'lili',locale,preview,sdp})});
      let config;
      const result=await handleVoiceRequest(request,{OPENAI_API_KEY:'mock-only',VOICE_MIN_INTERVAL_SECONDS:'0'},async(_url,opts)=>{
        config=JSON.parse(opts.body.get('session'));return new Response(sdp,{status:201});
      });
      assert.equal(result.status,200);
      const response=await result.json();
      if(preview){
        assert.equal(config.tools.length,0);
        assert.match(config.instructions,new RegExp(locale==='fr'?'phrase française':'phrase anglaise'));
        assert.equal(config.instructions.includes(response.previewText),true);
        assert.equal(response.previewText===VOICE_PREVIEW_TEXT,locale==='fr');
      }else{
        assert.equal(config.audio.input.transcription.language,locale);
        assert.match(config.instructions,locale==='fr'?/Parle en français naturel/:/natural English by default/);
        assert.equal(config.tools[0].name,'control_beyboo_screen');
      }
    });
  }
}
