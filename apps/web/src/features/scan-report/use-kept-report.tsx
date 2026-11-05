import type {
  ScanReportOrigin,
  ScanReportV1,
} from '@repo/contract/scan-report';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { newId } from '@repo/shared/id';
import { SignalerScanButton } from '@repo/ui';
import type { ReactNode } from 'react';
import { db } from '#/features/db/database';
import { describeReading } from '#/features/diagnostic/model';
import { hasPhotoStorage, photoFiles } from '#/features/photos/opfs';
import {
  type KeptReading,
  keptReason,
  queueKeptReport,
} from '#/features/scan-report/kept';
import { useReportSheet } from '#/features/scan-report/use-report-sheet';
import { reportContext } from '#/features/scan-report/use-scan-report';

const t = createTranslator(DEFAULT_LOCALE);

/** The fields as « Ce qui a été lu » draws them: what the user had in front of them. */
function screenOf(kept: KeptReading, kind: string, now: Date) {
  const view = describeReading(
    {
      kind: kept.from,
      extraction: kept.extraction,
      photoId: kept.photo.id,
    },
    { t, now },
  );
  const fields: ScanReportV1['screen']['fields'] =
    view.kind === 'reading'
      ? view.fields.map(({ label, value, status }) => ({
          label,
          value,
          status,
        }))
      : [];
  return { kind, fields };
}

/**
 * « Signaler ce scan » away from the scan screen (YSL-151), test phase only
 * (D32): in the batch review for the parcel shown, on « Ce qui a été lu ».
 * The frame is gone: the report carries the stored photo and what the
 * phone kept of the reading. Readings purged or photo gone, the button says
 * so instead of queuing an empty report. Nothing leaves without « Envoyer ».
 */
export function useKeptReport(
  id: string | undefined,
  origin: Exclude<ScanReportOrigin, 'scan'>,
  screen: string,
) {
  const report = useReportSheet(t('scan.report.kept'));

  const files = () => (hasPhotoStorage() ? photoFiles : null);

  const tap = async () => {
    if (!id) return;
    const reason = await keptReason(db, files(), id);
    if (reason) {
      report.say(t(`scan.report.none.${reason}`));
      return;
    }
    report.openSheet();
  };

  const send = () => {
    const words = report.take();
    const tapped = new Date();
    if (!id) return;
    void (async () => {
      try {
        const sent = await queueKeptReport(db, files(), {
          id: newId(),
          parcelId: id,
          origin,
          comment: words,
          screen: (kept) => screenOf(kept, screen, tapped),
          context: reportContext(tapped),
        });
        if ('reason' in sent) {
          report.say(t(`scan.report.none.${sent.reason}`));
          return;
        }
        report.say(
          t(navigator.onLine ? 'scan.report.queued' : 'scan.report.offline'),
        );
        report.queued();
      } catch {
        report.say(t('scan.report.failed'));
      }
    })();
  };

  /** Over the screen's button: the word after a tap, or the button. */
  const slot: ReactNode = report.word ?? (
    <SignalerScanButton onClick={() => void tap()} />
  );

  return { slot, sheet: report.sheet(send), open: report.open };
}
