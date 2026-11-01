# Accueil, codes promo, participants et courriels

## Mettre cette version en ligne

Suivre [la mise à jour du site existant](MISE-A-JOUR-SITE-EXISTANT.md), puis exécuter `npm run deploy` dans le dossier du projet. Le Worker `ride-for-brains`, D1, R2, Stripe, Resend, le domaine et les secrets existants sont réutilisés. Aucun nouveau compte ni service n’est nécessaire. Le travail local ne remplace la version en ligne qu’après publication.

La migration `0010_participants_promos.sql` ajoute le suivi durable des utilisations de codes et le consentement à la liste publique. Les données et conditions des commandes existantes restent conservées. Les noms existants restent privés par défaut.

## Accueil simplifié

L’accueil contient trois sections : la présentation avec le cerveau animé, le choix entre vélo/course/marche, puis les informations clés du rendez-vous. Les longs développements sur la cause, l’histoire, l’équipe, les partenaires et les animations secondaires ont été retirés de cette page. Les souvenirs et les albums du départ/de l’arrivée sont accessibles dans **Notre histoire**. Aucun réglage de photo n’a été supprimé.

Les pages La cause, Infos pratiques, Notre histoire, partenaires et bénévolat restent accessibles. Le grand appel à l’inscription du pied de page n’est plus répété sur l’accueil.

## Codes promo

Dans Événement → Codes promotionnels, **Codes actifs** et **Codes terminés** sont séparés. La table affiche les utilisations, la limite et le statut réel. Un code définitivement consommé à sa limite est désactivé et archivé automatiquement. Les codes déjà consommés sont repris lors de la migration. Le tableau se met à jour toutes les trente secondes pendant que la page est visible, sans recharger les autres réglages en cours d’édition.

Une commande en attente peut réserver une utilisation jusqu’à expiration; elle ne consomme pas définitivement le code. Un remboursement ou un retrait administratif ne rend pas disponible un code déjà consommé. Le suivi d’utilisation reste privé, même quand la commande quitte les statistiques publiques de l’événement. Pour réutiliser volontairement un code épuisé, augmenter explicitement sa limite puis le réactiver. Les anciennes utilisations ne sont pas effacées.

## Liste publique par activité

Le lien **Les participants** ouvre `/participants`. Chaque activité dispose de son décompte de participations confirmées et de sa liste de noms autorisés. Les noms sont affichés par lots de quarante avec « Voir plus de participants ». Les participations en attente, annulées ou retirées sont exclues.

Le prénom et l’initiale du nom apparaissent seulement avec un consentement facultatif, distinct des photos et du marketing. Aucun courriel, téléphone, âge, billet ou numéro de commande n’est publié. Les anciennes inscriptions ne sont pas publiées automatiquement : un adulte peut donner son accord depuis son espace participant. Le nom peut être retiré depuis cet espace.

Pour un mineur, le choix d’affichage doit figurer dans la demande autorisée par son parent. Le modifier avant la réservation invalide l’autorisation précédente. Après inscription, l’enfant peut retirer son affichage; il ne peut pas l’activer seul. Un changement d’identité ou un transfert ne conserve pas le consentement de la personne précédente.

## Accorder les accès à l’équipe sans ajouter chaque personne dans Cloudflare

1. La personne crée un compte du site avec prénom, nom, mot de passe et code courriel.
2. L’administrateur principal ouvre **Équipe et accès**, choisit **Organisateur** ou **Bénévole d’accueil**, puis les permissions nécessaires.
3. La personne ouvre **Mon espace → Espace équipe**, ou `/organisation`. Son mot de passe et le code courriel du site suffisent. Une nouvelle vérification est demandée après huit heures; la case « Se souvenir de moi » peut toujours conserver la session participant plus longtemps.

Les outils de l’équipe utilisent `/api/organisation/*`. Chaque requête vérifie la session, l’authentification par mot de passe et code, le rôle et les permissions courantes en base. Une permission retirée est refusée à la requête suivante. Le serveur n’accepte aucun en-tête permettant de simuler ce contrôle.

L’administration principale, la gestion des accès, le journal d’audit et le retrait privé des commandes restent sur `/admin` et `/api/admin/*`, protégés par Cloudflare Access. Le rôle « Administrateur principal » reste explicitement soumis à cette protection; pour déléguer les opérations courantes sans gestion Cloudflare, choisir « Organisateur » avec les permissions voulues. Ces fonctions réservées ne sont pas montées dans l’API équipe.

Conserver l’application Access sur `/admin` et `/api/admin/*`. Ne pas l’étendre à `/organisation`, `/api/organisation/*` ou à tout le domaine. Un ancien favori pointant vers `/admin` doit être remplacé par l’espace équipe pour un organisateur ou bénévole. [Cloudflare décrit comment les chemins définissent les applications protégées](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/).

## Retirer les accès d’un membre

Dans **Administration → Équipe et accès**, cliquer **Retirer les accès** sur la ligne de la personne et confirmer. Cette action retire son rôle et toutes ses permissions d’équipe, même si cette personne est administrateur. Le compte participant, ses inscriptions et sa session participant restent disponibles. Le retrait est visible dans le journal d’audit et prend effet à la prochaine requête protégée.

Votre propre accès reste protégé. Deux administrateurs qui tentent de se retirer mutuellement ne peuvent pas supprimer leurs deux rôles. Les anciennes autorisations de synchronisation des billets hors ligne sont invalidées, même si des droits sont accordés de nouveau plus tard. Des données déjà téléchargées sur un appareil ne peuvent pas être effacées à distance par ce bouton.

Cette action modifie les droits du site. Elle ne supprime pas une éventuelle autorisation Cloudflare externe; celle-ci ne suffit plus à accéder à l’administration sans rôle sur le site.

## Confirmation de commande restée en file

Le diagnostic en lecture seule du 31 octobre 2026 a trouvé une confirmation en attente avec **zéro tentative**, sans erreur Resend. Le cron de production était bien configuré sur `*/5 * * * *`. Cela ne permet pas d’affirmer à lui seul pourquoi cette exécution n’avait pas traité le message.

La version précédente ne déclenchait pas le traitement des courriels lors d’une inscription gratuite, après le webhook de paiement ni lors du rappel manuel. Elle attendait le cron. De plus, les opérations Stripe précédaient le traitement des courriels : leur échec pouvait le bloquer.

Cette version déclenche le traitement de la file après les confirmations gratuites, les paiements validés par webhook et les rappels. Les tâches périodiques sont indépendantes : une erreur Stripe ou de nettoyage n’empêche plus la tâche courriel. Le cron reste le mécanisme de reprise.

Après publication, ouvrir **Communications → Journal des courriels → Traiter la file existante**, puis actualiser. Ce bouton traite les messages déjà en attente avec leurs identifiants de déduplication existants; il ne recrée pas de confirmation. Les messages programmés pour plus tard ne sont pas avancés. Le traitement est borné à dix messages par passage, avec priorité aux codes de connexion. Les erreurs, délais de reprise et plafonds d’envoi restent respectés.

« Accepté par le service » signifie que Resend a accepté le message; « Livré » nécessite son webhook de livraison. Un message en état « À rapprocher » n’est pas renvoyé automatiquement après dépassement de la fenêtre de déduplication. Éviter de cliquer plusieurs fois sur « Renvoyer la confirmation », qui représente un nouveau rappel, pour débloquer une file existante.

Les diagnostics n’ont envoyé, recréé ou supprimé aucun courriel de production. Les essais d’envoi utilisent des prestataires simulés et des adresses fictives. Le nouveau déclenchement et le bouton deviennent disponibles après déploiement.
