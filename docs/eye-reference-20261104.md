# Regard inspiré de la vidéo de référence — 4 novembre 2026

La vidéo fournie (10,0167 s, 512 × 778, 30 images/s) montre un iris bleu qui regarde à droite, découvre un croissant blanc à gauche, marque une pause, puis revient vers le centre. Le blanc est une surface de l'œil exposée par le déplacement de l'iris, pas un anneau lumineux qui tourne.

## Réalisation

- Sclère nacrée fixe, iris texturé indépendant et reflet de verre dans le disque de l'écran. La texture utilise un cadrage SVG de la photographie existante, sans nouveau visuel de peluche.
- Correction demandée après le premier aperçu : le blanc reste largement visible au repos. Le diamètre de l'iris passe de 94 % à 64 % du globe, entouré de 18 % de blanc de chaque côté ; les ombres sont allégées. Le même rendu est utilisé dans le mode caméra de suivi. La pupille reste noire au centre de l'iris bleu, conformément à l'apparence d'un œil humain.
- Aucun déplacement de la photographie, du corps, de la tête, des membres, du sourire cousu, des cils ou de la bordure matérielle. Seuls les pixels de l'écran changent.
- Une séquence explicite de 10 secondes reproduit les directions, pauses et retours de la référence. Bouton « Voir le mouvement de l'œil », sans micro, caméra ni appel API. La peluche revient dans le champ au lancement, y compris après une activité.
- Au repos : petites fixations espacées. Le suivi local du visage prend la priorité sur cette animation, y compris pendant la demande de permission. Le déplacement réel découvre le même blanc, avec une amplitude bornée.
- Le signal sonore réel continue à agir sur la pupille et le reflet. Les vidéos et autres activités remplacent le regard dans le même écran circulaire.
- Le mode mouvement réduit supprime les déplacements autonomes ; la démonstration explicitement demandée et le suivi du visage restent disponibles. Le changement d'activité, la conversation et la mise en arrière-plan interrompent la démonstration.

## Vérification

- 55 tests Node réussis, dont six tests de signal audio, déplacement/maintien/retour de la référence, priorité du suivi, annulation, fixations et mouvement réduit.
- Contrôle navigateur du produit entier, de la loupe, de la commande d'animation et du passage vidéo → regard.
- Contrôle des mises en page de l'application à 390 et 320 pixels : peluche entière, disque aligné et commandes accessibles.
- Micro/caméra physiques et service OpenAI non utilisés pendant cette vérification visuelle. Leur code serveur et leur configuration ne sont pas modifiés. Les interactions correspondantes sont couvertes par les tests existants.

Captures de vérification : `beyboo-eye-reference-product.jpg`, `beyboo-eye-reference-mobile.jpg`.
