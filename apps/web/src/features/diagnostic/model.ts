import { parseCode } from '@repo/contract/codes';
import {
  type AdjustmentKind,
  type ConfidenceLevel,
  explainField,
  type FieldSource,
  sourceRank,
} from '@repo/contract/extract';
import {
  type TrackingContext,
  trackingsInBarcode,
  validateTracking,
} from '@repo/contract/tracking';
import type { TranslateFn } from '@repo/shared/i18n';
import type {
  LectureCode,
  LectureFact,
  LectureField,
  LectureLine,
  ScanFieldStatus,
} from '@repo/ui';
import type {
  DraftSymbol,
  ExtractionField,
  ExtractionFieldName,
  LocalExtraction,
} from '#/features/db/schema';
import type { NoReading, Reading } from '#/features/diagnostic/load';
import { formatWeight } from '#/features/parcels/edit';
import { formatTime, shortDate } from '#/features/parcels/model';
import { carrierName } from '#/features/scan/carriers';
import { groupTyped } from '#/features/scan/typed';

/** The fields in the order the label is read: who, what, then the annex. */
export const READING_FIELDS: readonly ExtractionFieldName[] = [
  'tracking',
  'carrier',
  'recipient',
  'sender',
  'pieces',
  'weightKg',
  'service',
  'reference',
];

/** Names of people: shown on the iPhone, reduced to initials in a copy. */
export const PERSONAL_FIELDS: ReadonlySet<ExtractionFieldName> = new Set([
  'recipient',
  'sender',
]);

/** The anchor of a field's card, the target of « D'où vient cette valeur ? ». */
export const fieldAnchor = (name: ExtractionFieldName) => `champ-${name}`;

const STATUS: Record<ConfidenceLevel, ScanFieldStatus> = {
  sure: 'ok',
  'to-verify': 'warning',
  none: 'error',
};

/** "0,89": two decimals, as §4.3 writes them. */
export const formatConfidence = (confidence: number) =>
  confidence.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** "+0,10", "−0,15", "0,00". */
export const formatDelta = (delta: number) =>
  `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${formatConfidence(Math.abs(delta))}`;

/** A stored value as the agent reads it, field by field. */
export function formatValue(
  name: ExtractionFieldName,
  value: unknown,
  t: TranslateFn,
): string {
  switch (name) {
    case 'tracking':
      return groupTyped(String(value));
    case 'carrier':
      return carrierName(value as TrackingContext, t);
    case 'pieces': {
      const { index, total } = value as { index: number; total: number };
      return `${index}/${total}`;
    }
    case 'weightKg':
      return t('scan.field.weightKg', { kg: formatWeight(Number(value)) });
    case 'service': {
      const { label, code } = value as { label?: string; code?: string };
      return label ?? code ?? '';
    }
    default:
      return String(value);
  }
}

/** What a source is, in words: "Code 2D Aztec", "Texte imprimé, bloc ancré". */
export function sourceLabel(source: FieldSource, t: TranslateFn): string {
  switch (source.kind) {
    case '2d':
      return t('reading.source.2d', { format: source.format });
    case '1d':
      return source.format === 'value' || source.format === 'draft'
        ? t('reading.source.value')
        : t('reading.source.1d', { format: source.format });
    case 'ocr':
      return source.format === 'block'
        ? t('reading.source.ocr.block')
        : t('reading.source.ocr');
    case 'learned':
      return t('reading.source.learned');
    case 'agent':
      return t('reading.source.agent');
  }
}

export const rankLabel = (source: FieldSource, t: TranslateFn) =>
  String(sourceRank(source) ?? t('reading.rank.none'));

export function adjustmentLabel(
  kind: AdjustmentKind,
  sources: number,
  t: TranslateFn,
): string {
  return kind === 'agreement'
    ? t('reading.adjust.agreement', { count: sources })
    : t(`reading.adjust.${kind}`);
}

/**
 * The sources worth showing: those of the value kept, and — when the agent
 * confirmed it — those that had read the same value.
 */
export function sourcesOf(
  name: ExtractionFieldName,
  field: ExtractionField,
  t: TranslateFn,
): FieldSource[] {
  if (!field.sources.some((s) => s.kind === 'agent')) return field.sources;
  const kept = formatValue(name, field.value, t);
  const read = field.candidates?.find(
    (c) => formatValue(name, c.value, t) === kept,
  );
  return [...field.sources, ...(read?.sources ?? [])];
}

/** The values the reader weighed and did not keep. */
export function othersOf(
  name: ExtractionFieldName,
  field: ExtractionField,
  t: TranslateFn,
) {
  const kept = formatValue(name, field.value, t);
  return (field.candidates ?? [])
    .map((c) => ({
      value: formatValue(name, c.value, t),
      confidence: c.confidence,
    }))
    .filter((c) => c.value !== kept);
}

