export type StorageStatus = {
  persisted: boolean | undefined;
  usage: number | undefined;
  quota: number | undefined;
};

export async function requestPersist(): Promise<boolean | undefined> {
  return navigator.storage?.persist?.();
}

export async function readPersisted(): Promise<boolean | undefined> {
  return navigator.storage?.persisted?.();
}

export async function readStorage(): Promise<StorageStatus> {
  const estimate = await navigator.storage?.estimate?.();
  return {
    persisted: await readPersisted(),
    usage: estimate?.usage,
    quota: estimate?.quota,
  };
}
