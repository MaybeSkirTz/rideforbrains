import { useEffect, useState } from 'react';
import { api } from './api';
import { Button, Notice } from './ui';

export default function CommunityAdmin() {
  const [teams, setTeams] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [members, setMembers] = useState<Record<string, any[]>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const [nextTeams, nextPosts] = await Promise.all([
      api('/admin/community/teams'),
      api('/admin/community/posts'),
    ]);
    setTeams(nextTeams);
    setPosts(nextPosts);
  };
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  const moderate = async (path: string, update: object) => {
    setError('');
    setBusy(true);
    try {
      await api(path, update, 'PUT');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <h2>Modération communautaire</h2>
      {error && <Notice error>{error}</Notice>}
      <section className="admin-section">
        <h3>Équipes</h3>
        {!teams.length && <p>Aucune équipe.</p>}
        {teams.map((team) => (
          <details className="mail-row" key={team.id}>
            <summary>
              {team.name} · {team.visibility === 'public' ? 'Publique' : 'Privée'} · {team.status}
            </summary>
            <p>
              {team.owner} · {team.members} participation(s)
            </p>
            <p className="prewrap">{team.description}</p>
            {team.photo && (
              <a className="text-link" href={team.photo} target="_blank" rel="noopener noreferrer">
                Vérifier le logo proposé
              </a>
            )}
            <div className="actions">
              <Button
                type="button"
                className="light"
                disabled={busy}
                onClick={() =>
                  api('/admin/community/teams/' + team.id + '/members')
                    .then((list) => setMembers((current) => ({ ...current, [team.id]: list })))
                    .catch((e) => setError(e.message))
                }
              >
                Voir les membres
              </Button>
              <Button
                type="button"
                busy={busy}
                onClick={() =>
                  moderate('/admin/community/teams/' + team.id, { status: 'approved' })
                }
              >
                Approuver l’équipe
              </Button>
              <Button
                type="button"
                className="light"
                disabled={busy}
                onClick={() =>
                  moderate('/admin/community/teams/' + team.id, { status: 'rejected' })
                }
              >
                Refuser l’équipe
              </Button>
              <Button
                type="button"
                className="light"
                disabled={busy}
                onClick={() => moderate('/admin/community/teams/' + team.id, { status: 'hidden' })}
              >
                Masquer l’équipe
              </Button>
            </div>
            {members[team.id] && (
              <ul>
                {members[team.id].map((member) => (
                  <li key={member.registration_id}>
                    {member.first_name} {member.last_name} · {member.activity_id}
                  </li>
                ))}
              </ul>
            )}
          </details>
        ))}
      </section>
      {(['story', 'dedication'] as const).map((kind) => (
        <section className="admin-section" key={kind}>
          <h3>{kind === 'story' ? 'Histoires' : 'Dédicaces'}</h3>
          {!posts.some((post) => post.kind === kind) && <p>Aucune contribution soumise.</p>}
          {posts
            .filter((post) => post.kind === kind)
            .map((post) => (
              <details className="mail-row" key={post.id}>
                <summary>
                  {post.title || post.text.slice(0, 75)} · {post.status}
                </summary>
                <p className="prewrap">{post.text}</p>
                {post.photo && (
                  <a
                    className="text-link"
                    href={post.photo}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Vérifier la photo proposée
                  </a>
                )}
                <div className="actions">
                  <Button
                    type="button"
                    busy={busy}
                    onClick={() =>
                      moderate('/admin/community/posts/' + post.id, {
                        revision: post.revision,
                        status: 'approved',
                      })
                    }
                  >
                    Approuver et publier
                  </Button>
                  <Button
                    type="button"
                    className="light"
                    disabled={busy}
                    onClick={() =>
                      moderate('/admin/community/posts/' + post.id, {
                        revision: post.revision,
                        status: 'rejected',
                      })
                    }
                  >
                    Refuser
                  </Button>
                  <Button
                    type="button"
                    className="light"
                    disabled={busy}
                    onClick={() =>
                      moderate('/admin/community/posts/' + post.id, {
                        revision: post.revision,
                        status: kind === 'story' ? 'archived' : 'hidden',
                      })
                    }
                  >
                    {kind === 'story' ? 'Archiver' : 'Masquer'}
                  </Button>
                </div>
              </details>
            ))}
        </section>
      ))}
    </>
  );
}
