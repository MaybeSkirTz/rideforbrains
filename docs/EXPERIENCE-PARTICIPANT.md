# Expérience participant et communauté

## 1. Parcours participant

| Phase | Ce qui est disponible |
| --- | --- |
| A | **Mon jour J** rassemble les renseignements de la participation, le billet, les avis et les préparatifs personnels. L’ordre des informations évolue à minuit, heure de Toronto. L’espace inclut une invitation, un lien de parrainage et une carte PNG carrée, verticale ou Web. |
| B | Les équipes sont facultatives et privées par défaut dans le formulaire. Une équipe publique passe par la modération. Un adulte peut choisir d’afficher son propre prénom. Les histoires et dédicaces restent privées jusqu’au consentement et à l’approbation, puis leur auteur peut les retirer. |
| C | **Où va mon argent?** sépare les frais d’inscription des dons à la collecte Ride For Brains sur la plateforme officielle de Brain Canada. Le compteur d’impact est réglable et tient compte du seuil, de l’édition et des participations admissibles. Le kilométrage indique les distances choisies. |
| D | Les billets admissibles proposent les portefeuilles configurés. Un pass utilise le QR du billet existant. Le remplacement ou l’annulation de ce billet invalide l’ancien QR et déclenche le suivi de révocation. |
| E | **Mon souvenir** s’ouvre après la journée de l’événement pour une participation avec présence enregistrée. Le certificat s’enregistre en PDF via la commande d’impression du navigateur. La carte souvenir se télécharge en PNG. |
| F | Les pages publiques et les espaces participants ont des routes anglaises sous `/en/`. Les routes françaises conservent leurs adresses. L’organisation peut publier les pages anglaises et valider les textes légaux séparément. |

La météo est un champ de communication à remplir avec une information officielle vérifiée. Le parrainage attribue une participation confirmée à la dernière invitation valide enregistrée dans le même navigateur, sur une fenêtre de 30 jours. Les visites sont dédupliquées par navigateur. Le nom n’apparaît sur la carte PNG que si le participant le choisit. Le partage utilise le menu natif quand il est disponible, avec un bouton de copie du lien.

## 2. Migrations D1

| Migration | Effet |
| --- | --- |
| `0012_day_j.sql` | Ajoute le suivi facultatif des préparatifs, par participation et compte. |
| `0013_important_notices.sql` | Ajoute les campagnes opérationnelles, leur lien avec la file d’envoi et l’horodatage du premier essai. |
| `0014_referrals.sql` | Ajoute les invitations, visites dédupliquées et attributions de commande. |
| `0015_community.sql` | Ajoute les équipes, adhésions et contributions modérées. |
| `0016_impact.sql` | Ajoute le marqueur de commande de test et marque les anciennes sessions Stripe de test identifiables. |
| `0017_wallet.sql` | Ajoute le suivi des pass et la révocation lors de l’invalidation du billet. |
| `0018_mail_locale.sql` | Ajoute la langue dans la file d’envoi. Les courriels antérieurs conservent leur contenu français. |

Les migrations sont additives et s’appliquent dans cet ordre. Les textes, indicateurs et règles de visibilité sont activés dans les paramètres existants. Les commandes de test historiques gratuites ou encaissées en mode réel peuvent être identifiées manuellement dans l’administration.

## 3. Fichiers ajoutés

- Serveur — `community.ts`, `day-j.ts`, `english.ts`, `finisher.ts`, `impact.ts`, `important-notices.ts`, `referrals.ts`, `wallet.ts`.
- Logique partagée — `day-j.ts`, `impact.ts`, `important-notices.ts`, `locale.ts`, `share-card.ts`, `system-copy.ts`.
- Interface — `Community.tsx`, `CommunityAdmin.tsx`, `DayJ.tsx`, `EnglishSettings.tsx`, `Finisher.tsx`, `Impact.tsx`, `ImpactSettings.tsx`, `ImportantNotices.tsx`, `Invite.tsx`, `ShareCard.tsx`, `WalletButtons.tsx`, `community.css`, `day-j.css`, `locale-copy.ts`.
- Tests — `day-j.test.mjs`, `important-notices.test.mjs`, `share-card.test.mjs`, avec les sept migrations décrites ci-dessus et ce document.

