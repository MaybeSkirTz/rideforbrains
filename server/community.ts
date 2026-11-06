import { z } from 'zod';
import type { Hono } from 'hono';
import { digest, opaqueToken } from './crypto';
import { parse, uuid, type Actor, type AppContext, type Env } from './types';
import { distanceKm } from '../shared/impact';

type Dependencies = {
  actor: (c: any) => Promise<Actor>;
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
};
const active = "r.status IN ('confirmed','partially_refunded')";
const ownership = `FROM visible_registrations r JOIN orders o ON o.id=r.order_id
  WHERE COALESCE(r.transferred_user_id,o.user_id)=? AND ${active}`;
const memberJoin = `FROM team_members m JOIN visible_registrations r ON r.id=m.registration_id
  JOIN orders o ON o.id=r.order_id WHERE ${active} AND COALESCE(r.transferred_user_id,o.user_id)=m.user_id`;
const photoUrl = z.union([
  z.literal(''),
  z
    .url()
    .max(1000)
    .refine((value) => value.startsWith('https://')),
]);
const teamInput = z
  .object({
    registrationId: z.uuid(),
    name: z
      .string()
      .trim()
      .min(2)
      .max(90)
      .refine((value) => !/[\r\n\x00]/.test(value)),
    description: z.string().trim().max(600).default(''),
    photo: photoUrl.default(''),
    visibility: z.enum(['public', 'private']),
  })
  .strict();

