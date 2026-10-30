import { betterAuth } from 'better-auth';
import { magicLink } from 'better-auth/plugins';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './auth-schema';
import type { Env } from './types';
import { enqueueMail, processMail } from './mail';
import { isLocal, uuid } from './types';

export const auth = (env: Env) =>
  betterAuth({
    appName: 'Ride For Brains',
    logger: { disabled: true },
    baseURL: env.APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.APP_URL],
    database: drizzleAdapter(drizzle(env.DB, { schema }), {
      provider: 'sqlite',
      schema,
      transaction: false,
    }),
    emailAndPassword: { enabled: false },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    advanced: {
      useSecureCookies: !isLocal(env),
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
    },
    rateLimit: { enabled: true, storage: 'database', window: 60, max: 20 },
    plugins: [
      magicLink({
        expiresIn: 600,
        storeToken: 'hashed',
        sendMagicLink: async ({ email, url }) => {
          if (!isLocal(env) && (!env.RESEND_API_KEY || !env.MAIL_FROM))
            throw new Error('Le service de connexion par courriel doit être configuré.');
          await enqueueMail(
            env,
            email,
            'Votre lien de connexion Ride For Brains',
            `Bonjour,\n\nConnectez-vous à Ride For Brains avec ce lien personnel, valable 10 minutes :\n${url}\n\nSi vous n’avez pas demandé ce lien, ignorez ce message.`,
            'login:' + uuid(),
            'login',
          );
          if (!isLocal(env)) await processMail(env);
        },
      }),
    ],
  });
