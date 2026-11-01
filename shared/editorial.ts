export const practicalSections = [
  ['departs', 'Départs'],
  ['stationnement', 'Stationnement'],
  ['ravitaillement', 'Ravitaillement'],
  ['securite', 'Sécurité'],
  ['equipement', 'Équipement'],
  ['accessibilite', 'Accessibilité'],
  ['meteo', 'Météo'],
  ['abandon', 'Abandon'],
  ['urgence', 'Urgence'],
  ['jour-j', 'Questions du jour J'],
  ['acces', 'Accès et transports'],
  ['toilettes', 'Toilettes'],
  ['arrivee', 'Arrivée'],
  ['services', 'Services sur place'],
] as const;
export const defaultEditorial = {
  heroTitle: 'Le mouvement\nnous relie.',
  heroIntro: 'On se retrouve à vélo, à la course ou à la marche pour Ride For Brains.',
  socialLinks: [] as { name: string; url: string }[],
  media: [] as {
    name: string;
    title: string;
    url: string;
    logo: string;
    quote: string;
    date: string;
    enabled: boolean;
    order: number;
  }[],
  volunteerRoles: [] as { title: string; description: string }[],
  sponsorshipIntro: '',
  sponsorshipOptions: [] as string[],
  firstEdition: {
    title: 'Là où tout a commencé.',
    intro: '',
    year: '',
    memories: [] as string[],
    stats: [] as { label: string; value: string }[],
    press: [] as { title: string; url: string }[],
  },
  team: ['Thomas', 'François-Xavier', 'Sammy'].map((name) => ({
    name,
    role: 'Équipe organisatrice',
    story: '',
    quote: '',
    photo: '',
    enabled: true,
  })),
  practical: practicalSections.map(([id, title]) => ({ id, title, body: '', enabled: true })),
  transfersEnabled: false,
  transferDeadline: null as number | null,
};
export function editorial(settings: any): typeof defaultEditorial {
  return {
    ...defaultEditorial,
    ...settings.editorial,
    firstEdition: { ...defaultEditorial.firstEdition, ...settings.editorial?.firstEdition },
  };
}
export function published<T extends { enabled?: boolean; order?: number }>(rows: T[] = []): T[] {
  return rows
    .filter((row) => row.enabled !== false)
    .map((row, i) => ({ row, i }))
    .sort((a, b) => (a.row.order ?? a.i) - (b.row.order ?? b.i))
    .map(({ row }) => row);
}
