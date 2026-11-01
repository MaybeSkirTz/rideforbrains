import { z } from 'zod';
import { listingConsent } from '../shared/public-participants';
export function publicParticipantRoutes(app: any, { actor, audit, fail, limited }: any) {
  app.get('/api/participants', async (c: any) => {
    const x = z
      .object({
        activity: z.string().max(50),
        page: z.coerce.number().int().min(1).max(10000).default(1),
      })
      .parse(c.req.query());
    const a = await c.env.DB.prepare(
      'SELECT id,name,sport,distance FROM activities WHERE id=? AND enabled=1',
    )
      .bind(x.activity)
      .first();
    if (!a) fail(404, 'Activité introuvable.');
    const where =
      "FROM visible_registrations WHERE activity_id=? AND status IN ('confirmed','partially_refunded')";
    const counts = await c.env.DB.prepare(
      'SELECT COUNT(*) total,COALESCE(SUM(CASE WHEN public_listing=1 AND public_listing_consent IS NOT NULL THEN 1 ELSE 0 END),0) listed ' +
        where,
    )
      .bind(a.id)
      .first();
    const rows = (
      await c.env.DB.prepare(
        'SELECT first_name,last_name ' +
          where +
          ' AND public_listing=1 AND public_listing_consent IS NOT NULL ORDER BY first_name COLLATE NOCASE,last_name COLLATE NOCASE,id LIMIT 40 OFFSET ?',
      )
        .bind(a.id, (x.page - 1) * 40)
        .all()
    ).results;
    c.header('X-Robots-Tag', 'noindex, nofollow');
    return c.json({
      activity: a,
      total: counts.total,
      listed: counts.listed,
      page: x.page,
      hasMore: x.page * 40 < counts.listed,
      participants: rows.map((r: any) => ({
        displayName: r.first_name + ' ' + Array.from(r.last_name.trim())[0] + '.',
      })),
    });
  });
  app.patch('/api/registrations/:id/public-listing', async (c: any) => {
    const a = await actor(c);
    await limited(c.env, 'public-listing:' + a.id, 20, 3600);
    const x = z
      .object({ publicListing: z.boolean(), confirm: z.literal(true) })
      .strict()
      .parse(await c.req.json());
    const r = await c.env.DB.prepare(
      'SELECT r.id,r.is_minor,r.order_id FROM visible_registrations r JOIN orders o ON o.id=r.order_id WHERE r.id=? AND COALESCE(r.transferred_user_id,o.user_id)=?',
    )
      .bind(c.req.param('id'), a.id)
      .first();
    if (!r) fail(404, 'Participation introuvable.');
    if (r.is_minor && x.publicListing)
      fail(
        409,
        'Pour un mineur, l’affichage public doit être autorisé par le parent pendant l’inscription. Vous pouvez retirer cet affichage ici.',
      );
    await c.env.DB.batch([
      c.env.DB.prepare(
        'UPDATE registrations SET public_listing=?,public_listing_consent=CASE WHEN ?=1 THEN ? ELSE public_listing_consent END WHERE id=?',
      ).bind(x.publicListing ? 1 : 0, x.publicListing ? 1 : 0, listingConsent(a.id), r.id),
      audit(c.env, a.id, 'public_listing.updated', r.id, { publicListing: x.publicListing }),
    ]);
    return c.json({ publicListing: x.publicListing });
  });
}
