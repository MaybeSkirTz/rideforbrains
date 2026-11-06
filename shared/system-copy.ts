import type { Locale } from './locale';

const english: Record<string, string> = {
  'Connectez-vous pour continuer.': 'Sign in to continue.',
  'Le prénom et le nom sont requis.': 'Enter your first and last names.',
  'Saisissez votre mot de passe.': 'Enter your password.',
  'Adresse courriel ou mot de passe incorrect. Pour un ancien compte, utilisez « Définir mon mot de passe ».':
    'The email or password is incorrect. For an older account, select “Set my password”.',
  'La connexion par courriel n’est pas encore activée. Contactez l’organisation.':
    'Email sign-in is currently unavailable. Contact the organizers.',
  'Cette destination de retour n’est pas autorisée.': 'This return address is not allowed.',
  'Attendez une minute avant de demander un nouveau code.':
    'Wait one minute before requesting another code.',
  'Vérification du formulaire échouée.': 'Verification failed. Try again.',
  'Trop de demandes. Réessayez dans quelques minutes.':
    'Too many requests. Try again in a few minutes.',
  'La demande n’a pas pu être traitée. Réessayez ou contactez l’organisation.':
    'The request could not be completed. Try again or contact the organizers.',
  'Impossible de joindre le serveur. Vérifiez votre connexion, puis réessayez.':
    'Could not reach the server. Check your connection and try again.',
  'Le service est temporairement indisponible. Réessayez dans quelques minutes.':
    'The service is temporarily unavailable. Try again in a few minutes.',
  'Le serveur a renvoyé une réponse inattendue. Réessayez dans quelques minutes.':
    'The server returned an unexpected response. Try again in a few minutes.',
  'Le téléchargement a échoué. Vérifiez votre connexion.':
    'Download failed. Check your connection.',
  'Les conditions ont été mises à jour. Relisez-les avant de continuer.':
    'The terms have been updated. Read them again before continuing.',
  'Les inscriptions ne sont pas ouvertes.': 'Registration is closed.',
  'Une activité est complète. Aucune inscription du panier n’a été réservée.':
    'An activity is full. No registrations in the cart were reserved.',
  'Code promotionnel invalide, expiré ou épuisé.':
    'This promo code is invalid, expired or fully used.',
  'Code promotionnel épuisé ou temporairement réservé.':
    'This promo code is fully used or temporarily reserved.',
  'Code promotionnel invalide ou expiré.': 'This promo code is invalid or expired.',
  'L’autorisation parentale est absente, a changé ou a déjà été utilisée. Demandez une nouvelle autorisation.':
    'Parental authorization is missing, has changed or has already been used. Request a new authorization.',
  'Le vélo est réservé aux personnes de 18 ans et plus.': 'Cycling is open to ages 18 and over.',
  'Le formulaire a changé. Rechargez la page.': 'The form has changed. Reload the page.',
  'La période d’inscription de cette activité est fermée.':
    'Registration for this activity is closed.',
  'Activité introuvable': 'Activity not found',
  'Activité introuvable.': 'Activity not found.',
  'Participation introuvable.': 'Registration not found.',
  'Billet indisponible.': 'Ticket unavailable.',
  'Ce billet a changé. Rechargez la page.': 'The ticket has changed. Reload the page.',
  'Ce service Wallet n’est pas encore configuré.': 'This Wallet service is currently unavailable.',
  'Impossible de préparer le pass Wallet pour le moment.':
    'The Wallet pass could not be prepared right now.',
};

export function systemCopy(message: string, locale: Locale) {
  return locale === 'en-CA' && Object.hasOwn(english, message) ? english[message] : message;
}
