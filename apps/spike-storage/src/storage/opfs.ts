export const PHOTOS_DIRECTORY = 'spike-storage';

export type SaveRequest = { id: number; name: string; blob: Blob };
export type SaveReply =
  { id: number; ok: true } | { id: number; ok: false; error: string };

export type StoredFile = { name: string; size: number };

type Pending = { resolve: () => void; reject: (error: Error) => void };

type DirectoryWithEntries = FileSystemDirectoryHandle & {
  entries(): AsyncIterable<[string, FileSystemHandle]>;
};

let worker: Worker | undefined;
let nextId = 0;
const pending = new Map<number, Pending>();

function writer(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./opfs-worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.addEventListener('message', (event: MessageEvent<SaveReply>) => {
      const reply = event.data;
      const request = pending.get(reply.id);
      pending.delete(reply.id);
      if (!request) return;
      if (reply.ok) request.resolve();
      else request.reject(new Error(reply.error));
    });
    worker.addEventListener('error', (event) => {
      for (const request of pending.values()) {
        request.reject(new Error(`Worker OPFS : ${event.message}`));
      }
      pending.clear();
    });
  }
  return worker;
}

async function photosDirectory(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(PHOTOS_DIRECTORY, { create: true });
}

export function savePhoto(name: string, blob: Blob): Promise<void> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    writer().postMessage({ id, name, blob } satisfies SaveRequest);
  });
}

export async function listPhotos(): Promise<StoredFile[]> {
  const directory = (await photosDirectory()) as DirectoryWithEntries;
  const files: StoredFile[] = [];
  for await (const [name, handle] of directory.entries()) {
    if (handle.kind !== 'file') continue;
    const file = await handle.getFile();
    files.push({ name, size: file.size });
  }
  return files;
}

export async function readPhoto(name: string): Promise<Blob> {
  const directory = await photosDirectory();
  const handle = await directory.getFileHandle(name);
  return handle.getFile();
}

export async function clearPhotos(): Promise<void> {
  const root = await navigator.storage.getDirectory();
  try {
    await root.removeEntry(PHOTOS_DIRECTORY, { recursive: true });
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'NotFoundError')) {
      throw error;
    }
  }
}
