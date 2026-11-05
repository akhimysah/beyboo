# BEYBOO — arrivée et clipsage, 4 novembre 2026

La face avant du module est désormais la vue initiale. Le dos avec grille audio reste accessible par son onglet. L’ouverture de l’URL racine revient à l’accueil ; les liens vers les sections sont conservés.

Le nouveau bouquet réunit Noah, Élya, Sana, Izan et Léa. Une animation d’entrée de 3,8 secondes déplace l’image entière avant de la laisser immobile. Aucun membre, tête ou bouche n’est animé. Le bouton permet de rejouer l’arrivée. Le réglage système de réduction des animations est respecté.

La séquence de clipsage est une nouvelle photographie conceptuelle en trois vues horizontales, avec une main guidant le module. Sur mobile, les vues défilent horizontalement, avec boutons d’étape et défilement tactile. La planche complète est accessible dans la galerie. Les textes restent en HTML pour être accessibles et lisibles.

## Assets

- `dist/assets/studio/hero-bouquet.webp`, dérivé PNG sans modification visuelle, transparence conservée.
- `dist/assets/studio/clip-sequence-v2.webp`, dérivé PNG sans modification visuelle.

Images réalisées avec le générateur d’images intégré, à partir des portraits et du module existants. Les prompts exacts sont conservés dans `arrival-image-prompts.json`. Les images précédentes sont conservées.

## Direction visuelle complémentaire

À la demande de plus de peps, touches bleu électrique et irisées, fonds pastel sur les collections, accents propres aux sections, boutons lumineux et contours colorés au survol. La base blanche, la marque et les photographies restent préservées. Les corps des peluches ne sont pas animés au survol.

## Vérification

Syntaxe JavaScript et espaces du diff : contrôlés. Aucun identifiant HTML dupliqué ni référence locale manquante. Navigateur : accueil à la racine en haut de page, arrivée puis arrêt à 3,8 s, replay, face avant par défaut, passage au dos puis retour à l’œil, nouvelle séquence agrandie. Contrôle des dispositions mobiles dans des fenêtres intégrées de 390 et 320 px : pas de débordement horizontal ni chevauchement des boutons. Étape 3 accessible par défilement horizontal sur mobile. Les règles de réduction des mouvements sont présentes en CSS et en JavaScript.
