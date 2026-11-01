# Parents, galerie et accès à l’administration

## Participation des mineurs

Le vélo reste réservé aux personnes de 18 ans et plus le jour de l’événement. La course et la marche acceptent tous les âges. On demande la catégorie d’âge au jour de l’événement, sans date de naissance.

1. L’enfant crée son compte avec prénom, nom, courriel, mot de passe et vérification par code à six chiffres.
2. Il choisit la course ou la marche, complète les renseignements de participation, indique « Moins de 18 ans » et le courriel du parent ou tuteur, puis demande l’autorisation. Le brouillon est enregistré dans son compte.
3. Le parent reçoit une invitation à ouvrir `/autorisations-parentales`. Il doit créer son propre compte, ou s’y connecter, avec l’adresse désignée. Le même mot de passe et code courriel que pour les autres comptes sont utilisés; aucune vérification par lien n’est nécessaire.
4. Le parent examine la personne, l’activité, les renseignements, les conditions et les choix de consentement. Il indique son nom, son lien avec le participant, déclare être majeur et parent/tuteur, puis autorise ou refuse.
5. L’enfant reprend son inscription depuis son compte, actualise l’autorisation, relit les conditions, puis termine la réservation et le paiement si nécessaire. Sur un appareil partagé, « Changer de compte » permet de passer du compte enfant au compte parent; le brouillon reste disponible.

Avant l’accord : aucune place réservée, commande d’inscription, demande de paiement ou billet. Une simple demande de liste d’attente ne réserve aucune place; elle ne peut devenir une inscription sans autorisation. Le parent ne reçoit pas les droits de paiement ou les billets du compte enfant.

L’autorisation est liée à la personne, au compte participant, à l’activité, à la date de l’événement, à la version du formulaire, aux conditions et aux choix de consentement. Elle est valable sept jours avant utilisation et utilisable une seule fois. Une modification de ces éléments exige une nouvelle demande. Après réservation, sa preuve reste conservée avec le dossier. Les changements d’identité et les transferts d’une participation mineure sont bloqués pour préserver cette preuve. L’organisation peut corriger un contact; une autre personne ou activité nécessite un nouveau parcours d’autorisation.

Le courriel est vérifié et le lien parental est déclaré par le parent connecté : le site ne prétend pas vérifier une pièce d’identité ni le lien familial auprès d’un registre. L’administrateur autorisé voit l’accord, son auteur et sa date dans la fiche de participation. Les invitations et décisions parentales restent exclues du journal général des communications.

## Galerie compacte

Les photos publiées d’une même section sont regroupées dans un album : cadre de taille stable, flèches, miniatures horizontales, compteur et agrandissement. Le nombre de photos n’ajoute plus une rangée verticale par image. Les légendes longues sont limitées dans l’album et lisibles dans l’agrandissement.

Le changement automatique se fait toutes les six secondes. Il s’interrompt au survol, au focus clavier, quand l’album est hors écran, quand l’onglet est masqué ou pendant l’agrandissement. Le bouton Pause/Lecture auto laisse le choix au visiteur. La préférence de réduction des mouvements désactive la lecture automatique initiale. Flèches, miniatures, touches gauche/droite, Début/Fin et balayage tactile permettent de naviguer; Échap ferme l’agrandissement.

Les réglages « Afficher sur le site », la section des photos et leur contenu restent ceux enregistrés par l’organisation. Les visuels de recette des captures sont exclusivement locaux et portent la mention « Démonstration locale ».

## Administration et erreur réseau Access

Cette protection concerne maintenant l’administration principale. Les organisateurs et bénévoles utilisent le nouvel [espace équipe avec les permissions du site](EQUIPE-PARTICIPANTS-COURRIELS.md), sans inscription individuelle dans Cloudflare Access.

L’entrée dans `/admin` utilise maintenant une vraie navigation de page afin de passer la connexion Cloudflare Access. Si la session Access de l’API manque ou expire, l’interface affiche « Vérifier mon accès administrateur ». Ce lien ouvre `/api/admin/access`, vérifie le jeton Access signé, puis revient à `/admin`. La session du site et les permissions restent nécessaires pour lire les dossiers.

Une action interrompue, notamment un remboursement, n’est jamais rejouée automatiquement. Après réauthentification, vérifier l’état du dossier avant de reprendre une action. Une erreur réseau ordinaire reste distinguée d’une demande de connexion Access.

Dans Cloudflare, garder `/admin` et `/api/admin/*` dans **la même application Access**, avec le même fournisseur d’identité, la même politique et la protection requise. Le jeton doit correspondre au domaine d’équipe, à l’AUD configuré et au courriel connecté. Aucun contournement de MFA ou relâchement CORS n’est ajouté.

## Dons et mise à jour

Les liens existants conduisent toujours à la page de collecte **Ride For Brains**, hébergée sur la plateforme officielle de collecte de fonds de Brain Canada. Les textes de destination le précisent; les frais d’inscription restent distincts des dons.

Suivre [la mise à jour du site existant](MISE-A-JOUR-SITE-EXISTANT.md) puis lancer `npm run deploy`. La migration `0009_guardian_authorizations.sql` ajoute les demandes et preuves d’autorisation, adapte la règle d’âge et publie une nouvelle version des conditions courantes. Elle conserve les anciens comptes, commandes, conditions acceptées et réglages de services. Les anciennes inscriptions restent identifiées comme majeures, conformément à la règle qui s’appliquait lors de leur création. Les nouvelles conditions devront être relues pour les nouvelles inscriptions; les conditions déjà acceptées restent figées dans leurs dossiers.

Aucun nouveau service ni secret n’est requis. Les connexions Stripe, Resend, R2, D1, Turnstile, domaine et Access existantes sont conservées. Les modifications locales ne sont visibles en production qu’après publication.
