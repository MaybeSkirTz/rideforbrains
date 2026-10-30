import { useEffect, useState } from 'react';
import { api, money } from './api';
const labels: Record<string, string> = {
  visit: 'Visites',
  activity_view: 'Activités consultées',
  registration_start: 'Inscriptions commencées',
  account_request: 'Demandes de connexion',
  account_verified: 'Comptes vérifiés',
  form_complete: 'Formulaires terminés',
  checkout_start: 'Passages vers Stripe',
  payment_confirmed: 'Paiements confirmés',
  confirmed: 'Confirmés',
  refunded: 'Remboursés',
  refunding: 'Remboursements en cours',
  expired: 'Expirés / abandonnés',
  pending: 'En attente',
  delivered: 'Livrés',
  bounced: 'Rejetés',
  accepted: 'Acceptés par le fournisseur',
  failed: 'Échecs',
  development: 'Envois locaux',
};
function Bars({
  title,
  rows,
  value = 'count',
  format = String,
}: {
  title: string;
  rows: any[];
  value?: string;
  format?: (v: any) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => Number(r[value]) || 0));
  return (
    <section className="insight-chart">
      <h3>{title}</h3>
      {!rows.length ? (
        <p>Pas encore de données.</p>
      ) : (
        <table>
          <caption className="sr-only">{title}</caption>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <th scope="row">{labels[r.label] || r.label}</th>
                <td>
                  <span className="chart-track" aria-hidden="true">
                    <span style={{ width: Math.max(0, (Number(r[value]) / max) * 100) + '%' }} />
                  </span>
                  <span>{format(r[value])}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
export default function AdminInsights() {
  const [data, setData] = useState<any>(),
    [health, setHealth] = useState<any>(),
    [error, setError] = useState('');
  useEffect(() => {
    api('/admin/analytics')
      .then(setData)
      .catch((e) => setError(e.message));
    api('/admin/health')
      .then(setHealth)
      .catch(() => {});
  }, []);
  return (
    <div className="admin-insights">
      {error && <p role="alert">{error}</p>}
      {health && (
        <details>
          <summary>
            État de production —{' '}
            {health.ready
              ? 'configuration complète'
              : health.missing.length + ' élément(s) à compléter'}
          </summary>
          {health.missing.length > 0 && (
            <ul>
              {health.missing.map((m: string) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
          <p>
            Mode des paiements : {health.paymentsMode}. Les validations fiscales et les
            autorisations restent à confirmer par l’organisation.
          </p>
          {health.refunds.map((r: any) => (
            <p key={r.status}>
              Remboursements {labels[r.status] || r.status} : {r.count}
            </p>
          ))}
        </details>
      )}
      {data && (
        <>
          <Bars title="Participations par jour" rows={[...data.registrationsDaily].reverse()} />
          <Bars title="Commandes par jour" rows={[...data.daily].reverse()} value="orders" />
          <Bars
            title="Recettes nettes des remboursements par jour"
            rows={[...data.daily].reverse()}
            value="revenue"
            format={money}
          />
          <Bars
            title="Participations par activité et statut"
            rows={data.activities.map((r: any) => ({
              ...r,
              label: r.name + ' ' + r.distance + ' · ' + (labels[r.status] || r.status),
            }))}
          />
          <Bars
            title="Paiements, annulations et remboursements"
            rows={data.orders.map((r: any) => ({ ...r, label: r.status }))}
          />
          <Bars
            title="Parcours agrégé (60 jours)"
            rows={data.funnel.map((r: any) => ({ ...r, label: r.event }))}
          />
          <p className="small">
            Ces compteurs mesurent des étapes agrégées, sans identifier une personne ni suivre ses
            réponses. Ils ne représentent pas des visiteurs uniques.
          </p>
          <Bars
            title="Livraison des courriels"
            rows={data.mail.map((r: any) => ({ ...r, label: r.status }))}
          />
          <Bars
            title="Codes promotionnels utilisés"
            rows={data.promos.map((r: any) => ({ label: r.code, count: r.uses }))}
          />
          <Bars
            title="Accueil du jour J"
            rows={[{ label: 'Présences confirmées', count: data.checkin[0]?.present || 0 }]}
          />
        </>
      )}
    </div>
  );
}
