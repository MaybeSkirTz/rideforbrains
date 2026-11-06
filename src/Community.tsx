import { t as textForLocale } from './locale-copy';
import { useEffect, useState } from 'react';
import { accountUrl } from '../shared/navigation';
import { api } from './api';
import { useApp } from './context';
import { Button, Field, Link, Notice, Page } from './ui';
import useFragmentToken from './useFragmentToken';
import './community.css';

type Team = {
  id: string;
  name: string;
  description: string;
  photo: string;
  members: number;
  km: number;
  activities: [string, number][];
  firstNames: string[];
  status: string;
  visibility: string;
};
type Participation = {
  id: string;
  first_name: string;
  activity_id: string;
  can_show_first: number;
  team_id: string | null;
  team_name: string | null;
  team_status: string | null;
  show_first: number;
};
type Kind = 'story' | 'dedication';
type Post = {
  id?: string;
  kind: Kind;
  title: string;
  text: string;
  photo: string;
  status: string;
  consent: number;
};
type AccountCommunity = { registrations: Participation[]; teams: Team[]; posts: Post[] };

const labels: Record<string, string> = {
  draft: textForLocale('Brouillon privé'),
  private: textForLocale('Privée'),
  pending: textForLocale('En modération'),
  submitted: 'Soumise',
  approved: textForLocale('Approuvée'),
  rejected: textForLocale('Refusée'),
  archived: textForLocale('Archivée'),
  hidden: textForLocale('Masquée'),
};

export default function Community({ path }: { path: string }) {
  if (path === '/ma-communaute') return <ManageCommunity />;
  if (path === '/equipes') return <Teams />;
  if (path.startsWith('/equipes/')) return <TeamPage id={path.slice('/equipes/'.length)} />;
  return <PublicContributions kind={path === '/histoires' ? 'story' : 'dedication'} />;
}

