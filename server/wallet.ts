import type { Hono } from 'hono';
import { importPKCS8, SignJWT } from 'jose';
import { z } from 'zod';
import { digest } from './crypto';
import { findPersonalTicket } from './personal-tickets';
import { parse, now, type Actor, type AppContext, type Env } from './types';

export function walletAvailability(env: Env) {
  return {
    apple:
      env.APPLE_WALLET_ENABLED === 'true' &&
      !!env.APPLE_WALLET_SIGNER &&
      /^pass\.[a-z0-9.-]+$/i.test(env.APPLE_WALLET_PASS_TYPE || '') &&
      /^[A-Z0-9]{10}$/.test(env.APPLE_WALLET_TEAM_ID || ''),
    google:
      env.GOOGLE_WALLET_ENABLED === 'true' &&
      /^\d+$/.test(env.GOOGLE_WALLET_ISSUER || '') &&
      !!env.GOOGLE_WALLET_CLASS?.startsWith(env.GOOGLE_WALLET_ISSUER + '.') &&
      !!env.GOOGLE_WALLET_EMAIL &&
      !!env.GOOGLE_WALLET_PRIVATE_KEY?.includes('BEGIN PRIVATE KEY'),
  };
}

const googleBase = 'https://walletobjects.googleapis.com/walletobjects/v1/eventTicketObject';
const oauth = 'https://oauth2.googleapis.com/token';
async function googleCredentials(env: Env) {
  const key = await importPKCS8(env.GOOGLE_WALLET_PRIVATE_KEY!.replaceAll('\\n', '\n'), 'RS256');
  const assertion = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/wallet_object.issuer',
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(env.GOOGLE_WALLET_EMAIL!)
    .setAudience(oauth)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);
  const response = await fetch(oauth, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('Wallet OAuth indisponible');
  const { access_token } = await response.json<{ access_token?: string }>();
  if (!access_token) throw new Error('Wallet OAuth indisponible');
  return {
    key,
    headers: { Authorization: 'Bearer ' + access_token, 'Content-Type': 'application/json' },
  };
}

export async function syncWalletRevocations(env: Env) {
  const available = walletAvailability(env);
  if (!available.google) return;
  const rows = await env.DB.prepare(
    "SELECT id FROM wallet_issues WHERE provider='google' AND revoked_at IS NOT NULL AND provider_notified_at IS NULL ORDER BY revoked_at LIMIT 20",
  ).all<{ id: string }>();
  if (!rows.results.length) return;
  const { headers } = await googleCredentials(env);
  for (const { id } of rows.results) {
    const res = await fetch(googleBase + '/' + encodeURIComponent(id), {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ state: 'INACTIVE' }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok)
      await env.DB.prepare('UPDATE wallet_issues SET provider_notified_at=unixepoch() WHERE id=?')
        .bind(id)
        .run();
  }
}

