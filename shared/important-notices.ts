export const noticeTemplates = {
  information: {
    label: 'Information importante',
    subject: 'Information importante · Ride For Brains',
    message:
      'Voici une information à connaître avant votre participation.\n\n[Ajoutez les détails ici.]',
  },
  reminder: {
    label: 'Rappel',
    subject: 'Votre rendez-vous Ride For Brains approche',
    message:
      'Nous avons hâte de vous retrouver. Pensez à préparer votre billet et à consulter votre parcours dans Mon jour J.\n\n[Ajoutez les détails du rappel.]',
  },
  change: {
    label: 'Changement',
    subject: 'Changement concernant Ride For Brains',
    message:
      'Un changement concerne votre participation.\n\n[Indiquez ce qui change, la nouvelle consigne et à partir de quand.]',
  },
  weather: {
    label: 'Météo',
    subject: 'Consignes météo · Ride For Brains',
    message:
      'Voici les consignes météo de l’organisation.\n\n[Ajoutez les consignes confirmées et, si utile, le lien officiel.]',
  },
  eventDay: {
    label: 'Jour J',
    subject: 'Aujourd’hui, on se retrouve au départ',
    message:
      'Gardez votre billet à portée de main. Les informations pour votre arrivée se trouvent dans Mon jour J.\n\n[Ajoutez les dernières consignes.]',
  },
  urgent: {
    label: 'Avis urgent',
    subject: 'Avis urgent · Ride For Brains',
    message: '[Indiquez clairement la situation et ce que les participants doivent faire.]',
  },
} as const;

export type NoticeCategory = keyof typeof noticeTemplates;

const torontoClock = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Toronto',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
function torontoMinute(at: number) {
  const parts = torontoClock.formatToParts(new Date(at));
  const part = (key: string) => parts.find((entry) => entry.type === key)?.value;
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

// Round-trip both Toronto offsets. Missing or repeated DST minutes require a different time.
export function torontoSchedule(value: string): number | null {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value)) return null;
  const asUtc = Date.parse(value + 'Z');
  if (!Number.isFinite(asUtc)) return null;
  const choices = [4, 5]
    .map((offset) => asUtc + offset * 3600000)
    .filter((at) => torontoMinute(at) === value);
  return choices.length === 1 ? choices[0] / 1000 : null;
}