function Teams() {
  const [teams, setTeams] = useState<Team[]>();
  const [error, setError] = useState('');
  useEffect(() => {
    api<Team[]>('/teams')
      .then(setTeams)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <Page
      eyebrow={textForLocale('Un défi à plusieurs')}
      title={textForLocale('Les équipes')}
      className="community-page"
    >
      <p>
        {textForLocale('Retrouvez les groupes qui se préparent ensemble pour Ride For Brains.')}
      </p>
      <Link className="button" to="/ma-communaute">
        {textForLocale('Créer une équipe ou gérer ma participation')}
      </Link>
      {error && <Notice error>{error}</Notice>}
      {!teams && !error && <p role="status">{textForLocale('Chargement…')}</p>}
      {teams?.length === 0 && <p>{textForLocale('Aucune équipe publique pour le moment.')}</p>}
      <div className="community-list">
        {teams?.map((team) => (
          <article key={team.id}>
            {team.photo && (
              <img src={team.photo} alt="" loading="lazy" referrerPolicy="no-referrer" />
            )}
            <h2>
              <Link to={'/equipes/' + team.id}>{team.name}</Link>
            </h2>
            <p>
              {team.members}
              {textForLocale(' participation(s)')}
            </p>
            {team.description && <p className="prewrap">{team.description}</p>}
          </article>
        ))}
      </div>
    </Page>
  );
}

function ParticipationPicker({
  rows,
  value,
  change,
}: {
  rows: Participation[];
  value: string;
  change: (id: string) => void;
}) {
  const { data } = useApp();
  return (
    <Field label={textForLocale('Participation concernée')}>
      <select value={value} onChange={(e) => change(e.target.value)}>
        <option value="">{textForLocale('Choisir une participation')}</option>
        {rows.map((row) => {
          const activity = data.activities.find((item) => item.id === row.activity_id);
          return (
            <option key={row.id} value={row.id}>
              {row.first_name} · {activity?.name || row.activity_id}
              {activity ? ' · ' + activity.distance : ''}
            </option>
          );
        })}
      </select>
    </Field>
  );
}

function TeamPage({ id }: { id: string }) {
  const { user } = useApp();
  const token = useFragmentToken();
  const [team, setTeam] = useState<Team>();
  const [data, setData] = useState<AccountCommunity>();
  const [registration, select] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const storageKey = 'rfb-team-invite:' + id;
  const refresh = () =>
    api<Team>('/teams/' + id)
      .then(setTeam)
      .catch(() => setTeam(undefined));
  useEffect(() => {
    void refresh();
    if (user)
      api<AccountCommunity>('/community/me')
        .then(setData)
        .catch((e) => setError(e.message));
    try {
      if (/^[a-f0-9]{64}$/.test(token)) sessionStorage.setItem(storageKey, token);
      setCode(sessionStorage.getItem(storageKey) || token);
    } catch {
      setCode(token);
    }
  }, [id, user, token]);
  const available = data?.registrations.filter((row) => !row.team_id) || [];
  return (
    <Page
      eyebrow={textForLocale('Ride For Brains · Équipes')}
      title={team?.name || textForLocale('Invitation à une équipe')}
      className="community-page"
    >
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      {team ? (
        <section className="community-list">
          {team.photo && <img src={team.photo} alt="" referrerPolicy="no-referrer" />}
          {team.description && <p className="prewrap">{team.description}</p>}
          <p>
            <strong>
              {team.members}
              {textForLocale(' participation(s)')}
            </strong>{' '}
            · {new Intl.NumberFormat('fr-CA').format(team.km)}
            {textForLocale(' km de défis choisis')}
          </p>
          {team.status !== 'approved' && <p>{labels[team.status]}</p>}
          <ul>
            {team.activities.map(([label, count]) => (
              <li key={label}>
                {count} × {label}
              </li>
            ))}
          </ul>
          {!!team.firstNames.length && (
            <p>
              {textForLocale('Avec ')}
              {team.firstNames.join(', ')}
            </p>
          )}
        </section>
      ) : (
        <p>
          {textForLocale(
            'Cette équipe est privée ou indisponible. Un code valide permet de rejoindre une équipe privée.',
          )}
        </p>
      )}
      {!user ? (
        <Link className="button" to={accountUrl('/equipes/' + id, 'sign-in')}>
          {textForLocale('Me connecter pour rejoindre l’équipe')}
        </Link>
      ) : (
        available.length > 0 && (
          <form
            className="form-panel"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              try {
                await api('/teams/' + id + '/join', {
                  registrationId: registration,
                  ...(code.trim() ? { code: code.trim() } : {}),
                });
                try {
                  sessionStorage.removeItem(storageKey);
                } catch {
                  /* optional browser storage */
                }
                setCode('');
                setMessage(textForLocale('Participation ajoutée à l’équipe.'));
                await refresh();
                setData(await api('/community/me'));
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <ParticipationPicker rows={available} value={registration} change={select} />
            {team?.visibility !== 'public' && (
              <Field label={textForLocale('Code d’invitation')}>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="off"
                  maxLength={64}
                />
              </Field>
            )}
            <Button busy={busy} disabled={!registration}>
              {textForLocale('Rejoindre cette équipe')}
            </Button>
          </form>
        )
      )}
      <div className="actions">
        <Link className="text-link" to="/equipes">
          {textForLocale('Toutes les équipes publiques')}
        </Link>
        {user && (
          <Link className="text-link" to="/ma-communaute">
            {textForLocale('Gérer mes participations')}
          </Link>
        )}
      </div>
    </Page>
  );
}

function ManageCommunity() {
  const { user } = useApp();
  const [data, setData] = useState<AccountCommunity>();
  const [registration, select] = useState('');
  const [invite, setInvite] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => setData(await api<AccountCommunity>('/community/me'));
  useEffect(() => {
    if (user) load().catch((e) => setError(e.message));
  }, [user]);
  const action = async (run: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await run();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!user)
    return (
      <Page title={textForLocale('Ma communauté')}>
        <Link className="button" to={accountUrl('/ma-communaute', 'sign-in')}>
          {textForLocale('Me connecter')}
        </Link>
      </Page>
    );
  return (
    <Page
      eyebrow={textForLocale('À votre façon')}
      title={textForLocale('Ma communauté')}
      className="community-page"
    >
      <div className="actions">
        <Link className="text-link" to="/espace">
          {textForLocale('Mon espace')}
        </Link>
        <Link className="text-link" to="/equipes">
          {textForLocale('Voir les équipes')}
        </Link>
      </div>
      {error && <Notice error>{error}</Notice>}
      {!data && !error && <p role="status">{textForLocale('Chargement…')}</p>}
      {data && data.registrations.length === 0 && (
        <p>
          {textForLocale(
            'Les options communautaires sont disponibles avec une participation confirmée.',
          )}
        </p>
      )}
      {data && data.registrations.length > 0 && (
        <>
          <section className="community-list">
            <h2>{textForLocale('Mes équipes')}</h2>
            {data.registrations.map((row) => (
              <article key={row.id}>
                <strong>
                  {row.first_name} · {row.team_name || textForLocale('Participation individuelle')}
                </strong>
                {row.team_id && (
                  <>
                    <p>
                      <Link to={'/equipes/' + row.team_id}>{textForLocale('Ouvrir l’équipe')}</Link>{' '}
                      · {labels[row.team_status || '']}
                    </p>
                    {row.can_show_first === 1 && (
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={row.show_first === 1}
                          disabled={busy}
                          onChange={(e) => {
                            const showFirst = e.target.checked;
                            void action(() => api('/team-members/' + row.id, { showFirst }, 'PUT'));
                          }}
                        />
                        {textForLocale(
                          'J’accepte que mon prénom soit affiché si cette équipe est publique',
                        )}
                      </label>
                    )}
                    <Button
                      type="button"
                      className="light"
                      disabled={busy}
                      onClick={() =>
                        void action(() => api('/team-members/' + row.id, {}, 'DELETE'))
                      }
                    >
                      {textForLocale('Quitter l’équipe')}
                    </Button>
                  </>
                )}
              </article>
            ))}
            {data.teams
              .filter(
                (team) =>
                  team.visibility === 'private' && ['pending', 'approved'].includes(team.status),
              )
              .map((team) => (
                <Button
                  key={team.id}
                  type="button"
                  className="outline"
                  busy={busy}
                  onClick={() =>
                    void action(async () => {
                      const result = await api('/teams/' + team.id + '/invitation', {});
                      setInvite(new URL(result.invite, location.origin).href);
                    })
                  }
                >
                  {textForLocale('Renouveler le lien privé · ')}
                  {team.name}
                </Button>
              ))}
            {invite && (
              <Field label={textForLocale('Lien privé à partager avec les membres invités')}>
                <input readOnly value={invite} onFocus={(e) => e.target.select()} />
              </Field>
            )}
          </section>
          {data.registrations.some((row) => !row.team_id) && (
            <form
              className="form-panel"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const values = new FormData(form);
                void action(async () => {
                  const result = await api('/teams', {
                    registrationId: registration,
                    ...Object.fromEntries(values),
                  });
                  if (result.invite) setInvite(new URL(result.invite, location.origin).href);
                  select('');
                  form.reset();
                });
              }}
            >
              <h2>{textForLocale('Créer une équipe')}</h2>
              <ParticipationPicker
                rows={data.registrations.filter((row) => !row.team_id)}
                value={registration}
                change={select}
              />
              <Field label={textForLocale('Nom de l’équipe')}>
                <input required name="name" minLength={2} maxLength={90} />
              </Field>
              <Field label={textForLocale('Description (facultative)')}>
                <textarea name="description" maxLength={600} />
              </Field>
              <Field label={textForLocale('Photo ou logo (adresse HTTPS facultative)')}>
                <input type="url" name="photo" />
              </Field>
              <Field label={textForLocale('Visibilité')}>
                <select name="visibility">
                  <option value="private">{textForLocale('Privée · par invitation')}</option>
                  <option value="public">{textForLocale('Publique après modération')}</option>
                </select>
              </Field>
              <Button busy={busy} disabled={!registration}>
                {textForLocale('Créer mon équipe')}
              </Button>
            </form>
          )}
          <ContributionForm
            kind="story"
            existing={data.posts.find((post) => post.kind === 'story')}
            action={action}
            busy={busy}
          />
          <ContributionForm
            kind="dedication"
            existing={data.posts.find((post) => post.kind === 'dedication')}
            action={action}
            busy={busy}
          />
        </>
      )}
    </Page>
  );
}

