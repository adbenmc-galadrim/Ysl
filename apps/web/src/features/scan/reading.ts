import type { ReadableFormat } from '@repo/barcode';
import type { DecodeResult } from '@repo/barcode/worker';
import {
  DEFAULT_LOCALE,
  type TranslateFn,
  type TranslationKey,
} from '@repo/shared/i18n';
import type { ScanField, ScanReading } from '@repo/ui';
import { carrierName } from '#/features/scan/carriers';
import { type SelectedTracking, selectTracking } from '#/features/scan/extract';

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
  { verdict, parsed }: SelectedTracking,
  t: TranslateFn,
): ScanField[] {
  const carrier = verdict.carrier ?? parsed?.carrier ?? null;
  const recipient = parsed?.recipient?.name ?? parsed?.recipient?.company;
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
    {
      label: t('scan.field.recipient'),
      value: recipient ?? t('scan.field.missing'),
      ...(recipient ? {} : { status: 'warning' as const }),
    },
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

export function toScanReading(
  result: Pick<DecodeResult, 'symbols'>,
  t: TranslateFn,
): ScanReading {
  if (result.symbols.length === 0) {
    return {
      kind: 'unreadable',
      title: t('scan.noCode.title'),
      hint: t('scan.noCode.hint'),
    };
  }
  const selected = selectTracking(result.symbols);
  if (selected) return { kind: 'read', fields: trackingFields(selected, t) };
  const fields: ScanField[] = result.symbols.map((symbol) => ({
    label: formatLabel(symbol.format, t),
    value: displayText(symbol.text),
    mono: true,
    ...(symbol.isValid ? {} : { status: 'warning' as const }),
  }));
  return { kind: 'read', fields };
}

export function failedReading(t: TranslateFn): ScanReading {
  return {
    kind: 'unreadable',
    title: t('scan.failed.title'),
    hint: t('scan.failed.hint'),
  };
}
