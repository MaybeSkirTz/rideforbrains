import { useState } from 'react';
import { Field, Button, Notice } from './ui';
import { editorial } from '../shared/editorial';
import { api } from './api';
type Spec = {
  key: string;
  label: string;
  type?: 'text' | 'textarea' | 'url' | 'select';
  options?: string[];
};
function Rows({
  label,
  rows,
  change,
  fields,
  blank,
}: {
  label: string;
  rows: any[];
  change: (v: any[]) => void;
  fields: Spec[];
  blank: any;
}) {
  const update = (i: number, k: string, v: any) =>
    change(rows.map((r, n) => (n === i ? { ...r, [k]: v } : r)));
  const move = (i: number, d: number) => {
    const a = [...rows],
      j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    change(a.map((r, order) => ('order' in blank ? { ...r, order } : r)));
  };
  return (
    <fieldset className="content-repeater">
      <legend>{label}</legend>
      {rows.map((r, i) => (
        <div className="content-row" key={i}>
          <div className="content-row-tools">
            <strong>
              {i + 1}. {r.name || r.title || r.q || r.alt || label}
            </strong>
            <Button
              type="button"
              className="button light"
              disabled={!i}
              onClick={() => move(i, -1)}
              aria-label={`Monter ${label} ${i + 1}`}
            >
              ↑
            </Button>
            <Button
              type="button"
              className="button light"
              disabled={i === rows.length - 1}
              onClick={() => move(i, 1)}
              aria-label={`Descendre ${label} ${i + 1}`}
            >
              ↓
            </Button>
            <Button
              type="button"
              className="button light"
              onClick={() => change(rows.filter((_, n) => n !== i))}
            >
              Retirer
            </Button>
          </div>
          {fields.map((f) => (
            <Field key={f.key} label={f.label}>
              {f.type === 'textarea' ? (
                <textarea
                  rows={4}
                  value={r[f.key] || ''}
                  onChange={(e) => update(i, f.key, e.target.value)}
                />
              ) : f.type === 'select' ? (
                <select
                  value={r[f.key] || f.options?.[0]}
                  onChange={(e) => update(i, f.key, e.target.value)}
                >
                  {f.options?.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type || 'text'}
                  value={r[f.key] || ''}
                  onChange={(e) => update(i, f.key, e.target.value)}
                />
              )}
            </Field>
          ))}
          {'enabled' in blank && (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={r.enabled !== false}
                onChange={(e) => update(i, 'enabled', e.target.checked)}
              />
              Afficher sur le site
            </label>
          )}
        </div>
      ))}
      <Button
        type="button"
        className="button light"
        onClick={() =>
          change([...rows, { ...blank, ...('order' in blank ? { order: rows.length } : {}) }])
        }
      >
        Ajouter — {label}
      </Button>
    </fieldset>
  );
}
export default function ContentEditor({
  settings: s,
  change,
}: {
  settings: any;
  change: (k: string, v: any) => void;
}) {
  const e = editorial(s),
    edit = (k: string, v: any) => change('editorial', { ...e, [k]: v }),
    edition = (k: string, v: any) => edit('firstEdition', { ...e.firstEdition, [k]: v });
  return (
    <>
      <Field label="Titre d’accueil (deux lignes possibles)">
        <textarea value={e.heroTitle} onChange={(v) => edit('heroTitle', v.target.value)} />
      </Field>
      <Field label="Introduction">
        <textarea value={e.heroIntro} onChange={(v) => edit('heroIntro', v.target.value)} />
      </Field>
      <Rows
        label="Questions fréquentes"
        rows={s.faq || []}
        change={(v) => change('faq', v)}
        blank={{ q: '', a: '', enabled: true, order: 0 }}
        fields={[
          { key: 'q', label: 'Question' },
          { key: 'a', label: 'Réponse', type: 'textarea' },
        ]}
      />
      <p>
        Utilisez uniquement des photos réelles autorisées. Les sections sans contenu restent
        discrètes. Une adresse HTTPS permet de publier une photo sans activer de stockage payant.
      </p>
      <Rows
        label="Photos"
        rows={s.photos || []}
        change={(v) => change('photos', v)}
        blank={{ url: '', alt: '', caption: '', section: 'edition', enabled: true, order: 0 }}
        fields={[
          { key: 'url', label: 'Adresse de l’image', type: 'url' },
          { key: 'alt', label: 'Description accessible' },
          { key: 'caption', label: 'Légende' },
          {
            key: 'section',
            label: 'Section',
            type: 'select',
            options: [
              'edition',
              'velo',
              'course',
              'marche',
              'benevoles',
              'equipe',
              'depart',
              'arrivee',
              'moments',
            ],
          },
        ]}
      />
      <MediaUpload
        onUploaded={(url) =>
          change('photos', [
            ...(s.photos || []),
            {
              url,
              alt: 'Photo de l’événement à décrire',
              caption: '',
              section: 'edition',
              enabled: false,
              order: (s.photos || []).length,
            },
          ])
        }
      />
      <Rows
        label="Partenaires"
        rows={s.partners || []}
        change={(v) => change('partners', v)}
        blank={{ name: '', url: '', logo: '', category: '', level: '', enabled: true, order: 0 }}
        fields={[
          { key: 'name', label: 'Nom' },
          { key: 'url', label: 'Site officiel', type: 'url' },
          { key: 'logo', label: 'Adresse du logo', type: 'url' },
          { key: 'category', label: 'Catégorie' },
          { key: 'level', label: 'Niveau' },
        ]}
      />
      <h3>Première édition</h3>
      <Field label="Titre de la première édition">
        <input value={e.firstEdition.title} onChange={(v) => edition('title', v.target.value)} />
      </Field>
      <Field label="Souvenirs et récit">
        <textarea
          rows={5}
          value={e.firstEdition.intro}
          onChange={(v) => edition('intro', v.target.value)}
        />
      </Field>
      <Field label="Moments marquants (un par ligne)">
        <textarea
          value={e.firstEdition.memories.join('\n')}
          onChange={(v) => edition('memories', v.target.value.split('\n'))}
        />
      </Field>
      <Rows
        label="Statistiques vérifiées"
        rows={e.firstEdition.stats}
        change={(v) => edition('stats', v)}
        blank={{ label: '', value: '' }}
        fields={[
          { key: 'label', label: 'Libellé' },
          { key: 'value', label: 'Valeur vérifiée' },
        ]}
      />
      <Rows
        label="Articles de presse"
        rows={e.firstEdition.press}
        change={(v) => edition('press', v)}
        blank={{ title: '', url: '' }}
        fields={[
          { key: 'title', label: 'Titre' },
          { key: 'url', label: 'Lien', type: 'url' },
        ]}
      />
      <Rows
        label="Équipe"
        rows={e.team}
        change={(v) => edit('team', v)}
        blank={{ name: '', role: '', story: '', quote: '', photo: '', enabled: true }}
        fields={[
          { key: 'name', label: 'Nom' },
          { key: 'role', label: 'Rôle' },
          { key: 'story', label: 'Histoire personnelle', type: 'textarea' },
          { key: 'quote', label: 'Citation réelle', type: 'textarea' },
          { key: 'photo', label: 'Portrait autorisé (adresse)', type: 'url' },
        ]}
      />
      <Rows
        label="Informations pratiques"
        rows={e.practical}
        change={(v) => edit('practical', v)}
        blank={{ id: 'nouvelle-section', title: '', body: '', enabled: true }}
        fields={[
          { key: 'id', label: 'Identifiant unique (lettres et tirets)' },
          { key: 'title', label: 'Titre' },
          { key: 'body', label: 'Informations confirmées', type: 'textarea' },
        ]}
      />
    </>
  );
}
function MediaUpload({ onUploaded }: { onUploaded: (url: string) => void }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      if (
        !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) ||
        file.size > 15000000
      )
        throw Error('Choisissez une photo JPEG, PNG, WebP ou AVIF de moins de 15 Mo.');
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      bmp.close();
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (v) => (v ? resolve(v) : reject(Error('Conversion impossible.'))),
          'image/webp',
          0.82,
        ),
      );
      if (blob.size > 1000000) throw Error('La photo optimisée dépasse 1 Mo. Réduisez sa taille.');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const result = await api('/admin/media', { data: btoa(binary) });
      onUploaded(result.url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="media-upload">
      <Field
        label="Téléverser une photo"
        hint="Stockage R2 facultatif. La photo est redimensionnée et convertie en WebP avant envoi."
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          disabled={busy}
          onChange={(e) => upload(e.target.files?.[0])}
        />
      </Field>
      {busy && <p role="status">Optimisation et envoi…</p>}
      {error && <Notice error>{error}</Notice>}
    </div>
  );
}
