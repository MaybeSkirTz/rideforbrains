# Refonte de Ride For Brains — état initial et décisions

Branche : `codex/refonte-experience-2027`. Base : `40022a4`.

## Audit initial

- React 19 / Vite : `src/main.tsx` porte le routage public, l’authentification, l’inscription et l’espace participant. `src/Admin.tsx` est chargé à la demande. Three.js est déjà dans un chunk séparé.
- Hono / Workers : `server/index.ts` contient les API, contrôles Origin, validation Zod, RBAC, Access, Turnstile et signatures de webhooks.
- Better Auth / Drizzle : comptes créés après vérification du lien, sessions D1 et cookies sécurisés en production. Le formulaire commun manque de distinction création/connexion. Le retour actuel réduit l’URL à `/inscription`.
- D1 : cinq migrations existantes, captures des conditions et activités, transactions de panier, quotas et codes promotionnels protégés par triggers. Aucun effacement ni remplacement des tables de production prévu.
- Stripe Checkout : calcul serveur, confirmation depuis webhook signé et relecture Stripe, idempotence. L’annulation participant et la réconciliation d’un remboursement touchent actuellement toutes les participations du dossier.
- Resend : outbox persistante, déduplication, reprises, consentement marketing et désabonnement. État accepté distinct de livré.
- Administration : participants, prix, capacités, formulaires versionnés, promotions, communications, QR, demandes, rôles et audit. FAQ/galerie/partenaires encore saisis en JSON.
- Public : capacité illimitée affichée, équipe codée dans le composant, peu de contenu humain configurable, métadonnées principalement côté navigateur. Le renderer continue de programmer des frames hors écran.
- Référence : les **51 tests existants passent** avant modification. Le premier essai a échoué faute de permission réseau localhost; après autorisation, tous les contrats Workerd/D1 passent.

## Principes de réalisation

1. Conserver le déploiement Cloudflare, le domaine, D1, les secrets et les intégrations. Ne pas activer de prestation payante.
2. Créer deux parcours de compte explicites avec une URL de retour interne validée côté serveur. Garder le lien sécurisé par courriel.
3. Permettre le début du formulaire avant connexion. Sauvegarder ce brouillon temporaire chiffré dans D1, lié à un cookie HttpOnly et expirant; ne pas placer de coordonnées d’urgence ou de réponses privées dans localStorage.
4. Introduire des contenus éditoriaux administrables compatibles avec les données existantes : première édition, équipe, pratique, médias et partenaires. Aucune statistique, photo ou trace géographique inventée.
5. Direction visuelle : carnet d’événement / campagne sportive, crème, encre verte, accents bleu et lime, lignes de parcours et compositions éditoriales. Photos réelles facultatives; absence assumée.
6. WebGL procédural progressif et décoratif : import à proximité de l’écran, qualité adaptative, arrêt réel des frames hors écran, fallback SVG et réduction de mouvement.
7. Réponses HTML enrichies par le Worker pour les robots et aperçus sociaux. Métadonnées et tarifs tirés de D1, calendriers sans lieu ou fin inventés.
8. Annulation individuelle liée à sa participation et remboursement ciblé. Garder les billets des autres personnes valides et les anciens contrats d’annulation de dossier.
9. Transfert soumis à l’identité vérifiée et aux consentements du destinataire; désactivé par défaut tant qu’aucune échéance n’est décidée.
10. Analytics agrégées par jour/activité, sans identité, adresse IP, réponses, session publicitaire ni identifiant persistant.
11. Secours d’accueil : liste minimale chiffrée sur appareil, scans provisoires, resynchronisation contrôlée et conflits explicites. Aucune promesse de contrôle définitif hors réseau.
12. Tests exclusivement isolés, sans utiliser les clés réelles, rembourser un paiement ou modifier une inscription de production.

## Livraison et vérifications

Les changements, migrations, résultats des tests, mesures navigateur et limites de configuration seront consignés dans les documents de livraison. Le passage en production exige la réussite des vérifications; les validations éditoriales et fiscales restent des décisions de l’organisation.
