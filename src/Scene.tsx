import React, { useEffect, useRef, useState, useId, lazy, Suspense } from 'react';
const Canvas = lazy(() => import('./Brain'));
export type SceneMode =
  | 'brain'
  | 'cortex'
  | 'synapse'
  | 'signal'
  | 'network'
  | 'velo'
  | 'pedal'
  | 'course'
  | 'stride'
  | 'marche'
  | 'steps'
  | 'impact'
  | 'team'
  | 'arrival'
  | 'preparation'
  | 'convergence';
export function NeuralFallback({
  mode = 'brain',
  time = '07:30',
}: {
  mode?: SceneMode;
  time?: string;
}) {
  const id = useId().replaceAll(':', '');
  const legacy =
    mode === 'velo'
      ? [
          'M25 170C120 20 220 25 270 120S420 225 495 55',
          'M30 195C140 100 220 195 320 80S420 90 485 125',
        ]
      : mode === 'course'
        ? [
            'M20 170C80 170 80 70 140 70S180 170 240 170S300 70 350 70S400 150 490 95',
            'M20 190C130 190 220 90 310 90S420 170 490 125',
          ]
        : mode === 'marche'
          ? [
              'M20 175C120 155 150 80 240 100S350 195 490 85',
              'M20 200C140 165 170 115 250 125S360 200 490 115',
            ]
          : [
              'M250 28C170 4 108 45 94 92C36 100 42 166 90 176C75 225 157 242 210 210L241 227L247 85',
              'M270 28C350 4 412 45 426 92C484 100 478 166 430 176C445 225 363 242 310 210L279 227L273 85',
              'M185 50C137 58 130 91 166 108S219 160 175 185',
              'M335 50C383 58 390 91 354 108S301 160 345 185',
              'M95 138C142 116 160 163 125 184',
              'M425 138C378 116 360 163 395 184',
            ];
  const visual: Partial<Record<SceneMode, string[]>> = {
    velo: [
      'M90 145a60 60 0 1 0 120 0a60 60 0 1 0-120 0M310 145a60 60 0 1 0 120 0a60 60 0 1 0-120 0',
      'M150 145L210 65L250 145H150L210 65H340L370 145L330 45H350M190 45H230',
    ],
    course: [
      'M260 42a15 15 0 1 0 30 0a15 15 0 1 0-30 0',
      'M271 65L245 125L202 170L150 173M245 125L280 160L255 210M264 79L220 90L203 70M264 79L300 110L330 90',
      'M90 230H420',
    ],
    marche: [
      'M125 95C105 65 150 42 165 70L175 130Q130 160 125 95',
      'M205 160C185 130 230 105 245 135L255 195Q210 225 205 160',
      'M290 95C270 65 315 42 330 70L340 130Q295 160 290 95',
      'M370 160C350 130 395 105 410 135L420 195Q375 225 370 160',
    ],
    synapse: [
      'M150 110l-60-45m60 45l-60 55m60-55l-5-70m5 70l25-60m-25 60l35 55m-35-55l70 5',
      'M375 110l60-45m-60 45l60 55m-60-55l5-70m-5 70l-25-60m25 60l-35 55m35-55l-70 5',
      'M220 115C250 80 280 150 305 115',
    ],
    signal: [
      'M30 80C140 20 190 160 300 80S420 80 490 70',
      'M30 115C140 55 190 195 300 115S420 115 490 105',
      'M30 150C140 90 190 230 300 150S420 150 490 140',
    ],
    network: [
      'M80 130L180 60L260 180L370 50L450 160L80 130M180 60L450 160M260 180L80 130M370 50L180 60',
    ],
    team: [
      'M130 80L260 210L395 80Z',
      'M115 80a15 15 0 1 0 30 0a15 15 0 1 0-30 0M245 210a15 15 0 1 0 30 0a15 15 0 1 0-30 0M380 80a15 15 0 1 0 30 0a15 15 0 1 0-30 0',
    ],
    preparation: [
      'M120 75H180V220H120ZM137 75V55H163V75',
      'M270 150C260 30 420 30 410 150ZM280 150L340 210L400 150',
    ],
    convergence: [
      'M30 50C200 50 200 135 490 135',
      'M30 135H490',
      'M30 220C200 220 200 135 490 135',
    ],
  };
  const [hour, minute] = time.split(':').map(Number);
  const hand = (a: number, len: number) =>
    'M260 135L' + (260 + Math.sin(a) * len) + ' ' + (135 - Math.cos(a) * len);
  visual.arrival = [
    'M160 135a100 100 0 1 0 200 0a100 100 0 1 0-200 0',
    hand((((hour % 12) + minute / 60) / 12) * Math.PI * 2, 55),
    hand((minute / 60) * Math.PI * 2, 85),
  ];
  const paths =
    visual[mode] ||
    visual[
      mode === 'pedal'
        ? 'velo'
        : mode === 'stride'
          ? 'course'
          : mode === 'steps'
            ? 'marche'
            : mode === 'impact'
              ? 'network'
              : mode
    ] ||
    legacy;
  return (
    <svg className="neural-fallback" viewBox="0 0 520 270" aria-hidden="true">
      <defs>
        <pattern id={'neural-grid-' + id} width="28" height="28" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r=".8" fill="currentColor" opacity=".13" />
        </pattern>
      </defs>
      <rect width="520" height="270" fill={'url(#neural-grid-' + mode + ')'} />
      <g fill="none" stroke="currentColor" strokeWidth="1.3">
        {paths.map((d, i) => (
          <path key={d} d={d} opacity={i < 2 ? 0.75 : 0.3} />
        ))}
      </g>
    </svg>
  );
}
export default function Scene({
  mode = 'brain',
  compact = false,
  time = '07:30',
}: {
  mode?: SceneMode;
  compact?: boolean;
  time?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [load, setLoad] = useState(false),
    [motion, setMotion] = useState(
      () =>
        matchMedia('(prefers-reduced-motion: reduce)').matches ||
        localStorage.getItem('rfb-motion') === 'off',
    );
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotion(media.matches || localStorage.getItem('rfb-motion') === 'off');
    update();
    media.addEventListener('change', update);
    window.addEventListener('rfb-motion', update);
    window.addEventListener('storage', update);
    const connection = (navigator as any).connection;
    const capable = !(
      connection?.saveData ||
      (navigator as any).deviceMemory < 4 ||
      navigator.hardwareConcurrency <= 2
    );
    const observer = new IntersectionObserver(
      ([entry]) => setLoad(entry.isIntersecting && capable),
      { rootMargin: '180px' },
    );
    if (ref.current) observer.observe(ref.current);
    return () => {
      observer.disconnect();
      media.removeEventListener('change', update);
      window.removeEventListener('rfb-motion', update);
      window.removeEventListener('storage', update);
    };
  }, [compact]);
  return (
    <div
      className={'neural-scene scene-' + mode + (compact ? ' compact' : '')}
      ref={ref}
      aria-hidden="true"
    >
      <NeuralFallback mode={mode} time={time} />
      {load && !motion && (
        <Suspense fallback={null}>
          <Canvas mode={mode} compact={compact} time={time} />
        </Suspense>
      )}
    </div>
  );
}
