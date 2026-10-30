# Vérifications de la refonte — 30 octobre 2026

Les contrôles décrivent cette branche locale. Ils ne certifient pas la configuration juridique, le fournisseur d’identité, la banque ou les appareils physiques du jour J. Les paramètres de production déjà installés sont conservés.

## Tests et construction

- Référence avant modifications : 51 tests réussis.
- Campagne finale : **73 tests réussis, zéro échec** contre Workerd/D1 et fixtures HTTP isolées. Résultats dans `TEST-RESULTS.txt`.
- TypeScript : `npm run check` réussi. Client et Worker compilés.
- Migration testée sur une base contenant les cinq migrations précédentes, un lieu déjà configuré, des inscriptions ouvertes, une commande payée et ses conditions achetées. La nouvelle migration conserve ces valeurs et supporte une seconde exécution du lanceur.
- Couverture ajoutée : deux parcours de compte, retour complet, refus des redirections externes, brouillon invité chiffré et attribution unique, analytics sans données personnelles, remboursement d’une participation sur trois, autres QR valides, délai de quinze jours, isolation, transfert et renouvellement du QR, consentements personnels, transfert fermé par défaut, secours/expiration/révocation/doublons/conflits, CRM privé, métadonnées/calendrier, HTML échappé, R2 absent et géométries des seize scènes sur deux niveaux de qualité.
- `npm audit` après ajout de `web-vitals@6.2.3` : **zéro vulnérabilité signalée**.
- Préparation Cloudflare avec `wrangler deploy --dry-run` réussie. Aucune migration distante, transaction Stripe ou livraison Resend n’est lancée par ces contrôles.

## Performance

Compilation Vite, valeurs arrondies en kB décimaux :

| Ressource | Minifiée | Gzip | Chargement |
|---|---:|---:|---|
| Client principal | ~299 | ~93 | Initial |
| CSS | ~66 | ~14 | Initial |
| Scènes + Three.js | ~506 | ~129 | Différé à proximité d’une scène |
| Administration | ~65 | ~20 | Route admin seulement |
| Lecteur jsQR | ~131 | ~47 | Action caméra seulement |
| Billet complet | ~3,8 | ~1,8 | Route billet seulement |
| Carte | ~2,5 | ~1,2 | Lorsqu’un tracé réel existe |
| Web Vitals | ~8,2 | ~3,2 | Diagnostic local uniquement |

Le chunk 3D dépasse le seuil indicatif de 500 kB de Vite. L’avertissement est conservé; il n’est pas masqué. Ce coût est différé et n’est pas chargé sur une arrivée directe au formulaire. La référence précédente était ~474 kB pour la scène/Three et ~280 kB pour le client principal. La nouvelle variété des scènes augmente le coût, sans ajouter de modèles ou textures distants.

