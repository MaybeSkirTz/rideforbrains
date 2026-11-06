import { z } from 'zod';
import type { Hono } from 'hono';
import { dayJPhase, dayJSteps, type DayJ } from '../shared/day-j';
import { parse, type Actor, type AppContext, type Env } from './types';

const eligible = "r.status IN ('pending','confirmed','partially_refunded','paid_review')";

export function dayJRoutes(
  app: Hono<AppContext>,
  {
    actor,
    settings,
  }: { actor: (context: any) => Promise<Actor>; settings: (env: Env) => Promise<any> },
) {
  app.get('/api/day-j', async (c) => {
    const user = await actor(c);
    const [s, result, progress, notices] = await Promise.all([
      settings(c.env),
      c.env.DB.prepare(
        `SELECT r.id,r.first_name,r.last_name,r.status,r.activity_snapshot,r.activity_id,r.conditions_version,
          r.accepted_at,r.is_minor,r.guardian_snapshot,r.ticket IS NOT NULL AS has_ticket,r.checked_at,
          o.event_snapshot,o.is_test,o.stripe_session,
          o.amount,o.payment_intent IS NOT NULL AS has_payment,a.name,a.distance,a.sport,a.route,a.enabled
          FROM visible_registrations r JOIN orders o ON o.id=r.order_id
          JOIN activities a ON a.id=r.activity_id
          WHERE COALESCE(r.transferred_user_id,o.user_id)=? AND ${eligible}
          ORDER BY r.created_at DESC,r.id`,
      )
        .bind(user.id)
        .all<any>(),
      c.env.DB.prepare('SELECT registration_id,step FROM day_j_progress WHERE user_id=?')
        .bind(user.id)
        .all<{ registration_id: string; step: (typeof dayJSteps)[number] }>(),
      c.env.DB.prepare(
        `SELECT m.id,m.subject,m.body,m.registration_id FROM outbox m JOIN important_notices n ON n.id=m.notice_id
        JOIN visible_registrations r ON r.id=m.registration_id JOIN orders o ON o.id=r.order_id
        WHERE m.user_id=? AND COALESCE(r.transferred_user_id,o.user_id)=m.user_id AND n.scheduled_at<=unixepoch()
        AND lower(r.email)=m.recipient AND r.status IN ('confirmed','partially_refunded') AND m.status!='cancelled'
        ORDER BY n.scheduled_at DESC,m.id LIMIT 40`,
      )
        .bind(user.id)
        .all<DayJ['messages'][number]>(),
    ]);
    const entries: DayJ['entries'] = result.results.map((row) => {
      const snapshot = parse(row.activity_snapshot),
        route = parse(row.route);
      const confirmed = ['confirmed', 'partially_refunded'].includes(row.status);
      return {
        id: row.id,
        firstName: row.first_name,
        lastInitial: Array.from(String(row.last_name).trim())[0] || '',
        activity: {
          id: row.activity_id,
          name: snapshot.name || row.name,
          distance: snapshot.distance || row.distance,
          sport: row.sport,
        },
        arrival: route.arrival,
        departure: route.departure,
        start: route.startLabel,
        supplies: route.supplies || [],
        routePath:
          row.enabled && (route.coordinates?.length > 1 || route.mapUrl || route.gpxUrl)
            ? '/activites/' + row.activity_id
            : undefined,
        confirmed,
        payment: row.amount === 0 && confirmed ? 'free' : row.has_payment ? 'confirmed' : 'pending',
        ticketReady: confirmed && !!row.has_ticket,
        finisherReady:
          confirmed &&
          row.checked_at > 0 &&
          !row.is_test &&
          !row.stripe_session?.startsWith('cs_test_') &&
          !!parse(row.event_snapshot).date &&
          dayJPhase(parse(row.event_snapshot).date) === 'after',
        consentsComplete: !!(
          row.conditions_version &&
          row.accepted_at &&
          (!row.is_minor || row.guardian_snapshot)
        ),
        progress: progress.results
          .filter((item) => item.registration_id === row.id)
          .map((item) => item.step),
      };
    });
    c.header('Cache-Control', 'no-store');
    return c.json({
      phase: dayJPhase(s.date),
      messages: notices.results,
      event: {
        title: s.title,
        edition: s.edition,
        date: s.date,
        eventAt: s.eventAt,
        location: s.location,
        reception: s.reception,
        details: s.dayJ || {},
      },
      entries,
    } satisfies DayJ);
  });

  app.put('/api/day-j/:id/progress', async (c) => {
    const user = await actor(c);
    const id = z.uuid().parse(c.req.param('id'));
    const { step, done } = z
      .object({ step: z.enum(dayJSteps), done: z.boolean() })
      .strict()
      .parse(await c.req.json());
    const ownership = `SELECT 1 FROM visible_registrations r JOIN orders o ON o.id=r.order_id
      WHERE r.id=? AND COALESCE(r.transferred_user_id,o.user_id)=? AND ${eligible}`;
    if (!(await c.env.DB.prepare(ownership).bind(id, user.id).first()))
      return c.json({ error: 'Participation introuvable.' }, 404);
    if (done)
      await c.env.DB.prepare(
        'INSERT OR IGNORE INTO day_j_progress(registration_id,user_id,step) SELECT ?,?,? WHERE EXISTS(' +
          ownership +
          ')',
      )
        .bind(id, user.id, step, id, user.id)
        .run();
    else
      await c.env.DB.prepare(
        'DELETE FROM day_j_progress WHERE registration_id=? AND user_id=? AND step=?',
      )
        .bind(id, user.id, step)
        .run();
    return c.json({ ok: true });
  });
}
