import { z } from 'zod';
import { hashPassword, verifyPassword, constantTimeEqual } from 'better-auth/crypto';
import { auth } from './auth';
import type { Env } from './types';
import { uuid, now, isLocal } from './types';
import { digest, opaqueToken } from './crypto';
import { email } from './validation';
import { safeReturnUrl } from '../shared/navigation';
import { mailStatement, processMail } from './mail';
import { countEvent } from './analytics';

const password = z
  .string()
  .min(10, 'Le mot de passe doit contenir au moins 10 caractères.')
  .max(128);
const startSchema = z
  .object({
    email,
    password: z.string().min(1).max(128).optional(),
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    rememberMe: z.boolean().default(false),
    returnTo: z.string().max(1500).optional(),
    turnstileToken: z.string().optional(),
  })
  .strict();
function code() {
  let n: number;
  do {
    n = crypto.getRandomValues(new Uint32Array(1))[0];
  } while (n >= 4294000000);
  return String(n % 1000000).padStart(6, '0');
}
async function codeHash(env: Env, id: string, value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.BETTER_AUTH_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const bytes = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode('rfb:email-code:v1:' + id + ':' + value),
  );
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}
async function credential(env: Env, userId: string) {
  return env.DB.prepare("SELECT password FROM account WHERE userId=? AND providerId='credential'")
    .bind(userId)
    .first<{ password: string }>();
}
const version = async (env: Env, userId: string) =>
  digest((await credential(env, userId))?.password || 'no-password');
