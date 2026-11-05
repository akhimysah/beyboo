/* Worker Cloudflare autonome : sert public/ (ressources statiques) et toutes les routes /api/.
   Même logique métier que worker/index.ts, sans l'outillage ChatGPT Sites. */
import { searchVideos } from '../lib/video-search.mjs';
import { weatherRequest } from '../lib/weather.mjs';
import { handleVoiceRequest } from '../lib/voice-api.mjs';
import { handleAuthRequest, identify, sanitizeRequest } from '../lib/auth.mjs';
import { securityHeaders, withHeaders } from '../lib/security-headers.mjs';
import { handleRoomRequest } from '../lib/family-room.mjs';
export { FamilyRoom } from '../lib/family-room.mjs';

const APP_VERSION = '38';
const json = (body, status = 200) => Response.json(body, {status, headers: {'Cache-Control': 'no-store'}});

async function apiRoute(request, env, ctx) {
  const pathname = new URL(request.url).pathname;
  if (pathname === '/api/health') {
    return json({ok: true, version: APP_VERSION, voice: !!env.OPENAI_API_KEY, videoSearch: !!env.YOUTUBE_DATA_API_KEY, authMode: env.AUTH_MODE || 'chatgpt', room: !!env.FAMILY_ROOM});
  }
  if (pathname === '/api/videos/search') return searchVideos(request, env);
  if (pathname === '/api/weather') return weatherRequest(request, fetch, env);
  if (pathname.startsWith('/api/voice/')) return handleVoiceRequest(request, env);
  if (pathname.startsWith('/api/auth/')) return handleAuthRequest(request, env);
  if (pathname === '/api/messages' || pathname.startsWith('/api/messages/') || pathname.startsWith('/api/room/') || pathname.startsWith('/api/calls/')) {
    return handleRoomRequest(request, env, await identify(request, env));
  }
  return json({error: 'not_found', message: 'Page introuvable.'}, 404);
}

export default {
  async fetch(rawRequest, env, ctx) {
    const request = sanitizeRequest(rawRequest, env);
    const pathname = new URL(request.url).pathname;
    if (pathname.startsWith('/api/')) {
      const response = await apiRoute(request, env, ctx);
      // Une réponse 101 (WebSocket) ne peut pas être reconstruite.
      return response.status === 101 ? response : withHeaders(response, securityHeaders(env, {api: true}));
    }
    if (!env.ASSETS) return json({error: 'not_found', message: 'Page introuvable.'}, 404);
    // html_handling = none : la racine sert index.html sans redirection, les liens /index.html?app=1 restent stables.
    const target = pathname === '/' ? new Request(new URL('/index.html' + new URL(request.url).search, request.url), request) : request;
    const response = await env.ASSETS.fetch(target);
    return withHeaders(response, securityHeaders(env, {api: false}));
  }
};
