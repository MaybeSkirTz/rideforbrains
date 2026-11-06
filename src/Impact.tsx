import { t as textForLocale } from './locale-copy';
import { useEffect, useState } from 'react';
import { impactLabels } from '../shared/impact';
import { donationDestination } from '../shared/event';
import { currentLocale } from '../shared/locale';
import { useApp } from './context';
import { api } from './api';
import { Link, Notice, Page } from './ui';
import './community.css';

export function PublicImpact({ embedded = false }: { embedded?: boolean }) {
  const [counts, setCounts] = useState<Partial<Record<keyof typeof impactLabels, number>>>();
  const [error, setError] = useState('');
  useEffect(() => {
    api('/impact')
      .then(setCounts)
      .catch((e) => setError(e.message));
  }, []);
  const counters = Object.entries(impactLabels).filter(
    ([key]) => counts?.[key as keyof typeof impactLabels] !== undefined,
  );
  const metrics = (
    <dl className="public-impact">
      {counters.map(([key, label]) => (
        <div key={key}>
          <dt>{textForLocale(label)}</dt>
          <dd>
            {new Intl.NumberFormat(currentLocale()).format(
              counts![key as keyof typeof impactLabels]!,
            )}
            {key === 'km' ? ' km' : ''}
          </dd>
        </div>
      ))}
    </dl>
  );
  if (embedded)
    return counters.length ? (
      <section className="public-impact-section">
        <h2>{textForLocale('Nos défis s’additionnent')}</h2>
        {metrics}
      </section>
    ) : null;
  return (
    <Page eyebrow={textForLocale('Un défi collectif')} title={textForLocale('Notre impact')}>
      {error && <Notice error>{error}</Notice>}
      {!counts && !error && <p role="status">{textForLocale('Chargement…')}</p>}
      {counts && !counters.length && (
        <p>
          {textForLocale(
            'Les compteurs apparaîtront lorsque l’organisation décidera de les publier.',
          )}
        </p>
      )}
      {metrics}
      <Link className="text-link" to="/ou-va-mon-argent">
        {textForLocale('Où va mon argent?')}
      </Link>
    </Page>
  );
}

export default function Transparency() {
  const { data } = useApp();
  const info = data.settings.financialTransparency;
  return (
    <Page
      eyebrow={textForLocale('Transparence')}
      title={info?.title || textForLocale('Où va mon argent?')}
      intro={info?.introduction}
      className="community-page"
    >
      <section className="community-list">
        <h2>{textForLocale('Frais d’inscription')}</h2>
        <p>
          {textForLocale(
            'Les frais d’inscription servent à l’organisation et à la tenue de Ride For Brains. Ils ne constituent pas un don à Brain Canada.',
          )}
        </p>
        {info?.categories?.map((row: any, index: number) => (
          <article key={index}>
            <h3>{row.name}</h3>
            {row.description && <p className="prewrap">{row.description}</p>}
          </article>
        ))}
      </section>
      <section className="community-list">
        <h2>{textForLocale('Don à Brain Canada')}</h2>
        <p>{textForLocale(donationDestination)}</p>
        <a
          className="button"
          href={data.settings.donationUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {textForLocale('Faire un don à Brain Canada')}
        </a>
      </section>
    </Page>
  );
}
