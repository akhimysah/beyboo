# Commandes sous la vidéo et cinquième film

Demande Hicham : ajouter le film grand-mère / petit-fils fourni et retirer les commandes qui masquent l’image pendant la lecture.

Le lecteur précédent réactivait video.controls à chaque événement play : les commandes natives étaient donc dessinées sur l’image. Le nouveau lecteur désactive constamment les contrôles natifs, conserve playsinline et affiche une barre externe : lire / pause / revoir, progression, son et agrandissement. Aucun contrôle ni dégradé n’est superposé à l’image. L’agrandissement conserve également la barre sous la vidéo et se ferme avec le bouton ou Échap ; navigation clavier contenue dans la vue agrandie. Le repli sans JavaScript conserve le lecteur natif.

Cinquième vidéo : ensemble-liam.mp4, format portrait 512 × 646, environ 10 secondes. Placée dans une séquence distincte après la FAQ, avant la conclusion, avec le titre « Le plus beau lien. C’est le vôtre. ». Compression web H.264, piste audio copiée, affiche issue de la première image. Original inchangé.

## Validation

- Syntaxe JS, références locales et identifiants HTML, git diff --check.
- Les cinq lecteurs ont controls=false et playsinline. Aucun bouton de lancement superposé restant.
- Lecture, pause, reprise, état Revoir, son coupé, déplacement clavier dans la progression vérifiés.
- Agrandissement et fermeture par Échap : commandes entièrement sous l’image, restitution du lecteur dans sa rubrique.
- Lecture de la nouvelle vidéo avec audio non muet ; lancement mettant YouTube en pause avant sa fin.
- Largeurs de contrôle 390 et 320 pixels : pas de débordement, barre sous l’image et agrandissement mobile intégralement visible. Ce contrôle utilise le navigateur de prévisualisation, pas un appareil iOS physique.
- Capture : beyboo-lecteur-corrige-20261104.jpg. Page temporaire de contrôle supprimée.
