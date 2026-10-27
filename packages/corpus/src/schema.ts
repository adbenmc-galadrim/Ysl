import { trackingContexts } from '@repo/contract/tracking';
import { z } from 'zod';

export const carriers = trackingContexts;

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
  pdf: z
    .object({
      page: z.int().positive(),
      crop: z
        .object({
          left: z.number().min(0).max(1),
          top: z.number().min(0).max(1),
          width: z.number().positive().max(1),
          height: z.number().positive().max(1),
        })
        .refine(
          (c) => c.left + c.width <= 1 && c.top + c.height <= 1,
          'le cadrage sort de la page',
        ),
    })
    .optional(),
});

export const labelSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    source: sourceSchema,
    file: z.string().min(1),
    carrier: carrierSchema,
    tracking: z.string().min(1).nullable(),
    /** Other valid numbers the label prints (a registered sticker over the carrier's): reading one is right too. */
    otherTrackings: z.array(z.string().min(1)).optional(),
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
