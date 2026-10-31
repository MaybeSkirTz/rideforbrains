# État actuel de la refonte

Le site existant est déjà en production sur rideforbrains.ca. Stripe, le courriel et Turnstile ont déjà été configurés par l’organisateur. La lecture publique du 30 octobre 2026 les déclare présents; elle indique aussi un lieu et des validations renseignés, et des inscriptions ouvertes. Cette branche ne réinitialise pas ces paramètres et ne remplace pas les secrets.

La refonte est sur la branche dédiée codex/refonte-experience-2027. Voir la [liste exacte des changements, fonctions facultatives et instructions de mise à jour](REFONTE-2027.md), les [audits de la refonte](AUDIT-2027.md) et les [résultats de vérification](TESTS.md).

Les tests utilisent uniquement des bases éphémères et des prestataires simulés. Aucun paiement, remboursement, envoi réel ou modification d’inscription de production n’a été effectué.

## Fonctions conditionnelles

- Les photos, portraits, citations, statistiques et tracés doivent provenir de l’organisation. Les rubriques vides n’affichent pas de faux contenu.
- Le téléversement de photos exige une liaison R2 `MEDIA`. Après activation de R2 par Thomas, le compartiment privé `ride-for-brains-media` a été créé et sa liaison ajoutée au fichier Wrangler. Pour l’activer sur la version déjà publiée : Worker `ride-for-brains` → Liaisons → Ajouter → R2 → variable `MEDIA` → compartiment `ride-for-brains-media`. Les URL HTTPS restent possibles. La création du compartiment ne prouve pas que le Worker déjà déployé possède la liaison.
- Les transferts disposent d’une API testée, mais restent désactivés par défaut sans parcours public d’activation. Une interface destinataire et une date limite doivent être recettées avant ouverture.
- Le secours d’accueil accepte des scans provisoires chiffrés sur un appareil préparé. Il demande une synchronisation et une gestion des conflits; aucune autonomie complète après fermeture/rechargement sans réseau n’est annoncée.
- Apple/Google Wallet et une PWA avec cache privé ne sont pas proposés. Le billet complet peut être téléchargé ou imprimé.
- Les validations fiscales et les autorisations de marques sont des décisions de l’organisation, pas des conclusions automatiques du logiciel.

## Retrait administratif des commandes

La migration `0007_order_removals.sql` ajoute un retrait logique, réservé aux administrateurs. Toutes les participations de la commande sont exclues des listes, exports, statistiques métier, contrôle QR et prochains envois ciblés. Une trace privée conserve la commande, ses données Stripe et le suivi du remboursement. Les compteurs techniques anonymes de visites/formulaires et les événements de livraison de courriels restent des historiques agrégés.

Le remboursement suit la politique figée à l’achat et porte sur le montant réellement payé après code promo, diminué des remboursements déjà effectués. Les remboursements en cours ou à rapprocher bloquent un nouveau retrait. Deux notifications opérationnelles distinctes confirment le retrait puis, si applicable, le remboursement effectivement confirmé par Stripe, à l’acheteur et à l’admin qui agit. Une seule copie est créée si c’est la même adresse.

Vérifications : TypeScript et compilation passent; 79 tests isolés réussissent. Le parcours a aussi été exercé dans le navigateur sur une base fictive locale sans clé Stripe ni Resend. Le code du retrait n’a pas encore été publié en production.
