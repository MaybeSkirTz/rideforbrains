import React, { useEffect, useState } from 'react';
import { ArrowRight, ArrowLeft, Mail, Check } from 'lucide-react';
import { useApp } from './context';
import { Page, Link, Button, Field, Notice } from './ui';
import { api } from './api';
import { safeReturnUrl } from '../shared/navigation';
import Turnstile from './Turnstile';

export default function Account() {
  const { data, user } = useApp();
  const params = new URLSearchParams(location.search);
  const [mode, setMode] = useState<'create' | 'sign-in' | null>(
    params.get('mode') === 'create'
      ? 'create'
      : params.get('mode') === 'sign-in'
        ? 'sign-in'
        : null,
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [sent, setSent] = useState(false),
    [token, setToken] = useState(''),
    [challenge, setChallenge] = useState(0),
    [address, setAddress] = useState('');
  const returnTo = safeReturnUrl(params.get('retour'));
  useEffect(() => {
    const target =
      mode && !sent
        ? document.querySelector<HTMLElement>('.account-form input')
        : document.querySelector<HTMLElement>('.account-page h1');
    target?.focus();
  }, [mode, sent]);
  if (user)
    return (
      <Page eyebrow="Votre compte" title="Vous êtes connecté.">
        <p>Votre compte et vos billets vous attendent.</p>
        <Link className="button" to={returnTo}>
          Continuer <ArrowRight size={18} />
        </Link>
      </Page>
    );
  const changeMode = (value: 'create' | 'sign-in' | null) => {
    setMode(value);
    setError('');
    setSent(false);
    setToken('');
    setChallenge((n) => n + 1);
  };
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const f = new FormData(e.currentTarget);
    setAddress(String(f.get('email')));
    try {
      await api('/auth/request/' + mode, {
        email: f.get('email'),
        ...(mode === 'create'
          ? { firstName: f.get('firstName'), lastName: f.get('lastName') }
          : {}),
        returnTo,
        turnstileToken: token,
      });
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
      setToken('');
      setChallenge((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page
      className="account-page"
      eyebrow="Votre compte Ride For Brains"
      title={
        sent
          ? 'Vérifiez votre courriel.'
          : mode === 'create'
            ? 'Votre première participation commence ici.'
            : mode === 'sign-in'
              ? 'Bon retour parmi nous.'
              : 'On se retrouve au départ.'
      }
      intro={
        !mode
          ? 'Choisissez votre point de départ. Votre compte vous permet de retrouver vos inscriptions et vos billets.'
          : undefined
      }
    >
      {!mode ? (
        <div className="account-choices">
          <section>
            <span className="editorial-number" aria-hidden="true">
              01
            </span>
            <h2>
              Je participe
              <br />
              pour la première fois.
            </h2>
            <p>Créez votre compte avec votre prénom, votre nom et votre courriel.</p>
            <button className="button" onClick={() => changeMode('create')}>
              Créer mon compte <ArrowRight size={18} />
            </button>
          </section>
          <section>
            <span className="editorial-number" aria-hidden="true">
              02
            </span>
            <h2>
              J’ai déjà
              <br />
              un compte.
            </h2>
            <p>Retrouvez vos inscriptions avec votre adresse courriel.</p>
            <button className="button outline" onClick={() => changeMode('sign-in')}>
              Me connecter <ArrowRight size={18} />
            </button>
          </section>
        </div>
      ) : sent ? (
        <div className="account-sent" role="status">
          <Mail size={32} />
          <h2>La suite se passe dans votre boîte courriel.</h2>
          <p>
            {mode === 'create'
              ? 'Ouvrez le lien reçu pour vérifier votre adresse et activer votre compte.'
              : 'Si cette adresse correspond à un compte, un lien de connexion vous sera envoyé.'}
          </p>
          <p>
            <strong>{address}</strong>
          </p>
          <p>
            Le lien est valable 10 minutes. Pensez aux courriels indésirables. Vous retrouverez
            ensuite l’étape où vous étiez.
          </p>
          {data.environment === 'development' && (
            <Link to="/courriels-locaux" className="button">
              Ouvrir la boîte locale <ArrowRight size={18} />
            </Link>
          )}
          <button
            className="text-link"
            onClick={() => {
              setSent(false);
              setToken('');
              setChallenge((n) => n + 1);
            }}
          >
            Utiliser une autre adresse
          </button>
        </div>
      ) : (
        <div className="account-layout">
          <form key={mode} className="account-form" onSubmit={submit}>
            <button type="button" className="text-link" onClick={() => changeMode(null)}>
              <ArrowLeft size={16} /> Changer de choix
            </button>
            {mode === 'create' && (
              <div className="form-grid">
                <Field label="Prénom">
                  <input name="firstName" autoComplete="given-name" maxLength={100} required />
                </Field>
                <Field label="Nom">
                  <input name="lastName" autoComplete="family-name" maxLength={100} required />
                </Field>
              </div>
            )}
            <Field label="Adresse courriel">
              <input
                name="email"
                type="email"
                autoComplete="email"
                maxLength={200}
                defaultValue={address}
                required
              />
            </Field>
            <p className="small">
              Aucun mot de passe à créer. Nous vous envoyons un lien sécurisé par courriel.
            </p>
            <Turnstile key={challenge} onToken={setToken} />
            {(error || params.has('erreur')) && (
              <Notice error>
                {error || 'Ce lien n’est plus valide. Demandez-en un nouveau ci-dessous.'}
              </Notice>
            )}
            <Button type="submit" busy={busy}>
              {mode === 'create' ? 'Créer mon compte' : 'Me connecter'} <ArrowRight size={18} />
            </Button>
            <p className="small">
              Votre adresse sert à sécuriser l’accès à vos inscriptions.{' '}
              <Link to="/confidentialite">Confidentialité</Link>
            </p>
          </form>
          <aside className="account-note">
            <div className="account-route" aria-hidden="true">
              <svg viewBox="0 0 300 220">
                <path
                  d="M10 185C100 185 40 35 130 35S190 180 290 60"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle cx="10" cy="185" r="5" fill="currentColor" />
                <circle cx="290" cy="60" r="6" fill="currentColor" />
              </svg>
            </div>
            <h2>
              Un compte.
              <br />
              Votre journée.
            </h2>
            <ul>
              <li>
                <Check size={16} /> Vos inscriptions au même endroit
              </li>
              <li>
                <Check size={16} /> Vos billets pour l’accueil
              </li>
              <li>
                <Check size={16} /> Les nouvelles de l’organisation
              </li>
            </ul>
          </aside>
        </div>
      )}
    </Page>
  );
}
