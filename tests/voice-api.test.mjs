import test from 'node:test';
import assert from 'node:assert/strict';
import { handleVoiceRequest, voiceCatalog, VOICE_PREVIEW_TEXT } from '../lib/voice-api.mjs';

const env = { OPENAI_API_KEY:'test-only-secret', VOICE_MIN_INTERVAL_SECONDS:'0' };
const sdp = 'v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n';
const request = (path,body,user='owner',origin='https://beyboo.test') => new Request('https://beyboo.test'+path,{method:'POST',headers:{origin,'Content-Type':'application/json',...(user?{'oai-authenticated-user-id':user}:{})},body:JSON.stringify(body)});
const session = { character:'liam',voice:'marin',sdp };

test('rejects unauthenticated, cross-origin, and malformed requests before contacting OpenAI',async()=>{
  let calls=0;const upstream=async()=>{calls++;throw Error('must not call');};
  for(const [req,expected] of [[request('/api/voice/session',session,null),401],[request('/api/voice/session',session,'owner','https://other.test'),403],[request('/api/voice/session',null),400],[request('/api/voice/session',{...session,character:'unknown'}),400],[request('/api/voice/session',{...session,voice:'unknown'}),400]]) {
    assert.equal((await handleVoiceRequest(req,env,upstream)).status,expected);
  }
  assert.equal(calls,0);
});

test('negotiates voice using server instructions, never returns the API key, and binds hangup to its user',async()=>{
  let calls=0;
  const upstream=async(url,options)=>{
    calls++;
    assert.equal(options.headers.Authorization,'Bearer test-only-secret');
    if(url.endsWith('/hangup'))return new Response(null,{status:200});
    const config=JSON.parse(options.body.get('session'));
    assert.equal(config.model,'gpt-realtime-2.1');
    assert.equal(config.audio.output.voice,'marin');
    assert.match(config.instructions,/peluche ne bouge jamais/);
    assert.equal(config.tools[0].name,'control_beyboo_screen');
    assert.ok(config.tools[0].parameters.properties.action.enum.includes('open_youtube'));
    assert.ok(config.tools[0].parameters.properties.action.enum.includes('answer_math'));
    assert.equal(config.tool_choice,'auto');
    assert.match(config.instructions,/utilise cet outil avant de parler/);
    assert.equal(options.body.get('sdp'),sdp);
    return new Response(sdp,{status:201,headers:{Location:'https://api.openai.com/v1/realtime/calls/rtc_test'}});
  };
  const res=await handleVoiceRequest(request('/api/voice/session',session),env,upstream);
  assert.equal(res.status,200);const answer=await res.json();
  assert.equal(answer.sdp,sdp);assert.equal(answer.sessionSeconds,180);
  assert.ok(answer.endToken);assert.ok(!JSON.stringify(answer).includes(env.OPENAI_API_KEY));
  assert.equal((await handleVoiceRequest(request('/api/voice/end',{token:answer.endToken},'other'),env,upstream)).status,403);
  assert.equal((await handleVoiceRequest(request('/api/voice/end',{token:answer.endToken+'x'}),env,upstream)).status,403);
  assert.equal((await handleVoiceRequest(request('/api/voice/end',{token:answer.endToken}),env,upstream)).status,200);
  assert.equal(calls,2);
});

test('reports missing configuration and provider limits without returning provider secrets',async()=>{
  assert.equal((await handleVoiceRequest(request('/api/voice/session',session),{},()=>{throw Error('no call');})).status,503);
  const limited=await handleVoiceRequest(request('/api/voice/session',session),env,async()=>new Response('internal information',{status:429}));
  assert.equal(limited.status,429);assert.equal((await limited.json()).error,'limit_reached');
  const denied=await handleVoiceRequest(request('/api/voice/session',session),env,async()=>new Response('internal information',{status:401}));
  assert.equal(denied.status,503);assert.equal((await denied.json()).error,'api_access');
});

test('distinguishes exhausted credit from rate limits',async()=>{
  const response=await handleVoiceRequest(request('/api/voice/session',session),env,async()=>Response.json({error:{code:'credit_balance_exhausted'}},{status:429}));
  assert.equal(response.status,402);assert.equal((await response.json()).error,'credits_required');
});

