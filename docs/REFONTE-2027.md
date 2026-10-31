# Refonte 2027 — livraison et configuration

Branche `codex/refonte-experience-2027`, à partir du site existant (`40022a4`). Le projet, le domaine, les intégrations et les cinq migrations précédentes ont été conservés. Cette refonte n’est pas un nouveau projet.

## Changements livrés

- Création de compte distincte de la connexion. Prénom/nom/courriel pour créer; courriel seul pour se connecter. Vérification par lien de 10 minutes, sans mot de passe. Un compte est créé après vérification. La réponse de connexion ne révèle pas si une adresse existe.
- URL de retour interne validée : activité, attente et paramètres conservés; destinations externes et API refusées. Inscription commencée sans compte, brouillon invité chiffré AES-GCM, cookie HttpOnly, durée de deux heures, attribution atomique au compte après connexion sur le même navigateur. Aucun renseignement d’urgence dans localStorage.
- Direction éditoriale crème/encre verte, accents bleu/lime, lignes et compositions ouvertes. Pages d’activités détaillées, équipe, cause et renseignements. Prix et disponibilité issus de D1. Aucun message public « capacité illimitée ».
- 16 variantes procédurales : cerveau avec sillons et hémisphères; cerveau conservé; synapse; fibres; réseau; vélo; pédalier; course; foulée; marche; pas; impact; équipe; horloge d’accueil; équipement; convergence. Onze emplacements sur l’accueil, autres séquences sur les activités, l’équipe, la cause et les informations. Les scènes sont des illustrations, pas des tracés officiels ni une imagerie clinique.
- Import différé de Three.js, arrêt des frames et démontage hors écran, libération des géométries/matériaux, DPR plafonné, qualité mobile réduite, ajustement si le rendu ralentit. Alternatives SVG propres à chaque scène, respect de `prefers-reduced-motion`, économie de données et bouton « Réduire les animations ». Aucune scène sur inscription, connexion, espace, billet ou administration.
- Compte à rebours en jours de calendrier Toronto, borné à zéro. Téléchargement ICS et Google Calendar : accueil confirmé, sans lieu ou heure de fin inventés.
- Métadonnées HTML servies par le Worker : titres, descriptions, canonical, Open Graph, Twitter, images PNG, JSON-LD SportsEvent, sitemap et robots. `/velo`, `/course`, `/marche` et détails d’activité sont indexables. Pages privées sans indexation, sans jeton dans les métadonnées. Résumé public sans JavaScript. Tarifs sociaux générés depuis D1; les images de marque évitent d’inscrire un prix qui pourrait devenir faux.
- FAQ, galerie, partenaires, première édition, équipe et informations pratiques éditables dans des formulaires, avec ordre et visibilité. Souvenirs, chiffres vérifiés et presse facultatifs. Les rubriques vides sont masquées. Les logos fournis restent inchangés.
- Galerie par URL HTTPS; téléversement facultatif WebP via R2. Redimensionnement à 1 800 px maximum, limite de 1 Mo après conversion, métadonnées de photo retirées par la conversion navigateur. **Aucun service R2 n’a été activé par cette refonte.**
- Parcours réels : import local des coordonnées GPX, carte SVG avec zoom, déplacement clavier, départ/arrivée/ravitaillements/repères. Lien de téléchargement GPX séparé, fourni par l’organisation. Aucun tracé généré pour remplir un vide.
- Annulation d’une participation : remboursement de son prix net, autres billets conservés. Annulation du dossier conservée. Une seule demande de remboursement active par dossier. Un ancien remboursement non ventilé exige un rapprochement avant une annulation individuelle. Captures historiques des conditions et de l’événement conservées.
- Architecture/API de transfert : invitation hachée, destinataire au courriel vérifié, informations et consentements personnels, échéance, QR renouvelé et anciens accès retirés. **Désactivée par défaut, sans parcours public d’activation dans cette livraison.**
- Mini CRM privé des commandites et bénévoles : étapes, montants, pièces reçues, disponibilités, rôles, secteurs, quarts, arrivée, responsable et notes. Aucun de ces détails n’est exposé dans la configuration publique.
- Graphiques accessibles sans bibliothèque lourde : participations et commandes par jour, recettes, activités/statuts, remboursements, abandons, promotions payées, accueil et courriels. Tableaux sous-jacents lisibles. Compteurs de funnel agrégés par jour/activité, sans identité ni réponses. Respect DNT/GPC côté navigateur. Ce sont des occurrences d’étapes, pas des visiteurs uniques.
- Billet personnel en pleine page : QR opaque, informations de l’événement acheté, téléchargement SVG du billet complet et impression/PDF. Aucun faux bouton Apple/Google Wallet.
- Plan de secours d’accueil : liste minimale de 24 h, maximum 5 000 billets, hachages des QR et initiales seulement. Coffre local AES-GCM, clé dérivée d’une phrase de 12 caractères minimum par PBKDF2, jamais persistée. Lecture caméra locale/USB/saisie, accueils provisoires, synchronisation avec réauthentification et permissions, conflits explicites, journal et déduplication. **Ce n’est pas une garantie d’application disponible après fermeture/rechargement sans réseau.**
- Courriels HTML et texte, file Resend existante, reprises, déduplication et consentement conservés. Journaux structurés sans corps privés, jetons, secrets ni QR. Logs Workers activés, échantillonnage 10 %, journaux d’invocation désactivés. Health public minimal et diagnostic réservé au personnel autorisé.

## Migration et compatibilité

