import { t as textForLocale } from './locale-copy';
import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { Notice } from './ui';
import { pollConfirmation } from '../shared/checkout';
export default function CheckoutStatus({
  id,
  onConfirmed,
}: {
  id: string;
  onConfirmed: () => void;
}) {
  const [state, setState] = useState('checking'),
    [attempt, setAttempt] = useState(0);
  const done = useRef(onConfirmed);
  done.current = onConfirmed;
  useEffect(() => {
    const controller = new AbortController();
    setState('checking');
    void pollConfirmation({
      read: () =>
        api('/orders/' + encodeURIComponent(id) + '/status', undefined, 'GET', {
          signal: controller.signal,
        }),
      signal: controller.signal,
      onUpdate: setState,
    }).then((status) => {
      if (!controller.signal.aborted && status === 'confirmed') done.current();
    });
    return () => controller.abort();
  }, [id, attempt]);
  return (
    <Notice>
      <div role="status" aria-live="polite">
        {state === 'confirmed' ? (
          <>
            <strong>{textForLocale('✓ Inscription confirmée')}</strong>
            <p>{textForLocale('Votre billet est prêt dans votre espace ci-dessous.')}</p>
          </>
        ) : state === 'review' ? (
          <p>
            {textForLocale(
              'Votre paiement a été reçu. L’organisation vérifie votre dossier et vous contactera.',
            )}
          </p>
        ) : state === 'stopped' ? (
          <p>
            {textForLocale(
              'Le paiement n’a pas été finalisé. Retrouvez les options disponibles dans votre dossier.',
            )}
          </p>
        ) : state === 'waiting' ? (
          <>
            <p>
              {textForLocale(
                'Votre paiement est en cours de confirmation. Vous pouvez fermer cette page. Nous vous enverrons un courriel lorsque votre inscription sera confirmée.',
              )}
            </p>
            <button type="button" className="text-link" onClick={() => setAttempt((a) => a + 1)}>
              {textForLocale('Vérifier de nouveau')}
            </button>
          </>
        ) : (
          <>
            <strong>{textForLocale('Nous confirmons votre inscription…')}</strong>
            <p>{textForLocale('Votre dossier se met à jour automatiquement.')}</p>
          </>
        )}
      </div>
    </Notice>
  );
}
