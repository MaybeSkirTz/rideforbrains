import { useState } from 'react';
import { api } from './api';
import { Field, Button, Notice } from './ui';
export default function EmailCorrection({ id, current }: { id: string; current: string }) {
  const [address, setAddress] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  return (
    <details className="admin-section">
      <summary>Corriger le courriel du participant</summary>
      <button
        type="button"
        className="text-link"
        onClick={async () => {
          if (
            !confirm(
              'Désactiver le lien personnel de ce billet ? Son QR reste valable; un renvoi explicite pourra créer un nouveau lien.',
            )
          )
            return;
          try {
            await api('/admin/participants/' + id + '/ticket-access/revoke', { confirm: true });
            setMessage('Le lien personnel a été désactivé.');
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        Désactiver le lien personnel
      </button>
      <p>
        Adresse actuelle : {current}. Le destinataire devra confirmer la nouvelle adresse. Son
        compte ne sera pas modifié et son ancien billet sera remplacé.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            !confirm(
              'Envoyer une vérification à ' + address + ' et désactiver l’ancien lien de billet ?',
            )
          )
            return;
          setBusy(true);
          setError('');
          try {
            const r = await api('/admin/participants/' + encodeURIComponent(id) + '/email-change', {
              email: address,
              confirm: true,
            });
            setMessage(r.message);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Nouvelle adresse à vérifier">
          <input
            required
            type="email"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            autoComplete="off"
            maxLength={200}
          />
        </Field>
        {error && <Notice error>{error}</Notice>}
        {message && <Notice>{message}</Notice>}
        <Button busy={busy}>Demander la vérification</Button>
      </form>
    </details>
  );
}
