const base = 'https://internal.rideforbrains.invalid';
const routes = new Set(['/inscription', '/attente', '/espace', '/admin', '/transfert']);

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
    if (
      url.origin !== base ||
      (!routes.has(url.pathname) && !/^\/billet\/[a-f0-9-]{36}$/.test(url.pathname))
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
