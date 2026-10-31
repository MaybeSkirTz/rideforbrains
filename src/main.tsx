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
import { donationNotice } from '../shared/event';
import Account from './Account';
import { Home, Activities, Practical, Team, Cause, FAQ } from './Public';

import Turnstile from './Turnstile';
import { track } from './tracking';
const eventDate = (s: any) =>
  new Date(s.eventAt).toLocaleDateString('fr-CA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Toronto',
  });
import './styles.css';
import './editorial.css';
const TicketPage = lazy(() => import('./TicketPage'));
const Admin = lazy(() => import('./Admin'));
function App() {
  const [data, setData] = useState<Data | null>(null),
    [user, setUser] = useState<any>(null),
    [error, setError] = useState(''),
    [url, setUrl] = useState(location.pathname + location.search);
  const path = url.split('?')[0];
  const refresh = async () => {
    const [d, u] = await Promise.all([api('/public'), api('/me')]);
    setData(d);
    setUser(u.user);
  };
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
    const nav = () => setUrl(location.pathname + location.search);
    addEventListener('popstate', nav);
    return () => removeEventListener('popstate', nav);
  }, []);
  useEffect(() => {
    const name: Record<string, string> = {
      '/inscription': 'Inscription',
      '/espace': 'Mon espace',
      '/connexion': 'Connexion',
      '/admin': 'Administration',
      '/activites': 'Les activités',
      '/infos': 'Infos pratiques',
      '/cause': 'La cause',
      '/equipe': 'Notre histoire',
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
        <Button onClick={() => location.reload()}>Réessayer</Button>
      </div>
    );
  if (!data)
    return (
      <div className="loading">
        <img src="/assets/ride-for-brains.png" alt="Ride For Brains" width="120" />
        <p>Chaque kilomètre commence ici…</p>
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
  else if (path.startsWith('/billet/'))
    page = (
      <Suspense fallback={<p>Chargement du billet…</p>}>
        <TicketPage id={path.slice(8)} />
      </Suspense>
    );
  else if (path === '/espace') page = <Participant />;
  else if (path.startsWith('/admin'))
    page = (
      <Suspense fallback={<p>Chargement de l’administration…</p>}>
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
      <Page eyebrow="Hors parcours" title="Cette page n’existe pas.">
        <Link to="/" className="button">
          Revenir à l’accueil <ArrowRight size={18} />
        </Link>
      </Page>
    );
  return (
    <Context.Provider value={{ data, user, refresh }}>
      <a className="skip" href="#main">
        Aller au contenu
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
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (open) document.querySelector<HTMLElement>('#primary-nav a')?.focus({ preventScroll: true });
  }, [open]);
  return (
    <>
      {data.environment !== 'production' && (
        <div className="dev-banner">
          {data.environment === 'development'
            ? 'Aperçu local · aucun paiement réel'
            : 'Mode test · aucun paiement réel'}
          {data.environment === 'development' && (
            <Link to="/courriels-locaux">
              Boîte de courriels locale <ArrowUpRight size={12} />
            </Link>
          )}
        </div>
      )}
      <header
        className="header"
        onKeyDown={(e) => {
          if (e.key === 'Escape' && open) {
            setOpen(false);
            document.querySelector<HTMLElement>('.menu-toggle')?.focus({ preventScroll: true });
          }
        }}
      >
        <Link to="/" className="brand" aria-label="Ride For Brains, accueil">
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
          aria-label="Navigation principale"
          className={open ? 'nav open' : 'nav'}
        >
          <Link to="/activites" className={path === '/activites' ? 'active' : ''}>
            Les activités
          </Link>
          <Link to="/cause">La cause</Link>
          <Link to="/infos">Infos pratiques</Link>
          <Link to="/equipe">Notre histoire</Link>
          <Link to={user ? '/espace' : '/connexion'} className="account-link">
            <UserRound size={17} />
            Mon espace
          </Link>
        </nav>
        <Link to="/inscription" className="button nav-cta">
          Je participe <ArrowUpRight size={17} />
        </Link>
        <button
          className="menu-toggle"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="primary-nav"
          aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
        >
          {open ? <X /> : <Menu />}
        </button>
      </header>
    </>
  );
}
function Footer() {
  const { data, user } = useApp();
  return (
    <footer>
      <div className="footer-top">
        <div>
          <p className="eyebrow lime-text">ON SE RETROUVE SUR LA LIGNE DE DÉPART.</p>
          <h2>
            On se retrouve
            <br />
            au départ<span className="lime-text">.</span>
          </h2>
        </div>
        <Link to="/inscription" className="button lime">
          Trouver mon activité <ArrowUpRight size={20} />
        </Link>
      </div>
      <div className="footer-grid">
        <div>
          <Link to="/" className="footer-brand">
            RIDE FOR BRAINS.
          </Link>
          <p>Pour eux, chaque kilomètre compte.</p>
          <span className="small">
            {data.settings.edition} · {eventDate(data.settings)}
          </span>
        </div>
        <div>
          <b>L’événement</b>
          <Link to="/activites">Vélo, course et marche</Link>
          <Link to="/infos">Renseignements pratiques</Link>
          <Link to="/faq">Questions fréquentes</Link>
        </div>
        <div>
          <b>Ensemble</b>
          <Link to="/benevolat">Devenir bénévole</Link>
          <Link to="/partenaires">Devenir partenaire</Link>
          <Link to="/contact">Nous joindre</Link>
          <a href={data.settings.donationUrl} target="_blank" rel="noopener noreferrer">
            Faire un don <ArrowUpRight size={13} />
          </a>
        </div>
        <div>
          <b>Votre espace</b>
          <Link to="/espace">Mes inscriptions</Link>
          <Link to="/conditions">Conditions d’inscription</Link>
          <Link to="/annulation">Annulation et remboursement</Link>
          <Link to="/confidentialite">Confidentialité</Link>
          {user && user.role !== 'participant' && <Link to="/admin">Administration</Link>}
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Ride For Brains</span>
        <span>Les dons sont effectués directement sur la plateforme de Brain Canada.</span>
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
      ? 'L’équipe a besoin de votre énergie.'
      : kind === 'sponsor'
        ? 'Faisons du chemin ensemble.'
        : 'On garde le contact.';
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
          ? 'Dites-nous comment vous aimeriez contribuer. L’organisation vous recontactera.'
          : kind === 'sponsor'
            ? 'Vous souhaitez soutenir l’événement? Présentez-nous votre projet de partenariat.'
            : 'Une question sur votre inscription ou sur la journée? Écrivez-nous.'
      }
    >
      <div className="form-layout">
        <div className="contact-aside">
          <Mail size={30} />
          <h3>Parlons-en.</h3>
          <a href={'mailto:' + data.settings.contact}>{data.settings.contact}</a>
          <p>Thomas · Équipe Ride For Brains</p>
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
            <Field label="Votre nom">
              <input name="name" required maxLength={150} autoComplete="name" />
            </Field>
            <Field label="Votre courriel">
              <input name="email" type="email" required autoComplete="email" />
            </Field>
            <Field
              label={
                kind === 'volunteer'
                  ? 'Disponibilités et tâches qui vous intéressent'
                  : 'Votre message'
              }
            >
              <textarea name="message" required minLength={10} maxLength={5000} rows={5} />
            </Field>
            <label className="checkbox">
              <input type="checkbox" required />
              J’accepte que l’équipe utilise ces renseignements pour répondre à ma demande.
            </label>
            <Turnstile onToken={setToken} />
            {error && <Notice error>{error}</Notice>}
            <Button busy={busy}>
              Transmettre ma demande <ArrowUpRight size={18} />
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
  return (
    <Page
      eyebrow={
        s.legalApproved ? 'INFORMATIONS ET POLITIQUES' : 'BROUILLON À VALIDER PAR L’ORGANISATION'
      }
      title={
        page === '/confidentialite'
          ? 'Vos données, avec attention.'
          : page === '/annulation'
            ? 'Annulation et remboursement.'
            : 'Les conditions de participation.'
      }
    >
      <div className="prose legal">
        {page === '/annulation' ? (
          <>
            <h2>Une règle simple</h2>
            <p>
              À 15 jours ou plus du début de l’événement : remboursement complet de l’inscription. À
              moins de 15 jours : aucun remboursement.
            </p>
            <p>
              Le calcul utilise le début de l’événement, fixé au{' '}
              {new Date(s.eventAt).toLocaleString('fr-CA', { timeZone: 'America/Toronto' })}, heure
              du Québec. Une demande concernant un dossier avec plusieurs participants concerne tout
              le dossier.
            </p>
            <p>
              La demande se fait depuis l’espace de l’acheteur. Un remboursement est confirmé
              seulement après son traitement par le prestataire. Les dons à Brain Canada sont gérés
              séparément sur sa plateforme.
            </p>
            <p>
              Les dispositions en cas d’annulation ou de report par l’organisation restent à valider
              avant ouverture.
            </p>
          </>
        ) : (
          <p className="prewrap">{page === '/confidentialite' ? s.privacy : s.terms}</p>
        )}
        <p className="small">Version des conditions : {s.termsVersion}</p>
        <a href={'mailto:' + s.contact} className="text-link">
          Contacter le responsable <ArrowUpRight size={16} />
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
      eyebrow="LISTE D’ATTENTE"
      title="Gardons une place pour votre élan."
      intro="L’inscription sur cette liste ne réserve aucune place et ne déclenche aucun paiement."
    >
      {!activity ? (
        <Notice error>Activité introuvable.</Notice>
      ) : !user ? (
        <Notice>
          <p>
            Connectez-vous pour rejoindre la liste d’attente. Revenez ensuite sur cette activité.
          </p>
          <Link className="button" to={accountUrl(location.pathname + location.search)}>
            Me connecter
          </Link>
        </Notice>
      ) : done ? (
        <Notice>
          Votre demande est enregistrée. L’équipe doit vous contacter si une place devient
          disponible; aucune inscription n’est confirmée automatiquement.
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
                adult: true,
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
            <Field label="Prénom">
              <input name="firstName" required maxLength={150} />
            </Field>
            <Field label="Nom">
              <input name="lastName" required maxLength={150} />
            </Field>
          </div>
          <label className="checkbox">
            <input type="checkbox" required />
            J’aurai au moins 18 ans le jour de l’événement.
          </label>
          {error && <Notice error>{error}</Notice>}
          <Button busy={busy}>Rejoindre la liste d’attente</Button>
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
    adult: false,
    emergencyName: '',
    emergencyPhone: '',
    answers: {} as any,
    formVersion: activity?.form_version || 1,
    conditions: false,
    photo: false,
    marketing: false,
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
  useEffect(() => {
    setKey(crypto.randomUUID());
  }, [people, promo]);
  useEffect(() => {
    if (user)
      api('/draft')
        .then((d) => {
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
                    }
                  : null;
              })
              .filter(Boolean);
            setPeople(restored.length ? restored : [emptyParticipant(initial)]);
            setPromo(d.promo || '');
            setDraftMessage(
              'Votre brouillon a été restauré. Relisez et acceptez de nouveau les conditions avant de confirmer.',
            );
          }
        })
        .catch((e) => setError(e.message));
  }, [user?.id]);
  const saveDraft = async () => {
    try {
      await api(
        user ? '/draft' : '/draft/guest',
        { participants: people, promo },
        user ? 'PUT' : 'POST',
      );
      setDraftMessage(
        user
          ? 'Votre brouillon est enregistré dans votre compte. Aucune place n’est réservée.'
          : 'Votre brouillon est conservé de façon sécurisée pendant deux heures sur ce navigateur. Aucune place n’est réservée.',
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const s = data.settings;
  const change = (i: number, k: string, v: any) =>
    setPeople((p) => p.map((r, n) => (i === n ? { ...r, [k]: v } : r)));
  const canRegister = data.environment === 'development' || s.registrationOpen;
  const next = async (e: any) => {
    e.preventDefault();
    setError('');
    if (step < 3) {
      if (step === 2) {
        setBusy(true);
        try {
          if (!user) {
            await api('/draft/guest', { participants: people, promo });
            go(accountUrl(location.pathname + location.search));
            return;
          }
          const q = await api('/quote', { participants: people.map((p) => p.activityId), promo });
          setQuote(q);
          setStep(3);
          track('form_complete', people[0]?.activityId);
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
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page
      eyebrow="VOTRE PROCHAIN DÉPART"
      title="Faites partie du mouvement."
      intro="Une inscription par personne et par activité. Les dons à Brain Canada se font séparément."
    >
      {!canRegister ? (
        <div className="closed-panel">
          <Clock size={34} />
          <h2>Les inscriptions ouvriront bientôt.</h2>
          <p>
            Les activités et leurs tarifs sont déjà disponibles. L’organisation annoncera
            l’ouverture dès que tous les renseignements seront confirmés.
          </p>
          <Link to="/activites" className="button">
            Explorer les activités <ArrowRight size={18} />
          </Link>
        </div>
      ) : (
        <>
          {draftMessage && <Notice>{draftMessage}</Notice>}
          <div className="actions" style={{ marginBottom: 25, marginTop: 0 }}>
            <button type="button" className="text-link" onClick={saveDraft}>
              Enregistrer pour plus tard
            </button>
          </div>
          <ol className="steps">
            {['Le choix', 'Les participants', 'Le récapitulatif'].map((t, i) => (
              <li key={t} className={step >= i + 1 ? 'current' : ''}>
                <span>{step > i + 1 ? <Check size={15} /> : i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
          <div className="registration-layout">
            <form onSubmit={next} className="registration-form">
              {step === 1 ? (
                <>
                  <h2>Quel sera votre mouvement?</h2>
                  {people.map((p, i) => (
                    <div className="person-select" key={i}>
                      <Field label={'Participation ' + (i + 1)}>
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
                                    }
                                  : r,
                              ),
                            );
                          }}
                        >
                          {data.activities.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.sport === 'velo'
                                ? 'Vélo'
                                : a.sport === 'course'
                                  ? 'Course'
                                  : 'Marche'}{' '}
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
                          aria-label={'Retirer la participation ' + (i + 1)}
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
                    Ajouter une personne ou une activité
                  </button>
                  <Field label="Code promotionnel (facultatif)">
                    <input
                      value={promo}
                      onChange={(e) => setPromo(e.target.value.toUpperCase())}
                      maxLength={40}
                    />
                  </Field>
                  <Notice>18 ans et plus. Aucune donnée médicale n’est demandée.</Notice>
                </>
              ) : step === 2 ? (
                <>
                  <h2>Qui prend le départ?</h2>
                  {people.map((p, i) => {
                    const activity = data.activities.find((a) => a.id === p.activityId);
                    return (
                      <fieldset className="participant-fields" key={i}>
                        <legend>
                          {i + 1}. {activity.name} · {activity.distance}
                        </legend>
                        <div className="form-grid">
                          <Field label="Prénom">
                            <input
                              required
                              maxLength={150}
                              value={p.firstName}
                              onChange={(e) => change(i, 'firstName', e.target.value)}
                              autoComplete="given-name"
                            />
                          </Field>
                          <Field label="Nom">
                            <input
                              required
                              maxLength={150}
                              value={p.lastName}
                              onChange={(e) => change(i, 'lastName', e.target.value)}
                              autoComplete="family-name"
                            />
                          </Field>
                          <Field label="Courriel du participant">
                            <input
                              required
                              type="email"
                              value={p.email}
                              onChange={(e) => change(i, 'email', e.target.value)}
                              autoComplete="email"
                            />
                          </Field>
                          <Field label="Téléphone">
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
                          <Field label="Contact d’urgence · nom">
                            <input
                              required
                              maxLength={150}
                              value={p.emergencyName}
                              onChange={(e) => change(i, 'emergencyName', e.target.value)}
                            />
                          </Field>
                          <Field label="Contact d’urgence · téléphone">
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
                        <label className="checkbox">
                          <input
                            type="checkbox"
                            checked={p.adult}
                            required
                            onChange={(e) => change(i, 'adult', e.target.checked)}
                          />
                          Cette personne aura au moins 18 ans le jour de l’événement.
                        </label>
                        <label className="checkbox">
                          <input
                            type="checkbox"
                            checked={p.authority}
                            required
                            onChange={(e) => change(i, 'authority', e.target.checked)}
                          />
                          Je suis cette personne ou j’ai son autorisation pour l’inscrire et
                          transmettre ses consentements.
                        </label>
                        <label className="checkbox">
                          <input
                            type="checkbox"
                            checked={p.conditions}
                            required
                            onChange={(e) => change(i, 'conditions', e.target.checked)}
                          />
                          J’ai lu et j’accepte les conditions ci-dessous pour cette participation.
                        </label>
                        <label className="checkbox">
                          <input
                            type="checkbox"
                            checked={p.photo}
                            onChange={(e) => change(i, 'photo', e.target.checked)}
                          />
                          J’accepte les photos et vidéos de cette personne pour les communications
                          de l’événement. (Facultatif)
                        </label>
                        <label className="checkbox">
                          <input
                            type="checkbox"
                            checked={p.marketing}
                            onChange={(e) => change(i, 'marketing', e.target.checked)}
                          />
                          Cette personne souhaite recevoir les communications promotionnelles.
                          (Facultatif)
                        </label>
                      </fieldset>
                    );
                  })}
                  <details className="terms-box" open>
                    <summary>Conditions · version {s.termsVersion}</summary>
                    <p className="prewrap">{s.terms}</p>
                  </details>
                </>
              ) : (
                <>
                  <h2>Tout est prêt pour le départ?</h2>
                  {people.map((p, i) => {
                    const a = data.activities.find((a) => a.id === p.activityId);
                    return (
                      <div className="review-person" key={i}>
                        <span className="eyebrow">PARTICIPATION {i + 1}</span>
                        <h3>
                          {p.firstName} {p.lastName}
                        </h3>
                        <p>
                          {a.name} · {a.distance}
                        </p>
                        <p>{p.email}</p>
                        <details>
                          <summary>Relire les réponses et consentements</summary>
                          <p>
                            Téléphone : {p.phone}
                            <br />
                            Urgence : {p.emergencyName} · {p.emergencyPhone}
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
                            Photos : {p.photo ? 'oui' : 'non'} · Promotions :{' '}
                            {p.marketing ? 'oui' : 'non'}
                            <br />
                            Conditions acceptées · {s.termsVersion}
                          </p>
                        </details>
                      </div>
                    );
                  })}
                  <Notice>
                    <ShieldCheck size={19} />
                    <p>
                      {quote?.amount === 0
                        ? 'Cette inscription est gratuite après application du tarif ou de la réduction.'
                        : 'Le paiement s’effectue sur la page sécurisée Stripe, puis vous revenez ici. La confirmation dépend de la vérification du paiement par le serveur.'}
                    </p>
                  </Notice>
                  <p className="fee-disclosure">{donationNotice}</p>
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
                    Retour
                  </button>
                )}
                {step < 3 ? (
                  <Button type="submit" busy={busy}>
                    {step === 2 && !user ? 'Créer un compte ou me connecter' : 'Continuer'}{' '}
                    <ArrowRight size={18} />
                  </Button>
                ) : (
                  <Button type="button" busy={busy} onClick={pay}>
                    {quote?.amount === 0
                      ? 'Confirmer mon inscription'
                      : 'Payer ' + money(quote?.amount || 0)}{' '}
                    <ArrowUpRight size={18} />
                  </Button>
                )}
              </div>
            </form>
            <aside className="order-summary">
              <span className="eyebrow">VOTRE RENDEZ-VOUS</span>
              <h3>{eventDate(s)}</h3>
              <p>
                Accueil dès {s.reception.replace(':', ' h ')}
                <br />
                {s.location || 'Lieu à confirmer'}
              </p>
              <hr />
              {people.map((p, i) => {
                const a = data.activities.find((a) => a.id === p.activityId);
                return (
                  <div className="summary-line" key={i}>
                    <span>
                      {a.sport} · {a.distance}
                    </span>
                    <b>{money(a.price)}</b>
                  </div>
                );
              })}
              {quote?.discount > 0 && (
                <div className="summary-line">
                  <span>Réduction</span>
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
                Dollars canadiens.{' '}
                {s.taxMode === 'included'
                  ? 'Taxes incluses.'
                  : s.taxMode === 'not_applicable'
                    ? 'Taxes non applicables selon la configuration de l’organisation.'
                    : 'Fiscalité à valider avant l’ouverture réelle.'}
              </p>
              <p className="small">
                Remboursement à 100 % à 15 jours ou plus de l’événement. Aucun remboursement à moins
                de 15 jours.
              </p>
              <Link to="/annulation" className="text-link small">
                Lire la politique <ArrowUpRight size={14} />
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
      <Page eyebrow="VOTRE ESPACE" title="Vos inscriptions vous attendent.">
        <Link to="/connexion" className="button">
          Me connecter <ArrowRight size={18} />
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
          ? 'Annuler uniquement cette participation? Les autres participations restent valides. Le remboursement dépend du délai de 15 jours.'
          : 'Annuler toutes les participations de ce dossier? Le remboursement sera calculé selon la politique affichée.',
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
          ? 'Demande enregistrée. Remboursement en traitement : ' + money(r.refundRequested)
          : 'Dossier annulé.',
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
      setMessage('Coordonnées mises à jour.');
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Page
      eyebrow="VOTRE ESPACE PARTICIPANT"
      title={'Bonjour ' + user.name.split(' ')[0] + '.'}
      intro="Les dossiers ci-dessous sont ceux que vous avez inscrits avec ce compte."
    >
      <div className="actions account-actions">
        <Link to="/inscription" className="button">
          Ajouter une inscription <Plus size={17} />
        </Link>
        {user.role !== 'participant' && (
          <Link className="button outline" to="/admin">
            Administration <Settings2 size={17} />
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
          Me déconnecter <LogOut size={16} />
        </button>
      </div>
      {new URLSearchParams(location.search).has('commande') && (
        <Notice>
          Nous vérifions votre paiement. Le statut ci-dessous change seulement après confirmation
          par Stripe.{' '}
          <button className="text-link" onClick={load}>
            Actualiser
          </button>
        </Notice>
      )}
      {new URLSearchParams(location.search).has('abandon') && (
        <Notice>
          Le paiement a été interrompu. La réservation expirera automatiquement. Aucun billet n’est
          délivré tant que le paiement n’est pas confirmé.
        </Notice>
      )}
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      {!state ? (
        <p>Chargement des dossiers…</p>
      ) : !state.registrations.length ? (
        <div className="empty">
          <Ticket size={40} />
          <h2>Votre prochain défi vous attend.</h2>
          <p>Aucune inscription pour le moment.</p>
          <Link className="text-link" to="/activites">
            Découvrir les activités <ArrowRight size={18} />
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
              <div className="summary-line">
                <span>Prix de cette participation</span>
                <strong>{money(r.price)}</strong>
              </div>
              <div className="summary-line">
                <span>Dossier complet · paiement / remboursé</span>
                <strong>
                  {money(r.order_amount)} / {money(r.refunded)}
                </strong>
              </div>
              <details>
                <summary>
                  Mes réponses et consentements <ChevronDown size={16} />
                </summary>
                <dl>
                  {r.fields.map((f: any) => (
                    <React.Fragment key={f.id}>
                      <dt>{f.label}</dt>
                      <dd>
                        {typeof r.answers[f.id] === 'boolean'
                          ? r.answers[f.id]
                            ? 'Oui'
                            : 'Non'
                          : r.answers[f.id] || '—'}
                      </dd>
                    </React.Fragment>
                  ))}
                </dl>
                <p>
                  Conditions acceptées le {date(r.accepted_at)} · {r.conditions_version}
                  <br />
                  Photos : {r.photo ? 'Oui' : 'Non'} · Communications promotionnelles :{' '}
                  {r.marketing ? 'Oui' : 'Non'}
                </p>
                <details>
                  <summary>Texte des conditions acceptées</summary>
                  <p className="prewrap">{r.conditions_snapshot}</p>
                </details>
                <form className="form-grid" onSubmit={(e) => edit(e, r.id)}>
                  {[
                    ['phone', 'Téléphone'],
                    ['emergency_name', 'Contact d’urgence'],
                    ['emergency_phone', 'Téléphone d’urgence'],
                  ]
                    .filter(([k]) => data.settings.editableFields.includes(k))
                    .map(([k, l]) => (
                      <Field label={l} key={k}>
                        <input name={k} defaultValue={r[k]} required />
                      </Field>
                    ))}
                  <Button type="submit">Enregistrer les coordonnées</Button>
                </form>
              </details>
              <div className="actions">
                {['confirmed', 'partially_refunded'].includes(r.status) && (
                  <>
                    <button className="button" onClick={() => showTicket(r.id)}>
                      Aperçu du QR <Ticket size={17} />
                    </button>
                    <Link className="button light" to={'/billet/' + r.id}>
                      Ouvrir mon billet
                    </Link>
                    <button
                      className="text-link"
                      disabled={busy === r.order_id}
                      onClick={() => cancel(r.order_id, r.id)}
                    >
                      Annuler cette participation
                    </button>
                    <button
                      className="text-link"
                      disabled={busy === r.order_id}
                      onClick={() => cancel(r.order_id)}
                    >
                      Annuler tout le dossier
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
                    Reprendre le paiement <ArrowUpRight size={17} />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {state?.messages.length > 0 && (
        <section className="inbox">
          <h2>Les messages de l’organisation</h2>
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
        <summary>Mes données personnelles</summary>
        <button
          type="button"
          className="text-link"
          onClick={() =>
            downloadPrivate('/account/export', 'mes-donnees.json').catch((e) => setError(e.message))
          }
        >
          Exporter mes données <Download size={16} />
        </button>
        <button
          className="text-link"
          onClick={async () => {
            if (confirm('Transmettre une demande de suppression au responsable?')) {
              try {
                const r = await api('/account/deletion-request', {});
                setMessage(r.message);
              } catch (e) {
                setError((e as Error).message);
              }
            }
          }}
        >
          Demander la suppression de mes données
        </button>
      </details>
      {ticket && (
        <div className="modal-backdrop" onClick={() => closeTicket()}>
          <section
            className="ticket-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Votre billet"
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
              aria-label="Fermer"
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
              alt="Code QR du billet, à présenter à l’accueil"
            />
            <p className="small">Billet personnel · Nº {ticket.id.slice(0, 8)}</p>
            <a
              className="button"
              href={ticket.image}
              download={'billet-' + ticket.id.slice(0, 8) + '.png'}
            >
              Télécharger le QR <Download size={17} />
            </a>
            <p className="small">Conservez cette image pour la présenter à l’accueil.</p>
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
    <Page eyebrow="VOS PRÉFÉRENCES" title="Gardez le lien à votre façon.">
      {result ? (
        <Notice>{result}</Notice>
      ) : (
        <>
          <p>
            Vous pouvez vous désabonner des messages promotionnels. Les informations nécessaires à
            votre participation restent accessibles dans votre espace.
          </p>
          {error && <Notice error>{error}</Notice>}
          <Button
            onClick={async () => {
              try {
                await api('/unsubscribe', {
                  token: new URLSearchParams(location.search).get('token'),
                });
                setResult('Vous êtes désabonné des communications promotionnelles.');
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Confirmer mon désabonnement
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
