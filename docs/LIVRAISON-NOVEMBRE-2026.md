# Livraison du 1er novembre 2026

## 1. Résultat et décisions conservées

Amélioration du dépôt existant, sans remplacement de React/Hono/Workers, de D1, de Better Auth, de Stripe, de Resend ni de R2. Cette livraison est **locale, non déployée et non poussée**. Aucune inscription privée de production n’a servi de fixture; aucun vrai paiement, remboursement ou courriel n’a été déclenché.

Les réponses explicites de Thomas remplacent les passages contradictoires du document : **mot de passe et code à six chiffres**, vélo **18+**, course/marche tous âges avec autorisation préalable depuis un compte parental distinct. Les dons restent sur la page de collecte Ride For Brains hébergée par la plateforme officielle Brain Canada, séparément des frais d’inscription.

Les prix existants ont été lus dans l’API publique et **ne sont pas réinitialisés** :

| Activité | Tarif actuel |
| --- | ---: |
| Vélo 100 km | 30 $ CAD |
| Course 10 km | 20 $ CAD |
| Course 5 km | 15 $ CAD |
| Course 2 km | 10 $ CAD |
| Marche 5 km | Gratuit |

L’affichage utilise toujours les tarifs administrés en base. « Dès » apparaît seulement pour plusieurs prix payants différents; la marche gratuite est nommée explicitement. La migration ne touche aucun tarif, commande, compte ou paramètre existant.

## 2. Fichiers et fonctions

