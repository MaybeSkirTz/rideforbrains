import { currentLocale, type Locale } from '../shared/locale.ts';

const englishCopy = `
Vélo|Cycling
Course|Running
Marche|Walking
Rouler|Ride
Courir|Run
Marcher|Walk
Ajouter à mon calendrier|Add to my calendar
Télécharger le calendrier (.ics)|Download calendar (.ics)
L’édition|The edition
Aujourd’hui|Today
Retrouvez notre histoire|Read our story
Le jour du rendez-vous|Event day
Souvenirs / Première édition|Memories / First edition
· Première édition|· First edition
Les souvenirs de Ride For Brains|Ride For Brains memories
Dans les médias|In the media
Ride For Brains, deuxième édition|Ride For Brains, second edition
Vélo · Course · Marche|Cycling · Running · Walking
par activité · Vélo 18+|per activity · Cycling 18+
Course et marche : tous les âges, accord parental avant 18 ans|Running and walking are open to all ages. Parental authorization is required under 18.
Choisir mon activité|Choose my activity
Soutenir la collecte Ride For Brains|Support the Ride For Brains fundraiser
L’esprit de l’événement|The spirit of the event
Découvrir la première édition|Discover the first edition
RFB / Connexions en mouvement|RFB / Connections in motion
Comprendre la cause ↗|Explore the cause ↗
Vélo / Course / Marche|Cycling / Running / Walking
Trois façons de participer|Three ways to take part
À chacun son mouvement.|Move your way.
Voir qui prend le départ|See who’s taking part
Le rendez-vous|The event
Accueil dès|Check-in opens at
Lieu|Location
Préparer ma journée|Plan my day
Vélo, course et marche|Cycling, running and walking
Choisissez votre mouvement.|Choose your challenge.
Choisir un sport|Choose a sport
Toutes les activités|All activities
place(s) disponible(s)|spots available
Inscriptions ouvertes|Registration open
par personne et par activité|per person, per activity
Rejoindre la liste d’attente|Join the waitlist
S’inscrire|Register
Voir les participants|See participants
Voir cette activité|View this activity
Le parcours|The route
Parcours à venir.|Route details to come.
Départ|Start
Dénivelé positif|Elevation gain
Point de départ|Starting point
Arrivée|Finish
Chargement du tracé…|Loading route…
Consulter la carte|View map
Télécharger le GPX|Download GPX
Photos de|Photos from
Préparer sa journée|Plan your day
Les repères du départ.|What to know before you go.
Les renseignements confirmés sont réunis ici. Le reste sera ajouté à mesure que l’organisation se précise.|Confirmed details are listed here. More will be added as plans are finalized.
Date|Date
Accueil|Check-in
Lieu de départ|Starting location
Départs des activités|Activity start times
Les parcours|Routes
Parcours disponible.|Route available.
Ravitaillements :|Refreshment stops:
Voir la carte du parcours|View the route map
Informations sur cette activité|Activity details
Votre billet|Your ticket
Votre billet sera disponible dans votre espace après confirmation du paiement. Présentez son code QR à l’accueil.|Your ticket will appear in your account after payment is confirmed. Show its QR code at check-in.
D’autres questions ?|More questions?
L’équipe|The team
Derrière la ligne de départ.|Behind the starting line.
Ils parlent de Ride For Brains|Ride For Brains in the news
Le départ et l’arrivée en images|Photos from the start and finish
Nous écrire|Email us
Donner un coup de main|Lend a hand
L’équipe en images|Photos of the team
La cause|The cause
Le mouvement, pour la recherche.|Moving together for research.
Les connexions du cerveau : le lien avec la recherche que soutient la collecte officielle.|Brain connections illustrate the research supported by the official fundraiser.
Deux gestes distincts.|Two ways to contribute.
Faire un don sur Brain Canada|Donate through Brain Canada
Les réponses utiles|Helpful answers
Avant de prendre le départ.|Before you head to the start.
Une autre question ? Écrivez-nous|Still have a question? Contact us
Mon espace|My account
Mon jour J|My event day
Les équipes|Teams
Pourquoi je participe|Why I take part
Pour eux|For them
Ma communauté|My community
Notre impact|Our impact
Où va mon argent?|Where does my money go?
Espace équipe|Staff area
Les participants|Participants
Autorisations parentales|Parental authorizations
Les activités|Activities
Infos pratiques|Practical information
Notre histoire|Our story
Réessayer|Try again
Chaque kilomètre commence ici…|Every kilometre starts here…
Chargement du reçu…|Loading receipt…
Chargement du billet…|Loading ticket…
Chargement…|Loading…
Chargement de l’administration…|Loading administration…
Hors parcours|Off course
Cette page n’existe pas.|This page does not exist.
Revenir à l’accueil|Back to home
Aller au contenu|Skip to content
Aperçu local · aucun paiement réel|Local preview · no live payments
Mode test · aucun paiement réel|Test mode · no live payments
Boîte de courriels locale|Local inbox
Ride For Brains, accueil|Ride For Brains, home
Navigation principale|Main navigation
Je participe|Take part
Fermer le menu|Close menu
Ouvrir le menu|Open menu
Se connecter / S’inscrire|Sign in / Register
S’inscrire —|Register —
ON SE RETROUVE SUR LA LIGNE DE DÉPART.|SEE YOU AT THE STARTING LINE.
On se retrouve|See you
au départ|at the start
Trouver mon activité|Find my activity
Pour eux, chaque kilomètre compte.|For them, every kilometre counts.
Réseaux sociaux|Social media
L’événement|The event
Renseignements pratiques|Practical information
Questions fréquentes|Frequently asked questions
Ensemble|Together
Devenir bénévole|Volunteer
Devenir partenaire|Become a partner
Nous joindre|Contact us
Faire un don|Donate
Votre espace|Your account
Mes inscriptions|My registrations
Conditions d’inscription|Registration terms
Annulation et remboursement|Cancellations and refunds
Confidentialité|Privacy
Histoires de participants|Participant stories
L’équipe a besoin de votre énergie.|The team could use your energy.
Faisons du chemin ensemble.|Let’s go further together.
On garde le contact.|Let’s stay in touch.
Dites-nous comment vous aimeriez contribuer. L’organisation vous recontactera.|Tell us how you’d like to help. The organizers will get back to you.
Soutenez un rendez-vous de vélo, course et marche au service de la recherche sur le cerveau. Construisons ensemble un partenariat adapté.|Support a cycling, running and walking event for brain research. Let’s find a partnership that fits.
Une question sur votre inscription ou sur la journée? Écrivez-nous.|Questions about your registration or event day? Get in touch.
Parlons-en.|Let’s talk.
Thomas · Équipe Ride For Brains|Thomas · Ride For Brains team
Votre nom|Your name
Votre courriel|Your email
Téléphone (facultatif)|Phone (optional)
Vos disponibilités|Your availability
Rôle préféré|Preferred role
Je suis disponible selon les besoins|I’m happy to help where needed
Comment aimeriez-vous aider ?|How would you like to help?
Entreprise / organisation|Company / organization
Disponibilités et tâches qui vous intéressent|Availability and tasks you’re interested in
Votre message|Your message
J’accepte que l’équipe utilise ces renseignements pour répondre à ma demande.|I agree that the team may use this information to respond to my request.
Transmettre ma demande|Submit my request
Vos données, avec attention.|Your information, handled with care.
Annulation et remboursement.|Cancellations and refunds.
Les conditions de participation.|Participation terms.
Une règle simple|A simple rule
À 15 jours ou plus du début de l’événement : remboursement complet de l’inscription. À moins de 15 jours : aucun remboursement.|A full refund is available at least 15 days before the event starts. Within 15 days of the event, registration is non-refundable.
Le calcul utilise le début de l’événement, fixé au|The deadline is based on the event start on
, heure du Québec. Vous pouvez annuler une seule participation ou tout le dossier. Le remboursement admissible porte sur le montant effectivement payé après rabais, diminué des remboursements déjà reçus.|, Quebec time. You can cancel one participation or the entire order. Any eligible refund is based on the amount actually paid after discounts, less any refunds already issued.
La demande se fait depuis l’espace de l’acheteur. Un remboursement est confirmé seulement après son traitement par le prestataire.|Request a refund from the buyer’s account. Refunds are confirmed after the payment provider processes them.
Les dispositions en cas d’annulation ou de report par l’organisation restent à valider avant ouverture.|The organizers’ cancellation and postponement terms are awaiting approval.
Annulation par l’organisation|Cancellation by the organizers
Météo|Weather
Force majeure|Force majeure
Les cartes des parcours affichent les coordonnées GPX publiées par l’organisation sur un fond OpenStreetMap. Quand vous ouvrez la page d’un parcours, votre navigateur demande les images de carte à ce service et lui transmet notamment votre adresse IP. La carte ne demande pas votre position GPS et ne transmet pas les renseignements de votre compte.|Route maps show the organizers’ published GPX tracks on OpenStreetMap. When you open a route page, your browser requests map tiles from that service and shares your IP address. The map does not request your GPS location or share account details.
Confidentialité d’OpenStreetMap|OpenStreetMap privacy policy
Version des conditions :|Terms version:
Contacter le responsable|Contact the person responsible
LISTE D’ATTENTE|WAITLIST
Gardons une place pour votre élan.|Join the waitlist.
L’inscription sur cette liste ne réserve aucune place et ne déclenche aucun paiement.|Joining the waitlist does not reserve a spot or initiate payment.
Activité introuvable.|Activity not found.
Connectez-vous pour rejoindre la liste d’attente. Revenez ensuite sur cette activité.|Sign in to join the waitlist, then return to this activity.
Me connecter|Sign in
Votre demande est enregistrée. L’équipe doit vous contacter si une place devient disponible; aucune inscription n’est confirmée automatiquement.|Your request is recorded. The organizers will contact you if a spot opens up. Registration is not confirmed automatically.
Prénom|First name
Nom|Last name
J’aurai au moins 18 ans le jour de l’événement.|I will be at least 18 on event day.
Âge le jour de l’événement|Age on event day
Choisissez|Select an option
18 ans ou plus|18 or older
Moins de 18 ans|Under 18
La liste d’attente n’est pas une inscription. Pour participer, un mineur devra obtenir l’accord d’un parent depuis son propre compte.|The waitlist does not confirm registration. A participant under 18 needs authorization from a parent using their own account.
Sauvegardé|Saved
Sauvegarde interrompue. Réessayez avant de quitter.|Saving was interrupted. Try again before leaving.
Votre brouillon a été restauré. Relisez et acceptez de nouveau les conditions avant de confirmer.|Your draft was restored. Review and accept the terms again before confirming.
Impossible de retrouver votre brouillon pour le moment. Réessayez avant de continuer.|Your draft could not be retrieved. Try again before continuing.
Votre brouillon est enregistré dans votre compte. Aucune place n’est réservée.|Your draft is saved to your account. No spot has been reserved.
Votre brouillon est conservé de façon sécurisée pendant deux heures sur ce navigateur. Aucune place n’est réservée.|Your draft is saved securely in this browser for two hours. No spot has been reserved.
Le parent doit d’abord autoriser chaque participation mineure depuis son propre compte.|A parent must first authorize each under-18 participant from their own account.
VOTRE PROCHAIN DÉPART|YOUR NEXT CHALLENGE
Faites partie du mouvement.|Be part of the movement.
Une inscription par personne et par activité. Les dons à Brain Canada se font séparément.|One registration per person, per activity. Donations to Brain Canada are made separately.
Les inscriptions ouvriront bientôt.|Registration opens soon.
Les activités et leurs tarifs sont déjà disponibles. L’organisation annoncera l’ouverture dès que tous les renseignements seront confirmés.|Activities and prices are available now. The organizers will announce when registration opens once details are confirmed.
Explorer les activités|Explore activities
Enregistrer pour plus tard|Save for later
Le choix|Your choices
Le récapitulatif|Review
Nous retrouvons votre brouillon…|Retrieving your draft…
Quel sera votre mouvement?|What’s your challenge?
Participation|Entry
Retirer la participation|Remove entry
Ajouter une personne ou une activité|Add a person or activity
Code promotionnel (facultatif)|Promo code (optional)
Aucune donnée médicale n’est demandée.|We do not ask for medical information.
Qui prend le départ?|Who’s taking part?
Participant|Participant
À compléter|Incomplete
Copier le contact d’urgence de|Copy emergency contact from
Utiliser le même téléphone|Use the same phone number
Courriel du participant|Participant email
Téléphone|Phone
Contact d’urgence · nom|Emergency contact · name
Contact d’urgence · téléphone|Emergency contact · phone
Cette personne aura au moins 18 ans le jour de l’événement.|This person will be at least 18 on event day.
Âge de cette personne le jour de l’événement|This person’s age on event day
Moins de 18 ans — autorisation parentale requise|Under 18 — parental authorization required
Je suis cette personne ou j’ai son autorisation pour l’inscrire et transmettre ses consentements.|I am this person, or I have their permission to register them and submit their consent choices.
J’ai lu et j’accepte les conditions ci-dessous pour cette participation.|I have read and accept the terms below for this participation.
J’accepte les photos et vidéos de cette personne pour les communications de l’événement. (Facultatif)|I consent to photos and videos of this person being used in event communications. (Optional)
Cette personne souhaite recevoir les communications promotionnelles. (Facultatif)|This person wishes to receive promotional communications. (Optional)
La demande et votre brouillon sont enregistrés. Vous pourrez reprendre cette inscription après l’accord du parent.|Your request and draft are saved. You can resume registration after the parent authorizes it.
Conditions · version|Terms · version
Tout est prêt pour le départ?|Ready for the starting line?
PARTICIPATION|ENTRY
Relire les réponses et consentements|Review answers and consent choices
Téléphone :|Phone:
Urgence :|Emergency:
Photos :|Photos:
· Promotions :|· Promotions:
Liste publique :|Public list:
Conditions acceptées ·|Terms accepted ·
Cette inscription est gratuite après application du tarif ou de la réduction.|This registration is free after the price or discount is applied.
Le paiement s’effectue sur une page sécurisée. Vous retrouverez ensuite votre confirmation et vos billets ici.|Payment takes place on a secure page. Your confirmation and tickets will appear here.
Retour|Back
Créer un compte ou me connecter|Create an account or sign in
Confirmer mon inscription|Confirm my registration
Payer|Pay
VOTRE RENDEZ-VOUS|YOUR EVENT
Lieu à confirmer|Location to be confirmed
Réduction|Discount
Dollars canadiens.|Canadian dollars.
Taxes incluses.|Taxes included.
Taxes non applicables selon la configuration de l’organisation.|Taxes do not apply under the organizers’ settings.
Fiscalité à valider avant l’ouverture réelle.|Tax settings are pending before live registration.
Remboursement à 100 % à 15 jours ou plus de l’événement. Aucun remboursement à moins de 15 jours.|Full refund at least 15 days before the event. No refunds within 15 days.
Lire la politique|Read the policy
VOTRE ESPACE|YOUR ACCOUNT
Vos inscriptions vous attendent.|Your registrations are here.
Annuler uniquement cette participation? Les autres participations restent valides. Le remboursement dépend du délai de 15 jours.|Cancel only this participation? Other entries remain valid. The 15-day deadline determines refund eligibility.
Annuler toutes les participations de ce dossier? Le remboursement sera calculé selon la politique affichée.|Cancel all entries in this order? Any refund will be calculated under the published policy.
Demande enregistrée. Remboursement en traitement :|Request recorded. Refund processing:
Dossier annulé.|Order cancelled.
Coordonnées mises à jour.|Contact information updated.
VOTRE ESPACE PARTICIPANT|YOUR PARTICIPANT ACCOUNT
Bonjour|Hello
Les dossiers ci-dessous sont ceux que vous avez inscrits avec ce compte.|These are the registrations associated with this account.
Ajouter une inscription|Add a registration
Me déconnecter|Sign out
Le paiement a été interrompu. La réservation expirera automatiquement. Aucun billet n’est délivré tant que le paiement n’est pas confirmé.|Payment was interrupted. The reservation will expire automatically. Tickets are issued after payment is confirmed.
Chargement des dossiers…|Loading registrations…
Votre prochain défi vous attend.|Your next challenge awaits.
Aucune inscription pour le moment.|No registrations yet.
Découvrir les activités|Explore activities
Prix de cette participation|Price of this entry
Paiement et reçu du dossier|Order payment and receipt
Total / remboursé|Total / refunded
Reçu de paiement|Payment receipt
Mes réponses et consentements|My answers and consent choices
Conditions acceptées le|Terms accepted on
· Communications promotionnelles :|· Promotional communications:
Texte des conditions acceptées|View the accepted terms
Contact d’urgence|Emergency contact
Téléphone d’urgence|Emergency phone
Enregistrer les coordonnées|Save contact details
Préparer mon jour J|Plan my event day
Voir mon QR|View my QR code
Ouvrir mon billet|Open my ticket
Annuler cette participation|Cancel this participation
Annuler tout le dossier|Cancel the entire order
Reprendre le paiement|Resume payment
Les messages de l’organisation|Messages from the organizers
Mes données personnelles|My personal information
Exporter mes données|Export my data
Transmettre une demande de suppression au responsable?|Send a deletion request to the person responsible?
Demander la suppression de mes données|Request deletion of my data
Fermer|Close
Code QR du billet, à présenter à l’accueil|Ticket QR code to show at check-in
Billet personnel · Nº|Personal ticket · No.
Télécharger le QR|Download QR code
Conservez cette image pour la présenter à l’accueil.|Keep this image to show at check-in.
VOS PRÉFÉRENCES|YOUR PREFERENCES
Gardez le lien à votre façon.|Stay in touch your way.
Vous pouvez vous désabonner des messages promotionnels. Les informations nécessaires à votre participation restent accessibles dans votre espace.|You can unsubscribe from promotional messages. Event information you need remains available in your account.
Vous êtes désabonné des communications promotionnelles.|You’ve unsubscribed from promotional communications.
Confirmer mon désabonnement|Confirm unsubscribe
Si la demande est valide, un nouveau code vous est envoyé. Seul le dernier code reçu fonctionne.|If the request is valid, a new code will be sent. Only the latest code works.
Votre compte|Your account
Vous êtes connecté.|You’re signed in.
Votre compte et vos billets vous attendent.|Your account and tickets are ready.
Continuer|Continue
Votre compte Ride For Brains|Your Ride For Brains account
Entrez votre code.|Enter your code.
Votre première participation commence ici.|Your first challenge starts here.
Bon retour parmi nous.|Welcome back.
Votre mot de passe.|Your password.
On se retrouve au départ.|See you at the start.
Votre compte vous permet de retrouver vos inscriptions et vos billets.|Find your registrations and tickets in your account.
pour la première fois.|for the first time.
Créez votre compte avec votre prénom, nom, courriel et mot de passe.|Create your account with your first name, last name, email and password.
Créer mon compte|Create my account
J’ai déjà|I already have
un compte.|an account.
Connectez-vous avec votre courriel, votre mot de passe et un code de vérification.|Sign in with your email, password and a verification code.
Un code à 6 chiffres.|A 6-digit code.
Si cette adresse correspond à un compte, un code a été envoyé à|If this address belongs to an account, a code was sent to
Nous avons envoyé un code à|We sent a code to
Saisissez-le ici. Il est valable 10 minutes. Vous restez sur cette page; aucun lien à ouvrir.|Enter it here. It’s valid for 10 minutes. Stay on this page to continue.
Code à 6 chiffres|6-digit code
Vérifiez aussi les courriels indésirables. Ne partagez jamais ce code.|Check your junk folder too. Keep the code to yourself.
Nouveau mot de passe|New password
Au moins 10 caractères.|At least 10 characters.
Vérifier et créer mon compte|Verify and create my account
Enregistrer et me connecter|Save and sign in
Vérifier et me connecter|Verify and sign in
Renvoyer un code dans|Resend code in
Renvoyer un code|Resend code
Modifier mes informations|Edit my information
Voir le code dans la boîte locale|View the code in the local inbox
Changer de choix|Choose another option
Adresse courriel|Email address
Mot de passe|Password
Ancien compte sans mot de passe ou mot de passe oublié : vérifiez votre courriel avec un code, puis choisissez votre mot de passe. Vos inscriptions sont conservées.|If you forgot your password or never set one, verify your email with a code and choose a password. Your registrations stay in your account.
Se souvenir de moi|Remember me
Coché : connexion conservée sur cet appareil. Décoché : connexion limitée à cet onglet, jusqu’à sa fermeture.|Select to stay signed in on this device. Otherwise, you’ll be signed in only until this tab closes.
Recevoir mon code|Send my code
Mot de passe oublié / Définir mon mot de passe|Forgot password / Set my password
Le code permet de choisir votre mot de passe.|Use the code to set your password.
Un code à 6 chiffres vous sera demandé pour vérifier votre courriel.|A 6-digit code will verify your email.
Un compte.|One account.
Votre journée.|Your event day.
Vos inscriptions au même endroit|All your registrations in one place
Vos billets pour l’accueil|Your tickets for check-in
Les nouvelles de l’organisation|Updates from the organizers
Votre billet personnel.|Your personal ticket.
Me connecter pour voir le billet|Sign in to see my ticket
Billet indisponible.|Ticket unavailable.
Revenir à mon espace|Back to my account
Votre billet.|Your ticket.
Date à confirmer|Date to be confirmed
à confirmer|to be confirmed
À confirmer|To be confirmed
Le téléchargement du billet a échoué. Utilisez « Imprimer / enregistrer en PDF ».|The ticket download failed. Use “Print / save as PDF”.
Prêt pour le départ.|Ready to go.
Inscription confirmée|Registration confirmed
Billet personnel : présentez ce code QR à l’accueil|Personal ticket: show this QR code at check-in
Numéro|Number
Billet personnel. Conservez-le sur votre téléphone et évitez de partager son code.|Keep your personal ticket on your phone and keep its code private.
Télécharger mon billet|Download my ticket
Imprimer / enregistrer en PDF|Print / save as PDF
Ajouter au calendrier|Add to calendar
Calendrier (.ics)|Calendar (.ics)
Votre reçu de paiement|Your payment receipt
Commande|Order
Participations de la commande|Entries in this order
Activité|Activity
Montant après rabais|Amount after discount
Total de la commande|Order total
Paiement reçu|Payment received
Remboursements confirmés|Confirmed refunds
Ce document concerne les frais d’inscription Ride For Brains. Il ne constitue pas un reçu de don ni un reçu fiscal.|This document covers Ride For Brains registration fees. It is not a donation or tax receipt.
Calendrier ajouté|Added to my calendar
Parcours consulté|Reviewed the route
Consignes lues|Read the instructions
Matériel préparé|Packed my gear
Votre préparation|Getting ready
Vos activités apparaîtront ici après votre inscription.|Your activities will appear here after you register.
Inscription gratuite|Free registration
Paiement confirmé|Payment confirmed
Billet prêt|Ticket ready
Consentements complétés|Consent choices complete
C’est aujourd’hui|Today is event day
L’événement est passé|The event is over
Afficher mon QR|Show my QR code
Voir mon parcours|View my route
Voir mon souvenir|View my souvenir
Avis importants|Important notices
Votre dossier|Your registration
Ma préparation|My preparation
Complété|Complete
En attente|Pending
Mes préparatifs personnels|My own preparations
Vos repères|What you need to know
Arrivée recommandée|Recommended arrival
Ouverture de l’accueil|Check-in opens
Départ de votre activité|Your activity starts
Stationnement|Parking
Accès au site|Getting there
Consignes importantes|Important instructions
Matériel recommandé|Recommended gear
Information météo officielle|Official weather information
Ravitaillements|Refreshment stops
Replier ma carte|Hide my card
Créer ma carte de partage|Create my share card
Préparation de la carte…|Preparing your card…
Brouillon privé|Private draft
Privée|Private
En modération|Under review
Approuvée|Approved
Refusée|Declined
Archivée|Archived
Masquée|Hidden
Un défi à plusieurs|A challenge together
Retrouvez les groupes qui se préparent ensemble pour Ride For Brains.|Meet the groups getting ready for Ride For Brains together.
Créer une équipe ou gérer ma participation|Create a team or manage my entry
Aucune équipe publique pour le moment.|No public teams yet.
participation(s)|entries
Participation concernée|Entry to use
Choisir une participation|Choose an entry
Ride For Brains · Équipes|Ride For Brains · Teams
Invitation à une équipe|Team invitation
km de défis choisis|km of challenges chosen
Avec|With
Cette équipe est privée ou indisponible. Un code valide permet de rejoindre une équipe privée.|This team is private or unavailable. A valid code lets you join a private team.
Me connecter pour rejoindre l’équipe|Sign in to join the team
Participation ajoutée à l’équipe.|Your entry was added to the team.
Code d’invitation|Invitation code
Rejoindre cette équipe|Join this team
Toutes les équipes publiques|All public teams
Gérer mes participations|Manage my entries
À votre façon|Your way
Voir les équipes|See teams
Les options communautaires sont disponibles avec une participation confirmée.|Community options are available with a confirmed entry.
Mes équipes|My teams
Participation individuelle|Taking part on my own
Ouvrir l’équipe|Open team
J’accepte que mon prénom soit affiché si cette équipe est publique|I agree to show my first name if this team is public
Quitter l’équipe|Leave the team
Renouveler le lien privé ·|Renew private link ·
Lien privé à partager avec les membres invités|Private link to share with invited members
Créer une équipe|Create a team
Nom de l’équipe|Team name
Description (facultative)|Description (optional)
Photo ou logo (adresse HTTPS facultative)|Photo or logo (optional HTTPS address)
Visibilité|Visibility
Privée · par invitation|Private · by invitation
Publique après modération|Public after approval
Créer mon équipe|Create my team
Pour qui fais-tu ces kilomètres?|Who are you doing these kilometres for?
Statut ·|Status ·
Titre facultatif|Optional title
Votre histoire|Your story
Votre dédicace|Your dedication
Le texte approuvé pourra être rendu public sur Ride For Brains. Évitez de partager des renseignements sensibles sur une autre personne.|Approved text may be published on Ride For Brains. Please avoid sharing sensitive information about someone else.
Un prénom, un surnom ou une courte phrase suffit.|A first name, nickname or short phrase is enough.
Photo facultative (adresse HTTPS)|Optional photo (HTTPS address)
J’accepte que cette histoire et sa photo puissent être publiées après approbation.|I agree that this story and its photo may be published after approval.
J’accepte que cette dédicace puisse apparaître publiquement sur Ride For Brains.|I agree that this dedication may appear publicly on Ride For Brains.
Enregistrer en privé|Save privately
Soumettre à la modération|Submit for review
Retirer mon histoire|Withdraw my story
Masquer ma dédicace|Hide my dedication
Chaque kilomètre compte|Every kilometre counts
Les histoires des personnes qui choisissent de prendre le départ.|Stories from the people choosing to take part.
Les personnes et les causes qui nous donnent une raison d’avancer.|The people and causes that give us a reason to keep moving.
Aucune histoire publiée pour le moment.|No stories published yet.
Aucune dédicace publiée pour le moment.|No dedications published yet.
Photo associée à cette histoire|Photo accompanying this story
Proposer mon histoire|Share my story
Écrire une dédicace|Write a dedication
Nos défis s’additionnent|Our challenges add up
Un défi collectif|A shared challenge
Les compteurs apparaîtront lorsque l’organisation décidera de les publier.|The counters will appear when the organizers choose to publish them.
Transparence|Transparency
Frais d’inscription|Registration fees
Les frais d’inscription servent à l’organisation et à la tenue de Ride For Brains. Ils ne constituent pas un don à Brain Canada.|Registration fees help organize and run Ride For Brains. They are not a donation to Brain Canada.
Don à Brain Canada|Donation to Brain Canada
Faire un don à Brain Canada|Donate to Brain Canada
Équipes créées|Teams created
Bénévoles confirmés|Confirmed volunteers
Mon souvenir|My souvenir
J’y étais.|I was there.
a participé à|took part in
Ma carte souvenir|My souvenir card
Préparation…|Preparing…
Tu es inscrit. Qui embarque avec toi?|You’re in. Who’s joining you?
Ton lien d’invitation|Your invitation link
Sélectionne le lien ci-dessus pour le copier.|Select the link above to copy it.
Lien copié|Link copied
Copier le lien|Copy link
On relève le défi ensemble?|Shall we take on the challenge together?
Le partage a échoué. Tu peux copier le lien.|Sharing failed. You can copy the link instead.
Partager|Share
Inviter un ami|Invite a friend
L’image n’a pas pu être préparée. Réessayez.|The image could not be prepared. Try again.
Ma carte de partage|My share card
Choisissez ce qui apparaîtra sur votre image.|Choose what appears on your image.
Format de la carte|Card format
Nom affiché sur l’image|Name shown on the image
Aucun nom|No name
Mon prénom|My first name
Mon prénom et mon initiale|My first name and last initial
Télécharger l’image PNG|Download PNG image
En attente du parent|Waiting for parent
Autorisation donnée|Authorization granted
Autorisation refusée|Authorization declined
Autorisation à refaire|New authorization needed
Autorisation parentale|Parental authorization
Un parent doit autoriser cette participation.|A parent must authorize this entry.
Le parent ou tuteur doit se connecter à son propre compte. Les renseignements de cette participation et les choix de consentement lui seront présentés. Aucun paiement ni billet n’est créé avant son accord.|The parent or guardian signs in to their own account to review the entry and consent choices. Payment and ticket issuance happen only after approval.
Courriel du parent ou tuteur|Parent or guardian email
Me connecter pour envoyer la demande|Sign in to send the request
Demander l’autorisation au parent|Ask for parental authorization
Actualiser l’autorisation|Refresh authorization
Après accord, reprenez l’inscription depuis ce compte participant. Une modification des renseignements demande une nouvelle autorisation.|After approval, resume registration from this participant account. Changing information requires new authorization.
Voir mes demandes et changer de compte si nécessaire|View my requests or switch accounts
Événement :|Event:
· Demande valable jusqu’au|· Request valid until
Examiner les renseignements et les conditions|Review details and terms
· moins de 18 ans|· under 18
Courriel et téléphone|Email and phone
Photos et vidéos de l’événement|Event photos and videos
Consentement demandé|Consent requested
Communications promotionnelles|Promotional communications
Liste publique des participants|Public participant list
Prénom et initiale du nom — consentement demandé|First name and last initial — consent requested
Conditions ·|Terms ·
Votre prénom et nom|Your first and last name
Votre lien avec le participant|Your relationship to the participant
Parent|Parent
Tuteur légal|Legal guardian
Je confirme être majeur, parent ou tuteur légal de ce participant et avoir lu les renseignements, les choix de consentement et les conditions.|I confirm that I am an adult and this participant’s parent or legal guardian, and that I have read the information, consent choices and terms.
Autoriser cette participation|Authorize this entry
Refuser cette participation|Decline this entry
Décision enregistrée le|Decision recorded on
par|by
Le parent a son propre espace.|Parents have their own account.
Connectez-vous avec le courriel auquel la demande a été envoyée. L’enfant et le parent doivent utiliser deux comptes distincts.|Sign in with the email address the request was sent to. The child and parent use separate accounts.
Me connecter comme parent|Sign in as a parent
Créer mon compte parent|Create my parent account
Parents et participants|Parents and participants
Les autorisations parentales.|Parental authorizations.
Compte connecté :|Signed in as:
. Un parent ou tuteur majeur autorise chaque participation depuis son propre compte. L’autorisation ne déclenche aucun paiement.|. An adult parent or guardian authorizes each entry using their own account. Authorization does not initiate payment.
Actualiser les demandes|Refresh requests
Changer de compte|Switch accounts
Demandes à examiner comme parent|Requests to review as a parent
Votre décision a été enregistrée. Le participant peut actualiser son autorisation dans son inscription.|Your decision is recorded. The participant can refresh their authorization in registration.
Aucune demande pour ce courriel. Vérifiez l’adresse que le participant a indiquée.|No requests for this email address. Check the address the participant entered.
Mes demandes comme participant|My requests as a participant
· Parent :|· Parent:
Reprendre mon inscription|Resume my registration
✓ Inscription confirmée|✓ Registration confirmed
Votre billet est prêt dans votre espace ci-dessous.|Your ticket is ready in your account below.
Votre paiement a été reçu. L’organisation vérifie votre dossier et vous contactera.|Your payment was received. The organizers are reviewing your registration and will contact you.
Le paiement n’a pas été finalisé. Retrouvez les options disponibles dans votre dossier.|Payment was not completed. See the options in your registration.
Votre paiement est en cours de confirmation. Vous pouvez fermer cette page. Nous vous enverrons un courriel lorsque votre inscription sera confirmée.|Payment is being confirmed. You can close this page. We’ll email you when registration is confirmed.
Vérifier de nouveau|Check again
Nous confirmons votre inscription…|Confirming your registration…
Votre dossier se met à jour automatiquement.|Your registration updates automatically.
On prend le départ ensemble|At the starting line together
Qui sera de la partie ?|Who’s taking part?
Découvrez les participations confirmées, activité par activité.|See confirmed entries by activity.
Choisir une activité|Choose an activity
Les noms apparaissent uniquement avec l’accord du participant ou du parent. Nous affichons le prénom et l’initiale du nom.|Names appear only with participant or parent consent. We show the first name and last initial.
Participants —|Participants —
participation|entry
confirmée|confirmed
nom|name
affiché|shown
avec accord.|with consent.
Les noms restent privés tant que leur affichage n’a pas été autorisé.|Names stay private until permission is given to display them.
Le départ se prépare. Aucune participation confirmée pour le moment.|Plans are underway. There are no confirmed entries yet.
Voir plus de participants|See more participants
Chargement des participants…|Loading participants…
Je participe aussi|I’m taking part too
Retirer mon nom de la liste publique|Remove my name from the public list
Afficher mon nom dans la liste|Show my name on the list
L’affichage d’un mineur doit être autorisé par le parent pendant l’inscription.|A parent must authorize display of a minor’s name during registration.
Un instant…|One moment…
Choisir une réponse|Choose an answer
Confirmer mon adresse courriel|Confirm my email address
Cette confirmation concerne uniquement l’adresse de contact de votre participation. Votre compte reste inchangé.|This confirms the contact email for this entry only. Your account details stay the same.
Préparer ma participation|Get ready for my entry
Après confirmation, un nouveau billet sera envoyé à cette adresse. Le précédent billet sera remplacé.|After confirmation, a new ticket will be sent to this address and replace the previous ticket.
Confirmer cette adresse|Confirm this address
Animations réduites selon votre appareil|Reduced motion based on device settings
Animations réduites · réactiver|Reduced motion · enable animations
Réduire les animations|Reduce motion
Du cerveau au mouvement|From the brain to movement
Avant le premier pas,|Before the first step,
une connexion.|a connection.
Ces illustrations évoquent le signal et le mouvement. Elles racontent le lien entre notre cause et les trois activités de la journée.|These illustrations depict signals and movement. They connect our cause with the day’s three activities.
Les connexions.|The connections.
Les neurones communiquent entre eux. Les points lumineux illustrent cet échange.|Neurons communicate with one another. The points of light illustrate this exchange.
Le signal.|The signal.
Le signal circule. Les impulsions avancent le long des fibres.|Signals travel as impulses move along the fibres.
Le mouvement.|The movement.
Les connexions forment un réseau : l’image qui relie notre événement à la recherche sur le cerveau.|Connections form a network that links our event to brain research.
Trois activités. Une même journée.|Three activities. One day.
Des chemins différents.|Different paths.
Un rendez-vous commun.|One place to come together.
Bleu pour rouler. Vert pour courir. Lime pour marcher. Les trajectoires se rejoignent : chacun participe à sa façon.|Blue for cycling, green for running and lime for walking. The paths converge as everyone takes part their own way.
Illustration symbolique : les parcours officiels restent à confirmer.|Symbolic illustration. Official routes are confirmed separately.
Choisir mon activité —|Choose my activity —
Le premier repère|The first landmark
L’accueil à|Check-in at
Les participants se retrouvent avant leur activité. L’horloge affiche l’heure d’ouverture de l’accueil; les heures de départ seront confirmées séparément.|Participants meet before their activity. The clock shows when check-in opens. Activity start times are confirmed separately.
Préparer ma journée ↗|Plan my day ↗
Le rythme vient du pédalier.|The rhythm starts at the pedals.
Le pédalier entraîne la roue. Cette animation accompagne les 100 kilomètres à vélo; elle ne représente pas le parcours officiel.|The pedals drive the wheel. This animation accompanies the 100 km cycling challenge. The official route is on the activity page.
Une foulée après l’autre.|One stride at a time.
L’alternance des appuis donne le rythme. Choisissez 2, 5 ou 10 kilomètres selon l’activité qui vous ressemble.|Alternating strides set the pace. Choose 2, 5 or 10 km to suit your challenge.
Trouver son pas.|Find your stride.
Les pas alternent et le chemin se dessine. Cinq kilomètres pour participer à pied.|The path takes shape step by step. Take part in the 5 km walk.
Le mouvement en détail|Movement in detail
Thomas, François-Xavier et Sammy : trois personnes réunies pour organiser la même journée.|Thomas, François-Xavier and Sammy came together to organize the event.
Avant de partir|Before you go
Préparer son équipement.|Pack your gear.
Un casque pour le vélo et de quoi s’hydrater : cette illustration rappelle de préparer son matériel. Les consignes complètes et les ravitaillements seront précisés par l’organisation.|The illustration is a reminder to bring a cycling helmet and water. The organizers will confirm full instructions and refreshment stops.
Oui|Yes
Non|No
Gratuit|Free
gratuit|free
La demande n’a pas pu être traitée. Réessayez ou contactez l’organisation.|The request could not be completed. Try again or contact the organizers.
Brouillon|Draft
Paiement en attente|Payment pending
Confirmée|Confirmed
Réservation expirée|Reservation expired
Paiement échoué|Payment failed
Paiement reçu · vérification requise|Payment received · review required
Annulée|Cancelled
Remboursement en traitement|Refund in progress
Remboursement partiel|Partial refund
Remboursée|Refunded
Conservé localement|Stored locally
En file d’attente|Queued
Accepté par le service|Accepted by the provider
Livré selon le service|Delivered according to the provider
Rejeté par le destinataire|Rejected by the recipient
Nouvelle tentative prévue|Retry scheduled
Transmission en cours|Sending
Désabonné|Unsubscribed
Terminé|Complete
Participations confirmées|Confirmed registrations
Kilomètres de défis choisis|Kilometres of challenges selected
Équipes créées|Teams created
Bénévoles confirmés|Confirmed volunteers
JE PARTICIPE.|I’M TAKING PART.
Ajouter à Apple Wallet|Add to Apple Wallet
Ajouter à Google Wallet|Add to Google Wallet
Billet personnel|Personal ticket
Présenter ce code à l’accueil. Ne pas le partager.|Show this code at check-in. Keep it private.
J’Y ÉTAIS.|I WAS THERE.
Publication · 1080 × 1080|Square post · 1080 × 1080
Partage Web · 1200 × 630|Web share · 1200 × 630
Les dons sont effectués sur la page de collecte Ride For Brains, hébergée sur la plateforme officielle de collecte de fonds de Brain Canada.|Donations are made through the Ride For Brains fundraising page on Brain Canada’s official fundraising platform.
Les frais d’inscription servent à l’inscription et à l’organisation de Ride For Brains. Ils ne constituent pas un don à Brain Canada et ne donnent pas droit à un reçu de don. Les dons sont effectués sur la page de collecte Ride For Brains, hébergée sur la plateforme officielle de collecte de fonds de Brain Canada.|Registration fees cover registration and event costs. They are separate from donations to Brain Canada and are ineligible for a donation receipt. Donations are made through the Ride For Brains fundraising page on Brain Canada’s official platform.
Tous les âges · autorisation parentale avant 18 ans|All ages · parental authorization required under 18
Vélo : 18 ans et plus. Course et marche : tous les âges, avec autorisation parentale pour les moins de 18 ans.|Cycling is open to participants aged 18 and over. Running and walking welcome all ages, with parental authorization required for minors.
`;

const catalog = new Map(
  englishCopy
    .trim()
    .split('\n')
    .map((row) => {
      const split = row.indexOf('|');
      return [row.slice(0, split), row.slice(split + 1)] as const;
    }),
);
const normal = (value: string) => value.trim().replace(/\s+/g, ' ');
export const hasEnglishCopy = (value: string) => catalog.has(normal(value));
export function t(value: string, locale: Locale = currentLocale()) {
  if (locale !== 'en-CA') return value;
  const translation = catalog.get(normal(value));
  return translation ? value.replace(/\S[\s\S]*\S|\S/, () => translation) : value;
}
