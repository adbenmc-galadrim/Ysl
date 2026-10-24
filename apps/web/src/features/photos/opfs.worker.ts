import {
  PHOTOS_DIRECTORY,
  type SaveReply,
  type SaveRequest,
} from '#/features/photos/protocol';

type SyncAccessHandle = {
  truncate(size: number): void;
  write(buffer: Uint8Array, options: { at: number }): number;
  flush(): void;
  close(): void;
};

type SyncFileHandle = FileSystemFileHandle & {
  createSyncAccessHandle(): Promise<SyncAccessHandle>;
};

async function photosDirectory(): Promise<FileSystemDirectoryHandle> {
  try {
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle(PHOTOS_DIRECTORY, { create: true });
  } catch {
    const error = new Error('Photo storage is unavailable in this browser');
    error.name = 'StorageUnavailableError';
    throw error;
  }
}

async function save({ name, blob }: SaveRequest): Promise<void> {
  const directory = await photosDirectory();
  const file = (await directory.getFileHandle(name, {
    create: true,
  })) as SyncFileHandle;
  const handle = await file.createSyncAccessHandle();
  try {
    handle.truncate(0);
    handle.write(new Uint8Array(await blob.arrayBuffer()), { at: 0 });
    handle.flush();
  } finally {
    handle.close();
  }
}

function describe(error: unknown): { name: string; message: string } {
  if (typeof error === 'object' && error !== null) {
    const { name, message } = error as { name?: unknown; message?: unknown };
    return {
      name: typeof name === 'string' ? name : 'Error',
      message: typeof message === 'string' ? message : 'OPFS error',
    };
  }
  return { name: 'Error', message: String(error) };
}

self.addEventListener('message', (event: MessageEvent<SaveRequest>) => {
  const { id } = event.data;
  save(event.data).then(
    () => self.postMessage({ id, ok: true } satisfies SaveReply),
    (error: unknown) =>
      self.postMessage({
        id,
        ok: false,
        error: describe(error),
      } satisfies SaveReply),
  );
});
