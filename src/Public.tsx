import { ArrivalStory, SportMotionStory, TeamMotion, PreparationMotion } from './MotionStories';
import React, { useEffect, useState, lazy, Suspense } from 'react';
import { ArrowUpRight, ArrowRight, Plus, Download } from 'lucide-react';
import { useApp } from './context';
import { activityPriceLabel } from '../shared/registration';
import { Link, Page } from './ui';
import { money } from './api';
import { daysUntil, googleCalendarUrl, donationNotice, donationDestination } from '../shared/event';
import { editorial, published } from '../shared/editorial';
import { track } from './tracking';
import Scene from './Scene';
import PhotoAlbum from './PhotoAlbum';
import { participationPolicy, ageLabel } from '../shared/participation';
const RouteMap = lazy(() => import('./RouteMap'));
export const eventDate = (s: any) =>
  new Date(s.eventAt).toLocaleDateString('fr-CA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Toronto',
  });
const sports = [
  { id: 'velo', label: 'Vélo', verb: 'Rouler', number: '01' },
  { id: 'course', label: 'Course', verb: 'Courir', number: '02' },
  { id: 'marche', label: 'Marche', verb: 'Marcher', number: '03' },
];

export function CalendarLinks() {
  const { data } = useApp();
  return (
    <details className="calendar-choice">
      <summary>
        Ajouter à mon calendrier <Plus size={15} />
      </summary>
      <div>
        <a href="/calendrier.ics" download="Ride-For-Brains.ics">
          Télécharger le calendrier (.ics)
        </a>
        <a
          href={googleCalendarUrl(data.settings, location.origin)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Google Calendar <ArrowUpRight size={14} />
        </a>
      </div>
    </details>
  );
}
function Countdown() {
  const { data } = useApp();
  const [days, setDays] = useState(() => daysUntil(data.settings.eventAt));
  const past =
    new Date(data.settings.eventAt).toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }) <
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  useEffect(() => {
    const tick = setInterval(() => setDays(daysUntil(data.settings.eventAt)), 60000);
    return () => clearInterval(tick);
  }, [data.settings.eventAt]);
  return (
    <span className="countdown">
      <b>
        {past
          ? 'L’édition ' + new Date(data.settings.eventAt).getFullYear()
          : days
            ? 'J−' + days
            : 'Aujourd’hui'}
      </b>
      <span>
        {past
          ? 'Retrouvez notre histoire'
          : days
            ? 'avant de se retrouver'
            : 'Le jour du rendez-vous'}
      </span>
    </span>
  );
}
function FirstEdition() {
  const { data } = useApp();
  const e = editorial(data.settings).firstEdition;
  const photos = published<any>(data.settings.photos).filter(
    (p) => !p.section || p.section === 'edition' || p.section === 'moments',
  );
  if (!e.intro && !e.stats.length && !e.memories.length && !photos.length && !e.press.length)
    return null;
  return (
    <section className="first-edition editorial-section" id="premiere-edition">
      <div className="section-index">Souvenirs / Première édition</div>
      {e.year && <p className="edition-year">{e.year} · Première édition</p>}
      <div className="archive-heading">
        <h2>{e.title}</h2>
        {e.intro && <p>{e.intro}</p>}
      </div>
      {photos.length > 0 && <PhotoAlbum photos={photos} label="Les souvenirs de Ride For Brains" />}
      {e.memories.length > 0 && (
        <div className="archive-memories">
          {e.memories.map((text, i) => (
            <p key={i}>{text}</p>
          ))}
        </div>
      )}
      {e.stats.length > 0 && (
        <dl className="verified-stats">
          {e.stats.map((s, i) => (
            <div key={i}>
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {e.press.length > 0 && (
        <div className="press-links">
          <h3>Dans les médias</h3>
          {e.press.map((p) => (
            <a key={p.url} href={p.url} target="_blank" rel="noopener noreferrer">
              {p.title} <ArrowUpRight size={16} />
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
export function TeamMembers({ compact = false }: { compact?: boolean }) {
  const { data } = useApp();
  const team = editorial(data.settings).team.filter((m) => m.enabled);
  return (
    <div className={'people-editorial' + (compact ? ' compact' : '')}>
      {team.map((m, i) => (
        <article className="person-editorial" key={i}>
          {m.photo ? (
            <img
              src={m.photo}
              alt={m.name}
              width="600"
              height="720"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="person-graphic" aria-hidden="true">
              <span>0{i + 1}</span>
              <svg viewBox="0 0 240 240">
                <path
                  d={`M-20 ${150 - i * 15}C80 -10 30 260 160 80S270 110 270 200`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <circle
                  cx="120"
                  cy="120"
                  r={70 + i * 12}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth=".5"
                />
              </svg>
            </div>
          )}
          <p className="person-role">{m.role}</p>
          <h3>{m.name}</h3>
          {m.story && <p>{m.story}</p>}
          {m.quote && <blockquote>« {m.quote} »</blockquote>}
        </article>
      ))}
    </div>
  );
}
function IdentityPair() {
  return (
    <div className="identity-pair">
      <img
        className="ride-identity"
        src="/assets/ride-for-brains.png"
        width="110"
        height="110"
        alt="Ride For Brains, deuxième édition"
      />
      <span aria-hidden="true">+</span>
      <img
        className="canada-identity"
        src="/assets/brain-canada.png"
        width="280"
        height="82"
        alt="Fondation Brain Canada Foundation"
      />
    </div>
  );
}
export function SportRows() {
  const { data } = useApp();
  return (
    <div className="sport-editorial">
      {sports.map((g) => {
        const activities = data.activities.filter((a) => a.sport === g.id);
        if (!activities.length) return null;
        return (
          <Link key={g.id} to={'/' + g.id} className={'sport-row sport-' + g.id}>
            <span className="sport-index">{g.number}</span>
            <div className="sport-row-heading">
              <h3>{g.label}</h3>
              <span>{activities.map((a) => a.distance).join(' / ')}</span>
            </div>
            <div className="sport-mini-scene">
              <Scene mode={g.id as any} compact />
            </div>
            <span className="sport-row-price">{activityPriceLabel(activities)}</span>
            <ArrowUpRight className="sport-arrow" size={28} />
          </Link>
        );
      })}
    </div>
  );
}
export function Home() {
  const { data } = useApp();
  const s = data.settings,
    e = editorial(s);
  const memory = published<any>(s.photos).find((p) =>
    ['edition', 'depart', 'moments'].includes(p.section),
  );
  useEffect(() => track('home_view'), []);
  return (
    <>
      <section className="opening-story" data-neural-story>
        <div className="hero-dateline">
          <span>
            {s.edition} / {eventDate(s)}
          </span>
          <span>Vélo · Course · Marche</span>
        </div>
        <div className="opening-grid">
          <div className="opening-copy">
            <p className="editorial-kicker">Ride For Brains</p>
            <h1>
              {e.heroTitle.split('\n').map((line, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <br />}
                  {i === 1 ? <em>{line}</em> : line}
                </React.Fragment>
              ))}
            </h1>
            {e.heroIntro.length <= 240 && <p className="opening-intro">{e.heroIntro}</p>}
            <p className="hero-essentials">
              <strong>{activityPriceLabel(data.activities)}</strong>
              <span>
                par activité · Vélo 18+
                <br />
                Course et marche : tous les âges, accord parental avant 18 ans
              </span>
            </p>
            <div className="actions">
              <Link to="/activites" className="button">
                Choisir mon activité <ArrowUpRight size={18} />
              </Link>
              <a
                className="text-link"
                href={s.donationUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Soutenir la collecte Ride For Brains <ArrowUpRight size={16} />
              </a>
            </div>
            {e.heroIntro.length > 240 && (
              <details className="hero-introduction">
                <summary>L’esprit de l’événement</summary>
                <p className="opening-intro">{e.heroIntro}</p>
              </details>
            )}
            <div className="opening-bottom">
              <Countdown />
              <CalendarLinks />
            </div>
            {memory && (
              <figure className="hero-memory">
                <img
                  src={memory.url}
                  alt={memory.alt}
                  width="640"
                  height="360"
                  loading="lazy"
                  decoding="async"
                />
                <figcaption>
                  <Link to="/equipe">Découvrir la première édition</Link>
                </figcaption>
              </figure>
            )}
          </div>
          <div className="opening-visual">
            <div className="neural-coordinate" aria-hidden="true">
              RFB / Connexions en mouvement
            </div>
            <Scene />
            <div className="visual-caption">
              <Link to="/cause">Comprendre la cause ↗</Link>
              <span>Vélo / Course / Marche</span>
            </div>
          </div>
        </div>
      </section>
      <section className="editorial-section activities-narrative" id="activites">
        <div className="editorial-heading">
          <div>
            <p className="section-index">Trois façons de participer</p>
            <h2>À chacun son mouvement.</h2>
          </div>
          <Link to="/participants" className="text-link">
            Voir qui prend le départ <ArrowRight size={17} />
          </Link>
        </div>
        <SportRows />
      </section>
      <section className="home-practical">
        <div>
          <span>Le rendez-vous</span>
          <strong>{eventDate(s)}</strong>
        </div>
        <div>
          <span>Accueil dès</span>
          <strong>{s.reception.replace(':', ' h ')}</strong>
        </div>
        {s.location && (
          <div>
            <span>Lieu</span>
            <strong>{s.location}</strong>
          </div>
        )}
        <Link to="/infos" className="text-link">
          Préparer ma journée <ArrowRight size={17} />
        </Link>
      </section>
    </>
  );
}

export function Activities({ sport, selected }: { sport?: string | null; selected?: string }) {
  const { data } = useApp();
  const focus = selected ? data.activities.find((a) => a.id === selected) : null;
  const kind = focus?.sport || sport;
  const group = sports.find((g) => g.id === kind);
  useEffect(() => {
    if (focus) track('activity_view', focus.id);
  }, [focus?.id]);
  return (
    <Page
      className="activities-page"
      eyebrow={focus ? group?.label : 'Vélo, course et marche'}
      title={
        focus
          ? group?.label + ' · ' + focus.distance
          : group
            ? group.verb + '. À votre façon.'
            : 'Choisissez votre mouvement.'
      }
      intro={eventDate(data.settings) + ' · ' + (kind ? ageLabel(kind) : participationPolicy)}
    >
      {kind && (
        <div className="sport-page-scene">
          <Scene mode={kind as any} />
        </div>
      )}
      <nav className="activity-tabs" aria-label="Choisir un sport">
        {[
          ['/activites', 'Toutes les activités'],
          ['/velo', 'Vélo'],
          ['/course', 'Course'],
          ['/marche', 'Marche'],
        ].map(([url, label]) => (
          <Link
            to={url}
            key={url}
            aria-current={
              (!kind && url === '/activites') || url === '/' + kind ? 'page' : undefined
            }
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="activity-ledger">
        {data.activities
          .filter((a) => (focus ? a.id === focus.id : !kind || a.sport === kind))
          .map((a, i) => {
            const full = a.capacity !== null && a.occupied >= a.capacity;
            return (
              <article key={a.id} className="activity-ledger-row">
                <span className="ledger-number">0{i + 1}</span>
                <div>
                  <p className="activity-kind">{sports.find((g) => g.id === a.sport)?.label}</p>
                  <h2>{a.distance}</h2>
                  <h3>{a.name}</h3>
                  {a.capacity !== null && (
                    <p className="small">
                      {Math.max(0, a.capacity - a.occupied)} place(s) disponible(s)
                    </p>
                  )}
                  {a.capacity === null && data.settings.registrationOpen && (
                    <p className="small">Inscriptions ouvertes</p>
                  )}
                </div>
                <div className="activity-ledger-actions">
                  <strong>{money(a.price)}</strong>
                  <span className="small">par personne et par activité</span>
                  <Link
                    className="button"
                    to={(full ? '/attente' : '/inscription') + '?activite=' + a.id}
                  >
                    {full ? 'Rejoindre la liste d’attente' : 'S’inscrire'}{' '}
                    <ArrowUpRight size={17} />
                  </Link>
                  <Link className="text-link" to={'/participants?activite=' + a.id}>
                    Voir les participants <ArrowRight size={15} />
                  </Link>
                  {!focus && (
                    <Link className="text-link" to={'/activites/' + a.id}>
                      Voir cette activité <ArrowRight size={15} />
                    </Link>
                  )}
                </div>
                {focus && (
                  <div className="activity-detail">
                    <h3>Le parcours</h3>
                    {a.route.description ? (
                      <p>{a.route.description}</p>
                    ) : !a.route.coordinates?.length && !a.route.mapUrl ? (
                      <p>Parcours à venir.</p>
                    ) : null}
                    <dl className="route-facts">
                      {a.route.departure && (
                        <div>
                          <dt>Départ</dt>
                          <dd>{a.route.departure.replace(':', ' h ')}</dd>
                        </div>
                      )}
                      {a.route.elevationGain != null && (
                        <div>
                          <dt>Dénivelé positif</dt>
                          <dd>{a.route.elevationGain} m</dd>
                        </div>
                      )}
                      {a.route.startLabel && (
                        <div>
                          <dt>Point de départ</dt>
                          <dd>{a.route.startLabel}</dd>
                        </div>
                      )}
                      {a.route.finishLabel && (
                        <div>
                          <dt>Arrivée</dt>
                          <dd>{a.route.finishLabel}</dd>
                        </div>
                      )}
                    </dl>
                    {a.route.coordinates?.length > 1 && (
                      <Suspense fallback={<p>Chargement du tracé…</p>}>
                        <RouteMap route={a.route} name={a.name} />
                      </Suspense>
                    )}
                    <div className="actions">
                      {a.route.mapUrl && (
                        <a
                          className="text-link"
                          href={a.route.mapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Consulter la carte <ArrowUpRight size={16} />
                        </a>
                      )}
                      {a.route.gpxUrl && (
                        <a
                          className="text-link"
                          href={a.route.gpxUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Télécharger le GPX <Download size={16} />
                        </a>
                      )}
                    </div>
                    {published<any>(data.settings.photos).some((p) => p.section === a.sport) && (
                      <PhotoAlbum
                        photos={published<any>(data.settings.photos).filter(
                          (p) => p.section === a.sport,
                        )}
                        label={'Photos de ' + group?.label}
                      />
                    )}
                  </div>
                )}
              </article>
            );
          })}
      </div>
      {kind && <SportMotionStory sport={kind} />}
      <p className="fee-disclosure">{donationNotice}</p>
      <CalendarLinks />
    </Page>
  );
}
export function Practical() {
  const { data } = useApp();
  const s = data.settings,
    e = editorial(s);
  return (
    <Page
      className="practical-page"
      eyebrow="Préparer sa journée"
      title="Les repères du départ."
      intro="Les renseignements confirmés sont réunis ici. Le reste sera ajouté à mesure que l’organisation se précise."
    >
      <dl className="practical-ledger">
        <div>
          <dt>Date</dt>
          <dd>{eventDate(s)}</dd>
        </div>
        <div>
          <dt>Accueil</dt>
          <dd>
            {s.reception.replace(':', ' h ')}
            {s.closing ? ' — ' + s.closing : ''}
          </dd>
        </div>
        {s.location && (
          <div>
            <dt>Lieu de départ</dt>
            <dd>{s.location}</dd>
          </div>
        )}
        {e.practical.find((p) => p.id === 'departs' && p.enabled && p.body) && (
          <div>
            <dt>Départs des activités</dt>
            <dd>{e.practical.find((p) => p.id === 'departs' && p.enabled)?.body}</dd>
          </div>
        )}
      </dl>
      <CalendarLinks />
      <div className="practical-content">
        {e.practical
          .filter((p) => p.enabled && p.body && p.id !== 'departs')
          .map((p) => (
            <section key={p.id}>
              <h2>{p.title}</h2>
              <p className="prewrap">{p.body}</p>
            </section>
          ))}
        <section>
          <h2>Les parcours</h2>
          {data.activities.map((a) => (
            <article className="practical-route" key={a.id}>
              <h3>
                {sports.find((g) => g.id === a.sport)?.label} · {a.distance}
              </h3>
              <p>
                {a.route.description ||
                  (a.route.coordinates?.length > 1 || a.route.mapUrl || a.route.gpxUrl
                    ? 'Parcours disponible.'
                    : 'Parcours à venir.')}
              </p>
              {a.route.supplies?.length > 0 && (
                <p>Ravitaillements : {a.route.supplies.join(' · ')}</p>
              )}
              <Link to={'/activites/' + a.id} className="text-link">
                {a.route.coordinates?.length > 1 || a.route.mapUrl
                  ? 'Voir la carte du parcours'
                  : 'Informations sur cette activité'}{' '}
                <ArrowRight size={15} />
              </Link>
            </article>
          ))}
        </section>
        <section>
          <h2>Votre billet</h2>
          <p>
            Votre billet sera disponible dans votre espace après confirmation du paiement. Présentez
            son code QR à l’accueil.
          </p>
        </section>
      </div>
      <Link to="/faq" className="text-link">
        D’autres questions ? <ArrowRight size={16} />
      </Link>
      <ArrivalStory />
      <PreparationMotion />
    </Page>
  );
}
export function Team() {
  const { data } = useApp();
  return (
    <Page
      className="team-page"
      eyebrow="L’équipe"
      title="Derrière la ligne de départ."
      intro={data.settings.story}
    >
      <TeamMotion />
      <TeamMembers />
      <FirstEdition />
      {published(editorial(data.settings).media).length > 0 && (
        <section className="media-coverage">
          <h2>Ils parlent de Ride For Brains</h2>
          {published(editorial(data.settings).media).map((m, i) => (
            <article key={i}>
              {m.logo && <img src={m.logo} alt={m.name} width="160" height="80" loading="lazy" />}
              <div>
                <p>
                  {m.name}
                  {m.date ? ' · ' + m.date : ''}
                </p>
                <h3>
                  <a href={m.url} target="_blank" rel="noopener noreferrer">
                    {m.title}
                  </a>
                </h3>
                {m.quote && <blockquote>« {m.quote} »</blockquote>}
              </div>
            </article>
          ))}
        </section>
      )}
      <PhotoAlbum
        photos={published<any>(data.settings.photos).filter(
          (p) => p.section === 'depart' || p.section === 'arrivee',
        )}
        label="Le départ et l’arrivée en images"
      />
      <div className="actions">
        <Link to="/contact" className="button">
          Nous écrire <ArrowUpRight size={17} />
        </Link>
        <Link to="/benevolat" className="text-link">
          Donner un coup de main <ArrowRight size={17} />
        </Link>
      </div>
      <PhotoAlbum
        photos={published<any>(data.settings.photos).filter((p) => p.section === 'equipe')}
        label="L’équipe en images"
      />
    </Page>
  );
}
export function Cause() {
  const { data } = useApp();
  return (
    <Page
      className="cause-page"
      eyebrow="La cause"
      title="Le mouvement, pour la recherche."
      intro={data.settings.cause}
    >
      <IdentityPair />
      <div className="cause-story">
        <div>
          <Scene mode="cortex" />
          <p className="small">
            Les connexions du cerveau : le lien avec la recherche que soutient la collecte
            officielle.
          </p>
        </div>
        <div>
          <h2>Deux gestes distincts.</h2>
          <p>{donationNotice}</p>
          <a
            href={data.settings.donationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="button"
          >
            Faire un don sur Brain Canada <ArrowUpRight size={18} />
          </a>
        </div>
      </div>
    </Page>
  );
}
export function FAQ() {
  const { data } = useApp();
  return (
    <Page eyebrow="Les réponses utiles" title="Avant de prendre le départ.">
      <div className="faq editorial-faq">
        {published<any>(data.settings.faq).map((f, i) => (
          <details key={i}>
            <summary>
              <span className="question-number">{String(i + 1).padStart(2, '0')}</span>
              {f.q}
              <Plus size={18} />
            </summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
      <Link to="/contact" className="text-link">
        Une autre question ? Écrivez-nous <ArrowRight size={16} />
      </Link>
    </Page>
  );
}
