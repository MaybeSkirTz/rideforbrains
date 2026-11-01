# Vérifications de la refonte 2027

## Campagne du 1er novembre 2026

**146 tests réussis, zéro échec et zéro test ignoré**, après une référence de 129 tests avant modification. TypeScript, build client/Worker, préparation Wrangler sans publication et audit npm (zéro vulnérabilité) réussis. La [livraison actuelle](LIVRAISON-NOVEMBRE-2026.md) décrit les nouveaux contrats, la recette mobile/ordinateur, la migration additive, les limites matérielles et la checklist. [Résultats détaillés](TEST-RESULTS.txt).

Les sections suivantes conservent l’historique des campagnes précédentes; leurs nombres et captures correspondent à leur date.

La première refonte et ses mesures sont décrites dans [AUDIT-2027.md](AUDIT-2027.md). Les résultats synthétiques actuels sont dans [TEST-RESULTS.txt](TEST-RESULTS.txt). Les prestataires sont simulés; les tests ne prouvent pas une transaction réelle, une livraison à Hotmail ou une lecture caméra sur téléphone physique.

## Campagne précédente : accueil, promotions, liste publique, équipe et courriels

Les **129 tests passent**. La migration archive les anciens codes consommés, distingue les réservations temporaires et conserve une utilisation après remboursement ou retrait. Les listes publiques ne renvoient que les noms autorisés et confirmés, avec consentement parental lié au choix exact pour un mineur. Les coordonnées, identifiants de dossier et billets restent privés; les changements d’identité et transferts ne recyclent pas le consentement d’une autre personne.

Deux contrats cartographiques vérifient la conservation des coordonnées GPX (ordre géographique, aller-retour et points répétés), sans déplacement ni recalcul de route, et le refus d’un tracé absent ou invalide sans parcours de remplacement. Le fond OpenStreetMap se cadre depuis les coordonnées du parcours. Voir [le fonctionnement des cartes](CARTES-GPX.md).

La recette navigateur des cartes reprend les cinq GPX publics : fond et tracé vélo sur ordinateur, zoom et recentrage de la course 5 km à 390 px, chargement des parcours 10 km, 2 km et marche 5 km. Aucune page testée ne déborde horizontalement. Le bouton mobile ouvre bien les choix Créer mon compte et Me connecter sans ouvrir le menu. Captures : [carte vélo](previews/carte-gpx-velo.png), [course sur mobile](previews/carte-gpx-course-mobile.png), [bouton de connexion mobile](previews/connexion-entete-mobile.png).

Les quatre contrats ajoutés pour le retrait des accès couvrent tous les rôles, y compris un autre administrateur; le maintien du compte, des inscriptions et de la session participant; les refus sans droit principal ou confirmation; l’interdiction de se retirer soi-même; l’audit et les appels répétés; l’invalidation des listes de secours après retrait et réattribution; deux administrateurs tentant simultanément de se retirer mutuellement. La recette navigateur avec deux comptes fictifs vérifie le bouton, la confirmation et la disparition de la ligne, sans modification d’accès en production. Captures : [bouton de retrait](previews/retrait-acces-equipe.png), [retrait confirmé](previews/retrait-acces-confirme.png).

L’espace équipe est testé avec une vraie session par mot de passe et code, sans jeton Access, y compris en configuration de production simulée. Les permissions sont relues en base et une révocation prend effet à la prochaine requête. La vérification de plus de huit heures est refusée. Les routes réservées à la gestion des accès, à l’audit et aux retraits privés ne sont pas exposées sur cet espace. Les protections Access de l’administration principale restent testées séparément.

Les tests de courriel vérifient le déclenchement après inscription gratuite, le paiement validé par webhook, le rappel et le traitement de la file existante. Un webhook répété ne crée ni double confirmation ni deuxième envoi. Une erreur de maintenance Stripe intentionnelle n’empêche pas la confirmation d’être acceptée par le faux prestataire. Aucune livraison réelle n’est déclarée à partir d’une simple acceptation.

La recette navigateur locale utilise cinquante participations fictives, dont quarante-trois noms autorisés : sélection d’activité, quarante premiers noms puis chargement des suivants; un code actif et deux codes épuisés répartis dans les bons onglets; connexion de l’organisateur et chargement des trente premiers dossiers avec les seuls outils autorisés. À 1280 et 390 px, l’accueil compte trois sections principales, sans débordement horizontal. Les mêmes données d’équipe chargent à 390 px après mot de passe et code dans l’onglet. Le nouvel accueil mesure environ 2700 px de haut sur ordinateur et 3276 px sur téléphone, pied de page compris. Captures : [accueil](previews/accueil-allege.jpg), [accueil mobile](previews/accueil-allege-mobile.jpg), [liste publique mobile](previews/participants-publics-mobile.jpg), [codes épuisés](previews/codes-epuises.jpg), [espace équipe mobile](previews/espace-equipe-mobile.jpg).