## 4. Fichiers modifiés

- Serveur — `guardians.ts`, `index.ts`, `mail.ts`, `password-auth.ts`, `payments.ts`, `personal-tickets.ts`, `seo.ts`, `types.ts`, `validation.ts`.
- Logique partagée — `navigation.ts`, `participation.ts`.
- Interface — `Account.tsx`, `Admin.tsx`, `CheckoutStatus.tsx`, `ConfirmParticipantEmail.tsx`, `Guardians.tsx`, `MotionStories.tsx`, `MotionToggle.tsx`, `Public.tsx`, `PublicParticipants.tsx`, `ReceiptPage.tsx`, `RouteMap.tsx`, `TicketPage.tsx`, `api.ts`, `main.tsx`, `styles.css`, `ui.tsx`.
- Intégration — `wrangler.json`, `tests/app.test.mjs`, `tests/client-modules.mjs`.

## 5. Routes API

Les routes d’équipe interne et d’administration utilisent les préfixes existants `/api/organisation` et `/api/admin`. Les permissions sont vérifiées côté serveur.

| Route | Méthode et rôle |
| --- | --- |
| `/api/day-j` | GET, état privé du participant. |
| `/api/day-j/:id/progress` | PUT, préparatifs personnels de la participation. |
| `/api/referral` et `/r/:code` | POST, lien d’une inscription confirmée. GET, attribution de visite et redirection. |
| `/api/teams`, `/api/teams/:id` | GET, équipes publiées ou détail autorisé. POST sur la collection, création avec une participation. |
| `/api/teams/:id/join`, `/api/teams/:id/invitation` | POST, adhésion ou renouvellement d’une invitation privée par le propriétaire. |
| `/api/team-members/:id` | PUT, visibilité du prénom. DELETE, quitter l’équipe. |
| `/api/community/me`, `/api/community/:kind` | GET, espace personnel ou contributions publiques approuvées. |
| `/api/community/contribution`, `/api/community/contribution/:kind` | PUT, brouillon ou soumission. DELETE, retrait de publication. |
| `/api/impact` | GET, chiffres publics admissibles et activés. |
| `/api/wallet/:provider` | POST, contrôle du billet et émission d’un pass Apple ou d’un lien Google. |
| `/api/finisher/:id` | POST, certificat privé avec vérification de présence. |
| `/mail/notices`, `/mail/notices/teams`, `/mail/notices/preview`, `/mail/notices/send` | Consultation, brouillons, filtres, prévisualisation et confirmation. |
| `/community/teams`, `/community/teams/:id/members`, `/community/teams/:id`, `/community/posts`, `/community/posts/:id` | GET pour la file de modération et le détail des membres. PUT pour modérer une équipe ou une contribution. |
| `/referrals`, `/impact/test-order`, `/wallet/status` | GET des invitations et de l’état Wallet. PUT du marqueur de test. |

## 6. Permissions

- **Modérer la communauté** (`community`) permet de consulter et traiter les équipes, les histoires et les dédicaces. Le propriétaire la délègue dans les permissions existantes.
- **Communications** permet de préparer, prévisualiser et programmer les avis importants.
- **Événement** permet de gérer les informations de Mon jour J, la transparence et l’impact, les traductions, ainsi que de consulter le parrainage et l’état Wallet.

## 7. Interfaces d’administration

