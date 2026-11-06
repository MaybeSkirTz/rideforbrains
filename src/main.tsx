import { t as textForLocale } from './locale-copy';
import MotionToggle from './MotionToggle';
import DevAudit from './DevAudit';
import React, {
  useEffect,
  useState,
  useRef,
  lazy,
  Suspense,
  createContext,
  useContext,
} from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Menu,
  X,
  Bike,
  Footprints,
  MoveUpRight,
  Heart,
  CalendarDays,
  MapPin,
  Clock,
  Check,
  Plus,
  Minus,
  ShieldCheck,
  Mail,
  ExternalLink,
  LogOut,
  ChevronDown,
  Download,
  UserRound,
  Settings2,
  Ticket,
  Activity,
} from 'lucide-react';
import { api, downloadPrivate, money, statuses, date } from './api';
import { Context, useApp, type Data } from './context';
import { go, Link, Notice, Field, Button, Page, DynamicFields } from './ui';
import { accountUrl } from '../shared/navigation';
import { currentLocale, frenchPath, localizedPath } from '../shared/locale';
import { donationNotice, donationDestination } from '../shared/event';
import { editorial } from '../shared/editorial';
import Account from './Account';
import { PublicParticipants, ListingPreference } from './PublicParticipants';
import { publicListingText } from '../shared/public-participants';
import { staffHome } from '../shared/admin-access';
import Guardians, { GuardianRequest } from './Guardians';
import { participationPolicy } from '../shared/participation';
import {
  participantComplete,
  sportLabel,
  activityPricing,
  activityPriceLabel,
} from '../shared/registration';
import { Home, Activities, Practical, Team, Cause, FAQ } from './Public';

import Turnstile from './Turnstile';
import { track } from './tracking';
import CheckoutStatus from './CheckoutStatus';
import ConfirmParticipantEmail from './ConfirmParticipantEmail';
const eventDate = (s: any) =>
  new Date(s.eventAt).toLocaleDateString(currentLocale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Toronto',
  });