TypeScript, compilations et publication à blanc réussissent. La base, MEDIA, le domaine et le mode de paiement existants restent déclarés. Le diagnostic de production a uniquement lu les états de file, migrations et programmation du cron : aucune mutation D1, publication, transaction, relance ou livraison externe n’a été exécutée. Voir [le guide de mise à jour et de reprise de la file](EQUIPE-PARTICIPANTS-COURRIELS.md).

## Campagne précédente : parents, galerie et accès admin

Les **110 tests passent**. Ils couvrent les demandes et décisions depuis des comptes distincts, le refus de réserver ou payer sans accord, les refus/expirations, les changements de personne/activité/conditions/date et de choix de consentement, l’usage unique concurrent et l’atomicité du panier. La liste d’attente et les transferts ne permettent pas de contourner l’autorisation. La migration conserve les anciens comptes, dossiers, conditions et paramètres de services.

Les tests du client vérifient les redirections Access interrompues avant le saut CORS, les téléchargements protégés, l’absence de reprise automatique des mutations, la vraie navigation vers l’administration et le lien de réauthentification. Les tests serveur vérifient l’issuer, l’AUD et la signature du jeton, ainsi que le maintien des permissions et de la session du site. Les tests d’album vérifient la navigation circulaire et l’accès aux douze photos dans un seul cadre.

Recette navigateur locale sans clés de prestataires : connexion de l’enfant, formulaire mineur, blocage avant accord, demande conservée dans le brouillon, changement de compte, examen et accord par le parent, retour au compte enfant, brouillon restauré et confirmation gratuite fictive. L’administration charge ensuite ce dossier et sa preuve d’autorisation après une navigation complète, même avec une session limitée à l’onglet.

La galerie a été examinée à 1280 px et 390 px : douze visuels de démonstration accessibles, passage automatique après six secondes, pause, touches Début/Fin, boucle des flèches, miniatures horizontales, agrandissement et Échap. Hauteur mesurée avec douze visuels : 666 px sur ordinateur et environ 512 px sur téléphone; la scène photo mesure respectivement 480 et 280 px. Aucun débordement horizontal de la page. Captures : [galerie mobile](previews/galerie-mobile.jpg), [preuve d’autorisation dans l’admin](previews/autorisation-parentale-mobile.jpg).

TypeScript, compilation et publication à blanc (`wrangler deploy --dry-run`) réussissent. La base D1, le compartiment MEDIA, le domaine et le mode Stripe existants restent déclarés. Aucun déploiement réel, paiement, remboursement ou courriel externe n’a été exécuté. La réauthentification sur le compte Cloudflare réel et les appareils physiques restent à vérifier après publication. Voir [le fonctionnement détaillé](PARENTS-GALERIE-ACCES.md).

## Campagne précédente : connexion et photos

Les **88 tests passent**, y compris les anciens scénarios Stripe/inscriptions. La nouvelle campagne couvre le mot de passe et le code de vérification, la récupération des anciens comptes, les sessions temporaires et persistantes, les tentatives invalides/expirées/concurrentes, les routes de contournement fermées, la confidentialité des codes et l’enregistrement d’une photo R2. La recette navigateur et les limites de vérification sont détaillées dans [CONNEXION-ET-PHOTOS.md](CONNEXION-ET-PHOTOS.md).

## Campagne précédente : photos R2 et retrait des commandes

La campagne précédente comptait **79 tests réussis**. Les six nouveaux contrats vérifient : liaison R2 avec stockage/lecture WebP et permissions; retrait groupé après promotion de 25 % (3 × 15 $ → 33,75 $ remboursables); exclusion des listes/statistiques/exports/QR et conservation privée; confirmations dédupliquées à l’acheteur et à l’admin; refus sans rôle admin ou sans confirmation; politique figée de 15 jours et promotion gratuite; déduction d’un remboursement antérieur; blocage d’un remboursement à rapprocher; paiement tardif après retrait sans réactivation de billet ni double remboursement.

La migration incrémentale conserve les paramètres, les commandes, les participations et leurs conditions existantes. Les montants proviennent de la commande payée et non du tarif actuel de l’activité. Tous les prestataires des tests sont simulés, avec le réseau externe bloqué.

TypeScript, compilation et `wrangler deploy --dry-run` réussissent. Le dry-run déclare `DB`, `MEDIA (ride-for-brains-media)`, le domaine et le mode de paiement existants; il ne publie rien. Dans le navigateur, une base locale fictive sans clé Stripe/Resend a servi à vérifier le récapitulatif après rabais, le retrait des trois participations et le suivi privé. Captures : [confirmation](previews/retrait-commande.jpg), [suivi privé](previews/retrait-prive.jpg). Le parcours de téléversement HTTP est vérifié contre un compartiment Miniflare éphémère; aucune photo n’a été téléversée en production pour ces essais.

## Référence historique avant la refonte

# Vérifications

## Tests automatisés

Les tests tournent contre **Workerd + D1 via Miniflare**, par les véritables routes HTTP. Ils utilisent de vraies sessions Better Auth, de vrais liens à usage unique, les migrations de l’application, les contraintes SQL et des signatures de webhooks Stripe calculées sur le corps brut.

