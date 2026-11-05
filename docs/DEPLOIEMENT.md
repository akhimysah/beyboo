# BEYBOO — déploiement et exploitation (v37)

Ce document décrit comment faire tourner le site et l'application BEYBOO, sur l'hébergement ChatGPT Sites actuel ou sur un Worker Cloudflare indépendant, avec les garde-fous ajoutés en v37.

## 1. Deux façons de servir le projet

| Besoin | Commande | Ce qui fonctionne |
|---|---|---|
| Visite rapide, sans compte API | `python3 -m http.server 8000 --directory public` | Site, application (`?app=1`), menu d'applications dans l'œil, jeux, musique, horloge, veilleuse, caméra locale, configurateur. Les routes `/api/` répondent 404 : la voix affiche un message clair au lieu d'une erreur technique. |
| Runtime complet (Node ≥ 22.13) | `npm run install:ci` puis `npm run dev` | Tout ce qui précède plus `/api/voice`, `/api/weather`, `/api/videos/search`, `/api/auth`, `/api/health`. |
| Tests | `node --test tests/*.test.mjs` | 119 tests (v37). |
| Feuilles de style | `npm run bundle:css` | Après toute modification d'un CSS : régénère `public/beyboo.bundle.css` (liste ordonnée dans `scripts/stylesheets.json`) et tamponne son empreinte dans `index.html`. Un test échoue si le bundle ou l'empreinte dérivent. |
| Images | `npm run images:variants` | Après ajout d'une image : variantes 640 px et manifeste `assets/variants.json`. |
| Page anglaise | `python3 -I scripts/render-english-page.py` | Régénère `public/index-en.html` depuis `public/index.html` et `locales/en/page.json`. À lancer après `bundle:css`. Ne jamais éditer la page anglaise à la main. |

## 2. Variables d'environnement

Toutes les valeurs se configurent côté serveur (secrets du runtime Sites, `wrangler secret put`, ou `.dev.vars` en local). Aucune ne doit entrer dans le dépôt. Le fichier `.env.example` liste l'ensemble ; `cloudflare-env.d.ts` les type.

### Services

| Variable | Rôle | Défaut |
|---|---|---|
| `OPENAI_API_KEY` | Conversation vocale (OpenAI Realtime, WebRTC). | obligatoire pour la voix |
| `OPENAI_REALTIME_MODEL` | Identifiant du modèle Realtime. | `gpt-realtime-2.1` |
| `SESSION_SIGNING_SECRET` | Signe les jetons de raccrochage. Sans lui, la clé OpenAI sert de secours (ancien comportement). | — |
| `YOUTUBE_DATA_API_KEY` | Recherche YouTube dans l'œil. Sans clé, la sélection Paxi reste disponible. | — |
| `SITE_URL`, `CONTACT_EMAIL` | Identification envoyée à MET Norway (météo), exigée par leurs conditions. | lien du dépôt |
| `JITSI_HOST` | Hôte Jitsi autorisé dans les en-têtes de sécurité. | `meet.jit.si` |

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

## 3. Routes serveur

| Route | Méthode | Description |
|---|---|---|
| `/api/health` | GET | État du service : version, voix configurée, recherche vidéo configurée, mode d'identité. |
| `/api/voice/status` | GET | `configured`, `authenticated`, `authMode`, `signIn` (comment se connecter), `model`, `sessionSeconds`, `quota` restant. |
| `/api/voice/session` | POST | Négociation WebRTC : SDP du navigateur contre SDP OpenAI. Vérifie identité, même site, quotas, personnage, voix. |
| `/api/voice/end` | POST | Raccrochage distant avec le jeton signé. |
| `/api/auth/login`, `/api/auth/logout` | POST | Mode `password` uniquement. |
| `/api/weather?city=` | GET | Prévision arrondie pour huit villes ; en cas de panne amont, dernière valeur connue (`stale:true`) pendant 6 h. |
| `/api/videos/search` | POST | Recherche YouTube filtrée (`safeSearch=strict`, intégrable), cache 6 h, quotas. |

## 4. Ce qui reste à valider sur du vrai matériel

- Une conversation vocale complète au micro sur iPhone et Android, en français et en anglais, avec interruptions et connexion lente.
- Un appel Jitsi entre deux téléphones. `meet.jit.si` reste un service de test : pour la vente, prévoir JaaS (8x8) ou une instance Jitsi dédiée et renseigner `JITSI_HOST`.
- Le passage de la CSP en mode `enforce` sur l'hébergement final.
- Le remplacement du domaine de prévisualisation (`iris-atelier-hicham-2026.jhonnymoss.chatgpt.site`) dans `og:image`, `canonical`, `sitemap.xml` et `SITE_URL` au lancement public.
