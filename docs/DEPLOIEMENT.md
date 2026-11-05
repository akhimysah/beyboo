# BEYBOO — déploiement et exploitation (v38)

Ce document décrit comment faire tourner le site et l'application BEYBOO : le déploiement autonome sur Cloudflare Workers ajouté en v38 (section 1), puis les modes d'exécution, variables, routes et garde-fous hérités des versions 36 et 37 (sections 2 à 5).

## 0. v38 — Hébergement VPS (Ubuntu, Node.js, Caddy)

L'application complète tourne aussi sur un VPS avec le serveur `server/node.mjs` (mêmes routes que le Worker ; la salle de famille utilise SQLite dans `DATA_DIR` et le paquet `ws`).

| Élément | Valeur |
|---|---|
| Serveur | Hostinger KVM 1, Ubuntu 26.04, `root@2.24.58.57`, hôte `srv2132780.hstgr.cloud` |
| Application | `/opt/beyboo` (code), `/opt/beyboo/.env` (secrets, lisible par root et le service), `/var/lib/beyboo/rooms/*.sqlite` (messages) |
| Service | `systemctl status beyboo` · journal `journalctl -u beyboo -f` · écoute sur 127.0.0.1:8080 |
| HTTPS | Caddy (`/etc/caddy/Caddyfile`), certificat Let's Encrypt automatique, redirection HTTP→HTTPS |
| Pare-feu | ufw : SSH, 80, 443 |

Déployer (ou mettre à jour) depuis le Mac : `scripts/deploy-vps.sh root@2.24.58.57` (ajouter en second argument un fichier `.env` la première fois). Changer le code famille : éditer `SITE_PASSWORD` dans `/opt/beyboo/.env` puis `systemctl restart beyboo`. Pour un domaine personnalisé : faire pointer le domaine vers l'IP, remplacer le nom d'hôte dans `server/Caddyfile` et `SITE_URL`, redéployer.

## 1. v38 — Déploiement autonome Cloudflare Workers

Depuis la v38, BEYBOO ne dépend plus de ChatGPT Sites. L'application complète tourne sur un Worker Cloudflare autonome ; le site vitrine reste aussi publié, sans serveur, sur GitHub Pages.

### 1.1 Deux hébergements

| | Site vitrine (GitHub Pages) | Application (Cloudflare Worker) |
|---|---|---|
| Adresse | https://akhimysah.github.io/beyboo/ | https://beyboo.neobank.workers.dev (à confirmer après le premier `wrangler deploy` : l'adresse exacte s'affiche en fin de commande) |
| Ce qui marche | Pages, galerie, configurateur, jeux, musique, horloge, caméra locale : tout ce qui est purement local au navigateur. | Tout, plus la voix OpenAI, la météo, la recherche YouTube, le code famille, les messages, la présence et les appels entre appareils. |
| Routes `/api/` | Aucune (404) : les panneaux concernés affichent un message clair. | Toutes (`worker/standalone.mjs`). |
| Publication | `.github/workflows/pages.yml` → `scripts/build-pages.mjs` → dossier `dist-pages/`. | `.github/workflows/deploy-worker.yml` → `npx wrangler@4 deploy`, ou la même commande à la main. |
| Configuration | `BASE_PATH=/beyboo` au build. | `wrangler.toml` + secrets posés sur Cloudflare. |

Le runtime ChatGPT Sites (`worker/index.ts`, `vite.config.ts`, `scripts/run-framework.mjs`, `npm run dev`) est conservé tel quel ; il n'est plus nécessaire pour exploiter BEYBOO.

### 1.2 Ce que décrit `wrangler.toml`

| Élément | Valeur | Rôle |
|---|---|---|
| `name` / `main` | `beyboo` / `worker/standalone.mjs` | Le Worker : routes `/api/*`, réécriture de `/` vers `/index.html`, en-têtes de sécurité (`lib/security-headers.mjs`) sur chaque réponse sauf les 101 WebSocket. |
| `[assets]` | dossier `./public`, liaison `ASSETS`, `run_worker_first = ["/api/*", "/"]`, `html_handling = "none"` | Les fichiers de `public/` sont servis directement par Cloudflare (avec `public/_headers`) ; seuls `/api/*` et `/` passent par le Worker. Les liens `/index.html?app=1` restent stables, sans redirection. |
| `[[kv_namespaces]]` | `BEYBOO_KV` (id `359630cc1d0f435891b03ac55f4a1619`) | Compteurs de quotas partagés entre les instances (`lib/quota.mjs`). |
| `[[durable_objects.bindings]]` + `[[migrations]]` | `FAMILY_ROOM` → classe `FamilyRoom`, migration `v1` (`new_sqlite_classes`) | La salle de famille : messages persistants (SQLite) et WebSockets (`lib/family-room.mjs`). |
| `[vars]` | `AUTH_MODE = "password"`, `CSP_MODE = "report"`, `SITE_URL`, `CONTACT_EMAIL` | Valeurs publiques. Les secrets ne sont jamais dans ce fichier. |
| Compte | `5eb23048400a67c614b9446e73c6c1c0` | Identifiant du compte Cloudflare (variable `CLOUDFLARE_ACCOUNT_ID` du workflow). |