Mesures ponctuelles du navigateur intégré, serveur local, cache possiblement chaud, réseau et CPU non bridés. Mesurées avec les callbacks officiels de [Web Vitals](https://github.com/GoogleChrome/web-vitals), affichées uniquement dans le panneau local. Aucun identifiant ou événement n’est envoyé à un tiers.

| Parcours | LCP | CLS | INP observé |
|---|---:|---:|---:|
| Accueil, section connexions sur ordinateur | 232 ms | 0,0007 | 24 ms |
| Vélo, viewport demandé 390 × 844 | 188 ms | 0,0026 | 24 ms |

Ces chiffres ne sont ni un score Lighthouse, ni des données CrUX, ni une prévision du réseau mobile réel. Ils concernent quelques interactions dans ce navigateur. Les données de terrain restent à collecter après publication.

Contrôles observés :

- Page d’inscription directe : zéro canvas et « Three absent » dans le diagnostic; activité vélo présélectionnée, formulaire anonyme accessible.
- Réduction des animations puis rechargement : onze scènes SVG, zéro canvas, Three absent. Réactivation ensuite rétablie.
- Au niveau des connexions : synapse/fibres/réseau en rendu; cerveau au-dessus de l’écran en état pause. Les scènes éloignées n’ont plus de canvas. Les ressources sont libérées au démontage.
- DPR plafonné à 1,6 sur ordinateur et 1,25 en qualité compacte/mobile, ramené à 1 si des frames lentes s’accumulent. Points et segments réduits sur mobile; aucune promesse de 60 fps sur tous les appareils.
- Photos différées avec dimensions réservées. Téléversement en WebP compressé facultatif. Aucun modèle 3D ou portrait généré téléchargé.

## Accessibilité et adaptation

Contrôles réalisés dans le navigateur intégré :

- Largeur téléphone demandée 390 px : largeur de contenu 375 px, identique à la largeur utile hors barre de défilement; aucun débordement horizontal sur accueil, vélo et inscription.
- Menu mobile ouvert à la touche Entrée; `aria-expanded` et `aria-controls`, focus sur le premier lien et fermeture Échap vers le bouton. Focus du contenu principal sans défilement forcé à chaque arrivée.
- Création/connexion réellement examinées : choix explicites, prénom/nom/courriel distincts du formulaire courriel seul. Champs étiquetés, autocomplétion, erreurs annoncées et focus du formulaire.
- Navigation sémantique, un titre principal, lien d’évitement, boutons natifs et zones d’état. Au code, dialog QR avec Échap, boucle Tab et retour du focus au déclencheur; billet complet imprimable.
- Scènes décoratives `aria-hidden`, explications visibles dans les légendes. Alternatives cohérentes (vélo, pas, horloge…), sans dépendance de l’inscription à WebGL. Respect de la préférence système de réduction des mouvements et commande de réduction sur le site.
- Tableau accessible sous chaque graphique; zoom et déplacement clavier du tracé. Cibles principales de 44 px et champs de 16 px sur mobile.
- Ratios calculés sur la palette : encre/crème **11,11:1**, texte secondaire/crème **5,26:1**, blanc/encre **12,11:1**, encre/lime **8,79:1**. Le bleu initial à 4,36:1 a été assombri pour les petits textes.

Limites : pas de certification WCAG, pas de lecteur d’écran JAWS/NVDA/VoiceOver, pas de campagne exhaustive avec zoom navigateur réel à 200 %, pas de validation de contraste sur chaque photo future. La relecture humaine et la recette sur appareils physiques restent nécessaires. Les images ajoutées par l’administration doivent garder un texte alternatif utile.

## Sécurité et données

- Les sessions Better Auth, Origin, limites des requêtes, validation Zod, RBAC, Access JWT (signature/émetteur/AUD/courriel), Turnstile, cookies sécurisés, HSTS, CSP et signatures Stripe/Resend sont conservés. Limite des corps vérifiée aussi sans Content-Length par le middleware Hono.
- Pas de confirmation depuis `success_url`. Relecture Stripe et déduplication avant billets. Remboursements ciblés, montants serveur, clés idempotentes, résultat réussi monotone et rapprochement requis après ambiguïté. Les anciens remboursements non ventilés bloquent une nouvelle annulation individuelle jusqu’à rapprochement.
- Une invitation de transfert seule ne suffit pas : destinataire au courriel vérifié, conditions et consentements personnels, délai et renouvellement du QR. L’ancien compte ne récupère plus les nouveaux renseignements personnels via l’export.
- Brouillons invités chiffrés, jeton haché, cookie HttpOnly, expiration et attribution atomique. Sur un autre navigateur, le brouillon invité n’est pas récupérable sans ce cookie; l’URL d’activité reste conservée.
- Secours limité au personnel autorisé et propriétaire de la préparation, validité 24 h, reçus idempotents et journalisation. Coffre local chiffré et phrase non enregistrée. Un navigateur compromis ou une phrase faible reste un risque; les listes doivent être effacées après usage. Deux appareils isolés peuvent accepter provisoirement le même billet : le serveur signale le conflit.
- Pas de QR complets dans la liste de secours, pas de coordonnées d’urgence dans cette liste. Jamais de clés, tokens, réponses privées ou carte dans les journaux applicatifs. Logs d’invocation désactivés; codes d’erreur structurés.
- Médias : permission événement, WebP contrôlé par signature, limite 1 Mo, clés aléatoires, MIME et `nosniff`. Pas d’upload SVG actif. Stockage R2 facultatif non activé.
- Analytics : compteurs agrégés, pas d’identité ou de réponses. Les hachages IP des limites de sécurité restent séparés des événements analytics et expirent.
- `/api/health` donne uniquement un état minimal; diagnostic des manques et des files réservé au personnel autorisé. Les pages privées ont `no-store` et `noindex`. Pas de service worker qui mette en cache des données personnelles.

La présence des secrets est annoncée par le site de production existant; leur valeur n’a pas été lue ou remplacée. Les politiques MFA, les webhooks et la livraison réelle ne sont pas certifiés par les fixtures. Aucun test n’a débité, remboursé, envoyé un courriel réel ou altéré une inscription existante.
