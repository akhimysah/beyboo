# Remplacement du film d’ouverture — 4 novembre 2026

La vidéo jungle fournie par Hicham remplace l’ancienne signature. La candidate blanche montre Noah tirant sur le mot sans récupérer l’œil ; la candidate jungle raconte la récupération et termine avec Noah assis face caméra et les six lettres BEYBOO visibles. La seconde sert donc d’introduction de marque.

Source retenue : fichier joint `_users_498ec938-f4be-46af-9c87-668749a2c2f4_generated_524f28fe-ac5f-492c-81b7-49c9f2ad9347_generated_video(1).mp4` (12,04 s, 898 × 512). Encodage H.264 CRF 20, AAC 128 kbit/s, yuv420p, faststart ; durée de conteneur 12,053 s. Aucun recadrage, changement de montage, remplacement sonore ni modification des lettres. Fichier servi de 4 647 713 octets au lieu de 7 494 633 octets. Affiche extraite du premier plan.

Nouveaux fichiers : `public/assets/films/noah-jungle-opening.mp4` et `noah-jungle-opening-poster.webp`. Les anciens fichiers signature sont retirés du déploiement et toutes leurs références actives remplacées. Format CSS, dimensions HTML, durée et libellés adaptés au film. Les URLs d’assets et versions CSS/JS changent pour éviter l’ancienne ouverture en cache.

Le comportement existant est conservé : lecture muette automatique sur l’accueil, activation du son au toucher, Passer/Échap, fondu de fin vers le site et relecture au pied de page. L’application, les liens de section et la préférence de réduction des animations restent directs. Le mécanisme de 12 secondes sans progression est un délai d’inactivité renouvelé pendant la lecture ; il ne coupe pas ce film de 12 secondes.

## Vérification

- Six tests du cycle de lecture réussis (fin, autoplay refusé, erreur, attente réseau, pause, promesses tardives).
- Chrome bureau : nouveau fichier effectivement lu, readyState=4, paused=false, muted=true ; fin naturelle à 12,053 s, dialogue fermé, page déverrouillée et focus restitué au titre.
- Cadre mobile 390 × 844 : film entier en contain, largeur 374,39 px, hauteur 213,45 px ; aucune lettre recadrée.
- Activation du son confirmée ; bouton Passer arrête la vidéo immédiatement (0,013 s observé), puis ferme le dialogue.
- Accès direct `?app=1` : application présente, dialogue fermé et source vidéo non chargée.
- Aucun accès au micro, à la caméra ou à l’API payante pendant cette vérification. Pas d’essai sur appareil iOS physique.

Capture de l’introduction dans le navigateur : jungle-opening-20261104.jpg.