### 1.3 Commandes

| Besoin | Commande | Notes |
|---|---|---|
| Serveur local complet | `npx wrangler@4 dev --port 8787` | Lit `.dev.vars` (gitignoré) pour les secrets locaux ; KV et Durable Object sont simulés dans `.wrangler/state`. Ouvrir http://127.0.0.1:8787/index.html?app=1. Pour simuler un second appareil dans un autre onglet (local uniquement) : `?app=1&member=<32 caractères hexadécimaux>`. |
| Tests unitaires | `node --test tests/*.test.mjs` | Plus de 140 tests en v38 (119 en v37), dont `tests/standalone-worker.test.mjs` (Worker avec liaisons factices : santé, réécriture de `/`, en-têtes, 401/400/403, transmission au Durable Object). |
| Test d'intégration de la salle | `npm run smoke` ou `node scripts/smoke-room.mjs [baseUrl] [codeFamille]` | Contre un serveur en marche (défauts `http://127.0.0.1:8787` et `beyboo-test`) : santé, refus sans cookie, connexion, messages (POST/GET/DELETE), trois WebSockets, sonnerie, signal relayé au seul destinataire, départ. Code de sortie 1 en cas d'échec, 2 au-delà de 20 s. Fonctionne aussi contre le Worker déployé avec le vrai code. |
| Déployer | `npx wrangler@4 deploy` | Ou un push sur `main` (workflow `deploy-worker.yml`, qui lance d'abord les tests). La première fois, `wrangler login` ouvre le navigateur. |
| Poser un secret | `npx wrangler@4 secret put NOM` | Saisie masquée ; prend effet immédiatement sur le Worker déployé et survit aux déploiements suivants. `npx wrangler@4 secret list` pour vérifier les noms (jamais les valeurs). |
| Suivre les journaux | `npx wrangler@4 tail` | Flux en direct des requêtes et erreurs du Worker (filtrer : `--status error`). |
| Historique des déploiements | `npx wrangler@4 deployments list` | Et `npx wrangler@4 rollback` pour revenir en arrière. |

### 1.4 Variables et secrets

| Nom | Type | Obligatoire | Rôle |
|---|---|---|---|
| `AUTH_MODE` | var (`wrangler.toml`) | oui | `password` : un code famille partagé (section 2 pour les autres modes). |
| `AUTH_SECRET` | secret | oui | Signe le cookie de session `beyboo_session` (HMAC-SHA-256). Long et aléatoire, par exemple `openssl rand -hex 32`. Le changer déconnecte tout le monde. |
| `SITE_PASSWORD` | secret | oui | Le code famille. Il détermine aussi l'identité de la salle (voir 1.6). |
| `SESSION_SIGNING_SECRET` | secret | recommandé | Signe les jetons de raccrochage vocal ; sans lui la clé OpenAI sert de secours. |
| `OPENAI_API_KEY` | secret | pour la voix | Conversation vocale (Realtime, WebRTC). Sans clé, `/api/voice/status` répond `configured:false`. |
| `YOUTUBE_DATA_API_KEY` | secret | non | Recherche YouTube dans l'œil. Sans clé, repli sur les flux RSS de chaînes sélectionnées (`lib/video-feeds.mjs`). |
| `TURN_KEY_ID`, `TURN_KEY_API_TOKEN` | secrets | non | Clé Cloudflare Realtime TURN (dashboard → Realtime → TURN keys). Sans eux, `/api/calls/turn` ne renvoie que des serveurs STUN. |
| `ALLOWED_ORIGINS` | var ou secret | non | Origines supplémentaires acceptées pour les écritures (`POST`, `DELETE`), séparées par des virgules. Inutile tant que site et API partagent la même origine. |
| `SESSION_DAYS` | var | non | Durée du cookie (30 jours par défaut, 90 maximum). |
| `CSP_MODE` | var | oui | `report` (défaut) puis `enforce` (voir 1.8). |
| `SITE_URL`, `CONTACT_EMAIL` | vars | oui | Identification envoyée à MET Norway pour la météo. |
| `OPENAI_REALTIME_MODEL`, quotas `VOICE_*` / `VIDEO_*`, `HSTS` | vars | non | Voir section 2. |
| `YOUTUBE_API_BASE` | var | jamais en production | Tests uniquement : remplace l'API YouTube par un serveur factice. |

Liaisons (pas des variables, déclarées dans `wrangler.toml`) : `ASSETS` (fichiers statiques), `BEYBOO_KV` (quotas), `FAMILY_ROOM` (salle). `cloudflare-env.d.ts` les type ; `.env.example` liste les variables avec un commentaire chacune.

En local, `.dev.vars` contient au minimum `AUTH_MODE=password`, `AUTH_SECRET=…`, `SITE_PASSWORD=beyboo-test`, `SESSION_SIGNING_SECRET=…`, `CSP_MODE=report`.

### 1.5 Nouvelles routes (toutes derrière le code famille)

Chaque requête de la salle doit porter le cookie de session **et** identifier l'appareil : `X-Beyboo-Member` (ou `?member=`), 16 à 32 caractères hexadécimaux, générés une fois par navigateur (`localStorage` `beyboo.room.member.v1`) ; `X-Beyboo-Name` (ou `?name=`), le prénom du profil, encodé avec `encodeURIComponent`, 40 caractères maximum. Les méthodes autres que `GET` doivent venir du site (`Sec-Fetch-Site: same-origin` ou `Origin` autorisée). Réponses d'erreur : `401 sign_in_required` (pas de cookie), `400 invalid_member`, `403 invalid_origin`, `503 not_configured` (pas de Durable Object).

| Route | Méthode | Description |
|---|---|---|
| `/api/messages` | GET | `{messages:[{id, member, name, kind, body, created}]}` : les 100 derniers messages, ou avec `?since=<id>` les 100 suivants cet identifiant (rattrapage après une coupure). |
| `/api/messages` | POST | Corps `{text, kind?}` ; `text` de 1 à 1000 caractères, `kind` `text` (défaut) ou `emoji`. Réponse `201 {message}` et diffusion `message` à tous les appareils connectés. |
| `/api/messages/:id` | DELETE | Supprime le message (`{deleted:id}`) et diffuse `deleted`. Tout membre de la famille peut supprimer n'importe quel message : la salle est un espace de confiance. |
| `/api/room/peers` | GET | `{peers:[{member, name, call}]}` : les appareils actuellement connectés en WebSocket (un par `member`), avec l'appel en cours le cas échéant. |
| `/api/room/socket` | GET + `Upgrade: websocket` | Une connexion par appareil, `?member=&name=` dans l'URL (les navigateurs ne posent pas d'en-têtes sur une WebSocket). Messages ci-dessous. Fermeture 1008/4401 côté client = reconnexion refusée (code famille absent). |
| `/api/calls/turn` | GET | `{iceServers:[{urls, username?, credential?}], turn:boolean}` (`lib/turn.mjs`) : serveurs STUN publics (Cloudflare, Google) et, si `TURN_KEY_ID` et `TURN_KEY_API_TOKEN` sont posés, des identifiants TURN Cloudflare temporaires (24 h, mis en cache 10 min côté Worker). Cookie requis (`401` sinon) ; pas d'identifiant d'appareil nécessaire. En cas de panne de l'API TURN, repli silencieux sur STUN seul (`turn:false`). |

