import React, { useState } from 'react';
export default function RouteMap({ route, name }: { route: any; name: string }) {
  const [zoom, setZoom] = useState(1),
    [pan, setPan] = useState([0, 0]);
  if (!route.coordinates || route.coordinates.length < 2) return null;
  const all = [...route.coordinates, ...(route.points || []).map((p: any) => [p.lng, p.lat])];
  const lat = all.reduce((n: number, p: number[]) => n + p[1], 0) / all.length,
    ratio = Math.cos((lat * Math.PI) / 180);
  const xs = all.map((p: number[]) => p[0] * ratio),
    ys = all.map((p: number[]) => -p[1]);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys),
    scale = Math.min(700 / Math.max(maxX - minX, 0.0001), 300 / Math.max(maxY - minY, 0.0001));
  const project = (lng: number, latitude: number) => [
    (lng * ratio - (minX + maxX) / 2) * scale + 400,
    (-latitude - (minY + maxY) / 2) * scale + 200,
  ];
  const path = route.coordinates
    .map((p: number[], i: number) => (i ? 'L' : 'M') + project(p[0], p[1]).join(','))
    .join(' ');
  return (
    <section className="route-map" aria-label={'Tracé publié : ' + name}>
      <div className="route-map-toolbar">
        <p>Tracé publié par l’organisation</p>
        <div>
          <button
            className="icon-button"
            aria-label="Agrandir le tracé"
            onClick={() => setZoom((z) => Math.min(4, z + 0.5))}
          >
            +
          </button>
          <button
            className="icon-button"
            aria-label="Réduire le tracé"
            onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
          >
            −
          </button>
          <button
            className="text-link"
            onClick={() => {
              setZoom(1);
              setPan([0, 0]);
            }}
          >
            Recentrer
          </button>
        </div>
      </div>
      <svg
        viewBox="0 0 800 400"
        tabIndex={0}
        role="img"
        aria-label={
          'Carte interactive du tracé ' + name + '. Utilisez les flèches pour déplacer le tracé.'
        }
        onKeyDown={(e) => {
          const delta: any = {
            ArrowLeft: [20, 0],
            ArrowRight: [-20, 0],
            ArrowUp: [0, 20],
            ArrowDown: [0, -20],
          };
          if (delta[e.key]) {
            e.preventDefault();
            setPan((p) => [p[0] + delta[e.key][0], p[1] + delta[e.key][1]]);
          }
        }}
      >
        <defs>
          <pattern id="map-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke="currentColor" opacity=".08" />
          </pattern>
        </defs>
        <rect width="800" height="400" fill="url(#map-grid)" />
        <g
          transform={`translate(${400 + pan[0]} ${200 + pan[1]}) scale(${zoom}) translate(-400 -200)`}
        >
          <path d={path} fill="none" stroke="currentColor" strokeWidth={3 / zoom} />
          {(route.points || []).map((p: any, i: number) => {
            const [x, y] = project(p.lng, p.lat);
            return (
              <g key={i}>
                <circle
                  cx={x}
                  cy={y}
                  r={6 / zoom}
                  fill="var(--lime)"
                  stroke="currentColor"
                  strokeWidth={2 / zoom}
                />
                <text x={x + 10 / zoom} y={y - 10 / zoom} fontSize={13 / zoom}>
                  {p.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      {route.points?.length > 0 && (
        <ul className="route-point-list">
          {route.points.map((p: any, i: number) => (
            <li key={i}>
              {p.label} —{' '}
              {
                (
                  {
                    start: 'départ',
                    finish: 'arrivée',
                    water: 'ravitaillement',
                    point: 'point de repère',
                  } as any
                )[p.kind]
              }
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
