# BEYBOO — application web avec peluche

4 novembre 2026. Point de départ : version 15, commit 90358cbe042901cf1c0e482d29cafa9ccf16dca8. Site et audience privée conservés.

> Mise à jour : la vue séparée décrite ci-dessous a été remplacée par la lecture dans l’œil de la peluche. Voir `round-eye-20261104.md`.

## Demande et réalisation

Le propriétaire veut parler directement à la peluche de sa photo et accéder aux fonctions depuis un accueil d’application. L’accueil web est disponible à /index.html?app=1. Le site marketing y mène depuis son en-tête et son bouton principal. Sa section interactive utilise également la peluche.

Photo fournie conservée dans assets/app/companion-blue-cap.jpg, sans animation du corps, de la bouche ou des membres. Recadrage de présentation en CSS. L’unique écran interactif est positionné dans son œil. Les mêmes analyseurs microphone/réponse animent les pixels. Toucher l’œil ou le bouton sous la peluche démarre le client vocal existant. Le bouton principal permet aussi d’annuler une connexion ou d’arrêter la voix.

Les activités utilisent le contrôleur partagé existant. Pour conserver la lisibilité et l’accès aux contrôles, l’écran se place dans une vue agrandie pendant une activité ; une miniature de la peluche reste affichée. Retour au regard remet le même écran dans le visage. Les lecteurs sont placés avant la création de leurs iframes pour éviter leur rechargement lors d’un déplacement de DOM.

L’accueil donne accès à la conversation, YouTube (sélection ou URL), Jitsi, maths, histoires, musique et jeu. Google Play ouvre une explication exacte et un lien vers la boutique officielle. Aucun bouton ne simule une installation Android. Le compte des familles et la connexion Google ne sont pas implémentés ; l’espace indique l’accès privé existant. Aucun mot de passe Google ou nouvelle adresse e-mail n’est collecté.

## Application web et sécurité

Manifest standalone, icônes PNG 192/512 dérivées de l’icône vectorielle existante, meta iOS, instructions d’ajout à l’écran d’accueil et utilisation du prompt d’installation quand le navigateur le fournit. Le manifeste est chargé avec credentials car l’essai est privé.

Service worker réseau uniquement : aucune page privée, identité, transcription, réponse API ou donnée audio mise en cache. Les navigations hors connexion reçoivent une page indiquant qu’Internet est nécessaire. Les requêtes API et médias sont laissées au navigateur. La clé et le serveur OpenAI ne sont pas modifiés, sauf une instruction explicite interdisant au personnage de prétendre installer des apps Android.

## Validation

18 tests passent : voix serveur, analyse audio, commandes Realtime, cycle de vie Jitsi existant, et trois tests du service worker (navigation privée sans cache, repli hors ligne honnête, API/médias non interceptés).

Navigateur : l’œil est dans plush-eye-dock à l’accueil ; Apprendre le place dans reading-screen-dock, 7 + 5 affiche une réponse correcte après le choix 12 ; Retour le remet dans la peluche. L’image de l’histoire choisie est chargée. Toucher l’œil déclenche bien le chemin de connexion vocale ; l’aperçu n’ayant pas de secret, il affiche le message de configuration attendu. La clé configurée sur le site publié reste inchangée.

Fenêtres d’installation, d’espace privé et d’information Play Store ouvertes et refermées. Accès au panneau Jitsi vérifié sans démarrer un appel ni partager un lien. Vue mobile 390/320 px sans dépassement horizontal ; écran de lecture mesuré 277 px à 320 px. YouTube chargé dans une vue complète de 277 x 226 px ; lecture effective non confirmée dans ce navigateur. Aucune installation sur un téléphone réel ni conversation micro/son de bout en bout n’a été effectuée durant cette modification.

Un conflit de la nouvelle fenêtre avec le gestionnaire de fermeture générique a été corrigé avant publication. La collection comporte de nouveau ses 10 personnages ; 11 éditions pays et les 5 films sont présents. Aucun contenu de collection supprimé. Page de QA temporaire supprimée.

Capture : beyboo-app-peluche-20261104.jpg.

## Frontière avec le produit Android

Une application web n’est pas un système Android et ne peut pas héberger le Play Store ni installer les applications Android. Pour le module physique envisagé, le fabricant devra prévoir un appareil Android compatible, la certification Play Protect et les licences Google Mobile Services. Les applications et leurs contrôles devront rester utilisables sur un écran rond ; la disponibilité du Play Store ne garantit pas que chaque app y fonctionnera. L’authentification Google du parent devra se faire via Google. Les appels du prototype utilisent Jitsi, pas WhatsApp.

Sources officielles consultées :
- https://www.android.com/gms/
- https://support.google.com/googleplay/answer/7165974?hl=en-GB
- https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/27/ios/27
- https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en-2
- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest
