export const dayJSteps = ['calendar', 'route', 'instructions', 'equipment'] as const;
export type DayJStep = (typeof dayJSteps)[number];

export const dayJTextFields = {
  parking: 'Stationnement',
  access: 'Accès au site',
  instructions: 'Consignes importantes',
  equipment: 'Matériel recommandé',
  weather: 'Information météo officielle',
} as const;

export function dayJPhase(eventDate: string, at = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  const today = `${value('year')}-${value('month')}-${value('day')}`;
  if (today === eventDate) return 'today';
  return today > eventDate ? 'after' : 'before';
}

export type DayJ = {
  phase: ReturnType<typeof dayJPhase>;
  messages: { id: string; subject: string; body: string; registration_id: string }[];
  event: {
    title: string;
    edition: string;
    date: string;
    eventAt: string;
    location: string | null;
    reception: string;
    details: Partial<Record<keyof typeof dayJTextFields, string>> & { state?: string };
  };
  entries: {
    id: string;
    firstName: string;
    lastInitial: string;
    activity: { id: string; name: string; distance: string; sport: string };
    arrival?: string;
    departure?: string;
    start?: string;
    supplies: string[];
    routePath?: string;
    confirmed: boolean;
    payment: 'free' | 'confirmed' | 'pending';
    ticketReady: boolean;
    finisherReady: boolean;
    consentsComplete: boolean;
    progress: DayJStep[];
  }[];
};
