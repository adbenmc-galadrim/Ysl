import type { ReadableFormat } from '@repo/barcode';
import type { DecodeResult } from '@repo/barcode/worker';
import type { ParsedCode } from '@repo/contract/codes';
import {
  type ConfidenceLevel,
  extractFields,
  type Field,
} from '@repo/contract/extract';
import {
  DEFAULT_LOCALE,
  type TranslateFn,
  type TranslationKey,
} from '@repo/shared/i18n';
import type { ScanField, ScanReading } from '@repo/ui';
import type { FrameVerdict } from '#/features/camera/quality';
import type { DraftParcel, DraftSender } from '#/features/db/schema';
import {
  type AnnexLevel,
  annexOf,
  type DraftAnnex,
} from '#/features/scan/annex';
import { carrierName } from '#/features/scan/carriers';
import { draftFields, scoreTracking } from '#/features/scan/confidence';
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

/** How many values a field below « à vérifier » offers instead (§4.4). */
const SUGGESTIONS = 3;

/**
 * A value as §4.4 shows it: plain and ticked when sure; with a « ? » and an
 * alert to verify; below that, the field stays empty and the values the
 * reader half saw come as chips.
 */
export function levelField(
  label: string,
  value: string,
  level: ConfidenceLevel,
  options: { mono?: boolean; suggestions?: readonly string[] } = {},
): ScanField {
  const mono = options.mono ? { mono: true } : {};
  if (level === 'sure') return { label, value, ...mono };
  if (level === 'to-verify') {
    return { label, value: `${value} ?`, status: 'warning', ...mono };
  }
  const suggestions = options.suggestions ?? [value];
  return {
    label,
    value: '',
    status: 'error',
    ...mono,
    suggestions: suggestions
      .slice(0, SUGGESTIONS)
      .map((suggestion) => ({ label: suggestion })),
  };
}

/** The values a field half saw, best first: what a « non lu » field offers. */
export const suggestionsOf = (field: Field<string> | null) =>
  field?.candidates.map((candidate) => candidate.value) ?? [];

/** The fields of the tracking kept for the label, the same one the batch stores. */
function trackingFields(
  { verdict }: SelectedTracking,
  parsed: ParsedCode | null,
  text: TextHint,
  annex: DraftAnnex,
  read: ReturnType<typeof extractFields>,
  t: TranslateFn,
): ScanField[] {
  const carrier = verdict.carrier ?? parsed?.carrier ?? null;
  const recipient = recipientField(parsed, text, t, read.recipient);
  const tracking = scoreTracking(verdict.value, read.tracking);
  const carrierLevel =
    read.carrier?.value === carrier ? read.carrier.level : 'sure';
  const fields: ScanField[] = [
    carrier
      ? levelField(
          t('scan.field.carrier'),
          carrierName(carrier, t),
          carrierLevel,
        )
      : {
          label: t('scan.field.carrier'),
          value: t('scan.field.unknown'),
          status: 'warning',
        },
    levelField(
      t('scan.field.tracking'),
      verdict.value,
      tracking?.level ?? 'none',
      { mono: true, suggestions: [verdict.value] },
    ),
    recipient,
  ];
  const sender = senderField(text, t);
  if (sender) fields.push(sender);
  return [...fields, ...annexFields(annex, t)];
}

/**
 * A value « à vérifier » (§4.4: the printed text alone gave it, or a code
 * and the text disagree) is shown as the recipient the OCR guessed: with a
 * question mark and a warning.
 */
function annexField(
  label: string,
  value: string,
  level: AnnexLevel,
): ScanField {
  return level === 'sure'
    ? { label, value }
    : { label, value: `${value} ?`, status: 'warning' };
}

/**
 * The annex fields worth a line (F20): the box among several, never the
 * « 1/1 » of a single parcel; the weight; the service when the carrier
 * names it, a bare code says nothing to the agent. The reference waits for
 * the parcel's page.
 */
export function annexFields(annex: DraftAnnex, t: TranslateFn): ScanField[] {
  const fields: ScanField[] = [];
  if (annex.pieces && annex.pieces.total > 1) {
    fields.push(
      annexField(
        t('scan.field.pieces'),
        `${annex.pieces.index}/${annex.pieces.total}`,
        annex.pieces.level,
      ),
    );
  }
  if (annex.weightKg) {
    fields.push(
      annexField(
        t('scan.field.weight'),
        formatWeight(annex.weightKg.value, t),
        annex.weightKg.level,
      ),
    );
  }
  if (annex.service?.label) {
    fields.push(
      annexField(
        t('scan.field.service'),
        annex.service.label,
        annex.service.level,
      ),
    );
  }
  return fields;
}

/**
 * What the OCR said of the recipient, once it has: a name, or nothing. The
 * name alone is worth a field even when no code was read: that is where
 * the OCR helps most. `readName` is a name sure for another reason than a
 * code of this label: the agent gave it (F11).
 */
export type TextHint =
  | {
      ocrName: string | null;
      readName?: string | null;
      /** The sender proposed for the draft, by its codes, the dictionary or the OCR. */
      sender?: DraftSender | null;
      /** The annex fields as the draft holds them; else read from the codes alone. */
      annex?: DraftAnnex | null;
    }
  | undefined;

/**
 * The sender as the agent sees it (F19, §4.4): sure, plain; to verify or
 * a bare guess, with a question mark and a warning; no sender, no line.
 */
function senderField(text: TextHint, t: TranslateFn): ScanField | null {
  const sender = text?.sender;
  if (!sender) return null;
  return levelField(t('scan.field.sender'), sender.name, sender.level);
}

