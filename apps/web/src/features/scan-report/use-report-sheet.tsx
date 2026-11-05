import { SCAN_REPORT_COMMENT_MAX_LENGTH } from '@repo/contract/scan-report';
import { SignalerScanSheet, SignalerScanToast } from '@repo/ui';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { reportMessage } from '#/features/scan-report/message';
import { kickReports, onReportOutcome } from '#/features/scan-report/sender';

const TOAST_MS = 4_000;

/**
 * What every « Signaler ce scan » shares, on the scan screen and away from
 * it (YSL-151): the sheet and its optional comment, the word that follows,
 * and the fate of the reports this screen queued.
 */
export function useReportSheet(description?: string) {
  const [comment, setComment] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; at: number } | null>(
    null,
  );

  /* Reports sent from this screen whose fate is not said yet: the minute's retries of older ones stay quiet. */
  const awaiting = useRef(0);

  const say = (message: string) => setToast({ message, at: Date.now() });

  useEffect(
    () =>
      onReportOutcome((settled) => {
        const message = reportMessage(settled);
        if (!message || awaiting.current === 0) return;
        awaiting.current =
          settled.outcome === 'signed-out' ? 0 : awaiting.current - 1;
        say(message);
      }),
    [],
  );

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  /** The comment typed, and the sheet closed. */
  const take = () => {
    const words = comment ?? '';
    setComment(null);
    return words;
  };

  /** One report in the outbox: its fate will be said here. */
  const queued = () => {
    awaiting.current += 1;
    void kickReports();
  };

  const word: ReactNode = toast && (
    <SignalerScanToast className="w-full" message={toast.message} />
  );

  const sheet = (onSubmit: () => void): ReactNode =>
    comment !== null && (
      <SignalerScanSheet
        fixed
        comment={comment}
        description={description}
        maxLength={SCAN_REPORT_COMMENT_MAX_LENGTH}
        onCommentChange={setComment}
        onSubmit={onSubmit}
        onDismiss={() => setComment(null)}
      />
    );

  return {
    open: comment !== null,
    openSheet: () => setComment(''),
    take,
    say,
    queued,
    word,
    sheet,
  };
}