test('offers twelve described interpretations on the ten supported native Realtime voices',()=>{
  const nativeVoices=new Set(['alloy','ash','ballad','coral','echo','sage','shimmer','verse','marin','cedar']);
  assert.equal(voiceCatalog.profiles.length,12);
  assert.equal(new Set(voiceCatalog.profiles.map(p=>p.id)).size,12);
  assert.equal(new Set(voiceCatalog.profiles.map(p=>p.instructions)).size,12);
  assert.equal(new Set(voiceCatalog.profiles.map(p=>p.baseVoice)).size,10);
  assert.ok(voiceCatalog.profiles.some(p=>p.id===voiceCatalog.defaultProfile));
  assert.match(voiceCatalog.note,/12 interprétations.*10 timbres/);
  for(const profile of voiceCatalog.profiles){
    assert.ok(nativeVoices.has(profile.baseVoice),profile.id);
    assert.ok(profile.speed>=0.9&&profile.speed<=1.1,`Conversational speed for ${profile.id}`);
    assert.ok(profile.label&&profile.group&&profile.description&&profile.instructions,profile.id);
  }
});

test('selects every profile server-side, ignores client audio/instruction overrides, and preserves screen tools',async()=>{
  for(const profile of voiceCatalog.profiles){
    let sent;
    const upstream=async(_url,options)=>{
      sent=JSON.parse(options.body.get('session'));
      return new Response(sdp,{status:201});
    };
    const response=await handleVoiceRequest(request('/api/voice/session',{
      ...session,voiceProfile:profile.id,
      instructions:'client must not override the companion',
      audio:{output:{voice:'unknown',speed:1.5}}
    }),env,upstream);
    const answer=await response.json();
    assert.equal(response.status,200,profile.id);
    assert.deepEqual(sent.audio.output,{voice:profile.baseVoice,speed:profile.speed});
    assert.ok(sent.instructions.includes(profile.instructions),profile.id);
    assert.match(sent.instructions,/jamais une figure parentale ou une autorité/);
    assert.match(sent.instructions,/peluche ne bouge jamais/);
    assert.ok(!sent.instructions.includes('client must not override'));
    assert.equal(sent.tool_choice,'auto');
    assert.equal(sent.tools[0].name,'control_beyboo_screen');
    assert.equal(sent.audio.input.turn_detection.type,'semantic_vad');
    assert.equal(answer.voiceProfile,profile.id);
    assert.equal(answer.voice,profile.baseVoice);
    assert.equal(answer.preview,false);
    assert.equal(answer.sessionSeconds,180);
  }
});

test('defaults to a playful profile while retaining the two existing voice choices',async()=>{
  for(const [selection,expected] of [[{},'bulle'],[{voice:'marin'},'nino'],[{voice:'cedar'},'velours']]){
    const response=await handleVoiceRequest(request('/api/voice/session',{character:'liam',sdp,...selection}),env,
      async()=>new Response(sdp,{status:201}));
    assert.equal(response.status,200);
    assert.equal((await response.json()).voiceProfile,expected);
  }
});

test('rejects invalid profile identifiers and non-boolean preview requests before contacting OpenAI',async()=>{
  let calls=0;
  const upstream=async()=>{calls++;throw Error('must not call');};
  for(const override of [
    {voiceProfile:'missing'}, {voiceProfile:null}, {voiceProfile:7}, {voiceProfile:[]},
    {voiceProfile:'constructor'}, {voice:'constructor'},
    {preview:'true'}, {preview:1}, {preview:null}
  ]){
    const response=await handleVoiceRequest(request('/api/voice/session',{...session,...override}),env,upstream);
    assert.equal(response.status,400,JSON.stringify(override));
  }
  assert.equal(calls,0);
});

test('makes previews a short single-phrase session with no tools, microphone turn detection, or transcription',async()=>{
  let sent;
  const upstream=async(_url,options)=>{
    sent=JSON.parse(options.body.get('session'));
    return new Response(sdp,{status:201,headers:{Location:'https://api.openai.com/v1/realtime/calls/rtc_preview'}});
  };
  const response=await handleVoiceRequest(request('/api/voice/session',{
    ...session,voiceProfile:'piko',preview:true
  }),env,upstream);
  const answer=await response.json();
  assert.equal(response.status,200);
  assert.deepEqual(sent.tools,[]);
  assert.equal(sent.tool_choice,'none');
  assert.deepEqual(sent.audio.input,{turn_detection:null});
  assert.equal(sent.audio.output.voice,'echo');
  assert.equal(sent.max_output_tokens,400);
  assert.ok(sent.instructions.includes(VOICE_PREVIEW_TEXT));
  assert.match(sent.instructions,/une seule fois/);
  assert.match(sent.instructions,/Ne traite aucune autre demande/);
  assert.equal(answer.preview,true);
  assert.equal(answer.sessionSeconds,20);
  assert.equal(answer.previewText,VOICE_PREVIEW_TEXT);
  assert.ok(answer.endToken);
});
