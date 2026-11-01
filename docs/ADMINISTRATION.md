# Guide de l’administration

## Accéder

Se connecter par mot de passe et code à 6 chiffres sur `/connexion`. L’administrateur principal ouvre `/admin`, protégé en production par Cloudflare Access avec MFA. Les organisateurs et bénévoles ouvrent **Mon espace → Espace équipe** (`/organisation`), avec les permissions attribuées sur le site, sans ajout Cloudflare individuel. Pour un ancien compte, utiliser « Mot de passe oublié / Définir mon mot de passe ». Le rôle est lu côté serveur pour chaque opération. Voir [le guide des nouveaux accès et courriels](EQUIPE-PARTICIPANTS-COURRIELS.md).

| Rôle                     | Accès                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| Administrateur principal | Toute l’administration et gestion des accès                                                             |
| Organisateur             | Permissions attribuées : dossiers, export, remboursements, événement, communications, accueil, demandes |
| Bénévole d’accueil       | Recherche restreinte et validation des billets; aucun contact d’urgence, note interne ou export         |
| Participant              | Ses dossiers achetés avec ce compte et ses messages                                                     |

L’acheteur peut inscrire plusieurs personnes et gère tout ce dossier. Un participant inscrit par un autre acheteur ne reçoit pas automatiquement l’accès au compte ou aux dossiers de celui-ci. Le formulaire exige l’autorisation de transmettre les données et consentements pour chaque personne.

## Équipe et accès

Un administrateur principal peut retirer les accès de tout autre membre, y compris un autre administrateur : cliquer **Retirer les accès** sur sa ligne, puis confirmer. Son compte participant et ses inscriptions sont conservés. Ses prochaines requêtes d’équipe ou d’administration sont refusées; ses autorisations de synchronisation hors ligne sont invalidées. Une attribution ultérieure d’accès ne réactive pas les anciennes listes de secours.

Votre propre ligne affiche **Votre accès**, sans bouton de retrait, pour éviter de vous bloquer. Le retrait est consigné dans le journal d’audit. Le rôle principal ne supprime pas l’exigence Cloudflare Access pour gérer ces droits en production.

## Vue d’ensemble

Les nombres viennent de D1 : activités et statuts, recettes d’inscription reçues, remboursements, montants en attente, liste d’attente et présences. Les recettes nettes affichées sont avant les frais Stripe. Les dons Brain Canada ne sont pas inclus. Le bouton Actualiser relit la base.

Traiter les alertes `paid_review` en priorité : un paiement reçu n’a pas donné droit à un billet. Le dossier montre la commande et permet, si les permissions le permettent, de demander un remboursement.

## Participants

Rechercher par nom, courriel ou numéro complet; filtrer par activité et statut, puis changer de page. Ouvrir un nom pour voir le dossier, le formulaire tel qu’accepté, ses réponses, les consentements, le texte des conditions et l’historique.

Les corrections des noms, téléphones et contacts d’urgence sont journalisées. Les notes internes ne sont pas exposées aux participants. La sélection de lignes permet de préparer une communication; l’envoi demande un aperçu et la confirmation du nombre réel de destinataires. Un export CSV exige la permission d’export et neutralise les débuts de cellules interprétables comme des formules.

Le renvoi d’une confirmation ajoute un message à la file. En développement il reste dans la boîte locale. Il n’est jamais présenté comme un courriel déjà livré.

### Annuler et rembourser

Le participant peut annuler **la commande entière**, y compris toutes ses participations. La date et la règle de remboursement sont conservées au moment de l’inscription. À 15 jours ou plus : demande de remboursement intégral du solde. À moins de 15 jours : annulation sans remboursement. Une annulation gratuite ne déclenche aucune transaction bancaire.

