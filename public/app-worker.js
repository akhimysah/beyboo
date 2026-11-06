/* Online shell; private HTML, voice, camera and profile data are never cached here. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate' || event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request).catch(() => {
    const english = (event.request.url || '').split('?')[0].endsWith('/index-en.html');
    const title = english ? 'BOOZZO needs a connection' : 'Connexion nécessaire';
    const message = english ? 'Connect your device to the internet to talk with BOOZZO, play videos or make calls.'
      : 'Connectez votre appareil à Internet pour parler à BOOZZO, regarder une vidéo ou passer un appel.';
    const path = english ? '/index-en.html?screen=1' : '/index.html?screen=1';
    const html = `<!doctype html><html lang="${english ? 'en' : 'fr'}"><meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1"><title>BOOZZO · ${title}</title>
      <style>body{font:17px/1.6 system-ui;background:#f8f8fa;color:#25374d;max-width:450px;margin:15vh auto;padding:28px}a{color:#245a82}</style>
      <h1>${title}</h1><p>${message}</p><a href="${path}">${english ? 'Try again' : 'Réessayer'}</a></html>`;
    return new Response(html, {status:503, headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
  }));
});
