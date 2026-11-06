import { useEffect, useState } from 'react';
import { noticeTemplates, type NoticeCategory } from '../shared/important-notices';
import { api } from './api';
import { useApp } from './context';
import { Button, Field, Notice } from './ui';

type Audience =
  | { kind: 'all' | 'volunteers' }
  | { kind: 'activity' | 'team'; id: string }
  | { kind: 'selection'; ids: string[] };
type Draft = {
  id: string;
  category: NoticeCategory;
  audience: Audience;
  subject: string;
  message: string;
  schedule: string;
};
type Preview = {
  count: number;
  activities: string[];
  signature: string;
  subject: string;
  message: string;
  category: NoticeCategory;
  scheduledAt: number | null;
};
type Row = {
  id: string;
  payload: Draft;
  draft: number;
  scheduled_at: number;
  recipient_count: number;
  sent: number;
  failed: number;
};
const toronto = (seconds: number) =>
  new Intl.DateTimeFormat('fr-CA', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Toronto',
  }).format(seconds * 1000);
const initial = (): Draft => ({
  id: crypto.randomUUID(),
  category: 'information',
  audience: { kind: 'all' },
  subject: noticeTemplates.information.subject,
  message: '',
  schedule: '',
});

export default function ImportantNotices({ selected }: { selected: string[] }) {
  const { data } = useApp();
  const [draft, setDraft] = useState(initial);
  const [preview, setPreview] = useState<{ result: Preview; draft: Draft }>();
  const [history, setHistory] = useState<Row[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () =>
    api<Row[]>('/admin/mail/notices')
      .then(setHistory)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
    api('/admin/mail/notices/teams')
      .then(setTeams)
      .catch((e) => setError(e.message));
  }, []);
  const edit = (update: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...update }));
    setPreview(undefined);
    setMessage('');
  };
  const execute = async (task: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await task();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="settings-details">
      <summary>Avis importants et rappels</summary>
      <p>
        Ces avis opérationnels servent à la participation. L’heure programmée correspond à Toronto.
      </p>
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void execute(async () =>
            setPreview({ result: await api('/admin/mail/notices/preview', draft), draft }),
          );
        }}
      >
        <fieldset disabled={busy} className="content-repeater">
          <legend>Préparer un avis</legend>
          <div className="form-grid">
            <Field label="Catégorie">
              <select
                value={draft.category}
                onChange={(e) => edit({ category: e.target.value as NoticeCategory })}
              >
                {Object.entries(noticeTemplates).map(([key, item]) => (
                  <option value={key} key={key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Destinataires de l’avis">
              <select
                value={draft.audience.kind}
                onChange={(e) => {
                  const kind = e.target.value;
                  if (kind === 'activity')
                    edit({ audience: { kind, id: data.activities[0]?.id || '' } });
                  if (kind === 'team') edit({ audience: { kind, id: teams[0]?.id || '' } });
                  if (kind === 'selection') edit({ audience: { kind, ids: selected } });
                  if (kind === 'all' || kind === 'volunteers') edit({ audience: { kind } });
                }}
              >
                <option value="all">Toutes les participations confirmées</option>
                <option value="activity">Une activité</option>
                <option value="team" disabled={!teams.length}>
                  Une équipe
                </option>
                <option value="volunteers">Bénévoles confirmés</option>
                <option
                  value="selection"
                  disabled={!selected.length && draft.audience.kind !== 'selection'}
                >
                  Sélection manuelle (
                  {draft.audience.kind === 'selection'
                    ? draft.audience.ids.length
                    : selected.length}
                  )
                </option>
              </select>
            </Field>
            {draft.audience.kind === 'activity' && (
              <Field label="Activité visée">
                <select
                  value={draft.audience.id}
                  onChange={(e) => edit({ audience: { kind: 'activity', id: e.target.value } })}
                >
                  {data.activities.map((a) => (
                    <option value={a.id} key={a.id}>
                      {a.name} · {a.distance}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {draft.audience.kind === 'team' && (
              <Field label="Équipe visée">
                <select
                  value={draft.audience.id}
                  onChange={(e) => edit({ audience: { kind: 'team', id: e.target.value } })}
                >
                  {teams.map((team) => (
                    <option value={team.id} key={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Envoi programmé, heure de Toronto">
              <input
                type="datetime-local"
                value={draft.schedule}
                onChange={(e) => edit({ schedule: e.target.value })}
              />
            </Field>
          </div>
          <Button
            type="button"
            className="light"
            onClick={() => {
              const template = noticeTemplates[draft.category];
              edit({ subject: template.subject, message: template.message });
            }}
          >
            Insérer le modèle
          </Button>
          <Field label="Objet de l’avis">
            <input
              required
              maxLength={200}
              value={draft.subject}
              onChange={(e) => edit({ subject: e.target.value })}
            />
          </Field>
          <Field label="Message de l’avis">
            <textarea
              required
              rows={7}
              maxLength={12000}
              value={draft.message}
              onChange={(e) => edit({ message: e.target.value })}
            />
          </Field>
          <div className="actions">
            <Button type="submit" busy={busy}>
              Prévisualiser l’avis
            </Button>
            <Button
              type="button"
              className="light"
              onClick={() =>
                void execute(async () => {
                  await api('/admin/mail/notices', draft, 'PUT');
                  setMessage('Brouillon enregistré.');
                  await load();
                })
              }
            >
              Enregistrer le brouillon
            </Button>
          </div>
        </fieldset>
      </form>
      {preview && (
        <section className="detail-panel" aria-label="Prévisualisation de l’avis">
          <p>
            {noticeTemplates[preview.result.category].label} · {preview.result.count}{' '}
            destinataire(s)
          </p>
          <p>{preview.result.activities.join(' · ')}</p>
          <p>
            {preview.result.scheduledAt
              ? toronto(preview.result.scheduledAt) + ' (Toronto)'
              : 'Envoi dès confirmation'}
          </p>
          <h3>{preview.result.subject}</h3>
          <p className="prewrap">{preview.result.message}</p>
          <Button
            type="button"
            busy={busy}
            disabled={!preview.result.count}
            onClick={() =>
              void execute(async () => {
                const result = await api('/admin/mail/notices/send', {
                  draft: preview.draft,
                  signature: preview.result.signature,
                  confirm: true,
                });
                setPreview(undefined);
                setDraft(initial());
                setMessage(result.count + ' destinataire(s) dans la file d’envoi.');
                await load();
              })
            }
          >
            {preview.result.scheduledAt ? 'Confirmer la programmation' : 'Confirmer l’envoi'}
          </Button>
        </section>
      )}
      <h3>Suivi des avis</h3>
      <button type="button" className="text-link" onClick={load}>
        Actualiser le suivi
      </button>
      {history.map((row) => (
        <div className="mail-row" key={row.id}>
          <strong>{row.payload.subject}</strong>
          {row.draft ? (
            <button
              type="button"
              className="text-link"
              disabled={busy}
              onClick={() => {
                setDraft(row.payload);
                setPreview(undefined);
              }}
            >
              Reprendre le brouillon
            </button>
          ) : (
            <p>
              {row.scheduled_at * 1000 > Date.now() ? 'Programmé · ' : ''}
              {toronto(row.scheduled_at)} · {row.sent}/{row.recipient_count} acceptés · {row.failed}{' '}
              échec(s) ou retrait(s)
            </p>
          )}
        </div>
      ))}
    </details>
  );
}