Un administrateur autorisé peut demander un remboursement partiel ou total de la commande, avec un motif obligatoire et une confirmation. Le montant ne peut pas dépasser le solde payé. Un remboursement partiel conserve les billets valides; un remboursement complet les invalide. Vérifier l’activité et toutes les personnes incluses dans la commande avant d’agir. Les remboursements sont réels lorsque des clés Stripe réelles sont utilisées : conserver les clés test durant toute la validation.

## Événement

Modifier la date, l’accueil, le lieu, le contact, les horaires de vente, le tarif de chaque activité, les quotas, les parcours et leurs liens carte/GPX. Un quota vide signifie sans limite. Le serveur refuse une réduction sous le nombre de places actives.

Les pages pratiques affichent « à confirmer » lorsqu’aucun lieu ou parcours n’est publié. Les champs GPX et carte n’inventent pas de tracé : fournir un lien HTTPS réel. Les tracés GPX sont hébergés séparément. Les photos peuvent être téléversées avec la liaison R2 MEDIA.

Les textes de l’histoire, de la cause, des politiques et des FAQ se modifient sans toucher au code. FAQ, photos et partenaires utilisent des tableaux JSON dans l’interface avancée. Une erreur de JSON conserve la dernière version valide et s’affiche à l’écran. Publier uniquement les photos et logos dont l’utilisation est autorisée. La version des conditions doit changer dès que leur texte change; les anciennes inscriptions conservent leur texte original.

Les cinq activités sont les catégories de cette édition. Cette version ne permet pas encore de créer une autre édition parallèle ni une nouvelle activité depuis l’interface; une évolution du schéma/administration est nécessaire pour cela. Modifier l’événement courant ne remplace pas les snapshots des dossiers existants.

## Retirer une commande complète

Dans Participants, ouvrir une fiche puis choisir **Retirer toute la commande**. La confirmation liste toutes les personnes concernées, le montant payé après rabais, les remboursements antérieurs et le nouveau montant demandé. Indiquer le motif privé, cocher la confirmation, puis valider. Cette action est réservée au rôle administrateur, même si un organisateur a des permissions de remboursement.

Toutes les participations de cette commande disparaissent des listes, exports et statistiques métier. Leurs billets deviennent invalides et les invitations de transfert sont annulées. Les nouveaux envois ciblés excluent ces participations; un courriel déjà transmis au prestataire ne peut pas être rappelé. Une trace comptable est conservée dans **Retraits privés** avec le motif, l’admin, la date, le montant demandé et l’état Stripe. Il ne s’agit pas d’un effacement des renseignements personnels.

Le montant remboursable est calculé par le serveur : montant réellement payé après promotion, moins les remboursements déjà effectués. La politique acceptée à l’achat s’applique : à 15 jours ou plus de l’événement, remboursement du solde admissible; à moins de 15 jours, aucun remboursement. Une inscription gratuite n’entraîne aucun remboursement. Un remboursement déjà en cours ou à rapprocher doit être résolu avant le retrait. Un paiement confirmé tardivement reste rattaché à la trace privée et ne réactive aucun billet.

L’acheteur et l’admin qui agit reçoivent la confirmation du retrait. Le courriel initial distingue une demande de remboursement de sa réussite. Stripe doit confirmer la réussite avant l’envoi de la confirmation finale du remboursement. Le journal de courriels indique l’état réel d’envoi/livraison; la mise en file ne garantit pas la réception.

## Cartes des parcours

Les coordonnées GPX déjà importées sont affichées automatiquement sur un fond OpenStreetMap dans la page de chaque activité. La carte se centre sur le GPX et permet de voir les routes en zoomant. Pour remplacer un tracé, importer le fichier dans l’activité puis enregistrer; aucun autre compte ni clé n’est nécessaire. Voir [les cartes GPX](CARTES-GPX.md).

## Photos

