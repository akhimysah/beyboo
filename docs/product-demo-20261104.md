# BEYBOO — présentation du produit complet

## Résultat

Le site et l’application partagent désormais le même aperçu de la peluche entière. La casquette, le visage, les bras et les pieds restent visibles dans le cadrage produit. La photographie reste fixe à 128 %, sans zoom automatique au lancement d’une activité. Les contenus actifs sont affichés à la position de l’œil.

Une loupe explicitement demandée affiche le même écran circulaire plus grand sous la photographie complète, avec une légende et un bouton de fermeture. Aucun déplacement du lecteur dans le DOM n’est effectué à ce moment : son iframe et sa lecture sont conservées. Parler ne ferme pas une loupe volontairement ouverte.

L’écran utilise une surface logique de 400 × 400 px, redimensionnée à la taille de l’œil. Le viewport interne YouTube reste de 280 × 280 px et est entièrement inscrit dans le cercle ; dans la vue produit il apparaît réduit. La loupe permet de le lire plus confortablement. Le clip local utilise un cadre inscrit, avec toute l’image visible, sans rogner son texte.

## Parcours

- Action « Essayer une vidéo dans son œil », sans activation du micro ni consommation API.
- Réponses de maths et grille de jeu accessibles hors de l’œil, reliées aux mêmes actions et résultats que l’écran. Focus clavier conservé après la réponse.
- Texte réel de chaque histoire et bouton d’écoute utilisant la conversation OpenAI existante, avec mention des crédits API.
- Commandes des activités près du produit sur mobile, dans la colonne de droite sur ordinateur.
- Google Play visiblement indiqué « À venir ». Capacité actuelle et futur appareil distingués dans une explication repliable.
- État sonore YouTube lu depuis le lecteur, bouton Activer/Couper et retour correct après pause/reprise.
- État opérationnel caméra synchronisé avec la barre d’activité et l’IA. Aucun pixel, nombre ou position de visage transmis dans cet état.

## Vérification

26 tests réussis avec `node --test tests/*.test.mjs`, dont deux tests supplémentaires pour la synchronisation caméra et le son YouTube. Vérification syntaxique des nouveaux scripts et `git diff --check`.

Vérification visuelle par navigateur du site et de l’application : ordinateur, largeurs 390 et 320 px, paysage 852 × 393. En paysage, la scène conserve une borne de 300 px au lieu de disparaître lorsque la hauteur est faible. Pas de débordement horizontal observé à 320 px.

Le clip Mission Lune joue réellement dans l’œil ; pause observée à environ 0,56 seconde sur une vidéo de 12 secondes. Calcul 7 + 5 : réponse 12 confirmée dans l’œil et dans les commandes ; calcul suivant 4 + 3 ; jeu passé de 0 à 1 étoile ; histoire d’Izan affichée. Préparation de la caméra sans permission automatique. Loupe ouverte et refermable sans changement de proportions de la photo.

YouTube a chargé le lecteur ESA et son iframe 280 × 280, mais le flux n’est pas entré en lecture confirmée dans ce navigateur (readyState 0, currentTime 0, y compris après une reprise manuelle). Le statut reste honnête avec lien externe et clip de secours. Aucune session OpenAI payante ni appel à une autre personne lancé pendant cette vérification. Le micro, la caméra physique et un appel entre deux appareils restent à vérifier sur les appareils du propriétaire ; leurs tests de cycle de vie passent.

Les 10 personnages, 11 éditions pays, 5 films et accessoires existants sont préservés. Captures : `beyboo-produit-site-20261104.jpg`, `beyboo-produit-mobile-20261104.jpg`.
