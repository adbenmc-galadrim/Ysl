import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { ImportV1Screen } from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import type { AppRouter } from '@repo/api';
import { TRPCClientError } from '@trpc/client';
import { type ChangeEvent, useRef, useState } from 'react';
import { importV1View, type ImportV1State } from '#/features/imports/report';
import { syncNow } from '#/features/sync/sync';
import { useOnline } from '#/lib/use-online';
import { trpcClient } from '#/lib/trpc';

const t = createTranslator(DEFAULT_LOCALE);

function failure(error: unknown): string {
  if (
    error instanceof TRPCClientError &&
    (error as TRPCClientError<AppRouter>).data?.code === 'BAD_REQUEST'
  ) {
    return error.message;
  }
  return t('import.v1.failed.network');
}

/**
 * Réglages › Importer l'historique v1 (admin, F52): the CSV the first app
 * exported goes to the server, which reads it and answers with the report;
 * the parcels then come down with the next sync.
 */
export function ImportV1Page() {
  const navigate = useNavigate();
  const online = useOnline();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ImportV1State>({ step: 'ready' });

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setState({ step: 'importing', fileName: file.name });
    let csv: string;
    try {
      csv = await file.text();
    } catch {
      setState({ step: 'failed', message: t('import.v1.failed.read') });
      return;
    }
    try {
      const report = await trpcClient.imports.v1Csv.mutate({ csv });
      setState({ step: 'done', report });
      if (report.imported > 0) void syncNow();
    } catch (error) {
      setState({ step: 'failed', message: failure(error) });
    }
  };

  const view = importV1View(state, online, t);
  const canPick = view.action !== undefined;

  return (
    <>
      <ImportV1Screen
        {...view}
        onAction={canPick ? () => inputRef.current?.click() : undefined}
        onBack={() => void navigate({ to: '/reglages' })}
      />
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv,text/plain"
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(event) => void onFile(event)}
      />
    </>
  );
}
