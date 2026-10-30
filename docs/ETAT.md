# État actuel de la refonte

Le site existant est déjà en production sur rideforbrains.ca. Stripe, le courriel et Turnstile ont déjà été configurés par l’organisateur. La lecture publique du 30 octobre 2026 les déclare présents; elle indique aussi un lieu et des validations renseignés, et des inscriptions ouvertes. Cette branche ne réinitialise pas ces paramètres et ne remplace pas les secrets.

La refonte est sur la branche dédiée codex/refonte-experience-2027. Voir la [liste exacte des changements, fonctions facultatives et instructions de mise à jour](REFONTE-2027.md), les [audits de la refonte](AUDIT-2027.md) et les [résultats de vérification](TESTS.md).

Les tests utilisent uniquement des bases éphémères et des prestataires simulés. Aucun paiement, remboursement, envoi réel ou modification d’inscription de production n’a été effectué.

## Fonctions conditionnelles

- Les photos, portraits, citations, statistiques et tracés doivent provenir de l’organisation. Les rubriques vides n’affichent pas de faux contenu.
- Le téléversement de photos exige une liaison R2 MEDIA facultative. Les URL HTTPS fonctionnent sans ce service. Aucun stockage payant n’a été activé.
- Les transferts disposent d’une API testée, mais restent désactivés par défaut sans parcours public d’activation. Une interface destinataire et une date limite doivent être recettées avant ouverture.
- Le secours d’accueil accepte des scans provisoires chiffrés sur un appareil préparé. Il demande une synchronisation et une gestion des conflits; aucune autonomie complète après fermeture/rechargement sans réseau n’est annoncée.
- Apple/Google Wallet et une PWA avec cache privé ne sont pas proposés. Le billet complet peut être téléchargé ou imprimé.
- Les validations fiscales et les autorisations de marques sont des décisions de l’organisation, pas des conclusions automatiques du logiciel.
