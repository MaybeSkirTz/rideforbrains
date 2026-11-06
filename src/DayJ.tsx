import { t as textForLocale } from './locale-copy';
import { lazy, Suspense, useEffect, useState } from 'react';
import { CalendarDays, Check, Circle, MapPin, Ticket } from 'lucide-react';
import { dayJPhase, dayJTextFields, type DayJ as DayJData, type DayJStep } from '../shared/day-j';
import { calendarICS, daysUntil } from '../shared/event';
import { accountUrl } from '../shared/navigation';
import { sportLabel } from '../shared/registration';
import { currentLocale } from '../shared/locale';
import { api } from './api';
import { useApp } from './context';
import { Button, Field, Link, Notice, Page } from './ui';
import Invite from './Invite';
import './day-j.css';
const ShareCard = lazy(() => import('./ShareCard'));

const stepLabels: Record<DayJStep, string> = {
  calendar: textForLocale('Calendrier ajouté'),
  route: textForLocale('Parcours consulté'),
  instructions: textForLocale('Consignes lues'),
  equipment: textForLocale('Matériel préparé'),
};
const time = (value: string) => (currentLocale() === 'en-CA' ? value : value.replace(':', ' h '));

export default function DayJ() {
  const { user } = useApp();
  const [data, setData] = useState<DayJData>();
  const [selected, select] = useState(
    new URLSearchParams(location.search).get('participation') || '',
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    api<DayJData>('/day-j', undefined, 'GET', { signal: controller.signal })
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    const timer = setInterval(() => setClock(new Date()), 60000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [user]);

  if (!user)
    return (
      <Page eyebrow={textForLocale('Votre préparation')} title={textForLocale('Mon jour J')}>
        <Link className="button" to={accountUrl(location.pathname + location.search, 'sign-in')}>
          {textForLocale('Me connecter')}
        </Link>
      </Page>
    );
  if (!data)
    return (
      <Page title={textForLocale('Mon jour J')}>
        {error ? (
          <Notice error>{error}</Notice>
        ) : (
          <p role="status">{textForLocale('Chargement…')}</p>
        )}
      </Page>
    );
  const entry = data.entries.find((item) => item.id === selected) || data.entries[0];
  if (!entry)
    return (
      <Page eyebrow={textForLocale('Votre préparation')} title={textForLocale('Mon jour J')}>
        <p>{textForLocale('Vos activités apparaîtront ici après votre inscription.')}</p>
        <Link className="button" to="/activites">
          {textForLocale('Découvrir les activités')}
        </Link>
      </Page>
    );

  const { event } = data;
  const phase = dayJPhase(event.date, clock);
  const locale = currentLocale();
  const days = daysUntil(event.eventAt, clock);
  const eventDate = new Date(event.eventAt).toLocaleDateString(locale, {
    dateStyle: 'long',
    timeZone: 'America/Toronto',
  });
  const saveStep = async (step: DayJStep, done: boolean) => {
    setBusy(true);
    setError('');
    try {
      await api('/day-j/' + entry.id + '/progress', { step, done }, 'PUT');
      setData(
        (current) =>
          current && {
            ...current,
            entries: current.entries.map((item) =>
              item.id !== entry.id
                ? item
                : {
                    ...item,
                    progress: done
                      ? [...new Set([...item.progress, step])]
                      : item.progress.filter((s) => s !== step),
                  },
            ),
          },
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const calendar = () => {
    const file = URL.createObjectURL(
      new Blob([calendarICS(event, location.origin)], { type: 'text/calendar;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = file;
    link.download = 'Ride-For-Brains.ics';
    link.click();
    setTimeout(() => URL.revokeObjectURL(file), 60000);
  };
  const facts = [
    [textForLocale('Inscription confirmée'), entry.confirmed],
    [
      entry.payment === 'free'
        ? textForLocale('Inscription gratuite')
        : textForLocale('Paiement confirmé'),
      entry.payment !== 'pending',
    ],
    [textForLocale('Billet prêt'), entry.ticketReady],
    [textForLocale('Consentements complétés'), entry.consentsComplete],
  ] as const;
  const steps: DayJStep[] = [
    'calendar',
    ...(entry.routePath ? ['route' as const] : []),
    ...(event.details.instructions ? ['instructions' as const] : []),
    'equipment',
  ];
  return (
    <Page
      eyebrow={event.title + ' · ' + eventDate}
      title={textForLocale('Mon jour J')}
      className="day-j"
    >
      <div className="day-j-summary">
        <p className="eyebrow">
          {phase === 'today'
            ? textForLocale('C’est aujourd’hui')
            : phase === 'after'
              ? textForLocale('L’événement est passé')
              : locale === 'en-CA'
                ? `In ${days} ${days === 1 ? 'day' : 'days'}`
                : `Dans ${days} ${days === 1 ? 'jour' : 'jours'}`}
        </p>
        <h2>
          {textForLocale(sportLabel(entry.activity.sport))} · {entry.activity.distance}
        </h2>
        <p>
          {entry.activity.name} · {entry.firstName}
        </p>
        {data.entries.length > 1 && (
          <Field label={textForLocale('Participation')}>
            <select value={entry.id} onChange={(e) => select(e.target.value)}>
              {data.entries.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.firstName} · {item.activity.name} · {item.activity.distance}
                </option>
              ))}
            </select>
          </Field>
        )}
        {event.details.state && <Notice>{event.details.state}</Notice>}
        <div className="actions">
          {entry.ticketReady && (
            <Link className="button" to={'/billet/' + entry.id}>
              {textForLocale('Afficher mon QR ')}
              <Ticket size={18} />
            </Link>
          )}
          {entry.routePath && (
            <Link className="button outline" to={entry.routePath}>
              {textForLocale('Voir mon parcours ')}
              <MapPin size={18} />
            </Link>
          )}
          <Link className="text-link" to="/espace">
            {textForLocale('Mon espace')}
          </Link>
          {entry.finisherReady && (
            <Link className="button" to={'/souvenir/' + entry.id}>
              {textForLocale('Voir mon souvenir')}
            </Link>
          )}
        </div>
      </div>
      {error && <Notice error>{error}</Notice>}
      {data.messages?.some((message) => message.registration_id === entry.id) && (
        <section className="day-j-notices">
          <h2>{textForLocale('Avis importants')}</h2>
          {data.messages
            .filter((message) => message.registration_id === entry.id)
            .map((message) => (
              <details key={message.id} open={phase === 'today'}>
                <summary>{message.subject}</summary>
                <p className="prewrap">{message.body}</p>
              </details>
            ))}
        </section>
      )}
      <div className={'day-j-grid' + (phase === 'today' ? ' today' : '')}>
        <section className="day-j-preparation">
          <h2>
            {phase === 'today' ? textForLocale('Votre dossier') : textForLocale('Ma préparation')}
          </h2>
          <ul className="day-j-facts">
            {facts.map(([label, done]) => (
              <li key={label}>
                {done ? (
                  <Check size={18} aria-label={textForLocale('Complété')} />
                ) : (
                  <Circle size={18} aria-label={textForLocale('En attente')} />
                )}
                {label}
              </li>
            ))}
          </ul>
          {phase === 'before' && (
            <>
              <Button className="outline" onClick={calendar}>
                {textForLocale('Ajouter au calendrier ')}
                <CalendarDays size={18} />
              </Button>
              <fieldset className="day-j-personal">
                <legend>{textForLocale('Mes préparatifs personnels')}</legend>
                {steps.map((step) => (
                  <label className="checkbox" key={step}>
                    <input
                      type="checkbox"
                      checked={entry.progress.includes(step)}
                      disabled={busy}
                      onChange={(e) => void saveStep(step, e.target.checked)}
                    />
                    {stepLabels[step]}
                  </label>
                ))}
              </fieldset>
            </>
          )}
        </section>
        <section className="day-j-details">
          <h2>{textForLocale('Vos repères')}</h2>
          <dl>
            {[
              [textForLocale('Arrivée recommandée'), entry.arrival && time(entry.arrival)],
              [textForLocale('Ouverture de l’accueil'), event.reception && time(event.reception)],
              [textForLocale('Départ de votre activité'), entry.departure && time(entry.departure)],
              [textForLocale('Lieu'), event.location],
              [textForLocale('Point de départ'), entry.start],
              ...Object.entries(dayJTextFields).map(([key, label]) => [
                textForLocale(label),
                event.details[key as keyof typeof dayJTextFields],
              ]),
              [textForLocale('Ravitaillements'), entry.supplies.join(' · ')],
            ]
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd className="prewrap">{value}</dd>
                </div>
              ))}
          </dl>
        </section>
      </div>
      {phase === 'before' && entry.confirmed && <Invite />}
      {phase === 'before' && entry.confirmed && (
        <section className="day-j-share">
          <Button type="button" className="outline" onClick={() => setShowCard((shown) => !shown)}>
            {showCard
              ? textForLocale('Replier ma carte')
              : textForLocale('Créer ma carte de partage')}
          </Button>
          {showCard && (
            <Suspense fallback={<p>{textForLocale('Préparation de la carte…')}</p>}>
              <ShareCard
                key={entry.id}
                eventAt={event.eventAt}
                participation={{
                  firstName: entry.firstName,
                  lastInitial: entry.lastInitial,
                  activity: textForLocale(sportLabel(entry.activity.sport)),
                  distance: entry.activity.distance,
                }}
              />
            </Suspense>
          )}
        </section>
      )}
    </Page>
  );
}
