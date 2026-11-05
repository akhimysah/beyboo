import test from 'node:test';
import assert from 'node:assert/strict';
import people from '../public/presidents.json' with {type:'json'};
import {handleVoiceRequest, voiceCatalog} from '../lib/voice-api.mjs';

const sdp = 'v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n';
function request(edition, locale, preview = true) {
  return new Request('https://demo.example/api/voice/session', {
    method:'POST', headers:{'Content-Type':'application/json', Origin:'https://demo.example', 'oai-authenticated-user-id':'tester'},
    body:JSON.stringify({character:'noah',edition,locale,preview,sdp})
  });
}
for (const locale of ['fr','en']) {
  test('each ' + locale + ' caricature uses its own fictional voice and approved line', async () => {
    const voices = new Set();
    for (const person of people) {
      let session;
      const result = await handleVoiceRequest(request(person.id,locale),{OPENAI_API_KEY:'test',VOICE_MIN_INTERVAL_SECONDS:'0'},async (_url, opts) => {
        session = JSON.parse(opts.body.get('session'));
        return new Response(sdp,{status:201});
      });
      const reply = await result.json();
      assert.equal(result.status,200);
      assert.equal(reply.previewText,person[locale].line);
      assert.equal(session.instructions.includes(reply.previewText),true);
      assert.deepEqual(session.tools,[]);
      assert.equal(reply.voice,voiceCatalog.profiles.find(p=>p.id===person.profile).baseVoice);
      voices.add(reply.voice);
    }
    assert.equal(voices.size,8);
  });
}
test('an unlisted or conversational edition cannot reach the audio provider', async () => {
  for (const req of [request('made-up','fr'),request('macron','en',false)]) {
    const result = await handleVoiceRequest(req,{OPENAI_API_KEY:'test',VOICE_MIN_INTERVAL_SECONDS:'0'},()=>assert.fail('unexpected request'));
    assert.equal(result.status,400);
  }
});
