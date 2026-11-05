/* The optional Google key stays on the Worker. Without a key, searches fall back to the public feeds of a
   curated set of children's channels (lib/video-feeds.mjs); no Google quota is spent on that path. */
import { identify, sameSite } from './auth.mjs';
import { reserveVideoSearch } from './quota.mjs';
import { searchFeeds, reserveFeedSearch } from './video-feeds.mjs';
const json=(body,status=200,extra={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...extra}});
const memoryCache=new Map();
const CACHE_SECONDS=6*3600;
const DEFAULT_API_BASE='https://www.googleapis.com';
export function videoSearchMode(env){return env?.YOUTUBE_DATA_API_KEY?'google':'feeds';}
export function apiBase(env){
  try{const base=new URL(String(env?.YOUTUBE_API_BASE||DEFAULT_API_BASE));return base.origin+base.pathname.replace(/\/$/,'');}
  catch{return DEFAULT_API_BASE;}
}
async function cached(cacheKey){
  const entry=memoryCache.get(cacheKey);
  if(entry&&entry.expires>Date.now())return entry.result;
  memoryCache.delete(cacheKey);
  return null;
}
function remember(cacheKey,result){
  memoryCache.set(cacheKey,{result,expires:Date.now()+CACHE_SECONDS*1000});
  if(memoryCache.size>500)memoryCache.delete(memoryCache.keys().next().value);
}
export async function searchVideos(request,env,fetcher=fetch){
  if(request.method!=='POST')return json({error:'method'},405);
  if(!sameSite(request,env))return json({error:'origin'},403);
  const mode=videoSearchMode(env);
  const {userId}=await identify(request,env,fetcher);
  if(!userId)return json({error:'sign_in'},401);
  if(Number(request.headers.get('content-length'))>1800)return json({error:'query'},400);
  let query,lang;
  try{
    const body=await request.json();query=typeof body.query==='string'?body.query.trim().replace(/\s+/g,' '):'';
    lang=body.lang==='en'?'en':'fr';
  }catch{return json({error:'query'},400);}
  if(!query||query.length>180)return json({error:'query'},400);
  const cacheKey=mode+':'+lang+':'+query.toLowerCase();
  const hit=await cached(cacheKey);
  if(hit)return json({...hit,cached:true});
  const budget=mode==='google'?await reserveVideoSearch(env,userId):await reserveFeedSearch(env,userId);
  if(!budget.ok)return json({error:'quota',reason:budget.reason||'user_quota',retryAfter:budget.retryAfter},429,{'Retry-After':String(budget.retryAfter)});
  if(mode==='feeds'){
    const result=await searchFeeds(query,{lang,env,fetcher});
    if(!result)return json({error:'unavailable'},503);
    remember(cacheKey,result);
    return json(result);
  }
  const url=new URL(apiBase(env)+'/youtube/v3/search');
  url.search=new URLSearchParams({part:'snippet',type:'video',maxResults:'5',q:query,relevanceLanguage:lang,safeSearch:'strict',videoEmbeddable:'true',videoSyndicated:'true',fields:'items(id/videoId,snippet/title,snippet/channelTitle)'}).toString();
  try{
    const response=await fetcher(url,{headers:{'X-Goog-Api-Key':env.YOUTUBE_DATA_API_KEY},signal:AbortSignal.timeout(6000)});
    if(!response.ok)return json({error:'unavailable'},503);
    const data=await response.json();
    if(!Array.isArray(data.items))return json({error:'unavailable'},503);
    const items=data.items.filter(item=>/^[A-Za-z0-9_-]{11}$/.test(item?.id?.videoId||'') && typeof item?.snippet?.title==='string').slice(0,5).map(item=>({id:item.id.videoId,title:item.snippet.title,channel:String(item.snippet.channelTitle||'')}));
    const result={enabled:true,items,source:'google'};
    remember(cacheKey,result);
    return json(result);
  }catch{return json({error:'unavailable'},503);}
}
/* Tests only. */
export function resetVideoCache(){memoryCache.clear();}