`0006_platform.sql` ajoute des colonnes et des tables; elle ne supprime aucune table, inscription, condition historique ou configuration existante. Elle crée les brouillons invités, compteurs agrégés, invitations, listes de secours et reçus de synchronisation. Les anciennes commandes et annulations de dossier restent prises en charge.

Les secrets, l’identifiant D1, `APP_URL` et le mode Stripe existants sont conservés. La base locale d’audit est isolée (`work/refonte-preview-public/d1`) et ne contient pas de copie des participants de production. La configuration locale d’audit ne contient aucune clé Stripe ou Resend. Les réglages et activités publics actuels ont été repris par une lecture sans authentification du site existant; aucun compte ou dossier participant n’a été copié.

La publication conserve également les variables ajoutées dans le tableau de bord Cloudflare grâce à `keep_vars: true` et au drapeau `--keep-vars`. Les variables déjà définies dans `wrangler.json` restent la référence pour `APP_ENV`, `APP_URL` et `PAYMENTS_MODE`. Les domaines continuent d’être gérés dans Cloudflare : aucune nouvelle route de domaine n’est imposée par ce fichier.

## Configuration encore nécessaire

Une lecture publique du site existant le 30 octobre 2026 indique : production, cinq activités, inscriptions déjà ouvertes, lieu renseigné, fiscalité `not_applicable`, validations des conditions et marques cochées, services de paiement/courriel/protection déclarés présents. **Ces indicateurs de présence ne prouvent ni la conformité fiscale, ni la livraison d’un courriel, ni une transaction bancaire.** La refonte ne réinitialise pas ces réglages.

À compléter ou à vérifier par l’organisation :

1. Photos autorisées de la première édition, portraits, récits, citations, chiffres vérifiés et presse. Aucun contenu fictif n’est fourni pour les remplacer.
2. Heures de départ, stationnement, ravitaillements, sécurité, accessibilité et parcours officiels. Les champs existent dans l’administration.
3. Accès MFA réel : même application Access couvrant `/admin` et `/api/admin/*`, courriels autorisés, fournisseur d’identité et second facteur, domaine d’équipe et AUD exacts. Une simple présence de paramètres ne valide pas une politique MFA.
4. Vérification des webhooks Stripe **de test** et Resend sur un environnement séparé; essais réels de livraison, refus, expiration, remboursement individuel et double webhook. Aucun paiement/remboursement réel n’a été déclenché pendant la refonte.
5. R2 uniquement si le téléversement est souhaité. Sans liaison `MEDIA`, utiliser des URL HTTPS : l’API refuse l’envoi avec un message clair.
6. Transferts : décision de délai et revue du parcours destinataire avant toute activation. L’API accepte `editorial.transfersEnabled` et `editorial.transferDeadline` (Unix secondes); ne pas activer sans intégrer et recetter l’interface destinataire.
7. Secours : essai sur les appareils du jour J, en mode avion, avec deux appareils et un conflit. Vérifier la conservation locale, l’expiration et la reprise réseau. Prévoir un responsable pour les rapprochements.

Une PWA/service worker n’a pas été ajoutée : la mise en cache de sessions, billets et données privées demanderait un cycle de validation dédié. Le billet téléchargé reste consultable hors réseau; une présence définitive exige le serveur.

## Mise à jour du site existant

Ne pas recréer un Worker, une base ou un domaine.

```powershell
npm ci
npm run check
npm test
npm run build
node node_modules/wrangler/bin/wrangler.js deploy --dry-run
```

Avant une publication : exporter D1 vers un emplacement privé, vérifier la branche et le bon compte Cloudflare. Ne jamais committer cet export. Relire le diff de `wrangler.json` : les nouvelles routes doivent passer par le Worker pour recevoir les métadonnées HTML; `DB`, `APP_URL` et les secrets existants doivent rester identiques.

Après validation de la prévisualisation : `npm run deploy` applique la migration incrémentale et publie le Worker existant. Cette commande ne doit être lancée que sur le compte de production attendu. Elle n’est pas un test de paiement. Vérifier ensuite les pages publiques, les en-têtes privés, la connexion, l’administration via Access, les journaux et les webhooks de l’environnement prévu. Ne pas modifier l’état des inscriptions réelles pour un essai.

R2 a été activé par Thomas. Le compartiment privé `ride-for-brains-media` a été créé et ajouté à Wrangler sous la liaison `MEDIA`. Le Worker déjà publié doit aussi recevoir cette liaison dans Cloudflare, ou lors de la prochaine publication. Le compartiment n’a pas à être rendu public; les images sont servies par `/media/`.

## Checklist avant de promouvoir la nouvelle version

- [ ] Revue des contenus et de l’identité sur téléphone et ordinateur.
- [ ] Lieu et informations jour J exacts; aucune information provisoire présentée comme confirmée.
- [ ] Décisions fiscales, assurance, conditions et marques validées par les responsables compétents.
- [ ] Sauvegarde privée D1, migration vérifiée sur copie/recette et plan de retour au code précédent.
- [ ] MFA Access sur les deux chemins, RBAC, connexions participant et organisateur vérifiés.
- [ ] Paiement, refus, expiration et remboursement groupé/individuel recettés en Stripe test distinct.
- [ ] Courriels reçus et liens utilisables; signatures et reprise des webhooks vérifiées.
- [ ] Billet complet et QR scannés sur les appareils physiques de l’accueil.
- [ ] Mode de secours recetté en mode avion et conflits traités; aucune annonce d’autonomie complète hors ligne.
- [ ] Rôles, permissions, personnes autorisées et budget d’envoi revus.
- [ ] Audits de cette branche lus; contrôles externes encore nécessaires acceptés et planifiés.
