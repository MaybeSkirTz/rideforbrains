# Déploiement et services externes

## Cloudflare

Le compte Cloudflare de Thomas existe, mais aucune ressource distante n’a été créée par cette session. Le dépôt est prévu pour un Worker avec ressources statiques et une base D1. Aucun abonnement payant n’est activé automatiquement.

**Première publication : suivre le [guide pas à pas](DEMARRAGE-PAS-A-PAS.md).** Il remplace l’ancienne procédure manuelle. Après `npm ci` et `npx wrangler login`, `npm run cloudflare:database` relie la base existante ou la crée si elle manque, puis configure sa connexion `DB`. `npm run deploy` vérifie et compile le projet, applique les migrations, publie le vrai Worker, récupère son adresse et crée le secret de connexion uniquement s’il n’existe pas. Aucun modèle Hello World n’est nécessaire. La configuration initiale ne contient plus de base fictive ni d’ancien identifiant à réutiliser.

Le secret est fourni au CLI sur son entrée standard, jamais dans les arguments ni dans Git. Les services externes sont configurés séparément selon les sections suivantes. Les procédures GitHub Actions ci-dessous restent une option avancée pour une automatisation ultérieure; elles ne sont pas nécessaires au premier déploiement par PowerShell.

Secrets/configuration à prévoir : `BETTER_AUTH_SECRET` (au moins 32 octets aléatoires), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `MAIL_FROM`, `RESEND_WEBHOOK_SECRET`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_SITE_KEY`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`. Les valeurs publiques comme les identifiants Turnstile peuvent être des variables Workers; les clés API et secrets restent des secrets.

Le schéma n’inclut aucun faux participant, aucun administrateur automatique, aucun code promotionnel public. Les données du développement sont dans un autre stockage. Ne pas importer `work/runtime/d1` en production.

### Protection de l’administration et premier compte

Créer une application Cloudflare Access couvrant **`/admin` et `/api/admin/*`**, avec une politique limitée aux membres de l’organisation et une identité exigeant une authentification à facteurs multiples. **Ne pas protéger tout le domaine**, qui doit rester accessible aux participants et à Stripe. La simple réception d’un courriel Access n’est pas une preuve de MFA : configurer le fournisseur d’identité et la politique correspondants, puis les tester.

Définir `ACCESS_TEAM_DOMAIN` (ex. `votre-equipe.cloudflareaccess.com`) et `ACCESS_AUD` de cette application. Le Worker vérifie la signature JWT, l’émetteur, l’audience, l’expiration, le courriel et les permissions D1 pour chaque action administrative. Le courriel Access doit correspondre à celui du compte participant.

Se connecter sur `/connexion` et vérifier son courriel, puis, depuis un terminal autorisé sur la bonne base :

```powershell
npm run admin -- --email thomasberu0104@hotmail.com --remote
```

Vérifier que la sortie montre une ligne `admin`. Si elle est vide, aucun compte vérifié ne correspond. La commande utilise `wrangler.json` : vérifier son identifiant D1 avant de l’exécuter. Cette capacité provient de l’accès direct de l’opérateur à D1; elle ne doit pas être exposée par une API publique.

### GitHub

