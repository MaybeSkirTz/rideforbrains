export const donationNotice =
  'Les frais d’inscription servent à l’inscription et à l’organisation de Ride For Brains. Ils ne constituent pas un don à Brain Canada et ne donnent pas droit à un reçu de don. Les dons à Brain Canada sont effectués séparément sur sa plateforme officielle.';

export function daysUntil(eventAt: string, now = new Date()) {
  const day = (date: Date) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const get = (name: string) => Number(parts.find((p) => p.type === name)?.value);
    return Date.UTC(get('year'), get('month') - 1, get('day'));
  };
  const target = new Date(eventAt);
  return Number.isFinite(target.getTime())
    ? Math.max(0, Math.round((day(target) - day(now)) / 86400000))
    : 0;
}
const escapeICS = (text: string) =>
  text.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
const stamp = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
export function calendarICS(s: any, origin: string, now = new Date()) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ride For Brains//Calendrier//FR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    'UID:rideforbrains-' + s.date + '@rideforbrains.ca',
    'DTSTAMP:' + stamp(now),
    'DTSTART:' + stamp(new Date(s.eventAt)),
    'SUMMARY:' + escapeICS(s.title + ' — ' + s.edition),
    'DESCRIPTION:' +
      escapeICS(
        'Accueil à ' +
          s.reception.replace(':', ' h ') +
          '. Vélo, course et marche. Les heures de départ des activités restent à confirmer. ' +
          origin +
          '/infos',
      ),
    ...(s.location?.trim() ? ['LOCATION:' + escapeICS(s.location)] : []),
    'URL:' + origin,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  // Fold by UTF-8 octets, never in the middle of a Unicode character (RFC 5545).
  return (
    lines
      .map((line) => {
        let out = '',
          row = '';
        for (const char of line) {
          if (new TextEncoder().encode(row + char).length > 73) {
            out += row + '\r\n ';
            row = '';
          }
          row += char;
        }
        return out + row;
      })
      .join('\r\n') + '\r\n'
  );
}
export function googleCalendarUrl(s: any, origin: string) {
  const start = stamp(new Date(s.eventAt));
  return (
    'https://calendar.google.com/calendar/render?' +
    new URLSearchParams({
      action: 'TEMPLATE',
      text: s.title + ' — ' + s.edition,
      dates: start + '/' + start,
      ctz: 'America/Toronto',
      details:
        'Accueil à ' +
        s.reception.replace(':', ' h ') +
        '. Heures de départ à confirmer. ' +
        origin +
        '/infos',
      ...(s.location?.trim() ? { location: s.location } : {}),
    })
  );
}
