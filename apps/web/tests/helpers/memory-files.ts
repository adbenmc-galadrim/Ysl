import type { PhotoFiles, StoredFile } from '#/features/photos/opfs';
import { NOW } from './local-rows';

/** The photo files of a test, in memory; `failNextSave` plays a full disk. */
export class MemoryFiles implements PhotoFiles {
  readonly files = new Map<string, { blob: Blob; lastModified: number }>();
  failNextSave = false;

  save(name: string, blob: Blob): Promise<void> {
    if (this.failNextSave) {
      this.failNextSave = false;
      const error = new Error('Quota');
      error.name = 'QuotaExceededError';
      return Promise.reject(error);
    }
    this.files.set(name, { blob, lastModified: NOW.getTime() });
    return Promise.resolve();
  }

  read(name: string): Promise<Blob> {
    const file = this.files.get(name);
    return file ? Promise.resolve(file.blob) : Promise.reject(new Error(name));
  }

  remove(name: string): Promise<void> {
    this.files.delete(name);
    return Promise.resolve();
  }

  list(): Promise<StoredFile[]> {
    return Promise.resolve(
      [...this.files].map(([name, { blob, lastModified }]) => ({
        name,
        size: blob.size,
        lastModified,
      })),
    );
  }
}
