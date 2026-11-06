# BOOZZO (ex-BEYBOO) — Un regard. Votre univers.

Site vitrine bilingue et application web : une peluche immobile dont l'œil rond est le seul écran. Version 38 (5 novembre 2026).

## Démarrer

- Visite rapide : `python3 -m http.server 8000 --directory public`, puis `http://localhost:8000/index.html` ou `?app=1` pour le mode application.
- Runtime complet (voix OpenAI, météo, recherche YouTube) : `npm run install:ci` puis `npm run dev`. Variables et modes d'identité dans `docs/DEPLOIEMENT.md`.
- Tests : `node --test tests/*.test.mjs`.
- Après un changement de CSS : `npm run bundle:css` ; après un ajout d'image : `npm run images:variants`.
- Page anglaise : `python3 -I scripts/render-english-page.py` (générée, ne pas éditer `public/index-en.html`).

## Repères v38

- Marque : le projet s’appelle BOOZZO depuis le 6 novembre 2026 (domaine boozzo.com). Textes FR/EN, logo (`scripts/make-brand-logo.py` → `assets/universe/brand-boozzo.webp`), films d’ouverture et du logo (`assets/films/boozzo-*.mp4`) et coffret (`assets/universe/packaging-boozzo.webp`) sont à jour ; les identifiants techniques (classes `beyboo-app`, cookie, dépôt, Worker) gardent l’ancien nom. Les images de campagne qui portent encore le mot BEYBOO incrusté restent à remplacer.

- Hébergement VPS : `server/node.mjs` + `scripts/deploy-vps.sh` (Node 22, systemd, Caddy HTTPS) ; voir `docs/DEPLOIEMENT.md` section 0.

