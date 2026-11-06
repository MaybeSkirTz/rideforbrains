import { t as textForLocale } from './locale-copy';
import React, { useEffect, useState } from 'react';
import { useApp } from './context';
import { api } from './api';
import { Page, Field, Notice, Link, Button } from './ui';
import { publicListingText } from '../shared/public-participants';
export function PublicParticipants() {
  const { data } = useApp();
  const selected = new URLSearchParams(location.search).get('activite');
  const [activity, setActivity] = useState(
      data.activities.find((a: any) => a.id === selected)?.id || data.activities[0]?.id || '',
    ),
    [page, setPage] = useState(1),
    [result, setResult] = useState<any>(null),
    [names, setNames] = useState<any[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    if (!activity) return;
    let current = true;
    setLoading(true);
    setError('');
    api('/participants?' + new URLSearchParams({ activity, page: String(page) }))
      .then((r) => {
        if (current) {
          setResult(r);
          setNames((old) => (page === 1 ? r.participants : [...old, ...r.participants]));
        }
      })
      .catch((e) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [activity, page]);
  return (
    <Page
      className="public-participants"
      eyebrow={textForLocale('On prend le départ ensemble')}
      title={textForLocale('Qui sera de la partie ?')}
      intro={textForLocale('Découvrez les participations confirmées, activité par activité.')}
    >
      <Field label={textForLocale('Choisir une activité')}>
        <select
          value={activity}
          onChange={(e) => {
            setActivity(e.target.value);
            setPage(1);
            setResult(null);
            setNames([]);
          }}
        >
          {data.activities.map((a: any) => (
            <option value={a.id} key={a.id}>
              {a.name} · {a.distance}
            </option>
          ))}
        </select>
      </Field>
      <p className="small">
        {textForLocale(
          'Les noms apparaissent uniquement avec l’accord du participant ou du parent. Nous affichons le prénom et l’initiale du nom.',
        )}
      </p>
      {error && <Notice error>{error}</Notice>}
      {result && (
        <section
          className="roster-panel"
          aria-label={textForLocale('Participants — ') + result.activity.name}
        >
          <div className="roster-heading">
            <div>
              <p className="eyebrow">
                {result.activity.sport} · {result.activity.distance}
              </p>
              <h2>{result.activity.name}</h2>
            </div>
            <p>
              <strong>{result.total}</strong>
              <span>
                {' '}
                {textForLocale('participation')}
                {result.total > 1 ? 's' : ''}
                {textForLocale(' confirmée')}
                {result.total > 1 ? 's' : ''}
              </span>
            </p>
          </div>
          <p className="small">
            {result.listed}
            {textForLocale(' nom')}
            {result.listed > 1 ? 's' : ''}
            {textForLocale(' affiché')}
            {result.listed > 1 ? 's' : ''} {textForLocale('avec accord.')}
          </p>
          {!!names.length && (
            <ul className="roster-names">
              {names.map((p, i) => (
                <li key={i}>{p.displayName}</li>
              ))}
            </ul>
          )}
          {!names.length && (
            <p>
              {result.total
                ? textForLocale(
                    'Les noms restent privés tant que leur affichage n’a pas été autorisé.',
                  )
                : textForLocale(
                    'Le départ se prépare. Aucune participation confirmée pour le moment.',
                  )}
            </p>
          )}
          {result.hasMore && (
            <Button type="button" busy={loading} onClick={() => setPage((p) => p + 1)}>
              {textForLocale('Voir plus de participants')}
            </Button>
          )}
        </section>
      )}
      {loading && !result && <p role="status">{textForLocale('Chargement des participants…')}</p>}
      <div className="actions">
        <Link className="button" to={'/inscription?activite=' + activity}>
          {textForLocale('Je participe aussi')}
        </Link>
      </div>
    </Page>
  );
}
export function ListingPreference({
  registration: r,
  onSaved,
}: {
  registration: any;
  onSaved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const change = async (value: boolean) => {
    setBusy(true);
    setError('');
    try {
      await api(
        '/registrations/' + r.id + '/public-listing',
        { publicListing: value, confirm: true },
        'PATCH',
      );
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="listing-preference">
      <p className="small">
        {textForLocale('Liste publique : ')}
        {r.public_listing ? 'prénom et initiale du nom affichés' : 'nom privé'}.
      </p>
      {r.public_listing ? (
        <Button type="button" className="outline" busy={busy} onClick={() => change(false)}>
          {textForLocale('Retirer mon nom de la liste publique')}
        </Button>
      ) : !r.is_minor ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            change(true);
          }}
        >
          <label className="checkbox">
            <input type="checkbox" required />
            {publicListingText}
          </label>
          <Button busy={busy}>{textForLocale('Afficher mon nom dans la liste')}</Button>
        </form>
      ) : (
        <p className="small">
          {textForLocale(
            'L’affichage d’un mineur doit être autorisé par le parent pendant l’inscription.',
          )}
        </p>
      )}
      {error && <Notice error>{error}</Notice>}
    </div>
  );
}
