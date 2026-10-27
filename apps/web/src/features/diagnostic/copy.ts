import { explainField } from '@repo/contract/extract';
import type { TranslateFn } from '@repo/shared/i18n';
import type {
  ExtractionFieldName,
  LocalExtraction,
} from '#/features/db/schema';
import {
  adjustmentLabel,
  codeParser,
  formatConfidence,
  formatDelta,
  formatMs,
  formatValue,
  othersOf,
  PERSONAL_FIELDS,
  rankLabel,
  READING_FIELDS,
  readAt,
  sourceLabel,
  sourcesOf,
} from '#/features/diagnostic/model';

/**
 * "Camille Morel" → "C. M.": enough to tell two parcels apart in a mail.
 * Not `initialsOf` (settings): its "CM" of an avatar reads as a code here.
 */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((word) => word !== '')
    .map((word) => `${word[0]!.toUpperCase()}.`)
    .join(' ');

/**
 * The diagnostic as plain text, to paste in a mail to support: every field
 * with its level, sources, ranks and adjustments, the codes and the times.
 * Nothing personal beyond need: names cut to initials, neither the printed
 * text nor the raw content of the codes (their length only), no source value.
 */
export function diagnosticText(
  extraction: LocalExtraction,
  { t, now }: { t: TranslateFn; now: Date },
): string {
  const out: string[] = [
    t('reading.title'),
    `${t('reading.subtitle.device', { when: readAt(extraction.createdAt, now) })} · ${t('reading.fact.version')} ${extraction.version}`,
    `${t('reading.fact.codes')} ${formatMs(extraction.durations.codesMs, t)} · ${t('reading.fact.ocr')} ${formatMs(extraction.durations.ocrMs, t)} · ${t('reading.fact.fusion')} ${formatMs(extraction.durations.fusionMs, t)}`,
    '',
  ];
  const shown = (name: ExtractionFieldName, value: unknown) => {
    const text = formatValue(name, value, t);
    return PERSONAL_FIELDS.has(name) ? initials(text) : text;
  };
  for (const name of READING_FIELDS) {
    const field = extraction.fields[name];
    if (!field) continue;
    out.push(
      `${t(`reading.field.${name}`)} : ${shown(name, field.value)} — ${t(`reading.level.${field.level}`)} (${formatConfidence(field.confidence)})`,
    );
    for (const source of sourcesOf(name, field, t)) {
      out.push(
        `  [${rankLabel(source, t)}] ${sourceLabel(source, t)} : ${formatConfidence(source.confidence)}`,
      );
    }
    for (const a of explainField(field).adjustments) {
      out.push(
        `  ${adjustmentLabel(a.kind, field.sources.length, t)} : ${formatDelta(a.delta)}`,
      );
    }
    for (const other of othersOf(name, field, t)) {
      const value = PERSONAL_FIELDS.has(name)
        ? initials(other.value)
        : other.value;
      out.push(`  ≠ ${value} (${formatConfidence(other.confidence)})`);
    }
  }
  out.push(
    '',
    `${t('reading.copy.codes', { count: extraction.codes.length })}`,
  );
  for (const symbol of extraction.codes) {
    out.push(
      `  ${symbol.format} — ${codeParser(symbol, t).parser} — ${t('reading.copy.length', { count: symbol.text.length })}`,
    );
  }
  const lines = extraction.ocrText ? extraction.ocrText.split('\n').length : 0;
  out.push(t('reading.copy.lines', { count: lines }));
  return out.join('\n');
}
