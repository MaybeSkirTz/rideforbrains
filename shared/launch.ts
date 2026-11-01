export const defaultLaunchReview = {
  refundApproved: false,
  taxApproved: false,
  eventApproved: false,
  cancellation: '',
  postponement: '',
  weather: '',
  forceMajeure: '',
};
export function launchIssues(s: any): string[] {
  const r = { ...defaultLaunchReview, ...s.launchReview };
  return [
    !s.location?.trim() && 'lieu',
    !s.legalApproved && 'conditions',
    !s.brandApproved && 'marque Brain Canada',
    (s.taxMode === 'unconfirmed' || !r.taxApproved) && 'traitement fiscal',
    !r.refundApproved && 'politique de remboursement',
    (!r.eventApproved ||
      ['cancellation', 'postponement', 'weather', 'forceMajeure'].some(
        (k) => !String((r as any)[k]).trim(),
      )) &&
      'annulation, report et météo',
    [s.terms, s.privacy, r.cancellation, r.postponement, r.weather, r.forceMajeure].some((t) =>
      /brouillon|à valider|restent à (définir|valider)|à compléter/i.test(String(t)),
    ) && 'textes non finalisés',
  ].filter(Boolean) as string[];
}
