# BEYBOO — actions vocales et regard réactif

4 novembre 2026. Le corps de la peluche et le boîtier de l’écran restent fixes. Seuls les pixels de l’iris, le halo et le témoin sonore réagissent. Aucun enregistrement audio ajouté.

## Comportement

- Analyse du volume réel du microphone et du flux audio WebRTC de réponse. L’iris s’anime dans une fenêtre circulaire, le halo passe au turquoise pendant la parole de l’utilisateur et au violet pendant la réponse. Un état de secours reste visible si l’analyse audio n’est pas disponible. Les préférences de réduction des animations sont respectées.
- L’écran reste visible pendant le défilement de la conversation, y compris sur mobile. Le conteneur ne bloque plus le positionnement sticky.
- OpenAI Realtime reçoit un outil control_beyboo_screen. Le navigateur exécute sa commande et renvoie le résultat réel avant de demander la confirmation orale. Les appels répétés sont dédupliqués ; une intervention de l’utilisateur invalide une ancienne réponse.
- Vidéo locale Mission Lune, pause/reprise, musique originale, jeu d’étoiles tactile, calculs avec validation de la réponse prononcée ou touchée, illustration des histoires et retour à l’œil gardent la session vocale active.
- YouTube ouvre la sélection francophone ESA/Paxi ou une URL YouTube valide. Le lecteur reste rectangulaire et ses contrôles sont visibles. Lecture initiale sans son ; activation du son explicite. Le statut distingue chargement, lecture confirmée, pause, blocage et erreur. Lien externe et clip local de secours si la lecture n’est pas confirmée. Pour un autre sujet, recherche externe et collage du lien ; aucune recherche automatique de résultats n’est annoncée.
- La commande d’appel prépare seulement le passage à Jitsi. Elle n’appelle personne et ne partage aucun lien automatiquement.
- Les boutons de la conversation utilisent le même contrôleur que les commandes vocales, permettant aussi un essai sans démarrer le micro.

## Validation

15 tests Node passent : sécurité serveur, fermeture de session, erreurs de crédits, cycle de vie des appels Jitsi existants, exécution unique des outils, attente du résultat, interruption/annulation, analyse des échantillons audio et déconnexion des analyseurs. Les entrées du micro ne sont jamais reliées à la sortie haut-parleur.

Test réel du modèle gpt-realtime-2.1 avec la clé déjà autorisée : six requêtes écrites correctement routées vers play_video, pause_media, open_math, answer_math (12), open_youtube, show_eye. Les résultats d’écran renvoyés pendant ce test de routage étaient synthétiques ; ce test n’était pas une conversation complète micro/navigateur.

Prévisualisation navigateur : lecture effective du clip local (paused=false, readyState=4), pause effective, réponse fausse puis correcte à 7+5, collecte d’une étoile, image de Liam chargée, démarrage de la mélodie. Mobile 390/320 px sans dépassement horizontal. Un signal audio synthétique via MediaStream a confirmé le volume 0,640, l’iris et le halo dans le navigateur ; il n’était pas présenté comme un vrai utilisateur.

Le lecteur YouTube s’est chargé mais la lecture est restée en attente dans le navigateur de vérification ; elle n’est donc pas validée de bout en bout. Les états de blocage et les possibilités de repli sont prévus. Le site de production reste privé ; la vérification micro/commande/écran sur le téléphone du propriétaire est à effectuer sur la version publiée. L’utilisateur a confirmé que la conversation vocale précédente fonctionnait déjà.

Capture de l’interface réelle : beyboo-interactions-20261104.jpg. Toutes les pages temporaires de vérification sont supprimées avant publication.

## Essai sur téléphone

Actualiser la page, aller dans Parler avec BEYBOO, toucher Activer le micro et parler. Dire successivement : « Montre-moi une vidéo », « Pause », « Faisons des maths », « Douze », « Reviens à l’œil ». Pour YouTube : « Montre-moi une vidéo YouTube sur l’espace ». La latence dépend de la fin de phrase, d’OpenAI et du réseau ; aucune promesse de délai nul.

## Références officielles

- https://developers.openai.com/api/docs/guides/realtime-conversations
- https://developers.google.com/youtube/iframe_api_reference
- https://www.esa.int/kids/fr/Multimedia/Videos/Animations_Paxi/Le_systeme_solaire
