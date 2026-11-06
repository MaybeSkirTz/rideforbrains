import { impactLabels } from '../shared/impact';
import { Button, Field } from './ui';

export default function ImpactSettings({
  settings,
  change,
}: {
  settings: any;
  change: (key: string, value: any) => void;
}) {
  const impact = settings.impact || {
    minimumParticipants: 10,
    participants: false,
    km: false,
    teams: false,
    volunteers: false,
  };
  const info = settings.financialTransparency || {
    title: 'Où va mon argent?',
    introduction: '',
    categories: [],
  };
  const update = (patch: object) => change('financialTransparency', { ...info, ...patch });
  const category = (index: number, patch: object) =>
    update({
      categories: info.categories.map((row: any, i: number) =>
        i === index ? { ...row, ...patch } : row,
      ),
    });
  const move = (index: number, delta: number) => {
    const rows = [...info.categories],
      next = index + delta;
    [rows[index], rows[next]] = [rows[next], rows[index]];
    update({ categories: rows });
  };
  return (
    <details className="settings-details">
      <summary>Impact et transparence</summary>
      <h3>Compteurs publics</h3>
      <Field label="Seuil de participations confirmées avant l’affichage">
        <input
          type="number"
          min={1}
          max={10000}
          value={impact.minimumParticipants}
          onChange={(e) =>
            change('impact', { ...impact, minimumParticipants: Number(e.target.value) })
          }
        />
      </Field>
      {Object.entries(impactLabels).map(([key, label]) => (
        <label className="checkbox" key={key}>
          <input
            type="checkbox"
            checked={!!impact[key]}
            onChange={(e) => change('impact', { ...impact, [key]: e.target.checked })}
          />
          Afficher · {label}
        </label>
      ))}
      <h3>Où va mon argent?</h3>
      <Field label="Titre de la page de transparence">
        <input
          maxLength={150}
          value={info.title}
          onChange={(e) => update({ title: e.target.value })}
        />
      </Field>
      <Field label="Introduction">
        <textarea
          rows={3}
          maxLength={2500}
          value={info.introduction}
          onChange={(e) => update({ introduction: e.target.value })}
        />
      </Field>
      {info.categories.map((row: any, i: number) => (
        <fieldset className="content-repeater" key={i}>
          <legend>{row.name || 'Catégorie de dépenses'}</legend>
          <Field label="Nom de la catégorie">
            <input
              maxLength={150}
              value={row.name}
              onChange={(e) => category(i, { name: e.target.value })}
            />
          </Field>
          <Field label="Description de la catégorie">
            <textarea
              maxLength={1500}
              value={row.description}
              onChange={(e) => category(i, { description: e.target.value })}
            />
          </Field>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={row.enabled}
              onChange={(e) => category(i, { enabled: e.target.checked })}
            />{' '}
            Afficher publiquement
          </label>
          <div className="actions">
            <Button type="button" className="light" disabled={i === 0} onClick={() => move(i, -1)}>
              Monter
            </Button>
            <Button
              type="button"
              className="light"
              disabled={i === info.categories.length - 1}
              onClick={() => move(i, 1)}
            >
              Descendre
            </Button>
            <Button
              type="button"
              className="light"
              onClick={() =>
                update({ categories: info.categories.filter((_: any, n: number) => n !== i) })
              }
            >
              Retirer
            </Button>
          </div>
        </fieldset>
      ))}
      <Button
        type="button"
        className="outline"
        disabled={info.categories.length >= 24}
        onClick={() =>
          update({
            categories: [...info.categories, { name: '', description: '', enabled: false }],
          })
        }
      >
        Ajouter une catégorie
      </Button>
    </details>
  );
}
