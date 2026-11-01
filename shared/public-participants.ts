export const publicListingVersion = '2026-10-31-v1';
export const publicListingText =
  'J’accepte que le prénom et l’initiale du nom de cette personne soient affichés dans la liste publique des participants à cette activité. Ce choix est facultatif et peut être retiré depuis l’espace participant.';
export function listingConsent(userId: string, guardianRequestId?: string) {
  return JSON.stringify({
    version: publicListingVersion,
    text: publicListingText,
    acceptedBy: userId,
    guardianRequestId: guardianRequestId || null,
    at: Math.floor(Date.now() / 1000),
  });
}
