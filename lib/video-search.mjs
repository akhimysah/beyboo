/* The optional Google key stays on the Worker. Without a key the curated shelf works. */
import { identify, sameSite } from './auth.mjs';
import { reserveVideoSearch } from './quota.mjs';
const json=(body,status=200,extra={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...extra}});
const memoryCache=new Map();
const CACHE_SECONDS=6*3600;
async function cached(cacheKey){
  const entry=memoryCache.get(cacheKey);
  if(entry&&entry.expires>Date.now())return entry.items;
  memoryCache.delete(cacheKey);
  return null;
}
function remember(cacheKey,items){
  memoryCache.set(cacheKey,{items,expires:Date.now()+CACHE_SECONDS*1000});
  if(memoryCache.size>500)memoryCache.delete(memoryCache.keys().next().value);
}
export async function searchVideos(request,env,fetcher=fetch){
  if(request.method!=='POST')return json({error:'method'},405);
  if(!sameSite(request,env))return json({error:'origin'},403);
  const key=env.YOUTUBE_DATA_API_KEY;
  if(!key)return json({enabled:false,items:[]});
  const {userId}=await identify(request,env,fetcher);
  if(!userId)return json({error:'sign_in'},401);
  if(Number(request.headers.get('content-length'))>1800)return json({error:'query'},400);
  let query,lang;
  try{
    const body=await request.json();query=typeof body.query==='string'?body.query.trim().replace(/\s+/g,' '):'';
    lang=body.lang==='en'?'en':'fr';
  }catch{return json({error:'query'},400);}
  if(!query||query.length>180)return json({error:'query'},400);
  const cacheKey=lang+':'+query.toLowerCase();
  const hit=await cached(cacheKey);
  if(hit)return json({enabled:true,items:hit,cached:true});
  const budget=await reserveVideoSearch(env,userId);
  if(!budget.ok)return json({error:'quota',reason:budget.reason,retryAfter:budget.retryAfter},429,{'Retry-After':String(budget.retryAfter)});
  const url=new URL('https://www.googleapis.com/youtube/v3/search');
  url.search=new URLSearchParams({part:'snippet',type:'video',maxResults:'5',q:query,relevanceLanguage:lang,safeSearch:'strict',videoEmbeddable:'true',videoSyndicated:'true',fields:'items(id/videoId,snippet/title,snippet/channelTitle)'}).toString();
  try{
    const response=await fetcher(url,{headers:{'X-Goog-Api-Key':key},signal:AbortSignal.timeout(6000)});
    if(!response.ok)return json({error:'unavailable'},503);
    const data=await response.json();
    if(!Array.isArray(data.items))return json({error:'unavailable'},503);
    const items=data.items.filter(item=>/^[A-Za-z0-9_-]{11}$/.test(item?.id?.videoId||'') && typeof item?.snippet?.title==='string').slice(0,5).map(item=>({id:item.id.videoId,title:item.snippet.title,channel:String(item.snippet.channelTitle||'')}));
    remember(cacheKey,items);
    return json({enabled:true,items});
  }catch{return json({error:'unavailable'},503);}
}
/* Tests only. */
export function resetVideoCache(){memoryCache.clear();}
