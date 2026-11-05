import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { newId } from '@repo/shared/id';
import { SignalerScanButton, type ScanReading } from '@repo/ui';
import { useEffect, useState, type ReactNode } from 'react';
import { db } from '#/features/db/database';
import type { DraftParcel } from '#/features/db/schema';
import { displayVersion } from '#/features/install/app-host';
import { currentReception } from '#/features/settings/company-snapshot';
import {
  currentDisplayContext,
  isInstalledApp,
} from '#/features/install/browser-tab';
import { hasPhotoStorage, photoFiles } from '#/features/photos/opfs';
import type { Reading } from '#/features/scan/reader';
import type { ReadText } from '#/features/scan/text';
import { encodeFrame, ShotKeeper } from '#/features/scan-report/keeper';
import { enqueueReport } from '#/features/scan-report/outbox';
import {
  buildReport,
  deviceOf,
  type ReportContext,
  type ShotReadings,
  type ShotText,
} from '#/features/scan-report/report';
import { useReportSheet } from '#/features/scan-report/use-report-sheet';

const t = createTranslator(DEFAULT_LOCALE);

/** The states the button follows: a label shot, read or not. */
const REPORTABLE = new Set<ScanReading['kind']>([
  'read',
  'unreadable',
  'duplicate',
  'piece',
]);

const textOf = (text: ReadText): ShotText =>
  text.failed
    ? { state: 'failed' }
    : text.ocr
      ? { state: 'done', result: text.ocr }
      : { state: 'skipped' };

/** The app and the phone as the report describes them, at the tap. */
export function reportContext(now: Date): ReportContext {
  const display = currentDisplayContext();
  return {
    app: { version: displayVersion(__APP_VERSION__), build: __APP_VERSION__ },
    device: deviceOf(
      navigator,
      {
        width: window.screen.width,
        height: window.screen.height,
        pixelRatio: window.devicePixelRatio,
      },
      isInstalledApp(display),
    ),
    now,
    reception: currentReception(),
  };
}

/**
 * « Signaler ce scan » on the scan screen, test phase only (D32): the last
 * shot is kept with each reader's output until a new one replaces it; on
 * « Envoyer » the report queues and leaves when it can. Nothing leaves
 * without that tap. Withdrawn before the first real users (YSL-148),
 * with every hook-in point `docs/rapports-scan.md` lists (« Côté iPhone »).
 */
export function useScanReport(
  draftOf: (id: string) => Promise<DraftParcel | undefined>,
) {
  const [keeper] = useState(() => new ShotKeeper());
  const [ready, setReady] = useState(false);
  const report = useReportSheet();

  useEffect(() => () => keeper.drop(), [keeper]);

  /** A new shot: a copy of the frame the readers get, taken before they own it. */
  const keep = async (
    shot: Omit<ShotReadings, 'codes' | 'text'>,
    bitmap: ImageBitmap,
  ) => {
    setReady(false);
    const frame = await createImageBitmap(bitmap).catch(() => null);
    keeper.keep(shot, frame);
  };

  const codes = (reading: Reading) => {
    keeper.codes(reading.draftId, {
      state: reading.failed ? 'failed' : 'done',
      passes: reading.passes,
    });
    setReady(keeper.has());
  };

  const text = (draftId: string, reading: Promise<ReadText>) =>
    keeper.text(draftId, reading.then(textOf));

  const send = (shown: ScanReading) => {
    const words = report.take();
    const tapped = new Date();
    setReady(false);
    report.say(
      t(navigator.onLine ? 'scan.report.queued' : 'scan.report.offline'),
    );
    void (async () => {
      const shot = await keeper.take();
      if (!shot) return;
      try {
        const { blob, image } = await encodeFrame(shot.frame);
        const built = buildReport(
          shot,
          await draftOf(shot.draftId),
          shown,
          image,
          reportContext(tapped),
        );
        await enqueueReport(db, hasPhotoStorage() ? photoFiles : null, {
          id: newId(),
          report: built,
          comment: words,
          image: blob,
          imageType: image.type,
        });
        report.queued();
      } catch {
        report.say(t('scan.report.failed'));
      } finally {
        shot.frame.close();
      }
    })();
  };

  /** Above the bottom row: the word after a report, or the button on a shot. */
  const slot = (shown: ScanReading): ReactNode => {
    if (report.word) return report.word;
    if (!ready || !REPORTABLE.has(shown.kind)) return undefined;
    return <SignalerScanButton onClick={report.openSheet} />;
  };

  const sheet = (shown: ScanReading): ReactNode =>
    report.sheet(() => send(shown));

  return { keep, codes, text, slot, sheet, open: report.open };
}
