import type { CourrierDatabase, OutboxOp } from '#/features/db/schema';
import { listWaitingChanges } from '#/features/sync/changes';

export const BACKUP_FORMAT = 'courrier-secours';
export const BACKUP_VERSION = 1;

export type BackupChange = Omit<OutboxOp, 'seq'> & {
  /** The row as this device holds it now; `null` when it is gone. */
  row: Record<string, unknown> | null;
};

/**
 * The safety copy of what has not reached the server (§8.4.7): every
 * outbox operation with its patch, and the local row it concerns. Data only,
 * never a photo (D8): a backup leaves the phone through the share sheet.
 */
export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: Date;
  app: string;
  pending: number;
  rejected: number;
  changes: BackupChange[];
};

export async function buildBackup(
  db: CourrierDatabase,
  { now = new Date(), app }: { now?: Date; app: string },
): Promise<Backup> {
  const waiting = await listWaitingChanges(db);
  const changes = waiting.map(({ op, row }): BackupChange => {
    const { seq, ...rest } = op;
    void seq;
    return { ...rest, row };
  });
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now,
    app,
    pending: changes.filter((change) => change.state === 'queued').length,
    rejected: changes.filter((change) => change.state === 'rejected').length,
    changes,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `courrier-secours-2026-10-24-1121.json`, in local time, as the agent reads the clock. */
export function backupFileName(now: Date): string {
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `${BACKUP_FORMAT}-${day}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
}

export function backupFile(backup: Backup, now: Date): File {
  return new File([JSON.stringify(backup, null, 2)], backupFileName(now), {
    type: 'application/json',
  });
}
