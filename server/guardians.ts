import { z } from 'zod';
import type { Env } from './types';
import { uuid, now, parse, json, isLocal } from './types';
import { digest } from './crypto';
import { participantSchema, validateAnswers } from './validation';
import { mailStatement, processMail } from './mail';
import { guardianConsentText, guardianConsentVersion } from '../shared/participation';
export async function guardianFingerprint(participant: any, termsVersion: string, childId: string) {
  const { guardianRequestId, guardianStatus, publicListing, ...p } = participant;
  return digest(
    json({
      childId,
      termsVersion,
      participant: { ...p, ...(publicListing ? { publicListing: true } : {}) },
    }),
  );
}
export async function approvedGuardian(
  env: Env,
  p: any,
  termsVersion: string,
  childId: string,
  eventAt: string,
) {
  if (p.adult) return null;
  if (!p.guardianRequestId || !p.guardianEmail) return null;
  const fingerprint = await guardianFingerprint(p, termsVersion, childId);
  return env.DB.prepare(
    "SELECT * FROM guardian_requests WHERE id=? AND child_user_id=? AND guardian_email=? AND status='approved' AND guardian_user_id!=child_user_id AND fingerprint=? AND terms_version=? AND json_extract(activity_snapshot,'$.eventAt')=? AND expires_at>? AND used_order_id IS NULL",
  )
    .bind(p.guardianRequestId, childId, p.guardianEmail, fingerprint, termsVersion, eventAt, now())
    .first<any>();
}
export function guardianRoutes(app: any, { actor, settings, audit, fail, limited }: any) {
  const present = (r: any) => ({
    id: r.id,
    childUserId: r.child_user_id,
    guardianEmail: r.guardian_email,
    participant: parse(r.payload),
    activity: parse(r.activity_snapshot),
    termsVersion: r.terms_version,
    terms: r.terms_snapshot,
    status: !r.used_order_id && r.expires_at <= now() ? 'cancelled' : r.status,
    expiresAt: r.expires_at,
    used: !!r.used_order_id,
    decidedAt: r.decided_at,
    consent: r.consent_snapshot ? parse(r.consent_snapshot) : null,
    createdAt: r.created_at,
  });
  app.post('/api/guardian/requests', async (c: any) => {
    const a = await actor(c),
      x = z
        .object({ participant: participantSchema, termsVersion: z.string().max(80) })
        .strict()
        .parse(await c.req.json()),
      p = x.participant;
    const s = await settings(c.env);
    if (p.adult || !p.guardianEmail)
      fail(400, 'Indiquez le courriel du parent pour ce participant mineur.');
    if (p.guardianEmail === a.email)
      fail(400, 'Le parent doit utiliser un compte distinct de celui du participant.');
    if (x.termsVersion !== s.termsVersion)
      fail(409, 'Les conditions ont changé. Relisez-les avant de demander l’autorisation.');
    if (!isLocal(c.env) && (!c.env.RESEND_API_KEY || !c.env.MAIL_FROM))
      fail(503, 'Le service de courriel doit être configuré pour prévenir le parent.');
    const activity = await c.env.DB.prepare(
      'SELECT a.*,f.fields FROM activities a JOIN forms f ON f.activity_id=a.id AND f.version=a.form_version WHERE a.id=? AND a.enabled=1',
    )
      .bind(p.activityId)
      .first();
    if (!activity) fail(404, 'Activité introuvable.');
    if (activity.sport === 'velo')
      fail(400, 'Le vélo est réservé aux personnes de 18 ans et plus.');
    if (p.formVersion !== activity.form_version)
      fail(409, 'Le formulaire a changé. Rechargez la page.');
    validateAnswers(parse(activity.fields, []), p.answers);
    const fingerprint = await guardianFingerprint(p, s.termsVersion, a.id);
    const existing = await c.env.DB.prepare(
      "SELECT * FROM guardian_requests WHERE child_user_id=? AND fingerprint=? AND terms_version=? AND json_extract(activity_snapshot,'$.eventAt')=? AND expires_at>? AND used_order_id IS NULL AND status IN ('pending','approved') ORDER BY created_at DESC LIMIT 1",
    )
      .bind(a.id, fingerprint, s.termsVersion, s.eventAt, now())
      .first();
    if (existing) return c.json(present(existing));
    await limited(c.env, 'guardian-request:' + a.id, 5, 3600);
    await limited(c.env, 'guardian-recipient:' + p.guardianEmail, 8, 3600);
    const id = uuid(),
      expires = now() + 7 * 86400;
    await c.env.DB.batch([
      c.env.DB.prepare(
        'INSERT INTO guardian_requests(id,child_user_id,guardian_email,activity_id,payload,fingerprint,terms_version,terms_snapshot,activity_snapshot,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
      ).bind(
        id,
        a.id,
        p.guardianEmail,
        p.activityId,
        json(p),
        fingerprint,
        s.termsVersion,
        s.terms,
        json({
          name: activity.name,
          distance: activity.distance,
          sport: activity.sport,
          eventAt: s.eventAt,
          formVersion: activity.form_version,
          fields: parse(activity.fields, []),
        }),
        expires,
      ),
      mailStatement(
        c.env,
        p.guardianEmail!,
        'Autorisation parentale demandée — Ride For Brains',
        `${p.firstName} ${p.lastName} souhaite participer à ${activity.name} (${activity.distance}).\n\nConnectez-vous à votre propre compte Ride For Brains pour examiner les renseignements, les conditions et les choix de consentement, puis autoriser ou refuser cette participation :\n${c.env.APP_URL}/autorisations-parentales\n\nSi vous n’avez pas de compte, créez-en un avec cette adresse courriel. La connexion utilise votre mot de passe et un code à 6 chiffres. Aucun paiement ni billet n’est créé avant autorisation. Si cette demande ne vous concerne pas, ne l’autorisez pas.`,
        'guardian-request:' + id,
        null,
        null,
        'guardian',
      ),
      audit(c.env, a.id, 'guardian.requested', id),
    ]);
    c.executionCtx.waitUntil(processMail(c.env));
    return c.json(
      present(
        await c.env.DB.prepare('SELECT * FROM guardian_requests WHERE id=?').bind(id).first(),
      ),
      201,
    );
  });
  app.get('/api/guardian/requests', async (c: any) => {
    const a = await actor(c);
    const rows = (
      await c.env.DB.prepare(
        'SELECT * FROM guardian_requests WHERE child_user_id=? OR guardian_email=? ORDER BY created_at DESC LIMIT 100',
      )
        .bind(a.id, a.email)
        .all()
    ).results;
    return c.json({
      asParent: rows
        .filter((r: any) => r.guardian_email === a.email && r.child_user_id !== a.id)
        .map(present),
      asParticipant: rows.filter((r: any) => r.child_user_id === a.id).map(present),
    });
  });
  app.get('/api/guardian/requests/:id', async (c: any) => {
    const a = await actor(c),
      r = await c.env.DB.prepare(
        'SELECT * FROM guardian_requests WHERE id=? AND (child_user_id=? OR guardian_email=?)',
      )
        .bind(c.req.param('id'), a.id, a.email)
        .first();
    if (!r) fail(404, 'Autorisation introuvable pour ce compte.');
    return c.json(present(r));
  });
  app.post('/api/guardian/requests/:id/decision', async (c: any) => {
    const a = await actor(c),
      x = z
        .object({
          decision: z.enum(['approve', 'decline']),
          confirm: z.literal(true),
          adult: z.literal(true),
          relationship: z.enum(['parent', 'legal_guardian']),
          signature: z.string().trim().min(3).max(150),
        })
        .strict()
        .parse(await c.req.json());
    await limited(c.env, 'guardian-decision:' + a.id, 20, 3600);
    const r = await c.env.DB.prepare(
      "SELECT * FROM guardian_requests WHERE id=? AND guardian_email=? AND child_user_id!=? AND used_order_id IS NULL AND status='pending' AND expires_at>?",
    )
      .bind(c.req.param('id'), a.email, a.id, now())
      .first();
    if (!r) fail(409, 'Cette demande n’est pas disponible pour ce compte parent.');
    const s = await settings(c.env),
      activity = await c.env.DB.prepare('SELECT * FROM activities WHERE id=? AND enabled=1')
        .bind(r.activity_id)
        .first();
    if (
      r.terms_version !== s.termsVersion ||
      parse(r.activity_snapshot).eventAt !== s.eventAt ||
      !activity ||
      activity.sport === 'velo' ||
      activity.form_version !== parse(r.activity_snapshot).formVersion
    )
      fail(409, 'L’activité ou les conditions ont changé. Le participant doit refaire sa demande.');
    const status = x.decision === 'approve' ? 'approved' : 'declined';
    const consent = {
      version: guardianConsentVersion,
      text:
        x.decision === 'approve'
          ? guardianConsentText
          : 'Je refuse cette participation après examen de la demande.',
      parentUserId: a.id,
      parentEmail: a.email,
      signature: x.signature,
      relationship: x.relationship,
      adult: true,
      decision: status,
      decidedAt: now(),
      fingerprint: r.fingerprint,
      termsVersion: r.terms_version,
    };
    const result = await c.env.DB.batch([
      c.env.DB.prepare(
        "UPDATE guardian_requests SET status=?,guardian_user_id=?,consent_snapshot=?,decided_at=? WHERE id=? AND status='pending' AND used_order_id IS NULL AND expires_at>? RETURNING id",
      ).bind(status, a.id, json(consent), now(), r.id, now()),
      c.env.DB.prepare(
        "INSERT INTO audit(id,actor,action,target) SELECT ?,?,'guardian.decided',? WHERE changes()=1",
      ).bind(uuid(), a.id, r.id),
      c.env.DB.prepare(
        "INSERT OR IGNORE INTO outbox(id,dedupe,user_id,recipient,subject,body,kind,status) SELECT ?,?,?,u.email,?,?, 'guardian',? FROM user u WHERE u.id=? AND EXISTS(SELECT 1 FROM guardian_requests WHERE id=? AND guardian_user_id=? AND status=?)",
      ).bind(
        uuid(),
        'guardian-decision:' + r.id,
        r.child_user_id,
        'Autorisation parentale — Ride For Brains',
        status === 'approved'
          ? 'Le parent a autorisé cette participation. Reprenez votre inscription dans votre compte. Aucun paiement n’a été effectué par cette autorisation.'
          : 'Le parent n’a pas autorisé cette participation. Aucun paiement ni billet n’a été créé.',
        isLocal(c.env) ? 'development' : 'queued',
        r.child_user_id,
        r.id,
        a.id,
        status,
      ),
    ]);
    if (!result[0].meta.changes) fail(409, 'Cette demande a déjà été traitée.');
    c.executionCtx.waitUntil(processMail(c.env));
    return c.json({ status });
  });
}