function ContributionForm({
  kind,
  existing,
  action,
  busy,
}: {
  kind: Kind;
  existing?: Post;
  action: (run: () => Promise<void>) => Promise<void>;
  busy: boolean;
}) {
  const story = kind === 'story';
  const [consent, setConsent] = useState(false);
  return (
    <form
      className="form-panel"
      onSubmit={(e) => {
        e.preventDefault();
        const submit = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'submit';
        const fields = Object.fromEntries(new FormData(e.currentTarget));
        void action(async () => {
          await api(
            '/community/contribution',
            { kind, ...fields, consent: submit && consent, submit },
            'PUT',
          );
          setConsent(false);
        });
      }}
    >
      <h2>
        {story
          ? textForLocale('Pourquoi je participe')
          : textForLocale('Pour qui fais-tu ces kilomètres?')}
      </h2>
      {existing && (
        <p>
          {textForLocale('Statut · ')}
          {labels[existing.status]}
        </p>
      )}
      {story && (
        <Field label={textForLocale('Titre facultatif')}>
          <input name="title" defaultValue={existing?.title} maxLength={120} />
        </Field>
      )}
      <Field
        label={story ? textForLocale('Votre histoire') : textForLocale('Votre dédicace')}
        hint={
          story
            ? textForLocale(
                'Le texte approuvé pourra être rendu public sur Ride For Brains. Évitez de partager des renseignements sensibles sur une autre personne.',
              )
            : textForLocale('Un prénom, un surnom ou une courte phrase suffit.')
        }
      >
        <textarea
          name="text"
          required
          defaultValue={existing?.text}
          maxLength={story ? 1800 : 160}
          rows={story ? 5 : 2}
        />
      </Field>
      {story && (
        <Field label={textForLocale('Photo facultative (adresse HTTPS)')}>
          <input type="url" name="photo" defaultValue={existing?.photo} />
        </Field>
      )}
      <label className="checkbox">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        {story
          ? textForLocale(
              'J’accepte que cette histoire et sa photo puissent être publiées après approbation.',
            )
          : textForLocale(
              'J’accepte que cette dédicace puisse apparaître publiquement sur Ride For Brains.',
            )}
      </label>
      <div className="actions">
        <Button value="draft" className="light" busy={busy}>
          {textForLocale('Enregistrer en privé')}
        </Button>
        <Button value="submit" busy={busy} disabled={!consent}>
          {textForLocale('Soumettre à la modération')}
        </Button>
        {existing && (
          <Button
            type="button"
            className="outline"
            disabled={busy}
            onClick={() => {
              setConsent(false);
              void action(() => api('/community/contribution/' + kind, {}, 'DELETE'));
            }}
          >
            {story ? textForLocale('Retirer mon histoire') : textForLocale('Masquer ma dédicace')}
          </Button>
        )}
      </div>
    </form>
  );
}

