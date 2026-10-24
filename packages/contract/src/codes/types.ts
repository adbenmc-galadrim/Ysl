import type { BarcodeTracking } from '../tracking/barcode';
import type { TrackingContext } from '../tracking/rules';

export type CodeScheme = 'iso15434' | 'gs1' | 'la-poste';

export type Party = {
  name?: string;
  company?: string;
  street?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
};

export type Pieces = { index: number; total: number };

export type ParsedCode = {
  scheme: CodeScheme;
  carrier: TrackingContext | null;
  trackings: BarcodeTracking[];
  recipient?: Party;
  sender?: Party;
  pieces?: Pieces;
  weightKg?: number;
  service?: string;
  shipperAccount?: string;
  reference?: string;
  fields: Record<string, string>;
};
