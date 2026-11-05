# Film d’ouverture BEYBOO — 4 novembre 2026

Le film signature existant (10,04 s, 1550 × 512) ouvre désormais seul le site vitrine dans une scène blanche plein écran, sans recadrage du logo. La section qui répétait ce film dans la page est retirée. Un bouton au pied du site permet de revoir l’introduction.

Lecture automatique muette et inline ; le son s’active par un toucher. Un bouton Passer et la touche Échap libèrent le site. Un fondu de 600 ms accompagne la fin normale, puis le bouquet d’accueil démarre. Une erreur média ou 12 secondes sans progrès révèlent le site. Un refus d’autoplay propose un démarrage manuel. Une pause à l’arrière-plan propose Reprendre.

L’application (?app=1), les liens vers une section et les personnes ayant demandé moins d’animations accèdent directement au contenu. Aucun téléchargement du film sur l’ouverture directe de l’application. Une nouvelle ouverture de l’accueil rejoue l’introduction ; aucune préférence persistante ajoutée.

Le dialogue gère son propre cycle de fermeture, séparément des fiches produits. Le focus et le défilement sont restitués. Revoir le film interrompt les échanges vocaux, le suivi et les caméras/appels déjà ouverts.

## Validation

- 72 tests Node réussis, dont six sur fin de lecture, autoplay refusé, média indisponible, attente réseau, pause et promesses de lecture tardives.
- Chrome : vidéo réellement en lecture automatique (muted=true, paused=false, readyState=4), fin constatée à 10,04 s, dialogue fermé et accueil au sommet avec défilement débloqué.
- Relecture et activation du son par bouton vérifiées.
- Cadre mobile 390 × 844 : logo entier, fin normale et bouton Passer vérifiés ; arrêt observé à 0,38 s après Passer.
- Application : dialogue fermé et source vidéo non chargée.
- Collection des dix personnages toujours rendue. Aucun micro, caméra ou appel API payant activé pendant les tests.
- L’autoplay sonore n’est pas forcé ; un toucher reste nécessaire selon les règles du navigateur. Aucun essai sur appareil iOS physique.

Capture de la véritable introduction : brand-intro-20261104.jpg.
