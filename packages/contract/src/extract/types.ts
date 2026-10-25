import type { CarrierService, CodeSymbol, ParsedCode, Pieces } from '../codes';
import type { TrackingContext } from '../tracking/rules';
import type { AccountRead, SenderKnowledge } from './sender';

export type SourceKind = '2d' | '1d' | 'ocr' | 'learned';

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

/**
 * What the OCR read: the printed text, its lines joined by newlines (§4.3
 * ranks 6 and 7), and the sender its `FROM` block names, when one does.
 */
export type OcrInput = { text: string; senderName?: string | null };

export type ExtractInput = {
  symbols: readonly CodeSymbol[];
  ocr?: OcrInput | null;
  /** The account dictionary and the senders already seen (§4.8). */
  senders?: SenderKnowledge | null;
};

export type Extraction = {
  tracking: Field<string> | null;
  carrier: Field<TrackingContext> | null;
  recipient: Field<string> | null;
  sender: Field<string> | null;
  /** The known sender the sender field names, when it comes from the dictionary. */
  senderId: string | null;
  /** The carrier accounts the codes carry, to look up and to learn (§4.8). */
  accounts: AccountRead[];
  pieces: Field<Pieces> | null;
  weightKg: Field<number> | null;
  service: Field<CarrierService> | null;
  reference: Field<string> | null;
  codes: ParsedCode[];
};
