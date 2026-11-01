import {
  ADMIN_ACCESS_MESSAGE,
  isAdminApi,
  staffApiPath,
  STAFF_REAUTH_MESSAGE,
} from '../shared/admin-access';
export class AdminAccessRequired extends Error {
  readonly code = 'ADMIN_ACCESS_REQUIRED';
  constructor() {
    super(ADMIN_ACCESS_MESSAGE);
    this.name = 'AdminAccessRequired';
  }
}
const tabStorageKey = 'rfb-tab-session';
async function siteFetch(path: string, init: RequestInit = {}) {
  path = staffApiPath(path, typeof location === 'undefined' ? '' : location.pathname);
  let response: Response;
  try {
    response = await fetch('/api' + path, {
      ...init,
      credentials: 'same-origin',
      redirect: 'manual',
      headers: { ...sessionHeaders(), ...init.headers },
    });
  } catch {
    throw new Error('Impossible de joindre le serveur. Vérifiez votre connexion, puis réessayez.');
  }
  if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
    if (isAdminApi(path)) throw new AdminAccessRequired();
    throw new Error(
      'Le service demande une nouvelle connexion. Rechargez la page avant de réessayer.',
    );
  }
  return response;
}
function sessionHeaders(): Record<string, string> {
  try {
    const key = sessionStorage.getItem(tabStorageKey);
    return key ? { 'X-RFB-Session': key } : {};
  } catch {
    return {};
  }
}
export function saveSessionPreference(tabKey: string | null) {
  try {
    if (tabKey) sessionStorage.setItem(tabStorageKey, tabKey);
    else sessionStorage.removeItem(tabStorageKey);
  } catch {
    if (tabKey)
      throw new Error(
        'Autorisez le stockage de cet onglet pour conserver cette connexion temporaire.',
      );
  }
}
export async function downloadPrivate(path: string, filename: string) {
  const res = await siteFetch(path);
  if (
    res.status === 401 &&
    typeof location !== 'undefined' &&
    location.pathname === '/organisation'
  )
    throw new Error(STAFF_REAUTH_MESSAGE);
  if (!res.ok) throw new Error('Le téléchargement a échoué. Vérifiez votre connexion.');
  const url = URL.createObjectURL(await res.blob()),
    a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function api<T = any>(
  path: string,
  body?: unknown,
  method = body ? 'POST' : 'GET',
): Promise<T> {
  const res = await siteFetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    // A server or proxy can return an empty body or HTML, including on errors.
  }
  if (!res.ok) {
    const message = data?.error?.message || data?.error || data?.message;
    if (
      isAdminApi(path) &&
      res.status === 403 &&
      (message === ADMIN_ACCESS_MESSAGE ||
        message === 'Connectez-vous via l’accès renforcé de l’organisation.')
    )
      throw new AdminAccessRequired();
    throw new Error(
      typeof message === 'string'
        ? message
        : res.status === 429
          ? 'Trop de demandes. Réessayez dans quelques minutes.'
          : 'Le service est temporairement indisponible. Réessayez dans quelques minutes.',
    );
  }
  if (data === undefined)
    throw new Error(
      'Le serveur a renvoyé une réponse inattendue. Réessayez dans quelques minutes.',
    );
  if (path === '/auth/sign-out') saveSessionPreference(null);
  return data as T;
}
export const money = (cents: number) =>
  new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 2,
  }).format(cents / 100);
export const statuses: Record<string, string> = {
  draft: 'Brouillon',
  pending: 'Paiement en attente',
  confirmed: 'Confirmée',
  expired: 'Réservation expirée',
  failed: 'Paiement échoué',
  paid_review: 'Paiement reçu · vérification requise',
  cancelled: 'Annulée',
  refunding: 'Remboursement en traitement',
  partially_refunded: 'Remboursement partiel',
  refunded: 'Remboursée',
  waitlisted: 'Liste d’attente',
  development: 'Conservé localement',
  queued: 'En file d’attente',
  accepted: 'Accepté par le service',
  delivered: 'Livré selon le service',
  bounced: 'Rejeté par le destinataire',
  retry: 'Nouvelle tentative prévue',
  review: 'Vérification requise',
  sending: 'Transmission en cours',
  unsubscribed: 'Désabonné',
  succeeded: 'Terminé',
};
export const date = (seconds: number) =>
  new Date(seconds * 1000).toLocaleString('fr-CA', {
    timeZone: 'America/Toronto',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
