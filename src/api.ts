export async function api<T = any>(
  path: string,
  body?: unknown,
  method = body ? 'POST' : 'GET',
): Promise<T> {
  const res = await fetch('/api' + path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data: any = await res.json();
  if (!res.ok)
    throw new Error(data.error?.message || data.error || data.message || 'La demande a échoué.');
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
