import type { Env } from './types';
export const funnelEvents = [
  'visit',
  'activity_view',
  'registration_start',
  'account_request',
  'account_verified',
  'form_complete',
  'checkout_start',
  'payment_confirmed',
] as const;
export async function countEvent(env: Env, event: (typeof funnelEvents)[number], activity = '') {
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  await env.DB.prepare(
    'INSERT INTO funnel_daily(day,event,activity_id,count) VALUES(?,?,?,1) ON CONFLICT(day,event,activity_id) DO UPDATE SET count=count+1',
  )
    .bind(day, event, activity)
    .run();
}
