import {
  SCAN_REPORT_VERSION,
  type ScanReportMissing,
  type ScanReportOrigin,
  type ScanReportV1,
} from '@repo/contract/scan-report';
import { PHOTO_QUALITY } from '#/features/camera/capture';
import type {
  CourrierDatabase,
  DraftParcel,
  LocalExtraction,
  LocalParcel,
  LocalPhoto,
} from '#/features/db/schema';
import { loadReading, type NoReading } from '#/features/diagnostic/load';
import type { PhotoFiles } from '#/features/photos/opfs';
import { readPhoto } from '#/features/photos/store';
import { ocrText } from '#/features/scan/annex';
import { draftFields } from '#/features/scan/confidence';
import {
  enqueueReport,
  inMemory,
  type LocalScanReport,
} from '#/features/scan-report/outbox';
import {
  correctionsOf,
  json,
  type ReportContext,
  type ReportImage,
} from '#/features/scan-report/report';

/** Why nothing can be reported away from the scan screen: no reading kept, or no photo. */
export type KeptReason = NoReading | 'photo';

/** What the phone still holds of a label once the scan screen moved on. */
export type KeptReading = {
  id: string;
  extraction: LocalExtraction;
  photo: LocalPhoto;
} & (
  | { from: 'draft'; draft: DraftParcel }
  | { from: 'stored'; parcel: LocalParcel | undefined }
);

/**
 * The readings and the photo of a parcel or of a draft of the batch, or why
 * a report would be empty: purged past the retention, never read, read on
 * another iPhone, or its photo gone.
 */
export async function loadKept(
  db: CourrierDatabase,
  id: string,
  now = new Date(),
): Promise<{ kept: KeptReading } | { reason: KeptReason }> {
  const reading = await loadReading(db, id, now);
  if (reading.kind === 'none') return { reason: reading.reason };
  const photo = reading.photoId
    ? await db.photo.get(reading.photoId)
    : undefined;
  if (!photo) return { reason: 'photo' };
  const { extraction } = reading;
  if (reading.kind === 'draft') {
    const draft = await db.draftParcel.get(id);
    if (!draft) return { reason: 'missing' };
    return { kept: { id, extraction, photo, from: 'draft', draft } };
  }
  const parcel = await db.parcel.get(id);
  return { kept: { id, extraction, photo, from: 'stored', parcel } };
}

/** The stored photo, in memory as every report image (YSL-149); null when its file is gone. */
export async function keptImage(
  files: PhotoFiles,
  photo: LocalPhoto,
): Promise<{ blob: Blob; image: ReportImage } | null> {
  const blob = await inMemory(readPhoto(files, photo), 'image/jpeg');
  if (!blob) return null;
  return {
    blob,
    image: {
      type: 'image/jpeg',
      width: photo.width,
      height: photo.height,
      bytes: blob.size,
      quality: PHOTO_QUALITY,
    },
  };
}

/** What the phone keeps of the codes and the text, as saved. */
function keptOf(kept: KeptReading): NonNullable<ScanReportV1['kept']> {
  if (kept.from === 'draft') {
    const { draft } = kept;
    const text = ocrText(draft.ocrLines);
    return {
      from: 'draft',
      readAt: draft.createdAt.toISOString(),
      rules: null,
      codes: draft.symbols.map(({ format, text: code }) => ({
        format,
        text: code,
      })),
      ocrLines: draft.ocrLines.map(({ text: line, box, score }) => ({
        text: line,
        box: { ...box },
        score,
      })),
      ocrText: text === '' ? null : text,
      durations: {
        codesMs: draft.durations?.codesMs ?? null,
        ocrMs: draft.durations?.ocrMs ?? null,
        fusionMs: null,
      },
    };
  }
  const { extraction } = kept;
  return {
    from: 'stored',
    readAt: extraction.createdAt.toISOString(),
    rules: extraction.version,
    codes: extraction.codes.map(({ format, text }) => ({ format, text })),
    ocrLines: null,
    ocrText: extraction.ocrText,
    durations: {
      codesMs: extraction.durations.codesMs,
      ocrMs: extraction.durations.ocrMs,
      fusionMs: extraction.durations.fusionMs ?? null,
    },
  };
}

function missingOf(kept: KeptReading): ScanReportMissing[] {
  const missing: ScanReportMissing[] = ['frame', 'shot', 'decodePasses'];
  if (kept.from === 'draft') {
    if (kept.draft.ocrLines.length === 0) missing.push('ocr');
    return missing;
  }
  missing.push(kept.extraction.ocrText ? 'ocrBoxes' : 'ocr');
  missing.push('extraction', 'draft');
  return missing;
}

