import { t as textForLocale } from './locale-copy';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowLeft, Mail, Check } from 'lucide-react';
import { useApp } from './context';
import { Page, Link, Button, Field, Notice, go } from './ui';
import { api, saveSessionPreference } from './api';
import { safeReturnUrl } from '../shared/navigation';
import Turnstile from './Turnstile';
import { track } from './tracking';
type Mode = 'create' | 'sign-in' | 'password';
export default function Account() {
  useEffect(() => track('account_step'), []);
  const { data, user, refresh } = useApp(),
    params = new URLSearchParams(location.search);
  const initial = params.get('mode');
  const [mode, setMode] = useState<Mode | null>(
    initial === 'create'
      ? 'create'
      : initial === 'sign-in'
        ? 'sign-in'
        : initial === 'password'
          ? 'password'
          : null,
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [challengeId, setChallengeId] = useState(''),
    [botToken, setBotToken] = useState(''),
    [botKey, setBotKey] = useState(0),
    [cooldown, setCooldown] = useState(0),
    [notice, setNotice] = useState(''),
    [otp, setOtp] = useState(''),
    [newPassword, setNewPassword] = useState('');
  const [details, setDetails] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    rememberMe: false,
  });
  const codeRef = useRef<HTMLInputElement>(null);
  const returnTo = safeReturnUrl(params.get('retour'));
  useEffect(() => {
    if (challengeId) codeRef.current?.focus();
    else document.querySelector<HTMLInputElement>('.account-form input')?.focus();
  }, [mode, challengeId]);
  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((n) => Math.max(0, n - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  const changeMode = (next: Mode | null) => {
    setMode(next);
    setChallengeId('');
    setError('');
    setNotice('');
    setOtp('');
    setNewPassword('');
    setDetails((d) => ({ ...d, password: '' }));
    setBotToken('');
    setBotKey((n) => n + 1);
  };
  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api('/auth/request/' + mode, {
        email: details.email,
        ...(mode !== 'password' ? { password: details.password } : {}),
        ...(mode === 'create' ? { firstName: details.firstName, lastName: details.lastName } : {}),
        rememberMe: details.rememberMe,
        returnTo,
        turnstileToken: botToken,
      });
      setChallengeId(result.challengeId);
      setCooldown(result.resendAfter);
    } catch (e) {
      setError((e as Error).message);
      setBotToken('');
      setBotKey((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };
  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api('/auth/verify-code', {
        challengeId,
        code: otp,
        ...(mode === 'password' ? { newPassword } : { password: details.password }),
      });
      saveSessionPreference(result.tabKey);
      setDetails((d) => ({ ...d, password: '' }));
      setNewPassword('');
      await refresh();
      go(result.returnTo);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const resend = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api('/auth/resend-code', { challengeId });
      setCooldown(result.resendAfter);
      setOtp('');
      setNotice(
        textForLocale(
          'Si la demande est valide, un nouveau code vous est envoyé. Seul le dernier code reçu fonctionne.',
        ),
      );
      codeRef.current?.focus();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (user && params.get('reauth') !== '1')
    return (
      <Page eyebrow={textForLocale('Votre compte')} title={textForLocale('Vous êtes connecté.')}>
        <p>{textForLocale('Votre compte et vos billets vous attendent.')}</p>
        <Link className="button" to={returnTo}>
          {textForLocale('Continuer ')}
          <ArrowRight size={18} />
        </Link>
      </Page>
    );
  return (
    <Page
      className="account-page"
      eyebrow={textForLocale('Votre compte Ride For Brains')}
      title={
        challengeId
          ? textForLocale('Entrez votre code.')
          : mode === 'create'
            ? textForLocale('Votre première participation commence ici.')
            : mode === 'sign-in'
              ? textForLocale('Bon retour parmi nous.')
              : mode === 'password'
                ? textForLocale('Votre mot de passe.')
                : textForLocale('On se retrouve au départ.')
      }
      intro={
        !mode
          ? textForLocale('Votre compte vous permet de retrouver vos inscriptions et vos billets.')
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
              {textForLocale('Je participe')}
              <br />
              {textForLocale('pour la première fois.')}
            </h2>
            <p>
              {textForLocale(
                'Créez votre compte avec votre prénom, nom, courriel et mot de passe.',
              )}
            </p>
            <Button onClick={() => changeMode('create')}>
              {textForLocale('Créer mon compte ')}
              <ArrowRight size={18} />
            </Button>
          </section>
          <section>
            <span className="editorial-number" aria-hidden="true">
              02
            </span>
            <h2>
              {textForLocale('J’ai déjà')}
              <br />
              {textForLocale('un compte.')}
            </h2>
            <p>
              {textForLocale(
                'Connectez-vous avec votre courriel, votre mot de passe et un code de vérification.',
              )}
            </p>
            <Button className="outline" onClick={() => changeMode('sign-in')}>
              {textForLocale('Me connecter ')}
              <ArrowRight size={18} />
            </Button>
          </section>
        </div>
      ) : (
        <div className="account-layout">
          {challengeId ? (
            <form className="account-form account-code" onSubmit={verify}>
              <Mail size={30} aria-hidden="true" />
              <h2>{textForLocale('Un code à 6 chiffres.')}</h2>
              <p>
                {mode === 'password'
                  ? textForLocale('Si cette adresse correspond à un compte, un code a été envoyé à')
                  : textForLocale('Nous avons envoyé un code à')}{' '}
                <strong>{details.email}</strong>.
              </p>
              <p>
                {textForLocale(
                  'Saisissez-le ici. Il est valable 10 minutes. Vous restez sur cette page; aucun lien à ouvrir.',
                )}
              </p>
              <Field label={textForLocale('Code à 6 chiffres')}>
                <input
                  ref={codeRef}
                  name="code"
                  className="otp-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  aria-describedby="code-help"
                />
              </Field>
              <p id="code-help" className="small">
                {textForLocale(
                  'Vérifiez aussi les courriels indésirables. Ne partagez jamais ce code.',
                )}
              </p>
              {mode === 'password' && (
                <Field
                  label={textForLocale('Nouveau mot de passe')}
                  hint={textForLocale('Au moins 10 caractères.')}
                >
                  <input
                    type="password"
                    name="newPassword"
                    autoComplete="new-password"
                    minLength={10}
                    maxLength={128}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </Field>
              )}
              {error && <Notice error>{error}</Notice>}
              {notice && <Notice>{notice}</Notice>}
              <Button type="submit" busy={busy}>
                {mode === 'create'
                  ? textForLocale('Vérifier et créer mon compte')
                  : mode === 'password'
                    ? textForLocale('Enregistrer et me connecter')
                    : textForLocale('Vérifier et me connecter')}{' '}
                <ArrowRight size={18} />
              </Button>
              <Button
                type="button"
                className="outline"
                disabled={busy || cooldown > 0}
                onClick={resend}
              >
                {cooldown > 0
                  ? textForLocale('Renvoyer un code dans ') + cooldown + ' s'
                  : textForLocale('Renvoyer un code')}
              </Button>
              <Button
                type="button"
                className="text-link"
                disabled={busy}
                onClick={() => {
                  setChallengeId('');
                  setError('');
                  setOtp('');
                  setBotToken('');
                  setBotKey((n) => n + 1);
                }}
              >
                {textForLocale('Modifier mes informations')}
              </Button>
              {data.environment === 'development' && (
                <Link to="/courriels-locaux">
                  {textForLocale('Voir le code dans la boîte locale')}
                </Link>
              )}
            </form>
          ) : (
            <form className="account-form" onSubmit={requestCode}>
              <Button type="button" className="text-link" onClick={() => changeMode(null)}>
                <ArrowLeft size={16} />
                {textForLocale(' Changer de choix')}
              </Button>
              {mode === 'create' && (
                <div className="form-grid">
                  <Field label={textForLocale('Prénom')}>
                    <input
                      name="firstName"
                      autoComplete="given-name"
                      maxLength={100}
                      value={details.firstName}
                      onChange={(e) => setDetails((d) => ({ ...d, firstName: e.target.value }))}
                      required
                    />
                  </Field>
                  <Field label={textForLocale('Nom')}>
                    <input
                      name="lastName"
                      autoComplete="family-name"
                      maxLength={100}
                      value={details.lastName}
                      onChange={(e) => setDetails((d) => ({ ...d, lastName: e.target.value }))}
                      required
                    />
                  </Field>
                </div>
              )}
              <Field label={textForLocale('Adresse courriel')}>
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  maxLength={200}
                  value={details.email}
                  onChange={(e) => setDetails((d) => ({ ...d, email: e.target.value }))}
                  required
                />
              </Field>
              {mode !== 'password' ? (
                <Field
                  label={textForLocale('Mot de passe')}
                  hint={mode === 'create' ? textForLocale('Au moins 10 caractères.') : undefined}
                >
                  <input
                    name="password"
                    type="password"
                    autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
                    minLength={mode === 'create' ? 10 : undefined}
                    maxLength={128}
                    value={details.password}
                    onChange={(e) => setDetails((d) => ({ ...d, password: e.target.value }))}
                    required
                  />
                </Field>
              ) : (
                <p>
                  {textForLocale(
                    'Ancien compte sans mot de passe ou mot de passe oublié : vérifiez votre courriel avec un code, puis choisissez votre mot de passe. Vos inscriptions sont conservées.',
                  )}
                </p>
              )}
              <label className="checkbox">
                <input
                  name="rememberMe"
                  type="checkbox"
                  checked={details.rememberMe}
                  onChange={(e) => setDetails((d) => ({ ...d, rememberMe: e.target.checked }))}
                />{' '}
                {textForLocale('Se souvenir de moi')}
              </label>
              <p className="small">
                {textForLocale(
                  'Coché : connexion conservée sur cet appareil. Décoché : connexion limitée à cet onglet, jusqu’à sa fermeture.',
                )}
              </p>
              <Turnstile key={botKey} onToken={setBotToken} />
              {error && <Notice error>{error}</Notice>}
              <Button type="submit" busy={busy}>
                {mode === 'create'
                  ? textForLocale('Créer mon compte')
                  : mode === 'password'
                    ? textForLocale('Recevoir mon code')
                    : textForLocale('Me connecter')}{' '}
                <ArrowRight size={18} />
              </Button>
              {mode === 'sign-in' && (
                <Button type="button" className="text-link" onClick={() => changeMode('password')}>
                  {textForLocale('Mot de passe oublié / Définir mon mot de passe')}
                </Button>
              )}
              <p className="small">
                {mode === 'password'
                  ? textForLocale('Le code permet de choisir votre mot de passe.')
                  : textForLocale(
                      'Un code à 6 chiffres vous sera demandé pour vérifier votre courriel.',
                    )}{' '}
                <Link to="/confidentialite">{textForLocale('Confidentialité')}</Link>
              </p>
            </form>
          )}
          <aside className="account-note">
            <h2>
              {textForLocale('Un compte.')}
              <br />
              {textForLocale('Votre journée.')}
            </h2>
            <ul>
              <li>
                <Check size={16} />
                {textForLocale(' Vos inscriptions au même endroit')}
              </li>
              <li>
                <Check size={16} />
                {textForLocale(' Vos billets pour l’accueil')}
              </li>
              <li>
                <Check size={16} />
                {textForLocale(' Les nouvelles de l’organisation')}
              </li>
            </ul>
          </aside>
        </div>
      )}
    </Page>
  );
}
