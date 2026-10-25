import type { CodeSymbol } from '@repo/contract/codes';
import { extractFields, type Field } from '@repo/contract/extract';
import type { DraftOcrLine } from '#/features/db/schema';

/** How surely a field was read (§4.4): a field below « à vérifier » is not kept. */
export type AnnexLevel = 'sure' | 'to-verify';

/**
 * What the label says of the parcel beyond its number (F20): the box among
 * several, the weight, the carrier's service and the shipper's reference,
 * each with the level the codes and the printed text give it.
 */
export type DraftAnnex = {
  pieces: { index: number; total: number; level: AnnexLevel } | null;
  weightKg: { value: number; level: AnnexLevel } | null;
  service: {
    code: string | null;
    label: string | null;
    level: AnnexLevel;
  } | null;
  reference: { value: string; level: AnnexLevel } | null;
};

const levelOf = (field: Field<unknown> | null): AnnexLevel | null =>
  field === null || field.level === 'none' ? null : field.level;

/** The printed lines as one text, for the rules of `@repo/contract/extract`. */
export const ocrText = (lines: readonly DraftOcrLine[]): string =>
  lines.map((line) => line.text).join('\n');

/**
 * The annex fields of one label: the codes alone when the text is not read
 * yet, the codes and the text once it is. Each field keeps its best value
 * when it reaches « à vérifier » (§4.4); below, the agent sees nothing.
 */
export function annexOf(
  symbols: readonly CodeSymbol[],
  lines: readonly DraftOcrLine[] | null,
): DraftAnnex {
  const text = lines === null ? '' : ocrText(lines);
  const read = extractFields({
    symbols,
    ocr: text === '' ? null : { text },
  });
  const pieces = levelOf(read.pieces);
  const weight = levelOf(read.weightKg);
  const service = levelOf(read.service);
  const reference = levelOf(read.reference);
  return {
    pieces:
      pieces && read.pieces ? { ...read.pieces.value, level: pieces } : null,
    weightKg:
      weight && read.weightKg
        ? { value: read.weightKg.value, level: weight }
        : null,
    service:
      service && read.service
        ? { ...read.service.value, level: service }
        : null,
    reference:
      reference && read.reference
        ? { value: read.reference.value, level: reference }
        : null,
  };
}

/** The service as the parcel keeps it: its name when known, else the carrier's code. */
export const serviceText = (annex: DraftAnnex | null | undefined) =>
  annex?.service?.label ?? annex?.service?.code ?? null;