export function communityRoutes(app: Hono<AppContext>, admin: Hono<AppContext>, d: Dependencies) {
  const { actor, staffActor, audit, fail, limited } = d;
  async function requireRegistration(env: Env, user: Actor, id: string) {
    const row = await env.DB.prepare('SELECT r.id,r.email,r.is_minor ' + ownership + ' AND r.id=?')
      .bind(user.id, id)
      .first<{ id: string; email: string; is_minor: number }>();
    if (!row) fail(404, 'Participation confirmée introuvable.');
    return row!;
  }

  app.get('/api/teams', async (c) => {
    const rows = await c.env.DB.prepare(
      `SELECT t.id,t.name,t.description,t.photo,
      (SELECT COUNT(*) ${memberJoin} AND m.team_id=t.id) AS members FROM teams t
      WHERE t.visibility='public' AND t.status='approved' ORDER BY t.name COLLATE NOCASE LIMIT 100`,
    ).all();
    return c.json(rows.results);
  });

  app.get('/api/community/me', async (c) => {
    const user = await actor(c);
    const [registrations, teams, posts] = await Promise.all([
      c.env.DB.prepare(
        `SELECT r.id,r.first_name,r.activity_id,r.is_minor=0 AND lower(r.email)=? AS can_show_first,
        t.id AS team_id,t.name AS team_name,t.status AS team_status,m.show_first
        FROM visible_registrations r JOIN orders o ON o.id=r.order_id
        LEFT JOIN team_members m ON m.registration_id=r.id AND m.user_id=?
        LEFT JOIN teams t ON t.id=m.team_id WHERE COALESCE(r.transferred_user_id,o.user_id)=? AND ${active}
        ORDER BY r.created_at DESC`,
      )
        .bind(user.email.toLowerCase(), user.id, user.id)
        .all(),
      c.env.DB.prepare(
        'SELECT id,name,visibility,status FROM teams WHERE owner_id=? ORDER BY created_at DESC',
      )
        .bind(user.id)
        .all(),
      c.env.DB.prepare(
        'SELECT kind,title,text,photo,consent,status,revision FROM community_posts WHERE user_id=?',
      )
        .bind(user.id)
        .all(),
    ]);
    c.header('Cache-Control', 'no-store');
    return c.json({
      registrations: registrations.results,
      teams: teams.results,
      posts: posts.results,
    });
  });
  app.post('/api/teams', async (c) => {
    const user = await actor(c);
    await limited(c.env, 'team-create:' + user.id, 5, 3600);
    const input = teamInput.parse(await c.req.json());
    await requireRegistration(c.env, user, input.registrationId);
    if (
      await c.env.DB.prepare('SELECT 1 FROM team_members WHERE registration_id=? AND user_id=?')
        .bind(input.registrationId, user.id)
        .first()
    )
      fail(409, 'Quittez d’abord l’équipe de cette participation.');
    const id = uuid(),
      code = input.visibility === 'private' ? opaqueToken() : null;
    try {
      const [created] = await c.env.DB.batch([
        c.env.DB.prepare(
          `INSERT INTO teams(id,name,description,photo,visibility,owner_id,invite_hash)
          SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 ${ownership} AND r.id=?)
          AND NOT EXISTS(SELECT 1 FROM team_members WHERE registration_id=? AND user_id=?)`,
        ).bind(
          id,
          input.name,
          input.description,
          input.photo,
          input.visibility,
          user.id,
          code && (await digest(code)),
          user.id,
          input.registrationId,
          input.registrationId,
          user.id,
        ),
        c.env.DB.prepare(
          `INSERT INTO team_members(registration_id,team_id,user_id) SELECT ?,id,? FROM teams WHERE id=?
          ON CONFLICT(registration_id) DO UPDATE SET team_id=excluded.team_id,user_id=excluded.user_id,show_first=0,joined_at=unixepoch()
          WHERE team_members.user_id<>excluded.user_id`,
        ).bind(input.registrationId, user.id, id),
        c.env.DB.prepare(
          "INSERT INTO audit(id,actor,action,target,detail) SELECT ?,?,'team.created',?,? WHERE EXISTS(SELECT 1 FROM teams WHERE id=?)",
        ).bind(uuid(), user.id, id, JSON.stringify({ visibility: input.visibility }), id),
      ]);
      if (!created.meta.changes) fail(409, 'L’inscription ou l’équipe a changé.');
    } catch (e) {
      if (/UNIQUE|FOREIGN KEY/.test(String(e))) fail(409, 'L’inscription ou l’équipe a changé.');
      throw e;
    }
    return c.json({ id, invite: code ? '/equipes/' + id + '#' + code : null }, 201);
  });
  app.get('/api/teams/:id', async (c) => {
    const id = z.uuid().parse(c.req.param('id'));
    const team = await c.env.DB.prepare(
      'SELECT id,name,description,photo,status,visibility,owner_id FROM teams WHERE id=?',
    )
      .bind(id)
      .first<any>();
    const publicTeam = team?.visibility === 'public' && team.status === 'approved';
    if (!publicTeam) {
      let user: Actor | null = null;
      try {
        user = await actor(c);
      } catch {
        /* invitation stays private */
      }
      if (
        !team ||
        !user ||
        (team.owner_id !== user.id &&
          !(await c.env.DB.prepare('SELECT 1 ' + memberJoin + ' AND m.team_id=? AND m.user_id=?')
            .bind(id, user.id)
            .first()))
      )
        fail(404, 'Équipe privée ou indisponible.');
    }
    const members = ['rejected', 'hidden'].includes(team.status)
      ? []
      : (
          await c.env.DB.prepare(
            `SELECT r.first_name,r.activity_snapshot,a.name,a.distance,
      m.show_first AND r.is_minor=0 AND lower(r.email)=lower(u.email) AS listed
      ${memberJoin.replace(' WHERE ', ' JOIN activities a ON a.id=r.activity_id JOIN user u ON u.id=m.user_id WHERE ')}
      AND m.team_id=? ORDER BY m.joined_at,r.id`,
          )
            .bind(id)
            .all<any>()
        ).results;
    const activities = new Map<string, number>();
    let km = 0;
    for (const member of members) {
      const saved = parse(member.activity_snapshot),
        distance = saved.distance || member.distance;
      const label = (saved.name || member.name) + ' · ' + distance;
      activities.set(label, (activities.get(label) || 0) + 1);
      km += distanceKm(distance);
    }
    c.header('Cache-Control', 'no-store');
    const { owner_id, ...safeTeam } = team;
    return c.json({
      ...safeTeam,
      members: members.length,
      km,
      activities: [...activities],
      firstNames: publicTeam
        ? members.filter((row) => row.listed).map((row) => row.first_name)
        : [],
    });
  });
  app.post('/api/teams/:id/join', async (c) => {
    const user = await actor(c);
    await limited(c.env, 'team-join:' + user.id, 20, 3600);
    const id = z.uuid().parse(c.req.param('id'));
    const { registrationId, code } = z
      .object({
        registrationId: z.uuid(),
        code: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .optional(),
      })
      .strict()
      .parse(await c.req.json());
    await requireRegistration(c.env, user, registrationId);
    const result = await c.env.DB.prepare(
      `INSERT INTO team_members(registration_id,team_id,user_id)
      SELECT ?,t.id,? FROM teams t WHERE t.id=?
        AND ((t.visibility='public' AND t.status='approved') OR (t.visibility='private' AND t.status IN ('pending','approved') AND t.invite_hash=?))
        AND EXISTS(SELECT 1 ${ownership} AND r.id=?)
      ON CONFLICT(registration_id) DO UPDATE SET team_id=excluded.team_id,user_id=excluded.user_id,show_first=0,joined_at=unixepoch()
      WHERE team_members.user_id<>excluded.user_id RETURNING team_id`,
    )
      .bind(registrationId, user.id, id, code ? await digest(code) : null, user.id, registrationId)
      .first();
    if (!result) fail(409, 'Invitation invalide ou participation déjà dans une équipe.');
    return c.json({ ok: true }, 201);
  });
  app.post('/api/teams/:id/invitation', async (c) => {
    const user = await actor(c);
    const id = z.uuid().parse(c.req.param('id'));
    const code = opaqueToken();
    const result = await c.env.DB.prepare(
      "UPDATE teams SET invite_hash=? WHERE id=? AND owner_id=? AND visibility='private' AND status IN ('pending','approved') RETURNING id",
    )
      .bind(await digest(code), id, user.id)
      .first();
    if (!result) fail(404, 'Équipe privée introuvable.');
    return c.json({ invite: '/equipes/' + id + '#' + code });
  });
  app.put('/api/team-members/:id', async (c) => {
    const user = await actor(c);
    const id = z.uuid().parse(c.req.param('id'));
    const { showFirst } = z
      .object({ showFirst: z.boolean() })
      .strict()
      .parse(await c.req.json());
    const r = await requireRegistration(c.env, user, id);
    if (showFirst && (r.is_minor || r.email.toLowerCase() !== user.email.toLowerCase()))
      fail(403, 'Seul le titulaire majeur de cette participation peut publier son prénom.');
    const result = await c.env.DB.prepare(
      'UPDATE team_members SET show_first=? WHERE registration_id=? AND user_id=? RETURNING registration_id',
    )
      .bind(Number(showFirst), id, user.id)
      .first();
    if (!result) fail(404, 'Adhésion introuvable.');
    return c.json({ ok: true });
  });
  app.delete('/api/team-members/:id', async (c) => {
    const user = await actor(c);
    await c.env.DB.prepare('DELETE FROM team_members WHERE registration_id=? AND user_id=?')
      .bind(z.uuid().parse(c.req.param('id')), user.id)
      .run();
    return c.json({ ok: true });
  });
  admin.get('/community/teams', async (c) => {
    await staffActor(c, 'community');
    const result = await c.env.DB.prepare(
      `SELECT t.id,t.name,t.description,t.photo,t.visibility,t.status,u.name AS owner,
      (SELECT COUNT(*) ${memberJoin} AND m.team_id=t.id) AS members
      FROM teams t JOIN user u ON u.id=t.owner_id ORDER BY t.status='pending' DESC,t.created_at DESC LIMIT 100`,
    ).all();
    return c.json(result.results);
  });
  admin.get('/community/teams/:id/members', async (c) => {
    await staffActor(c, 'community');
    const id = z.uuid().parse(c.req.param('id'));
    const result = await c.env.DB.prepare(
      `SELECT r.first_name,r.last_name,r.activity_id,m.registration_id,m.show_first
      ${memberJoin} AND m.team_id=? ORDER BY m.joined_at LIMIT 200`,
    )
      .bind(id)
      .all();
    return c.json(result.results);
  });
  admin.put('/community/teams/:id', async (c) => {
    const user = await staffActor(c, 'community');
    const id = z.uuid().parse(c.req.param('id'));
    const { status } = z
      .object({ status: z.enum(['approved', 'rejected', 'hidden']) })
      .strict()
      .parse(await c.req.json());
    const [updated] = await c.env.DB.batch([
      c.env.DB.prepare('UPDATE teams SET status=? WHERE id=?').bind(status, id),
      c.env.DB.prepare(
        "INSERT INTO audit(id,actor,action,target,detail) SELECT ?,?,'team.moderated',?,? WHERE EXISTS(SELECT 1 FROM teams WHERE id=?)",
      ).bind(uuid(), user.id, id, JSON.stringify({ status }), id),
    ]);
    if (!updated.meta.changes) fail(404, 'Équipe introuvable.');
    return c.json({ ok: true });
  });

  contributionRoutes(app, admin, d);
}

