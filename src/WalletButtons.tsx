import { useState } from 'react';
import { api, downloadPrivate } from './api';
import { Button, Notice } from './ui';
import { t } from './locale-copy';

export default function WalletButtons({
  available,
  proof,
}: {
  available: { apple: boolean; google: boolean };
  proof: { registrationId: string } | { token: string };
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const add = async (provider: 'apple' | 'google') => {
    setBusy(true);
    setError('');
    try {
      if (provider === 'apple')
        await downloadPrivate('/wallet/apple', 'Ride-For-Brains.pkpass', proof);
      else {
        const { url } = await api<{ url: string }>('/wallet/google', proof);
        if (!url.startsWith('https://pay.google.com/gp/v/save/'))
          throw Error('Lien Wallet invalide.');
        location.assign(url);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="actions ticket-actions">
      {available.apple && (
        <Button type="button" className="outline" busy={busy} onClick={() => add('apple')}>
          {t('Ajouter à Apple Wallet')}
        </Button>
      )}
      {available.google && (
        <Button type="button" className="outline" busy={busy} onClick={() => add('google')}>
          {t('Ajouter à Google Wallet')}
        </Button>
      )}
      {error && <Notice error>{error}</Notice>}
    </div>
  );
}
