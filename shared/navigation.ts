import { frenchPath } from './locale.ts';
const base = 'https://internal.rideforbrains.invalid';
const routes = new Set([
  '/inscription',
  '/attente',
  '/espace',
  '/mon-jour-j',
  '/ma-communaute',
  '/equipes',
  '/admin',
  '/organisation',
  '/transfert',
  '/autorisations-parentales',
]);

/** Only app-owned destinations; preserve the complete activity query string. */
export function safeReturnUrl(value: unknown, fallback = '/espace'): string {
  if (
    typeof value !== 'string' ||
    value.length > 1500 ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\\u0000-\u0020\u007f]/.test(value)
  )
    return fallback;
  try {
    const url = new URL(value, base);
    const route = frenchPath(url.pathname);
    if (
      url.origin !== base ||
      (!routes.has(route) && !/^\/(billet|recu|equipes|souvenir)\/[a-f0-9-]{36}$/.test(route))
    )
      return fallback;
    return url.pathname + url.search;
  } catch {
    return fallback;
  }
}

export const accountUrl = (returnTo: string, mode?: 'create' | 'sign-in') =>
  '/connexion?' +
  new URLSearchParams({ retour: safeReturnUrl(returnTo), ...(mode ? { mode } : {}) });
