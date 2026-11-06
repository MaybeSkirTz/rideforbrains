import { t as textForLocale } from './locale-copy';
import { useEffect, useState } from 'react';
import { storedMotionOff, setMotionOff } from '../shared/motion';
export default function MotionToggle() {
  const [reduced, setReduced] = useState(storedMotionOff),
    [systemReduced, setSystemReduced] = useState(
      () => matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSystemReduced(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return (
    <button
      className="text-link"
      type="button"
      aria-pressed={reduced || systemReduced}
      disabled={systemReduced}
      onClick={() => {
        const next = !reduced;
        setMotionOff(next);
        setReduced(next);
      }}
    >
      {systemReduced
        ? textForLocale('Animations réduites selon votre appareil')
        : reduced
          ? textForLocale('Animations réduites · réactiver')
          : textForLocale('Réduire les animations')}
    </button>
  );
}