import './styles.css';
import './editorial.css';
import './experience.css';
const TicketPage = lazy(() => import('./TicketPage'));
const ReceiptPage = lazy(() => import('./ReceiptPage'));
const Admin = lazy(() => import('./Admin'));
const DayJ = lazy(() => import('./DayJ'));
const Community = lazy(() => import('./Community'));
const Transparency = lazy(() => import('./Impact'));
const PublicImpact = lazy(() =>
  import('./Impact').then((module) => ({ default: module.PublicImpact })),
);
const Finisher = lazy(() => import('./Finisher'));
function App() {
  const [data, setData] = useState<Data | null>(null),
    [user, setUser] = useState<any>(null),
    [error, setError] = useState(''),
    [url, setUrl] = useState(location.pathname + location.search);
  const path = frenchPath(url.split('?')[0]);
  const refresh = async () => {
    const [d, u] = await Promise.all([api('/public'), api('/me')]);
    setData(d);
    setUser(u.user);
  };
  useEffect(() => {
    document.documentElement.lang = currentLocale();
    refresh().catch((e) => setError(e.message));
    const nav = () => setUrl(location.pathname + location.search);
    addEventListener('popstate', nav);
    return () => removeEventListener('popstate', nav);
  }, []);
  useEffect(() => {
    const name: Record<string, string> = {
      '/inscription': 'Inscription',
      '/espace': textForLocale('Mon espace'),
      '/mon-jour-j': textForLocale('Mon jour J'),
      '/equipes': textForLocale('Les équipes'),
      '/histoires': textForLocale('Pourquoi je participe'),
      '/pour-eux': textForLocale('Pour eux'),
      '/ma-communaute': textForLocale('Ma communauté'),
      '/impact': textForLocale('Notre impact'),
      '/ou-va-mon-argent': textForLocale('Où va mon argent?'),
      '/connexion': 'Connexion',
      '/admin': 'Administration',
      '/organisation': textForLocale('Espace équipe'),
      '/participants': textForLocale('Les participants'),
      '/autorisations-parentales': textForLocale('Autorisations parentales'),
      '/activites': textForLocale('Les activités'),
      '/infos': textForLocale('Infos pratiques'),
      '/cause': textForLocale('La cause'),
      '/equipe': textForLocale('Notre histoire'),
    };
    const selected = data?.activities.find((a) => path === '/activites/' + a.id);
    document.title =
      (selected
        ? selected.name + ' · ' + selected.distance + ' · ' + money(selected.price) + ' — '
        : name[path]
          ? name[path] + ' — '
          : '') + 'Ride For Brains';
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [path, data]);
  useEffect(() => {
    if (user) track('account_verified');
  }, [user]);

  if (error)
    return (
      <div className="loading">
        <h1>Ride For Brains</h1>
        <Notice error>{error}</Notice>
        <Button onClick={() => location.reload()}>{textForLocale('Réessayer')}</Button>
      </div>
    );
  if (!data)
    return (
      <div className="loading">
        <img src="/assets/ride-for-brains.png" alt="Ride For Brains" width="120" />
        <p>{textForLocale('Chaque kilomètre commence ici…')}</p>
      </div>
    );
  let page;
  if (path === '/') page = <Home />;
  else if (path === '/activites' || ['/velo', '/course', '/marche'].includes(path))
    page = <Activities sport={path === '/activites' ? null : path.slice(1)} />;
  else if (path.startsWith('/activites/'))
    page = <Activities selected={path.slice('/activites/'.length)} />;
  else if (path === '/inscription') page = <Registration key={url} />;
  else if (path === '/attente') page = <Waitlist />;
  else if (path === '/connexion' || path === '/compte') page = <Account />;
  else if (path === '/autorisations-parentales') page = <Guardians />;
  else if (path === '/confirmer-courriel') page = <ConfirmParticipantEmail />;
  else if (path.startsWith('/recu/'))
    page = (
      <Suspense fallback={<p>{textForLocale('Chargement du reçu…')}</p>}>
        <ReceiptPage id={path.slice(6)} />
      </Suspense>
    );
  else if (path.startsWith('/billet/') || path === '/billet-personnel')
    page = (
      <Suspense fallback={<p>{textForLocale('Chargement du billet…')}</p>}>
        <TicketPage id={path.slice(8)} personal={path === '/billet-personnel'} />
      </Suspense>
    );
  else if (path === '/espace') page = <Participant />;
  else if (path === '/mon-jour-j')
    page = (
      <Suspense fallback={<p>{textForLocale('Chargement…')}</p>}>
        <DayJ key={url} />
      </Suspense>
    );
  else if (
    ['/equipes', '/histoires', '/pour-eux', '/ma-communaute'].includes(path) ||
    path.startsWith('/equipes/')
  )
    page = (
      <Suspense fallback={<p>{textForLocale('Chargement…')}</p>}>
        <Community path={path} key={path} />
      </Suspense>
    );
  else if (path === '/impact' || path === '/ou-va-mon-argent')
    page = (
      <Suspense fallback={<p>{textForLocale('Chargement…')}</p>}>
        {path === '/impact' ? <PublicImpact /> : <Transparency />}
      </Suspense>
    );
  else if (path.startsWith('/souvenir/'))
    page = (
      <Suspense fallback={<p>{textForLocale('Chargement…')}</p>}>
        <Finisher key={path} id={path.slice('/souvenir/'.length)} />
      </Suspense>
    );
  else if (path === '/participants') page = <PublicParticipants key={url} />;
  else if (path === '/organisation' || path.startsWith('/admin'))
    page = (
      <Suspense fallback={<p>{textForLocale('Chargement de l’administration…')}</p>}>
        <Admin />
      </Suspense>
    );
  else if (path === '/infos' || path === '/parcours') page = <Practical />;
  else if (path === '/equipe') page = <Team />;
  else if (path === '/cause') page = <Cause />;
  else if (path === '/faq') page = <FAQ />;
  else if (['/contact', '/benevolat', '/benevoles', '/partenaires'].includes(path))
    page = (
      <Contact
        kind={
          ['/benevolat', '/benevoles'].includes(path)
            ? 'volunteer'
            : path === '/partenaires'
              ? 'sponsor'
              : 'contact'
        }
      />
    );
  else if (['/confidentialite', '/conditions', '/annulation'].includes(path))
    page = <Legal page={path} />;
  else if (path === '/courriels-locaux') page = <DevMail />;
  else if (path === '/desabonnement') page = <Unsubscribe />;
  else
    page = (
      <Page
        eyebrow={textForLocale('Hors parcours')}
        title={textForLocale('Cette page n’existe pas.')}
      >
        <Link to="/" className="button">
          {textForLocale('Revenir à l’accueil ')}
          <ArrowRight size={18} />
        </Link>
      </Page>
    );
  return (
    <Context.Provider value={{ data, user, refresh }}>
      <a
        className="skip"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          const main = document.getElementById('main');
          main?.focus();
          main?.scrollIntoView({ behavior: 'auto' });
        }}
      >
        {textForLocale('Aller au contenu')}
      </a>
      <Header path={path} />
      <main id="main" tabIndex={-1}>
        {page}
      </main>
      <div className="motion-preference">
        <MotionToggle />
      </div>
      <Footer />
      {data.environment === 'development' && <DevAudit />}
    </Context.Provider>
  );
}
function Header({ path }: any) {
  const { data, user } = useApp();
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const currentActivity = data.activities.find((a) => path === '/activites/' + a.id);
  const sport = ['velo', 'course', 'marche'].find((sport) => path === '/' + sport);
  const relevantActivities = currentActivity
    ? [currentActivity]
    : sport
      ? data.activities.filter((activity) => activity.sport === sport)
      : data.activities;
  const registrationActivity = currentActivity || (sport ? relevantActivities[0] : null);
  const pricing = activityPricing(relevantActivities);
  const publicPage =
    !/^\/(inscription|attente|connexion|compte|espace|mon-jour-j|ma-communaute|souvenir|admin|organisation|billet|billet-personnel|recu|confirmer-courriel|autorisations-parentales|courriels-locaux)(\/|$)/.test(
      path,
    );
  useEffect(() => {
    const hero = document.querySelector('.opening-story');
    if (!hero) {
      setPinned(true);
      return;
    }
    setPinned(false);
    const observer = new IntersectionObserver(([entry]) =>
      setPinned(!entry.isIntersecting && entry.boundingClientRect.top < 0),
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, [path]);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (open) document.querySelector<HTMLElement>('#primary-nav a')?.focus({ preventScroll: true });
  }, [open]);
  return (
    <>
      {data.environment !== 'production' && (
        <div className="dev-banner">
          {data.environment === 'development'
            ? textForLocale('Aperçu local · aucun paiement réel')
            : textForLocale('Mode test · aucun paiement réel')}
          {data.environment === 'development' && (
            <Link to="/courriels-locaux">
              {textForLocale('Boîte de courriels locale ')}
              <ArrowUpRight size={12} />
            </Link>
          )}
        </div>
      )}
      <div className="site-header-shell">
        <header
          className={'header' + (pinned ? ' is-pinned' : '')}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && open) {
              setOpen(false);
              document.querySelector<HTMLElement>('.menu-toggle')?.focus({ preventScroll: true });
            }
          }}
        >
          <Link to="/" className="brand" aria-label={textForLocale('Ride For Brains, accueil')}>
            <img src="/assets/ride-for-brains.png" alt="" />
            <span>
              RIDE FOR
              <br />
              <b>
                BRAINS<span className="brand-dot">.</span>
              </b>
            </span>
          </Link>
          <nav
            id="primary-nav"
            aria-label={textForLocale('Navigation principale')}
            className={open ? 'nav open' : 'nav'}
          >
            <Link
              to="/activites"
              aria-current={
                /^\/(activites|velo|course|marche)(\/|$)/.test(path) ? 'page' : undefined
              }
            >
              {textForLocale('Les activités')}
            </Link>
            <Link to="/participants" aria-current={path === '/participants' ? 'page' : undefined}>
              {textForLocale('Les participants')}
            </Link>
            <Link to="/cause" aria-current={path === '/cause' ? 'page' : undefined}>
              {textForLocale('La cause')}
            </Link>
            <Link
              to="/infos"
              aria-current={['/infos', '/parcours'].includes(path) ? 'page' : undefined}
            >
              {textForLocale('Infos pratiques')}
            </Link>
            <Link to="/equipe" aria-current={path === '/equipe' ? 'page' : undefined}>
              {textForLocale('Notre histoire')}
            </Link>
            <Link
              to={user ? '/espace' : '/connexion'}
              className="account-link"
              aria-current={
                ['/espace', '/connexion', '/compte'].includes(path) ? 'page' : undefined
              }
            >
              <UserRound size={17} />
              {textForLocale('Mon espace')}
            </Link>
            {data.services.english && localizedPath(path, 'en-CA') !== path && (
              <span className="language-choice" aria-label="Language / Langue">
                <a
                  href={localizedPath(path + location.search + location.hash, 'fr-CA')}
                  lang="fr-CA"
                  aria-current={currentLocale() === 'fr-CA' ? 'page' : undefined}
                >
                  FR
                </a>
                <span aria-hidden="true">|</span>
                <a
                  href={localizedPath(path + location.search + location.hash, 'en-CA')}
                  lang="en-CA"
                  aria-current={currentLocale() === 'en-CA' ? 'page' : undefined}
                >
                  EN
                </a>
              </span>
            )}
          </nav>
          <Link to="/inscription" className="button nav-cta">
            {textForLocale('Je participe ')}
            <ArrowUpRight size={17} />
          </Link>
          <button
            className="menu-toggle"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="primary-nav"
            aria-label={open ? textForLocale('Fermer le menu') : textForLocale('Ouvrir le menu')}
          >
            {open ? <X /> : <Menu />}
          </button>
        </header>
      </div>
      <div className="mobile-account-bar">
        <Link to={user ? '/espace' : '/connexion'}>
          <UserRound size={17} />
          {user ? textForLocale('Mon espace') : textForLocale('Se connecter / S’inscrire')}
          <ArrowUpRight size={16} />
        </Link>
      </div>
      {data.settings.registrationOpen && publicPage && pricing.amount !== null && (
        <Link
          className="mobile-register-sticky"
          to={
            registrationActivity ? '/inscription?activite=' + registrationActivity.id : '/activites'
          }
        >
          {textForLocale('S’inscrire — ')}
          {activityPriceLabel(relevantActivities)}
          <ArrowRight size={18} />
        </Link>
      )}
    </>
  );
}
function Footer() {
  const { data, user } = useApp();
  return (
    <footer>
      {location.pathname !== '/' && (
        <div className="footer-top">
          <div>
            <p className="eyebrow lime-text">
              {textForLocale('ON SE RETROUVE SUR LA LIGNE DE DÉPART.')}
            </p>
            <h2>
              {textForLocale('On se retrouve')}
              <br />
              {textForLocale('au départ')}
              <span className="lime-text">.</span>
            </h2>
          </div>
          <Link to="/inscription" className="button lime">
            {textForLocale('Trouver mon activité ')}
            <ArrowUpRight size={20} />
          </Link>
        </div>
      )}
      <div className="footer-grid">
        <div>
          <Link to="/" className="footer-brand">
            RIDE FOR BRAINS.
          </Link>
          <p>{textForLocale('Pour eux, chaque kilomètre compte.')}</p>
          <span className="small">
            {data.settings.edition} · {eventDate(data.settings)}
          </span>
          {editorial(data.settings).socialLinks.length > 0 && (
            <nav className="social-links" aria-label={textForLocale('Réseaux sociaux')}>
              {editorial(data.settings).socialLinks.map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.name}
                </a>
              ))}
            </nav>
          )}
        </div>
        <div>
          <b>{textForLocale('L’événement')}</b>
          <Link to="/activites">{textForLocale('Vélo, course et marche')}</Link>
          <Link to="/participants">{textForLocale('Les participants')}</Link>
          <Link to="/infos">{textForLocale('Renseignements pratiques')}</Link>
          <Link to="/faq">{textForLocale('Questions fréquentes')}</Link>
        </div>
        <div>
          <b>{textForLocale('Ensemble')}</b>
          <Link to="/benevolat">{textForLocale('Devenir bénévole')}</Link>
          <Link to="/partenaires">{textForLocale('Devenir partenaire')}</Link>
          <Link to="/contact">{textForLocale('Nous joindre')}</Link>
          <a href={'mailto:' + data.settings.contact}>{data.settings.contact}</a>
          <a href={data.settings.donationUrl} target="_blank" rel="noopener noreferrer">
            {textForLocale('Faire un don ')}
            <ArrowUpRight size={13} />
          </a>
        </div>
        <div>
          <b>{textForLocale('Votre espace')}</b>
          <Link to="/espace">{textForLocale('Mes inscriptions')}</Link>
          <Link to="/conditions">{textForLocale('Conditions d’inscription')}</Link>
          <Link to="/annulation">{textForLocale('Annulation et remboursement')}</Link>
          <Link to="/confidentialite">{textForLocale('Confidentialité')}</Link>
          <Link to="/equipes">{textForLocale('Les équipes')}</Link>
          <Link to="/histoires">{textForLocale('Histoires de participants')}</Link>
          <Link to="/pour-eux">{textForLocale('Pour eux')}</Link>
          <Link to="/impact">{textForLocale('Notre impact')}</Link>
          <Link to="/ou-va-mon-argent">{textForLocale('Où va mon argent?')}</Link>
          {user && user.role !== 'participant' && (
            <Link to={staffHome(user.role)}>
              {user.role === 'admin' ? 'Administration' : textForLocale('Espace équipe')}
            </Link>
          )}
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Ride For Brains</span>
        <span>{textForLocale(donationDestination)}</span>
      </div>
    </footer>
  );
}
function Contact({ kind }: any) {
  const { data } = useApp();
  const [error, setError] = useState(''),
    [result, setResult] = useState(''),
    [busy, setBusy] = useState(false),
    [token, setToken] = useState('');
  const title =
    kind === 'volunteer'
      ? textForLocale('L’équipe a besoin de votre énergie.')
      : kind === 'sponsor'
        ? textForLocale('Faisons du chemin ensemble.')
        : textForLocale('On garde le contact.');
  const submit = async (e: any) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const r = await api('/submissions', {
        kind,
        name: f.get('name'),
        email: f.get('email'),
        message: f.get('message'),
        consent: true,
        turnstileToken: token,
        details:
          kind === 'volunteer'
            ? {
                phone: String(f.get('phone') || ''),
                availability: String(f.get('availability') || ''),
                preferredRole: String(f.get('preferredRole') || ''),
              }
            : kind === 'sponsor'
              ? { company: String(f.get('company') || ''), phone: String(f.get('phone') || '') }
              : {},
      });
      setResult(r.message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page
      eyebrow={
        kind === 'volunteer'
          ? 'DEVENIR BÉNÉVOLE'
          : kind === 'sponsor'
            ? 'PARTENAIRES ET COMMANDITES'
            : 'NOUS JOINDRE'
      }
      title={title}
      intro={
        kind === 'volunteer'
          ? textForLocale(
              'Dites-nous comment vous aimeriez contribuer. L’organisation vous recontactera.',
            )
          : kind === 'sponsor'
            ? textForLocale(
                'Soutenez un rendez-vous de vélo, course et marche au service de la recherche sur le cerveau. Construisons ensemble un partenariat adapté.',
              )
            : textForLocale('Une question sur votre inscription ou sur la journée? Écrivez-nous.')
      }
    >
      <div className="form-layout">
        <div className="contact-aside">
          <Mail size={30} />
          <h3>{textForLocale('Parlons-en.')}</h3>
          <a href={'mailto:' + data.settings.contact}>{data.settings.contact}</a>
          <p>{textForLocale('Thomas · Équipe Ride For Brains')}</p>
          {kind === 'volunteer' &&
            editorial(data.settings).volunteerRoles.map((r, i) => (
              <div key={i}>
                <h3>{r.title}</h3>
                <p>{r.description}</p>
              </div>
            ))}
          {kind === 'sponsor' && (
            <>
              <p>{editorial(data.settings).sponsorshipIntro || data.settings.cause}</p>
              {editorial(data.settings).sponsorshipOptions.length > 0 && (
                <ul>
                  {editorial(data.settings).sponsorshipOptions.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              )}
            </>
          )}
          {kind === 'sponsor' &&
            data.settings.partners.map((p: any) => (
              <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer">
                <img width="160" src={p.logo} alt={p.name} />
              </a>
            ))}
        </div>
        {result ? (
          <Notice>{result}</Notice>
        ) : (
          <form className="form-panel" onSubmit={submit}>
            <Field label={textForLocale('Votre nom')}>
              <input name="name" required maxLength={150} autoComplete="name" />
            </Field>
            <Field label={textForLocale('Votre courriel')}>
              <input name="email" type="email" required autoComplete="email" />
            </Field>
            {kind !== 'contact' && (
              <Field label={textForLocale('Téléphone (facultatif)')}>
                <input name="phone" type="tel" maxLength={35} autoComplete="tel" />
              </Field>
            )}
            {kind === 'volunteer' && (
              <>
                <Field label={textForLocale('Vos disponibilités')}>
                  <input name="availability" required maxLength={1000} />
                </Field>
                {editorial(data.settings).volunteerRoles.length > 0 ? (
                  <Field label={textForLocale('Rôle préféré')}>
                    <select name="preferredRole" defaultValue="">
                      <option value="">
                        {textForLocale('Je suis disponible selon les besoins')}
                      </option>
                      {editorial(data.settings).volunteerRoles.map((r) => (
                        <option key={r.title}>{r.title}</option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <Field label={textForLocale('Comment aimeriez-vous aider ?')}>
                    <input name="preferredRole" maxLength={150} />
                  </Field>
                )}
              </>
            )}
            {kind === 'sponsor' && (
              <Field label={textForLocale('Entreprise / organisation')}>
                <input name="company" required maxLength={150} autoComplete="organization" />
              </Field>
            )}
            <Field
              label={
                kind === 'volunteer'
                  ? textForLocale('Disponibilités et tâches qui vous intéressent')
                  : textForLocale('Votre message')
              }
            >
              <textarea name="message" required minLength={10} maxLength={5000} rows={5} />
            </Field>
            <label className="checkbox">
              <input type="checkbox" required />
              {textForLocale(
                'J’accepte que l’équipe utilise ces renseignements pour répondre à ma demande.',
              )}
            </label>
            <Turnstile onToken={setToken} />
            {error && <Notice error>{error}</Notice>}
            <Button busy={busy}>
              {textForLocale('Transmettre ma demande ')}
              <ArrowUpRight size={18} />
            </Button>
          </form>
        )}
      </div>
    </Page>
  );
}
function Legal({ page }: any) {
  const { data } = useApp();
  const s = data.settings;
  if (currentLocale() === 'en-CA' && !data.services.englishLegal)
    return (
      <Page title={page === '/confidentialite' ? 'Privacy' : 'Participation terms'}>
        <p>The English legal text is awaiting approval by the organizers.</p>
        <a className="button" href={page} lang="fr-CA">
          Lire le texte en français
        </a>
      </Page>
    );
  return (
    <Page
      eyebrow={
        s.legalApproved ? 'INFORMATIONS ET POLITIQUES' : 'BROUILLON À VALIDER PAR L’ORGANISATION'
      }
      title={
        page === '/confidentialite'
          ? textForLocale('Vos données, avec attention.')
          : page === '/annulation'
            ? textForLocale('Annulation et remboursement.')
            : textForLocale('Les conditions de participation.')
      }
    >
      <div className="prose legal">
        {page === '/annulation' ? (
          <>
            <h2>{textForLocale('Une règle simple')}</h2>
            <p>
              {textForLocale(
                'À 15 jours ou plus du début de l’événement : remboursement complet de l’inscription. À moins de 15 jours : aucun remboursement.',
              )}
            </p>
            <p>
              {textForLocale('Le calcul utilise le début de l’événement, fixé au')}{' '}
              {new Date(s.eventAt).toLocaleString('fr-CA', { timeZone: 'America/Toronto' })}
              {textForLocale(
                ', heure du Québec. Vous pouvez annuler une seule participation ou tout le dossier. Le remboursement admissible porte sur le montant effectivement payé après rabais, diminué des remboursements déjà reçus.',
              )}
            </p>
            <p>
              {textForLocale(
                'La demande se fait depuis l’espace de l’acheteur. Un remboursement est confirmé seulement après son traitement par le prestataire. ',
              )}
              {textForLocale(donationDestination)}
            </p>
            {!data.settings.launchReview?.eventApproved && (
              <p>
                {textForLocale(
                  'Les dispositions en cas d’annulation ou de report par l’organisation restent à valider avant ouverture.',
                )}
              </p>
            )}
            {data.settings.launchReview &&
              [
                ['cancellation', textForLocale('Annulation par l’organisation')],
                ['postponement', 'Report'],
                ['weather', textForLocale('Météo')],
                ['forceMajeure', textForLocale('Force majeure')],
              ]
                .filter(([key]) => data.settings.launchReview[key])
                .map(([key, label]) => (
                  <section key={key}>
                    <h2>{label}</h2>
                    <p className="prewrap">{data.settings.launchReview[key]}</p>
                  </section>
                ))}
          </>
        ) : (
          <p className="prewrap">{page === '/confidentialite' ? s.privacy : s.terms}</p>
        )}
        {page === '/confidentialite' && (
          <p>
            {textForLocale(
              'Les cartes des parcours affichent les coordonnées GPX publiées par l’organisation sur un fond OpenStreetMap. Quand vous ouvrez la page d’un parcours, votre navigateur demande les images de carte à ce service et lui transmet notamment votre adresse IP. La carte ne demande pas votre position GPS et ne transmet pas les renseignements de votre compte.',
            )}{' '}
            <a
              href="https://osmfoundation.org/wiki/Privacy_Policy"
              target="_blank"
              rel="noopener noreferrer"
            >
              {textForLocale('Confidentialité d’OpenStreetMap')}
            </a>
            .
          </p>
        )}
        <p className="small">
          {textForLocale('Version des conditions : ')}
          {s.termsVersion}
        </p>
        <a href={'mailto:' + s.contact} className="text-link">
          {textForLocale('Contacter le responsable ')}
          <ArrowUpRight size={16} />
        </a>
      </div>
    </Page>
  );
}
function Waitlist() {
  const { user, data } = useApp();
  const activity = data.activities.find(
    (a) => a.id === new URLSearchParams(location.search).get('activite'),
  );
  const [error, setError] = useState(''),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <Page
      eyebrow={textForLocale('LISTE D’ATTENTE')}
      title={textForLocale('Gardons une place pour votre élan.')}
      intro={textForLocale(
        'L’inscription sur cette liste ne réserve aucune place et ne déclenche aucun paiement.',
      )}
    >
      {!activity ? (
        <Notice error>{textForLocale('Activité introuvable.')}</Notice>
      ) : !user ? (
        <Notice>
          <p>
            {textForLocale(
              'Connectez-vous pour rejoindre la liste d’attente. Revenez ensuite sur cette activité.',
            )}
          </p>
          <Link className="button" to={accountUrl(location.pathname + location.search)}>
            {textForLocale('Me connecter')}
          </Link>
        </Notice>
      ) : done ? (
        <Notice>
          {textForLocale(
            'Votre demande est enregistrée. L’équipe doit vous contacter si une place devient disponible; aucune inscription n’est confirmée automatiquement.',
          )}
        </Notice>
      ) : (
        <form
          className="form-panel"
          style={{ maxWidth: 650 }}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const f = new FormData(e.currentTarget);
            try {
              await api('/waitlist', {
                activityId: activity.id,
                firstName: f.get('firstName'),
                lastName: f.get('lastName'),
                adult: activity.sport === 'velo' || f.get('ageGroup') === 'adult',
              });
              setDone(true);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2 style={{ fontSize: 30 }}>
            {activity.name} · {activity.distance}
          </h2>
          <div className="form-grid">
            <Field label={textForLocale('Prénom')}>
              <input name="firstName" required maxLength={150} />
            </Field>
            <Field label={textForLocale('Nom')}>
              <input name="lastName" required maxLength={150} />
            </Field>
          </div>
          {activity.sport === 'velo' ? (
            <label className="checkbox">
              <input type="checkbox" required />
              {textForLocale('J’aurai au moins 18 ans le jour de l’événement.')}
            </label>
          ) : (
            <>
              <Field label={textForLocale('Âge le jour de l’événement')}>
                <select name="ageGroup" required defaultValue="">
                  <option value="">{textForLocale('Choisissez')}</option>
                  <option value="adult">{textForLocale('18 ans ou plus')}</option>
                  <option value="minor">{textForLocale('Moins de 18 ans')}</option>
                </select>
              </Field>
              <p className="small">
                {textForLocale(
                  'La liste d’attente n’est pas une inscription. Pour participer, un mineur devra obtenir l’accord d’un parent depuis son propre compte.',
                )}
              </p>
            </>
          )}
          {error && <Notice error>{error}</Notice>}
          <Button busy={busy}>{textForLocale('Rejoindre la liste d’attente')}</Button>
        </form>
      )}
    </Page>
  );
}
function emptyParticipant(activity: any) {
  return {
    activityId: activity?.id || '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    adult: null,
    emergencyName: '',
    emergencyPhone: '',
    answers: {} as any,
    formVersion: activity?.form_version || 1,
    conditions: false,
    photo: false,
    marketing: false,
    publicListing: false,
    authority: false,
  };
}
function Registration() {
  const { data, user } = useApp();
  const pre = new URLSearchParams(location.search).get('activite');
  useEffect(() => track('registration_start', pre || undefined), [pre]);
  const initial = data.activities.find((a) => a.id === pre) || data.activities[0];
  const [people, setPeople] = useState<any[]>([emptyParticipant(initial)]),
    [step, setStep] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [promo, setPromo] = useState(''),
    [quote, setQuote] = useState<any>(null),
    [key, setKey] = useState(crypto.randomUUID());
  const [draftMessage, setDraftMessage] = useState('');
  const [expandedParticipant, setExpandedParticipant] = useState(0);
  const invalidFocus = useRef({ scheduled: false, reporting: false });
  const draftFinalized = useRef(false);
  const [draftReady, setDraftReady] = useState(false),
    [saveStatus, setSaveStatus] = useState('');
  const [draftRetry, setDraftRetry] = useState(0),
    [draftLoadError, setDraftLoadError] = useState('');
  const draftQueue = useRef<Promise<any>>(Promise.resolve());
  const saveSequence = useRef(0),
    lastSavedDraft = useRef('');
  const latestDraft = useRef({ participants: people, promo, step });
  latestDraft.current = { participants: people, promo, step };
  const storeDraft = (keepalive = false) => {
    if (draftFinalized.current) return Promise.resolve();
    const value = latestDraft.current,
      serialized = JSON.stringify(value),
      sequence = ++saveSequence.current;
    if (serialized === lastSavedDraft.current) return Promise.resolve();
    setSaveStatus('Sauvegarde…');
    const task = draftQueue.current
      .catch(() => {})
      .then(() =>
        draftFinalized.current
          ? undefined
          : api(user ? '/draft' : '/draft/guest', value, user ? 'PUT' : 'POST', { keepalive }),
      );
    draftQueue.current = task;
    return task
      .then(() => {
        lastSavedDraft.current = serialized;
        if (sequence === saveSequence.current) setSaveStatus(textForLocale('Sauvegardé'));
      })
      .catch((e) => {
        if (sequence === saveSequence.current)
          setSaveStatus(textForLocale('Sauvegarde interrompue. Réessayez avant de quitter.'));
        throw e;
      });
  };
  const flushDraft = useRef(storeDraft);
  flushDraft.current = storeDraft;
  useEffect(() => {
    setKey(crypto.randomUUID());
  }, [people, promo]);
  useEffect(() => {
    let active = true,
      loaded = false;
    setDraftReady(false);
    setDraftLoadError('');
    api(user ? '/draft' : '/draft/guest')
      .then((d) => {
        if (!active) return;
        loaded = true;
        if (
          d?.participants?.length &&
          (!pre || d.participants.some((p: any) => p.activityId === pre))
        ) {
          const restored = d.participants
            .map((p: any) => {
              const a = data.activities.find((a) => a.id === p.activityId);
              return a
                ? {
                    ...p,
                    conditions: false,
                    formVersion: a.form_version,
                    answers: p.formVersion === a.form_version ? p.answers : {},
                    guardianRequestId:
                      p.formVersion === a.form_version ? p.guardianRequestId : undefined,
                    guardianStatus: p.formVersion === a.form_version ? p.guardianStatus : undefined,
                  }
                : null;
            })
            .filter(Boolean);
          setPeople(restored.length ? restored : [emptyParticipant(initial)]);
          setPromo(d.promo || '');
          setStep(Math.min(2, d.step || 1));
          setDraftMessage(
            textForLocale(
              'Votre brouillon a été restauré. Relisez et acceptez de nouveau les conditions avant de confirmer.',
            ),
          );
        }
      })
      .catch((e) => {
        if (active)
          setDraftLoadError(
            textForLocale(
              'Impossible de retrouver votre brouillon pour le moment. Réessayez avant de continuer.',
            ),
          );
      })
      .finally(() => {
        if (active && loaded) setDraftReady(true);
      });
    return () => {
      active = false;
    };
  }, [user?.id, draftRetry]);
  useEffect(() => {
    if (!draftReady) return;
    const timer = setTimeout(() => void flushDraft.current().catch(() => {}), 1800);
    return () => clearTimeout(timer);
  }, [people, promo, step, draftReady, user?.id]);
  useEffect(() => {
    if (!draftReady) return;
    const hide = () => {
      if (document.visibilityState === 'hidden') void flushDraft.current(true).catch(() => {});
    };
    const flush = () => void flushDraft.current(true).catch(() => {});
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [draftReady, user?.id]);
  const saveDraft = async () => {
    try {
      await storeDraft();
      setDraftMessage(
        user
          ? textForLocale(
              'Votre brouillon est enregistré dans votre compte. Aucune place n’est réservée.',
            )
          : textForLocale(
              'Votre brouillon est conservé de façon sécurisée pendant deux heures sur ce navigateur. Aucune place n’est réservée.',
            ),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const s = data.settings;
  const change = (i: number, k: string, v: any) =>
    setPeople((p) =>
      p.map((r, n) =>
        i === n
          ? {
              ...r,
              ...(['guardianRequestId', 'guardianStatus', 'conditions', 'authority'].includes(k)
                ? {}
                : { guardianRequestId: undefined, guardianStatus: undefined }),
              [k]: v,
            }
          : r,
      ),
    );
  const englishLegalPending = currentLocale() === 'en-CA' && !data.services.englishLegal;
  const canRegister =
    !englishLegalPending && (data.environment === 'development' || s.registrationOpen);
  const next = async (e: any) => {
    e.preventDefault();
    setError('');
    if (step < 3) {
      if (step === 2) {
        setBusy(true);
        try {
          if (!user) {
            await storeDraft();
            go(accountUrl(location.pathname + location.search));
            return;
          }
          if (people.some((p) => !p.adult && p.guardianStatus !== 'approved'))
            throw new Error(
              textForLocale(
                'Le parent doit d’abord autoriser chaque participation mineure depuis son propre compte.',
              ),
            );
          const q = await api('/quote', { participants: people.map((p) => p.activityId), promo });
          setQuote(q);
          setStep(3);
          track('registration_form_complete', people[0]?.activityId);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      } else setStep(step + 1);
    }
  };
  const pay = async () => {
    setBusy(true);
    setError('');
    try {
      await storeDraft();
      draftFinalized.current = true;
      const order = await api('/orders', {
        participants: people,
        promo: promo || undefined,
        requestKey: key,
        termsVersion: s.termsVersion,
        expectedAmount: quote.amount,
      });
      if (order.status === 'confirmed') {
        go('/espace');
        return;
      }
      const result = await api('/orders/' + order.id + '/checkout', {});
      track('checkout_start', people[0]?.activityId);
      location.assign(result.url);
    } catch (e) {
      draftFinalized.current = false;
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page
      eyebrow={textForLocale('VOTRE PROCHAIN DÉPART')}
      title={textForLocale('Faites partie du mouvement.')}
      intro={textForLocale(
        'Une inscription par personne et par activité. Les dons à Brain Canada se font séparément.',
      )}
    >
      {englishLegalPending ? (
        <Notice>
          Registration in English will open once the English terms are approved.{' '}
          <a href={'/inscription' + location.search} lang="fr-CA">
            Continuer en français
          </a>
        </Notice>
      ) : !canRegister ? (
        <div className="closed-panel">
          <Clock size={34} />
          <h2>{textForLocale('Les inscriptions ouvriront bientôt.')}</h2>
          <p>
            {textForLocale(
              'Les activités et leurs tarifs sont déjà disponibles. L’organisation annoncera l’ouverture dès que tous les renseignements seront confirmés.',
            )}
          </p>
          <Link to="/activites" className="button">
            {textForLocale('Explorer les activités ')}
            <ArrowRight size={18} />
          </Link>
        </div>
      ) : (
        <>
          {draftMessage && <Notice>{draftMessage}</Notice>}
          <div className="actions" style={{ marginBottom: 25, marginTop: 0 }}>
            <button type="button" className="text-link" onClick={saveDraft}>
              {textForLocale('Enregistrer pour plus tard')}
            </button>
            <span className="save-status" role="status" aria-live="polite">
              {saveStatus}
            </span>
          </div>
          <ol className="steps">
            {[
              textForLocale('Le choix'),
              textForLocale('Les participants'),
              textForLocale('Le récapitulatif'),
            ].map((t, i) => (
              <li key={t} className={step >= i + 1 ? 'current' : ''}>
                <span>{step > i + 1 ? <Check size={15} /> : i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
          {!draftReady &&
            (draftLoadError ? (
              <Notice error>
                {draftLoadError}{' '}
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setDraftRetry((n) => n + 1)}
                >
                  {textForLocale('Réessayer')}
                </button>
              </Notice>
            ) : (
              <p role="status">{textForLocale('Nous retrouvons votre brouillon…')}</p>
            ))}
          <div className="registration-layout" style={{ display: draftReady ? undefined : 'none' }}>
            <form
              onSubmit={next}
              className="registration-form"
              onInvalidCapture={(e) => {
                if (invalidFocus.current.reporting) return;
                e.preventDefault();
                if (invalidFocus.current.scheduled) return;
                invalidFocus.current.scheduled = true;
                const field = e.target as HTMLInputElement;
                const panel = (e.target as HTMLElement).closest<HTMLDetailsElement>(
                  '.participant-entry',
                );
                if (panel) setExpandedParticipant(Number(panel.dataset.participant));
                requestAnimationFrame(() => {
                  if (field.isConnected) {
                    field.focus();
                    invalidFocus.current.reporting = true;
                    field.reportValidity();
                    invalidFocus.current.reporting = false;
                  }
                  invalidFocus.current.scheduled = false;
                });
              }}
            >
              {step === 1 ? (
                <>
                  <h2>{textForLocale('Quel sera votre mouvement?')}</h2>
                  {people.map((p, i) => (
                    <div className="person-select" key={i}>
                      <Field label={textForLocale('Participation ') + (i + 1)}>
                        <select
                          value={p.activityId}
                          onChange={(e) => {
                            const a = data.activities.find((a) => a.id === e.target.value);
                            setPeople((rs) =>
                              rs.map((r, n) =>
                                n === i
                                  ? {
                                      ...r,
                                      activityId: a.id,
                                      formVersion: a.form_version,
                                      answers: {},
                                      guardianRequestId: undefined,
                                      guardianStatus: undefined,
                                    }
                                  : r,
                              ),
                            );
                          }}
                        >
                          {data.activities.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.sport === 'velo'
                                ? textForLocale('Vélo')
                                : a.sport === 'course'
                                  ? textForLocale('Course')
                                  : textForLocale('Marche')}{' '}
                              · {a.distance} — {money(a.price)}
                              {a.capacity !== null
                                ? ' · ' + Math.max(0, a.capacity - a.occupied) + ' place(s)'
                                : ''}
                            </option>
                          ))}
                        </select>
                      </Field>
                      {people.length > 1 && (
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={textForLocale('Retirer la participation ') + (i + 1)}
                          onClick={() => setPeople((rs) => rs.filter((_, n) => n !== i))}
                        >
                          <X size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setPeople((rs) => [...rs, emptyParticipant(initial)])}
                    disabled={people.length >= 12}
                  >
                    <Plus size={18} />
                    {textForLocale('Ajouter une personne ou une activité')}
                  </button>
                  <Field label={textForLocale('Code promotionnel (facultatif)')}>
                    <input
                      value={promo}
                      onChange={(e) => setPromo(e.target.value.toUpperCase())}
                      maxLength={40}
                    />
                  </Field>
                  <Notice>
                    {textForLocale(participationPolicy)}
                    {textForLocale(' Aucune donnée médicale n’est demandée.')}
                  </Notice>
                </>
              ) : step === 2 ? (
                <>
                  <h2>{textForLocale('Qui prend le départ?')}</h2>
                  {people.map((p, i) => {
                    const activity = data.activities.find((a) => a.id === p.activityId);
                    return (
                      <details
                        className="participant-entry"
                        key={i}
                        data-participant={i}
                        open={expandedParticipant === i}
                        onToggle={(e) => {
                          if (e.currentTarget.open) setExpandedParticipant(i);
                          else setExpandedParticipant((current) => (current === i ? -1 : current));
                        }}
                      >
                        <summary>
                          <span>
                            {p.firstName || textForLocale('Participant ') + (i + 1)} {p.lastName}
                            <small>
                              {textForLocale(sportLabel(activity.sport))} · {activity.distance}
                            </small>
                          </span>
                          <span
                            className={
                              participantComplete(p, activity)
                                ? 'participant-complete'
                                : 'participant-incomplete'
                            }
                          >
                            {participantComplete(p, activity)
                              ? '✓ Complété'
                              : textForLocale('À compléter')}
                          </span>
                        </summary>
                        <fieldset className="participant-fields">
                          <legend>
                            {i + 1}. {activity.name} · {activity.distance}
                          </legend>
                          {i > 0 && (
                            <div className="actions copy-fields">
                              <button
                                type="button"
                                className="text-link"
                                onClick={() => {
                                  change(i, 'emergencyName', people[0].emergencyName);
                                  change(i, 'emergencyPhone', people[0].emergencyPhone);
                                }}
                              >
                                {textForLocale('Copier le contact d’urgence de')}{' '}
                                {people[0].firstName || 'la première personne'}
                              </button>
                              <button
                                type="button"
                                className="text-link"
                                onClick={() => change(i, 'phone', people[0].phone)}
                              >
                                {textForLocale('Utiliser le même téléphone')}
                              </button>
                            </div>
                          )}
                          <div className="form-grid">
                            <Field label={textForLocale('Prénom')}>
                              <input
                                required
                                maxLength={150}
                                value={p.firstName}
                                onChange={(e) => change(i, 'firstName', e.target.value)}
                                autoComplete="given-name"
                              />
                            </Field>
                            <Field label={textForLocale('Nom')}>
                              <input
                                required
                                maxLength={150}
                                value={p.lastName}
                                onChange={(e) => change(i, 'lastName', e.target.value)}
                                autoComplete="family-name"
                              />
                            </Field>
                            <Field label={textForLocale('Courriel du participant')}>
                              <input
                                required
                                type="email"
                                value={p.email}
                                onChange={(e) => change(i, 'email', e.target.value)}
                                autoComplete="email"
                              />
                            </Field>
                            <Field label={textForLocale('Téléphone')}>
                              <input
                                required
                                type="tel"
                                minLength={7}
                                maxLength={35}
                                value={p.phone}
                                onChange={(e) => change(i, 'phone', e.target.value)}
                                autoComplete="tel"
                              />
                            </Field>
                            <Field label={textForLocale('Contact d’urgence · nom')}>
                              <input
                                required
                                maxLength={150}
                                value={p.emergencyName}
                                onChange={(e) => change(i, 'emergencyName', e.target.value)}
                              />
                            </Field>
                            <Field label={textForLocale('Contact d’urgence · téléphone')}>
                              <input
                                required
                                type="tel"
                                minLength={7}
                                maxLength={35}
                                value={p.emergencyPhone}
                                onChange={(e) => change(i, 'emergencyPhone', e.target.value)}
                              />
                            </Field>
                          </div>
                          <DynamicFields
                            fields={activity.fields}
                            answers={p.answers}
                            onChange={(answers: any) => change(i, 'answers', answers)}
                          />
                          {activity.sport === 'velo' ? (
                            <label className="checkbox">
                              <input
                                type="checkbox"
                                checked={p.adult === true}
                                required
                                onChange={(e) => change(i, 'adult', e.target.checked)}
                              />
                              {textForLocale(
                                'Cette personne aura au moins 18 ans le jour de l’événement.',
                              )}
                            </label>
                          ) : (
                            <Field
                              label={textForLocale('Âge de cette personne le jour de l’événement')}
                            >
                              <select
                                required
                                value={
                                  p.adult === true ? 'adult' : p.adult === false ? 'minor' : ''
                                }
                                onChange={(e) =>
                                  change(
                                    i,
                                    'adult',
                                    e.target.value === '' ? null : e.target.value === 'adult',
                                  )
                                }
                              >
                                <option value="">{textForLocale('Choisissez')}</option>
                                <option value="adult">{textForLocale('18 ans ou plus')}</option>
                                <option value="minor">
                                  {textForLocale(
                                    'Moins de 18 ans — autorisation parentale requise',
                                  )}
                                </option>
                              </select>
                            </Field>
                          )}
                          <label className="checkbox">
                            <input
                              type="checkbox"
                              checked={p.authority}
                              required
                              onChange={(e) => change(i, 'authority', e.target.checked)}
                            />
                            {textForLocale(
                              'Je suis cette personne ou j’ai son autorisation pour l’inscrire et transmettre ses consentements.',
                            )}
                          </label>
                          <label className="checkbox">
                            <input
                              type="checkbox"
                              checked={p.conditions}
                              required
                              onChange={(e) => change(i, 'conditions', e.target.checked)}
                            />
                            {textForLocale(
                              'J’ai lu et j’accepte les conditions ci-dessous pour cette participation.',
                            )}
                          </label>
                          <label className="checkbox">
                            <input
                              type="checkbox"
                              checked={p.photo}
                              onChange={(e) => change(i, 'photo', e.target.checked)}
                            />
                            {textForLocale(
                              'J’accepte les photos et vidéos de cette personne pour les communications de l’événement. (Facultatif)',
                            )}
                          </label>
                          <label className="checkbox">
                            <input
                              type="checkbox"
                              checked={p.marketing}
                              onChange={(e) => change(i, 'marketing', e.target.checked)}
                            />
                            {textForLocale(
                              'Cette personne souhaite recevoir les communications promotionnelles. (Facultatif)',
                            )}
                          </label>
                          <label className="checkbox">
                            <input
                              type="checkbox"
                              checked={!!p.publicListing}
                              onChange={(e) => change(i, 'publicListing', e.target.checked)}
                            />
                            {publicListingText}
                            {p.adult === false &&
                              ' Le parent devra également autoriser cet affichage.'}
                          </label>
                          {activity.sport !== 'velo' && p.adult === false && (
                            <GuardianRequest
                              participant={p}
                              onChange={(k, v) => change(i, k, v)}
                              onCreated={async (id, status) => {
                                const nextPeople = people.map((person, n) =>
                                  n === i
                                    ? { ...person, guardianRequestId: id, guardianStatus: status }
                                    : person,
                                );
                                setPeople(nextPeople);
                                await api('/draft', { participants: nextPeople, promo }, 'PUT');
                                setDraftMessage(
                                  textForLocale(
                                    'La demande et votre brouillon sont enregistrés. Vous pourrez reprendre cette inscription après l’accord du parent.',
                                  ),
                                );
                              }}
                              onSignIn={async () => {
                                try {
                                  await api('/draft/guest', { participants: people, promo });
                                  go(accountUrl(location.pathname + location.search));
                                } catch (e) {
                                  setError((e as Error).message);
                                }
                              }}
                            />
                          )}
                        </fieldset>
                      </details>
                    );
                  })}
                  <details className="terms-box" open>
                    <summary>
                      {textForLocale('Conditions · version ')}
                      {s.termsVersion}
                    </summary>
                    <p className="prewrap">{s.terms}</p>
                  </details>
                </>
              ) : (
                <>
                  <h2>{textForLocale('Tout est prêt pour le départ?')}</h2>
                  {people.map((p, i) => {
                    const a = data.activities.find((a) => a.id === p.activityId);
                    return (
                      <div className="review-person" key={i}>
                        <span className="eyebrow">
                          {textForLocale('PARTICIPATION ')}
                          {i + 1}
                        </span>
                        <h3>
                          {p.firstName} {p.lastName}
                        </h3>
                        <p>
                          {a.name} · {a.distance}
                        </p>
                        <p>{p.email}</p>
                        <details>
                          <summary>{textForLocale('Relire les réponses et consentements')}</summary>
                          <p>
                            {textForLocale('Téléphone : ')}
                            {p.phone}
                            <br />
                            {textForLocale('Urgence : ')}
                            {p.emergencyName} · {p.emergencyPhone}
                          </p>
                          <dl>
                            {a.fields.map((f: any) => (
                              <React.Fragment key={f.id}>
                                <dt>{f.label}</dt>
                                <dd>{String(p.answers[f.id] ?? '—')}</dd>
                              </React.Fragment>
                            ))}
                          </dl>
                          <p>
                            {textForLocale('Photos : ')}
                            {p.photo ? 'oui' : 'non'}
                            {textForLocale(' · Promotions :')} {p.marketing ? 'oui' : 'non'}
                            <br />
                            {textForLocale('Liste publique :')}{' '}
                            {p.publicListing ? 'prénom et initiale du nom' : 'nom privé'}
                            <br />
                            {textForLocale('Conditions acceptées · ')}
                            {s.termsVersion}
                          </p>
                        </details>
                      </div>
                    );
                  })}
                  <Notice>
                    <ShieldCheck size={19} />
                    <p>
                      {quote?.amount === 0
                        ? textForLocale(
                            'Cette inscription est gratuite après application du tarif ou de la réduction.',
                          )
                        : textForLocale(
                            'Le paiement s’effectue sur une page sécurisée. Vous retrouverez ensuite votre confirmation et vos billets ici.',
                          )}
                    </p>
                  </Notice>
                  <p className="fee-disclosure">{textForLocale(donationNotice)}</p>
                </>
              )}
              {error && <Notice error>{error}</Notice>}
              <div className="actions">
                {step > 1 && (
                  <button
                    className="text-link"
                    type="button"
                    onClick={() => {
                      setStep(step - 1);
                      setError('');
                    }}
                  >
                    <ArrowLeft size={17} />
                    {textForLocale('Retour')}
                  </button>
                )}
                {step < 3 ? (
                  <Button type="submit" busy={busy}>
                    {step === 2 && !user
                      ? textForLocale('Créer un compte ou me connecter')
                      : textForLocale('Continuer')}{' '}
                    <ArrowRight size={18} />
                  </Button>
                ) : (
                  <Button type="button" busy={busy} onClick={pay}>
                    {quote?.amount === 0
                      ? textForLocale('Confirmer mon inscription')
                      : textForLocale('Payer ') + money(quote?.amount || 0)}{' '}
                    <ArrowUpRight size={18} />
                  </Button>
                )}
              </div>
            </form>
            <aside className="order-summary">
              <span className="eyebrow">{textForLocale('VOTRE RENDEZ-VOUS')}</span>
              <h3>{eventDate(s)}</h3>
              <p>
                {textForLocale('Accueil dès ')}
                {s.reception.replace(':', ' h ')}
                <br />
                {s.location || textForLocale('Lieu à confirmer')}
              </p>
              <hr />
              {people.map((p, i) => {
                const a = data.activities.find((a) => a.id === p.activityId);
                return (
                  <div className="summary-line" key={i}>
                    <span>
                      {textForLocale(sportLabel(a.sport))} · {a.distance}
                    </span>
                    <b>{money(a.price)}</b>
                  </div>
                );
              })}
              {quote?.discount > 0 && (
                <div className="summary-line">
                  <span>{textForLocale('Réduction')}</span>
                  <b>−{money(quote.discount)}</b>
                </div>
              )}
              <div className="summary-total">
                <span>{quote ? 'Total' : 'Sous-total'}</span>
                <b>
                  {money(
                    quote?.amount ??
                      people.reduce(
                        (v, p) => v + data.activities.find((a) => a.id === p.activityId).price,
                        0,
                      ),
                  )}
                </b>
              </div>
              <p className="small">
                {textForLocale('Dollars canadiens.')}{' '}
                {s.taxMode === 'included'
                  ? textForLocale('Taxes incluses.')
                  : s.taxMode === 'not_applicable'
                    ? textForLocale(
                        'Taxes non applicables selon la configuration de l’organisation.',
                      )
                    : textForLocale('Fiscalité à valider avant l’ouverture réelle.')}
              </p>
              <p className="small">
                {textForLocale(
                  'Remboursement à 100 % à 15 jours ou plus de l’événement. Aucun remboursement à moins de 15 jours.',
                )}
              </p>
              <Link to="/annulation" className="text-link small">
                {textForLocale('Lire la politique ')}
                <ArrowUpRight size={14} />
              </Link>
            </aside>
          </div>
        </>
      )}
    </Page>
  );
}
function Participant() {
  const { user, refresh, data } = useApp();
  useEffect(() => {
    if (user && new URLSearchParams(location.search).has('commande')) track('checkout_return');
  }, [user?.id]);
  const [state, setState] = useState<any>(null),
    [error, setError] = useState(''),
    [ticket, setTicket] = useState<any>(null),
    [busy, setBusy] = useState(''),
    [message, setMessage] = useState('');
  const ticketTrigger = useRef<HTMLElement | null>(null);
  const closeTicket = () => {
    setTicket(null);
    ticketTrigger.current?.focus({ preventScroll: true });
  };
  const load = () =>
    api('/registrations')
      .then(setState)
      .catch((e) => setError(e.message));
  useEffect(() => {
    if (user) load();
  }, [user]);
  if (!user)
    return (
      <Page
        eyebrow={textForLocale('VOTRE ESPACE')}
        title={textForLocale('Vos inscriptions vous attendent.')}
      >
        <Link to="/connexion" className="button">
          {textForLocale('Me connecter ')}
          <ArrowRight size={18} />
        </Link>
      </Page>
    );
  const showTicket = async (id: string) => {
    ticketTrigger.current = document.activeElement as HTMLElement;
    setError('');
    try {
      const t = await api('/registrations/' + id + '/ticket');
      const QR = await import('qrcode');
      t.image = await QR.toDataURL(t.ticket, { width: 500, margin: 3, errorCorrectionLevel: 'M' });
      setTicket(t);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const cancel = async (orderId: string, registrationId?: string) => {
    if (
      !confirm(
        registrationId
          ? textForLocale(
              'Annuler uniquement cette participation? Les autres participations restent valides. Le remboursement dépend du délai de 15 jours.',
            )
          : textForLocale(
              'Annuler toutes les participations de ce dossier? Le remboursement sera calculé selon la politique affichée.',
            ),
      )
    )
      return;
    setBusy(orderId);
    setError('');
    try {
      const r = await api(
        registrationId
          ? '/registrations/' + registrationId + '/cancel'
          : '/orders/' + orderId + '/cancel',
        { confirm: true },
      );
      setMessage(
        r.refundRequested
          ? textForLocale('Demande enregistrée. Remboursement en traitement : ') +
              money(r.refundRequested)
          : textForLocale('Dossier annulé.'),
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };
  const edit = async (e: any, id: string) => {
    e.preventDefault();
    setError('');
    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries(
      [...form.entries()].filter(([k]) => data.settings.editableFields.includes(k)),
    );
    try {
      await api('/registrations/' + id, body, 'PATCH');
      setMessage(textForLocale('Coordonnées mises à jour.'));
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Page
      eyebrow={textForLocale('VOTRE ESPACE PARTICIPANT')}
      title={textForLocale('Bonjour ') + user.name.split(' ')[0] + '.'}
      intro={textForLocale(
        'Les dossiers ci-dessous sont ceux que vous avez inscrits avec ce compte.',
      )}
    >
      <div className="actions account-actions">
        <Link to="/mon-jour-j" className="button">
          {textForLocale('Mon jour J ')}
          <CalendarDays size={17} />
        </Link>
        <Link to="/ma-communaute" className="button outline">
          {textForLocale('Ma communauté')}
        </Link>
        <Link to="/autorisations-parentales" className="button outline">
          {textForLocale('Autorisations parentales')}
        </Link>
        <Link to="/inscription" className="button">
          {textForLocale('Ajouter une inscription ')}
          <Plus size={17} />
        </Link>
        {user.role !== 'participant' && (
          <Link className="button outline" to={staffHome(user.role)}>
            {user.role === 'admin' ? 'Administration' : textForLocale('Espace équipe')}{' '}
            <Settings2 size={17} />
          </Link>
        )}
        <button
          className="text-link"
          onClick={async () => {
            await api('/auth/sign-out', {});
            await refresh();
            go('/');
          }}
        >
          {textForLocale('Me déconnecter ')}
          <LogOut size={16} />
        </button>
      </div>
      {new URLSearchParams(location.search).has('commande') && (
        <CheckoutStatus
          id={new URLSearchParams(location.search).get('commande')!}
          onConfirmed={load}
        />
      )}
      {new URLSearchParams(location.search).has('abandon') && (
        <Notice>
          {textForLocale(
            'Le paiement a été interrompu. La réservation expirera automatiquement. Aucun billet n’est délivré tant que le paiement n’est pas confirmé.',
          )}
        </Notice>
      )}
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      {!state ? (
        <p>{textForLocale('Chargement des dossiers…')}</p>
      ) : !state.registrations.length ? (
        <div className="empty">
          <Ticket size={40} />
          <h2>{textForLocale('Votre prochain défi vous attend.')}</h2>
          <p>{textForLocale('Aucune inscription pour le moment.')}</p>
          <Link className="text-link" to="/activites">
            {textForLocale('Découvrir les activités ')}
            <ArrowRight size={18} />
          </Link>
        </div>
      ) : (
        <div className="participant-list">
          {state.registrations.map((r: any) => (
            <article className="registration-card" key={r.id}>
              <div className="registration-card-heading">
                <span className={'status ' + r.status}>{statuses[r.status] || r.status}</span>
                <span className="small">Nº {r.id.slice(0, 8)}</span>
              </div>
              <h2>
                {r.activity_name} <span>{r.distance}</span>
              </h2>
              <p>
                {r.first_name} {r.last_name} · {r.email}
              </p>
              <ListingPreference registration={r} onSaved={load} />
              <div className="summary-line">
                <span>{textForLocale('Prix de cette participation')}</span>
                <strong>{money(r.price)}</strong>
              </div>
              <details className="payment-details">
                <summary>{textForLocale('Paiement et reçu du dossier')}</summary>
                <div className="summary-line">
                  <span>{textForLocale('Total / remboursé')}</span>
                  <strong>
                    {money(r.order_amount)} / {money(r.refunded)}
                  </strong>
                </div>
                <Link className="text-link" to={'/recu/' + r.order_id}>
                  {textForLocale('Reçu de paiement')}
                </Link>
              </details>
              <details>
                <summary>
                  {textForLocale('Mes réponses et consentements ')}
                  <ChevronDown size={16} />
                </summary>
                <dl>
                  {r.fields.map((f: any) => (
                    <React.Fragment key={f.id}>
                      <dt>{f.label}</dt>
                      <dd>
                        {typeof r.answers[f.id] === 'boolean'
                          ? r.answers[f.id]
                            ? textForLocale('Oui')
                            : textForLocale('Non')
                          : r.answers[f.id] || '—'}
                      </dd>
                    </React.Fragment>
                  ))}
                </dl>
                <p>
                  {textForLocale('Conditions acceptées le ')}
                  {date(r.accepted_at)} · {r.conditions_version}
                  <br />
                  {textForLocale('Photos : ')}
                  {r.photo ? textForLocale('Oui') : textForLocale('Non')}
                  {textForLocale(' · Communications promotionnelles :')}{' '}
                  {r.marketing ? textForLocale('Oui') : textForLocale('Non')}
                </p>
                <details>
                  <summary>{textForLocale('Texte des conditions acceptées')}</summary>
                  <p className="prewrap">{r.conditions_snapshot}</p>
                </details>
                <form className="form-grid" onSubmit={(e) => edit(e, r.id)}>
                  {[
                    ['phone', textForLocale('Téléphone')],
                    ['emergency_name', textForLocale('Contact d’urgence')],
                    ['emergency_phone', textForLocale('Téléphone d’urgence')],
                  ]
                    .filter(([k]) => data.settings.editableFields.includes(k))
                    .map(([k, l]) => (
                      <Field label={l} key={k}>
                        <input name={k} defaultValue={r[k]} required />
                      </Field>
                    ))}
                  <Button type="submit">{textForLocale('Enregistrer les coordonnées')}</Button>
                </form>
              </details>
              <div className="actions">
                {['confirmed', 'partially_refunded'].includes(r.status) && (
                  <>
                    <Link className="text-link" to={'/mon-jour-j?participation=' + r.id}>
                      {textForLocale('Préparer mon jour J')}
                    </Link>
                    <button className="button" onClick={() => showTicket(r.id)}>
                      {textForLocale('Voir mon QR ')}
                      <Ticket size={17} />
                    </button>
                    <Link className="button light" to={'/billet/' + r.id}>
                      {textForLocale('Ouvrir mon billet')}
                    </Link>
                    <button
                      className="text-link"
                      disabled={busy === r.order_id}
                      onClick={() => cancel(r.order_id, r.id)}
                    >
                      {textForLocale('Annuler cette participation')}
                    </button>
                    <button
                      className="text-link"
                      disabled={busy === r.order_id}
                      onClick={() => cancel(r.order_id)}
                    >
                      {textForLocale('Annuler tout le dossier')}
                    </button>
                  </>
                )}
                {r.status === 'pending' && (
                  <button
                    className="button"
                    onClick={async () => {
                      try {
                        const x = await api('/orders/' + r.order_id + '/checkout', {});
                        location.assign(x.url);
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    {textForLocale('Reprendre le paiement ')}
                    <ArrowUpRight size={17} />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {state?.messages.length > 0 && (
        <section className="inbox">
          <h2>{textForLocale('Les messages de l’organisation')}</h2>
          {state.messages.map((m: any, i: number) => (
            <details key={i}>
              <summary>
                {m.subject}
                <span className="small">{date(m.created_at)}</span>
              </summary>
              <p className="prewrap">{m.body}</p>
            </details>
          ))}
        </section>
      )}
      <details className="privacy-tools">
        <summary>{textForLocale('Mes données personnelles')}</summary>
        <button
          type="button"
          className="text-link"
          onClick={() =>
            downloadPrivate('/account/export', 'mes-donnees.json').catch((e) => setError(e.message))
          }
        >
          {textForLocale('Exporter mes données ')}
          <Download size={16} />
        </button>
        <button
          className="text-link"
          onClick={async () => {
            if (confirm(textForLocale('Transmettre une demande de suppression au responsable?'))) {
              try {
                const r = await api('/account/deletion-request', {});
                setMessage(r.message);
              } catch (e) {
                setError((e as Error).message);
              }
            }
          }}
        >
          {textForLocale('Demander la suppression de mes données')}
        </button>
      </details>
      {ticket && (
        <div className="modal-backdrop" onClick={() => closeTicket()}>
          <section
            className="ticket-modal"
            role="dialog"
            aria-modal="true"
            aria-label={textForLocale('Votre billet')}
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeTicket();
              if (e.key === 'Tab') {
                const nodes = e.currentTarget.querySelectorAll<HTMLElement>('button,a[href]');
                const first = nodes[0],
                  last = nodes[nodes.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first.focus();
                }
              }
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              autoFocus
              onClick={() => closeTicket()}
              aria-label={textForLocale('Fermer')}
            >
              <X />
            </button>
            <p className="eyebrow">
              RIDE FOR BRAINS · {eventDate(data.settings).toLocaleUpperCase('fr-CA')}
            </p>
            <h2>
              {ticket.name} · {ticket.distance}
            </h2>
            <p>
              {ticket.first_name} {ticket.last_name}
            </p>
            <img
              src={ticket.image}
              width="260"
              height="260"
              alt={textForLocale('Code QR du billet, à présenter à l’accueil')}
            />
            <p className="small">
              {textForLocale('Billet personnel · Nº ')}
              {ticket.id.slice(0, 8)}
            </p>
            <a
              className="button"
              href={ticket.image}
              download={'billet-' + ticket.id.slice(0, 8) + '.png'}
            >
              {textForLocale('Télécharger le QR ')}
              <Download size={17} />
            </a>
            <p className="small">
              {textForLocale('Conservez cette image pour la présenter à l’accueil.')}
            </p>
          </section>
        </div>
      )}
    </Page>
  );
}
function DevMail() {
  const { data } = useApp();
  const [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState('');
  const load = () =>
    api('/dev/mail')
      .then(setRows)
      .catch((e) => setError(e.message));
  useEffect(() => {
    if (data.environment === 'development') load();
  }, []);
  return (
    <Page
      eyebrow="DÉVELOPPEMENT LOCAL UNIQUEMENT"
      title="La boîte de courriels locale."
      intro="Ces messages restent sur cet ordinateur. Ils n’ont pas été envoyés à leurs destinataires."
    >
      {data.environment !== 'development' ? (
        <Notice error>Cette page est indisponible en production.</Notice>
      ) : (
        <>
          <Button onClick={load}>Actualiser</Button>
          {error && <Notice error>{error}</Notice>}
          {rows.map((r) => (
            <article className="local-mail" key={r.id}>
              <span className="small">
                {r.recipient} · {date(r.created_at)}
              </span>
              <h3>{r.subject}</h3>
              <p className="prewrap">{r.body}</p>
              {r.body.match(/https?:\/\/[^\s]+/g)?.map((url: string) =>
                url.startsWith(location.origin) ? (
                  <a key={url} className="button" href={url}>
                    Ouvrir ce lien local <ArrowUpRight size={16} />
                  </a>
                ) : null,
              )}
            </article>
          ))}
          {!rows.length && <p>Aucun courriel local.</p>}
        </>
      )}
    </Page>
  );
}
function Unsubscribe() {
  const [result, setResult] = useState(''),
    [error, setError] = useState('');
  return (
    <Page
      eyebrow={textForLocale('VOS PRÉFÉRENCES')}
      title={textForLocale('Gardez le lien à votre façon.')}
    >
      {result ? (
        <Notice>{result}</Notice>
      ) : (
        <>
          <p>
            {textForLocale(
              'Vous pouvez vous désabonner des messages promotionnels. Les informations nécessaires à votre participation restent accessibles dans votre espace.',
            )}
          </p>
          {error && <Notice error>{error}</Notice>}
          <Button
            onClick={async () => {
              try {
                await api('/unsubscribe', {
                  token: new URLSearchParams(location.search).get('token'),
                });
                setResult(textForLocale('Vous êtes désabonné des communications promotionnelles.'));
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {textForLocale('Confirmer mon désabonnement')}
          </Button>
        </>
      )}
    </Page>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
