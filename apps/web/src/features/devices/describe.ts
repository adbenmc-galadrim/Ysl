import type { Device } from '@repo/contract/devices';
import type { TranslateFn } from '@repo/shared/i18n';
import { formatSyncTime } from '#/features/sync/sync-card';

export type DeviceKind = 'iphone' | 'ipad' | 'mac' | 'android' | 'computer';

/** What the browser says it runs on; iPadOS passes for a Mac, as Safari wants. */
export function deviceKind(userAgent: string | null): DeviceKind {
  const agent = userAgent ?? '';
  if (/iPhone|iPod/.test(agent)) return 'iphone';
  if (/iPad/.test(agent)) return 'ipad';
  if (/Android/.test(agent)) return 'android';
  if (/Macintosh|Mac OS X/.test(agent)) return 'mac';
  return 'computer';
}

/** "iPhone · actif à 10 h 42", "Mac · actif le 27 octobre à 9 h 05". */
export function deviceSubtitle(
  device: Pick<Device, 'userAgent' | 'lastActiveAt' | 'current'>,
  t: TranslateFn,
  now = new Date(),
): string {
  const kind = t(`devices.kind.${deviceKind(device.userAgent)}`);
  if (device.current) return t('devices.current', { kind });
  return t('devices.subtitle', {
    kind,
    when: formatSyncTime(device.lastActiveAt, now),
  });
}
