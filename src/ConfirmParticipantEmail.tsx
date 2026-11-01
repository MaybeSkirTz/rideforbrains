import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { Page, Button, Notice, Link } from './ui';
import useFragmentToken from './useFragmentToken';
export default function ConfirmParticipantEmail() {
  const token = useFragmentToken(),
    request = useRef(new AbortController());
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    request.current = new AbortController();
    setBusy(false);
    setMessage('');
    setError('');
    return () => request.current.abort();
  }, [token]);
  return (
    <Page
      title="Confirmer mon adresse courriel"
      intro="Cette confirmation concerne uniquement l’adresse de contact de votre participation. Votre compte reste inchangé."
    >
      {message ? (
        <>
          <Notice>{message}</Notice>
          <Link to="/infos">Préparer ma participation</Link>
        </>
      ) : (
        <>
          <p>
            Après confirmation, un nouveau billet sera envoyé à cette adresse. Le précédent billet
            sera remplacé.
          </p>
          {error && <Notice error>{error}</Notice>}
          <Button
            busy={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              const signal = request.current.signal;
              try {
                const r = await api('/tickets/confirm-email', { token, confirm: true }, 'POST', {
                  signal,
                });
                if (!signal.aborted) setMessage(r.message);
              } catch (e) {
                if (!signal.aborted) setError((e as Error).message);
              } finally {
                if (!signal.aborted) setBusy(false);
              }
            }}
          >
            Confirmer cette adresse
          </Button>
        </>
      )}
    </Page>
  );
}
