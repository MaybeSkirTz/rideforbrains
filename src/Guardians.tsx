import React, { useEffect, useRef, useState } from 'react';
import { useApp } from './context';
import { api, date } from './api';
import { Page, Link, Button, Field, Notice, go } from './ui';
import { accountUrl } from '../shared/navigation';
import { guardianConsentText } from '../shared/participation';
const statusLabel: Record<string, string> = {
  pending: 'En attente du parent',
  approved: 'Autorisation donnée',
  declined: 'Autorisation refusée',
  cancelled: 'Autorisation à refaire',
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
    <section className="guardian-panel" aria-label="Autorisation parentale">
      <h3>Un parent doit autoriser cette participation.</h3>
      <p>
        Le parent ou tuteur doit se connecter à son propre compte. Les renseignements de cette
        participation et les choix de consentement lui seront présentés. Aucun paiement ni billet
        n’est créé avant son accord.
      </p>
      <Field label="Courriel du parent ou tuteur">
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
          Me connecter pour envoyer la demande
        </Button>
      ) : (
        <div className="actions">
          {p.guardianStatus !== 'approved' && (
            <Button type="button" busy={busy} onClick={send}>
              Demander l’autorisation au parent
            </Button>
          )}
          {p.guardianRequestId && (
            <Button
              type="button"
              className="outline"
              disabled={busy}
              onClick={() => load().catch((e) => setError(e.message))}
            >
              Actualiser l’autorisation
            </Button>
          )}
        </div>
      )}
      <p className="small">
        Après accord, reprenez l’inscription depuis ce compte participant. Une modification des
        renseignements demande une nouvelle autorisation.
      </p>
      {p.guardianRequestId && (
        <Link to="/autorisations-parentales">
          Voir mes demandes et changer de compte si nécessaire
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
        Événement :{' '}
        {new Date(r.activity.eventAt).toLocaleDateString('fr-CA', { dateStyle: 'long' })} · Demande
        valable jusqu’au {date(r.expiresAt)}.
      </p>
      <details>
        <summary>Examiner les renseignements et les conditions</summary>
        <dl>
          <dt>Participant</dt>
          <dd>
            {p.firstName} {p.lastName} · moins de 18 ans
          </dd>
          <dt>Courriel et téléphone</dt>
          <dd>
            {p.email} · {p.phone}
          </dd>
          <dt>Contact d’urgence</dt>
          <dd>
            {p.emergencyName} · {p.emergencyPhone}
          </dd>
          {(r.activity.fields || []).map((f: any) => (
            <React.Fragment key={f.id}>
              <dt>{f.label}</dt>
              <dd>{String(p.answers[f.id] ?? '—')}</dd>
            </React.Fragment>
          ))}
          <dt>Photos et vidéos de l’événement</dt>
          <dd>{p.photo ? 'Consentement demandé' : 'Non'}</dd>
          <dt>Communications promotionnelles</dt>
          <dd>{p.marketing ? 'Consentement demandé' : 'Non'}</dd>
          <dt>Liste publique des participants</dt>
          <dd>{p.publicListing ? 'Prénom et initiale du nom — consentement demandé' : 'Non'}</dd>
        </dl>
        <h4>Conditions · {r.termsVersion}</h4>
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
          <p>{guardianConsentText}</p>
          <div className="form-grid">
            <Field label="Votre prénom et nom">
              <input
                name="signature"
                defaultValue={user.name}
                required
                minLength={3}
                maxLength={150}
              />
            </Field>
            <Field label="Votre lien avec le participant">
              <select name="relationship">
                <option value="parent">Parent</option>
                <option value="legal_guardian">Tuteur légal</option>
              </select>
            </Field>
          </div>
          <label className="checkbox">
            <input type="checkbox" required />
            Je confirme être majeur, parent ou tuteur légal de ce participant et avoir lu les
            renseignements, les choix de consentement et les conditions.
          </label>
          {error && <Notice error>{error}</Notice>}
          <div className="actions">
            <Button type="submit" name="decision" value="approve" busy={busy}>
              Autoriser cette participation
            </Button>
            <Button
              type="submit"
              name="decision"
              value="decline"
              className="outline"
              disabled={busy}
            >
              Refuser cette participation
            </Button>
          </div>
        </form>
      )}
      {r.consent && (
        <p className="small">
          Décision enregistrée le {date(r.decidedAt)} par {r.consent.signature}.
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
      <Page eyebrow="Autorisation parentale" title="Le parent a son propre espace.">
        <p>
          Connectez-vous avec le courriel auquel la demande a été envoyée. L’enfant et le parent
          doivent utiliser deux comptes distincts.
        </p>
        <div className="actions">
          <Link className="button" to={accountUrl('/autorisations-parentales', 'sign-in')}>
            Me connecter comme parent
          </Link>
          <Link className="button outline" to={accountUrl('/autorisations-parentales', 'create')}>
            Créer mon compte parent
          </Link>
        </div>
      </Page>
    );
  return (
    <Page eyebrow="Parents et participants" title="Les autorisations parentales.">
      <p>
        Compte connecté : {user.email}. Un parent ou tuteur majeur autorise chaque participation
        depuis son propre compte. L’autorisation ne déclenche aucun paiement.
      </p>
      <div className="actions">
        <Button onClick={load}>Actualiser les demandes</Button>
        <Button
          className="outline"
          onClick={async () => {
            await api('/auth/sign-out', {});
            await refresh();
            go(accountUrl('/autorisations-parentales', 'sign-in'));
          }}
        >
          Changer de compte
        </Button>
      </div>
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      <h2>Demandes à examiner comme parent</h2>
      {requests?.asParent.map((r: any) => (
        <ParentDecision
          key={r.id}
          request={r}
          onDone={() => {
            setMessage(
              'Votre décision a été enregistrée. Le participant peut actualiser son autorisation dans son inscription.',
            );
            load();
          }}
        />
      ))}
      {requests?.asParent.length === 0 && (
        <p>Aucune demande pour ce courriel. Vérifiez l’adresse que le participant a indiquée.</p>
      )}
      {!!requests?.asParticipant.length && (
        <section>
          <h2>Mes demandes comme participant</h2>
          {requests.asParticipant.map((r: any) => (
            <article className="guardian-card" key={r.id}>
              <h3>
                {r.participant.firstName} {r.participant.lastName} · {r.activity.name}{' '}
                {r.activity.distance}
              </h3>
              <p>
                {statusLabel[r.status]} · Parent : {r.guardianEmail}
              </p>
              <Link className="button" to={'/inscription?activite=' + r.participant.activityId}>
                Reprendre mon inscription
              </Link>
            </article>
          ))}
        </section>
      )}
    </Page>
  );
}
