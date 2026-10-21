import { z } from 'zod';

export const carriers = [
  'colissimo',
  'chronopost',
  'la-poste',
  'dhl-express',
  'dhl-paket',
  'deutsche-post',
  'ups',
  'fedex',
  'dpd',
  'gls',
  'tnt',
  'hermes',
  'amazon',
  'other',
] as const;

export const sources = ['synthetic', 'web', 'real'] as const;

export const difficulties = [
  'tilt',
  'blur',
  'glare',
  'low-light',
  'noise',
  'crumpled',
  'vertical-text',
  'maxicode',
  'partial',
] as const;

export const carrierSchema = z.enum(carriers);
export const sourceSchema = z.enum(sources);

const webOriginSchema = z.object({
  url: z.url(),
  page: z.url(),
  sha1: z.string().regex(/^[0-9a-f]{40}$/),
  license: z.string().min(1),
  author: z.string().min(1),
});

export const labelSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    source: sourceSchema,
    file: z.string().min(1),
    carrier: carrierSchema,
    tracking: z.string().min(1).nullable(),
    recipient: z.string().min(1).nullable(),
    sender: z.string().min(1).nullable(),
    pieces: z
      .object({
        index: z.int().positive(),
        total: z.int().positive(),
      })
      .refine((p) => p.index <= p.total, 'n/N : n dépasse N')
      .nullable(),
    weightKg: z.number().positive().nullable(),
    difficulties: z.array(z.enum(difficulties)),
    reviewed: z.boolean(),
    origin: webOriginSchema.optional(),
  })
  .refine((l) => l.source !== 'web' || l.origin !== undefined, {
    message: 'une étiquette web doit citer sa source et sa licence',
    path: ['origin'],
  });

export const manifestSchema = z.array(labelSchema);

export type Carrier = z.infer<typeof carrierSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Difficulty = (typeof difficulties)[number];
export type Label = z.infer<typeof labelSchema>;
