# Audit du 1er novembre 2026 — avant modifications

Le dépôt existant est conservé. La campagne de référence compte **129 tests réussis**, avant toute modification. Un premier lancement était bloqué par la permission réseau localhost; le lancement autorisé passe intégralement. Le rapport brut est conservé dans `work/baseline-nov01.log` (fichier local ignoré).

## Architecture vérifiée

React/Vite pour les pages publiques, comptes, inscriptions et espace participant; administration et scènes Three.js différées. Hono/Workers pour les API; Better Auth et D1 pour les sessions; mot de passe et code à six chiffres obligatoires. Stripe Checkout, signature et rapprochement des webhooks, remboursements idempotents; Resend et outbox persistante; R2 privé pour les photos. Les dix migrations sont incrémentales. Les tests portent sur Workerd et D1 avec prestataires simulés.

## Fonctionne déjà

- Compte/création distincts, récupération de mot de passe, code à usage unique, retour exact vers activité/attente et protection des redirections; sessions temporaires et persistantes.
- Début d’inscription sans compte; brouillon invité chiffré et attribution au compte après connexion, sans stockage de renseignements dans localStorage.
- Panier atomique de douze participations maximum, prix serveur, quotas et promotions; autorisation parentale liée à l’identité, l’activité et aux consentements.
- Annulation individuelle et de dossier, conservation des autres billets, remboursement net après promotion, audit et retrait administratif privé.
- Billets acheteur, QR opaque, impression/PDF et téléchargement; calendrier ICS/Google.
- GPX réellement publiés, fond OpenStreetMap, galerie à cadre fixe et défilement automatique, R2, éditeurs de contenus.
- Pages SEO enrichies par Workers, données structurées Event, sitemap, robots, partage social; scènes 3D procédurales et SVG de repli; métriques locales de performance.
- Mini CRM bénévoles/partenaires, droits relus à chaque requête, portail équipe sans ajout individuel Cloudflare, administration principale sous Access/MFA, retrait des accès, audit.
- Courriels HTML/texte, reprises et déduplication, déclenchement immédiat et cron indépendant des opérations Stripe; secours de contrôle de billets documenté et chiffré.

## Écarts à traiter

- Un invité ne retrouve pas son brouillon après un rafraîchissement avant connexion; aucune sauvegarde automatique. Le quota actuel de sauvegardes ne convient pas à l’autosave.
- Les confirmations renvoient encore les participants vers le compte de l’acheteur; absence de lien individuel limité à un seul billet.
- Absence de correction de courriel vérifiée, et de reçu de paiement autonome.
- Retour de paiement nécessitant une actualisation manuelle, avec jargon technique.
- Formulaire groupé très long; pas de résumé repliable ni copie ciblée de coordonnées.
- Prix « Dès » alors que les tarifs sont identiques, libellé sport brut dans le récapitulatif, petits textes utiles, navigation mobile encombrée.
- Certaines demandes éditoriales restent partielles : médias détaillés, réseaux sociaux, année de première édition, politiques d’annulation/report distinctes et validation explicite.

## Décisions confirmées par Thomas

Le mot de passe et le code à six chiffres sont conservés, contrairement au passage sans mot de passe mentionné dans le document. Le vélo reste 18+; course et marche restent ouvertes aux mineurs avec accord depuis le compte d’un parent. Aucun lieu, témoignage, photo, horaire, partenaire ou chiffre n’est inventé. Les trois sections de l’accueil restent sobres; les détails appartiennent aux pages dédiées.

Pas de déploiement, paiement, remboursement, envoi de courriel ou mutation des données de production pendant les essais. Les limites des audits navigateur seront rapportées sans prétendre avoir testé Safari, un lecteur d’écran physique ou des appareils réels.
