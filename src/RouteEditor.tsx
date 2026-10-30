import { useState } from 'react';
import { Field, Button, Notice } from './ui';
export default function RouteEditor({ route, change }: { route: any; change: (v: any) => void }) {
  const [error, setError] = useState('');
  const importGPX = async (file?: File) => {
    if (!file) return;
    setError('');
    try {
      if (file.size > 3000000) throw Error('Le GPX doit faire moins de 3 Mo.');
      const doc = new DOMParser().parseFromString(await file.text(), 'application/xml');
      if (doc.querySelector('parsererror')) throw Error('Fichier GPX invalide.');
      const coordinates = [...doc.querySelectorAll('trkpt,rtept')].map((p) => [
        Number(p.getAttribute('lon')),
        Number(p.getAttribute('lat')),
      ]);
      if (
        coordinates.length < 2 ||
        coordinates.some(
          ([lon, lat]) =>
            !Number.isFinite(lon) ||
            !Number.isFinite(lat) ||
            Math.abs(lon) > 180 ||
            Math.abs(lat) > 90,
        )
      )
        throw Error('Le GPX doit contenir des coordonnées valides.');
      const step = Math.max(1, Math.ceil(coordinates.length / 4999)),
        reduced = coordinates.filter((_, i) => i % step === 0);
      if (reduced[reduced.length - 1] !== coordinates[coordinates.length - 1])
        reduced.push(coordinates[coordinates.length - 1]);
      change({ ...route, coordinates: reduced });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <fieldset className="content-repeater">
      <legend>Tracé officiel et points de repère</legend>
      <Field
        label="Importer les coordonnées d’un GPX validé"
        hint="Le fichier reste local pendant la lecture. Les coordonnées ne sont publiées qu’en enregistrant cette activité. Le lien GPX de téléchargement se configure séparément."
      >
        <input
          type="file"
          accept=".gpx,application/gpx+xml"
          onChange={(e) => importGPX(e.target.files?.[0])}
        />
      </Field>
      {error && <Notice error>{error}</Notice>}
      <p>{route.coordinates?.length || 0} points de tracé configurés.</p>
      {route.coordinates?.length > 0 && (
        <Button
          type="button"
          className="button light"
          onClick={() => change({ ...route, coordinates: [] })}
        >
          Retirer le tracé de ce formulaire
        </Button>
      )}
      {(route.points || []).map((p: any, i: number) => (
        <div className="form-grid" key={i}>
          {[
            ['label', 'Nom du repère'],
            ['lng', 'Longitude'],
            ['lat', 'Latitude'],
          ].map(([k, l]) => (
            <Field label={l} key={k}>
              <input
                type={k === 'label' ? 'text' : 'number'}
                step="any"
                value={p[k]}
                onChange={(e) =>
                  change({
                    ...route,
                    points: route.points.map((r: any, n: number) =>
                      n === i
                        ? { ...r, [k]: k === 'label' ? e.target.value : Number(e.target.value) }
                        : r,
                    ),
                  })
                }
              />
            </Field>
          ))}
          <Field label="Type">
            <select
              value={p.kind}
              onChange={(e) =>
                change({
                  ...route,
                  points: route.points.map((r: any, n: number) =>
                    n === i ? { ...r, kind: e.target.value } : r,
                  ),
                })
              }
            >
              {[
                ['point', 'Point important'],
                ['start', 'Départ'],
                ['finish', 'Arrivée'],
                ['water', 'Ravitaillement'],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Button
            type="button"
            className="button light"
            onClick={() =>
              change({ ...route, points: route.points.filter((_: any, n: number) => n !== i) })
            }
          >
            Retirer ce repère
          </Button>
        </div>
      ))}
      <Button
        type="button"
        className="button light"
        onClick={() =>
          change({
            ...route,
            points: [
              ...(route.points || []),
              { label: 'À renseigner', kind: 'point', lng: 0, lat: 0 },
            ],
          })
        }
      >
        Ajouter un repère
      </Button>
      <p className="small">
        Les coordonnées doivent être confirmées avant de publier. Aucun parcours fictif n’est
        généré.
      </p>
    </fieldset>
  );
}
