export const participationPolicy =
  'Vélo : 18 ans et plus. Course et marche : tous les âges, avec autorisation parentale pour les moins de 18 ans.';
export const guardianConsentVersion = '2026-10-31-v1';
export const guardianConsentText =
  'Je déclare avoir au moins 18 ans et être le parent ou le tuteur légal de ce participant mineur. Après lecture de ses renseignements, de l’activité et des conditions présentées, j’autorise sa participation à cette activité ainsi que les choix de consentement affichés. Cette autorisation ne constitue pas un paiement.';
export const englishGuardianConsentText =
  'I confirm that I am at least 18 years old and that I am the parent or legal guardian of this minor. Having reviewed their information, the activity and the terms presented, I authorize their participation in this activity and the consent choices shown. This authorization does not constitute payment.';
export const ageLabel = (sport: string) =>
  sport === 'velo' ? '18 ans et plus' : 'Tous les âges · autorisation parentale avant 18 ans';
