import type { Hono } from 'hono';
import { z } from 'zod';
import { dayJPhase } from '../shared/day-j';
import { parse, type Actor, type AppContext } from './types';

export function finisherRoutes(app: Hono<AppContext>, actor: (context: any) => Promise<Actor>) {
  app.post('/api/finisher/:id', async (c) => {
    const user = await actor(c);
    const id = z.uuid().parse(c.req.param('id'));
    const row = await c.env.DB.prepare(
      `SELECT r.first_name,r.last_name,r.activity_snapshot,o.event_snapshot,a.name,a.sport,a.distance
      FROM visible_registrations r JOIN visible_orders o ON o.id=r.order_id JOIN activities a ON a.id=r.activity_id
      WHERE r.id=? AND COALESCE(r.transferred_user_id,o.user_id)=? AND r.checked_at>0
      AND r.status IN ('confirmed','partially_refunded') AND o.is_test=0
      AND (o.stripe_session IS NULL OR o.stripe_session NOT GLOB 'cs_test_*')`,
    )
      .bind(id, user.id)
      .first<any>();
    if (!row) return c.json({ error: 'Souvenir indisponible pour cette participation.' }, 404);
    const event = parse(row.event_snapshot),
      activity = parse(row.activity_snapshot);
    if (!event.date || !event.eventAt || dayJPhase(event.date) !== 'after')
      return c.json({ error: 'Le souvenir est disponible après la journée de l’événement.' }, 409);
    await c.env.DB.prepare(
      "INSERT OR IGNORE INTO audit(id,actor,action,target) VALUES(?,?,'finisher.issued',?)",
    )
      .bind('finisher:' + id + ':' + user.id, user.id, id)
      .run();
    c.header('Cache-Control', 'no-store');
    return c.json({
      firstName: row.first_name,
      lastName: row.last_name,
      eventAt: event.eventAt,
      activity: activity.name || row.name,
      distance: activity.distance || row.distance,
      sport: activity.sport || row.sport,
    });
  });
}
