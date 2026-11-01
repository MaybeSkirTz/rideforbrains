import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { mapRouteCoordinates } from '../shared/route-map';

const pointKinds: Record<string, string> = {
  start: 'départ',
  finish: 'arrivée',
  water: 'ravitaillement',
  point: 'point de repère',
};

export default function RouteMap({ route, name }: { route: any; name: string }) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const fit = useRef<() => void>(() => {});
  const retry = useRef<() => void>(() => {});
  const hintId = useId();
  const [ready, setReady] = useState(false);
  const [tilesStatus, setTilesStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const coordinates = useMemo(() => mapRouteCoordinates(route.coordinates), [route.coordinates]);
  const first = coordinates[0],
    last = coordinates[coordinates.length - 1];
  const loop = !!first && first[0] === last[0] && first[1] === last[1];

  useEffect(() => {
    if (!host.current || coordinates.length < 2) return;
    setTilesStatus('loading');
    const instance = L.map(host.current, {
      zoomControl: false,
      scrollWheelZoom: false,
      minZoom: 1,
      maxZoom: 19,
      zoomAnimation: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      fadeAnimation: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    });
    map.current = instance;
    let loaded = false;
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      keepBuffer: 0,
      updateWhenIdle: true,
      referrerPolicy: 'strict-origin-when-cross-origin',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributeurs',
    });
    tiles.on('tileload', () => {
      loaded = true;
      setTilesStatus('ready');
    });
    tiles.on('tileerror', () => {
      if (!loaded) setTilesStatus('error');
    });
    tiles.addTo(instance);
    // Outline keeps the imported line readable above roads and labels.
    L.polyline(coordinates, {
      color: '#fff',
      weight: 8,
      opacity: 0.95,
      interactive: false,
      smoothFactor: 0,
    }).addTo(instance);
    L.polyline(coordinates, {
      color: '#163e36',
      weight: 4,
      opacity: 1,
      interactive: false,
      smoothFactor: 0,
    }).addTo(instance);
    const label = (text: string) => {
      const element = document.createElement('span');
      element.textContent = text;
      return element;
    };
    const marker = (position: L.LatLngExpression, text: string, color: string) =>
      L.circleMarker(position, {
        radius: 7,
        color: '#fff',
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
      })
        .bindTooltip(label(text))
        .addTo(instance);
    marker(first, loop ? 'Départ et arrivée du GPX' : 'Départ du GPX', '#163e36');
    if (!loop) marker(last, 'Arrivée du GPX', '#d65632');
    for (const p of route.points || []) {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
      marker(
        [p.lat, p.lng],
        p.label + ' — ' + (pointKinds[p.kind] || 'point de repère'),
        '#729343',
      );
    }
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(instance);
    const bounds = L.latLngBounds(coordinates);
    fit.current = () =>
      instance.fitBounds(bounds, { padding: [30, 30], maxZoom: 16, animate: false });
    fit.current();
    retry.current = () => {
      loaded = false;
      setTilesStatus('loading');
      tiles.redraw();
    };
    const observer = new ResizeObserver(() => instance.invalidateSize({ pan: false }));
    observer.observe(host.current);
    setReady(true);
    return () => {
      observer.disconnect();
      instance.remove();
      map.current = null;
      fit.current = () => {};
      retry.current = () => {};
    };
  }, [coordinates, route.points]);

  if (coordinates.length < 2) return null;
  return (
    <section className="route-map" aria-label={'Parcours sur la carte : ' + name}>
      <div className="route-map-toolbar">
        <p>Votre parcours GPX sur la carte</p>
        <div>
          <button
            type="button"
            className="icon-button"
            aria-label="Agrandir la carte"
            disabled={!ready}
            onClick={() => map.current?.zoomIn()}
          >
            +
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Réduire la carte"
            disabled={!ready}
            onClick={() => map.current?.zoomOut()}
          >
            −
          </button>
          <button
            type="button"
            className="text-link"
            disabled={!ready}
            onClick={() => fit.current()}
          >
            Recentrer le parcours
          </button>
        </div>
      </div>
      <div
        ref={host}
        className="route-map-canvas"
        role="region"
        tabIndex={0}
        aria-label={'Carte interactive du parcours GPX : ' + name}
        aria-describedby={hintId}
      />
      <div className="route-map-caption">
        <p id={hintId}>
          Le tracé suit les coordonnées du GPX publié par l’organisation. Déplacez la carte avec le
          doigt, la souris ou les flèches du clavier. Zoomez avec les boutons ou deux doigts.
        </p>
        <p className="route-map-legend">
          <span>
            <i className="route-start" />
            {loop ? 'Départ et arrivée' : 'Départ'}
          </span>
          {!loop && (
            <span>
              <i className="route-finish" />
              Arrivée
            </span>
          )}
        </p>
        {tilesStatus === 'loading' && <p role="status">Chargement du fond de carte…</p>}
        {tilesStatus === 'error' && (
          <p role="status">
            Le fond de carte n’a pas pu se charger. Le tracé GPX reste affiché.{' '}
            <button type="button" className="text-link" onClick={() => retry.current()}>
              Réessayer
            </button>
          </p>
        )}
      </div>
      {route.points?.length > 0 && (
        <ul className="route-point-list">
          {route.points.map((p: any, i: number) => (
            <li key={i}>
              {p.label} — {pointKinds[p.kind]}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