Messages WebSocket, tous en JSON `{type, …}` (texte, 64 Kio maximum par trame, trames invalides ignorées en silence) :

| Sens | `type` | Contenu | Effet |
|---|---|---|---|
| serveur → client | `hello` | `member`, `name`, `peers`, `lastId` | Premier message après l'ouverture ; `lastId` sert à rattraper l'historique avec `GET /api/messages?since=`. |
| serveur → tous | `presence` | `peers` | À chaque arrivée, départ ou `rename`. |
| serveur → tous | `message` / `deleted` | `message` / `id`, `by` | Reflet des POST et DELETE. |
| client → serveur | `ping` | — | Le serveur répond `pong {at}` ; le client en envoie un toutes les 25 s. |
| client → serveur | `rename` | `name` | Met à jour le prénom affiché et rediffuse `presence`. |
| client → serveur | `typing` | `active` | Rediffusé aux autres : `typing {from, active}`. |
| client → serveur | `ring` | `call` (8 à 64 caractères `[A-Za-z0-9_-]`) | Sonne tous les autres appareils : `ring {call, from}`. |
| client → serveur | `join` | `call` | Prévient les autres (`peer-joined {call, from}`) et reçoit `call-peers {call, peers}` : les appareils déjà dans cet appel. |
| client → serveur | `leave` | — | Diffuse `peer-left {call, from}`. Envoyé aussi automatiquement à la fermeture de la connexion si l'appareil était en appel. |
| client → serveur | `signal` | `call`, `to` (member), `payload` (SDP ou ICE) | Relayé **uniquement** aux connexions de `to`, sous la forme `signal {call, from, payload}`. Jamais stocké. |

