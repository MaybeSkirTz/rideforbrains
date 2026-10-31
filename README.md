# Ride For Brains

Application française de la deuxième édition : **21 août 2027**, accueil **7 h 30**, **18 ans et plus**, **15 $ CA par activité**, sans quota initial. Vélo 100 km, course 10 / 5 / 2 km et marche 5 km. Thomas est le contact principal. Le lieu et les horaires des départs restent à confirmer.

Le code comprend une interface publique éditoriale, un système de scènes Three.js différées, les inscriptions individuelles ou groupées, une connexion par mot de passe et code à 6 chiffres avec Better Auth, un espace participant avec billet complet/QR et une administration. Workers sert l’application et ses métadonnées HTML; D1 stocke les dossiers. Stripe Checkout et Resend restent intégrés côté serveur.

**Statut : refonte du site existant sur la branche `codex/refonte-experience-2027`.** La production existe sur rideforbrains.ca; cette branche se vérifie dans une base locale isolée. Les paramètres et secrets de production sont conservés. Aucun paiement, remboursement ou courriel réel n’est déclenché par les tests. Lire la [livraison 2027 et sa configuration](docs/REFONTE-2027.md), les [audits](docs/AUDIT-2027.md) et les résultats des tests avant de promouvoir cette version.

**Pour mettre à jour le site actuel : suivre la [procédure de mise à jour](docs/REFONTE-2027.md).** Ne pas recréer le Worker, la base ou le domaine. Le [guide de première installation](docs/DEMARRAGE-PAS-A-PAS.md) reste disponible pour une installation indépendante.

## Démarrage local

Node.js 22.12 ou plus récent, npm et Git sont nécessaires. Node 24 LTS convient.

```powershell
git clone https://github.com/MaybeSkirTz/rideforbrains.git
cd rideforbrains
npm ci
npm run dev
```

Le serveur est à **http://localhost:8787**. `npm run dev` compile le client et le Worker, crée un secret local aléatoire dans `.dev.vars` s’il n’existe pas, applique les migrations à une base locale et lance Workerd via Miniflare. Les données locales sont dans `work/runtime/d1`, jamais dans la base Cloudflare de production. Après une modification de code, relancer le serveur.

La boîte **« Courriels locale »** permet de lire les liens de connexion et confirmations en développement. Aucun message n’est envoyé à un tiers. Cette route est désactivée en production. Le tarif reste 15 $ : sans Stripe, tenter de payer produit une erreur explicite et aucun prélèvement. Pour tester gratuitement, un administrateur peut temporairement fixer un tarif à 0 ou créer un code à 100 %, puis rétablir le tarif.

Si l’antivirus intercepte TLS, configurer son certificat de confiance avec `NODE_EXTRA_CA_CERTS`. Ne pas désactiver la vérification TLS. Dans un environnement qui interdit au compilateur de lire les dossiers parents, le lancement local utilise le compilateur Vite puis Miniflare directement; Wrangler reste l’outil de déploiement standard.

## Premier administrateur

1. Créer son compte sur `/connexion` avec prénom, nom, courriel et mot de passe, puis saisir le code à 6 chiffres reçu. Pour un compte existant sans mot de passe, utiliser « Définir mon mot de passe ».
2. Arrêter le serveur de développement avec `Ctrl+C`, puis exécuter **depuis le dossier du projet** :

```powershell
npm run admin -- --email thomasberu0104@hotmail.com --local
```

3. Vérifier la ligne affichée qui confirme `admin`, relancer `npm run dev`, recharger le site et ouvrir `/admin`.

La commande n’élève qu’un compte **déjà vérifié**. Aucun mot de passe par défaut, aucune élévation par simple adresse de courriel et aucune route HTTP d’installation. En production, la procédure diffère : [déploiement et accès renforcé](docs/DEPLOIEMENT.md).

## Vérifications

```powershell
npm run check
npm test
npm run build
npm audit
```

Les tests créent des bases éphémères indépendantes et interdisent les connexions réseau externes non explicitement simulées. Ils ne débitent et ne remboursent aucun montant réel. Les comptes de test ne figurent pas dans les migrations de production.

## Organisation du code

| Dossier       | Contenu                                                          |
| ------------- | ---------------------------------------------------------------- |
| `src/`        | Interface React, administration et scène 3D différée             |
| `server/`     | API Hono, Better Auth, validation, Stripe et file de courriels   |
| `migrations/` | Schéma D1, contraintes atomiques et paramètres initiaux          |
| `public/`     | Logos originaux et police DM Sans auto-hébergée avec licence     |
| `scripts/`    | Lancement local, migrations, premier administrateur, déploiement |
| `tests/`      | Tests HTTP contre Workerd et D1; fixtures de prestataires        |
| `docs/`       | Configuration, administration, budget et limites                 |

Les clés secrètes restent dans `.dev.vars` localement ou dans les secrets Workers. Ne jamais les committer, les intégrer au client, ni les coller dans un ticket public. `.env.example` ne contient aucun identifiant réel.

## Guides

- [Déployer sur Cloudflare, configurer Stripe et les courriels](docs/DEPLOIEMENT.md)
- [Utiliser l’administration](docs/ADMINISTRATION.md)
- [Budget et sources](docs/BUDGET.md)
- [Fonctionnalités livrées et travail restant](docs/ETAT.md)
- [Résultats des tests et limites des vérifications](docs/TESTS.md)

Les politiques sont des brouillons à faire valider. Les logos sont conservés sans modification; leur utilisation et la présentation de la relation avec Brain Canada doivent être validées avant publication.
