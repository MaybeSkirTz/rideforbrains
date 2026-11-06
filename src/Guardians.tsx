import { t as textForLocale } from './locale-copy';
import React, { useEffect, useRef, useState } from 'react';
import { useApp } from './context';
import { api, date } from './api';
import { Page, Link, Button, Field, Notice, go } from './ui';
import { accountUrl } from '../shared/navigation';
import { guardianConsentText } from '../shared/participation';
const statusLabel: Record<string, string> = {
  pending: textForLocale('En attente du parent'),
  approved: textForLocale('Autorisation donnée'),
  declined: textForLocale('Autorisation refusée'),
  cancelled: textForLocale('Autorisation à refaire'),
};
export function GuardianRequest({
  participant: p,
  onChange,
  onSignIn,
  onCreated,
}: {
  participant: any;
  onChange: (key: string, value: any) => void;
  onSignIn: () => void;
  onCreated: (id: string, status: string) => Promise<void>;
}) {
  const { data, user } = useApp();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const load = async () => {
    if (!p.guardianRequestId) return;
    const r = await api('/guardian/requests/' + p.guardianRequestId);
    changeRef.current(
      'guardianStatus',
      r.used ||
        r.expiresAt * 1000 <= Date.now() ||
        r.termsVersion !== data.settings.termsVersion ||
        r.activity.eventAt !== data.settings.eventAt ||
        r.activity.formVersion !== p.formVersion
        ? 'cancelled'
        : r.status,
    );
  };
  useEffect(() => {
    if (!user || !p.guardianRequestId) return;
    load().catch((e) => setError(e.message));
    const timer = setInterval(() => {
      if (!document.hidden) load().catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [p.guardianRequestId, user?.id, data.settings.termsVersion, data.settings.eventAt]);
  const send = async (e: React.MouseEvent<HTMLButtonElement>) => {
    const invalid = e.currentTarget
      .closest('.participant-fields')
      ?.querySelector('input:invalid,select:invalid,textarea:invalid') as HTMLInputElement | null;
    if (invalid) {
      invalid.reportValidity();
      invalid.focus();
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await api('/guardian/requests', {
        participant: p,
        termsVersion: data.settings.termsVersion,
      });
      await onCreated(r.id, r.status);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="guardian-panel" aria-label={textForLocale('Autorisation parentale')}>
      <h3>{textForLocale('Un parent doit autoriser cette participation.')}</h3>
      <p>
        {textForLocale(
          'Le parent ou tuteur doit se connecter à son propre compte. Les renseignements de cette participation et les choix de consentement lui seront présentés. Aucun paiement ni billet n’est créé avant son accord.',
        )}
      </p>
      <Field label={textForLocale('Courriel du parent ou tuteur')}>
        <input
          type="email"
          required
          maxLength={200}
          value={p.guardianEmail || ''}
          onChange={(e) => onChange('guardianEmail', e.target.value)}
          autoComplete="off"
        />
      </Field>
      {error && <Notice error>{error}</Notice>}
      {p.guardianStatus && <Notice>{statusLabel[p.guardianStatus] || p.guardianStatus}</Notice>}
      {!user ? (
        <Button type="button" onClick={onSignIn}>
          {textForLocale('Me connecter pour envoyer la demande')}
        </Button>
      ) : (
        <div className="actions">
          {p.guardianStatus !== 'approved' && (
            <Button type="button" busy={busy} onClick={send}>
              {textForLocale('Demander l’autorisation au parent')}
            </Button>
          )}
          {p.guardianRequestId && (
            <Button
              type="button"
              className="outline"
              disabled={busy}
              onClick={() => load().catch((e) => setError(e.message))}
            >
              {textForLocale('Actualiser l’autorisation')}
            </Button>
          )}
        </div>
      )}
      <p className="small">
        {textForLocale(
          'Après accord, reprenez l’inscription depuis ce compte participant. Une modification des renseignements demande une nouvelle autorisation.',
        )}
      </p>
      {p.guardianRequestId && (
        <Link to="/autorisations-parentales">
          {textForLocale('Voir mes demandes et changer de compte si nécessaire')}
        </Link>
      )}
    </section>
  );
}
function ParentDecision({ request: r, onDone }: { request: any; onDone: () => void }) {
  const { user } = useApp();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const p = r.participant;
  return (
    <article className="guardian-card">
      <h3>
        {p.firstName} {p.lastName} · {r.activity.name} {r.activity.distance}
      </h3>
      <p>
        {statusLabel[r.status]}
        {r.used ? ' · Utilisée pour une inscription' : ''}
      </p>
      <p>
        {textForLocale('Événement :')}{' '}
        {new Date(r.activity.eventAt).toLocaleDateString('fr-CA', { dateStyle: 'long' })}
        {textForLocale(' · Demande valable jusqu’au ')}
        {date(r.expiresAt)}.
      </p>
      <details>
        <summary>{textForLocale('Examiner les renseignements et les conditions')}</summary>
        <dl>
          <dt>{textForLocale('Participant')}</dt>
          <dd>
            {p.firstName} {p.lastName}
            {textForLocale(' · moins de 18 ans')}
          </dd>
          <dt>{textForLocale('Courriel et téléphone')}</dt>
          <dd>
            {p.email} · {p.phone}
          </dd>
          <dt>{textForLocale('Contact d’urgence')}</dt>
          <dd>
            {p.emergencyName} · {p.emergencyPhone}
          </dd>
          {(r.activity.fields || []).map((f: any) => (
            <React.Fragment key={f.id}>
              <dt>{f.label}</dt>
              <dd>{String(p.answers[f.id] ?? '—')}</dd>
            </React.Fragment>
          ))}
          <dt>{textForLocale('Photos et vidéos de l’événement')}</dt>
          <dd>{p.photo ? textForLocale('Consentement demandé') : textForLocale('Non')}</dd>
          <dt>{textForLocale('Communications promotionnelles')}</dt>
          <dd>{p.marketing ? textForLocale('Consentement demandé') : textForLocale('Non')}</dd>
          <dt>{textForLocale('Liste publique des participants')}</dt>
          <dd>
            {p.publicListing
              ? textForLocale('Prénom et initiale du nom — consentement demandé')
              : textForLocale('Non')}
          </dd>
        </dl>
        <h4>
          {textForLocale('Conditions · ')}
          {r.termsVersion}
        </h4>
        <p className="prewrap">{r.terms}</p>
      </details>
      {r.status === 'pending' && r.expiresAt * 1000 > Date.now() && !r.used && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const decision =
              (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'decline'
                ? 'decline'
                : 'approve';
            setBusy(true);
            setError('');
            try {
              await api('/guardian/requests/' + r.id + '/decision', {
                decision,
                confirm: true,
                adult: true,
                relationship: f.get('relationship'),
                signature: f.get('signature'),
              });
              onDone();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>{r.consentText || guardianConsentText}</p>
          <div className="form-grid">
            <Field label={textForLocale('Votre prénom et nom')}>
              <input
                name="signature"
                defaultValue={user.name}
                required
                minLength={3}
                maxLength={150}
              />
            </Field>
            <Field label={textForLocale('Votre lien avec le participant')}>
              <select name="relationship">
                <option value="parent">{textForLocale('Parent')}</option>
                <option value="legal_guardian">{textForLocale('Tuteur légal')}</option>
              </select>
            </Field>
          </div>
          <label className="checkbox">
            <input type="checkbox" required />
            {textForLocale(
              'Je confirme être majeur, parent ou tuteur légal de ce participant et avoir lu les renseignements, les choix de consentement et les conditions.',
            )}
          </label>
          {error && <Notice error>{error}</Notice>}
          <div className="actions">
            <Button type="submit" name="decision" value="approve" busy={busy}>
              {textForLocale('Autoriser cette participation')}
            </Button>
            <Button
              type="submit"
              name="decision"
              value="decline"
              className="outline"
              disabled={busy}
            >
              {textForLocale('Refuser cette participation')}
            </Button>
          </div>
        </form>
      )}
      {r.consent && (
        <p className="small">
          {textForLocale('Décision enregistrée le ')}
          {date(r.decidedAt)}
          {textForLocale(' par ')}
          {r.consent.signature}.
        </p>
      )}
    </article>
  );
}
export default function Guardians() {
  const { user, refresh } = useApp();
  const [requests, setRequests] = useState<any>(),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const load = () =>
    api('/guardian/requests')
      .then(setRequests)
      .catch((e) => setError(e.message));
  useEffect(() => {
    if (user) load();
  }, [user?.id]);
  if (!user)
    return (
      <Page
        eyebrow={textForLocale('Autorisation parentale')}
        title={textForLocale('Le parent a son propre espace.')}
      >
        <p>
          {textForLocale(
            'Connectez-vous avec le courriel auquel la demande a été envoyée. L’enfant et le parent doivent utiliser deux comptes distincts.',
          )}
        </p>
        <div className="actions">
          <Link className="button" to={accountUrl('/autorisations-parentales', 'sign-in')}>
            {textForLocale('Me connecter comme parent')}
          </Link>
          <Link className="button outline" to={accountUrl('/autorisations-parentales', 'create')}>
            {textForLocale('Créer mon compte parent')}
          </Link>
        </div>
      </Page>
    );
  return (
    <Page
      eyebrow={textForLocale('Parents et participants')}
      title={textForLocale('Les autorisations parentales.')}
    >
      <p>
        {textForLocale('Compte connecté : ')}
        {user.email}
        {textForLocale(
          '. Un parent ou tuteur majeur autorise chaque participation depuis son propre compte. L’autorisation ne déclenche aucun paiement.',
        )}
      </p>
      <div className="actions">
        <Button onClick={load}>{textForLocale('Actualiser les demandes')}</Button>
        <Button
          className="outline"
          onClick={async () => {
            await api('/auth/sign-out', {});
            await refresh();
            go(accountUrl('/autorisations-parentales', 'sign-in'));
          }}
        >
          {textForLocale('Changer de compte')}
        </Button>
      </div>
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      <h2>{textForLocale('Demandes à examiner comme parent')}</h2>
      {requests?.asParent.map((r: any) => (
        <ParentDecision
          key={r.id}
          request={r}
          onDone={() => {
            setMessage(
              textForLocale(
                'Votre décision a été enregistrée. Le participant peut actualiser son autorisation dans son inscription.',
              ),
            );
            load();
          }}
        />
      ))}
      {requests?.asParent.length === 0 && (
        <p>
          {textForLocale(
            'Aucune demande pour ce courriel. Vérifiez l’adresse que le participant a indiquée.',
          )}
        </p>
      )}
      {!!requests?.asParticipant.length && (
        <section>
          <h2>{textForLocale('Mes demandes comme participant')}</h2>
          {requests.asParticipant.map((r: any) => (
            <article className="guardian-card" key={r.id}>
              <h3>
                {r.participant.firstName} {r.participant.lastName} · {r.activity.name}{' '}
                {r.activity.distance}
              </h3>
              <p>
                {statusLabel[r.status]}
                {textForLocale(' · Parent : ')}
                {r.guardianEmail}
              </p>
              <Link className="button" to={'/inscription?activite=' + r.participant.activityId}>
                {textForLocale('Reprendre mon inscription')}
              </Link>
            </article>
          ))}
        </section>
      )}
    </Page>
  );
}
