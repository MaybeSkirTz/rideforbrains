import { z } from 'zod';
import type { Hono } from 'hono';
import { noticeTemplates, torontoSchedule } from '../shared/important-notices';
import { digest } from './crypto';
import { processMail } from './mail';
import { isLocal, now, uuid, type Actor, type AppContext, type Env } from './types';

const audience = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all') }).strict(),
  z.object({ kind: z.literal('activity'), id: z.string().max(50) }).strict(),
  z.object({ kind: z.literal('team'), id: z.uuid() }).strict(),
  z.object({ kind: z.literal('selection'), ids: z.array(z.uuid()).min(1).max(2000) }).strict(),
  z.object({ kind: z.literal('volunteers') }).strict(),
]);
const input = z
  .object({
    id: z.uuid(),
    category: z.enum(Object.keys(noticeTemplates) as [keyof typeof noticeTemplates]),
    audience,
    subject: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .refine((value) => !/[\r\n]/.test(value)),
    message: z.string().trim().min(1).max(12000),
    schedule: z.string().max(16).default(''),
  })
  .strict();
type Draft = z.infer<typeof input>;
type Recipient = {
  id: string;
  email: string;
  user_id: string | null;
  registration_id: string | null;
  activity: string;
};

async function recipients(env: Env, target: Draft['audience']) {
  const rows =
    target.kind === 'volunteers'
      ? await env.DB.prepare(
          `SELECT id,lower(email) AS email,NULL AS user_id,NULL AS registration_id,'Bénévolat' AS activity
        FROM submissions WHERE kind='volunteer' AND stage IN ('confirmed','present') ORDER BY id LIMIT 2001`,
        ).all<Recipient>()
      : await env.DB.prepare(
          `SELECT r.id,lower(r.email) AS email,COALESCE(r.transferred_user_id,o.user_id) AS user_id,
        r.id AS registration_id,a.name || ' · ' || a.distance AS activity
        FROM visible_registrations r JOIN orders o ON o.id=r.order_id JOIN activities a ON a.id=r.activity_id
        WHERE r.status IN ('confirmed','partially_refunded') AND
          (?='all' OR (?='activity' AND r.activity_id=?) OR (?='selection' AND r.id IN (SELECT value FROM json_each(?)))
            OR (?='team' AND EXISTS(SELECT 1 FROM team_members m JOIN teams t ON t.id=m.team_id
              WHERE m.registration_id=r.id AND m.user_id=COALESCE(r.transferred_user_id,o.user_id)
              AND t.id=? AND t.status IN ('pending','approved'))))
        ORDER BY r.id LIMIT 2001`,
        )
          .bind(
            target.kind,
            target.kind,
            target.kind === 'activity' ? target.id : null,
            target.kind,
            JSON.stringify(target.kind === 'selection' ? target.ids : []),
            target.kind,
            target.kind === 'team' ? target.id : null,
          )
          .all<Recipient>();
  return rows.results;
}

