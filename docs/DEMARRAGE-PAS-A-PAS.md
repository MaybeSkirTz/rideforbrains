# Mettre Ride For Brains en ligne, de zéro

Ce guide remplace les premières instructions de publication. Il utilise **une seule méthode : PowerShell publie le vrai projet sur Cloudflare**. GitHub garde une copie du code. Aucune application de démonstration ne doit être créée à la main.

On avance dans l’ordre. Après chaque commande, attendre de revoir une ligne commençant par `PS`. Si un message rouge apparaît, s’arrêter à cette étape et conserver le message. Ne pas recréer une ressource pour tenter de contourner une erreur.

## Ce que chaque service fait

| Nom                                     | Son rôle                                             |
| --------------------------------------- | ---------------------------------------------------- |
| Le dossier `ride-for-brains` sur ton PC | Le projet que nous avons construit                   |
| GitHub                                  | La sauvegarde du code et son historique              |
| Cloudflare Worker                       | L’endroit où fonctionne le site public               |
| Cloudflare D1                           | Le cahier dans lequel sont enregistrés les dossiers  |
| Resend                                  | L’expédition des liens de connexion et confirmations |
| Stripe                                  | Les paiements par carte                              |

**Premier objectif : afficher le vrai site sur Internet, inscriptions fermées.** Ensuite viennent les courriels, l’administration et les paiements. Un nom de domaine personnalisé n’est pas nécessaire pour ce premier affichage.

## A. Envoyer la dernière version du code sur GitHub

Le code initial a été retrouvé dans `MaybeSkirTz/rideforbrains`. Les nouvelles commandes de ce guide sont préparées dans le dossier local ci-dessous.

1. Ouvrir GitHub Desktop.
2. Sélectionner le dépôt `rideforbrains` ou `ride-for-brains` correspondant à ce dossier :

```text
C:\Users\thoma\Documents\Codex\2026-10-29\j-ai-r-ussi-connecter-github\outputs\ride-for-brains
```

Si le dépôt n’apparaît pas dans GitHub Desktop : **File → Add local repository**, sélectionner ce dossier, puis **Add repository**. Si un avertissement de propriétaire Windows apparaît, l’exception doit être limitée à ce dossier connu.

3. Cliquer sur **Push origin** si le bouton est proposé. Les modifications préparées par l’assistant sont déjà enregistrées dans un commit local.
4. Ouvrir https://github.com/MaybeSkirTz/rideforbrains et vérifier que les dossiers `src`, `server`, `scripts` et `migrations` apparaissent.

**Résultat attendu : le code est visible sur GitHub.** Cette étape ne met pas encore le site en ligne.

## B. Ouvrir PowerShell dans le projet

1. Ouvrir le menu Démarrer de Windows.
2. Écrire `PowerShell`, puis ouvrir PowerShell.
3. Copier cette ligne, la coller dans la fenêtre et appuyer sur Entrée :

```powershell
cd "C:\Users\thoma\Documents\Codex\2026-10-29\j-ai-r-ussi-connecter-github\outputs\ride-for-brains"
```

4. Exécuter :

```powershell
npm ci
```

**Résultat attendu : l’installation se termine et la ligne `PS ...ride-for-brains>` revient.** Node.js existe déjà sur ce PC. Si PowerShell refuse `npm.ps1` à cause d’une politique d’exécution, utiliser `npm.cmd` à la place de `npm` et `npx.cmd` à la place de `npx`; il n’est pas nécessaire de désactiver une protection Windows.

Garder cette fenêtre ouverte pour les étapes suivantes.

## C. Autoriser l’ordinateur à utiliser le compte Cloudflare

Dans la même fenêtre :

```powershell
npx wrangler login
```

Un navigateur s’ouvre. Se connecter à Cloudflare et accepter la demande d’autorisation du programme Wrangler. Revenir ensuite à PowerShell.

**Résultat attendu : un message confirme la connexion.** Cette commande ne crée pas encore de site ni de base.

## D. Relier la base de données du site

Exécuter :

```powershell
npm run cloudflare:database
```

Cette commande cherche d’abord une base nommée exactement `ride-for-brains` dans ton compte Cloudflare. Si elle existe, elle la relie au projet. Si elle n’existe pas, elle la crée puis la relie. Elle renseigne automatiquement la connexion appelée `DB` dans `wrangler.json`, sans supprimer de données ni créer de doublon. Il n’y a aucun identifiant à copier et aucun lien à modifier à la main.