Côté navigateur, `public/family-room.js` expose `window.BeybooRoom` (`connect`, `send`, `on`, `api`, `login`, `signedIn`, `member`, `name`, `rename`) ; `public/messages.js` et le module d'appel s'appuient dessus. La reconnexion est automatique (délai exponentiel, 30 s maximum, relance au retour en premier plan ou en ligne).

### 1.6 Le modèle : une salle de famille = un code famille

L'identité ne vient jamais du client. En mode `password`, `lib/auth.mjs` dérive de `SITE_PASSWORD` et `AUTH_SECRET` un identifiant de famille (`family:<16 hex>`), le place dans le cookie signé, et `handleRoomRequest` ouvre le Durable Object `FAMILY_ROOM.idFromName(identifiant)`. Tous les appareils qui connaissent le code se retrouvent donc dans **la même salle** : même historique, même présence, mêmes sonneries. Le Durable Object ne fait confiance qu'aux en-têtes `x-beyboo-member` / `x-beyboo-name` que le Worker réécrit après vérification ; une requête directe ne peut pas les forger.

Un appareil = un identifiant aléatoire par navigateur + le prénom du profil local. Deux onglets du même navigateur partagent le même appareil (une seule entrée dans `peers`, mais chaque connexion reçoit les messages).

### 1.7 Limites à connaître

- **Messages conservés : les 500 derniers** par famille (`KEEP` dans `lib/family-room.mjs`) ; les plus anciens sont effacés à chaque nouveau message. Une requête renvoie 100 messages au plus. Texte seulement (1000 caractères) : pas de photos ni de vocaux stockés.
- **La signalisation n'est jamais stockée** : `ring`, `join`, `leave`, `signal` ne font que transiter. Si le destinataire n'est pas connecté à cet instant, le message est perdu (pas de sonnerie différée, pas de messagerie d'appels manqués).
- **Appels pair à pair** : audio et vidéo circulent directement entre les deux navigateurs (WebRTC) ; le serveur ne les voit pas et ne les enregistre pas. Sans TURN, deux appareils derrière des réseaux mobiles ou des NAT stricts peuvent échouer à se joindre : poser `TURN_KEY_ID` / `TURN_KEY_API_TOKEN` pour la vente. Les appels à plus de deux ne sont pas prévus.
- **Présence = connexions ouvertes** : un téléphone en veille disparaît de `peers` ; le client se reconnecte au réveil.
- **Un seul code = une seule famille** par déploiement. Plusieurs familles demandent plusieurs Workers (ou le mode `access`, section 2).
- Le Durable Object vit dans une seule région (celle du premier accès) : latence plus élevée pour un proche sur un autre continent, mais cohérence garantie.

### 1.8 Procédures

**Changer le code famille.** `npx wrangler@4 secret put SITE_PASSWORD` puis saisir le nouveau code. L'identifiant de salle dérivant du code, la famille repart dans une **salle vide** : l'ancien historique n'est plus accessible (il reste dans l'ancien Durable Object, inutilisé). Les cookies déjà posés restent valides jusqu'à leur expiration et pointent sur l'ancienne salle : pour déconnecter tout le monde en même temps, changez aussi `AUTH_SECRET` (`npx wrangler@4 secret put AUTH_SECRET`). Chaque proche entre ensuite le nouveau code dans le panneau famille. En local : modifier `.dev.vars` et relancer `wrangler dev`.

