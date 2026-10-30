import { z } from 'zod';
const line = z
  .string()
  .trim()
  .min(1)
  .max(150)
  .refine((s) => !/[\r\n\x00]/.test(s), 'Texte invalide');
export const email = z
  .email()
  .max(200)
  .transform((s) => s.toLowerCase());
export const fieldSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
    label: line,
    type: z.enum(['text', 'select', 'checkbox']),
    required: z.boolean(),
    options: z.array(line).max(30).optional(),
    showWhen: z
      .object({ field: z.string().max(40), equals: z.union([z.string().max(150), z.boolean()]) })
      .optional(),
  })
  .strict();
export const participantSchema = z
  .object({
    activityId: z.string().max(50),
    firstName: line,
    lastName: line,
    email,
    phone: z.string().trim().min(7).max(35),
    adult: z.literal(true),
    emergencyName: line,
    emergencyPhone: z.string().trim().min(7).max(35),
    answers: z.record(z.string(), z.union([z.string().max(1000), z.boolean()])),
    formVersion: z.number().int(),
    conditions: z.literal(true),
    photo: z.boolean(),
    marketing: z.boolean(),
    authority: z.literal(true),
  })
  .strict();
export const orderSchema = z
  .object({
    participants: z.array(participantSchema).min(1).max(12),
    promo: z.string().trim().max(40).optional(),
    requestKey: z.uuid(),
    termsVersion: z.string().max(80),
    expectedAmount: z.number().int().min(0).optional(),
  })
  .strict();
export function validateAnswers(fields: any[], answers: Record<string, unknown>) {
  const cleaned: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.showWhen && answers[f.showWhen.field] !== f.showWhen.equals) continue;
    const v = answers[f.id];
    if (f.required && (v === undefined || v === '' || (f.type === 'checkbox' && v !== true)))
      throw new Error(`Réponse requise : ${f.label}`);
    if (v === undefined) continue;
    if (f.type === 'checkbox' && typeof v !== 'boolean') throw new Error('Case à cocher invalide');
    if (f.type === 'text' && (typeof v !== 'string' || v.length > 1000))
      throw new Error('Texte invalide');
    if (f.type === 'select' && !f.options?.includes(v)) throw new Error('Choix invalide');
    cleaned[f.id] = v;
  }
  return cleaned;
}
export const settingsSchema = z
  .object({
    title: line,
    edition: line,
    date: z.iso.date(),
    eventAt: z.iso.datetime({ offset: true }),
    reception: z.string().regex(/^\d\d:\d\d$/),
    closing: z.string().max(80).nullable(),
    location: z.string().max(300).nullable(),
    contact: email,
    donationUrl: z
      .url()
      .refine(
        (s) => new URL(s).hostname === 'braincanada.akaraisin.com',
        'Lien Brain Canada requis',
      ),
    registrationOpen: z.boolean(),
    salesOpenAt: z.number().int().nullable(),
    salesCloseAt: z.number().int().nullable(),
    minimumAge: z.literal(18),
    refundDays: z.literal(15),
    taxMode: z.enum(['unconfirmed', 'included', 'not_applicable']),
    termsVersion: z.string().min(1).max(80),
    legalApproved: z.boolean(),
    brandApproved: z.boolean(),
    editableFields: z.array(z.enum(['phone', 'emergency_name', 'emergency_phone'])),
    terms: z.string().min(10).max(16000),
    privacy: z.string().min(10).max(16000),
    cause: z.string().max(5000),
    story: z.string().max(6000),
    faq: z.array(z.object({ q: line, a: z.string().max(3000) })).max(50),
    partners: z.array(z.object({ name: line, url: z.url(), logo: z.url() })).max(30),
    photos: z.array(z.object({ url: z.url(), alt: line })).max(30),
  })
  .strict();
export const activitySchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,50}$/),
    name: line,
    sport: z.enum(['velo', 'course', 'marche']),
    distance: line,
    price: z.number().int().min(0).max(1000000),
    capacity: z.number().int().positive().nullable(),
    opens_at: z.number().int().nullable(),
    closes_at: z.number().int().nullable(),
    enabled: z.union([z.literal(0), z.literal(1)]),
    route: z.object({
      description: z.string().max(5000).optional(),
      mapUrl: z
        .url()
        .refine((v) => v.startsWith('https://'))
        .optional(),
      gpxUrl: z
        .url()
        .refine((v) => v.startsWith('https://'))
        .optional(),
      supplies: z.array(z.string().max(200)).max(30).optional(),
    }),
  })
  .strict();
