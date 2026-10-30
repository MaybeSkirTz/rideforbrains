import { z } from 'zod';
import { uuid, now, parse, json } from './types';
import { digest, opaqueToken } from './crypto';
import { participantSchema, validateAnswers, email } from './validation';
import { editorial } from '../shared/editorial';
export function transferRoutes(app: any, { actor, settings, audit, fail, limited }: any) {
  const policy = async (c: any) => {
    const s = await settings(c.env),
      e = editorial(s);
    if (!e.transfersEnabled || !e.transferDeadline)
      fail(409, 'Le transfert des inscriptions n’est pas ouvert.');
    if (now() > e.transferDeadline!) fail(409, 'La date limite de transfert est dépassée.');
    return { s, e };
  };
  app.post('/api/registrations/:id/transfer', async (c: any) => {
    const a = await actor(c),
      { e } = await policy(c);
    await limited(c.env, 'transfer:' + a.id, 8, 3600);
    const x = z
      .object({ recipient: email })
      .strict()
      .parse(await c.req.json());
    if (x.recipient === a.email) fail(400, 'Indiquez le courriel du nouveau participant.');
    const r = await c.env.DB.prepare(
      "SELECT r.* FROM registrations r JOIN orders o ON o.id=r.order_id WHERE r.id=? AND COALESCE(r.transferred_user_id,o.user_id)=? AND r.status='confirmed' AND r.checked_at IS NULL",
    )
      .bind(c.req.param('id'), a.id)
      .first();
    if (!r) fail(409, 'Cette participation ne peut pas être transférée.');
    const id = uuid(),
      token = opaqueToken(),
      expires = Math.min(e.transferDeadline!, now() + 172800);
    try {
      await c.env.DB.batch([
        c.env.DB.prepare(
          'INSERT INTO registration_transfers(id,registration_id,token_hash,recipient,expires_at) VALUES(?,?,?,?,?)',
        ).bind(id, r.id, await digest(token), x.recipient, expires),
        audit(c.env, a.id, 'transfer.invited', r.id, { expires }),
      ]);
    } catch (error) {
      if (/UNIQUE/.test(String(error)))
        fail(409, 'Une invitation de transfert est déjà en attente.');
      throw error;
    }
    return c.json(
      { url: c.env.APP_URL + '/transfert?invitation=' + token, expiresAt: expires },
      201,
    );
  });
  app.get('/api/transfers/:token', async (c: any) => {
    const a = await actor(c);
    await policy(c);
    const t = await c.env.DB.prepare(
      "SELECT t.id,t.registration_id,t.recipient,t.status,t.expires_at,r.activity_id,r.form_snapshot,r.form_version FROM registration_transfers t JOIN registrations r ON r.id=t.registration_id WHERE t.token_hash=? AND t.recipient=? AND t.status='pending' AND t.expires_at>unixepoch()",
    )
      .bind(await digest(c.req.param('token')), a.email)
      .first();
    if (!t) fail(404, 'Invitation indisponible pour ce compte.');
    return c.json({
      id: t.id,
      activityId: t.activity_id,
      fields: parse(t.form_snapshot, []),
      formVersion: t.form_version,
      expiresAt: t.expires_at,
    });
  });
  app.post('/api/transfers/:token/accept', async (c: any) => {
    const a = await actor(c),
      { s } = await policy(c);
    const x = z
      .object({ participant: participantSchema, termsVersion: z.string().max(80) })
      .strict()
      .parse(await c.req.json());
    if (x.termsVersion !== s.termsVersion || x.participant.email !== a.email)
      fail(409, 'Vérifiez votre courriel et acceptez la version actuelle des conditions.');
    const t = await c.env.DB.prepare(
      "SELECT t.*,r.form_snapshot,r.form_version,r.activity_id FROM registration_transfers t JOIN registrations r ON r.id=t.registration_id WHERE t.token_hash=? AND t.recipient=? AND t.status='pending' AND t.expires_at>unixepoch() AND r.status='confirmed' AND r.checked_at IS NULL",
    )
      .bind(await digest(c.req.param('token')), a.email)
      .first();
    if (!t) fail(409, 'Invitation expirée ou indisponible.');
    if (t.activity_id !== x.participant.activityId || t.form_version !== x.participant.formVersion)
      fail(409, 'Le formulaire doit être rechargé.');
    const p = x.participant,
      answers = validateAnswers(parse(t.form_snapshot, []), p.answers);
    const result = await c.env.DB.batch([
      c.env.DB.prepare(
        "UPDATE registrations SET transferred_user_id=?,first_name=?,last_name=?,email=?,phone=?,emergency_name=?,emergency_phone=?,answers=?,conditions_version=?,conditions_snapshot=?,photo=?,marketing=?,ticket=? WHERE id=? AND status='confirmed' AND checked_at IS NULL AND EXISTS(SELECT 1 FROM registration_transfers WHERE id=? AND status='pending' AND expires_at>unixepoch())",
      ).bind(
        a.id,
        p.firstName,
        p.lastName,
        p.email,
        p.phone,
        p.emergencyName,
        p.emergencyPhone,
        json(answers),
        s.termsVersion,
        s.terms,
        p.photo ? 1 : 0,
        p.marketing ? 1 : 0,
        opaqueToken(),
        t.registration_id,
        t.id,
      ),
      c.env.DB.prepare(
        "UPDATE registration_transfers SET status='accepted',accepted_at=unixepoch() WHERE id=? AND status='pending' AND changes()=1",
      ).bind(t.id),
      c.env.DB.prepare(
        "INSERT INTO audit(id,actor,action,target,detail) SELECT ?,?,'transfer.accepted',registration_id,'{}' FROM registration_transfers WHERE id=? AND status='accepted'",
      ).bind(uuid(), a.id, t.id),
    ]);
    if (!result[0].meta.changes)
      fail(409, 'Cette invitation a déjà été utilisée ou la participation a changé.');
    return c.json({ ok: true });
  });
}