**Passer la CSP en mode `enforce`.** 1) Ouvrir l'application sur l'adresse réelle, avec la console du navigateur, et parcourir voix, messages, appel, vidéos : les violations apparaissent en avertissement `Content-Security-Policy-Report-Only`. 2) Corriger les sources manquantes dans `lib/security-headers.mjs` **et** `public/_headers` (les fichiers statiques ne passent pas par le Worker). 3) Mettre `CSP_MODE = "enforce"` dans `[vars]` de `wrangler.toml` et déployer. `tests/standalone-worker.test.mjs` vérifie que l'en-tête bascule bien de `Content-Security-Policy-Report-Only` à `Content-Security-Policy`.

**Première mise en service.** `wrangler login` → `npx wrangler@4 deploy` (crée le Worker, le Durable Object et attache le KV) → poser les secrets de 1.4 → `npm run smoke https://<adresse> <code>` → vérifier `/api/health` (`room:true`, `voice:true` si la clé OpenAI est posée).

**Domaine personnalisé.** Dashboard → Workers → beyboo → Settings → Domains & Routes, puis mettre à jour `SITE_URL`, `og:image`, `canonical` et `sitemap.xml`.


## 2. Deux façons de servir le projet (ChatGPT Sites et visite rapide)

| Besoin | Commande | Ce qui fonctionne |
|---|---|---|
| Visite rapide, sans compte API | `python3 -m http.server 8000 --directory public` | Site, application (`?app=1`), menu d'applications dans l'œil, jeux, musique, horloge, veilleuse, caméra locale, configurateur. Les routes `/api/` répondent 404 : la voix affiche un message clair au lieu d'une erreur technique. |
| Runtime complet (Node ≥ 22.13) | `npm run install:ci` puis `npm run dev` | Tout ce qui précède plus `/api/voice`, `/api/weather`, `/api/videos/search`, `/api/auth`, `/api/health`. |
| Tests | `node --test tests/*.test.mjs` | 119 tests en v37, plus de 140 en v38. |
| Feuilles de style | `npm run bundle:css` | Après toute modification d'un CSS : régénère `public/beyboo.bundle.css` (liste ordonnée dans `scripts/stylesheets.json`) et tamponne son empreinte dans `index.html`. Un test échoue si le bundle ou l'empreinte dérivent. |
| Images | `npm run images:variants` | Après ajout d'une image : variantes 640 px et manifeste `assets/variants.json`. |
| Page anglaise | `python3 -I scripts/render-english-page.py` | Régénère `public/index-en.html` depuis `public/index.html` et `locales/en/page.json`. À lancer après `bundle:css`. Ne jamais éditer la page anglaise à la main. |

## 3. Variables d'environnement

Toutes les valeurs se configurent côté serveur (secrets du runtime Sites, `wrangler secret put`, ou `.dev.vars` en local). Aucune ne doit entrer dans le dépôt. Le fichier `.env.example` liste l'ensemble ; `cloudflare-env.d.ts` les type.

### Services

| Variable | Rôle | Défaut |
|---|---|---|
| `OPENAI_API_KEY` | Conversation vocale (OpenAI Realtime, WebRTC). | obligatoire pour la voix |
| `OPENAI_REALTIME_MODEL` | Identifiant du modèle Realtime. | `gpt-realtime-2.1` |
| `SESSION_SIGNING_SECRET` | Signe les jetons de raccrochage. Sans lui, la clé OpenAI sert de secours (ancien comportement). | — |
| `YOUTUBE_DATA_API_KEY` | Recherche YouTube dans l'œil. Sans clé, la sélection Paxi reste disponible. | — |
| `SITE_URL`, `CONTACT_EMAIL` | Identification envoyée à MET Norway (météo), exigée par leurs conditions. | lien du dépôt |

### Identité (`AUTH_MODE`)

Le serveur choisit seul comment reconnaître un visiteur. Hors mode `chatgpt`, les en-têtes `oai-authenticated-user-*` entrants sont supprimés avant toute route : personne ne peut se faire passer pour le proxy ChatGPT.

| Mode | Quand | Ce qu'il faut |
|---|---|---|
| `chatgpt` (défaut) | Hébergement ChatGPT Sites. Le proxy pose `oai-authenticated-user-id`. | rien |
| `access` | Worker Cloudflare derrière Cloudflare Access (recommandé pour un déploiement privé indépendant). Le Worker vérifie le JWT `Cf-Access-Jwt-Assertion` (JWKS, audience, expiration). | `ACCESS_TEAM_DOMAIN` (ex. `famille.cloudflareaccess.com`), `ACCESS_AUD` |
| `password` | Code famille partagé. `POST /api/auth/login {password}` pose un cookie signé `HttpOnly; Secure; SameSite=Lax` (30 jours par défaut). Le panneau vocal affiche le champ de code automatiquement. | `AUTH_SECRET` (long et aléatoire), `SITE_PASSWORD`, `SESSION_DAYS` facultatif |
| `open` | Démo publique sans compte : identité anonyme par adresse IP et par jour, uniquement pour appliquer les quotas. À réserver à un essai encadré. | rien |

