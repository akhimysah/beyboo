# Six usages BEYBOO — 4 novembre 2026

Intégration des six visuels approuvés par Hicham, immédiatement après l’accueil et le bandeau de principe, avant les détails du module.

- Nouvelle rubrique « Jouer. Apprendre. Garder le lien. », accessible depuis le menu « Les usages », l’annonce et le pied de page.
- Six cartes horizontales sans recadrage : YouTube / Izan, clavier téléphonique / Noah, appel à mamie / Liam, histoire / Sana, mathématiques / Élya, jeu de formes / Léa.
- Galerie commune : agrandissement haute résolution, navigation entre les six images, clavier et fermeture par Échap.
- Images WebP en deux tailles, chargement différé et dimensions réservées. Aucun mouvement ajouté aux peluches.
- Mentions de mises en scène conceptuelles et lien vers la démonstration existante.

## Vérifications

- Syntaxe des deux fichiers JavaScript modifiés ; git diff --check ; références locales et identifiants HTML.
- Navigateur desktop : 6 cartes, toutes les images chargées, aucune image recadrée, galerie 1/6 → 6/6 → 1/6, fermeture par Échap.
- Iframes de contrôle aux largeurs 390 et 320 px : une colonne, aucune largeur débordante, agrandissement et fermeture fonctionnels. Fichier de contrôle supprimé.
- Sections précédentes conservées : 10 personnages, 11 pays, 10 campagnes. Vue du module initiale : face avant.
- Capture : beyboo-six-usages-20261104.jpg.
