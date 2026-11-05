# Compagnon personnel — 4 novembre 2026

La démo du site et de l’application propose les dix personnages en peluche entière. Le changement met à jour le portrait, la texture de l’iris, la géométrie de l’écran, le prénom, l’histoire et le profil vocal. Alya et Aaron conservent les identifiants techniques elya et liam pour la compatibilité.

La sélection et une voix indépendante par personnage sont enregistrées localement sous beyboo-companion-v1. Aucun nouveau compte ni stockage serveur. Le profil personnel et la composition enregistrée restent inchangés. En cas de stockage indisponible, la sélection fonctionne pour la visite et un message explique la limite.

Un seul écran actif est conservé. La photo n’est jamais animée. Le changement de personnage termine l’échange vocal actif, coupe le suivi actif et réinitialise l’activité avant d’appliquer le nouveau portrait chargé. Les chargements dépassés, annulés et échoués ne peuvent pas remplacer le personnage courant. Aucune permission ni session payante au changement de personnage.

## Validation

- 66 tests Node réussis, dont six sur les préférences, l’isolement des voix, les données invalides, le stockage refusé et les courses de chargement.
- Chrome, démo locale : Alya + Lili, Aaron + Cosmo, rechargement et retour à Alya vérifiés.
- Histoire d’Alya, vidéo dans l’œil d’Aaron, pause et nettoyage lors du changement de personnage vérifiés.
- Clavier de profil et loupe ouverts puis retour au regard vérifiés.
- Site vitrine et application partagent le choix ; aperçu mobile à 390 × 844 et grille de sélection vérifiés, dont Sana.
- Géométrie des 14 portraits (10 personnages et 4 variantes) calibrée et inspectée. Corps sans animation ni transformation ; vidéo contenue dans l’œil.
- Aucun appel vocal payant, micro ou caméra activé pendant ces essais. Les services externes ne sont pas revalidés de bout en bout dans cette livraison.

Capture réelle de la démo : companion-choice-20261104.jpg.
