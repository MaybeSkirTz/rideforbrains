type Status = 'checking' | 'confirmed' | 'review' | 'stopped' | 'waiting';
const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal.addEventListener('abort', finish, { once: true });
    if (signal.aborted) finish();
  });
export async function pollConfirmation({
  read,
  signal,
  onUpdate,
  pause = wait,
}: {
  read: () => Promise<{ status: string; paid: boolean }>;
  signal: AbortSignal;
  onUpdate: (s: Status) => void;
  pause?: (ms: number, signal: AbortSignal) => Promise<void>;
}): Promise<Status> {
  for (let attempt = 0; attempt < 12 && !signal.aborted; attempt++) {
    try {
      const current = await read();
      if (signal.aborted) return 'waiting';
      let state: Status = 'checking';
      if (['confirmed', 'partially_refunded'].includes(current.status) && current.paid)
        state = 'confirmed';
      else if (current.status === 'paid_review' && current.paid) state = 'review';
      else if (['cancelled', 'refunded', 'expired', 'failed', 'removed'].includes(current.status))
        state = 'stopped';
      onUpdate(state);
      if (state !== 'checking') return state;
    } catch {
      if (signal.aborted) return 'waiting';
    }
    if (attempt < 11) await pause(2500, signal);
  }
  if (!signal.aborted) onUpdate('waiting');
  return 'waiting';
}
