import { useEffect, useState } from 'react';
import { api } from './api';
import { useApp } from './context';
import { Page, Link, Notice, Button } from './ui';
import { accountUrl } from '../shared/navigation';
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export default function TicketPage({ id }: { id: string }) {
  const { user } = useApp();
  const [ticket, setTicket] = useState<any>(),
    [error, setError] = useState('');
  useEffect(() => {
    if (!user) return;
    api('/registrations/' + id + '/ticket')
      .then(async (t) => {
        const QR = await import('qrcode');
        setTicket({
          ...t,
          image: await QR.toDataURL(t.ticket, { width: 600, margin: 3 }),
          svg: await QR.toString(t.ticket, { type: 'svg', margin: 3 }),
        });
      })
      .catch((e) => setError(e.message));
  }, [id, user]);
  if (!user)
    return (
      <Page title="Votre billet personnel.">
        <Link className="button" to={accountUrl('/billet/' + id)}>
          Me connecter pour voir le billet
        </Link>
      </Page>
    );
  if (error)
    return (
      <Page title="Billet indisponible.">
        <Notice error>{error}</Notice>
        <Link to="/espace">Revenir à mon espace</Link>
      </Page>
    );
  if (!ticket)
    return (
      <Page title="Votre billet.">
        <p role="status">Chargement…</p>
      </Page>
    );
  const event = ticket.event || {},
    date = event.eventAt
      ? new Date(event.eventAt).toLocaleDateString('fr-CA', {
          dateStyle: 'long',
          timeZone: 'America/Toronto',
        })
      : 'Date à confirmer';
  const download = () => {
    const qr = ticket.svg.replace('<svg ', '<svg x="150" y="235" width="400" height="400" ');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="850" viewBox="0 0 700 850"><rect width="700" height="850" fill="#f6f5ed"/><g fill="#12312f" font-family="Arial,sans-serif" text-anchor="middle"><text x="350" y="65" font-size="30" font-weight="bold">RIDE FOR BRAINS</text><text x="350" y="105" font-size="20">${esc(date)}</text><text x="350" y="157" font-size="26">${esc(ticket.name)} · ${esc(ticket.distance)}</text><text x="350" y="200" font-size="22">${esc(ticket.first_name)} ${esc(ticket.last_name)}</text>${qr}<text x="350" y="690" font-size="18">Accueil ${esc(event.reception || 'à confirmer')}</text><text x="350" y="727" font-size="16">Billet personnel · ${esc(ticket.id.slice(0, 8))}</text><text x="350" y="765" font-size="14">Présenter ce code à l’accueil. Ne pas le partager.</text></g></svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Ride-For-Brains-' + id.slice(0, 8) + '.svg';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <Page eyebrow="VOTRE RENDEZ-VOUS" title="Prêt pour le départ.">
      <article className="full-ticket">
        <div className="ticket-brand">
          <img src="/assets/ride-for-brains.png" width="84" height="84" alt="Ride For Brains" />
          <span>
            {event.edition}
            <br />
            {date}
          </span>
        </div>
        <h2>
          {ticket.name} <em>{ticket.distance}</em>
        </h2>
        <p className="ticket-name">
          {ticket.first_name} {ticket.last_name}
        </p>
        <img
          className="ticket-qr"
          src={ticket.image}
          width="300"
          height="300"
          alt="Billet personnel : présentez ce code QR à l’accueil"
        />
        <dl>
          <div>
            <dt>Accueil</dt>
            <dd>{event.reception?.replace(':', ' h ') || 'À confirmer'}</dd>
          </div>
          <div>
            <dt>Lieu</dt>
            <dd>{event.location || 'À confirmer'}</dd>
          </div>
          <div>
            <dt>Numéro</dt>
            <dd>{ticket.id.slice(0, 8)}</dd>
          </div>
        </dl>
        <p className="small">
          Billet personnel. Conservez-le sur votre téléphone et évitez de partager son code.
        </p>
        <div className="actions ticket-actions">
          <Button onClick={download}>Télécharger mon billet</Button>
          <Button className="button light" onClick={() => window.print()}>
            Imprimer / enregistrer en PDF
          </Button>
          <Link className="text-link" to="/espace">
            Mon espace
          </Link>
        </div>
      </article>
    </Page>
  );
}