function PublicContributions({ kind }: { kind: Kind }) {
  const story = kind === 'story';
  const [posts, setPosts] = useState<Post[]>();
  const [error, setError] = useState('');
  useEffect(() => {
    api<Post[]>('/community/' + kind)
      .then(setPosts)
      .catch((e) => setError(e.message));
  }, [kind]);
  return (
    <Page
      eyebrow={textForLocale('Chaque kilomètre compte')}
      title={story ? textForLocale('Pourquoi je participe') : textForLocale('Pour eux')}
      className="community-page"
    >
      <p>
        {story
          ? textForLocale('Les histoires des personnes qui choisissent de prendre le départ.')
          : textForLocale('Les personnes et les causes qui nous donnent une raison d’avancer.')}
      </p>
      {error && <Notice error>{error}</Notice>}
      {!posts && !error && <p role="status">{textForLocale('Chargement…')}</p>}
      {posts?.length === 0 && (
        <p>
          {story
            ? textForLocale('Aucune histoire publiée pour le moment.')
            : textForLocale('Aucune dédicace publiée pour le moment.')}
        </p>
      )}
      <div className={story ? 'community-list' : 'dedication-wall'}>
        {posts?.map((post) =>
          story ? (
            <article key={post.id}>
              {post.title && <h2>{post.title}</h2>}
              {post.photo && (
                <img
                  src={post.photo}
                  alt={textForLocale('Photo associée à cette histoire')}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              )}
              <p className="prewrap">{post.text}</p>
            </article>
          ) : (
            <blockquote key={post.id}>{post.text}</blockquote>
          ),
        )}
      </div>
      <Link className="button outline" to="/ma-communaute">
        {story ? textForLocale('Proposer mon histoire') : textForLocale('Écrire une dédicace')}
      </Link>
    </Page>
  );
}
