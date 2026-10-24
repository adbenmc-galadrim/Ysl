import type { TranslateFn } from '@repo/shared/i18n';
import { formatBytes, type StorageStatus } from '#/features/db/storage';

/** The "Hors ligne" value: the space taken, or the warning that it may not stay. */
export function storageValue(
  status: StorageStatus | undefined,
  t: TranslateFn,
): string | undefined {
  if (!status) return undefined;
  if (status.persisted === false) return t('settings.offline.notPersisted');
  return status.usage === undefined ? undefined : formatBytes(status.usage);
}