export function walletRoutes(
  app: Hono<AppContext>,
  admin: Hono<AppContext>,
  {
    actor,
    staffActor,
    fail,
    limited,
  }: {
    actor: (c: any) => Promise<Actor>;
    staffActor: (c: any, permission: string) => Promise<Actor>;
    fail: (status: number, message: string) => never;
    limited: (env: Env, key: string, max: number, seconds: number) => Promise<void>;
  },
) {
  admin.get('/wallet/status', async (c) => {
    await staffActor(c, 'event');
    const counts = await c.env.DB.prepare(
      'SELECT provider,COUNT(*) AS issued,SUM(revoked_at IS NOT NULL) AS revoked FROM wallet_issues GROUP BY provider',
    ).all();
    return c.json({ ...walletAvailability(c.env), counts: counts.results });
  });
  app.post('/api/wallet/:provider', async (c) => {
    const provider = z.enum(['apple', 'google']).parse(c.req.param('provider'));
    if (!walletAvailability(c.env)[provider])
      fail(503, 'Ce service Wallet n’est pas encore configuré.');
    await limited(c.env, 'wallet:' + (c.req.header('cf-connecting-ip') || 'local'), 20, 60);
    const proof = z
      .union([
        z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
        z.object({ registrationId: z.uuid() }).strict(),
      ])
      .parse(await c.req.json());
    let ticket;
    if ('token' in proof) ticket = await findPersonalTicket(c.env, proof.token);
    else {
      const user = await actor(c);
      ticket = await c.env.DB.prepare(
        `SELECT r.id,r.ticket,r.first_name,r.last_name,r.activity_snapshot,o.event_snapshot,a.name,a.distance,a.route
        FROM visible_registrations r JOIN orders o ON o.id=r.order_id JOIN activities a ON a.id=r.activity_id
        WHERE r.id=? AND COALESCE(r.transferred_user_id,o.user_id)=? AND r.status IN ('confirmed','partially_refunded')`,
      )
        .bind(proof.registrationId, user.id)
        .first<any>();
    }
    if (!ticket) fail(404, 'Billet indisponible.');
    const event = parse(ticket.event_snapshot),
      activity = parse(ticket.activity_snapshot);
    const route = ticket.route
      ? parse(ticket.route)
      : parse(
          (
            await c.env.DB.prepare(
              'SELECT a.route FROM registrations r JOIN activities a ON a.id=r.activity_id WHERE r.id=?',
            )
              .bind(ticket.id)
              .first<{ route: string }>()
          )?.route ?? null,
        );
    const hash = await digest(ticket.ticket);
    const serial = ticket.id.replaceAll('-', '') + '-' + hash.slice(0, 20);
    const issueId = provider === 'google' ? c.env.GOOGLE_WALLET_ISSUER + '.' + serial : serial;
    const name = ticket.first_name + ' ' + ticket.last_name;
    const challenge =
      (activity.name || ticket.name) + ' · ' + (activity.distance || ticket.distance);
    const date = event.eventAt
      ? new Intl.DateTimeFormat('fr-CA', { dateStyle: 'long', timeZone: 'America/Toronto' }).format(
          new Date(event.eventAt),
        )
      : '';
    const canIssue = async () =>
      c.env.DB.prepare(
        `SELECT 1 FROM wallet_issues w JOIN visible_registrations r ON r.id=w.registration_id
      WHERE w.id=? AND w.revoked_at IS NULL AND r.ticket=? AND r.status IN ('confirmed','partially_refunded')`,
      )
        .bind(issueId, ticket.ticket)
        .first();
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO wallet_issues(id,registration_id,provider,ticket_hash)
      SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM visible_registrations WHERE id=? AND ticket=? AND status IN ('confirmed','partially_refunded'))`,
    )
      .bind(issueId, ticket.id, provider, hash, ticket.id, ticket.ticket)
      .run();
    if (!(await canIssue())) fail(409, 'Ce billet a changé. Rechargez la page.');
    c.header('Cache-Control', 'no-store');
    try {
      if (provider === 'apple') {
        const pass = {
          formatVersion: 1,
          passTypeIdentifier: c.env.APPLE_WALLET_PASS_TYPE,
          teamIdentifier: c.env.APPLE_WALLET_TEAM_ID,
          serialNumber: serial,
          organizationName: 'Ride For Brains',
          description: 'Billet Ride For Brains',
          foregroundColor: 'rgb(255, 255, 244)',
          backgroundColor: 'rgb(16, 45, 48)',
          ...(event.eventAt ? { relevantDate: event.eventAt } : {}),
          barcodes: [
            { format: 'PKBarcodeFormatQR', message: ticket.ticket, messageEncoding: 'iso-8859-1' },
          ],
          eventTicket: {
            primaryFields: [{ key: 'activity', label: 'ACTIVITÉ', value: challenge }],
            secondaryFields: [
              { key: 'name', label: 'PARTICIPANT', value: name },
              { key: 'date', label: 'DATE', value: date },
            ],
            auxiliaryFields: [
              ...(route.departure
                ? [{ key: 'departure', label: 'DÉPART', value: route.departure }]
                : []),
              ...(event.location ? [{ key: 'place', label: 'LIEU', value: event.location }] : []),
            ],
            backFields: [
              { key: 'number', label: 'Numéro de participation', value: ticket.id.slice(0, 8) },
            ],
          },
        };
        const signed = await c.env.APPLE_WALLET_SIGNER!.fetch(
          'https://wallet-signing.internal/pass',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pass),
          },
        );
        if (
          !signed.ok ||
          !signed.headers.get('Content-Type')?.startsWith('application/vnd.apple.pkpass') ||
          !signed.body
        )
          throw new Error('Signature Apple indisponible');
        if (!(await canIssue()))
          return c.json({ error: 'Ce billet a changé. Rechargez la page.' }, 409);
        return new Response(signed.body, {
          headers: {
            'Content-Type': 'application/vnd.apple.pkpass',
            'Cache-Control': 'no-store',
            'Content-Disposition': 'attachment; filename="Ride-For-Brains.pkpass"',
          },
        });
      }
      const { key, headers } = await googleCredentials(c.env);
      const object = {
        id: issueId,
        classId: c.env.GOOGLE_WALLET_CLASS,
        state: 'ACTIVE',
        ticketHolderName: name,
        ticketNumber: ticket.id.slice(0, 8),
        barcode: { type: 'QR_CODE', value: ticket.ticket },
        textModulesData: [
          { id: 'activity', header: 'Activité', body: challenge },
          ...(date ? [{ id: 'date', header: 'Date', body: date }] : []),
          ...(route.departure
            ? [{ id: 'departure', header: 'Départ', body: route.departure }]
            : []),
          ...(event.location ? [{ id: 'location', header: 'Lieu', body: event.location }] : []),
        ],
      };
      const res = await fetch(googleBase, {
        method: 'POST',
        headers,
        body: JSON.stringify(object),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok && res.status !== 409) throw new Error('Signature Google indisponible');
      if (!(await canIssue()))
        return c.json({ error: 'Ce billet a changé. Rechargez la page.' }, 409);
      const jwt = await new SignJWT({
        typ: 'savetowallet',
        origins: [new URL(c.env.APP_URL).origin],
        payload: { eventTicketObjects: [{ id: issueId }] },
      })
        .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
        .setIssuer(c.env.GOOGLE_WALLET_EMAIL!)
        .setAudience('google')
        .setIssuedAt(now())
        .sign(key);
      return c.json({ url: 'https://pay.google.com/gp/v/save/' + jwt });
    } catch {
      return c.json({ error: 'Impossible de préparer le pass Wallet pour le moment.' }, 502);
    }
  });
}
