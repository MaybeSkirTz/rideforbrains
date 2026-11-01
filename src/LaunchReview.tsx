import { Field } from './ui';
import { defaultLaunchReview, launchIssues } from '../shared/launch';
export default function LaunchReview({
  settings,
  change,
}: {
  settings: any;
  change: (key: string, value: any) => void;
}) {
  const review = { ...defaultLaunchReview, ...settings.launchReview };
  const edit = (key: string, value: any) => change('launchReview', { ...review, [key]: value });
  return (
    <fieldset className="launch-review">
      <legend>Validation avant inscriptions réelles</legend>
      <p>
        Ces décisions appartiennent à l’organisation. Le logiciel vérifie que les textes et
        validations sont renseignés; il ne les valide pas juridiquement.
      </p>
      {[
        ['cancellation', 'Annulation par l’organisation'],
        ['postponement', 'Report de l’événement'],
        ['weather', 'Météo'],
        ['forceMajeure', 'Force majeure'],
      ].map(([key, label]) => (
        <Field key={key} label={label}>
          <textarea
            rows={3}
            value={(review as any)[key]}
            onChange={(e) => edit(key, e.target.value)}
            maxLength={5000}
          />
        </Field>
      ))}
      {[
        ['refundApproved', 'La politique de remboursement a été validée.'],
        ['taxApproved', 'Le traitement fiscal choisi a été validé.'],
        [
          'eventApproved',
          'Les modalités d’annulation, report, météo et force majeure ont été validées.',
        ],
      ].map(([key, label]) => (
        <label className="checkbox" key={key}>
          <input
            type="checkbox"
            checked={!!(review as any)[key]}
            onChange={(e) => edit(key, e.target.checked)}
          />
          {label}
        </label>
      ))}
      {launchIssues(settings).length > 0 && (
        <p role="status">
          À compléter avant ouverture réelle : {launchIssues(settings).join(', ')}.
        </p>
      )}
    </fieldset>
  );
}
