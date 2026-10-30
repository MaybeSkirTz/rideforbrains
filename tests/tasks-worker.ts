// Test-only entry point. Never referenced by wrangler.json or the production build.
import { processMail } from '../server/mail';
import { processRefunds } from '../server/payments';
import type { Env } from '../server/types';
export default {
  async fetch(req: Request, env: Env) {
    if (new URL(req.url).pathname === '/mail') await processMail(env);
    if (new URL(req.url).pathname === '/refunds') await processRefunds(env);
    return new Response('ok');
  },
};
