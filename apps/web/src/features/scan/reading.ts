import type { ReadableFormat } from '@repo/barcode';
import type { DecodeResult } from '@repo/barcode/worker';
import type { ParsedCode } from '@repo/contract/codes';
import {
  DEFAULT_LOCALE,
  type TranslateFn,
  type TranslationKey,
} from '@repo/shared/i18n';
import type { ScanField, ScanReading } from '@repo/ui';
import { carrierName } from '#/features/scan/carriers';
import {
  partyName,
  type SelectedTracking,
  selectTracking,
  structuredCode,
} from '#/features/scan/extract';

type FormatKey = Extract<TranslationKey, `scan.format.${string}`>;

const FORMAT_LABELS: Record<ReadableFormat, FormatKey> = {
  Code128: 'scan.format.Code128',
  Code39: 'scan.format.Code39',
  Code93: 'scan.format.Code93',
  ITF: 'scan.format.ITF',
  Codabar: 'scan.format.Codabar',
  EAN13: 'scan.format.EAN13',
  EAN8: 'scan.format.EAN8',
  UPCA: 'scan.format.UPCA',
  UPCE: 'scan.format.UPCE',
  DataBar: 'scan.format.DataBar',
  PDF417: 'scan.format.PDF417',
  Aztec: 'scan.format.Aztec',
  DataMatrix: 'scan.format.DataMatrix',
  QRCode: 'scan.format.QRCode',
  MaxiCode: 'scan.format.MaxiCode',
};

const CONTROL_CHARACTERS = /\p{Cc}/gu;

/** ISO 15434 separators (GS, RS, EOT) would otherwise render as tofu. */
function displayText(text: string): string {
  return text.replace(CONTROL_CHARACTERS, '·');
}

function formatLabel(format: string, t: TranslateFn): string {
  const key = (FORMAT_LABELS as Partial<Record<string, FormatKey>>)[format];
  return key ? t(key) : format;
}

function formatWeight(kg: number, t: TranslateFn): string {
  return t('scan.field.weightKg', {
    kg: kg.toLocaleString(DEFAULT_LOCALE, { maximumFractionDigits: 2 }),
  });
}

/** The fields of the tracking kept for the label, the same one the batch stores. */
function trackingFields(
  { verdict }: SelectedTracking,
  parsed: ParsedCode | null,
  text: TextHint,
  t: TranslateFn,
): ScanField[] {
  const carrier = verdict.carrier ?? parsed?.carrier ?? null;
  const recipient = recipientField(parsed, text, t);
  const fields: ScanField[] = [
    {
      label: t('scan.field.carrier'),
      value: carrier ? carrierName(carrier, t) : t('scan.field.unknown'),
      ...(carrier ? {} : { status: 'warning' as const }),
    },
    {
      label: t('scan.field.tracking'),
      value: verdict.value,
      mono: true,
      ...(verdict.status === 'sure' ? {} : { status: 'warning' as const }),
    },
    recipient,
  ];
  if (parsed?.pieces) {
    fields.push({
      label: t('scan.field.pieces'),
      value: `${parsed.pieces.index}/${parsed.pieces.total}`,
    });
  }
  if (parsed?.weightKg !== undefined) {
    fields.push({
      label: t('scan.field.weight'),
      value: formatWeight(parsed.weightKg, t),
    });
  }
  return fields;
}

/**
 * What the OCR said of the recipient, once it has: a name, or nothing. The
 * name alone is worth a field even when no code was read: that is where
 * the OCR helps most.
 */
export type TextHint = { ocrName: string | null } | undefined;

/**
 * The recipient as the agent sees it: named by a code, no doubt; guessed by
 * the OCR alone, with a question mark and a warning, as a value of the
 * lowest rank is shown (§4.3 rank 7, §4.4); else missing.
 */
function recipientField(
  parsed: ParsedCode | null,
  text: TextHint,
  t: TranslateFn,
): ScanField {
  const label = t('scan.field.recipient');
  const sure = partyName(parsed?.recipient);
  if (sure) return { label, value: sure };
  if (text?.ocrName) {
    return { label, value: `${text.ocrName} ?`, status: 'warning' };
  }
  return { label, value: t('scan.field.missing'), status: 'warning' };
}

export function toScanReading(
  result: Pick<DecodeResult, 'symbols'>,
  t: TranslateFn,
  text?: TextHint,
): ScanReading {
  if (result.symbols.length === 0) {
    if (text?.ocrName) {
      return { kind: 'read', fields: [recipientField(null, text, t)] };
    }
    return {
      kind: 'unreadable',
      title: t('scan.noCode.title'),
      hint: t('scan.noCode.hint'),
    };
  }
  const selected = selectTracking(result.symbols);
  if (selected) {
    const parsed = structuredCode(result.symbols, selected);
    return {
      kind: 'read',
      fields: trackingFields(selected, parsed, text, t),
    };
  }
  const fields: ScanField[] = result.symbols.map((symbol) => ({
    label: formatLabel(symbol.format, t),
    value: displayText(symbol.text),
    mono: true,
    ...(symbol.isValid ? {} : { status: 'warning' as const }),
  }));
  if (text?.ocrName) fields.push(recipientField(null, text, t));
  return { kind: 'read', fields };
}

export function failedReading(t: TranslateFn): ScanReading {
  return {
    kind: 'unreadable',
    title: t('scan.failed.title'),
    hint: t('scan.failed.hint'),
  };
}
