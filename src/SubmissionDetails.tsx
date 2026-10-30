import { useState } from 'react';
import { Field, Button, Notice } from './ui';
import { api } from './api';
const sponsor = [
  ['company', 'Entreprise'],
  ['contact', 'Personne contact'],
  ['phone', 'Téléphone'],
  ['amount', 'Montant convenu (CAD)'],
  ['level', 'Niveau'],
  ['notes', 'Notes privées'],
];
const volunteer = [
  ['phone', 'Téléphone'],
  ['availability', 'Disponibilités'],
  ['role', 'Rôle'],
  ['sector', 'Secteur'],
  ['shift', 'Quart'],
  ['arrival', 'Heure d’arrivée'],
  ['supervisor', 'Responsable'],
  ['notes', 'Notes privées'],
];
export default function SubmissionDetails({ row, onSaved }: { row: any; onSaved: () => void }) {
  const [details, setDetails] = useState<any>(() => {
      try {
        return JSON.parse(row.details || '{}');
      } catch {
        return {};
      }
    }),
    [stage, setStage] = useState(row.stage || 'new'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  if (!['sponsor', 'volunteer'].includes(row.kind)) return null;
  const stages =
    row.kind === 'sponsor'
      ? [
          ['new', 'À contacter'],
          ['contacted', 'Contacté'],
          ['interested', 'Intéressé'],
          ['confirmed', 'Confirmé'],
          ['declined', 'Refusé'],
        ]
      : [
          ['new', 'Candidat'],
          ['accepted', 'Accepté'],
          ['assigned', 'Affecté'],
          ['confirmed', 'Confirmé'],
          ['present', 'Présent'],
          ['cancelled', 'Annulé'],
        ];
  return (
    <form
      className="form-panel"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          await api('/admin/submissions/' + row.id, { details, stage }, 'PATCH');
          onSaved();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="small">
        Suivi privé de l’organisation. Ces renseignements ne sont jamais publiés sur le site.
      </p>
      <Field label="Étape">
        <select value={stage} onChange={(e) => setStage(e.target.value)}>
          {stages.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <div className="form-grid">
        {(row.kind === 'sponsor' ? sponsor : volunteer).map(([key, label]) => (
          <Field key={key} label={label}>
            {key === 'notes' ? (
              <textarea
                value={details[key] || ''}
                onChange={(e) => setDetails({ ...details, [key]: e.target.value })}
              />
            ) : (
              <input
                type={key === 'amount' ? 'number' : 'text'}
                min="0"
                step="0.01"
                value={details[key] ?? ''}
                onChange={(e) =>
                  setDetails({
                    ...details,
                    [key]: key === 'amount' ? Number(e.target.value) : e.target.value,
                  })
                }
              />
            )}
          </Field>
        ))}
      </div>
      {row.kind === 'sponsor' &&
        ['paymentReceived', 'logoReceived', 'contractReceived'].map((key, i) => (
          <label className="checkbox" key={key}>
            <input
              type="checkbox"
              checked={!!details[key]}
              onChange={(e) => setDetails({ ...details, [key]: e.target.checked })}
            />
            {['Paiement reçu', 'Logo reçu', 'Contrat reçu'][i]}
          </label>
        ))}
      {error && <Notice error>{error}</Notice>}
      <Button busy={busy}>Enregistrer le suivi</Button>
    </form>
  );
}