`ALLOWED_ORIGINS` (liste séparée par des virgules) autorise d'autres origines pour les requêtes `POST` si le site est servi depuis un domaine personnalisé derrière un proxy.

### Plafonds de dépenses IA

Les compteurs sont vérifiés avant tout appel payant et renvoient `429 quota_exceeded` avec `Retry-After`. Le panneau vocal affiche le message correspondant.

| Variable | Défaut | Portée |
|---|---|---|
| `VOICE_SESSIONS_PER_USER_PER_DAY` | 24 | par visiteur et par jour |
| `VOICE_SESSIONS_PER_DAY` | 240 | tout le site, par jour |
| `VOICE_PREVIEWS_PER_USER_PER_DAY` | 60 | extraits de voix, par visiteur |
| `VOICE_MINUTES_PER_MONTH` | 600 | budget mensuel estimé (3 min par conversation, 1 min par extrait) |
| `VOICE_MIN_INTERVAL_SECONDS` | 8 | délai minimal entre deux connexions d'un même visiteur |
| `VOICE_SESSION_SECONDS` | 180 | durée d'une conversation |
| `VIDEO_SEARCHES_PER_USER_PER_DAY` / `VIDEO_SEARCHES_PER_DAY` | 40 / 300 | recherche YouTube (les résultats sont mis en cache 6 h) |

Sans stockage partagé, les compteurs vivent dans la mémoire de chaque instance du Worker. Lier un espace KV sous le nom `BEYBOO_KV` les rend communs à toutes les instances. Dans tous les cas, fixez aussi une limite dure mensuelle dans la facturation OpenAI : c'est la première ligne de défense.

### En-têtes de sécurité

`lib/security-headers.mjs` ajoute `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Strict-Transport-Security` et une politique de contenu. Les réponses `/api/` reçoivent une CSP stricte. Les pages reçoivent la politique en mode **rapport** par défaut (`CSP_MODE=report`) : ouvrez la console du navigateur sur l'hébergement réel, corrigez les éventuelles violations, puis passez `CSP_MODE=enforce`. `public/_headers` applique la même politique aux fichiers statiques servis sans passer par le Worker.

## 4. Routes serveur (hors salle de famille, voir 1.5)

| Route | Méthode | Description |
|---|---|---|
| `/api/health` | GET | État du service : version, voix configurée, recherche vidéo configurée, mode d'identité. |
| `/api/voice/status` | GET | `configured`, `authenticated`, `authMode`, `signIn` (comment se connecter), `model`, `sessionSeconds`, `quota` restant. |
| `/api/voice/session` | POST | Négociation WebRTC : SDP du navigateur contre SDP OpenAI. Vérifie identité, même site, quotas, personnage, voix. |
| `/api/voice/end` | POST | Raccrochage distant avec le jeton signé. |
| `/api/auth/login`, `/api/auth/logout` | POST | Mode `password` uniquement. |
| `/api/weather?city=` | GET | Prévision arrondie pour huit villes ; en cas de panne amont, dernière valeur connue (`stale:true`) pendant 6 h. |
| `/api/videos/search` | POST | Recherche YouTube filtrée (`safeSearch=strict`, intégrable), cache 6 h, quotas. |

## 5. Ce qui reste à valider sur du vrai matériel

- Une conversation vocale complète au micro sur iPhone et Android, en français et en anglais, avec interruptions et connexion lente.
- Un appel vidéo WebRTC entre deux téléphones sur des réseaux différents (4G ↔ Wi-Fi) : sans `TURN_KEY_ID` / `TURN_KEY_API_TOKEN` (Cloudflare Realtime TURN), certains NAT empêchent la connexion.
- Le passage de la CSP en mode `enforce` sur l'hébergement final.
- Le remplacement du domaine de prévisualisation (`iris-atelier-hicham-2026.jhonnymoss.chatgpt.site`) dans `og:image`, `canonical`, `sitemap.xml` et `SITE_URL` au lancement public.
