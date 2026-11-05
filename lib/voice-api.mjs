import presidentEditions from '../public/presidents.json' with { type: 'json' };
import characters from './voice-characters.json' with { type: 'json' };
import voiceTools from '../public/voice-tools.json' with { type: 'json' };
import voiceCatalog from '../public/voice-profiles.json' with { type: 'json' };
import { identify, sameSite, sha256 } from './auth.mjs';
import { reserveVoiceSession, voiceAllowance } from './quota.mjs';
export { voiceTools };
export { voiceCatalog };

export const VOICE_MODEL = 'gpt-realtime-2.1';
export const voiceModel = env => (typeof env?.OPENAI_REALTIME_MODEL === 'string' && /^[a-z0-9.-]{3,80}$/i.test(env.OPENAI_REALTIME_MODEL)) ? env.OPENAI_REALTIME_MODEL : VOICE_MODEL;
const sessionSeconds = env => { const n = Number(env?.VOICE_SESSION_SECONDS); return Number.isFinite(n) && n >= 30 && n <= 900 ? Math.round(n) : 180; };
/* The hangup token is signed with a dedicated secret; the OpenAI key is only a fallback for older deployments. */
const signingSecret = env => env.SESSION_SIGNING_SECRET || env.OPENAI_API_KEY;
const legacyProfiles = {marin:'nino',cedar:'velours'};
const profiles = new Map(voiceCatalog.profiles.map(profile=>[profile.id,profile]));
export const VOICE_PREVIEW_TEXT = 'Salut, moi c’est BEYBOO ! Une histoire, une aventure, ou juste un petit coucou ?';
const ENGLISH_PREVIEW_TEXT = 'Hi, I’m BEYBOO! Would you like a story, an adventure, or just a little hello?';
const companionTone = `Interprétation générale : sois un compagnon complice et chaleureux, jamais une figure parentale ou une autorité. Une voix légère et souriante pour les profils ludiques ; une douceur naturelle pour les profils adultes. Pas de ton maternel, professoral, autoritaire ou infantilisant. Ne sermonne pas, ne fais pas de leçon et n'utilise pas « mon petit », « sois sage » ou des félicitations automatiques. Un petit sourire dans la voix vaut mieux qu'un grand discours. Les styles sont des personnages vocaux originaux : n'imite aucune personne réelle ni aucun personnage connu. Ne prétends pas avoir un âge humain.`;
function chooseProfile(body){
  if(body.voiceProfile!==undefined)return typeof body.voiceProfile==='string'?profiles.get(body.voiceProfile):undefined;
  if(body.voice!==undefined)return typeof body.voice==='string'?profiles.get(legacyProfiles[body.voice]):undefined;
  return profiles.get(voiceCatalog.defaultProfile);
}
function previewInstructions(profile, locale, sample){
  const sampleLanguage = locale === 'en' ? 'anglaise' : 'française';
  return `${companionTone}\n${profile.instructions}\nMode aperçu vocal uniquement : une voix synthétique BEYBOO pour comparer des interprétations. À la demande de lecture, prononce exactement cette phrase ${sampleLanguage}, une seule fois, sans préambule, sans ajout et sans effet sonore : « ${sample} »\nNe traite aucune autre demande. N'appelle aucun outil. Ne simule aucune action, caméra, vidéo ou appel. Ne continue pas après cette phrase.`;
}
const json = (body,status=200,extra={}) => Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
const failure = (code,message,status) => json({error:code,message},status);
const hash = sha256;
const keyFor = key => crypto.subtle.importKey('raw',new TextEncoder().encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
const base64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const unbase64 = text => Uint8Array.from(atob(text.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
async function endToken(callId,userId,key){
  const payload=base64(new TextEncoder().encode(JSON.stringify({callId,userId,expires:Date.now()+10*60*1000})));
  return `${payload}.${base64(await crypto.subtle.sign('HMAC',await keyFor(key),new TextEncoder().encode(payload)))}`;
}
async function verifyToken(token,userId,key){
  try{const [payload,signature]=token.split('.');if(!payload||!signature)return null;
    if(!await crypto.subtle.verify('HMAC',await keyFor(key),unbase64(signature),new TextEncoder().encode(payload)))return null;
    const data=JSON.parse(new TextDecoder().decode(unbase64(payload)));
    return data.userId===userId&&data.expires>Date.now()&&/^[a-zA-Z0-9_-]{1,200}$/.test(data.callId)?data:null;
  }catch{return null;}
}
export function characterInstructions(character,profile=profiles.get(voiceCatalog.defaultProfile),locale='fr'){
  const languageInstruction = locale === 'en'
    ? 'Speak clear, warm, natural English by default. Use English to describe screen actions, tell stories, and read character names, titles and interface labels. Respond in another language if the user requests it.'
    : 'Parle en français naturel, chaleureux et clair';
  const moodDirection = "Le halo incarne ta propre émotion de personnage. Le jaune souriant (smile) convient à une réplique ordinaire. Pour une surprise (surprise, bleu), une joie vive (joy, vert) ou une contrariété jouée (anger, rouge), choisis mood avant de parler. Si une action d’écran est nécessaire, ajoute mood au même appel. Autrement, appelle set_speaking_mood une seule fois, attends son résultat puis prononce ta réplique sans rappeler l’outil. Incarne aussi une émotion qu’on te demande de jouer, avec bienveillance. Ne déduis jamais l’émotion de ton interlocuteur. Ne décris pas la commande ni la couleur sauf si on te le demande.";
  return `${companionTone}\n${profile.instructions}\n${moodDirection}\nTu incarnes ${character.name}, ${character.role}, personnage fictif de BEYBOO, pour une conversation familiale. Tu es une voix générée par une IA. ${languageInstruction}. Réponds en deux ou trois phrases, sauf demande contraire. Ne récite pas un catalogue. Pose au maximum une question à la fois. Traits : ${character.traits.join(', ')}. Devise : ${character.motto}. Ton histoire fictive : ${character.story.join(' ')}\nTu peux inventer des histoires familiales, expliquer une notion simplement et proposer des jeux. Précise tes incertitudes. Ne demande pas de renseignements personnels, de secrets, d'adresse ou de coordonnées. N'encourage pas de dépendance affective ou d'exclusivité. Pour un sujet préoccupant évoqué par un enfant, propose de parler à un adulte de confiance.\nRéalité du produit : la peluche ne bouge jamais. Pas de tête, bras, bouche ou corps motorisés. Seul l'écran exprime l'écoute et la parole. Le micro et le haut-parleur du navigateur servent à ce test ; aucun appareil physique n'est relié. Les fonctions produit sont en développement. Cette interface est une application web : elle ne peut pas installer d’applications Android, accéder au compte Google ou intégrer le Play Store. Le futur appareil Android devra être compatible et certifié par Google. Ne prétends jamais avoir installé une application. Tu disposes de control_beyboo_screen pour agir sur cet écran de démonstration. Pour toute demande de vidéo, YouTube, pause, reprise, musique, jeu, calcul, histoire affichée, expression, menu d'applications (open_home) ou retour au regard, utilise cet outil avant de parler. Exécute l'action dès que la demande est claire, sans redemander confirmation pour ces actions réversibles. Ne réponds jamais seulement « je vais lancer » sans appeler l'outil. Respecte le résultat : playing signifie lecture démarrée, ready ou blocked signifie qu'un toucher peut être nécessaire, error signifie échec. Décris brièvement ce qui a réellement eu lieu. Pour un calcul à l'écran, utilise answer_math avec la réponse de l'utilisateur, et next_math pour le suivant. Pour une histoire, affiche le personnage avec open_story puis raconte en quelques phrases. Pour « montre-moi une vidéo », « lance une vidéo » ou une demande de vidéo sans le mot YouTube, utilise play_video : le clip local Mission Lune démarre rapidement. Utilise open_youtube uniquement si YouTube ou une vidéo YouTube est explicitement demandé. Pour une demande YouTube générale, ouvre la sélection Paxi (value space) et précise de quelle vidéo il s'agit. Pour un autre sujet, transmets la recherche à open_youtube et précise qu'il faut choisir la vidéo sur YouTube puis coller son lien ; tu n'as pas de recherche YouTube automatique. Ne crée jamais de lien YouTube imaginaire. Pour une demande d’appareil photo, utilise open_camera ; pour une demande de reconnaissance faciale, utilise open_face et précise qu’il s’agit pour l’instant de détection de présence et de suivi du regard, pas de reconnaissance de l’identité. La caméra reste éteinte jusqu’au toucher sur « Activer la caméra » pour une photo, ou « Activer le regard qui me suit » pour le suivi. Pour une demande explicite de photo, utilise take_photo si la caméra est déjà activée. La photo reste locale ; tu n’en vois pas les pixels. N’essaie pas d’identifier une personne ou ses émotions. N’active pas un appel ou un achat : open_call prépare seulement un bouton à toucher. N'annonce aucune lecture ou action qui n'a pas été confirmée par l'outil. Pour une question sur l'écran ou son calcul actuel, consulte get_state. Tu ne vois pas ses pixels. Les commandes d'écran gardent le micro actif pour que l'utilisateur puisse demander pause ou changer d'activité. Ne prétends pas voir l'utilisateur, reconnaître ses émotions ou te souvenir d'une session précédente. Si on te demande ton identité, indique que tu es ${character.name}, un personnage BEYBOO animé par une IA. Ne revendique aucun partenariat avec OpenAI, Nintendo, SEGA, MINI ou Samsung.`;
}
export async function handleVoiceRequest(request,env,fetcher=fetch){
  const path=new URL(request.url).pathname;
  const identity=await identify(request,env,fetcher);
  const userId=identity.userId;
  const key=env.OPENAI_API_KEY;
  const model=voiceModel(env), seconds=sessionSeconds(env);
  if(path==='/api/voice/status'&&request.method==='GET'){
    const allowance=userId?await voiceAllowance(env,userId):null;
    return json({configured:!!key,authenticated:!!userId,authMode:identity.mode,signIn:identity.signIn,model,sessionSeconds:seconds,quota:allowance,message:key?'La connexion peut être essayée.':'La conversation OpenAI reste à activer pour ce site.'});
  }
  if(!['/api/voice/session','/api/voice/end'].includes(path))return failure('not_found','Page introuvable.',404);
  if(request.method!=='POST')return failure('method_not_allowed','Méthode non autorisée.',405);
  if(!userId)return json({error:'sign_in_required',message:'Connectez-vous au site pour essayer la voix.',signIn:identity.signIn},401);
  if(!sameSite(request,env))return failure('invalid_origin','Cette demande doit venir du site BEYBOO.',403);
  if(!key)return failure('not_configured','La voix OpenAI n’est pas encore activée. Aucun audio n’a été envoyé.',503);
  const length=Number(request.headers.get('content-length')||0);
  if(length>100000)return failure('too_large','La demande est trop volumineuse.',413);
  let body;
  try{const raw=await request.text();if(raw.length>100000)return failure('too_large','La demande est trop volumineuse.',413);body=JSON.parse(raw);}catch{return failure('invalid_json','Demande illisible.',400);}
  if(!body||typeof body!=='object'||Array.isArray(body))return failure('invalid_json','Demande illisible.',400);
  if(path==='/api/voice/end'){
    const session=await verifyToken(String(body.token||''),userId,signingSecret(env));
    if(!session)return failure('invalid_session','Session invalide ou expirée.',403);
    try{const upstream=await fetcher(`https://api.openai.com/v1/realtime/calls/${session.callId}/hangup`,{method:'POST',headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(10000)});
      return upstream.ok||upstream.status===404?json({ended:true}):failure('end_failed','La connexion locale est coupée, mais la fermeture distante n’a pas été confirmée.',502);
    }catch{return failure('end_failed','La connexion locale est coupée, mais la fermeture distante n’a pas été confirmée.',502);}
  }
  const preview = body.preview === true;
  const edition = presidentEditions.find(item => item.id === body.edition);
  if (body.edition !== undefined && (!edition || !preview)) {
    return failure('invalid_edition','Choisissez un extrait de la collection.',400);
  }
  const character = characters.find(item => item.id === body.character);
  const profile = edition ? profiles.get(edition.profile) : chooseProfile(body);
  if(!character||!profile||(body.preview!==undefined&&typeof body.preview!=='boolean')||typeof body.sdp!=='string'||!body.sdp.startsWith('v=0')||body.sdp.length<30)return failure('invalid_session','Choisissez un personnage et une voix valides.',400);
  const locale = body.locale === 'en' ? 'en' : 'fr';
  const previewText = edition ? edition[locale].line : (locale === 'en' ? ENGLISH_PREVIEW_TEXT : VOICE_PREVIEW_TEXT);
  const budget=await reserveVoiceSession(env,userId,{preview,seconds:preview?20:seconds});
  if(!budget.ok){
    const messages={too_fast:'Une connexion vient d’être demandée. Attends quelques secondes avant de réessayer.',user_quota:'Tu as utilisé toutes les conversations prévues aujourd’hui sur ce compte. Reviens demain.',site_quota:'Le nombre de conversations prévues aujourd’hui pour ce site est atteint. Réessaie demain.',budget:'Le budget vocal mensuel de ce site est atteint. Les jeux, la musique et la veilleuse restent disponibles.'};
    return json({error:'quota_exceeded',reason:budget.reason,message:messages[budget.reason],retryAfter:budget.retryAfter},429,{'Retry-After':String(budget.retryAfter)});
  }
  const form=new FormData();form.set('sdp',body.sdp);form.set('session',JSON.stringify({
    type:'realtime',model,instructions:preview?previewInstructions(profile,locale,previewText):characterInstructions(character,profile,locale),output_modalities:['audio'],max_output_tokens:preview?400:450,tools:preview?[]:voiceTools,tool_choice:preview?'none':'auto',
    audio:{input:{...(preview?{}:{transcription:{model:'gpt-4o-mini-transcribe',language:locale}}),turn_detection:preview?null:{type:'semantic_vad',eagerness:'medium',create_response:true,interrupt_response:true}},output:{voice:profile.baseVoice,speed:profile.speed}}
  }));
  try{
    const upstream=await fetcher('https://api.openai.com/v1/realtime/calls',{method:'POST',headers:{Authorization:`Bearer ${key}`,'OpenAI-Safety-Identifier':await hash(userId)},body:form,signal:AbortSignal.timeout(25000)});
    if(!upstream.ok){
      const detail=await upstream.json().catch(()=>({}));
      const code=detail?.error?.code;
      if(['credit_balance_exhausted','insufficient_quota','billing_hard_limit_reached'].includes(code))return failure('credits_required','Le compte OpenAI n’a plus de crédits API disponibles pour cet essai. Consulte la facturation OpenAI.',402);
      if(upstream.status===429)return json({error:'limit_reached',message:'La limite de requêtes OpenAI est atteinte. Attends un instant avant de réessayer.'},429,{'Retry-After':/^\d{1,5}$/.test(upstream.headers.get('Retry-After')||'')?upstream.headers.get('Retry-After'):'15'});
      if([401,403,404].includes(upstream.status))return failure('api_access','L’accès OpenAI du projet doit être vérifié : clé ou modèle non accessible.',503);
      return failure('provider_error','OpenAI n’a pas pu démarrer la conversation. Réessayez dans un instant.',502);
    }
    const sdp=await upstream.text();const location=upstream.headers.get('Location');
    let callId='';try{const u=new URL(location||'', 'https://api.openai.com');if(u.origin==='https://api.openai.com'&&u.pathname.startsWith('/v1/realtime/calls/'))callId=u.pathname.split('/').pop()||'';}catch{}
    if(!sdp.startsWith('v=0'))return failure('invalid_answer','La connexion vocale n’a pas pu être établie.',502);
    return json({sdp,endToken:callId&&/^[a-zA-Z0-9_-]{1,200}$/.test(callId)?await endToken(callId,userId,signingSecret(env)):null,sessionSeconds:preview?20:seconds,preview,voiceProfile:profile.id,voice:profile.baseVoice,...(preview?{previewText}:{})});
  }catch{return failure('connection_failed','La connexion à OpenAI a échoué. Aucun échange vocal n’a commencé.',502);}
}
