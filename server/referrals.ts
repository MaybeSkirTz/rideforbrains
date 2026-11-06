import type { Context, Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { digest } from './crypto';
import { isLocal, uuid, type Actor, type AppContext, type Env } from './types';

const valid = /^[a-f0-9]{32}$/;
const newCode = () => uuid().replaceAll('-', '');
const lifetime = 30 * 86400;
const confirmed = `SELECT 1 FROM visible_registrations r JOIN orders o ON o.id=r.order_id
  WHERE COALESCE(r.transferred_user_id,o.user_id)=USER_ID AND r.status IN ('confirmed','partially_refunded')`;

export async function referralAttribution(c: Context<AppContext>, orderId: string, userId: string) {
  const code = getCookie(c, 'rfb_referral');
  const visitor = getCookie(c, 'rfb_visitor');
  if (!code || !visitor || !valid.test(code) || !valid.test(visitor)) return null;
  return c.env.DB.prepare(
    `INSERT OR IGNORE INTO referral_attributions(order_id,code)
    SELECT ?,f.code FROM referrals f JOIN referral_visits v ON v.code=f.code
    WHERE f.code=? AND f.user_id<>? AND v.visitor_hash=? AND v.visited_at>=unixepoch()-?
    AND EXISTS(${confirmed.replace('USER_ID', 'f.user_id')})`,
  ).bind(orderId, code, userId, await digest(visitor), lifetime);
}

export function referralRoutes(
  app: Hono<AppContext>,
  admin: Hono<AppContext>,
  {
    actor,
    staffActor,
    limited,
  }: {
    actor: (c: any) => Promise<Actor>;
    staffActor: (c: any, permission: string) => Promise<Actor>;
    limited: (env: Env, key: string, max: number, seconds: number) => Promise<void>;
  },
) {
  app.post('/api/referral', async (c) => {
    const user = await actor(c);
    if (!(await c.env.DB.prepare(confirmed.replace('USER_ID', '?')).bind(user.id).first()))
      return c.json({ error: 'Une participation confirmée est nécessaire.' }, 403);
    await c.env.DB.prepare('INSERT OR IGNORE INTO referrals(code,user_id) VALUES(?,?)')
      .bind(newCode(), user.id)
      .run();
    const row = await c.env.DB.prepare('SELECT code FROM referrals WHERE user_id=?')
      .bind(user.id)
      .first<{ code: string }>();
    c.header('Cache-Control', 'no-store');
    return c.json({ path: '/r/' + row!.code });
  });
  app.get('/r/:code', async (c) => {
    c.header('Cache-Control', 'no-store');
    c.header('X-Robots-Tag', 'noindex, nofollow');
    c.header('Referrer-Policy', 'no-referrer');
    const code = c.req.param('code');
    if (
      !valid.test(code) ||
      !(await c.env.DB.prepare(
        'SELECT 1 FROM referrals f WHERE f.code=? AND EXISTS(' +
          confirmed.replace('USER_ID', 'f.user_id') +
          ')',
      )
        .bind(code)
        .first())
    )
      return c.redirect('/activites', 302);
    await limited(c.env, 'referral-visit:' + (c.req.header('cf-connecting-ip') || 'local'), 40, 60);
    const previous = getCookie(c, 'rfb_visitor');
    const visitor = previous && valid.test(previous) ? previous : newCode();
    await c.env.DB.prepare(
      `INSERT INTO referral_visits(code,visitor_hash) VALUES(?,?)
      ON CONFLICT(code,visitor_hash) DO UPDATE SET visited_at=unixepoch()`,
    )
      .bind(code, await digest(visitor))
      .run();
    const options = {
      httpOnly: true,
      secure: !isLocal(c.env),
      sameSite: 'Lax' as const,
      path: '/',
      maxAge: lifetime,
    };
    setCookie(c, 'rfb_visitor', visitor, options);
    setCookie(c, 'rfb_referral', code, options);
    return c.redirect('/activites', 302);
  });
  admin.get('/referrals', async (c) => {
    await staffActor(c, 'event');
    const result = await c.env.DB.prepare(
      `SELECT f.code,u.name,
      (SELECT COUNT(*) FROM referral_visits v WHERE v.code=f.code) AS visits,
      (SELECT COUNT(*) FROM referral_attributions t JOIN visible_registrations r ON r.order_id=t.order_id JOIN orders o ON o.id=t.order_id
        WHERE t.code=f.code AND r.status IN ('confirmed','partially_refunded') AND o.is_test=0
          AND (o.stripe_session IS NULL OR o.stripe_session NOT GLOB 'cs_test_*')) AS registrations
      FROM referrals f JOIN user u ON u.id=f.user_id ORDER BY f.created_at DESC LIMIT 100`,
    ).all();
    return c.json(result.results);
  });
}
