# Remplacer la version en ligne en conservant les connexions

Cette procédure met à jour le Worker existant `ride-for-brains`, relié à la base D1 existante et au domaine `rideforbrains.ca`. Stripe, Resend et Cloudflare Access restent configurés dans Cloudflare. La nouvelle version est actuellement dans la branche locale `codex/refonte-experience-2027`.

## 1. Ouvrir PowerShell dans le bon dossier

```powershell
cd "C:\Users\thoma\Documents\Codex\2026-10-29\j-ai-r-ussi-connecter-github\outputs\ride-for-brains"
git switch codex/refonte-experience-2027
npm ci
```

Attendre la fin de chaque commande. En cas d’erreur, s’arrêter avant la publication.

## 2. Vérifier le compte Cloudflare

```powershell
npx wrangler whoami
```

Le compte doit être celui qui contient déjà le Worker `ride-for-brains` et le domaine `rideforbrains.ca`. Si la session a expiré : `npx wrangler login`, puis autoriser la connexion dans le navigateur. Aucune nouvelle application, base ou clé Stripe n’est à créer.

## 3. Exporter la base actuelle

```powershell
New-Item -ItemType Directory -Force work | Out-Null
$sauvegarde = "work/avant-refonte-$(Get-Date -Format 'yyyyMMdd-HHmmss').sql"
npx wrangler d1 export DB --remote --output=$sauvegarde
```

Attendre la confirmation d’export. Le fichier est privé et se trouve dans le dossier `work`, exclu de Git. Ne pas le publier sur GitHub.

## 4. Exécuter les vérifications

```powershell
npm run check
npm test
```

TypeScript doit terminer sans erreur et les 88 tests doivent passer. Ces tests sont isolés et ne déclenchent pas de paiement ou de remboursement réel.

## 5. Remplacer la version du site

```powershell
npm run deploy
```

Cette commande compile la nouvelle interface, applique les ajouts de tables/colonnes à la base existante et publie le code dans le même Worker. Elle garde le domaine, les secrets existants et les variables Cloudflare ajoutées dans le tableau de bord. Le mode Stripe reste `live`, comme avant; la commande ne réalise aucune transaction bancaire.

Si Cloudflare demande une confirmation de migration, vérifier que la base indiquée est `ride-for-brains` puis confirmer avec `y`. Ne pas changer d’identifiant D1 pour contourner une erreur.

Le résultat attendu comprend `5/5` et `Adresse de publication : https://rideforbrains.ca`. Une URL `workers.dev` peut aussi apparaître dans les messages Cloudflare; le domaine public reste `rideforbrains.ca`.

## 6. Vérifier la mise à jour

Ouvrir https://rideforbrains.ca et actualiser avec `Ctrl+F5`, ou ouvrir une fenêtre privée. Vérifier l’accueil, les activités/tarifs, la connexion par courriel et l’administration via Access. Les dossiers existants doivent toujours être présents. Ne pas utiliser une vraie carte pour faire un essai.

## 7. Garder la même version dans GitHub

La publication Cloudflare peut se faire directement depuis ce dossier local, même avant l’envoi GitHub. Pour conserver la copie distante, utiliser GitHub Desktop sur ce dépôt et publier la branche `codex/refonte-experience-2027`. Si une publication automatique Cloudflare utilise `main`, faire intégrer cette branche à `main` après revue, afin qu’une prochaine compilation automatique utilise le même code.

En cas d’erreur à une étape, conserver le message et ne pas poursuivre les étapes suivantes. Les DNS, le domaine, Stripe, Resend et Access ne doivent pas être recréés pour cette mise à jour.
