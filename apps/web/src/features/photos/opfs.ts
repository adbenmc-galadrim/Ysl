import {
  PHOTOS_DIRECTORY,
  type SaveReply,
  type SaveRequest,
} from '#/features/photos/protocol';

export type StoredFile = { name: string; size: number; lastModified: number };

/** The photo files of this device, whatever holds them. */
export type PhotoFiles = {
  save(name: string, blob: Blob): Promise<void>;
  read(name: string): Promise<Blob>;
  remove(name: string): Promise<void>;
  list(): Promise<StoredFile[]>;
};

/** Thrown where OPFS is missing: private browsing, an old browser. */
export class StorageUnavailableError extends Error {
  constructor() {
    super('Le stockage des photos est indisponible sur ce navigateur');
    this.name = 'StorageUnavailableError';
  }
}

type Pending = { resolve: () => void; reject: (error: Error) => void };

type DirectoryWithEntries = FileSystemDirectoryHandle & {
  entries(): AsyncIterable<[string, FileSystemHandle]>;
};

export function hasPhotoStorage(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.storage?.getDirectory === 'function' &&
    typeof Worker !== 'undefined'
  );
}

async function photosDirectory(): Promise<FileSystemDirectoryHandle> {
  if (!hasPhotoStorage()) throw new StorageUnavailableError();
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(PHOTOS_DIRECTORY, { create: true });
}

function isNotFound(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotFoundError';
}

/**
 * Writes go through a worker: a sync access handle is the write OPFS flushes
 * for sure (S4), and it only exists off the main thread.
 */
class OpfsPhotoFiles implements PhotoFiles {
  private worker: Worker | undefined;
  private nextId = 0;
  private readonly pending = new Map<number, Pending>();

  save(name: string, blob: Blob): Promise<void> {
    if (!hasPhotoStorage())
      return Promise.reject(new StorageUnavailableError());
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.writer().postMessage({ id, name, blob } satisfies SaveRequest);
    });
  }

  async read(name: string): Promise<Blob> {
    const directory = await photosDirectory();
    const handle = await directory.getFileHandle(name);
    return handle.getFile();
  }

  async remove(name: string): Promise<void> {
    const directory = await photosDirectory();
    try {
      await directory.removeEntry(name);
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  }

  async list(): Promise<StoredFile[]> {
    const directory = (await photosDirectory()) as DirectoryWithEntries;
    const files: StoredFile[] = [];
    for await (const [name, handle] of directory.entries()) {
      if (handle.kind !== 'file') continue;
      const file = await handle.getFile();
      files.push({ name, size: file.size, lastModified: file.lastModified });
    }
    return files;
  }

  private writer(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL('./opfs.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.addEventListener('message', (event: MessageEvent<SaveReply>) => {
      const reply = event.data;
      const request = this.pending.get(reply.id);
      this.pending.delete(reply.id);
      if (!request) return;
      if (reply.ok) request.resolve();
      else {
        const error = new Error(reply.error.message);
        error.name = reply.error.name;
        request.reject(error);
      }
    });
    worker.addEventListener('error', (event) => {
      for (const request of this.pending.values()) {
        request.reject(new Error(`Worker OPFS : ${event.message}`));
      }
      this.pending.clear();
    });
    this.worker = worker;
    return worker;
  }
}

export const photoFiles: PhotoFiles = new OpfsPhotoFiles();
