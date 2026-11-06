export function distanceKm(value: unknown) {
  const match =
    typeof value === 'string' && value.trim().match(/^(\d{1,5}(?:[.,]\d{1,3})?)\s*km$/i);
  return match ? Number(match[1].replace(',', '.')) : 0;
}

export const impactLabels = {
  participants: 'Participations confirmées',
  km: 'Kilomètres de défis choisis',
  teams: 'Équipes créées',
  volunteers: 'Bénévoles confirmés',
} as const;
