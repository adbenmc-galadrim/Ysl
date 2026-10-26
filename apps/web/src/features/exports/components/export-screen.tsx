import { parcelsCsvFilename } from '@repo/contract/exports';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { ExportScreen as ExportView, type ExportState } from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { csvFile } from '#/features/exports/csv-file';
import { formatTime } from '#/features/parcels/model';
import { shareFile } from '#/lib/share-file';
import { trpcClient } from '#/lib/trpc';
import { useOnline } from '#/lib/use-online';

const t = createTranslator(DEFAULT_LOCALE);

type Progress =
  | { state: 'idle' | 'running' | 'failed' }
  | { state: 'ready'; file: File; count: number }
  | { state: 'done'; count: number; at: Date };

function doneNote(count: number, at: Date) {
  const values = { count, time: formatTime(at) };
  return count > 1
    ? t('export.done.many', values)
    : t('export.done.one', values);
}

export function ExportScreen() {
  const navigate = useNavigate();
  const online = useOnline();
  const [progress, setProgress] = useState<Progress>({ state: 'idle' });

  const share = async (file: File, count: number) => {
    const outcome = await shareFile(file, t('export.share.title'));
    // Closed, or refused once the server took longer than the touch lasts:
    // the file is kept and the next touch only opens the sheet.
    setProgress(
      outcome === 'cancelled' || outcome === 'blocked'
        ? { state: 'ready', file, count }
        : { state: 'done', count, at: new Date() },
    );
  };

  const run = async () => {
    if (progress.state === 'running') return;
    try {
      if (progress.state === 'ready') {
        await share(progress.file, progress.count);
        return;
      }
      setProgress({ state: 'running' });
      const result = await trpcClient.exports.parcelsCsv.query();
      await share(csvFile(result), result.count);
    } catch (error) {
      console.error('Parcels export failed', error);
      setProgress({ state: 'failed' });
    }
  };

  const state: ExportState =
    !online && progress.state !== 'ready' ? 'offline' : progress.state;
  const note =
    state === 'offline'
      ? t('export.offline')
      : progress.state === 'failed'
        ? t('export.failed')
        : progress.state === 'ready'
          ? t('export.ready')
          : progress.state === 'done'
            ? doneNote(progress.count, progress.at)
            : t('export.note');

  return (
    <ExportView
      state={state}
      fileName={
        progress.state === 'ready'
          ? progress.file.name
          : parcelsCsvFilename(new Date())
      }
      note={note}
      onExport={() => void run()}
      onBack={() => void navigate({ to: '/reglages' })}
    />
  );
}