export function describeField(
  name: ExtractionFieldName,
  field: ExtractionField,
  t: TranslateFn,
): LectureField {
  const explained = explainField(field);
  const agent = field.sources.some((s) => s.kind === 'agent');
  return {
    id: fieldAnchor(name),
    label: t(`reading.field.${name}`),
    value: formatValue(name, field.value, t),
    mono: name === 'tracking',
    status: STATUS[field.level],
    statusLabel: t(`reading.level.${field.level}`),
    confidence: formatConfidence(field.confidence),
    sources: sourcesOf(name, field, t).map((source) => ({
      rank: rankLabel(source, t),
      label: sourceLabel(source, t),
      value: source.kind === 'agent' ? undefined : source.value,
      confidence: formatConfidence(source.confidence),
    })),
    adjustments: explained.adjustments.map((a) => ({
      label: adjustmentLabel(a.kind, field.sources.length, t),
      delta: formatDelta(a.delta),
    })),
    others: othersOf(name, field, t).map((o) => ({
      value: o.value,
      confidence: formatConfidence(o.confidence),
    })),
    note: agent ? t('reading.note.agent') : undefined,
  };
}

/** Control characters (ISO 15434 separators) shown as « · », as on `/scan`. */
export const printable = (text: string) => text.replace(/\p{Cc}/gu, '·');

/** Which parser understood a code, or the carrier its number names. */
export function codeParser(
  symbol: DraftSymbol,
  t: TranslateFn,
): { parser: string; recognized: boolean } {
  const parsed = parseCode(symbol.text, symbol.format);
  if (parsed) {
    return {
      parser: t('reading.code.recognized', {
        parser: t(`reading.code.scheme.${parsed.scheme}`),
      }),
      recognized: true,
    };
  }
  for (const found of trackingsInBarcode(symbol.text)) {
    const verdict = validateTracking(found.value, { context: found.context });
    if (verdict.status !== 'rejected' && verdict.carrier !== null) {
      return {
        parser: t('reading.code.tracking', {
          carrier: carrierName(verdict.carrier, t),
        }),
        recognized: true,
      };
    }
  }
  return { parser: t('reading.code.unknown'), recognized: false };
}

const compact = (text: string) => text.replace(/\s+/g, '').toUpperCase();

/**
 * The printed text line by line; a line that carries the value of an OCR
 * source (the anchored name, a printed number) names the field it fed.
 */
export function linesOf(
  extraction: LocalExtraction,
  t: TranslateFn,
): LectureLine[] {
  if (!extraction.ocrText) return [];
  const marks = READING_FIELDS.flatMap((name) => {
    const field = extraction.fields[name];
    if (!field) return [];
    const sources = [
      ...field.sources,
      ...(field.candidates ?? []).flatMap((c) => c.sources),
    ];
    return sources
      .filter((s) => s.kind === 'ocr' && compact(s.value) !== '')
      .map((s) => ({
        value: compact(s.value),
        label: t(`reading.field.${name}`),
      }));
  });
  return extraction.ocrText.split('\n').map((text) => {
    const line = compact(text);
    const labels = [
      ...new Set(
        marks.filter((m) => line.includes(m.value)).map((m) => m.label),
      ),
    ];
    return labels.length > 0 ? { text, mark: labels.join(' · ') } : { text };
  });
}

export const formatMs = (value: number | null | undefined, t: TranslateFn) =>
  value === null || value === undefined
    ? t('reading.fact.unknown')
    : t('reading.fact.ms', { ms: value });

export function factsOf(
  extraction: LocalExtraction,
  t: TranslateFn,
): LectureFact[] {
  const { codesMs, ocrMs, fusionMs } = extraction.durations;
  return [
    { label: t('reading.fact.codes'), value: formatMs(codesMs, t) },
    { label: t('reading.fact.ocr'), value: formatMs(ocrMs, t) },
    { label: t('reading.fact.fusion'), value: formatMs(fusionMs, t) },
    { label: t('reading.fact.version'), value: String(extraction.version) },
  ];
}

/** "20 oct. à 9 h 00". */
export const readAt = (date: Date, now: Date) =>
  `${shortDate(date, now)} à ${formatTime(date)}`;

/** A reading with neither a code nor a line of text: the number was typed. */
export const nothingRead = (extraction: LocalExtraction) =>
  extraction.codes.length === 0 && !extraction.ocrText;

export type ReadingView =
  | {
      kind: 'reading';
      subtitle: string;
      fields: LectureField[];
      codes: LectureCode[];
      lines: LectureLine[];
      facts: LectureFact[];
    }
  | { kind: 'empty'; reason: NoReading };

/** The diagnostic screen of a reading, every string ready (F22). */
export function describeReading(
  reading: Reading,
  { t, now }: { t: TranslateFn; now: Date },
): ReadingView {
  if (reading.kind === 'none') return { kind: 'empty', reason: reading.reason };
  const { extraction } = reading;
  if (nothingRead(extraction)) return { kind: 'empty', reason: 'never' };
  return {
    kind: 'reading',
    subtitle:
      reading.kind === 'draft'
        ? t('reading.subtitle.draft')
        : t('reading.subtitle.device', {
            when: readAt(extraction.createdAt, now),
          }),
    fields: READING_FIELDS.flatMap((name) => {
      const field = extraction.fields[name];
      return field ? [describeField(name, field, t)] : [];
    }),
    codes: extraction.codes.map((symbol) => ({
      format: symbol.format,
      text: printable(symbol.text),
      ...codeParser(symbol, t),
    })),
    lines: linesOf(extraction, t),
    facts: factsOf(extraction, t),
  };
}
