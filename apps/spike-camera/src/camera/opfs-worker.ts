import { PHOTOS_DIRECTORY, type SaveReply, type SaveRequest } from './opfs';

type SyncAccessHandle = {
  truncate(size: number): void;
  write(buffer: Uint8Array, options: { at: number }): number;
  flush(): void;
  close(): void;
};

type SyncFileHandle = FileSystemFileHandle & {
  createSyncAccessHandle(): Promise<SyncAccessHandle>;
};

async function save({ name, blob }: SaveRequest): Promise<void> {
  const root = await navigator.storage.getDirectory();
  const directory = await root.getDirectoryHandle(PHOTOS_DIRECTORY, {
    create: true,
  });
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

self.addEventListener('message', (event: MessageEvent<SaveRequest>) => {
  const { id } = event.data;
  save(event.data).then(
    () => self.postMessage({ id, ok: true } satisfies SaveReply),
    (error: unknown) =>
      self.postMessage({
        id,
        ok: false,
        error: String(error),
      } satisfies SaveReply),
  );
});
