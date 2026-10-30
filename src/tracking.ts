import { api } from './api';
const seen = new Set<string>();
/** Aggregate steps only. Never send user, URL, form answers, cookies or contact details. */
export function track(event: string, activityId?: string) {
  const key = event + ':' + (activityId || '');
  if (seen.has(key) || navigator.doNotTrack === '1' || (navigator as any).globalPrivacyControl)
    return;
  seen.add(key);
  void api('/analytics', { event, ...(activityId ? { activityId } : {}) }).catch(() => {});
}
