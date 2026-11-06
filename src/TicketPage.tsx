import { t as textForLocale } from './locale-copy';
import { lazy, Suspense, useEffect, useState } from 'react';
import { api } from './api';
import { useApp } from './context';
import { Page, Link, Notice, Button } from './ui';
import { accountUrl } from '../shared/navigation';
import { googleCalendarUrl, calendarICS } from '../shared/event';
import { currentLocale } from '../shared/locale';
import useFragmentToken from './useFragmentToken';
const WalletButtons = lazy(() => import('./WalletButtons'));
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export default function TicketPage({ id, personal = false }: { id: string; personal?: boolean }) {
  const { user, data } = useApp();
  const fragment = useFragmentToken(),
    token = personal ? fragment : '';
  const [ticket, setTicket] = useState<any>(),
    [error, setError] = useState(''),
    [downloading, setDownloading] = useState(false),
    [downloadError, setDownloadError] = useState('');
  useEffect(() => {
    setError('');
    setDownloadError('');
    setTicket(undefined);
    if (!personal && !user) return;
    const controller = new AbortController();
    api(
      personal ? '/tickets/view' : '/registrations/' + id + '/ticket',
      personal ? { token } : undefined,
      personal ? 'POST' : 'GET',
      { signal: controller.signal },
    )
      .then(async (t) => {
        const QR = await import('qrcode');
        const image = await QR.toDataURL(t.ticket, { width: 600, margin: 3 }),
          svg = await QR.toString(t.ticket, { type: 'svg', margin: 3 });
        if (controller.signal.aborted) return;
        setTicket({
          ...t,
          image,
          svg,
        });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [id, user, personal, token]);
  if (!personal && !user)
    return (
      <Page title={textForLocale('Votre billet personnel.')}>
        <Link className="button" to={accountUrl('/billet/' + id)}>
          {textForLocale('Me connecter pour voir le billet')}
        </Link>
      </Page>
    );
  if (error)
    return (
      <Page title={textForLocale('Billet indisponible.')}>
        <Notice error>{error}</Notice>
        <Link to="/espace">{textForLocale('Revenir à mon espace')}</Link>
      </Page>
    );
  if (!ticket)
    return (
      <Page title={textForLocale('Votre billet.')}>
        <p role="status">{textForLocale('Chargement…')}</p>
      </Page>
    );
  const event = ticket.event || {},
    date = event.eventAt
      ? new Date(event.eventAt).toLocaleDateString(currentLocale(), {
          dateStyle: 'long',
          timeZone: 'America/Toronto',
        })
      : textForLocale('Date à confirmer');
  const download = async () => {
    setDownloading(true);
    setDownloadError('');
    const qr = ticket.svg.replace('<svg ', '<svg x="150" y="235" width="400" height="400" ');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="850" viewBox="0 0 700 850"><rect width="700" height="850" fill="#f6f5ed"/><g fill="#12312f" font-family="Arial,sans-serif" text-anchor="middle"><text x="350" y="65" font-size="30" font-weight="bold">RIDE FOR BRAINS</text><text x="350" y="105" font-size="20">${esc(date)}</text><text x="350" y="157" font-size="26">${esc(ticket.name)} · ${esc(ticket.distance)}</text><text x="350" y="200" font-size="22">${esc(ticket.first_name)} ${esc(ticket.last_name)}</text>${qr}<text x="350" y="690" font-size="18">${esc(textForLocale('Accueil'))} ${esc(event.reception || textForLocale('à confirmer'))}</text><text x="350" y="727" font-size="16">${esc(textForLocale('Billet personnel'))} · ${esc(ticket.id.slice(0, 8))}</text><text x="350" y="765" font-size="14">${esc(textForLocale('Présenter ce code à l’accueil. Ne pas le partager.'))}</text></g></svg>`;
    const artworkUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      const artwork = new Image();
      artwork.src = artworkUrl;
      await artwork.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 1400;
      canvas.height = 1700;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas indisponible');
      context.drawImage(artwork, 0, 0, canvas.width, canvas.height);
      const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!png) throw new Error('Image indisponible');

      const url = URL.createObjectURL(png);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Ride-For-Brains-' + ticket.id.slice(0, 8) + '.png';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      setDownloadError(
        textForLocale(
          'Le téléchargement du billet a échoué. Utilisez « Imprimer / enregistrer en PDF ».',
        ),
      );
    } finally {
      URL.revokeObjectURL(artworkUrl);
      setDownloading(false);
    }
  };
  const downloadCalendar = () => {
    const url = URL.createObjectURL(
      new Blob([calendarICS({ ...event, title: 'Ride For Brains' }, location.origin)], {
        type: 'text/calendar;charset=utf-8',
      }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Ride-For-Brains.ics';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <Page
      eyebrow={textForLocale('VOTRE RENDEZ-VOUS')}
      title={textForLocale('Prêt pour le départ.')}
    >
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
        <p className="status confirmed">{textForLocale('Inscription confirmée')}</p>
        <img
          className="ticket-qr"
          src={ticket.image}
          width="300"
          height="300"
          alt={textForLocale('Billet personnel : présentez ce code QR à l’accueil')}
        />
        <dl>
          <div>
            <dt>{textForLocale('Accueil')}</dt>
            <dd>{event.reception?.replace(':', ' h ') || textForLocale('À confirmer')}</dd>
          </div>
          <div>
            <dt>{textForLocale('Lieu')}</dt>
            <dd>{event.location || textForLocale('À confirmer')}</dd>
          </div>
          <div>
            <dt>{textForLocale('Numéro')}</dt>
            <dd>{ticket.id.slice(0, 8)}</dd>
          </div>
        </dl>
        <p className="small">
          {textForLocale(
            'Billet personnel. Conservez-le sur votre téléphone et évitez de partager son code.',
          )}
        </p>
        {downloadError && <Notice error>{downloadError}</Notice>}
        {(data.services.wallet?.apple || data.services.wallet?.google) && (
          <Suspense fallback={null}>
            <WalletButtons
              available={data.services.wallet}
              proof={personal ? { token } : { registrationId: ticket.id }}
            />
          </Suspense>
        )}
        <div className="actions ticket-actions">
          <Button onClick={download} busy={downloading}>
            {textForLocale('Télécharger mon billet')}
          </Button>
          <Button className="button light" onClick={() => window.print()}>
            {textForLocale('Imprimer / enregistrer en PDF')}
          </Button>
          {event.eventAt && (
            <a
              className="text-link"
              href={googleCalendarUrl({ ...event, title: 'Ride For Brains' }, location.origin)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {textForLocale('Ajouter au calendrier')}
            </a>
          )}
          <button className="text-link" onClick={downloadCalendar}>
            {textForLocale('Calendrier (.ics)')}
          </button>
          <Link className="text-link" to="/espace">
            {textForLocale('Mon espace')}
          </Link>
        </div>
      </article>
    </Page>
  );
}
