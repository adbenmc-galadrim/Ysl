export type StorageStatus = {
  persisted: boolean | undefined;
  usage: number | undefined;
  quota: number | undefined;
};

/** Asked at launch, without a gesture: Safari grants it to an installed app (S4). */
export async function requestPersistentStorage(): Promise<boolean | undefined> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return undefined;
  }
  try {
    return await navigator.storage.persist();
  } catch {
    return undefined;
  }
}

export async function readStorageStatus(): Promise<StorageStatus> {
  const storage =
    typeof navigator === 'undefined' ? undefined : navigator.storage;
  const [persisted, estimate] = await Promise.all([
    storage?.persisted?.().catch(() => undefined),
    storage?.estimate?.().catch(() => undefined),
  ]);
  return { persisted, usage: estimate?.usage, quota: estimate?.quota };
}

const UNITS = ['o', 'ko', 'Mo', 'Go'] as const;
const format = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

/** "58 Mo", "1,4 Go": the size as the settings screen reads it. */
export function formatBytes(bytes: number): string {
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000;
    unit += 1;
  }
  const digits = unit > 0 && value < 10 ? 1 : 0;
  const rounded = Number(value.toFixed(digits));
  return `${format.format(rounded)} ${UNITS[unit]}`;
}