function contributionRoutes(
  app: Hono<AppContext>,
  admin: Hono<AppContext>,
  { actor, staffActor, audit, fail, limited }: Dependencies,
) {
  const kindSchema = z.enum(['story', 'dedication']);
  app.get('/api/community/:kind', async (c) => {
    const kind = kindSchema.parse(c.req.param('kind'));
    const result = await c.env.DB.prepare(
      `SELECT p.id,p.title,p.text,p.photo FROM community_posts p
      WHERE p.kind=? AND p.consent=1 AND p.status='approved'
      AND EXISTS(SELECT 1 ${ownership.replace('=?', '=p.user_id')} AND r.is_minor=0
        AND lower(r.email)=(SELECT lower(email) FROM user WHERE id=p.user_id))
      ORDER BY p.updated_at DESC LIMIT 80`,
    )
      .bind(kind)
      .all();
    return c.json(result.results);
  });
  app.put('/api/community/contribution', async (c) => {
    const user = await actor(c);
    await limited(c.env, 'community-post:' + user.id, 20, 3600);
    const x = z
      .object({
        kind: kindSchema,
        title: z.string().trim().max(120).default(''),
        text: z.string().trim().min(1).max(1800),
        photo: photoUrl.default(''),
        consent: z.boolean(),
        submit: z.boolean(),
      })
      .strict()
      .parse(await c.req.json());
    if (x.kind === 'dedication' && (x.text.length > 160 || x.title || x.photo))
      fail(400, 'La dédicace doit être une courte phrase.');
    if (
      !(await c.env.DB.prepare('SELECT 1 ' + ownership)
        .bind(user.id)
        .first())
    )
      fail(403, 'Une participation confirmée est nécessaire.');
    if (
      x.submit &&
      (!x.consent ||
        !(await c.env.DB.prepare('SELECT 1 ' + ownership + ' AND r.is_minor=0 AND lower(r.email)=?')
          .bind(user.id, user.email.toLowerCase())
          .first()))
    )
      fail(403, 'La publication exige le consentement du titulaire majeur de la participation.');
    const status =
      x.kind === 'story' ? (x.submit ? 'submitted' : 'draft') : x.submit ? 'pending' : 'private';
    await c.env.DB.prepare(
      `INSERT INTO community_posts(id,user_id,kind,title,text,photo,consent,status)
      VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id,kind) DO UPDATE SET title=excluded.title,text=excluded.text,photo=excluded.photo,
      consent=excluded.consent,status=excluded.status,revision=community_posts.revision+1,updated_at=unixepoch()`,
    )
      .bind(
        uuid(),
        user.id,
        x.kind,
        x.title,
        x.text,
        x.photo,
        Number(x.submit && x.consent),
        status,
      )
      .run();
    return c.json({ status });
  });
  app.delete('/api/community/contribution/:kind', async (c) => {
    const user = await actor(c);
    const kind = kindSchema.parse(c.req.param('kind'));
    const row = await c.env.DB.prepare(
      'UPDATE community_posts SET status=?,consent=0,revision=revision+1,updated_at=unixepoch() WHERE user_id=? AND kind=? RETURNING id',
    )
      .bind(kind === 'story' ? 'archived' : 'hidden', user.id, kind)
      .first<{ id: string }>();
    if (row) await audit(c.env, user.id, kind + '.withdrawn', row.id).run();
    return c.json({ ok: true });
  });
  admin.get('/community/posts', async (c) => {
    await staffActor(c, 'community');
    return c.json(
      (
        await c.env.DB.prepare(
          `SELECT id,kind,title,text,photo,status,revision,updated_at FROM community_posts
      WHERE consent=1 AND status IN ('submitted','pending','approved','rejected','archived','hidden')
      ORDER BY status IN ('submitted','pending') DESC,updated_at DESC LIMIT 100`,
        ).all()
      ).results,
    );
  });
  admin.put('/community/posts/:id', async (c) => {
    const user = await staffActor(c, 'community');
    const id = z.uuid().parse(c.req.param('id'));
    const x = z
      .object({
        status: z.enum(['approved', 'rejected', 'archived', 'hidden']),
        revision: z.number().int().positive(),
      })
      .strict()
      .parse(await c.req.json());
    const current = await c.env.DB.prepare(
      'SELECT kind,status FROM community_posts WHERE id=? AND revision=? AND consent=1',
    )
      .bind(id, x.revision)
      .first<{ kind: string; status: string }>();
    if (!current) fail(409, 'Cette contribution a changé ou a été retirée.');
    if (
      (x.status === 'archived' && current!.kind !== 'story') ||
      (x.status === 'hidden' && current!.kind !== 'dedication')
    )
      fail(400, 'Statut incompatible avec la contribution.');
    const where = 'id=? AND revision=? AND consent=1';
    const [, updated] = await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO audit(id,actor,action,target,detail) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM community_posts WHERE ${where})`,
      ).bind(
        uuid(),
        user.id,
        current!.kind + (x.status === 'approved' ? '.published' : '.moderated'),
        id,
        JSON.stringify({ status: x.status }),
        id,
        x.revision,
      ),
      c.env.DB.prepare(
        'UPDATE community_posts SET status=?,revision=revision+1,updated_at=unixepoch() WHERE ' +
          where,
      ).bind(x.status, id, x.revision),
    ]);
    if (!updated.meta.changes) fail(409, 'Cette contribution a changé ou a été retirée.');
    return c.json({ ok: true });
  });
}
