import type { Hono } from 'hono';
import { z } from 'zod';
import { distanceKm, impactLabels } from '../shared/impact';
import type { Actor, AppContext, Env } from './types';
import { isLocal } from './types';

export const impactConfig = z
  .object({
    minimumParticipants: z.number().int().min(1).max(10000),
    participants: z.boolean(),
    km: z.boolean(),
    teams: z.boolean(),
    volunteers: z.boolean(),
  })
  .strict();

const validParticipation = `FROM visible_registrations r JOIN visible_orders o ON o.id=r.order_id
  WHERE r.status IN ('confirmed','partially_refunded') AND o.is_test=0
    AND (o.stripe_session IS NULL OR o.stripe_session NOT GLOB 'cs_test_*')
    AND json_extract(o.event_snapshot,'$.date')=?`;

export function impactRoutes(
  app: Hono<AppContext>,
  admin: Hono<AppContext>,
  {
    settings,
    staffActor,
    audit,
  }: {
    settings: (env: Env) => Promise<any>;
    staffActor: (c: any, permission: string) => Promise<Actor>;
    audit: (
      env: Env,
      actor: string,
      action: string,
      target: string,
      detail?: unknown,
    ) => D1PreparedStatement;
  },
) {
  app.get('/api/impact', async (c) => {
    const s = await settings(c.env);
    const config = impactConfig.safeParse(s.impact);
    const enabled = (Object.keys(impactLabels) as (keyof typeof impactLabels)[]).filter(
      (key) => config.success && config.data[key],
    );
    if (
      !config.success ||
      !enabled.length ||
      (!isLocal(c.env) && (c.env.APP_ENV !== 'production' || c.env.PAYMENTS_MODE !== 'live'))
    )
      return c.json({});
    const rows = await c.env.DB.prepare(
      `SELECT COALESCE(NULLIF(json_extract(r.activity_snapshot,'$.distance'),''),a.distance) AS distance,
      COUNT(*) AS n ${validParticipation.replace(' WHERE ', ' JOIN activities a ON a.id=r.activity_id WHERE ')} GROUP BY 1`,
    )
      .bind(s.date)
      .all<{ distance: string; n: number }>();
    const total = rows.results.reduce((sum, row) => sum + row.n, 0);
    if (total < config.data.minimumParticipants) return c.json({});
    const counts: Partial<Record<keyof typeof impactLabels, number>> = {};
    if (config.data.participants) counts.participants = total;
    if (config.data.km)
      counts.km =
        Math.round(
          rows.results.reduce((sum, row) => sum + distanceKm(row.distance) * row.n, 0) * 1000,
        ) / 1000;
    if (config.data.teams)
      counts.teams =
        (
          await c.env.DB.prepare(
            `SELECT COUNT(DISTINCT t.id) AS n
        ${validParticipation.replace(' WHERE ', ' JOIN team_members m ON m.registration_id=r.id AND m.user_id=COALESCE(r.transferred_user_id,o.user_id) JOIN teams t ON t.id=m.team_id WHERE ')}
        AND t.status='approved' AND t.visibility='public'`,
          )
            .bind(s.date)
            .first<{ n: number }>()
        )?.n || 0;
    if (config.data.volunteers)
      counts.volunteers =
        (
          await c.env.DB.prepare(
            "SELECT COUNT(DISTINCT lower(email)) AS n FROM submissions WHERE kind='volunteer' AND stage IN ('confirmed','present')",
          ).first<{ n: number }>()
        )?.n || 0;
    return c.json(counts);
  });
  admin.put('/impact/test-order', async (c) => {
    const actor = await staffActor(c, 'event');
    const { orderId, test } = z
      .object({ orderId: z.uuid(), test: z.boolean() })
      .strict()
      .parse(await c.req.json());
    const current = await c.env.DB.prepare('SELECT stripe_session FROM visible_orders WHERE id=?')
      .bind(orderId)
      .first<{ stripe_session: string | null }>();
    if (!current) return c.json({ error: 'Commande introuvable.' }, 404);
    if (!test && current.stripe_session?.startsWith('cs_test_'))
      return c.json({ error: 'Une session Stripe de test reste exclue des compteurs.' }, 409);
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE orders SET is_test=? WHERE id=? AND removed_at IS NULL').bind(
        Number(test),
        orderId,
      ),
      audit(c.env, actor.id, 'impact.test_order_changed', orderId, { test }),
    ]);
    return c.json({ ok: true });
  });
}
