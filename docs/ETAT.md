# État exact de la livraison

Cette application a été construite à partir du dépôt GitHub vide. Aucun ancien site n’a été recherché. Les logos fournis sont copiés sans modification; aucune photo ni commandite n’a été inventée.

## Fonctionne en local et est couvert par du code réel

- Pages publiques des activités, cause, équipe, renseignements, FAQ, partenaires, bénévolat, contact, conditions, confidentialité et annulation.
- Identité bleu/lime, police auto-hébergée, affichage mobile, scène Three.js différée avec alternative sans WebGL ou en réduction des mouvements.
- Connexion Better Auth par lien personnel à usage unique; sessions, vérification du courriel et limitations des requêtes.
- Dossiers à plusieurs personnes et activités, validation navigateur/serveur, contacts d’urgence, majorité, autorisation d’inscrire autrui, conditions versionnées, consentements photo et marketing distincts.
- Brouillons privés enregistrés en base et repris depuis le compte.
- Tarifs, codes promotionnels, périodes de vente, quotas illimités ou limités et formulaires dépendant de l’activité.
- Réservations atomiques, expiration, historique de statuts, non-confirmation depuis la page de retour, contrôle d’idempotence.
- Billets QR opaques, espace acheteur, consultation des formulaires et messages, coordonnées modifiables selon les réglages.
- Administration avec permissions côté serveur, vrais chiffres D1, recherche/filtres/pagination, notes, export CSV protégé, corrections, remboursements et journal d’audit.
- Éditeur de formulaires texte/choix/case, ordre, conditions, aperçu et versions préservant les anciennes réponses.
- Réglages des contenus, parcours, FAQ, photos et partenaires; données inconnues laissées à confirmer.
- Liste d’attente persistée, visible dans l’administration et sans fausse réservation. La promotion de la liste est manuelle : l’équipe contacte la personne, qui doit ensuite s’inscrire et payer.
- Composition et aperçu des courriels, sélection/activité/toute la liste, décompte unique, confirmation avant mise en file, modèles partagés, programmation, consentement marketing et désabonnement.
- File durable de courriels, reprises, baux, clés de déduplication, distinction entre accepté/livré, webhook signé.
- Remboursements durables, partiels ou totaux, rapprochement et clés d’idempotence; politique d’annulation fixée à 15 jours.
- Accueil en ligne avec décodage QR par caméra ou recherche manuelle, refus des billets invalides/déjà utilisés et annulation de présence autorisée.
- Formulaires publics réellement conservés dans la base; export personnel et demande de suppression enregistrée pour le responsable.

## Intégré mais exige une configuration externe et une recette avant ouverture

| Élément               | État                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| Stripe Checkout       | API intégrée, contrats HTTP testés; aucun compte Stripe test connecté ni paiement test bancaire effectué      |
| Remboursements Stripe | File et contrats API testés; aucun remboursement exécuté sur un compte Stripe réel ou test connecté           |
| Resend                | API et reprises testées avec prestataire simulé; aucun message réellement livré par Resend pendant ce travail |
| DNS d’envoi           | Domaine, adresse, SPF, DKIM et DMARC à configurer                                                             |
| Cloudflare            | Configuration, migrations et workflows fournis; compte distant non configuré dans la session                  |
| Administration MFA    | Vérification JWT Access implémentée; politique d’identité/MFA à créer et tester dans Cloudflare               |
| Turnstile             | Vérification serveur et composant client intégrés; clés/nom d’hôte à configurer                               |
| Sauvegarde            | Procédure et export fournis; aucune restauration de production exécutée                                       |

## Travail fonctionnel encore nécessaire pour aller au-delà de cette édition

- Gestion de plusieurs éditions parallèles et création/suppression d’activités depuis l’administration. Les cinq activités et l’édition actuelle sont modifiables; les instantanés des anciens achats sont conservés.
- Téléversement/gestion documentaire R2 : cette version utilise des liens HTTPS pour les photos, cartes et GPX.
- Traitement automatique des transferts d’inscription entre acheteurs, promotion automatique de la liste d’attente, et gestion des mineurs. Les règles actuelles sont **18+ uniquement** et aucun transfert automatique n’est annoncé.
- Suppression/anonymisation automatique avec politique de conservation validée. La demande est actuellement transmise au responsable; l’interface ne prétend pas effacer les données.
- Reçus fiscaux ou ventilation TPS/TVQ. La confirmation et le billet ne sont pas présentés comme un reçu de don ou une facture fiscale détaillée.
- Un mode hors ligne n’est pas implémenté. Une connexion est requise pour l’émargement.
- Audit d’accessibilité complet, tests physiques iOS/Android, tests de charge, validation de la politique MFA et recette des prestataires réels.

## À fournir ou décider avant les inscriptions réelles

1. Compte Stripe, titulaire et bénéficiaire de l’organisation; validation du choix du prestataire.
2. Traitement des taxes et des frais; décider si le prix de 15 $ inclut les taxes si applicables. Aucun supplément n’est appliqué automatiquement.
3. Lieu, parcours, accès, stationnement, départs des activités, ravitaillement et consignes finales. Heure de fermeture non déterminée.
4. Date d’ouverture et de fermeture des inscriptions, distinctes de l’accueil à 7 h 30.
5. Domaine d’envoi vérifiable et compte de courriel adapté au volume prévu. Le plafond gratuit ne convient pas à une pointe de centaines de connexions.
6. Validation des politiques et des modalités d’annulation/report par l’organisation, de la conservation des données, de l’autorité des consentements et des coordonnées du responsable.
7. Validation de la formulation sur Brain Canada et des usages des logos.
8. Configuration D1, secrets Workers, Turnstile, Access et politique MFA, accès GitHub de déploiement.
9. Photos réelles autorisées, parcours GPX/cartes et partenaires confirmés, si ces contenus doivent être affichés.
10. Recette réelle de Stripe **en mode test**, réception et rejet de courriels, appareils d’accueil et restauration sur une base de validation.

La configuration de départ conserve `registrationOpen=false`, `taxMode=unconfirmed`, `legalApproved=false`, `brandApproved=false` et les renseignements inconnus à `null`. Ces choix empêchent une ouverture accidentelle des paiements réels, sans simuler des opérations réussies.