/**
 * The recipient as the agent sees it, scored by §4.3: a name the agent
 * copied is sure; a code's name is sure unless the printed text names
 * someone else or the address is not the mailroom's; the OCR's name alone
 * is to verify (an anchored block, 0,65); else missing.
 */
function recipientField(
  parsed: ParsedCode | null,
  text: TextHint,
  t: TranslateFn,
  read: Field<string> | null = null,
): ScanField {
  const label = t('scan.field.recipient');
  const coded = partyName(parsed?.recipient);
  const copied = text?.readName && text.readName !== coded;
  if (copied) return { label, value: text.readName! };
  if (coded) {
    const level = read?.value === coded ? read.level : 'sure';
    return levelField(label, coded, level, {
      suggestions: suggestionsOf(read),
    });
  }
  if (text?.ocrName) {
    return levelField(label, text.ocrName, read?.level ?? 'to-verify', {
      suggestions: suggestionsOf(read),
    });
  }
  return { label, value: t('scan.field.missing'), status: 'warning' };
}

/**
 * What the shot looked like, for the advice when nothing was read (F05):
 * the frame's verdict, and whether the torch was lit, which a glare on a
 * plastic-covered label often comes from (F07).
 */
export type ShotHint = { quality: FrameVerdict; torchOn: boolean };

/** The advice under "Aucun code lu": what to change before the next shot. */
export function unreadableReading(
  t: TranslateFn,
  shot?: ShotHint,
): ScanReading {
  const hint =
    shot?.quality === 'glare'
      ? t(shot.torchOn ? 'scan.glare.torchHint' : 'scan.glare.hint')
      : shot?.quality === 'blurry'
        ? t('scan.blur.hint')
        : t('scan.noCode.hint');
  return { kind: 'unreadable', title: t('scan.noCode.title'), hint };
}

/** A symbol as the Worker gave it, or as the draft kept it (bare). */
export type ShownSymbol = Pick<
  DecodeResult['symbols'][number],
  'format' | 'text'
> &
  Partial<Pick<DecodeResult['symbols'][number], 'isValid'>>;

export function toScanReading(
  result: { symbols: readonly ShownSymbol[] },
  t: TranslateFn,
  text?: TextHint,
  shot?: ShotHint,
): ScanReading {
  if (result.symbols.length === 0) {
    const sender = senderField(text, t);
    if (text?.ocrName || text?.readName || sender) {
      return {
        kind: 'read',
        fields: [recipientField(null, text, t), ...(sender ? [sender] : [])],
      };
    }
    return unreadableReading(t, shot);
  }
  const selected = selectTracking(result.symbols);
  if (selected) {
    const parsed = structuredCode(result.symbols, selected);
    const annex = text?.annex ?? annexOf(result.symbols, null);
    const read = extractFields({
      symbols: result.symbols,
      ocr: text?.ocrName ? { text: '', recipientName: text.ocrName } : null,
    });
    return {
      kind: 'read',
      fields: trackingFields(selected, parsed, text, annex, read, t),
    };
  }
  const fields: ScanField[] = result.symbols.map((symbol) => ({
    label: formatLabel(symbol.format, t),
    value: displayText(symbol.text),
    mono: true,
    ...(symbol.isValid === false ? { status: 'warning' as const } : {}),
  }));
  if (text?.ocrName || text?.readName) {
    fields.push(recipientField(null, text, t));
  }
  const sender = senderField(text, t);
  if (sender) fields.push(sender);
  return { kind: 'read', fields };
}

export function failedReading(t: TranslateFn): ScanReading {
  return {
    kind: 'unreadable',
    title: t('scan.failed.title'),
    hint: t('scan.failed.hint'),
  };
}

/**
 * The carrier and the tracking as « Vérifier un colis » shows them, at the
 * level the draft reached (§4.4). Below « à vérifier » the number the
 * reader half saw comes as chips the agent can pick: a pick is theirs
 * (§4.3 rank 9).
 */
export function checkFields(
  draft: DraftParcel,
  t: TranslateFn,
  onPick?: (tracking: string) => void,
): ScanField[] {
  const { tracking, extraction } = draftFields(draft);
  const carrierLabel = t('scan.field.carrier');
  const trackingLabel = t('scan.field.tracking');
  const fields: ScanField[] = [
    draft.carrier
      ? levelField(
          carrierLabel,
          draft.carrier,
          !draft.trackingConfirmed &&
            extraction.carrier &&
            carrierName(extraction.carrier.value, t) === draft.carrier
            ? extraction.carrier.level
            : 'sure',
        )
      : {
          label: carrierLabel,
          value: t('scan.field.unknown'),
          status: 'warning',
        },
  ];
  if (tracking === null) {
    fields.push({
      label: trackingLabel,
      value: t('scan.field.missing'),
      mono: true,
      status: 'warning',
    });
    return fields;
  }
  const values = [
    tracking.value,
    ...suggestionsOf(extraction.tracking).filter((v) => v !== tracking.value),
  ];
  const field = levelField(trackingLabel, tracking.value, tracking.level, {
    mono: true,
    suggestions: values,
  });
  fields.push(
    onPick && field.suggestions
      ? {
          ...field,
          suggestions: values.slice(0, SUGGESTIONS).map((value) => ({
            label: value,
            onPick: () => onPick(value),
            pickLabel: t('scan.field.pick', { value }),
          })),
        }
      : field,
  );
  return fields;
}
