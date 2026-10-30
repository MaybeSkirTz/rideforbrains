# Guide de l’administration

## Accéder

Se connecter par lien personnel sur `/connexion`, puis ouvrir `/admin`. Le compte doit être promu par la procédure du README ou par un administrateur principal. En production, passer aussi par Cloudflare Access configuré avec MFA. Le rôle est lu côté serveur pour chaque opération.

| Rôle                     | Accès                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| Administrateur principal | Toute l’administration et gestion des accès                                                             |
| Organisateur             | Permissions attribuées : dossiers, export, remboursements, événement, communications, accueil, demandes |
| Bénévole d’accueil       | Recherche restreinte et validation des billets; aucun contact d’urgence, note interne ou export         |
| Participant              | Ses dossiers achetés avec ce compte et ses messages                                                     |

L’acheteur peut inscrire plusieurs personnes et gère tout ce dossier. Un participant inscrit par un autre acheteur ne reçoit pas automatiquement l’accès au compte ou aux dossiers de celui-ci. Le formulaire exige l’autorisation de transmettre les données et consentements pour chaque personne.

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

Les pages pratiques affichent « à confirmer » lorsqu’aucun lieu ou parcours n’est publié. Les champs GPX et carte n’inventent pas de tracé : fournir un lien HTTPS réel. Les fichiers sont hébergés séparément; aucun téléversement R2 n’est intégré à cette version.

Les textes de l’histoire, de la cause, des politiques et des FAQ se modifient sans toucher au code. FAQ, photos et partenaires utilisent des tableaux JSON dans l’interface avancée. Une erreur de JSON conserve la dernière version valide et s’affiche à l’écran. Publier uniquement les photos et logos dont l’utilisation est autorisée. La version des conditions doit changer dès que leur texte change; les anciennes inscriptions conservent leur texte original.

Les cinq activités sont les catégories de cette édition. Cette version ne permet pas encore de créer une autre édition parallèle ni une nouvelle activité depuis l’interface; une évolution du schéma/administration est nécessaire pour cela. Modifier l’événement courant ne remplace pas les snapshots des dossiers existants.

## Formulaires

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
