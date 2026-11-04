import { env } from '@repo/shared/env/web';
import { db } from '#/features/db/database';
import { hasPhotoStorage, photoFiles } from '#/features/photos/opfs';
import {
  sendDueReports,
  type ReportOutcome,
  type ReportPost,
} from '#/features/scan-report/outbox';

const INTERVAL_MS = 60_000;

const postReport: ReportPost = async (body) => {
  const response = await fetch(`${env.PUBLIC_SERVER_URL}/api/scan-reports`, {
    method: 'POST',
    body,
    credentials: 'include',
  });
  return {
    status: response.status,
    retryAfter: response.headers.get('Retry-After'),
  };
};

type Listener = (outcome: ReportOutcome) => void;

const listeners = new Set<Listener>();

/** What became of each report sent from now on, for the scan screen's word. */
export function onReportOutcome(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let running: Promise<void> | null = null;
let again = false;
let timer: ReturnType<typeof setInterval> | undefined;

/** Sends what is due, once at a time; a call during a run asks for another. */
export function kickReports(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      const outcomes = await sendDueReports(
        db,
        hasPhotoStorage() ? photoFiles : null,
        postReport,
      ).catch(() => []);
      for (const outcome of outcomes) {
        for (const listener of listeners) listener(outcome);
      }
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

const onOnline = () => void kickReports();

/** With the sync: at sign-in, when the network comes back, every minute. */
export function startReportSender(): void {
  if (timer) return;
  window.addEventListener('online', onOnline);
  timer = setInterval(() => void kickReports(), INTERVAL_MS);
  void kickReports();
}

export function stopReportSender(): void {
  if (!timer) return;
  window.removeEventListener('online', onOnline);
  clearInterval(timer);
  timer = undefined;
}