function codeMail(env: Env, address: string, id: string, value: string, purpose: string) {
  const title =
    purpose === 'password' ? 'Code pour votre mot de passe' : 'Votre code Ride For Brains';
  return mailStatement(
    env,
    address,
    title,
    `Votre code de vérification : ${value}\n\nSaisissez ces 6 chiffres sur la page Ride For Brains déjà ouverte. Ce code est valable 10 minutes et ne peut être utilisé qu’une fois.\n\nSi vous n’avez pas fait cette demande, ignorez ce message. Ne communiquez ce code à personne.`,
    'auth-code:' + id + ':' + uuid(),
    null,
    null,
    'login',
  );
}
export async function authenticatedSession(c: any) {
  const response = await auth(c.env).api.getSession({
    headers: c.req.raw.headers,
    asResponse: true,
  });
  const s = (await response.json()) as any;
  if (!s?.user?.emailVerified) return null;
  const privacy = await c.env.DB.prepare('SELECT tab_hash FROM session_privacy WHERE session_id=?')
    .bind(s.session.id)
    .first();
  // Older link-only sessions must authenticate through the new password + code flow once.
  if (!privacy) return null;
  if (
    privacy.tab_hash &&
    !constantTimeEqual(privacy.tab_hash, await digest(c.req.header('X-RFB-Session') || ''))
  )
    return null;
  for (const cookie of response.headers.getSetCookie())
    c.header('Set-Cookie', cookie, { append: true });
  return s;
}
export function passwordAuthRoutes(app: any, { fail, limited, botCheck }: any) {
  const ready = (env: Env) => {
    if (!isLocal(env) && (!env.RESEND_API_KEY || !env.MAIL_FROM))
      fail(503, 'La connexion par courriel n’est pas encore activée. Contactez l’organisation.');
  };
  const ip = (c: any) => c.req.header('cf-connecting-ip') || 'local';
  app.post('/api/auth/request/:intent', async (c: any) => {
    const intent = z.enum(['create', 'sign-in', 'password']).parse(c.req.param('intent'));
    const x = startSchema.parse(await c.req.json());
    const returnTo = safeReturnUrl(x.returnTo || '/espace', '');
    if (!returnTo) fail(400, 'Cette destination de retour n’est pas autorisée.');
    if (intent === 'create') {
      password.parse(x.password);
      if (!x.firstName || !x.lastName) fail(400, 'Le prénom et le nom sont requis.');
    }
    if (intent === 'sign-in' && !x.password) fail(400, 'Saisissez votre mot de passe.');
    ready(c.env);
    await limited(c.env, 'auth-start-ip:' + ip(c), 10, 600);
    await limited(c.env, 'auth-start-email:' + x.email, 5, 600);
    await botCheck(c, x.turnstileToken);
    let user = await c.env.DB.prepare('SELECT * FROM user WHERE email=? COLLATE NOCASE')
      .bind(x.email)
      .first();
    if (intent === 'create' && !user) {
      const created = await auth(c.env).api.signUpEmail({
        body: {
          email: x.email,
          name: x.firstName + ' ' + x.lastName,
          firstName: x.firstName,
          lastName: x.lastName,
          password: x.password!,
          rememberMe: false,
        },
        asResponse: true,
      });
      if (!created.ok)
        fail(
          400,
          'Ce compte ne peut pas être créé. Essayez de vous connecter ou de définir votre mot de passe.',
        );
      user = await c.env.DB.prepare('SELECT * FROM user WHERE email=? COLLATE NOCASE')
        .bind(x.email)
        .first();
    }
    const id = uuid();
    if (intent !== 'password') {
      const account = user ? await credential(c.env, user.id) : null;
      if (
        !account?.password ||
        !(await verifyPassword({ hash: account.password, password: x.password! }))
      ) {
        // Perform the same expensive hash operation even for an unknown address.
        if (!account?.password) await hashPassword(x.password!);
        fail(
          401,
          'Adresse courriel ou mot de passe incorrect. Pour un ancien compte, utilisez « Définir mon mot de passe ».',
        );
      }
    }
    if (user) {
      const value = code();
      await c.env.DB.batch([
        c.env.DB.prepare(
          'UPDATE auth_challenges SET used_at=? WHERE user_id=? AND used_at IS NULL',
        ).bind(now(), user.id),
        c.env.DB.prepare(
          "UPDATE outbox SET status='cancelled' WHERE recipient=? AND kind='login' AND status IN ('queued','retry')",
        ).bind(user.email),
        c.env.DB.prepare(
          'INSERT INTO auth_challenges(id,user_id,purpose,code_hash,credential_version,return_to,remember,expires_at) VALUES(?,?,?,?,?,?,?,?)',
        ).bind(
          id,
          user.id,
          intent,
          await codeHash(c.env, id, value),
          await version(c.env, user.id),
          returnTo,
          x.rememberMe ? 1 : 0,
          now() + 600,
        ),
        codeMail(c.env, user.email, id, value, intent),
      ]);
      c.executionCtx.waitUntil(processMail(c.env));
    }
    // A cooldown is created even for a neutral, unknown-address recovery request.
    // Resend responses must not reveal whether an account exists.
    await limited(c.env, 'auth-cooldown:' + id, 1, 60);
    c.executionCtx.waitUntil(countEvent(c.env, 'account_request').catch(() => {}));
    return c.json({ status: true, challengeId: id, expiresIn: 600, resendAfter: 60 });
  });
  app.post('/api/auth/resend-code', async (c: any) => {
    const { challengeId } = z
      .object({ challengeId: z.uuid() })
      .strict()
      .parse(await c.req.json());
    ready(c.env);
    await limited(c.env, 'auth-resend-ip:' + ip(c), 5, 600);
    await limited(c.env, 'auth-cooldown:' + challengeId, 1, 60);
    await limited(c.env, 'auth-resend-challenge:' + challengeId, 3, 600);
    const ch = await c.env.DB.prepare(
      'SELECT c.*,u.email FROM auth_challenges c JOIN user u ON u.id=c.user_id WHERE c.id=? AND c.used_at IS NULL AND c.expires_at>unixepoch() AND c.attempts<5',
    )
      .bind(challengeId)
      .first();
    if (ch) {
      if (ch.sent_at > now() - 60)
        fail(429, 'Attendez une minute avant de demander un nouveau code.');
      const value = code(),
        at = now();
      const updated = await c.env.DB.prepare(
        'UPDATE auth_challenges SET code_hash=?,expires_at=?,sent_at=? WHERE id=? AND sent_at<=? AND used_at IS NULL AND attempts<5 RETURNING id',
      )
        .bind(await codeHash(c.env, ch.id, value), at + 600, at, ch.id, at - 60)
        .first();
      if (!updated) fail(429, 'Attendez une minute avant de demander un nouveau code.');
      await c.env.DB.prepare(
        "UPDATE outbox SET status='cancelled' WHERE recipient=? AND kind='login' AND status IN ('queued','retry')",
      )
        .bind(ch.email)
        .run();
      await codeMail(c.env, ch.email, ch.id, value, ch.purpose).run();
      c.executionCtx.waitUntil(processMail(c.env));
    }
    return c.json({ status: true, resendAfter: 60 });
  });
  app.post('/api/auth/verify-code', async (c: any) => {
    const x = z
      .object({
        challengeId: z.uuid(),
        code: z.string().regex(/^\d{6}$/, 'Saisissez les 6 chiffres du code.'),
        password: z.string().min(1).max(128).optional(),
        newPassword: password.optional(),
      })
      .strict()
      .parse(await c.req.json());
    await limited(c.env, 'auth-verify-ip:' + ip(c), 30, 600);
    const ch = await c.env.DB.prepare(
      'SELECT c.*,u.email FROM auth_challenges c JOIN user u ON u.id=c.user_id WHERE c.id=?',
    )
      .bind(x.challengeId)
      .first();
    const invalid = () =>
      fail(400, 'Code incorrect, expiré ou déjà utilisé. Demandez un nouveau code.');
    if (!ch || ch.used_at || ch.expires_at <= now() || ch.attempts >= 5) return invalid();
    if (!constantTimeEqual(ch.code_hash, await codeHash(c.env, ch.id, x.code))) {
      await c.env.DB.prepare(
        'UPDATE auth_challenges SET attempts=attempts+1 WHERE id=? AND used_at IS NULL',
      )
        .bind(ch.id)
        .run();
      return invalid();
    }
    const current = await version(c.env, ch.user_id);
    if (current !== ch.credential_version) return invalid();
    if (ch.purpose === 'password' && !x.newPassword)
      fail(400, 'Choisissez votre nouveau mot de passe.');
    if (ch.purpose !== 'password') {
      const account = await credential(c.env, ch.user_id);
      if (
        !x.password ||
        !account?.password ||
        !(await verifyPassword({ hash: account.password, password: x.password }))
      ) {
        await c.env.DB.prepare(
          'UPDATE auth_challenges SET attempts=attempts+1 WHERE id=? AND used_at IS NULL',
        )
          .bind(ch.id)
          .run();
        return invalid();
      }
    }
    const at = now(),
      newHash =
        x.newPassword && ch.purpose === 'password' ? await hashPassword(x.newPassword) : null;
    // A random claim distinguishes this consume transaction from a concurrent verifier.
    const claim = uuid();
    const changes = await c.env.DB.batch([
      c.env.DB.prepare(
        'UPDATE auth_challenges SET used_at=?,code_hash=? WHERE id=? AND used_at IS NULL AND attempts<5 AND expires_at>? AND code_hash=? RETURNING id',
      ).bind(at, claim, ch.id, at, ch.code_hash),
      c.env.DB.prepare(
        'UPDATE user SET emailVerified=1,updatedAt=? WHERE id=? AND EXISTS(SELECT 1 FROM auth_challenges WHERE id=? AND code_hash=?)',
      ).bind(Date.now(), ch.user_id, ch.id, claim),
      ...(newHash
        ? [
            c.env.DB.prepare(
              "INSERT INTO account(id,accountId,providerId,userId,password,createdAt,updatedAt) SELECT ?,?,'credential',?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM account WHERE userId=? AND providerId='credential') AND EXISTS(SELECT 1 FROM auth_challenges WHERE id=? AND code_hash=?)",
            ).bind(
              uuid(),
              ch.user_id,
              ch.user_id,
              newHash,
              Date.now(),
              Date.now(),
              ch.user_id,
              ch.id,
              claim,
            ),
            c.env.DB.prepare(
              "UPDATE account SET password=?,updatedAt=? WHERE userId=? AND providerId='credential' AND EXISTS(SELECT 1 FROM auth_challenges WHERE id=? AND code_hash=?)",
            ).bind(newHash, Date.now(), ch.user_id, ch.id, claim),
            c.env.DB.prepare(
              'DELETE FROM session WHERE userId=? AND EXISTS(SELECT 1 FROM auth_challenges WHERE id=? AND code_hash=?)',
            ).bind(ch.user_id, ch.id, claim),
          ]
        : []),
      c.env.DB.prepare(
        'UPDATE auth_challenges SET used_at=? WHERE user_id=? AND used_at IS NULL AND EXISTS(SELECT 1 FROM auth_challenges WHERE id=? AND code_hash=?)',
      ).bind(at, ch.user_id, ch.id, claim),
      c.env.DB.prepare(
        "UPDATE outbox SET status='cancelled' WHERE recipient=? AND kind='login' AND status IN ('queued','retry') AND EXISTS(SELECT 1 FROM auth_challenges WHERE id=? AND code_hash=?)",
      ).bind(ch.email, ch.id, claim),
    ]);
    if (!changes[0].meta.changes) return invalid();
    const res = await auth(c.env).api.signInEmail({
      body: {
        email: ch.email,
        password: ch.purpose === 'password' ? x.newPassword! : x.password!,
        rememberMe: !!ch.remember,
      },
      asResponse: true,
    });
    if (!res.ok) fail(401, 'La connexion a échoué. Recommencez avec votre mot de passe.');
    const result = (await res.json()) as any;
    const session = await c.env.DB.prepare('SELECT id FROM session WHERE token=?')
      .bind(result.token)
      .first();
    if (!session) fail(401, 'La session n’a pas pu être créée.');
    const tabKey = ch.remember ? null : opaqueToken();
    await c.env.DB.prepare('INSERT INTO session_privacy(session_id,tab_hash) VALUES(?,?)')
      .bind(session.id, tabKey ? await digest(tabKey) : null)
      .run();
    for (const cookie of res.headers.getSetCookie())
      c.header('Set-Cookie', cookie, { append: true });
    c.executionCtx.waitUntil(countEvent(c.env, 'account_verified').catch(() => {}));
    return c.json({ status: true, returnTo: ch.return_to, tabKey, rememberMe: !!ch.remember });
  });
  // Only logout is exposed from Better Auth. Its password, OTP-free sign-in,
  // verification-link and password-reset endpoints cannot bypass this flow.
  app.post('/api/auth/sign-out', async (c: any) => auth(c.env).handler(c.req.raw));
  app.on(['GET', 'POST'], '/api/auth/*', (c: any) =>
    c.json({ error: 'Cette méthode de connexion n’est plus disponible.' }, 404),
  );
}
