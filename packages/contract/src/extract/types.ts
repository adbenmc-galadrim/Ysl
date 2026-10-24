import type { CodeSymbol, ParsedCode, Pieces } from '../codes';
import type { TrackingContext } from '../tracking/rules';

export type SourceKind = '2d' | '1d' | 'ocr';

export type ConfidenceLevel = 'sure' | 'to-verify' | 'none';

export type FieldFlag = 'conflict' | 'tie';

export type FieldSource = {
  kind: SourceKind;
  format: string;
  confidence: number;
  value: string;
};

export type Candidate<T> = {
  value: T;
  confidence: number;
  sources: FieldSource[];
};

export type Field<T> = {
  value: T;
  confidence: number;
  level: ConfidenceLevel;
  sources: FieldSource[];
  flags: FieldFlag[];
  candidates: Candidate<T>[];
};

/** Raw OCR of the label, reserved for the OCR rules (§4.3 ranks 5 to 7). */
export type OcrInput = { text: string };

export type ExtractInput = {
  symbols: readonly CodeSymbol[];
  ocr?: OcrInput | null;
};

export type Extraction = {
  tracking: Field<string> | null;
  carrier: Field<TrackingContext> | null;
  recipient: Field<string> | null;
  sender: Field<string> | null;
  pieces: Field<Pieces> | null;
  weightKg: Field<number> | null;
  codes: ParsedCode[];
};
