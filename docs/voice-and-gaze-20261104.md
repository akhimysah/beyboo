# BEYBOO — voix expressives et suivi du visage

## Résultat

Le site et l’application partagent un sélecteur de 12 interprétations (8 ludiques, 4 douces et posées) sur les 10 timbres natifs Realtime. Bulle est la valeur par défaut. Les profils changent le timbre, le rythme et les instructions d’interprétation, sans promettre douze acteurs ou une imitation de voix réelle. Le choix reste dans le navigateur. Le personnage et sa personnalité restent indépendants du profil vocal.

Un extrait utilise la connexion OpenAI existante, sans demander le microphone. La session reçoit une phrase de comparaison, aucun outil ni détection de parole, et se termine après la fin de lecture audio ou au plus tard après 20 secondes. Une vraie conversation reste limitée à 180 secondes et conserve les commandes d’écran. Changer de voix exige une nouvelle session. Les extraits utilisent les crédits API de l’essai.

« Activer le regard qui me suit » utilise la caméra frontale, sur demande. Les images sont traitées localement par le détecteur déjà livré, sans identification. La pupille suit les déplacements du visage et revient au centre si le visage est perdu. La peluche, la bouche, le corps et le contour physique de l’écran ne sont jamais animés. Le suivi et le microphone peuvent fonctionner ensemble. Photo et appels évitent une deuxième capture caméra concurrente. Les pistes sont coupées à l’arrêt et en arrière-plan.

## Vérifications

- Suite Node : tests du serveur de voix, extraits WebRTC simulés, commandes d’écran, caméra, suivi, signal audio, appels et service worker.
- Validation visuelle : site et application, écran de bureau, fenêtres mobiles de 390 et 320 pixels. Sélection Piko, persistance après rechargement, messages explicites de configuration locale et de caméra en contexte HTTP.
- Capture : `beyboo-voix-regard-20261104.jpg`.
- Aucun appel OpenAI payant effectué pendant ces vérifications. La clé de production existante reste conservée côté serveur.
- Limite : l’écoute réelle des profils et un essai du suivi avec une personne devant une caméra n’ont pas été exécutés dans cet environnement de test. L’aperçu local est en HTTP et ne contient pas la clé de production ; ces deux essais se font sur le site HTTPS publié. Les instructions vocales orientent l’interprétation, elles ne garantissent pas un âge ou une hauteur de voix exacts.

## Essai sur téléphone

1. Ouvrir l’application publiée dans Safari ou Chrome.
2. Choisir un profil sous « Une voix à aimer » puis « Écouter ». Comparer Bulle, Lili, Piko et les profils adultes doux.
3. Toucher « Activer le regard qui me suit », autoriser la caméra, attendre « Je te vois ». Bouger doucement la tête à gauche, à droite, en haut et en bas.
4. Toucher « Parler à BEYBOO » et autoriser le micro. Le regard suit le visage et le signal de l’œil répond à la parole.
5. Sortir du champ, revenir, recentrer si nécessaire, puis couper le suivi. Vérifier la disparition de l’indicateur caméra.

## Maintenance

Le verrou local Vinext accidentellement suivi a été retiré du dépôt et `.vinext/` est ignoré. Le profil d’exécution local a été restauré sans modifier l’identité ou l’audience du site.
