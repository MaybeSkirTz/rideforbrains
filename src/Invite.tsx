import { t as textForLocale } from './locale-copy';
import { useState } from 'react';
import { api } from './api';
import { Button, Field, Notice } from './ui';

export default function Invite() {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    setError('');
    try {
      const { path } = await api<{ path: string }>('/referral', {});
      setUrl(new URL(path, location.origin).href);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="day-j-share">
      <h2>{textForLocale('Tu es inscrit. Qui embarque avec toi?')}</h2>
      {url ? (
        <>
          <Field label={textForLocale('Ton lien d’invitation')}>
            <input value={url} readOnly onFocus={(e) => e.target.select()} />
          </Field>
          <div className="actions">
            <Button
              type="button"
              className="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  setError('');
                  setCopied(true);
                } catch {
                  setError(textForLocale('Sélectionne le lien ci-dessus pour le copier.'));
                }
              }}
            >
              {copied ? textForLocale('Lien copié') : textForLocale('Copier le lien')}
            </Button>
            {typeof navigator.share === 'function' && (
              <Button
                type="button"
                className="outline"
                onClick={async () => {
                  try {
                    await navigator.share({
                      title: 'Ride For Brains',
                      text: textForLocale('On relève le défi ensemble?'),
                      url,
                    });
                  } catch (e) {
                    if ((e as Error).name !== 'AbortError')
                      setError(textForLocale('Le partage a échoué. Tu peux copier le lien.'));
                  }
                }}
              >
                {textForLocale('Partager')}
              </Button>
            )}
          </div>
        </>
      ) : (
        <Button type="button" className="outline" busy={busy} onClick={open}>
          {textForLocale('Inviter un ami')}
        </Button>
      )}
      {error && <Notice error>{error}</Notice>}
    </section>
  );
}
