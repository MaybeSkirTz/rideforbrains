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