- Deux hébergements : le site vitrine seul sur GitHub Pages (https://akhimysah.github.io/beyboo/, sans `/api`), l'application complète sur un Worker Cloudflare autonome (`wrangler.toml`, `worker/standalone.mjs`, URL donnée par `npx wrangler@4 deploy`). Tout est décrit dans [`docs/DEPLOIEMENT.md`, section 1](docs/DEPLOIEMENT.md#1-v38--déploiement-autonome-cloudflare-workers).
- Local : `npx wrangler@4 dev --port 8787` avec `.dev.vars` ; déploiement : `npx wrangler@4 deploy` ou push sur `main` (`.github/workflows/deploy-worker.yml`) ; secrets avec `npx wrangler@4 secret put`.
- Salle de famille (`lib/family-room.mjs`, Durable Object) : un code famille = une salle ; messages texte persistants (500 derniers), présence et signalisation d'appel par WebSocket (`/api/room/socket`), jamais stockée. Client : `public/family-room.js`.
- Tests : `tests/standalone-worker.test.mjs` (Worker avec liaisons factices) et `npm run smoke` (`scripts/smoke-room.mjs`, intégration contre un serveur en marche).

## Repères v37

- `public/eye-launcher.js` + `.css` : l'accueil rond de l'œil (barre d'état, WhatsApp · YouTube · Spotify · Appels · Photo · Assistant, accueil et micro). Toucher l'œil l'ouvre ; l'IA l'ouvre avec `open_home`.
- `lib/auth.mjs` : identité (`AUTH_MODE` chatgpt | access | password | open) et nettoyage des en-têtes du proxy.
- `lib/quota.mjs` : plafonds de dépenses IA et de recherche vidéo.
- `lib/security-headers.mjs` + `public/_headers` : en-têtes de sécurité et CSP (rapport par défaut).
- `docs/AUDIT-2026-11-05.md` : audit complet et corrections appliquées.

Les sections ci-dessous décrivent l'historique du projet ; certaines décrivent des états antérieurs (voir `docs/`).

---

## Contenu

- Dix personnages, dix histoires originales, devises, traits de personnalité et filtres de collection.
- Module BEYBOO One indépendant : simulation de retrait, face avant, nouveau dos gravé BEYBOO et guide de clipsage en trois étapes.
- Quatre accessoires : casque, montre, socle et étui.
- Six familles de produits dérivés : mini porte-clés, gourdes, accessoires téléphone, sacs, ensemble repas, papeterie. Les yeux de ces objets sont décoratifs, sans électronique.
- Galerie complète des dix campagnes, dont la grand-mère et son petit-fils avec Liam. Filtres famille/style, agrandissement et navigation au clavier.
- Vue d’ensemble des produits dérivés et planches détaillées. Étude BEYBOO × Sonic présentée à part comme proposition non officielle et non commercialisée.
- Référence MINI et lien primaire BMW/MINI identifiant Samsung Display.

## Interactions

Le corps des peluches reste immobile. Aucun mouvement autonome de tête, bras, bouche ou corps n’est représenté. Seuls le module déplacé à la main et son contenu à l’écran changent. Les effets de zoom des personnages au survol sont désactivés.

L’écran présente trois expressions, un menu, un mini-jeu tactile de cinq étoiles, le clip original silencieux « Mission Lune » (MP4, 12 secondes), une mélodie Web Audio, un appel illustré simulé, des réponses préécrites avec regard animé et les histoires des personnages. La synthèse vocale dépend du navigateur ; un message apparaît si elle est indisponible. Aucun microphone, caméra, appel réel ou assistant IA externe n’est activé. YouTube n’est pas connecté.

Le configurateur propose écran seul, écran + peluche ou peluche seule, ainsi que les dix familles d’accessoires. Il permet de sauvegarder la sélection localement et de télécharger un récapitulatif. Les anciennes sélections locales sont reprises. Aucun paiement, commande ou réservation.

## Organisation

- `dist/index.html` : page et dialogues accessibles.
- `dist/app.js` : personnages, histoires et composition.
- `dist/experience.js` : démonstrations de l’écran.
- `dist/universe-data.js` et `dist/universe.js` : campagnes, collection dérivée et galerie.
- `dist/style.css` et `dist/universe.css` : mise en page responsive.
- `dist/assets/studio/` : dix portraits, module, clipsage, quatre accessoires et référence MINI.
- `dist/assets/universe/` : logo final, dix campagnes, six planches dérivées, vue d’ensemble et étude Sonic.

Les images générées ont été converties en WebP pour le site, sans modifier les originaux. Le dos du module a été régénéré avec la marque finale. Les anciens visuels restent archivés dans les assets mais ne sont plus chargés. Les captures conversationnelles et anciens logos ne sont pas présentés dans la galerie commerciale.

## Exécution et validation

Aucune dépendance ni compilation. Servir `dist/`. Identité technique du projet et URL préservées dans `.openai/hosting.json`.

Vérification de syntaxe des quatre fichiers JavaScript, assets locaux, identifiants et ancres. Contrôle dans le navigateur sur ordinateur et à 390 px : accueil, menu, dos/face et retrait du module, galerie et navigation, fiches de personnages et d’accessoires, ajout d’une gourde, restauration de la composition après rechargement, partie complète du jeu, lecture MP4, mélodie, réponses, appel illustré et histoires. Ajustement de l’interface circulaire pour éviter le chevauchement des réponses sur mobile. Aucun débordement horizontal constaté. La lecture vocale est indisponible dans le navigateur de contrôle ; le repli textuel a été vérifié.

## Statut produit

Collection en développement. Les visuels sont des concepts, pas des photos de produits fabriqués. Dimensions, matériaux, fixation, fonctions et compatibilités restent à valider. Aucun prix, date commerciale ou partenariat MINI/Samsung/Sonic n’est annoncé. Publication conservant l’accès privé existant.

## Mise à jour des portraits — 4 novembre 2026

Élya porte une casquette en moumoute ivoire ; Mila a les cheveux blonds raides sous son béret ; Léa a deux couettes latérales, sans toque. Les fichiers studio `elya-v2.webp`, `mila-v2.webp` et `lea-v2.webp` remplacent les portraits dans la collection, les fiches, le configurateur et les histoires de l’écran via la fonction `photo()`. Les anciens fichiers restent archivés. Leurs tenues, expressions, couleurs d’iris et histoires sont conservées.

La collection propose aussi quatre nouvelles carnations pour Izan, Sana, Rayan et Léa. Ces portraits sont affichés par défaut et les versions ivoire restent sélectionnables depuis la fiche ou le configurateur. Le choix figure dans la composition sauvegardée et le récapitulatif. Voir `docs/collection-carnations-2026-11-04.md` pour les visuels, prompts et contrôles.

Le dos du module présente désormais une grille audio arrière et latérale et une entrée micro distincte sur la tranche. Le site explique que le logement doit garder les ouvertures libres et que l'acoustique reste à valider sur prototype. Voir `docs/audio-housing-2026-11-04.md`.