- **Événement** contient Mon jour J, les horaires d’arrivée des parcours, les compteurs, les catégories financières, les traductions FR/EN et l’état de configuration Wallet.
- **Communauté** regroupe les équipes, la liste de leurs membres pour la modération, les histoires et les dédicaces.
- **Courriels** contient les avis opérationnels et leur historique. La prévisualisation engage le sujet, le contenu, l’horaire et les destinataires sélectionnés. Une modification demande une nouvelle prévisualisation.
- La consultation du **parrainage** montre les visites et les participations confirmées attribuées. Le journal d’audit trace notamment la modération, la mise en file, l’acceptation d’un envoi par le prestataire, les changements de transparence, la publication anglaise, la révocation et la préparation du certificat.

## 8. Tests ajoutés

- Jour J, changement de phase à Toronto, périmètre privé et étapes de préparation.
- Avis importants, fuseau, heure ambiguë lors du changement d’heure, ciblage, aperçu et déduplication. Les scénarios de livraison et d’échec Resend utilisent le prestataire simulé.
- Parrainage, lien opaque, déduplication et attribution. Équipes, invitation privée, adhésion, retrait, consentement du prénom et modération.
- Histoires et dédicaces, brouillons privés, publication autorisée et retrait. Impact, seuil et exclusion des tests. Certificat, présence et édition achetée.
- Pass Apple simulé, absence de configuration et invalidation de l’ancien QR. Anglais, SEO, distinction des versions légales, commande et code à six chiffres.

## 9. Résultats et limites de recette

`npm run check` et `npm run build` réussis. La suite `npm test` compte 165 tests réussis. Les services externes des tests sont simulés. Les vues Mon jour J, carte, billet avec boutons Wallet, liste et détail d’équipe et mur Pour eux ont été ouvertes sans débordement horizontal aux largeurs 360, 375, 390 et 430 px dans Chromium. Le passage au mur anglais a aussi été vérifié à 360 px. Les essais Wallet et l’ouverture du billet téléchargé dans une galerie Android restent à faire sur appareil.

## 10. Configuration externe

Le site réutilise D1, Resend, Stripe, R2 et Cloudflare Access. Les nouveaux avis utilisent la file existante et la maintenance planifiée toutes les cinq minutes. Il faut des renseignements confirmés dans l’administration avant d’afficher les horaires, les consignes, les catégories financières et les chiffres. Le lien existant de la collecte Brain Canada reste le lien de don. Un total de dons demanderait une source officielle.

## 11. Activer Wallet