**Résultat attendu : « Base existante reliée au projet » ou « Base créée et reliée au projet », puis « Connexion DB prête ».** La commande peut être relancée sans recréer la base. Si une erreur d’accès au compte apparaît, s’arrêter et conserver le message.

## E. Publier le vrai site

Exécuter :

```powershell
npm run deploy
```

La commande prépare l’application, applique les tables à la base, envoie le vrai code sur Cloudflare, récupère son adresse et la renseigne automatiquement dans le projet. Elle crée également un secret aléatoire pour les sessions s’il n’existe pas; elle conserve un secret déjà présent. La valeur du secret n’est pas affichée ni enregistrée dans Git.

La première publication peut afficher deux passages de déploiement : le second sert à enregistrer l’adresse que Cloudflare vient d’attribuer. Il s’agit toujours du même vrai site `ride-for-brains`.

À la fin, chercher la ligne :

```text
Adresse de publication : https://ride-for-brains.…workers.dev
```

Ouvrir **l’adresse réellement affichée**, pas l’exemple ci-dessus.

**Résultat attendu : l’accueil Ride For Brains apparaît sur Internet.** Les inscriptions restent fermées. Les liens de connexion, les formulaires publics protégés, l’administration et les paiements demandent encore la configuration des services ci-dessous.

La première utilisation de Workers peut demander de choisir un sous-domaine de compte `workers.dev`. Si cette demande apparaît, choisir un nom disponible. Cela détermine une partie de l’adresse du site; cela ne crée pas une application de démonstration.

## F. Sauvegarder la configuration finale dans GitHub

La création de la base et la publication ont modifié `wrangler.json` sur le PC.

1. Revenir à GitHub Desktop.
2. Vérifier que le dépôt du site est sélectionné.
3. Dans **Summary**, écrire `Configurer le site Cloudflare`.
4. Cliquer sur **Commit to main**, puis **Push origin**.

**Résultat attendu : le code et sa configuration publique sont sauvegardés ensemble.** Les clés secrètes restent dans Cloudflare, pas dans ce fichier.

Pour les futures mises à jour du site, exécuter `npm run deploy` depuis le même dossier, puis sauvegarder les changements de code dans GitHub. La connexion automatique « Builds » entre GitHub et Cloudflare n’est pas nécessaire pour cette méthode.

## G. Choisir un domaine pour les courriels

Le site peut déjà être visité avec son adresse `workers.dev`. Pour expédier les liens de connexion à tous les participants avec Resend, il faut aussi posséder un domaine vérifiable, par exemple un nom choisi par l’organisation. Aucun nom d’exemple n’est supposé disponible ou acheté.

1. Choisir le domaine et vérifier son prix auprès d’un registraire, éventuellement Cloudflare Registrar.
2. Décider de l’achat avant de le payer.
3. Si le domaine sert aussi au site, l’ajouter au Worker dans **Settings → Domains & Routes → Add → Custom domain**.
4. Après activation du domaine, remplacer uniquement `vars.APP_URL` dans `wrangler.json` par l’adresse HTTPS exacte du site, sans `/` final, puis relancer `npm run deploy`.

Le numéro D1 et le nom `DB` ne changent pas lorsqu’on change l’adresse du site. Il est aussi possible de conserver `workers.dev` pour le site et d’utiliser un domaine possédé uniquement pour les courriels.

## H. Configurer les courriels Resend

1. Créer le compte sur https://resend.com.
2. Dans **Domains**, ajouter le domaine ou sous-domaine d’envoi choisi.
3. Resend affiche des enregistrements DNS. Les ajouter exactement à l’endroit où les DNS du domaine sont gérés. Si c’est Cloudflare : ouvrir le domaine, puis **DNS → Records → Add record**.
4. Attendre que Resend confirme la vérification. Utiliser les enregistrements SPF et DKIM fournis. Définir aussi une politique DMARC adaptée au domaine.
5. Dans Resend, créer une clé API d’envoi. La conserver privée.
6. Dans PowerShell, exécuter :

```powershell
npx wrangler secret put RESEND_API_KEY
```

Coller la clé lorsque la commande la demande, puis Entrée.

7. Exécuter :

```powershell
npx wrangler secret put MAIL_FROM
```

