// Local-only diagnostics. No network transmission, user input or identifiers.
type Result = {
  lcpMs: number | null;
  cls: number | null;
  inpMs: number | null;
  threeLoaded: boolean;
};
const data: Result = { lcpMs: null, cls: null, inpMs: null, threeLoaded: false };
const subscribers = new Set<(result: Result) => void>();
let started = false,
  timer: number | undefined;
const emit = () => {
  data.threeLoaded = performance
    .getEntriesByType('resource')
    .some((r) => r.name.includes('/assets/Brain-'));
  subscribers.forEach((report) => report({ ...data }));
};
export function observePerformance(report: (result: Result) => void) {
  subscribers.add(report);
  report({ ...data });
  if (!started) {
    started = true;
    void import('web-vitals')
      .then(({ onLCP, onCLS, onINP }) => {
        onLCP(
          (m) => {
            data.lcpMs = m.value;
            emit();
          },
          { reportAllChanges: true },
        );
        onCLS(
          (m) => {
            data.cls = m.value;
            emit();
          },
          { reportAllChanges: true },
        );
        onINP(
          (m) => {
            data.inpMs = m.value;
            emit();
          },
          { reportAllChanges: true, durationThreshold: 16 },
        );
      })
      .catch(() => {});
  }
  if (!timer) timer = window.setInterval(emit, 1000);
  return () => {
    subscribers.delete(report);
    if (!subscribers.size && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}
