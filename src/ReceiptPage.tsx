import { useEffect, useState } from 'react';
import { api, money, date, statuses } from './api';
import { useApp } from './context';
import { Page, Link, Notice, Button } from './ui';
import { accountUrl } from '../shared/navigation';
export default function ReceiptPage({ id }: { id: string }) {
  const { user } = useApp();
  const [receipt, setReceipt] = useState<any>(),
    [error, setError] = useState('');
  useEffect(() => {
    if (user)
      api('/orders/' + encodeURIComponent(id) + '/receipt')
        .then(setReceipt)
        .catch((e) => setError(e.message));
  }, [id, user]);
  if (!user)
    return (
      <Page title="Votre reçu de paiement">
        <Link className="button" to={accountUrl('/recu/' + id)}>
          Me connecter
        </Link>
      </Page>
    );
  return (
    <Page eyebrow="Ride For Brains" title="Reçu de paiement">
      {error ? (
        <Notice error>{error}</Notice>
      ) : !receipt ? (
        <p role="status">Chargement du reçu…</p>
      ) : (
        <article className="payment-receipt">
          <p>
            Commande {receipt.number}
            <br />
            {date(receipt.date)}
            <br />
            {statuses[receipt.status] || receipt.status}
          </p>
          <table>
            <caption>Participations de la commande</caption>
            <thead>
              <tr>
                <th>Activité</th>
                <th>Montant après rabais</th>
              </tr>
            </thead>
            <tbody>
              {receipt.lines.map((line: any, i: number) => (
                <tr key={i}>
                  <td>
                    {line.name} · {line.distance}
                  </td>
                  <td>{money(line.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl>
            <div>
              <dt>Total de la commande</dt>
              <dd>{money(receipt.total)}</dd>
            </div>
            <div>
              <dt>Paiement reçu</dt>
              <dd>{money(receipt.paid)}</dd>
            </div>
            <div>
              <dt>Remboursements confirmés</dt>
              <dd>{money(receipt.refunded)}</dd>
            </div>
          </dl>
          <p>
            Ce document concerne les frais d’inscription Ride For Brains. Il ne constitue pas un
            reçu de don ni un reçu fiscal.
          </p>
          <div className="actions">
            <Button onClick={() => window.print()}>Imprimer / enregistrer en PDF</Button>
            <Link className="text-link" to="/espace">
              Mon espace
            </Link>
          </div>
        </article>
      )}
    </Page>
  );
}