1. **Apple** — créer le Pass Type ID et son certificat dans Apple Developer. Héberger un service de signature privé qui reçoit le JSON du pass par `POST /pass`. Le service assemble les images de marque et le manifeste, signe le paquet avec le certificat et la chaîne Apple, puis renvoie `application/vnd.apple.pkpass`. Le connecter au Worker par la liaison `APPLE_WALLET_SIGNER`, renseigner `APPLE_WALLET_PASS_TYPE` et `APPLE_WALLET_TEAM_ID`, puis activer `APPLE_WALLET_ENABLED=true` après la recette. [Documentation Apple](https://developer.apple.com/documentation/walletpasses/building-a-pass)
2. **Google** — configurer un émetteur et une classe Event Ticket dans Google Wallet, activer l’API et autoriser le compte de service. Renseigner `GOOGLE_WALLET_ISSUER`, `GOOGLE_WALLET_CLASS` et `GOOGLE_WALLET_EMAIL`. Enregistrer `GOOGLE_WALLET_PRIVATE_KEY` comme secret Cloudflare. Obtenir l’accès de publication puis activer `GOOGLE_WALLET_ENABLED=true` après les essais. [Configuration de l’émetteur](https://developers.google.com/wallet/tickets/events/getting-started/issuer-onboarding) · [Émission depuis un site Web](https://developers.google.com/wallet/tickets/events/web)
3. Sur un iPhone et un Android, enregistrer un billet de recette, le scanner, le remplacer ou l’annuler, puis vérifier le rejet de l’ancien QR. Google reçoit les révocations lors de la maintenance. Côté Apple, un ancien pass peut rester affiché dans Wallet et sera rejeté au scan. La mise à jour visuelle via les notifications Apple demanderait un service Apple supplémentaire.

## 12. Publier l’anglais

1. Dans **Administration → Événement → Traductions**, saisir les textes propres à l’événement et les noms et descriptions des activités.
2. Activer **Publier les pages anglaises** lorsque leur contenu est prêt. La navigation, le SEO et les parcours principaux sont localisés. Les contenus libres sans traduction, notamment les avis et certaines informations saisies par l’organisation, restent dans leur langue d’origine. Certains anciens messages transactionnels et d’administration restent en français.
3. Faire approuver séparément les conditions et la politique de confidentialité anglaises, y compris les libellés de consentement pertinents. Saisir une version EN distincte et cocher l’approbation. Le panier EN est fermé en attendant la validation ou après un changement de version française. La version française reste accessible.
4. Vérifier les liens et le code à six chiffres en anglais, le récapitulatif, les conditions enregistrées, le retour Stripe, la page du billet et le message de confirmation. Vérifier les URL canoniques, `hreflang` et le sitemap une fois les pages publiées.

## 13. Déploiement

- [ ] Vérifier la révision du Worker actuel et les liaisons, en particulier **DB**, **MEDIA** et les éventuels services ajoutés dans Cloudflare. Reporter dans la configuration de déploiement les liaisons de production gérées manuellement. Le fichier de base référence D1 et laisse la liaison R2 à la configuration de production. `--keep-vars` concerne les variables, tandis que les liaisons doivent être vérifiées séparément.
- [ ] Dans une recette isolée, exécuter `npm run check`, `npm run build`, `npm test` et appliquer les sept migrations à une base de test.
- [ ] Sauvegarder D1 avec `npm run backup` et garder le fichier de sauvegarde hors de Git. Relever l’identifiant de la version précédente de Cloudflare.
- [ ] Après validation, lancer `npm run deploy` dans le dossier du projet. Le script utilise la base existante et applique les migrations avant de publier le Worker.
- [ ] Vérifier le domaine, la connexion, les billets, le scan, les photos, l’accès administrateur, la file des courriels et les webhooks. Valider la recette Stripe en environnement de test.
- [ ] Ouvrir les fonctionnalités configurables progressivement depuis l’administration. Laisser chaque Wallet désactivé jusqu’à son essai réel.

## 14. Recette mobile

- [ ] Sur Android et iPhone, répéter les essais aux quatre largeurs et contrôler la lisibilité, le clavier, le menu, la navigation et les contrastes.
- [ ] Essayer les trois dimensions de carte. Contrôler l’image enregistrée et le choix d’afficher son prénom.
- [ ] Télécharger le billet PNG, l’ouvrir dans la galerie Android et le scanner depuis un second téléphone. Refaire le test avec le billet personnel.
- [ ] Vérifier l’ajout et le scan Wallet lorsque chaque service est connecté. Essayer une invitation privée et le retrait d’une dédicace.

## 15. Jour J

- [ ] Renseigner et relire l’arrivée et le départ par activité, le stationnement, les accès, le point de départ, les GPX et les ravitaillements.
- [ ] Prévisualiser l’avis du jour, son ciblage et son heure à Toronto. Confirmer l’envoi et contrôler son état.
- [ ] Ouvrir Mon jour J avec un compte participant, accéder au QR et vérifier le scan, la procédure hors ligne et les refus de billets révoqués.
- [ ] Consigner la présence pour les participants admissibles au certificat.

## 16. Après l’événement

- [ ] Après minuit à Toronto, vérifier l’accès au souvenir pour une participation avec présence enregistrée et le refus pour une participation absente, annulée ou de test.
- [ ] Imprimer un certificat en PDF, ouvrir le fichier obtenu et tester la carte PNG.
- [ ] Mettre à jour les catégories financières et les chiffres publics validés. Traiter les retraits et fermer ou archiver les contenus communautaires selon les règles de l’organisation.