Les appels aux prestataires sont remplacés par des réponses HTTP explicites et toute autre sortie réseau est interdite. Il s’agit de tests d’intégration de l’application avec les contrats API; cela ne prouve pas qu’un compte Stripe test ou qu’un domaine Resend réel fonctionne.

La suite finale de **47 scénarios a réussi**, sans échec ni scénario ignoré : 36 scénarios d’application, 5 scénarios de publication et 6 scénarios de connexion D1. Elle couvre :

- les activités et paramètres fournis;
- la connexion, l’usage unique du lien et les accès sans session;
- une inscription gratuite et une confirmation locale;
- un paiement signé réussi, les doublons, la signature incorrecte, le montant incorrect et l’absence de confirmation depuis le navigateur;
- un abandon, un échec, les paiements tardifs avec ou sans place et les événements reçus dans un ordre différent;
- la concurrence sur la dernière place, l’atomicité d’un panier groupé, la création idempotente et la réduction de quota;
- les codes invalides, expirés, épuisés et à 100 %;
- les champs obligatoires, la majorité, les versions de formulaire et la non-conservation des réponses non déclarées;
- l’isolation des comptes et les permissions participant/organisateur/administrateur/bénévole;
- le scan d’un billet valide, déjà utilisé et l’annulation de présence autorisée;
- la conservation des formulaires et des politiques achetées après modification des réglages;
- les brouillons privés, les modèles partagés, la liste d’attente et les demandes de confidentialité;
- l’aperçu des courriels, le décompte, la confirmation de sélection, la déduplication, le marketing et le désabonnement;
- les erreurs d’envoi, la reprise avec la même clé et la distinction accepté/livré;
- les remboursements partiels et complets, le rapprochement par webhook et le traitement de la file de remboursement;
- les exports CSV et les demandes de contact/bénévolat.
- le chargement du statut de session anonyme avant configuration externe, la récupération automatique de l’URL réelle du Worker, la conservation d’un secret existant, le passage d’un nouveau secret uniquement par stdin et l’arrêt avant publication en cas de connexion D1 invalide ou de migration échouée.
- la réutilisation d’une base D1 existante sans création, la création uniquement après recherche, la répétition sans doublon, la conservation d’un autre identifiant déjà configuré, l’arrêt si la lecture du compte échoue et la concurrence entre deux créations.

Le résultat de la dernière exécution et les éventuels scénarios ajoutés sont disponibles dans `docs/TEST-RESULTS.txt` après validation finale.

## Compilation et dépendances

`npm run check` et la compilation du client ont réussi. Les bibliothèques de paiement et d’authentification ont été compilées et exécutées dans Workerd. `npm audit` ne signalait aucune vulnérabilité après les mises à jour des dépendances et des dépendances transitives concernées. Le fichier lock est fourni pour reproduire l’installation.

## Navigateur

L’interface a été réellement ouverte dans le navigateur intégré. Vérifications effectuées : accueil et scène 3D, navigation publique, connexion locale par courriel, accès à l’administration et aperçu du constructeur de formulaires. Le formulaire a été rempli avec des données fictives jusqu’au récapitulatif de 15 $; l’action de paiement a correctement affiché le refus explicite lié à l’absence de configuration Stripe, sans inscription confirmée ni prélèvement. Le format téléphone a été examiné à une largeur d’environ 390 px : typographie, menu repliable, CTA et disposition verticale. Le menu a été activé au clavier. Le débordement horizontal repéré sur l’accueil a été corrigé et les largeurs de contenu et de viewport sont identiques sur ordinateur et téléphone.

Les commandes locales d’administration et de migration ont aussi été exécutées : elles refusent de rouvrir la base pendant le fonctionnement du serveur et s’exécutent après son arrêt, afin de respecter le verrou SQLite de Workerd.

Les formulaires et les boutons disposent de labels, les erreurs sont annoncées via des régions d’alerte, le contenu principal reçoit le focus à la navigation, et un lien d’évitement est fourni. La 3D est désactivée pour `prefers-reduced-motion`, sans WebGL ou en cas d’échec d’initialisation; elle suspend le rendu hors écran. Cela ne remplace pas un audit d’accessibilité ou une vérification par lecteur d’écran.

## Vérifications externes restant à faire

- Stripe Checkout avec les cartes officielles de test, y compris l’authentification bancaire, les erreurs et le remboursement depuis le compte test.
- Livraison réelle Resend, DNS, rejets, plaintes et signatures de webhook dans le compte configuré.
- Cloudflare distant : limites CPU, quotas, cron, D1, Access, MFA et Turnstile.
- Appareils physiques iOS/Android, autorisation caméra et scan réel en conditions d’accueil.
- Réduction des mouvements activée au niveau du système, lecture d’écran, contrastes et navigation clavier exhaustive.
- Recette de charge et restauration d’une sauvegarde vers une base distincte.

Aucune transaction réelle, aucun remboursement réel et aucun courriel externe n’ont été exécutés pour ces tests.

La nouvelle commande de publication a été vérifiée avec un exécuteur de commandes contrôlé. Elle n’a pas encore été exécutée contre le compte Cloudflare de Thomas; la connexion, la création de ressource et le premier déploiement distant restent à faire dans son terminal.
