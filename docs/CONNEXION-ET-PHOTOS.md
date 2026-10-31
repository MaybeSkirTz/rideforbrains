# Connexion par mot de passe et code, et correction des photos

## Créer un compte

Sur `/connexion`, choisir **Créer mon compte**, saisir prénom, nom, courriel et mot de passe (10 caractères minimum), puis choisir **Se souvenir de moi** si souhaité. Un code de 6 chiffres est expédié avec Resend. Le saisir sur la page déjà ouverte pour vérifier l’adresse et ouvrir la session. Aucun lien de vérification ni retour depuis le courriel n’est requis.

## Se connecter et récupérer son accès

La connexion demande courriel et mot de passe, puis un nouveau code à 6 chiffres. Le code est valable 10 minutes, utilisable une fois et bloqué après 5 tentatives incorrectes. Un renvoi est possible après 60 secondes; seul le dernier code est valable. Le mot de passe est requis même si le code est connu.

**Mot de passe oublié / Définir mon mot de passe** sert à la récupération et aux comptes existants qui utilisaient un lien personnel. Saisir le courriel, recevoir le code, puis saisir ce code et le nouveau mot de passe sur la même page. Le même compte, son rôle et ses inscriptions sont conservés. Les anciennes sessions sont révoquées après la définition du nouveau mot de passe.

Sans la case **Se souvenir de moi**, la session utilise un cookie de navigateur et une clé propre à l’onglet conservée dans `sessionStorage`. Un nouvel onglet sans cette clé ne peut pas utiliser le cookie pour accéder aux données. La navigation interne et le rechargement du même onglet gardent la session. Avec la case, le cookie est persistant, avec une durée de 90 jours renouvelée à l’utilisation; une déconnexion ou un changement de mot de passe révoque toujours l’accès. Les mécanismes de restauration d’onglet du navigateur peuvent restaurer `sessionStorage`; aucune garantie de détection de fermeture forcée/crash du navigateur n’est annoncée.

Après publication, les anciennes sessions issues d’un lien doivent passer une fois par le nouveau parcours. Les anciennes routes de connexion sans code ne sont plus exposées. Les codes ne sont pas affichés dans le journal de communications ni dans l’espace participant. Les mots de passe sont hachés par Better Auth; les codes sont stockés sous une empreinte HMAC liée à leur demande, avec limitation des essais et des renvois.

## Photos

Le champ d’image utilisait `type="url"`, qui refuse nativement les adresses relatives `/media/...` renvoyées après un téléversement R2. Le navigateur bloquait l’enregistrement avant l’appel serveur et remettait le focus sur ce champ. Les champs d’image acceptent maintenant ces chemins et les URL HTTPS, avec aperçu. La validation des adresses reste effectuée sur le serveur. Les champs de liens externes conservent leur validation URL.

## Mise à jour du site existant

Depuis le dossier du projet, lancer `npm run deploy`, selon le [guide de mise à jour](MISE-A-JOUR-SITE-EXISTANT.md). La migration `0008_password_codes.sql` ajoute les prénoms/noms séparés, les demandes de code et les préférences de session. Elle ne supprime aucun compte ni aucune inscription. Aucun nouveau service ou secret n’est requis : les réglages Resend, Stripe, Turnstile, Cloudflare Access et R2 existants sont conservés. La protection Cloudflare Access de l’administration reste requise.

Vérifier ensuite la réception du code sur un compte de recette et l’enregistrement d’une photo autorisée. Ne pas créer de fausse commande payante pour cet essai.

## Vérifications effectuées

Les 88 tests isolés passent : mots de passe, création/vérification, récupération, ancien compte conservé, révocation des sessions, codes invalides/expirés/utilisés, verrouillage et renvoi, vérifications concurrentes, sessions temporaires/persistantes, refus des anciennes routes, conservation des parcours d’inscription, téléversement R2 et publication de la photo. Les tests Stripe et autres fonctions existantes passent aussi.

Le navigateur a servi à tester une création de compte fictif, la récupération d’un mot de passe, une session temporaire refusée dans un nouvel onglet après fermeture, et l’enregistrement d’une photo dont l’adresse et la légende restent présentes après rechargement. Le formulaire de code a été examiné à 390 px sans débordement horizontal. Les bases et compartiments de recette sont locaux, sans clés Stripe ou Resend; aucun courriel, paiement ou changement de compte réel n’a été effectué. La livraison réelle et les navigateurs physiques restent à vérifier après publication.
