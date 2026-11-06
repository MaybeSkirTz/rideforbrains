import { z } from 'zod';
import { defaultEditorial, editorial } from '../shared/editorial';
import { englishLegal } from '../shared/locale';

export const englishPageMeta: Record<string, [string, string]> = {
  '/': ['Ride For Brains', 'Ride, run or walk together in support of brain research.'],
  '/activites': [
    'Activities',
    'Choose your Ride For Brains cycling, running or walking challenge.',
  ],
  '/participants': [
    'Participants',
    'Confirmed participations by activity and names shared with consent.',
  ],
  '/velo': ['Cycling', 'Discover the Ride For Brains cycling challenge.'],
  '/course': ['Running', 'Choose your distance for Ride For Brains.'],
  '/marche': ['Walking', 'Take part in the Ride For Brains walk.'],
  '/cause': [
    'The cause',
    'Support the Ride For Brains fundraiser on Brain Canada’s official fundraising platform.',
  ],
  '/equipe': ['Our story', 'Meet the people behind Ride For Brains.'],
  '/infos': ['Practical information', 'Find confirmed details about your event day.'],
  '/contact': ['Contact us', 'Get in touch with the Ride For Brains team.'],
  '/faq': ['Frequently asked questions', 'Answers from the organizers to help you get ready.'],
  '/benevolat': ['Volunteer', 'Offer your time and help make Ride For Brains happen.'],
  '/partenaires': ['Partners', 'Contact the organizers about supporting the event.'],
  '/equipes': ['Teams', 'Discover the public Ride For Brains teams.'],
  '/histoires': ['Why I take part', 'Stories shared by Ride For Brains participants.'],
  '/pour-eux': ['For them', 'Dedications shared by Ride For Brains participants.'],
  '/impact': ['Our impact', 'The challenges chosen by Ride For Brains participants.'],
  '/ou-va-mon-argent': [
    'Where does my money go?',
    'Registration fees and donations to Brain Canada are separate.',
  ],
  '/conditions': ['Participation terms', 'Read the Ride For Brains participation terms.'],
  '/confidentialite': ['Privacy', 'Learn how Ride For Brains handles your information.'],
  '/connexion': ['Sign in', 'Access your Ride For Brains account.'],
  '/espace': ['My account', 'Find your Ride For Brains registrations and tickets.'],
  '/mon-jour-j': ['My event day', 'Get ready for Ride For Brains.'],
};

export const englishSettingsSchema = z
  .object({
    published: z.boolean(),
    legalApproved: z.boolean(),
    sourceVersion: z.string().max(80),
    legalVersion: z.string().max(80),
    terms: z.string().max(16000),
    privacy: z.string().max(16000),
    heroTitle: z.string().max(160).default(''),
    heroIntro: z.string().max(700).default(''),
    story: z.string().max(6000).default(''),
    cause: z.string().max(5000).default(''),
    faq: z
      .array(z.object({ q: z.string().trim().min(1).max(150), a: z.string().max(3000) }).strict())
      .max(50)
      .default([]),
    activities: z
      .record(
        z.string(),
        z
          .object({
            name: z.string().max(150),
            description: z.string().max(5000),
          })
          .strict(),
      )
      .default({}),
  })
  .strict();

export function localizeEnglishSettings(s: any) {
  const en = s.english || {};
  const legal = englishLegal(s);
  const base = editorial(s);
  return {
    ...s,
    english: undefined,
    story: en.story || s.story,
    cause: en.cause || s.cause,
    faq: en.faq?.length ? en.faq : s.faq,
    terms: legal ? en.terms : '',
    privacy: legal ? en.privacy : '',
    termsVersion: legal ? en.legalVersion : '',
    registrationOpen: legal && s.registrationOpen,
    editorial: {
      ...base,
      heroTitle:
        en.heroTitle ||
        (base.heroTitle === defaultEditorial.heroTitle
          ? 'Movement\nbrings us together.'
          : base.heroTitle),
      heroIntro:
        en.heroIntro ||
        (base.heroIntro === defaultEditorial.heroIntro
          ? 'Ride, run or walk with us for Ride For Brains.'
          : base.heroIntro),
    },
  };
}
