import type { Locale } from './locale';

export const cardFormats = {
  story: { label: 'Story · 1080 × 1920', width: 1080, height: 1920 },
  square: { label: 'Publication · 1080 × 1080', width: 1080, height: 1080 },
  web: { label: 'Partage Web · 1200 × 630', width: 1200, height: 630 },
} as const;
export type CardFormat = keyof typeof cardFormats;
export type CardName = 'private' | 'first' | 'initial';

export function shareCardText(
  participation: { firstName: string; lastInitial: string; activity: string; distance: string },
  eventAt: string,
  name: CardName,
  locale: Locale = 'fr-CA',
) {
  return {
    name:
      name === 'private'
        ? ''
        : participation.firstName +
          (name === 'initial' && participation.lastInitial
            ? ' ' + participation.lastInitial + '.'
            : ''),
    activity: participation.activity + ' · ' + participation.distance,
    date: new Date(eventAt).toLocaleDateString(locale, {
      dateStyle: 'long',
      timeZone: 'America/Toronto',
    }),
  };
}
