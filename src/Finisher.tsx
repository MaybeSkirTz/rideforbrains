import { t as textForLocale } from './locale-copy';
import { currentLocale } from '../shared/locale';
import { lazy, Suspense, useEffect, useState } from 'react';
import { accountUrl } from '../shared/navigation';
import { sportLabel } from '../shared/registration';
import { api } from './api';
import { useApp } from './context';
import { Button, Link, Notice, Page } from './ui';
import './day-j.css';

const ShareCard = lazy(() => import('./ShareCard'));
type Certificate = {
  firstName: string;
  lastName: string;
  eventAt: string;
  activity: string;
  distance: string;
  sport: string;
};

export default function Finisher({ id }: { id: string }) {
  const { user } = useApp();
  const [certificate, setCertificate] = useState<Certificate>();
  const [error, setError] = useState('');
  const [share, setShare] = useState(false);
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    api<Certificate>('/finisher/' + id, {}, 'POST', { signal: controller.signal })
      .then(setCertificate)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [id, user]);
  return (
    <Page eyebrow="Ride For Brains" title={textForLocale('Mon souvenir')} className="finisher-page">
      {!user ? (
        <Link className="button" to={accountUrl('/souvenir/' + id, 'sign-in')}>
          {textForLocale('Me connecter')}
        </Link>
      ) : error ? (
        <Notice error>{error}</Notice>
      ) : !certificate ? (
        <p role="status">{textForLocale('Chargement…')}</p>
      ) : (
        <>
          <article className="finisher-certificate">
            <p className="eyebrow">RIDE FOR BRAINS</p>
            <h2>{textForLocale('J’y étais.')}</h2>
            <p className="finisher-name">
              {certificate.firstName} {certificate.lastName}
            </p>
            <p>
              {textForLocale('a participé à ')}
              {certificate.activity} · {certificate.distance}
            </p>
            <p>
              {new Date(certificate.eventAt).toLocaleDateString(currentLocale(), {
                dateStyle: 'long',
                timeZone: 'America/Toronto',
              })}
            </p>
            <p>{textForLocale('Pour eux, chaque kilomètre compte.')}</p>
          </article>
          <div className="actions finisher-actions">
            <Button type="button" onClick={() => window.print()}>
              {textForLocale('Imprimer / enregistrer en PDF')}
            </Button>
            <Button type="button" className="outline" onClick={() => setShare((shown) => !shown)}>
              {textForLocale('Ma carte souvenir')}
            </Button>
            <Link className="text-link" to="/mon-jour-j">
              {textForLocale('Mon jour J')}
            </Link>
          </div>
          {share && (
            <div className="finisher-actions">
              <Suspense fallback={<p>{textForLocale('Préparation…')}</p>}>
                <ShareCard
                  finisher
                  eventAt={certificate.eventAt}
                  participation={{
                    firstName: certificate.firstName,
                    lastInitial: Array.from(certificate.lastName.trim())[0] || '',
                    activity: sportLabel(certificate.sport),
                    distance: certificate.distance,
                  }}
                />
              </Suspense>
            </div>
          )}
        </>
      )}
    </Page>
  );
}
