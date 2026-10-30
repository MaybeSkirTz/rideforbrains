import QRScanner from './QRScanner';
import { useState } from 'react';
import { api } from './api';
import { Button, Field, Notice } from './ui';
const storageKey = 'rfb-offline-v1';
async function key(pass: string, salt: Uint8Array) {
  if (pass.length < 12) throw Error('Choisissez une phrase secrète d’au moins 12 caractères.');
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pass),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: 250000 },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}
export default function OfflineCheckin() {
  const [pass, setPass] = useState(''),
    [vault, setVault] = useState<any>(),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [scan, setScan] = useState(''),
    [busy, setBusy] = useState(false);
  const persist = async (data: any) => {
    const salt = crypto.getRandomValues(new Uint8Array(16)),
      iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      await key(pass, salt),
      new TextEncoder().encode(JSON.stringify(data)),
    );
    localStorage.setItem(
      storageKey,
      JSON.stringify({ salt: [...salt], iv: [...iv], data: [...new Uint8Array(encrypted)] }),
    );
    setVault(data);
  };
  const run = async (fn: () => Promise<void>) => {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const localScan = async (value = scan) => {
    if (!vault || Date.now() / 1000 > vault.expiresAt)
      throw Error('Liste expirée : utilisez le contrôle en ligne ou contactez l’organisation.');
    const hash = [
      ...new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value.trim())),
      ),
    ]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const t = vault.tickets.find((v: any) => v.hash === hash);
    if (!t) throw Error('Billet absent de cette liste. Vérification par l’organisation requise.');
    if (t.checked || vault.events.some((e: any) => e.registrationId === t.id))
      throw Error('Billet déjà accueilli sur cet appareil ou dans la liste préparée.');
    await persist({
      ...vault,
      events: [
        ...vault.events,
        { id: crypto.randomUUID(), registrationId: t.id, scannedAt: Math.floor(Date.now() / 1000) },
      ],
    });
    setMessage(
      'Accueil provisoire enregistré · ' +
        t.initials +
        ' · ' +
        t.activity +
        '. Synchronisation requise.',
    );
    setScan('');
  };
  return (
    <details className="offline-panel">
      <summary>Préparer une liste de secours chiffrée</summary>
      <p>
        Préparation valable 24 h, pour 5 000 billets au maximum. Gardez cette page ouverte : aucun
        fonctionnement après fermeture ou rechargement sans réseau n’est garanti. Deux appareils
        sans réseau peuvent accepter provisoirement le même billet. La synchronisation signale ces
        conflits.
      </p>
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      <Field
        label="Phrase secrète locale"
        hint="12 caractères minimum. Elle n’est pas conservée ni envoyée au serveur."
      >
        <input
          type="password"
          value={pass}
          autoComplete="off"
          onChange={(e) => setPass(e.target.value)}
        />
      </Field>
      <div className="actions">
        <Button
          busy={busy}
          type="button"
          onClick={() =>
            run(async () => {
              await key(pass, new Uint8Array(16));
              const data = await api('/admin/offline/snapshot', { confirm: true });
              await persist({ ...data, events: [], receipts: [] });
              setMessage('Liste minimale chiffrée enregistrée sur cet appareil.');
            })
          }
        >
          Préparer cet appareil
        </Button>
        <Button
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const raw = localStorage.getItem(storageKey);
              if (!raw) throw Error('Aucune liste enregistrée.');
              const blob = JSON.parse(raw);
              try {
                const bytes = await crypto.subtle.decrypt(
                  { name: 'AES-GCM', iv: new Uint8Array(blob.iv) },
                  await key(pass, new Uint8Array(blob.salt)),
                  new Uint8Array(blob.data),
                );
                setVault(JSON.parse(new TextDecoder().decode(bytes)));
                setMessage('Liste locale déverrouillée.');
              } catch {
                throw Error('Phrase secrète incorrecte ou liste endommagée.');
              }
            })
          }
        >
          Déverrouiller la liste
        </Button>
      </div>
      {vault && (
        <>
          <p>
            {vault.tickets.length} billets · {vault.events.length} scan(s) à synchroniser.
            Expiration : {new Date(vault.expiresAt * 1000).toLocaleString('fr-CA')}.
          </p>
          <QRScanner
            onCode={(value) => {
              setScan(value);
              run(() => localScan(value));
            }}
          />
          <Field label="Code du billet (lecteur USB ou saisie)">
            <input
              value={scan}
              onChange={(e) => setScan(e.target.value)}
              autoComplete="off"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  run(() => localScan());
                }
              }}
            />
          </Field>
          <div className="actions">
            <Button type="button" disabled={busy || !scan} onClick={() => run(localScan)}>
              Enregistrer un accueil provisoire
            </Button>
            <Button
              type="button"
              disabled={busy || !vault.events.length}
              onClick={() =>
                run(async () => {
                  const receipts: any[] = [];
                  for (let i = 0; i < vault.events.length; i += 100) {
                    const x = await api('/admin/offline/sync', {
                      snapshotId: vault.id,
                      events: vault.events.slice(i, i + 100),
                    });
                    receipts.push(...x.results);
                  }
                  await persist({
                    ...vault,
                    events: [],
                    receipts: [...vault.receipts, ...receipts],
                    tickets: vault.tickets.map((t: any) => ({
                      ...t,
                      checked:
                        t.checked ||
                        receipts.some(
                          (r) =>
                            vault.events.find((e: any) => e.id === r.id)?.registrationId === t.id &&
                            ['accepted', 'already_used'].includes(r.result),
                        ),
                    })),
                  });
                  setMessage('Synchronisation terminée. Vérifiez les conflits ci-dessous.');
                })
              }
            >
              Synchroniser avec le serveur
            </Button>
            <Button
              type="button"
              onClick={() => {
                localStorage.removeItem(storageKey);
                setVault(undefined);
                setPass('');
                setMessage('Liste chiffrée effacée de cet appareil.');
              }}
            >
              Effacer cet appareil
            </Button>
          </div>
          {vault.receipts?.map((r: any) => (
            <p key={r.id} className={'scan-result ' + r.result}>
              {r.result === 'accepted'
                ? 'Présence confirmée'
                : r.result === 'already_used'
                  ? 'Conflit : billet déjà utilisé — vérifier avec l’organisation'
                  : 'Billet annulé ou invalide — intervention requise'}
            </p>
          ))}
        </>
      )}
    </details>
  );
}
