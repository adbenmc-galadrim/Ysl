import { normalizeTracking } from '../tracking/normalize';
import type { ParsedCode } from './types';

const LA_POSTE = /^(FR\d{2}[A-Z0-9]{4})(\d{14}|\d[A-Z]\d{11})(.*)$/;

export const parseLaPosteDataMatrix = (raw: string): ParsedCode | null => {
  const match = LA_POSTE.exec(normalizeTracking(raw));
  if (!match) return null;
  const [, prefix, tracking, suffix] = match;
  return {
    scheme: 'la-poste',
    carrier: 'la-poste',
    trackings: [{ value: tracking!, context: 'la-poste' }],
    fields: {
      prefix: prefix!,
      trackingNumber: tracking!,
      ...(suffix === '' ? {} : { suffix: suffix! }),
    },
  };
};
