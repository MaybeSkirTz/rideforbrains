import { Button, Field } from './ui';

export default function EnglishSettings({
  settings,
  activities,
  change,
}: {
  settings: any;
  activities: any[];
  change: (key: string, value: any) => void;
}) {
  const en = settings.english || {
    published: false,
    legalApproved: false,
    sourceVersion: '',
    legalVersion: '',
    terms: '',
    privacy: '',
    heroTitle: '',
    heroIntro: '',
    story: '',
    cause: '',
    faq: [],
    activities: {},
  };
  const edit = (patch: object) => change('english', { ...en, ...patch });
  const faq = en.faq || [];
  return (
    <details className="settings-details">
      <summary>Traductions · FR / EN</summary>
      <p>
        FR · conditions {settings.legalApproved ? 'validées' : 'à valider'} ·{' '}
        {settings.termsVersion}
      </p>
      <p>
        EN · conditions{' '}
        {en.legalApproved && en.sourceVersion === settings.termsVersion
          ? 'validées'
          : 'en brouillon'}{' '}
        · {en.legalVersion || 'sans version'}
      </p>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={en.published}
          onChange={(e) => edit({ published: e.target.checked })}
        />{' '}
        Publier les pages anglaises
      </label>
      <div className="form-grid">
        {(
          [
            ['heroTitle', 'Titre d’accueil EN', 160],
            ['heroIntro', 'Introduction EN', 700],
            ['story', 'Histoire de l’organisation EN', 6000],
            ['cause', 'La cause EN', 5000],
          ] as const
        ).map(([key, label, max]) => (
          <Field key={key} label={label}>
            <textarea
              rows={3}
              maxLength={max}
              value={en[key] || ''}
              onChange={(e) => edit({ [key]: e.target.value })}
            />
          </Field>
        ))}
      </div>
      <details className="settings-details">
        <summary>Activités et FAQ anglaises</summary>
        {activities.map((a) => {
          const translation = en.activities?.[a.id] || { name: '', description: '' };
          const update = (patch: object) =>
            edit({ activities: { ...en.activities, [a.id]: { ...translation, ...patch } } });
          return (
            <fieldset className="content-repeater" key={a.id}>
              <legend>
                {a.name} · {a.distance}
              </legend>
              <Field label="Nom anglais">
                <input
                  value={translation.name}
                  maxLength={150}
                  onChange={(e) => update({ name: e.target.value })}
                />
              </Field>
              <Field label="Description du parcours en anglais">
                <textarea
                  rows={3}
                  value={translation.description}
                  maxLength={5000}
                  onChange={(e) => update({ description: e.target.value })}
                />
              </Field>
            </fieldset>
          );
        })}
        {faq.map((entry: { q: string; a: string }, i: number) => (
          <fieldset className="content-repeater" key={i}>
            <legend>FAQ EN {i + 1}</legend>
            <Field label="Question">
              <input
                value={entry.q}
                maxLength={150}
                onChange={(e) =>
                  edit({
                    faq: faq.map((row: any, n: number) =>
                      n === i ? { ...row, q: e.target.value } : row,
                    ),
                  })
                }
              />
            </Field>
            <Field label="Réponse">
              <textarea
                value={entry.a}
                maxLength={3000}
                onChange={(e) =>
                  edit({
                    faq: faq.map((row: any, n: number) =>
                      n === i ? { ...row, a: e.target.value } : row,
                    ),
                  })
                }
              />
            </Field>
            <Button
              type="button"
              className="light"
              onClick={() => edit({ faq: faq.filter((_: any, n: number) => n !== i) })}
            >
              Retirer
            </Button>
          </fieldset>
        ))}
        <Button
          type="button"
          className="light"
          disabled={faq.length >= 50}
          onClick={() => edit({ faq: [...faq, { q: '', a: '' }] })}
        >
          Ajouter une question EN
        </Button>
      </details>
      <h3>Textes légaux anglais</h3>
      <Field label="Version propre aux conditions EN">
        <input
          maxLength={80}
          value={en.legalVersion}
          onChange={(e) => edit({ legalVersion: e.target.value, legalApproved: false })}
        />
      </Field>
      <Field label="Conditions EN">
        <textarea
          rows={7}
          maxLength={16000}
          value={en.terms}
          onChange={(e) => edit({ terms: e.target.value, legalApproved: false })}
        />
      </Field>
      <Field label="Confidentialité EN">
        <textarea
          rows={7}
          maxLength={16000}
          value={en.privacy}
          onChange={(e) => edit({ privacy: e.target.value, legalApproved: false })}
        />
      </Field>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={en.legalApproved && en.sourceVersion === settings.termsVersion}
          onChange={(e) =>
            edit({ legalApproved: e.target.checked, sourceVersion: settings.termsVersion })
          }
        />
        L’organisation approuve ces textes anglais pour la version française actuelle
      </label>
    </details>
  );
}