Le compartiment privé R2 utilisé est `ride-for-brains-media`. Dans Cloudflare : Workers et Pages → ride-for-brains → Liaisons / Bindings → Ajouter une liaison → Compartiment R2. Nom de variable : **MEDIA**; compartiment : **ride-for-brains-media**. Enregistrer et déployer si demandé. Il n’est pas nécessaire d’activer une adresse publique R2 : le site sert les images par son propre chemin `/media/`.

Le fichier `wrangler.json` contient cette même liaison pour les prochaines publications. Dans l’éditeur, une vérification indique si le Worker possède réellement le stockage. Après configuration, utiliser **Revérifier le stockage**. Les photos JPEG, PNG, WebP ou AVIF de moins de 15 Mo sont converties en WebP de 1 Mo maximum avant envoi. Une URL HTTPS reste utilisable sans téléversement.

## Formulaires

### Participants mineurs

Le vélo reste réservé aux 18 ans et plus. Pour la course et la marche, un mineur prépare son inscription depuis son compte puis demande l’accord d’un parent disposant d’un compte distinct. La page `/autorisations-parentales` présente les demandes au parent connecté avec l’adresse désignée. Aucune réservation ni paiement ne peut précéder l’accord. La fiche de participation conserve le nom et le courriel du parent, sa déclaration, la date et la version des conditions. L’identité du participant mineur reste verrouillée pour préserver cet accord. Voir [le guide parents, galerie et accès](PARENTS-GALERIE-ACCES.md).

Choisir une activité, ajouter/réordonner/retirer des questions, choisir texte, liste ou case à cocher, indiquer les obligations et les conditions d’affichage. Les identifiants sont stables. Prévisualiser, puis publier la nouvelle version après confirmation.

Les réponses existantes ne sont jamais effacées par cette publication. Une personne utilisant un ancien formulaire doit recharger la page avant de confirmer. Ne pas ajouter de questions médicales ou sensibles sans nécessité décidée explicitement et traitement adapté.

## Communications

Choisir toute la liste confirmée, une activité ou une sélection issue du tableau des participants. Une adresse partagée reçoit un seul message et les variables correspondent alors à une participation de cette adresse. Pour des informations spécifiques à chaque dossier, écrire depuis sa fiche ou scinder les sélections.

Écrire un texte clair avec `{{prenom}}`, `{{activite}}`, `{{numero}}`. Les modèles sont enregistrés dans D1 et accessibles à l’équipe autorisée. Prévisualiser et compter les destinataires, puis confirmer la mise en file. Une date permet de programmer un rappel; l’envoi intervient au passage du cron après cette date. Les confirmations de chaque inscription sont automatiques après validation du paiement.

Les messages opérationnels restent distincts du marketing. Ce dernier exige un consentement et respecte les désabonnements. Suivre le journal pour les états réellement fournis par le prestataire et les reprises. Les erreurs ambiguës de plus de 23 heures nécessitent un rapprochement manuel avec le prestataire avant réémission.

## Accueil du jour J

Ouvrir Accueil / QR sur un téléphone, autoriser la caméra, scanner puis confirmer. Le code contient uniquement un identifiant opaque aléatoire. La recherche manuelle permet aussi de retrouver une personne. Un billet non confirmé, annulé ou déjà utilisé est refusé. L’annulation d’une présence exige une permission supérieure et laisse une trace.

La caméra exige un navigateur compatible et HTTPS (ou localhost pour le développement). Le décodage est local dans le navigateur; l’image de caméra n’est pas téléversée. Aucun mode hors ligne n’est annoncé : les contrôles de validité sont faits sur le serveur.

## Demandes et journal

Les formulaires de contact, bénévolat et partenariat arrivent dans Demandes reçues. Leur statut peut passer à En cours puis Traité. Les demandes de suppression de données arrivent aussi dans cette liste. Répondre depuis les communications ou son client de messagerie.

Le journal d’audit est réservé à l’administrateur principal. Il trace les changements, exports, remboursements, envois et présences. Il ne contient pas de données bancaires ni de lien de connexion personnel.
