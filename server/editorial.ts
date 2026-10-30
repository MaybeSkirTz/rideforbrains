import { z } from 'zod';
import { defaultEditorial } from '../shared/editorial';
export const publicURL = z
  .string()
  .max(2000)
  .refine((value) => {
    if (/^\/media\/[a-f0-9-]+\.(webp|png|jpg|avif)$/.test(value)) return true;
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Adresse HTTPS ou média du site requis');
const optionalURL = z.union([publicURL, z.literal('')]);
export const editorialSchema = z
  .object({
    heroTitle: z.string().min(1).max(160),
    heroIntro: z.string().max(700),
    firstEdition: z
      .object({
        title: z.string().min(1).max(150),
        intro: z.string().max(4000),
        memories: z.array(z.string().max(800)).max(12),
        stats: z
          .array(
            z
              .object({ label: z.string().min(1).max(100), value: z.string().min(1).max(100) })
              .strict(),
          )
          .max(12),
        press: z
          .array(z.object({ title: z.string().min(1).max(180), url: publicURL }).strict())
          .max(20),
      })
      .strict(),
    team: z
      .array(
        z
          .object({
            name: z.string().min(1).max(150),
            role: z.string().max(150),
            story: z.string().max(2500),
            quote: z.string().max(500),
            photo: optionalURL,
            enabled: z.boolean(),
          })
          .strict(),
      )
      .max(30),
    practical: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z0-9-]{1,50}$/),
            title: z.string().min(1).max(150),
            body: z.string().max(6000),
            enabled: z.boolean(),
          })
          .strict(),
      )
      .max(30),
    transfersEnabled: z.boolean(),
    transferDeadline: z.number().int().nullable(),
  })
  .strict()
  .default(defaultEditorial);
export const visibleFields = {
  enabled: z.boolean().optional(),
  order: z.number().int().min(0).max(999).optional(),
};
