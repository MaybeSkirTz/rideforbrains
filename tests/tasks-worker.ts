// Test-only entry point. Never referenced by wrangler.json or the production build.
import { processMail } from '../server/mail';
import { processRefunds } from '../server/payments';
import { scheduled } from '../server/index';
import type { Env } from '../server/types';
import { ticketDelivery } from '../server/personal-tickets';
let staged: D1PreparedStatement[] = [];
export default {
  async fetch(req: Request, env: Env) {
    if (new URL(req.url).pathname === '/stage-ticket') {
      const r = await env.DB.prepare('SELECT * FROM registrations ORDER BY id LIMIT 1').first();
      staged = await ticketDelivery(env, r, 'Acheteur fictif', 'staged-ticket');
    }
    if (new URL(req.url).pathname === '/commit-ticket') await env.DB.batch(staged);
    if (new URL(req.url).pathname === '/maintenance') {
      try {
        await scheduled(env);
        return new Response('ok');
      } catch {
        return new Response('maintenance_error', { status: 500 });
      }
    }
    if (new URL(req.url).pathname === '/mail') await processMail(env);
    if (new URL(req.url).pathname === '/refunds') await processRefunds(env);
    return new Response('ok');
  },
};
