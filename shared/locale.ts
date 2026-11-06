export type Locale = 'fr-CA' | 'en-CA';
const paths = {
  '/': '/en/',
  '/activites': '/en/activities',
  '/velo': '/en/cycling',
  '/course': '/en/running',
  '/marche': '/en/walking',
  '/cause': '/en/cause',
  '/equipe': '/en/team',
  '/infos': '/en/practical-information',
  '/faq': '/en/faq',
  '/contact': '/en/contact',
  '/benevolat': '/en/volunteer',
  '/partenaires': '/en/partners',
  '/participants': '/en/participants',
  '/equipes': '/en/teams',
  '/histoires': '/en/stories',
  '/pour-eux': '/en/for-them',
  '/ma-communaute': '/en/my-community',
  '/impact': '/en/impact',
  '/ou-va-mon-argent': '/en/where-does-my-money-go',
  '/conditions': '/en/terms',
  '/annulation': '/en/cancellations',
  '/confidentialite': '/en/privacy',
  '/connexion': '/en/sign-in',
  '/compte': '/en/account',
  '/inscription': '/en/register',
  '/attente': '/en/waitlist',
  '/espace': '/en/my-account',
  '/mon-jour-j': '/en/my-event-day',
  '/autorisations-parentales': '/en/parental-authorizations',
  '/billet': '/en/ticket',
  '/billet-personnel': '/en/personal-ticket',
  '/recu': '/en/receipt',
  '/souvenir': '/en/souvenir',
  '/confirmer-courriel': '/en/confirm-email',
  '/desabonnement': '/en/unsubscribe',
  '/calendrier.ics': '/en/calendar.ics',
} as Record<string, string>;
const dynamic = ['/activites', '/equipes', '/billet', '/recu', '/souvenir'];
const reverse = new Map(Object.entries(paths).map(([fr, en]) => [en, fr]));
export const localeForPath = (path: string): Locale =>
  /^\/en(?:\/|$)/.test(path) ? 'en-CA' : 'fr-CA';
export const localeFromHeader = (value?: string | null): Locale =>
  value === 'en-CA' ? 'en-CA' : 'fr-CA';
export const currentLocale = (): Locale =>
  typeof location === 'undefined' ? 'fr-CA' : localeForPath(location.pathname);

export function frenchPath(path: string) {
  if (path === '/en') return '/';
  const exact = reverse.get(path);
  if (exact) return exact;
  for (const base of dynamic) {
    if (path.startsWith(paths[base] + '/')) return base + path.slice(paths[base].length);
  }
  return path;
}

export function localizedPath(href: string, locale: Locale) {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const index = href.search(/[?#]/);
  const path = index < 0 ? href : href.slice(0, index);
  const suffix = index < 0 ? '' : href.slice(index);
  const fr = frenchPath(path);
  if (locale === 'fr-CA') return fr + suffix;
  const exact = paths[fr];
  if (exact) return exact + suffix;
  const base = dynamic.find((route) => fr.startsWith(route + '/'));
  return (base ? paths[base] + fr.slice(base.length) : fr) + suffix;
}

export function englishLegal(s: any) {
  const en = s.english;
  return !!(
    en?.published &&
    en.legalApproved &&
    en.sourceVersion === s.termsVersion &&
    en.legalVersion &&
    en.legalVersion !== s.termsVersion &&
    en.terms?.trim().length >= 10 &&
    en.privacy?.trim().length >= 10
  );
}

export function legalForVersion(s: any, version: string): { terms: string; locale: Locale } | null {
  if (s.termsVersion === version) return { terms: s.terms, locale: 'fr-CA' };
  if (englishLegal(s) && s.english.legalVersion === version)
    return { terms: s.english.terms, locale: 'en-CA' };
  return null;
}
