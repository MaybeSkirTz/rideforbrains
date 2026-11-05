# Paiement bloqué avant l’ouverture de Stripe

## Constats du 1er novembre 2026

Le site public annonce un environnement de production et des paiements réels. Le tarif de la course de 2 km lu dans sa configuration publique est de 498 centimes CAD; ce correctif conserve les prix enregistrés. Thomas indique ne trouver aucune requête correspondante vers `/v1/checkout/sessions` dans les logs Stripe réels. Il confirme avoir installé une clé `sk_live_` dans Cloudflare; la réponse publique confirme le mode `live` du Worker.

L’hypothèse initiale d’une clé de test avec un site en mode réel n’est donc pas confirmée. Une valeur mal copiée, une clé refusée, une erreur de connexion ou un autre compte Stripe peuvent expliquer l’absence de requête dans le compte consulté. La valeur des secrets Cloudflare n’est pas lisible depuis les outils; leur présence seule ne confirme pas leur validité. Ne pas remplacer une clé réelle à l’aveugle : publier d’abord le diagnostic, puis examiner le code et l’éventuel identifiant de requête Stripe dans les journaux privés.

## Vérifier la configuration du site public

1. Ouvrir **Stripe**, sélectionner le bon compte **Ride For Brains**, puis quitter le sandbox/mode test pour consulter le compte réel.
2. Dans **Développeurs → Clés API**, retrouver la **clé secrète réelle**. Son préfixe est `sk_live_` (ou `rk_live_` pour une clé restreinte avec les permissions nécessaires). Une clé `pk_` est publique; une clé `sk_test_` appartient aux essais.
3. Dans **Cloudflare → Workers & Pages → ride-for-brains → Settings/Paramètres → Variables and Secrets/Variables et secrets**, vérifier `PAYMENTS_MODE=live`. Si la clé utilisée n’est pas celle du bon compte réel, modifier **STRIPE_SECRET_KEY**, de type **Secret**, et y coller la clé secrète réelle directement depuis Stripe. Enregistrer les changements avec le bouton proposé par Cloudflare. Ne jamais transmettre cette valeur dans une conversation, un journal ou GitHub.
4. Vérifier également que le webhook **réel** du même compte Stripe cible `https://rideforbrains.ca/api/webhooks/stripe`. Son secret de signature `whsec_…` doit correspondre à **STRIPE_WEBHOOK_SECRET** dans ce Worker. Un secret du CLI local ou d’un webhook de test ne convient pas au webhook réel.

Ne pas basculer simplement le site public en mode test : il possède déjà ses propres commandes et services réels. Pour essayer une carte fictive, utiliser un environnement séparé avec ses clés et son webhook de test, son Worker et sa base de données distincts. Aucun paiement ou remboursement réel n’a été déclenché pendant ce diagnostic.

## Correctif local préparé

- Le serveur distingue les clés absentes, publiques, de test et réelles, y compris les clés restreintes. Une incompatibilité est rejetée avant de réserver des places, des utilisations de code promo ou de consommer une autorisation parentale.
- Dans l’administration, **Vue d’ensemble → État de production** affiche le problème de format ou de mode sans exposer la clé. L’état « prêt » de ce contrôle signifie seulement que le format et le mode concordent; il ne vérifie pas à distance la validité de la clé, ses permissions ou le compte Stripe associé.
- Les erreurs de configuration ou de Stripe renvoient un message compréhensible et une référence. Les journaux privés Cloudflare conservent le code de diagnostic et, lorsqu’il existe, l’identifiant de requête Stripe. Ils ne recopient pas le message brut du prestataire, susceptible de contenir une clé ou des données personnelles.
- Les nouvelles réservations durent 60 minutes. Le premier lancement de Stripe dispose donc d’environ 29 minutes au lieu de quatre. L’échéance de réservation et celle de Stripe restent identiques, ainsi que les paramètres de reprise et la clé d’idempotence. Le montant transmis reste celui enregistré après rabais.

Ces changements locaux doivent être publiés pour modifier le site en ligne. Ils ne remplacent aucun secret et ne réécrivent aucune commande existante. Une ancienne réservation bloquée par le délai doit expirer avant de recommencer; ne pas la prolonger manuellement pour contourner le garde-fou.

Stripe impose une expiration Checkout entre 30 minutes et 24 heures : [documentation officielle de création d’une session](https://docs.stripe.com/api/checkout/sessions/create).

## Après publication

Vérifier d’abord l’état de production dans l’administration. Si la configuration est compatible mais que l’ouverture de Stripe échoue encore, retrouver la référence affichée dans les journaux privés du Worker et rechercher l’identifiant Stripe correspondant dans **Workbench → Logs** du même compte et du même mode. Cela permet de distinguer une clé refusée, des permissions insuffisantes et un paramètre invalide sans multiplier les commandes ni partager de secret.

## Paiement reçu dans Stripe, commande toujours en attente

Diagnostic confirmé le 1er novembre 2026 : la capture Stripe montre une destination `https://rideforbrains.ca/api/stripe/webhook` et un échec 403 « Origine de la requête refusée ». Ce chemin n’est pas le webhook du site. Les vérifications HTTP sans signature reproduisent ce 403 à l’adresse erronée et atteignent bien le contrôle de signature à l’adresse correcte `/api/webhooks/stripe`. Elles ne valident pas la valeur du secret de signature.

Dans la destination Stripe existante, cliquer **Edit destination**, remplacer uniquement l’URL par `https://rideforbrains.ca/api/webhooks/stripe`, puis enregistrer. Conserver la destination et son secret, sans recréer de paiement. Sur l’événement `checkout.session.completed` déjà en échec, cliquer **Resend**. Un succès HTTP 200 indique que le site a traité l’événement; actualiser ensuite le dossier. Si le nouvel envoi indique 400 « Signature Stripe invalide », vérifier que **STRIPE_WEBHOOK_SECRET** dans le Worker correspond au secret `whsec_…` de cette destination réelle, et non à celui du CLI ou du sandbox.

La vérification D1 effectuée pendant ce diagnostic était en lecture seule : commande de 498 centimes en attente avec session Stripe, sans paiement rapproché ni événement Stripe traité. Aucun statut n’a été forcé en base, aucun remboursement n’a été déclenché et les protections Cloudflare n’ont pas été désactivées.
