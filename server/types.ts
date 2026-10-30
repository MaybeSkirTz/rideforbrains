export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_ENV: string;
  APP_URL: string;
  BETTER_AUTH_SECRET: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  PAYMENTS_MODE: string;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  RESEND_WEBHOOK_SECRET?: string;
  MAIL_DAILY_LIMIT?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_SITE_KEY?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
};
export type Actor = {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
};
export type AppContext = { Bindings: Env; Variables: { actor: Actor } };
export const isLocal = (env: Env) =>
  env.APP_ENV === 'development' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(env.APP_URL);
export const uuid = () => crypto.randomUUID();
export const now = () => Math.floor(Date.now() / 1000);
export const json = (x: unknown) => JSON.stringify(x);
export const parse = (s: string | null, fallback: any = {}) => {
  try {
    return JSON.parse(s || 'null') ?? fallback;
  } catch {
    return fallback;
  }
};
