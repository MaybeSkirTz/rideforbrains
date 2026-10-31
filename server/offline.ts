import { z } from 'zod';
import { uuid, now } from './types';
import { digest } from './crypto';
export function offlineRoutes(app: any, { staffActor, audit, fail }: any) {
  app.post('/api/admin/offline/snapshot', async (c: any) => {
    const a = await staffActor(c, 'checkin');
    z.object({ confirm: z.literal(true) })
      .strict()
      .parse(await c.req.json());
    const rows = (
      await c.env.DB.prepare(
        "SELECT r.id,r.ticket,r.first_name,r.last_name,r.checked_at,a.name,a.distance FROM visible_registrations r JOIN activities a ON a.id=r.activity_id WHERE r.status IN ('confirmed','partially_refunded') LIMIT 5001",
      ).all()
    ).results;
    if (rows.length > 5000)
      fail(
        409,
        'Plus de 5 000 billets : une préparation paginée est requise. Utilisez le contrôle en ligne.',
      );
    const id = uuid(),
      expiresAt = now() + 86400;
    await c.env.DB.batch([
      c.env.DB.prepare(
        'INSERT INTO offline_snapshots(id,staff_id,issued_at,expires_at) VALUES(?,?,?,?)',
      ).bind(id, a.id, now(), expiresAt),
      audit(c.env, a.id, 'offline.snapshot_created', id, { count: rows.length, expiresAt }),
    ]);
    const tickets = await Promise.all(
      rows.map(async (r: any) => ({
        id: r.id,
        hash: await digest(r.ticket),
        initials: r.first_name.slice(0, 1) + r.last_name.slice(0, 1),
        activity: r.name + ' ' + r.distance,
        checked: !!r.checked_at,
      })),
    );
    return c.json({ id, expiresAt, tickets });
  });
  app.post('/api/admin/offline/sync', async (c: any) => {
    const a = await staffActor(c, 'checkin');
    const x = z
      .object({
        snapshotId: z.uuid(),
        events: z
          .array(
            z
              .object({
                id: z.uuid(),
                registrationId: z.uuid(),
                scannedAt: z.number().int().positive(),
              })
              .strict(),
          )
          .max(100),
      })
      .strict()
      .parse(await c.req.json());
    const snapshot = await c.env.DB.prepare(
      'SELECT * FROM offline_snapshots WHERE id=? AND staff_id=? AND revoked=0 AND expires_at>unixepoch()',
    )
      .bind(x.snapshotId, a.id)
      .first();
    if (!snapshot)
      fail(
        409,
        'La liste de secours a expiré ou ne correspond pas à votre compte. Rapprochez les scans avec l’organisation.',
      );
    const results = [];
    for (const event of x.events) {
      if (event.scannedAt < snapshot.issued_at - 60 || event.scannedAt > now() + 300)
        fail(400, 'Heure de scan invalide');
      await c.env.DB.batch([
        c.env.DB.prepare(
          "UPDATE registrations SET checked_at=? WHERE id=? AND removed_at IS NULL AND checked_at IS NULL AND status IN ('confirmed','partially_refunded') AND NOT EXISTS(SELECT 1 FROM offline_checkins WHERE id=?)",
        ).bind(now(), event.registrationId, event.id),
        c.env.DB.prepare(
          "INSERT OR IGNORE INTO offline_checkins(id,snapshot_id,registration_id,scanned_at,result) VALUES(?,?,?,?,CASE WHEN changes()=1 THEN 'accepted' WHEN EXISTS(SELECT 1 FROM visible_registrations WHERE id=? AND status IN ('confirmed','partially_refunded') AND checked_at IS NOT NULL) THEN 'already_used' ELSE 'invalid' END)",
        ).bind(event.id, snapshot.id, event.registrationId, event.scannedAt, event.registrationId),
        c.env.DB.prepare(
          "INSERT OR IGNORE INTO audit(id,actor,action,target,detail) SELECT ?,?,'offline.checkin_synced',registration_id,json_object('result',result,'snapshot',snapshot_id) FROM offline_checkins WHERE id=? AND snapshot_id=?",
        ).bind('offline:' + event.id, a.id, event.id, snapshot.id),
      ]);
      const receipt = await c.env.DB.prepare(
        'SELECT id,result FROM offline_checkins WHERE id=? AND snapshot_id=?',
      )
        .bind(event.id, snapshot.id)
        .first();
      if (!receipt) fail(409, 'Identifiant de scan déjà utilisé par un autre appareil.');
      results.push(receipt);
    }
    return c.json({ results });
  });
  app.post('/api/admin/offline/revoke', async (c: any) => {
    const a = await staffActor(c, 'checkin');
    const { id } = z
      .object({ id: z.uuid() })
      .strict()
      .parse(await c.req.json());
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE offline_snapshots SET revoked=1 WHERE id=? AND staff_id=?').bind(
        id,
        a.id,
      ),
      audit(c.env, a.id, 'offline.snapshot_revoked', id),
    ]);
    return c.json({ ok: true });
  });
}