Le dépôt cible est [MaybeSkirTz/rideforbrains](https://github.com/MaybeSkirTz/rideforbrains). Le workflow `ci.yml` lance les vérifications à chaque push/PR. `deploy.yml` se lance **manuellement**, dans l’environnement GitHub `production`. Configurer des protections/approbations d’environnement selon l’équipe.

Dans cet environnement GitHub, créer les secrets `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID`, puis les variables `CLOUDFLARE_D1_DATABASE_ID` et `APP_URL`. Restreindre le jeton au compte et aux droits Workers/D1 nécessaires. Les secrets applicatifs Stripe/Resend sont installés directement dans Workers; ils ne sont pas copiés dans les builds GitHub. Le workflow applique les migrations puis déploie, sans créer de plan payant.

## Stripe Checkout

Créer et vérifier le compte Stripe de l’organisation; renseigner son bénéficiaire et les informations requises par Stripe. Le choix de Stripe reste à confirmer par Thomas. Aucune clé n’a été fournie et aucun vrai paiement test Stripe n’a été réalisé dans cette session.

1. Dans l’environnement **test** de Stripe, créer une clé secrète `sk_test_…`.
2. Définir cette clé dans `.dev.vars` localement ou dans Workers. Le serveur local interdit explicitement les clés `sk_live_…`.
3. Ajouter le webhook `/api/webhooks/stripe` avec les événements : `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `refund.created`, `refund.updated`, `refund.failed`, `charge.refunded`.
4. Installer le secret de signature `whsec_…`. Localement, utiliser le Stripe CLI : `stripe listen --all-snapshot --forward-to http://localhost:8787/api/webhooks/stripe`, puis installer **son** secret de signature local.
5. Tester une inscription complète sur Checkout avec les cartes test de Stripe : paiement réussi, carte refusée, authentification bancaire, abandon et remboursement. Ne jamais utiliser une vraie carte pendant ces essais.
6. Vérifier le dossier et l’événement dans Stripe, puis dans `/admin`. Un retour à `/espace?commande=…` n’est pas une preuve de paiement.

Les montants sont calculés en centimes CAD sur le serveur, après lecture du tarif et du code promotionnel D1. La réservation dure 35 minutes. La première création de session Checkout doit avoir lieu dans les quatre premières minutes pour respecter la durée minimale imposée par Stripe. Une session déjà créée peut être reprise jusqu’à son expiration.

La signature est vérifiée sur le corps brut. La session est ensuite relue chez Stripe : identifiant, référence de commande, montant, devise et paiement réussi doivent correspondre. Les événements sont idempotents. Un paiement tardif tente de confirmer les places atomiquement; si le quota ou la limite du code est atteint, le dossier devient `paid_review`, sans billet valide. L’organisation doit alors le résoudre ou le rembourser depuis la fiche.

Les remboursements créent un travail durable, avec une clé d’idempotence Stripe stable. Un statut « en traitement » ne signifie pas « remboursé ». Le statut final vient du prestataire. Les cas ambigus dépassant 23 heures sont placés en révision afin d’éviter de réémettre une opération au-delà de la fenêtre de déduplication. Vérifier Stripe avant toute résolution manuelle.

Les frais Stripe sont supportés par l’organisation dans cette version; aucun frais supplémentaire n’est ajouté au participant. Le traitement fiscal est volontairement **à valider**. L’application propose « taxes incluses » ou « non applicables » après validation; elle ne calcule pas une ventilation TPS/TVQ. Si une ventilation comptable ou des taxes ajoutées sont nécessaires, elles doivent être implémentées avant ouverture.

Passer à des clés réelles exige `PAYMENTS_MODE=live`, les services configurés, un lieu, la fiscalité validée et les validations des textes et marques. Effectuer cette étape seulement après les essais et l’accord explicite de l’organisation.

Références officielles : [fonctionnement des webhooks](https://docs.stripe.com/events/manage-webhook-endpoints), [Stripe Checkout](https://docs.stripe.com/checkout/fulfillment).

## Courriels Resend

Créer le compte et vérifier un domaine appartenant à l’organisation. L’adresse Hotmail fournie reste l’adresse de contact; elle ne permet pas de configurer SPF/DKIM pour `hotmail.com`. Choisir un domaine et une adresse d’expédition vérifiables avant l’envoi externe.

Ajouter les enregistrements SPF et DKIM demandés par Resend. Mettre en place DMARC sur le domaine, puis contrôler les résultats d’authentification et la réputation avant d’en durcir la politique. Installer `RESEND_API_KEY` et `MAIL_FROM`, puis le webhook `/api/webhooks/resend` et son `RESEND_WEBHOOK_SECRET` pour les événements de livraison, rejet et plainte. Les signatures sont vérifiées par Svix.

Le cron Workers tourne toutes les cinq minutes : expiration des réservations, nettoyage des sessions expirées, traitement des remboursements et des courriels. Les codes de connexion sont prioritaires et déclenchent immédiatement un passage du traitement des courriels. La file applique des baux, des reprises avec délai et des clés de déduplication. Par défaut, le code limite les envois à 90 par jour pour garder une marge sous le plafond gratuit de Resend. Les messages attendent en file lorsque ce budget est atteint; cela peut empêcher une connexion rapide lors d’une pointe. Dimensionner le service avant d’ouvrir les inscriptions.

« Accepté par le service » signifie que Resend a fourni un identifiant. « Livré » exige un événement signé de livraison. La lecture n’est pas suivie. Le mode local conserve les messages sans les transmettre. Les messages marketing filtrent les consentements et les désabonnements, et incluent un lien personnel de désabonnement.

## Sauvegarde et restauration

Avant une migration distante, exporter D1 avec `npx wrangler d1 export DB --remote --output=backup-AAAA-MM-JJ.sql`. Le fichier contient des données personnelles : le stocker dans un emplacement privé chiffré; ne pas le committer et ne pas l’envoyer dans une conversation publique.

Tester la restauration vers **une nouvelle base de validation**, via `wrangler d1 execute <nouvelle-base> --remote --file=<sauvegarde.sql>`, vérifier l’intégrité et les dossiers, puis seulement planifier une bascule. D1 propose aussi Time Travel selon le plan, dont la fenêtre doit être vérifiée dans le compte. Aucune restauration de production n’a été exécutée ici.

La politique de conservation des inscriptions et la suppression opérationnelle restent à valider. Le participant peut exporter ses données et transmettre une demande de suppression au responsable. Le système ne prétend pas supprimer automatiquement les informations qu’il peut être nécessaire de conserver.