| Ensemble | Fichiers concernés | Résultat |
| --- | --- | --- |
| Brouillons et groupe | `src/main.tsx`, `src/api.ts`, `shared/registration.ts`, `server/index.ts` | Relecture invitée après rafraîchissement, autosave différé et ordonné, sauvegarde à la sortie, état visible et reprise sur erreur; fiches repliables, état de complétude et copie ciblée téléphone/contact d’urgence. |
| Paiement et reçu | `shared/checkout.ts`, `src/CheckoutStatus.tsx`, `src/ReceiptPage.tsx`, `server/payments.ts`, `server/extensions.ts` | Confirmation automatique bornée, avec preuve serveur de paiement; reçu privé après rabais; rapprochement atomique des remboursements et notifications distinctes demande/confirmation. |
| Billets et courriel | `server/personal-tickets.ts`, `server/mail.ts`, `src/TicketPage.tsx`, `src/useFragmentToken.ts`, `src/ConfirmParticipantEmail.tsx`, `src/EmailCorrection.tsx` | Accès opaque limité à une participation, renvoi/révocation, correction vérifiée, rotation du QR après confirmation, téléchargement et calendrier de l’événement acheté. |
| Contenu et administration | `shared/editorial.ts`, `server/editorial.ts`, `server/validation.ts`, `src/ContentEditor.tsx`, `src/Admin.tsx`, `src/LaunchReview.tsx`, `shared/launch.ts`, `src/SubmissionDetails.tsx` | Médias, réseaux sociaux, année de première édition, offres de bénévolat/commandite, renseignements de parcours et validations de lancement. |
| Interface et mouvement | `src/Public.tsx`, `src/experience.css`, `src/Account.tsx`, `src/Scene.tsx`, `src/MotionToggle.tsx`, `src/PhotoAlbum.tsx`, `shared/motion.ts` | Accueil plus compact, vrais souvenirs publiés, prix et âges visibles, navigation mobile, liens utiles plus lisibles, mouvement désactivable même si le stockage est bloqué. |
| SEO et mesure | `server/seo.ts`, `server/analytics.ts`, `src/AdminInsights.tsx`, `shared/navigation.ts`, `index.html`, `wrangler.json` | SportsEvent/Organization/BreadcrumbList, pages privées sans indexation, compteurs agrégés, routes privées traitées par le Worker. |
| Identité | `public/favicon.svg`, `favicon.ico`, `favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `site.webmanifest` | Icônes cohérentes et manifest. Les deux logos officiels fournis n’ont pas été modifiés. |
| Vérification | `tests/app.test.mjs`, `tests/experience.test.mjs`, `tests/client-modules.mjs`, `tests/tasks-worker.ts`, `docs/TEST-RESULTS.txt`, captures `docs/previews/nov01-*` | Contrats d’intégration, helpers et preuves de recette. |
| Documentation | `README.md`, `docs/AUDIT-NOVEMBRE-2026.md`, ce rapport, `docs/TESTS.md`, `docs/ADMINISTRATION.md`, `docs/REFONTE-2027.md`, `docs/INDEXATION-RECHERCHE.md` | État actuel et instructions de reprise. |

## 3. Migration

`migrations/0011_personal_tickets.sql` ajoute deux tables : accès de billet personnel et demandes de correction de courriel. Les jetons consultables sont hachés; la copie nécessaire au renvoi est chiffrée. Un déclencheur révoque l’accès si le courriel ou le QR change. Les relations suivent les participations existantes; aucune suppression, reconstruction de table, conversion de prix ou réécriture des conditions achetées.

Les tests appliquent toute la chaîne de migrations et vérifient également la migration d’une base historique avec paramètres, paiement et conditions d’achat conservés. Les anciennes migrations restent inchangées.

## 4. Bugs et fragilités corrigés

- Perte du brouillon invité au rafraîchissement; lecture concurrente après connexion pouvant retourner une ancienne valeur vide.
- Sauvegardes pouvant se dépasser; recréation d’un brouillon lors de la sortie vers le paiement après confirmation de formulaire.
- Participants renvoyés vers le compte de l’acheteur : chacun reçoit désormais un lien limité à son billet, sans accès au groupe, au reçu ni aux coordonnées d’urgence.
- Retour de paiement à actualiser manuellement : vérification automatique, tolérance aux erreurs réseau et sortie explicite après douze tentatives.
- Correction d’adresse non vérifiée : l’adresse ne change qu’après preuve de réception; l’ancien QR est ensuite remplacé. Les comptes utilisateur ne sont jamais renommés par cette opération.
- Remboursements simultanés pouvant réécrire un cumul périmé : rapprochement et sommes dérivées dans une transaction D1. Un état réussi ne régresse pas sur un événement tardif.
- Échec d’un remboursement individuel pouvant réactiver un billet annulé : le billet reste invalide. Les autres participations restent utilisables.
- Anciens courriels de billets encore en file après révocation/remplacement : annulation de la file concernée et contrôle du droit avant envoi. Un renvoi explicite peut créer un nouvel accès; la maintenance ne ressuscite pas un accès révoqué seul.
- Préférence d’animation qui pouvait échouer avec localStorage bloqué; référence SVG de repli erronée.
- Lien « Aller au contenu » qui risquait de remplacer un jeton dans le fragment : il déplace désormais le focus sans modifier l’adresse.
- Ouverture de deux liens personnels dans le même onglet : le changement de fragment recharge le bon billet, efface l’ancien état et annule les réponses périmées. La confirmation d’adresse suit aussi le changement de lien.
- Révocation d’un ancien billet avant sa préparation automatique et reprise d’une préparation devenue périmée : une trace de révocation et des conditions vérifiées au moment de la transaction empêchent la réactivation.
- Formulaires très longs, jargon au retour de paiement, textes utiles trop petits et prix « Dès » inappropriés aux activités gratuites ou uniformes.
- Erreur dans une fiche repliée : le premier champ invalide rouvre désormais sa fiche et reçoit le focus et le message natif, au lieu de laisser la dernière fiche invalide ouverte.

## 5. Vérifications exécutées

Référence avant modifications : **129/129**. Après modifications : **146/146**, zéro échec et zéro test ignoré, environ 167 secondes. Résultats détaillés : [TEST-RESULTS.txt](TEST-RESULTS.txt).

`npm run check`, `npm test`, `npm run build`, `npm audit` et `git diff --check` ont réussi. L’audit npm ne signale aucune vulnérabilité. Le certificat de l’environnement a été vérifié avec le magasin système; TLS n’a pas été désactivé.

`npx wrangler deploy --dry-run --outdir work/nov01-dry-run` réussit et retrouve les liaisons **DB**, **MEDIA**, **ASSETS**, l’adresse **https://rideforbrains.ca** et le mode de paiement déjà configuré. Cette commande ne publie rien et n’applique pas de migration distante.

## 6. Couverture automatisée

Dix-sept nouveaux contrats couvrent notamment les brouillons invités et leurs lectures concurrentes, la séparation des billets, les corrections expirées/remplacées, les accès révoqués, les reçus privés, le prix remboursé après promotion, les remboursements concurrents et tardifs, la confirmation bornée, la complétude et le consentement parental, les prix réellement configurés, le stockage navigateur bloqué et le verrou de lancement en production simulée.

Les contrats préexistants restent verts : signature/montant/devise/mode Stripe, doubles événements, capacité et promotions atomiques, autorisations parentales à usage unique, annulation individuelle et retrait privé, permissions/Access/MFA, révocation, courriels, données publiques sans renseignements privés, R2, GPX réels, calendrier, migrations et seize scènes procédurales.

## 7. Recette mobile

Recette dans le navigateur intégré à **390 × 844** : trois personnes en course 10 km, copie ciblée des contacts, rafraîchissement du brouillon, création de compte par mot de passe et code local, retour exact à l’activité, acceptation renouvelée des conditions, total **60 $**, paiement simulé, confirmation automatique et trois billets. Téléchargements du billet SVG et du calendrier ICS effectués; annulation d’une personne et remboursement simulé de **20 $**, autres billets conservés.

La page n’affiche aucune carte bancaire dans cette recette : le prestataire de paiement est entièrement simulé. Les courriels restent dans la boîte de développement et toutes les identités de recette sont fictives.

Capture : [confirmation mobile](previews/nov01-confirmation-mobile.png). Les essais de dimensions complémentaires et les limites matérielles sont consignés ci-dessous.

Accueil contrôlé à **360, 375, 390, 430, 768, 1366, 1440 et 1920 pixels**, sans débordement horizontal. Le lien de compte et l’inscription fixe sont visibles aux formats mobiles; cette dernière est absente des billets privés. Le menu ouvre le premier lien au clavier, Échap le ferme et rend le focus au bouton. Le billet personnel est aussi contrôlé à 390 pixels. Captures : [accueil mobile](previews/nov01-accueil-mobile.png), [accueil ordinateur](previews/nov01-accueil-ordinateur.png), [billet personnel](previews/nov01-billet-personnel.png).

Le formulaire de trois personnes a aussi été mesuré à ces huit largeurs sans débordement ni bande fixe d’inscription superposée. En laissant toutes les fiches incomplètes puis en ouvrant la troisième avant de continuer, la validation rouvre la première et place le focus sur son prénom. Sur la page Course à 390 pixels, le bouton affiche « Dès 10,00 $ » avec une inscription en course présélectionnée; son prix reste relu au récapitulatif.

## 8. Recette ordinateur

Accueil → Course → inscription 10 km, début de formulaire, création d’un second compte fictif, code, retour vers le brouillon et récapitulatif à **20 $**. Un délai artificiel de **600 ms par appel API** a permis de vérifier la navigation hors du formulaire et sa reprise. L’abandon du paiement conserve le dossier en attente, sans délivrer de billet, avec une action de reprise.

Un billet personnel a également été ouvert depuis un onglet sans session participant : il affiche uniquement la personne concernée et son QR, sans le groupe, les contacts ni les montants.

Le paiement abandonné a ensuite été repris sur la même réservation, simulé à **20 $**, confirmé et associé au billet de Dominique. Dans l’administration locale, une adresse fictive a été corrigée : message neutre à la nouvelle adresse, confirmation explicite, nouveau billet préparé, ancien accès refusé. Le passage entre l’ancien et le nouveau lien dans le même onglet recharge correctement leur état. [Capture de confirmation d’adresse](previews/nov01-courriel-confirme.png).

## 9. Accessibilité

Libellés et groupes de formulaire, consentements distincts, sommaires repliables, annonces `role=status` au paiement et à la sauvegarde, focus principal à chaque changement de page, lien d’évitement préservant les jetons, liens externes explicites, QR accompagné d’un nom/date/lieu, tables lisibles sous les graphiques, calendrier et téléchargements réels. Les boutons de navigation mobiles et le pied de page ont des zones tactiles agrandies.

Le mouvement respecte le réglage système, le bouton de réduction, l’économie de données et le stockage bloqué; le SVG reste disponible sans WebGL. Les seize géométries sont testées à plusieurs tailles. **Aucune certification WCAG n’est revendiquée** : lecteur d’écran réel, Safari/iPhone, rotation physique et clavier virtuel demandent une recette sur appareils réels. Le navigateur intégré ne permet pas de reproduire fidèlement ces environnements.

La réduction d’animations a été activée dans l’interface : zéro canevas monté et quatre illustrations SVG de repli présentes à l’accueil. Les liens du pied de page ont été contrôlés après calcul des styles; aucun texte utile public inférieur à 12 px n’a été relevé dans cet échantillon. Le texte de diagnostic local reste à 10 px. L’action d’évitement garde le jeton personnel intact et place effectivement le focus sur le contenu.

## 10. Performance

Build : entrée JavaScript **336,83 kB / 105,16 kB gzip**. Le module 3D différé est **506,37 kB / 129,11 kB gzip**; Vite conserve son avertissement au-delà de 500 kB, signalé et non masqué. Cartes, scanner, administration et QR sont différés. La 3D s’arrête hors écran et libère ses ressources; aucune scène n’est montée dans les formulaires/comptes/billets. Les photos ont un cadre et des dimensions; la galerie n’allonge pas la page avec chaque photo.

La bande de navigation conserve son espace lors du passage fixe. Les polices restent auto-hébergées. Le test à latence API n’est pas un benchmark de CPU mobile ou de réseau cellulaire. Les Web Vitals locaux restent disponibles via « Audit local »; ils ne remplacent pas des données de terrain ou un audit Lighthouse reproductible. Aucun score inventé.

La longue session de recette en arrière-plan, avec changements de dimensions et de scènes, a affiché CLS 0,0000, INP 24 ms et LCP 58 560 ms. Cette session ne constitue pas une mesure de chargement reproductible et ne permet pas de conclure au respect d’un objectif LCP. Un audit de chargement à froid sur appareil réel reste nécessaire; cette valeur n’est pas dissimulée derrière un score.

Un nouvel onglet local, avec dimensions stables et cache potentiellement chaud, a ensuite affiché **LCP 288 ms, CLS 0,0000, INP 16 ms**, Three chargé. [Capture du diagnostic local](previews/nov01-performance-local.png). Cette observation donne un point de comparaison de recette, sans remplacer les essais à froid, sur réseau cellulaire ou en production.

## 11. Sécurité et conservation

Les prix, remises, disponibilités, identités parentales et montants remboursables restent autoritaires côté serveur. Le remboursement utilise la part **réellement payée**, jamais le prix avant promotion. Le succès de retour du navigateur ne prouve aucun paiement; les webhooks signés restent nécessaires.

Les liens individuels ont 256 bits aléatoires, sont hachés en base et liés au courriel et au QR actuels. Ils passent dans le fragment de l’URL, puis dans le corps POST; ils ne figurent pas dans les métadonnées, journaux de pages ni journal de courriels administratif. Ce sont des liens porteurs : les transmettre volontairement transmet l’accès au billet; l’organisation peut les révoquer.

Les vérifications d’adresse expirent après 24 heures et ne modifient pas un compte. Les anciennes demandes et anciennes versions de QR sont refusées. Aucune donnée personnelle du brouillon n’est mise dans localStorage. Les mutations conservent les contrôles d’origine, de session, de permissions et de cadence. Access/MFA de l’administrateur principal et portail équipe restent distincts.

Les secrets existants n’ont pas été changés ni intégrés au client. Aucun fichier `.dev.vars`, export D1 ou secret de recette n’est ajouté au dépôt. Les confirmations des paiements déjà présents peuvent être complétées par la maintenance, à raison de dix billets manquants par passage : cela préparera de nouveaux courriels personnels après un futur déploiement. Les liens explicitement révoqués ne sont pas réactivés automatiquement.

## 12. Configuration et contenus encore nécessaires

**Point à traiter avant publication :** les nouveaux champs `launchReview` sont volontairement non approuvés par défaut. Pour une production en mode live, les nouvelles inscriptions seront fermées tant que les validations ne sont pas remplies, même si l’ancien interrupteur d’ouverture est actif. Les comptes, billets acquis et politiques d’achat historiques sont conservés. Ne pas déployer cette version en supposant une ouverture immédiate.

Dans l’administration, finaliser les textes d’annulation, de report, de météo/force majeure, faire valider les conditions, le traitement fiscal, la politique de remboursement et l’usage de marque, puis cocher les décisions correspondantes. Une modification des politiques exige une nouvelle version des conditions. L’outil enregistre la décision de l’organisation; il ne fournit aucune validation juridique ou fiscale.

Compléter seulement avec des éléments réels : horaires de départ, fin éventuelle, détails d’accès/parking/toilettes/ravitaillement, descriptifs accessibles des photos, récits/citations de l’équipe, année/chiffres/preuves de première édition, médias et réseaux sociaux officiels. Les rubriques sans contenu restent discrètes. Le lieu public déjà fourni est repris; aucun nouveau lieu n’a été inventé.

Les connexions Stripe, Resend, Turnstile, Access et R2 ne sont pas à recréer. Elles devront être contrôlées après publication, avec leurs secrets existants. Une acceptation Resend n’est pas une preuve de livraison en boîte de réception. La présente campagne ne prouve pas un paiement sandbox hébergé par Stripe, une livraison Hotmail ou un scan caméra sur téléphone.

Pour la recherche : le domaine public, `robots.txt` et le sitemap ont été contrôlés le 1er novembre et répondent HTTP 200; l’accueil autorise l’indexation. La validation de propriété dans Google Search Console et l’envoi du sitemap restent des actions du propriétaire. Le [guide Google/Bing pas à pas](INDEXATION-RECHERCHE.md) donne les champs DNS et les étapes, sans promesse de délai ou de classement.

## 13. Checklist de lancement

1. Relire cette livraison et la différence Git; garder les tarifs existants et les règles de compte/mineurs confirmées.
2. Terminer la revue des politiques et des informations; obtenir les validations de l’organisation avant toute ouverture live.
3. Faire la recette sur iPhone/Safari et Android réels : rotation, clavier, retour depuis Mail, fermeture d’onglet, QR et contrôle d’accueil. Compléter clavier/lecteur d’écran et contraste sur les contenus réels.
4. Dans un environnement Stripe sandbox distinct, vérifier succès, refus et abandon hébergés, les événements signés et un remboursement fictif après rabais. Ne pas saisir une vraie carte en test.
5. Exporter D1 vers un emplacement privé chiffré : `npx wrangler d1 export DB --remote --output=CHEMIN-PRIVE/backup-2026-11-01.sql`. Ne jamais committer cet export. Conserver aussi la version Worker précédente et la configuration.
6. Vérifier DB, MEDIA, domaine, `keep_vars` et secrets existants. Ne pas recréer la base ou le Worker; ne pas changer `BETTER_AUTH_SECRET`.
7. Appliquer `0011` puis publier via la procédure existante `npm run deploy`, après autorisation de publication. Le script conserve les liaisons et applique les migrations. **Non exécuté dans cette livraison.**
8. Vérifier sur le domaine les pages publiques, les ressources, la connexion, les brouillons, un compte de recette, l’Access propriétaire et le portail équipe. Contrôler file de courriels, retours prestataires et tâches planifiées sans déclencher de paiement réel pour vérifier le déploiement.
9. Ouvrir les inscriptions seulement lorsque les contrôles de production sont verts. Surveiller les premiers retours et la file d’envoi; conserver une marche arrière du Worker. La migration additive peut rester en place lors d’un retour du code.

Le plan d’accueil hors ligne existant reste un secours avec coffre chiffré et synchronisation, **pas une garantie de rechargement de l’application sans réseau**. Aucun faux support Wallet, aucune preuve sociale ni donnée d’édition n’a été fabriqué.