export function importantNoticeRoutes(
  admin: Hono<AppContext>,
  {
    staffActor,
    audit,
    fail,
    limited,
  }: {
    staffActor: (c: any, permission: string) => Promise<Actor>;
    audit: (
      env: Env,
      actor: string,
      action: string,
      target: string,
      detail?: unknown,
    ) => D1PreparedStatement;
    fail: (status: number, message: string) => never;
    limited: (env: Env, key: string, max: number, seconds: number) => Promise<void>;
  },
) {
  async function preview(env: Env, user: string, draft: Draft) {
    const scheduledAt = draft.schedule ? torontoSchedule(draft.schedule) : null;
    if (draft.schedule && (!scheduledAt || scheduledAt <= now()))
      fail(400, 'Choisissez une heure future valide et sans ambiguïté dans le fuseau de Toronto.');
    const rows = await recipients(env, draft.audience);
    if (rows.length > 2000) fail(400, 'Réduisez la sélection à 2 000 participations.');
    const unique = [...new Map(rows.map((row) => [row.email, row])).values()];
    const signature = await digest(
      env.BETTER_AUTH_SECRET + ':notice:v1:' + user + ':' + JSON.stringify([draft, rows]),
    );
    return {
      rows: unique,
      scheduledAt,
      signature,
      activities: [...new Set(rows.map((row) => row.activity))].sort(),
    };
  }

  admin.get('/mail/notices/teams', async (c) => {
    await staffActor(c, 'communications');
    return c.json(
      (
        await c.env.DB.prepare(
          "SELECT id,name FROM teams WHERE status IN ('pending','approved') ORDER BY name LIMIT 100",
        ).all()
      ).results,
    );
  });
  admin.get('/mail/notices', async (c) => {
    await staffActor(c, 'communications');
    const rows = await c.env.DB.prepare(
      `SELECT n.id,n.payload,n.scheduled_at,n.recipient_count,n.updated_at,n.enqueue_token IS NULL AS draft,
      (SELECT COUNT(*) FROM outbox WHERE notice_id=n.id AND status IN ('accepted','delivered')) AS sent,
      (SELECT COUNT(*) FROM outbox WHERE notice_id=n.id AND status IN ('failed','bounced','review','cancelled')) AS failed
      FROM important_notices n ORDER BY n.updated_at DESC LIMIT 50`,
    ).all<any>();
    return c.json(rows.results.map((row) => ({ ...row, payload: JSON.parse(row.payload) })));
  });
  admin.put('/mail/notices', async (c) => {
    const user = await staffActor(c, 'communications');
    const draft = input.parse(await c.req.json());
    const saved = await c.env.DB.prepare(
      `INSERT INTO important_notices(id,payload,created_by) VALUES(?,?,?)
      ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=unixepoch() WHERE important_notices.enqueue_token IS NULL RETURNING id`,
    )
      .bind(draft.id, JSON.stringify(draft), user.id)
      .first();
    if (!saved) fail(409, 'Cet avis a déjà été programmé ou envoyé.');
    return c.json({ id: draft.id });
  });
  admin.post('/mail/notices/preview', async (c) => {
    const user = await staffActor(c, 'communications');
    const draft = input.parse(await c.req.json());
    const result = await preview(c.env, user.id, draft);
    return c.json({
      count: result.rows.length,
      activities: result.activities,
      signature: result.signature,
      subject: draft.subject,
      message: draft.message,
      category: draft.category,
      scheduledAt: result.scheduledAt,
    });
  });
  admin.post('/mail/notices/send', async (c) => {
    const user = await staffActor(c, 'communications');
    const { draft, signature, confirm } = z
      .object({
        draft: input,
        signature: z.string().regex(/^[a-f0-9]{64}$/),
        confirm: z.literal(true),
      })
      .strict()
      .parse(await c.req.json());
    if (!confirm) fail(400, 'Confirmez l’envoi.');
    await limited(c.env, 'important-notice:' + user.id, 15, 60);
    const existing = await c.env.DB.prepare(
      'SELECT recipient_count,payload FROM important_notices WHERE id=? AND enqueue_token IS NOT NULL',
    )
      .bind(draft.id)
      .first<{ recipient_count: number; payload: string }>();
    if (existing) {
      if (existing.payload !== JSON.stringify(draft))
        fail(409, 'Cet avis a déjà été programmé ou envoyé.');
      return c.json({ count: existing.recipient_count, alreadyQueued: true });
    }
    const result = await preview(c.env, user.id, draft);
    if (result.signature !== signature || !result.rows.length)
      fail(409, 'Prévisualisez de nouveau l’avis et ses destinataires.');
    const token = uuid(),
      at = result.scheduledAt ?? now();
    const rows = result.rows.map((row) => ({ ...row, outbox_id: uuid() }));
    const statements = [
      c.env.DB.prepare(
        `INSERT INTO important_notices(id,payload,created_by,enqueue_token,scheduled_at,recipient_count)
        VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,enqueue_token=excluded.enqueue_token,
        scheduled_at=excluded.scheduled_at,recipient_count=excluded.recipient_count,updated_at=unixepoch()
        WHERE important_notices.enqueue_token IS NULL`,
      ).bind(draft.id, JSON.stringify(draft), user.id, token, at, rows.length),
      c.env.DB.prepare(
        `INSERT OR IGNORE INTO outbox(id,dedupe,user_id,registration_id,recipient,subject,body,kind,available_at,status,notice_id)
        SELECT json_extract(value,'$.outbox_id'), 'notice:' || ? || ':' || json_extract(value,'$.email'),
        json_extract(value,'$.user_id'),json_extract(value,'$.registration_id'),json_extract(value,'$.email'),
        ?,?,'operational',?,?,? FROM json_each(?)
        WHERE EXISTS(SELECT 1 FROM important_notices WHERE id=? AND enqueue_token=?)`,
      ).bind(
        draft.id,
        draft.subject,
        draft.message,
        at,
        isLocal(c.env) ? 'development' : 'queued',
        draft.id,
        JSON.stringify(rows),
        draft.id,
        token,
      ),
      c.env.DB.prepare(
        `INSERT INTO audit(id,actor,action,target,detail) SELECT ?,?,?,?,?
        WHERE EXISTS(SELECT 1 FROM important_notices WHERE id=? AND enqueue_token=?)`,
      ).bind(
        uuid(),
        user.id,
        result.scheduledAt ? 'notice.scheduled' : 'notice.queued',
        draft.id,
        JSON.stringify({ count: rows.length, category: draft.category, availableAt: at }),
        draft.id,
        token,
      ),
    ];
    const [queued] = await c.env.DB.batch(statements);
    if (queued.meta.changes !== 1) fail(409, 'Cet avis vient d’être mis en file par l’équipe.');
    c.executionCtx.waitUntil(processMail(c.env));
    return c.json({ count: rows.length, scheduledAt: result.scheduledAt }, 201);
  });
}