Saisir une adresse appartenant au domaine vérifié, sous la forme `Ride For Brains <inscriptions@TON-DOMAINE>`, en remplaçant réellement le domaine. Ne pas utiliser l’adresse Hotmail comme expéditeur Resend. Hotmail peut rester le contact de l’organisation.

8. Dans les webhooks Resend, ajouter l’adresse du vrai site suivie de `/api/webhooks/resend`. Sélectionner les événements de livraison, rejet et plainte disponibles. Copier son secret de signature, puis le fournir à :

```powershell
npx wrangler secret put RESEND_WEBHOOK_SECRET
```

**Résultat attendu : le service possède un domaine vérifié, un expéditeur et un webhook.** Un message accepté n’est pas une preuve de livraison : vérifier les états du prestataire. Choisir une offre adaptée au nombre de connexions et de confirmations; le plafond gratuit quotidien peut être insuffisant lors d’une pointe. Aucun abonnement n’est activé automatiquement.

## I. Configurer Turnstile, la protection des formulaires

1. Dans Cloudflare, ouvrir **Turnstile**, puis ajouter un widget.
2. Donner un nom comme `Ride For Brains`.
3. Ajouter le nom d’hôte réel du site, sans `https://` et sans chemin. Ajouter le domaine personnalisé si utilisé.
4. Choisir le mode géré proposé, puis créer le widget.
5. Fournir la clé publique à :

```powershell
npx wrangler secret put TURNSTILE_SITE_KEY
```

6. Fournir la clé secrète à :

```powershell
npx wrangler secret put TURNSTILE_SECRET_KEY
```

**Résultat attendu : la page de connexion peut effectuer la vérification du formulaire.** L’ouverture publique doit utiliser le même nom d’hôte que celui configuré.

## J. Créer le compte de Thomas et protéger l’administration

1. Ouvrir le site public, puis **Mon espace**.
2. Demander un lien pour `thomasberu0104@hotmail.com`.
3. Ouvrir le courriel reçu et cliquer sur le lien personnel. Si aucun message n’arrive, vérifier Resend avant de poursuivre.
4. Dans PowerShell :

```powershell
npm run admin -- --email thomasberu0104@hotmail.com --remote
```

5. Vérifier qu’une ligne affiche le courriel et `admin`.

L’accès administrateur de production exige aussi Cloudflare Access :

6. Dans Cloudflare One/Zero Trust, configurer un accès pour l’équipe, puis créer une application **Self-hosted** avec protection par nom d’hôte/chemin.
7. Dans cette application, inclure les chemins du vrai site `/admin` et `/api/admin/*`. Garder le reste du site public, notamment les webhooks de paiement.
8. Ajouter une règle d’accès limitée au courriel de Thomas, puis aux membres autorisés. Configurer un fournisseur d’identité et une politique avec second facteur; le simple code reçu par courriel n’est pas, à lui seul, une preuve de second facteur.
9. Copier le domaine d’équipe, de la forme `equipe.cloudflareaccess.com`, et le fournir à :

```powershell
npx wrangler secret put ACCESS_TEAM_DOMAIN
```

10. Copier l’**Application Audience (AUD)** de cette application et le fournir à :

```powershell
npx wrangler secret put ACCESS_AUD
```

11. Ouvrir `/admin`, passer la protection Cloudflare et utiliser le même courriel que celui du compte du site.

**Résultat attendu : l’administration affiche le rôle de Thomas et les véritables données de la base.** Si un réglage demande un abonnement, examiner l’offre et le budget avant de l’activer. Cette étape concerne une vraie protection d’accès : elle doit être vérifiée, pas contournée pour faire disparaître un message d’erreur.

## K. Créer Stripe et effectuer les essais localement

Les inscriptions fictives doivent rester dans la base locale de développement.

1. Créer le compte Stripe sur https://stripe.com et renseigner les informations réelles de l’organisation et du bénéficiaire.
2. Dans Stripe, ouvrir ou créer un **sandbox**, l’environnement d’essai.
3. Récupérer la clé secrète de cet environnement, qui commence par `sk_test_`.
4. Sur le PC, ouvrir le fichier **`.dev.vars`** du projet, qui est ignoré par Git, et ajouter :

```text
STRIPE_SECRET_KEY=COLLER_LA_CLE_TEST_ICI
PAYMENTS_MODE=test
```

Remplacer le texte d’exemple par la vraie clé test, puis enregistrer. Ne pas mettre de clé réelle `sk_live_` dans ce fichier : le serveur local la refuse.

5. Installer le Stripe CLI officiel avec :

