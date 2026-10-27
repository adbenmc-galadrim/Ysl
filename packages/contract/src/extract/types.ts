import type { CarrierService, CodeSymbol, ParsedCode, Pieces } from '../codes';
import type { TrackingContext } from '../tracking/rules';
import type { AccountRead, SenderKnowledge } from './sender';

export type SourceKind = '2d' | '1d' | 'ocr' | 'learned';

export type ConfidenceLevel = 'sure' | 'to-verify' | 'none';

/**
 * Why a field is less sure than its sources: two of them disagree, the
 * carrier vote is tied, no check digit vouches for the tracking (O1), the
 * recipient's address is not the mailroom's (« réexpédition ? »).
 */
export type FieldFlag = 'conflict' | 'tie' | 'unkeyed' | 'forward';

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
 * What the OCR read: the printed text, its lines joined by newlines, for the
 * numbers and annex fields it prints (§4.3 ranks 5 to 7), and the sender
 * and the recipient its anchored blocks name, when they do.
 */
export type OcrInput = {
  text: string;
  senderName?: string | null;
  /** The recipient the anchored block names (`SHIP TO`, `DESTINATAIRE`…). */
  recipientName?: string | null;
};

export type ExtractInput = {
  symbols: readonly CodeSymbol[];
  ocr?: OcrInput | null;
  /** The account dictionary and the senders already seen (§4.8). */
  senders?: SenderKnowledge | null;
  /** Full names of the directory cards the recipient may be (§4.3 bonus). */
  directory?: readonly string[] | null;
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