function ocrOf(kept: KeptReading): ScanReportV1['ocr'] {
  if (kept.from === 'stored') {
    return { state: kept.extraction.ocrText ? 'kept' : 'none' };
  }
  const { ocrState, ocrLines } = kept.draft;
  if (ocrState !== 'done') return { state: ocrState };
  return { state: ocrLines.length > 0 ? 'kept' : 'none' };
}

const AGENT_FIELDS = ['tracking', 'recipient', 'sender'] as const;

/** A parcel past « Terminer » keeps no draft: the agent's answers are its sources. */
function storedCorrections(
  extraction: LocalExtraction,
): ScanReportV1['corrections'] {
  return AGENT_FIELDS.flatMap((field) => {
    const kept = extraction.fields[field];
    if (!kept?.sources.some((source) => source.kind === 'agent')) return [];
    return [
      {
        field,
        value:
          typeof kept.value === 'string'
            ? kept.value
            : kept.value === null
              ? null
              : JSON.stringify(kept.value),
        how: field === 'tracking' ? 'confirmed' : 'chosen',
      } as const,
    ];
  });
}

/**
 * A report away from the scan screen (YSL-151): the stored 1 600 px photo
 * and the readings the phone kept, with what the review corrected; the
 * frame and the readers' raw passes are gone, `missing` says which.
 */
export function buildKeptReport(
  kept: KeptReading,
  origin: Exclude<ScanReportOrigin, 'scan'>,
  screen: ScanReportV1['screen'],
  image: ReportImage,
  { app, device, now, reception }: ReportContext,
): ScanReportV1 {
  const draft = kept.from === 'draft' ? kept.draft : undefined;
  return {
    version: SCAN_REPORT_VERSION,
    shotAt: kept.photo.createdAt.toISOString(),
    createdAt: now.toISOString(),
    app,
    device,
    shot: null,
    reception: reception ? json(reception) : null,
    image,
    codes: {
      state: draft?.reading === 'failed' ? 'failed' : 'done',
      passes: [],
    },
    ocr: ocrOf(kept),
    fields: json(kept.extraction.fields),
    extraction: json(draft ? draftFields(draft).extraction : {}),
    corrections: draft
      ? correctionsOf(draft)
      : storedCorrections(kept.extraction),
    draft: draft ? json(draft) : { id: kept.id, reading: 'stored' },
    screen,
    origin,
    missing: missingOf(kept),
    kept: keptOf(kept),
    ...(kept.from === 'stored' && kept.parcel
      ? { parcel: json(kept.parcel) }
      : {}),
  };
}

/** Why a tap would send nothing, the photo's file included; null when a report can leave. */
export async function keptReason(
  db: CourrierDatabase,
  files: PhotoFiles | null,
  id: string,
): Promise<KeptReason | null> {
  const loaded = await loadKept(db, id);
  if ('reason' in loaded) return loaded.reason;
  const read = files ? await keptImage(files, loaded.kept.photo) : null;
  return read ? null : 'photo';
}

export type KeptReportInput = {
  /** The upload's id. */
  id: string;
  parcelId: string;
  origin: Exclude<ScanReportOrigin, 'scan'>;
  comment: string;
  screen: (kept: KeptReading) => ScanReportV1['screen'];
  context: ReportContext;
};

/**
 * « Envoyer » away from the scan screen: the report in the outbox, or why
 * it would be empty, in which case nothing is queued.
 */
export async function queueKeptReport(
  db: CourrierDatabase,
  files: PhotoFiles | null,
  input: KeptReportInput,
): Promise<{ queued: LocalScanReport } | { reason: KeptReason }> {
  const loaded = await loadKept(db, input.parcelId, input.context.now);
  if ('reason' in loaded) return loaded;
  const { kept } = loaded;
  const read = files ? await keptImage(files, kept.photo) : null;
  if (!read) return { reason: 'photo' };
  const queued = await enqueueReport(
    db,
    files,
    {
      id: input.id,
      report: buildKeptReport(
        kept,
        input.origin,
        input.screen(kept),
        read.image,
        input.context,
      ),
      comment: input.comment,
      image: read.blob,
      imageType: read.image.type,
    },
    input.context.now,
  );
  return { queued };
}