```powershell
npm install -g @stripe/cli
```

6. Dans une deuxième fenêtre PowerShell, exécuter :

```powershell
stripe login
stripe listen --forward-to localhost:8787/api/webhooks/stripe
```

7. Garder cette deuxième fenêtre ouverte. Elle affiche un secret `whsec_…`. Le mettre dans le fichier local `.dev.vars` :

```text
STRIPE_WEBHOOK_SECRET=COLLER_LE_SECRET_LOCAL_ICI
```

8. Dans la première fenêtre, lancer `npm run dev`, puis ouvrir http://localhost:8787. Les courriels de ce site local sont dans la boîte locale, pas dans Hotmail.
9. Faire une inscription avec les cartes test officielles de Stripe. Vérifier réussite, refus, abandon, authentification bancaire et remboursement test. Aucun paiement réel ne doit être utilisé.

**Résultat attendu : un paiement test réussi devient une inscription confirmée, un paiement refusé ne donne pas de billet et les opérations apparaissent dans le sandbox Stripe.** Les tests automatiques déjà livrés ne remplacent pas cet essai avec le compte Stripe connecté.

## L. Brancher Stripe réel au site public

Cette étape vient après les essais, la validation du compte Stripe et les décisions de l’organisation. Arrêter le serveur local avec `Ctrl+C` si nécessaire; conserver le fichier local en mode test.

1. Dans le mode réel de Stripe, ouvrir **Workbench → Webhooks / Event destinations**, puis ajouter une destination HTTPS.
2. Mettre l’adresse réelle du site, suivie de `/api/webhooks/stripe`.
3. Sélectionner ces événements :

```text
checkout.session.completed
checkout.session.expired
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
refund.created
refund.updated
refund.failed
charge.refunded
```

4. Copier le secret `whsec_…` de **cette destination réelle**, puis le fournir à :

```powershell
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

5. Fournir la clé secrète réelle `sk_live_…` à :

```powershell
npx wrangler secret put STRIPE_SECRET_KEY
```

6. Dans `wrangler.json`, changer seulement `"PAYMENTS_MODE": "test"` en `"PAYMENTS_MODE": "live"`, puis enregistrer.
7. Dans PowerShell, exécuter `npm run deploy`. Cette commande publie la modification; elle ne réalise pas elle-même de paiement.

**Résultat attendu : la clé et le mode correspondent, le webhook réel est configuré et les inscriptions sont encore fermées tant que l’organisation ne les ouvre pas.** Le secret du Stripe CLI local et celui du webhook réel sont différents.

## M. Ouvrir les inscriptions

Dans `/admin` → **Événement**, renseigner et valider : lieu, horaires, parcours/informations nécessaires, fiscalité, conditions et confidentialité, politique d’annulation/report de l’événement, et présentation de Brain Canada.

La règle déjà fixée reste : 100 % de remboursement à 15 jours ou plus du début de l’événement; aucun remboursement à moins de 15 jours. Les modalités de report/annulation par l’organisation doivent être déterminées.

Vérifier les tarifs de 15 $ CA, les cinq activités, l’absence de quota et les dates de vente. Les deux cases de validation des textes et de marque représentent de vraies validations de l’organisation.

Lorsque les services et informations sont prêts, cocher **Ouvrir les inscriptions**, puis enregistrer. Contrôler le site depuis une fenêtre privée, la connexion, l’accès à l’inscription et la réception des messages. Surveiller la première vraie inscription et son événement de paiement sans créer de charge réelle à titre de simple test.

**Résultat attendu : le public peut s’inscrire et payer, les dossiers confirmés arrivent dans l’administration et les billets sont disponibles dans l’espace de l’acheteur.** L’hébergement, les courriels et la base doivent aussi avoir des limites adaptées au volume; la vérification distante et de charge reste nécessaire avant une ouverture importante.

## Sources officielles

- Cloudflare CLI : https://developers.cloudflare.com/workers/get-started/guide/
- Base D1 : https://developers.cloudflare.com/d1/get-started/
- Secrets Workers : https://developers.cloudflare.com/workers/configuration/secrets/
- Cloudflare Access : https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- Domaines d’envoi Resend : https://resend.com/docs/dashboard/domains/introduction
- Stripe, clés : https://docs.stripe.com/keys
- Stripe, essais : https://docs.stripe.com/testing
- Stripe, webhooks : https://docs.stripe.com/webhooks
