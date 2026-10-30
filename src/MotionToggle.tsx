import { useState } from 'react';
export default function MotionToggle() {
  const [reduced, setReduced] = useState(() => localStorage.getItem('rfb-motion') === 'off');
  return (
    <button
      className="text-link"
      type="button"
      aria-pressed={reduced}
      onClick={() => {
        const next = !reduced;
        localStorage.setItem('rfb-motion', next ? 'off' : 'on');
        setReduced(next);
        dispatchEvent(new Event('rfb-motion'));
      }}
    >
      {reduced ? 'Animations réduites · réactiver' : 'Réduire les animations'}
    </button>
  );
}
